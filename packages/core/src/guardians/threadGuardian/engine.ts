/**
 * Thread Guardian Engine
 *
 * The core background engine that runs three tiers of conversation monitoring
 * on their configured intervals. Each tier has different capabilities:
 *
 * - Tier 1 (Phi-3): Fast indexing every 4 min, handles simple content
 * - Tier 2 (Phi-4): Deep analysis every 10 min, handles complex content
 * - Tier 3 (Claude Opus): Save points every 4 hours, comprehensive verification
 *
 * The engine automatically escalates content between tiers based on:
 * - Token count exceeding tier capacity
 * - Content complexity (code, JSON, tables, log dumps, etc.)
 *
 * ARCHITECTURE NOTES:
 * - Messages are read from localStorage (same source as messageStore)
 * - The guardian ledger in threadGuardianStore only stores guardian-specific metadata
 * - Tier models are configurable via tierConfig.model and tierConfig.provider
 * - Air-gap mode is respected: Tier 3 falls back to local models when enabled
 */

import { useThreadGuardianStore } from '@/lib/stores/threadGuardianStore';
import { useAirGapStore, isCloudProvider } from '@/lib/stores/airGapStore';
import type { Message } from '@/lib/types';
import type {
  TierConfig,
  ContextLedger,
  TrackedFact,
  Contradiction,
  Hallucination,
  DriftAlert,
  TopicEntry,
  ComplexityType,
  Tier3SavePoint,
} from '@/lib/types/threadGuardian';

// Local model fallback priority for air-gap mode
const AIR_GAP_FALLBACK_MODELS = ['llama3.2:latest', 'llama3.2', 'mistral:latest', 'mistral', 'phi4:latest', 'phi4'];

/**
 * Check which local models are available via Ollama.
 * Returns the first available model from the fallback list.
 */
async function getAvailableLocalModel(): Promise<string | null> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    if (!response.ok) return null;

    const data = await response.json();
    const availableModels = (data.models || []).map((m: any) => m.name);

    for (const fallback of AIR_GAP_FALLBACK_MODELS) {
      if (availableModels.some((m: string) => m === fallback || m.startsWith(fallback.split(':')[0]))) {
        return fallback;
      }
    }

    // If none of the preferred models, use any available model
    return availableModels[0] || null;
  } catch {
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Estimate token count from text.
 * Rough estimate: ~4 characters per token (industry standard approximation)
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for an array of messages
 */
export function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    // Count content tokens
    let tokens = countTokens(msg.content);
    // Add overhead for role/metadata (~10 tokens per message)
    tokens += 10;
    return total + tokens;
  }, 0);
}

/**
 * Detect content complexity types in messages.
 * Returns array of detected complexity types that may trigger escalation.
 */
export function detectComplexity(messages: Message[]): ComplexityType[] {
  const detected = new Set<ComplexityType>();

  for (const msg of messages) {
    const content = msg.content;

    // Code: triple backtick blocks
    if (/```[\s\S]*?```/.test(content) || /`[^`]+`/.test(content)) {
      detected.add('code');
    }

    // JSON: curly braces with key-value patterns
    if (/\{[\s\S]*["'][\w]+["']\s*:[\s\S]*\}/.test(content)) {
      detected.add('json');
    }

    // Table: pipe-separated rows or markdown tables
    if (/\|[^|]+\|/.test(content) || /^\s*[-|:]+\s*$/m.test(content)) {
      detected.add('table');
    }

    // Log dump: long content that looks like log output
    if (content.length > 5000) {
      // Check for log patterns: timestamps, log levels, repeated patterns
      const logPatterns = [
        /\d{4}-\d{2}-\d{2}/, // Date patterns
        /\d{2}:\d{2}:\d{2}/, // Time patterns
        /\[(INFO|DEBUG|WARN|ERROR|TRACE)\]/i, // Log levels
        /^\[.*\].*$/m, // Bracketed prefixes
        /^(GET|POST|PUT|DELETE|PATCH)\s+\//m, // HTTP methods
      ];
      if (logPatterns.some((p) => p.test(content))) {
        detected.add('log_dump');
      }
    }

    // Document: very long content (>8000 chars)
    if (content.length > 8000) {
      detected.add('document');
    }

    // Multi-file: references multiple file paths
    const filePathPattern = /(?:^|\s)(?:\.\/|\/|[\w-]+\/)+[\w.-]+\.\w+/g;
    const filePaths = content.match(filePathPattern);
    if (filePaths && filePaths.length >= 2) {
      detected.add('multi_file');
    }

    // Math: mathematical expressions
    if (/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\frac|\\sum|\\int/.test(content)) {
      detected.add('math');
    }

    // API response: structured API-like content
    if (/"status"\s*:\s*\d{3}|"data"\s*:\s*[\[{]|"error"\s*:\s*/.test(content)) {
      detected.add('api_response');
    }
  }

  return Array.from(detected);
}

/**
 * Determine if content should escalate to the next tier.
 *
 * @param tier - The tier configuration to check against
 * @param tokenCount - Estimated token count of content
 * @param complexityTypes - Detected complexity types in the content
 * @param characterCount - Optional character count for fast-path size gate (Tier 1 only)
 * @param currentTier - Which tier is calling this (1, 2, or 3)
 */
export function shouldEscalate(
  tier: TierConfig,
  tokenCount: number,
  complexityTypes: ComplexityType[],
  characterCount?: number,
  currentTier?: 1 | 2 | 3
): { escalate: boolean; reason: string } {
  // Fast-path size gate for Tier 1: if content exceeds 3000 characters, immediately escalate
  // This is checked BEFORE token counting to save computation
  if (currentTier === 1 && characterCount !== undefined && characterCount > 3000) {
    return {
      escalate: true,
      reason: `[LARGE INPUT DETECTED] Content is ${characterCount} characters (>3000), fast-path escalation to Tier 2`,
    };
  }

  // Check token capacity
  if (tokenCount > tier.maxTokenCapacity) {
    return {
      escalate: true,
      reason: `Content is ${tokenCount} tokens, exceeds tier capacity of ${tier.maxTokenCapacity}`,
    };
  }

  // Check complexity types
  const matchingTypes = complexityTypes.filter((t) => tier.complexityTypes.includes(t));
  if (matchingTypes.length > 0) {
    return {
      escalate: true,
      reason: `Detected complex content types: ${matchingTypes.join(', ')}`,
    };
  }

  return { escalate: false, reason: '' };
}

/**
 * Get messages from localStorage for a conversation added after a timestamp.
 */
export function getNewMessages(conversationId: string, sinceTimestamp: number): Message[] {
  try {
    const raw = localStorage.getItem(`ai-workbench-messages-${conversationId}`);
    if (!raw) return [];

    const messages: Message[] = JSON.parse(raw).map((m: any) => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));

    // Filter messages after the timestamp
    return messages.filter((m) => m.timestamp.getTime() > sinceTimestamp);
  } catch (err) {
    console.error('[ThreadGuardian] Failed to get messages:', err);
    return [];
  }
}

/**
 * Get all messages for a conversation.
 */
export function getAllMessages(conversationId: string): Message[] {
  try {
    const raw = localStorage.getItem(`ai-workbench-messages-${conversationId}`);
    if (!raw) return [];

    return JSON.parse(raw).map((m: any) => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
  } catch (err) {
    console.error('[ThreadGuardian] Failed to get all messages:', err);
    return [];
  }
}

/**
 * Get messages after a specific message ID (for Tier 3 save points).
 */
export function getMessagesAfter(conversationId: string, afterMessageId: string): Message[] {
  const allMessages = getAllMessages(conversationId);
  const cutoffIndex = allMessages.findIndex((m) => m.id === afterMessageId);

  if (cutoffIndex === -1) {
    // If message not found, return all messages
    return allMessages;
  }

  return allMessages.slice(cutoffIndex + 1);
}

/**
 * Format messages for the guardian prompt.
 */
function formatMessagesForPrompt(messages: Message[]): string {
  return messages
    .map((m, i) => {
      const role = m.role.toUpperCase();
      const model = m.model ? ` [${m.model}]` : '';
      const timestamp = m.timestamp.toISOString();
      return `[MSG ${i + 1}] ${role}${model} (${timestamp}):\n${m.content}`;
    })
    .join('\n\n---\n\n');
}

// ============================================================================
// TIER RUNNER FUNCTIONS
// ============================================================================

/**
 * Run Tier 1 analysis (Phi-3 fast indexing)
 */
export async function runTier1(conversationId: string): Promise<void> {
  const store = useThreadGuardianStore.getState();

  // Check if guardian is allowed
  if (!store.isGuardianAllowed('chat', conversationId)) {
    console.log('[ThreadGuardian] Tier 1: Not allowed for conversation', conversationId);
    return;
  }

  const { tier1Config, getLedger, updateLedger, addEscalation, recordTierRun, setTierStatus } = store;

  try {
    setTierStatus(1, 'running');

    // Get new messages since last run
    const sinceTimestamp = tier1Config.lastRun || 0;
    const newMessages = getNewMessages(conversationId, sinceTimestamp);

    if (newMessages.length === 0) {
      setTierStatus(1, 'idle');
      return;
    }

    // Calculate total character count for fast-path size gate
    const totalCharCount = newMessages.reduce((total, msg) => total + (msg.content?.length || 0), 0);

    // Count tokens and detect complexity
    const tokenCount = countMessagesTokens(newMessages);
    const complexityTypes = detectComplexity(newMessages);

    // Check for escalation (pass characterCount for Tier 1 fast-path)
    const escalationCheck = shouldEscalate(tier1Config, tokenCount, complexityTypes, totalCharCount, 1);
    if (escalationCheck.escalate) {
      addEscalation(
        conversationId,
        1,
        2,
        complexityTypes.length > 0 ? 'complexity' : 'token_overflow',
        escalationCheck.reason,
        tokenCount
      );
      setTierStatus(1, 'escalated');
      return;
    }

    // Build the prompt
    const ledger = getLedger(conversationId);
    const messagesContext = formatMessagesForPrompt(newMessages);

    const prompt = `Analyze these new messages and update the conversation index.

PREVIOUS SUMMARY:
${ledger.tier1Summary || 'No previous summary.'}

NEW MESSAGES:
${messagesContext}

Provide your analysis as JSON.`;

    // Call the API
    const response = await callGuardianAPI({
      tier: 1,
      conversationId,
      messages: newMessages,
      systemPrompt: tier1Config.systemPrompt,
      model: tier1Config.model,
      provider: tier1Config.provider,
      prompt,
    });

    if (response.skipped) {
      console.log('[ThreadGuardian] Tier 1: Skipped -', response.reason);
      setTierStatus(1, 'idle');
      recordTierRun(1);
      return;
    }

    if (response.error) {
      console.error('[ThreadGuardian] Tier 1: Error -', response.message);
      setTierStatus(1, 'error', response.message);
      return;
    }

    // Parse and apply the response
    const analysis = parseGuardianResponse(response.content || '');

    // Update ledger with Tier 1 findings
    const updates: Partial<ContextLedger> = {
      tier1Summary: analysis.briefSummary || ledger.tier1Summary,
    };

    // Add new facts
    if (analysis.newFacts && Array.isArray(analysis.newFacts)) {
      const newFacts: TrackedFact[] = analysis.newFacts.map((fact: string, i: number) => ({
        fact,
        source: 'assistant' as const,
        model: tier1Config.model,
        messageId: newMessages[newMessages.length - 1]?.id || '',
        messageIndex: ledger.messageCount + newMessages.length - 1,
        verified: false,
        confidence: 0.5, // Tier 1 confidence
        citations: [],
        recordedAt: Date.now(),
      }));
      updates.activeFacts = [...ledger.activeFacts, ...newFacts];
    }

    // Update topic if changed
    if (analysis.topicChange) {
      const newTopic: TopicEntry = {
        topic: analysis.topicChange,
        startIndex: ledger.messageCount,
        endIndex: null,
        startMessageId: newMessages[0]?.id || '',
        endMessageId: null,
      };

      // Close previous topic
      const updatedTopics = ledger.topicIndex.map((t, i) =>
        i === ledger.topicIndex.length - 1
          ? { ...t, endIndex: ledger.messageCount - 1, endMessageId: newMessages[0]?.id || null }
          : t
      );

      updates.topicIndex = [...updatedTopics, newTopic];
      updates.currentTopic = analysis.topicChange;
    }

    // Add suspicious claims as potential hallucinations
    if (analysis.suspiciousClaims && Array.isArray(analysis.suspiciousClaims)) {
      const hallucinations: Hallucination[] = analysis.suspiciousClaims.map((claim: any) => ({
        claim: typeof claim === 'string' ? claim : claim.claim,
        messageId: newMessages[newMessages.length - 1]?.id || '',
        messageIndex: ledger.messageCount + newMessages.length - 1,
        model: typeof claim === 'string' ? '' : claim.model || '',
        flaggedByTier: 1 as const,
        confidence: 0.3, // Low confidence from Tier 1
        reason: 'Flagged by Tier 1 indexer',
        userNotified: false,
        flaggedAt: Date.now(),
      }));
      updates.hallucinations = [...ledger.hallucinations, ...hallucinations];
    }

    // Check if Tier 1 recommends escalation
    if (analysis.shouldEscalate && analysis.escalateReason) {
      addEscalation(conversationId, 1, 2, 'complexity', analysis.escalateReason, tokenCount);
    }

    // Update message count
    updates.messageCount = ledger.messageCount + newMessages.length;
    updates.totalTokenEstimate = ledger.totalTokenEstimate + tokenCount;

    updateLedger(conversationId, updates);
    recordTierRun(1);
    setTierStatus(1, 'idle');

    console.log(`[ThreadGuardian] Tier 1: Processed ${newMessages.length} messages`);
  } catch (err) {
    console.error('[ThreadGuardian] Tier 1: Unexpected error', err);
    setTierStatus(1, 'error', err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Run Tier 2 analysis (Phi-4 deep analysis)
 */
export async function runTier2(conversationId: string): Promise<void> {
  const store = useThreadGuardianStore.getState();

  if (!store.isGuardianAllowed('chat', conversationId)) {
    console.log('[ThreadGuardian] Tier 2: Not allowed for conversation', conversationId);
    return;
  }

  const { tier1Config, tier2Config, getLedger, updateLedger, addEscalation, recordTierRun, setTierStatus } =
    store;

  try {
    setTierStatus(2, 'running');

    const ledger = getLedger(conversationId);

    // Check for Tier 1 escalations since last Tier 2 run
    const tier1Escalations = ledger.escalationLog.filter(
      (e) => e.fromTier === 1 && e.toTier === 2 && e.timestamp > (tier2Config.lastRun || 0)
    );

    // Get messages since last Tier 2 run
    const sinceTimestamp = tier2Config.lastRun || 0;
    const newMessages = getNewMessages(conversationId, sinceTimestamp);

    if (newMessages.length === 0 && tier1Escalations.length === 0) {
      setTierStatus(2, 'idle');
      return;
    }

    // Count tokens and check complexity
    const tokenCount = countMessagesTokens(newMessages);
    const complexityTypes = detectComplexity(newMessages);

    // Check for escalation to Tier 3
    const escalationCheck = shouldEscalate(tier2Config, tokenCount, complexityTypes);
    if (escalationCheck.escalate) {
      addEscalation(
        conversationId,
        2,
        3,
        complexityTypes.length > 0 ? 'complexity' : 'token_overflow',
        escalationCheck.reason,
        tokenCount
      );
      setTierStatus(2, 'escalated');
      return;
    }

    // Build the prompt with Tier 1 context
    const messagesContext = formatMessagesForPrompt(newMessages);
    const escalationContext =
      tier1Escalations.length > 0
        ? `\n\nTIER 1 ESCALATIONS:\n${tier1Escalations.map((e) => `- ${e.reason}: ${e.description}`).join('\n')}`
        : '';

    const prompt = `Perform deep analysis on this conversation segment.

TIER 1 SUMMARY:
${ledger.tier1Summary || 'No Tier 1 summary available.'}

CURRENT FACTS (${ledger.activeFacts.length}):
${ledger.activeFacts.map((f) => `- ${f.fact} (confidence: ${f.confidence})`).join('\n') || 'None'}
${escalationContext}

NEW MESSAGES:
${messagesContext}

Verify facts, detect contradictions, identify hallucinations. Provide your analysis as JSON.`;

    // Call the API
    const response = await callGuardianAPI({
      tier: 2,
      conversationId,
      messages: newMessages,
      systemPrompt: tier2Config.systemPrompt,
      model: tier2Config.model,
      provider: tier2Config.provider,
      prompt,
    });

    if (response.skipped) {
      console.log('[ThreadGuardian] Tier 2: Skipped -', response.reason);
      setTierStatus(2, 'idle');
      recordTierRun(2);
      return;
    }

    if (response.error) {
      console.error('[ThreadGuardian] Tier 2: Error -', response.message);
      setTierStatus(2, 'error', response.message);
      return;
    }

    // Parse and apply the response
    const analysis = parseGuardianResponse(response.content || '');

    const updates: Partial<ContextLedger> = {
      tier2Summary: analysis.detailedSummary || ledger.tier2Summary,
    };

    // Update verified facts with higher confidence
    if (analysis.verifiedFacts && Array.isArray(analysis.verifiedFacts)) {
      const updatedFacts = ledger.activeFacts.map((existingFact) => {
        const verification = analysis.verifiedFacts.find(
          (v: any) => v.fact === existingFact.fact || v.fact?.includes(existingFact.fact.slice(0, 50))
        );
        if (verification) {
          return {
            ...existingFact,
            verified: true,
            confidence: verification.confidence || 0.8,
            citations: verification.citations || existingFact.citations,
          };
        }
        return existingFact;
      });
      updates.activeFacts = updatedFacts;
    }

    // Add contradictions
    if (analysis.contradictions && Array.isArray(analysis.contradictions)) {
      const contradictions: Contradiction[] = analysis.contradictions.map((c: any) => ({
        fact1: c.fact1,
        fact2: c.fact2,
        messageId1: c.msgIds?.[0] || '',
        messageId2: c.msgIds?.[1] || '',
        flaggedByTier: 2 as const,
        confidence: 0.7,
        userNotified: false,
        flaggedAt: Date.now(),
      }));
      updates.contradictions = [...ledger.contradictions, ...contradictions];
    }

    // Add hallucinations
    if (analysis.hallucinations && Array.isArray(analysis.hallucinations)) {
      const hallucinations: Hallucination[] = analysis.hallucinations.map((h: any) => ({
        claim: h.claim,
        messageId: h.msgId || '',
        messageIndex: -1, // Unknown
        model: '',
        flaggedByTier: 2 as const,
        confidence: h.confidence || 0.6,
        reason: h.reason,
        userNotified: false,
        flaggedAt: Date.now(),
      }));
      updates.hallucinations = [...ledger.hallucinations, ...hallucinations];
    }

    // Handle topic analysis and drift
    if (analysis.topicAnalysis?.drift) {
      const drift: DriftAlert = {
        description: analysis.topicAnalysis.drift.description || 'Topic drift detected',
        fromTopic: analysis.topicAnalysis.drift.from || ledger.currentTopic,
        toTopic: analysis.topicAnalysis.drift.to || analysis.topicAnalysis.currentTopic,
        atMessageIndex: ledger.messageCount,
        atMessageId: newMessages[0]?.id || '',
        flaggedByTier: 2,
        intentional: analysis.topicAnalysis.drift.intentional || false,
        flaggedAt: Date.now(),
      };
      updates.driftAlerts = [...ledger.driftAlerts, drift];
    }

    if (analysis.topicAnalysis?.currentTopic) {
      updates.currentTopic = analysis.topicAnalysis.currentTopic;
    }

    // Check if Tier 2 recommends escalation
    if (analysis.shouldEscalate && analysis.escalateReason) {
      addEscalation(conversationId, 2, 3, 'complexity', analysis.escalateReason, tokenCount);
    }

    updateLedger(conversationId, updates);
    recordTierRun(2);
    setTierStatus(2, 'idle');

    console.log(`[ThreadGuardian] Tier 2: Deep analysis complete for ${newMessages.length} messages`);
  } catch (err) {
    console.error('[ThreadGuardian] Tier 2: Unexpected error', err);
    setTierStatus(2, 'error', err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Run Tier 3 analysis (Claude Opus save point)
 *
 * AIR-GAP MODE: If air-gap is enabled and Tier 3 is configured for a cloud provider,
 * we fall back to the best available local model to respect the security promise.
 */
export async function runTier3(conversationId: string): Promise<void> {
  const store = useThreadGuardianStore.getState();

  if (!store.isGuardianAllowed('chat', conversationId)) {
    console.log('[ThreadGuardian] Tier 3: Not allowed for conversation', conversationId);
    return;
  }

  const {
    tier1Config,
    tier2Config,
    tier3Config,
    getLedger,
    updateLedger,
    createSavePoint,
    updateTierConfig,
    addEscalation,
    recordTierRun,
    setTierStatus,
    pruneLedger,
  } = store;

  try {
    setTierStatus(3, 'running');

    // AUTO-PRUNE: Clean up old ledger items at start of every Tier 3 run
    const pruneResult = pruneLedger(conversationId, 30);
    if (pruneResult.prunedFacts > 0 || pruneResult.prunedContradictions > 0) {
      console.log(`[ThreadGuardian] Tier 3: Auto-pruned ledger before analysis`);
    }

    const ledger = getLedger(conversationId);

    // AIR-GAP CHECK: Determine if we need to fall back to local model
    const airGapStore = useAirGapStore.getState();
    let effectiveModel = tier3Config.model;
    let effectiveProvider = tier3Config.provider;
    let isAirGapFallback = false;

    if (airGapStore.airGapEnabled && isCloudProvider(tier3Config.provider)) {
      // Air-gap is on and Tier 3 is configured for cloud - fall back to local
      const localModel = await getAvailableLocalModel();

      if (!localModel) {
        console.error('[ThreadGuardian] Tier 3: Air-gap enabled but no local models available');
        setTierStatus(3, 'error', 'Air-gap mode: No local models available for Tier 3 fallback');
        addEscalation(conversationId, 3, 3, 'complexity', 'Air-gap mode: No local fallback available', 0);
        return;
      }

      effectiveModel = localModel;
      effectiveProvider = 'ollama';
      isAirGapFallback = true;

      console.log(`[ThreadGuardian] Tier 3: Air-gap fallback mode using ${localModel}`);
      addEscalation(
        conversationId,
        3,
        3,
        'complexity',
        `Tier 3 running in air-gap fallback mode using ${localModel}`,
        0
      );
    }

    // Get messages ONLY after the last save point
    let newMessages: Message[];
    if (ledger.tier3SavePoint?.messageIdCutoff) {
      newMessages = getMessagesAfter(conversationId, ledger.tier3SavePoint.messageIdCutoff);
    } else {
      // No save point yet - get all messages
      newMessages = getAllMessages(conversationId);
    }

    // Check for Tier 2 escalations
    const tier2Escalations = ledger.escalationLog.filter(
      (e) => e.fromTier === 2 && e.toTier === 3 && e.timestamp > (tier3Config.lastRun || 0)
    );

    if (newMessages.length === 0 && tier2Escalations.length === 0) {
      setTierStatus(3, 'idle');
      return;
    }

    const tokenCount = countMessagesTokens(newMessages);
    const messagesContext = formatMessagesForPrompt(newMessages);

    const escalationContext =
      tier2Escalations.length > 0
        ? `\n\nTIER 2 ESCALATIONS:\n${tier2Escalations.map((e) => `- ${e.reason}: ${e.description}`).join('\n')}`
        : '';

    const contradictionsContext =
      ledger.contradictions.length > 0
        ? `\n\nUNRESOLVED CONTRADICTIONS:\n${ledger.contradictions.map((c) => `- "${c.fact1}" vs "${c.fact2}"`).join('\n')}`
        : '';

    const hallucinationsContext =
      ledger.hallucinations.filter((h) => !h.userNotified).length > 0
        ? `\n\nPOTENTIAL HALLUCINATIONS:\n${ledger.hallucinations.filter((h) => !h.userNotified).map((h) => `- ${h.claim} (confidence: ${h.confidence})`).join('\n')}`
        : '';

    const prompt = `Create a comprehensive save point for this conversation.

TIER 1 SUMMARY:
${ledger.tier1Summary || 'None'}

TIER 2 SUMMARY:
${ledger.tier2Summary || 'None'}

CURRENT FACTS (${ledger.activeFacts.length}):
${ledger.activeFacts.map((f) => `- ${f.fact} (verified: ${f.verified}, confidence: ${f.confidence})`).join('\n') || 'None'}
${contradictionsContext}${hallucinationsContext}${escalationContext}

MESSAGES SINCE LAST SAVE POINT:
${messagesContext}

Create a verified save point. Resolve contradictions, dismiss false hallucinations, verify facts.
Provide your save point as JSON.`;

    // Call the API (use effective model/provider for air-gap fallback)
    const response = await callGuardianAPI({
      tier: 3,
      conversationId,
      messages: newMessages,
      systemPrompt: tier3Config.systemPrompt,
      model: effectiveModel,
      provider: effectiveProvider,
      prompt,
    });

    if (response.skipped) {
      console.log('[ThreadGuardian] Tier 3: Skipped -', response.reason);
      setTierStatus(3, 'idle');
      recordTierRun(3);
      return;
    }

    if (response.error) {
      console.error('[ThreadGuardian] Tier 3: Error -', response.message);
      setTierStatus(3, 'error', response.message);
      return;
    }

    // Parse and apply the response
    const analysis = parseGuardianResponse(response.content || '');

    if (analysis.savePoint) {
      const lastMessage = newMessages[newMessages.length - 1];

      // Get the save point summary (prefer savePointSummary from new format, fallback to summary)
      const summaryText = analysis.savePoint.savePointSummary || analysis.savePoint.summary || '';
      const summaryTokenCount = analysis.savePoint.savePointTokenCount || countTokens(summaryText);

      // Track which model actually created this save point (may be fallback)
      const actualModel = isAirGapFallback ? `${effectiveModel} (air-gap fallback)` : effectiveModel;

      const savePoint: Tier3SavePoint = {
        summary: summaryText,
        verifiedFacts:
          analysis.savePoint.verifiedFacts?.map((f: any) => ({
            fact: f.fact,
            source: f.source || 'assistant',
            model: actualModel,
            messageId: '',
            messageIndex: -1,
            verified: true,
            // Lower confidence for air-gap fallback models
            confidence: isAirGapFallback ? Math.min(f.confidence || 0.7, 0.8) : (f.confidence || 1.0),
            citations: f.citations || [],
            recordedAt: Date.now(),
          })) || [],
        topicSnapshot: ledger.topicIndex,
        timestamp: Date.now(),
        messageIdCutoff: lastMessage?.id || '',
        messageIndexCutoff: ledger.messageCount + newMessages.length,
        summaryTokenCount,
        createdByModel: actualModel,
      };

      createSavePoint(conversationId, savePoint);

      // Check if save point exceeds 2000 tokens - if so, add compression note for next run
      if (summaryTokenCount > 2000) {
        console.log(
          `[ThreadGuardian] Tier 3: Save point is over budget at ${summaryTokenCount} tokens (limit: 2000). Will request compression on next run.`
        );
        // Store a flag in the ledger to indicate compression is needed
        const compressionNote = `Your save point is over budget at ${summaryTokenCount} tokens. Compress it: merge redundant facts, retire resolved contradictions, and reduce to under 2000 tokens.`;
        // Add this note to tier2Summary so it gets included in next Tier 3 prompt
        const currentTier2Summary = ledger.tier2Summary || '';
        updateLedger(conversationId, {
          tier2Summary: currentTier2Summary
            ? `${currentTier2Summary}\n\n[COMPRESSION REQUIRED]: ${compressionNote}`
            : `[COMPRESSION REQUIRED]: ${compressionNote}`,
        });
      }

      // Update ledger with verified facts from Tier 3
      const updates: Partial<ContextLedger> = {
        activeFacts: savePoint.verifiedFacts,
        // Clear resolved contradictions
        contradictions: analysis.savePoint.resolvedContradictions
          ? ledger.contradictions.filter(
              (c) => !analysis.savePoint.resolvedContradictions.some((r: any) => r.fact1 === c.fact1)
            )
          : ledger.contradictions,
        // Mark dismissed hallucinations
        hallucinations: analysis.savePoint.dismissedHallucinations
          ? ledger.hallucinations.filter(
              (h) => !analysis.savePoint.dismissedHallucinations.some((d: any) => d.claim === h.claim)
            )
          : ledger.hallucinations,
      };

      updateLedger(conversationId, updates);

      // Apply prompt adjustments if suggested
      if (analysis.savePoint.tier1PromptAdjustment) {
        updateTierConfig(1, { systemPrompt: analysis.savePoint.tier1PromptAdjustment });
        console.log('[ThreadGuardian] Tier 3: Applied Tier 1 prompt adjustment');
      }

      if (analysis.savePoint.tier2PromptAdjustment) {
        updateTierConfig(2, { systemPrompt: analysis.savePoint.tier2PromptAdjustment });
        console.log('[ThreadGuardian] Tier 3: Applied Tier 2 prompt adjustment');
      }
    }

    recordTierRun(3);
    setTierStatus(3, 'idle');

    console.log(`[ThreadGuardian] Tier 3: Save point created with ${newMessages.length} messages`);
  } catch (err) {
    console.error('[ThreadGuardian] Tier 3: Unexpected error', err);
    setTierStatus(3, 'error', err instanceof Error ? err.message : 'Unknown error');
  }
}

// ============================================================================
// API HELPER
// ============================================================================

interface GuardianAPIRequest {
  tier: 1 | 2 | 3;
  conversationId: string;
  messages: Message[];
  systemPrompt: string;
  model: string;
  provider: string;
  prompt: string;
}

interface GuardianAPIResponse {
  content?: string;
  skipped?: boolean;
  reason?: string;
  error?: boolean;
  message?: string;
}

/**
 * Call the Thread Guardian API endpoint
 */
async function callGuardianAPI(request: GuardianAPIRequest): Promise<GuardianAPIResponse> {
  try {
    const response = await fetch('/api/thread-guardian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return data;
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : 'Failed to call guardian API',
    };
  }
}

/**
 * Parse JSON response from guardian model, with fallback for malformed JSON
 */
function parseGuardianResponse(content: string): any {
  if (!content) return {};

  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // Try direct JSON parse
    return JSON.parse(content);
  } catch {
    // Return empty object if parsing fails
    console.warn('[ThreadGuardian] Failed to parse response as JSON:', content.slice(0, 200));
    return {};
  }
}

// ============================================================================
// INTERVAL MANAGER
// ============================================================================

let tier1Interval: NodeJS.Timeout | null = null;
let tier2Interval: NodeJS.Timeout | null = null;
let tier3Interval: NodeJS.Timeout | null = null;

/**
 * Start the Thread Guardian for a conversation
 */
export function startGuardian(conversationId: string): void {
  const store = useThreadGuardianStore.getState();

  if (!store.enabled) {
    console.log('[ThreadGuardian] Cannot start - guardian is disabled');
    return;
  }

  // Stop any existing intervals
  stopGuardian();

  // Set active conversation
  store.setActiveConversation(conversationId);

  // Ensure ledger exists
  store.getLedger(conversationId);

  const { tier1Config, tier2Config, tier3Config } = store;

  // Start Tier 1 interval
  tier1Interval = setInterval(() => {
    if (store.enabled && store.activeConversationId === conversationId) {
      runTier1(conversationId);
    }
  }, tier1Config.intervalMs);

  // Start Tier 2 interval
  tier2Interval = setInterval(() => {
    if (store.enabled && store.activeConversationId === conversationId) {
      runTier2(conversationId);
    }
  }, tier2Config.intervalMs);

  // Start Tier 3 interval
  tier3Interval = setInterval(() => {
    if (store.enabled && store.activeConversationId === conversationId) {
      runTier3(conversationId);
    }
  }, tier3Config.intervalMs);

  console.log(`[ThreadGuardian] Started for conversation ${conversationId}`);
  console.log(
    `[ThreadGuardian] Intervals: Tier1=${tier1Config.intervalMs}ms, Tier2=${tier2Config.intervalMs}ms, Tier3=${tier3Config.intervalMs}ms`
  );
}

/**
 * Stop the Thread Guardian
 */
export function stopGuardian(): void {
  if (tier1Interval) {
    clearInterval(tier1Interval);
    tier1Interval = null;
  }

  if (tier2Interval) {
    clearInterval(tier2Interval);
    tier2Interval = null;
  }

  if (tier3Interval) {
    clearInterval(tier3Interval);
    tier3Interval = null;
  }

  const store = useThreadGuardianStore.getState();
  store.setTierStatus(1, 'idle');
  store.setTierStatus(2, 'idle');
  store.setTierStatus(3, 'idle');
  store.setActiveConversation(null);

  console.log('[ThreadGuardian] Stopped');
}

/**
 * Restart the Thread Guardian for a conversation
 */
export function restartGuardian(conversationId: string): void {
  stopGuardian();
  startGuardian(conversationId);
}

/**
 * Run a specific tier manually (for testing or forced updates)
 */
export async function runTierManually(tier: 1 | 2 | 3, conversationId: string): Promise<void> {
  switch (tier) {
    case 1:
      await runTier1(conversationId);
      break;
    case 2:
      await runTier2(conversationId);
      break;
    case 3:
      await runTier3(conversationId);
      break;
  }
}

/**
 * Check if guardian is currently running
 */
export function isGuardianRunning(): boolean {
  return tier1Interval !== null || tier2Interval !== null || tier3Interval !== null;
}

/**
 * Get current guardian status
 */
export function getGuardianStatus(): {
  running: boolean;
  activeConversationId: string | null;
  tier1Status: string;
  tier2Status: string;
  tier3Status: string;
} {
  const store = useThreadGuardianStore.getState();
  return {
    running: isGuardianRunning(),
    activeConversationId: store.activeConversationId,
    tier1Status: store.tier1Config.status,
    tier2Status: store.tier2Config.status,
    tier3Status: store.tier3Config.status,
  };
}
