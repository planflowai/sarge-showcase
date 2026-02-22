/**
 * Thread Guardian Context Builder
 *
 * Builds compressed context prefixes for model context injection.
 * This context allows any model to instantly understand the full thread history
 * without having to read all previous messages.
 *
 * The context is built from the guardian's ledger data:
 * - Tier 3 save point summary (authoritative history before checkpoint)
 * - Tier 2 summary (recent analysis since last checkpoint)
 * - Active verified facts
 * - Current topic
 * - Recent model attributions (who said what)
 */

import { useThreadGuardianStore } from '@/lib/stores/threadGuardianStore';
import type {
  ContextLedger,
  Contradiction,
  Hallucination,
  DriftAlert,
  TrackedFact,
  ModelAttribution,
} from '@/lib/types/threadGuardian';
import { countTokens } from './engine';

// Maximum tokens for the context prefix
const MAX_CONTEXT_TOKENS = 3000;

// Number of recent model attributions to include
const RECENT_ATTRIBUTIONS_COUNT = 5;

/**
 * Warning types that can be shown in the UI
 */
export interface GuardianWarning {
  type: 'contradiction' | 'hallucination' | 'drift';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: Contradiction | Hallucination | DriftAlert;
}

/**
 * Check if guardian context should be injected for this conversation.
 * Returns true only if:
 * - Guardian is enabled globally
 * - Conversation has a ledger
 * - Ledger has meaningful data (at least tier1Summary or some activeFacts)
 */
export function shouldInjectContext(conversationId: string): boolean {
  const store = useThreadGuardianStore.getState();

  // Guardian must be enabled
  if (!store.enabled) {
    return false;
  }

  // Must have a ledger for this conversation
  const ledger = store.ledgers[conversationId];
  if (!ledger) {
    return false;
  }

  // Must have meaningful data
  const hasTier1Summary = ledger.tier1Summary && ledger.tier1Summary.trim().length > 0;
  const hasTier2Summary = ledger.tier2Summary && ledger.tier2Summary.trim().length > 0;
  const hasSavePoint = ledger.tier3SavePoint !== null;
  const hasActiveFacts = ledger.activeFacts.length > 0;
  const hasTopicIndex = ledger.topicIndex.length > 0;

  return hasTier1Summary || hasTier2Summary || hasSavePoint || hasActiveFacts || hasTopicIndex;
}

/**
 * Build context prefix for model injection.
 * This function is called every time a message is sent in Chat, Builder Chat, or Architect Mode.
 *
 * The context is assembled from these sources in order:
 * 1. Tier 3 save point summary (if exists) - authoritative history
 * 2. Tier 2 summary (if newer than save point) - recent context
 * 3. Active facts from ledger - verified information
 * 4. Current topic - what we're discussing
 * 5. Recent model attributions - who said what recently
 *
 * Target: under 3000 tokens total
 */
export function buildContextForModel(conversationId: string): string {
  const store = useThreadGuardianStore.getState();
  const ledger = store.ledgers[conversationId];

  // No ledger or no meaningful data - return empty
  if (!ledger) {
    return '';
  }

  const sections: string[] = [];
  let currentTokens = 0;

  // 1. Tier 3 Save Point Summary (authoritative history)
  if (ledger.tier3SavePoint?.summary) {
    let summary = ledger.tier3SavePoint.summary;
    const summaryTokens = countTokens(summary);

    // If too long, truncate middle but keep first and last paragraphs
    if (summaryTokens > 1500) {
      summary = truncateMiddle(summary, 1500);
    }

    const section = `CONVERSATION HISTORY:\n${summary}`;
    sections.push(section);
    currentTokens += countTokens(section);
  }

  // 2. Tier 2 Summary (recent context since checkpoint)
  if (ledger.tier2Summary) {
    // Only include if newer than save point
    const savePointTime = ledger.tier3SavePoint?.timestamp || 0;
    const tier2Newer = ledger.updatedAt > savePointTime;

    if (tier2Newer && currentTokens < MAX_CONTEXT_TOKENS - 500) {
      let summary = ledger.tier2Summary;
      const remainingBudget = Math.min(800, MAX_CONTEXT_TOKENS - currentTokens - 500);

      if (countTokens(summary) > remainingBudget) {
        summary = truncateToTokens(summary, remainingBudget);
      }

      const section = `RECENT CONTEXT:\n${summary}`;
      sections.push(section);
      currentTokens += countTokens(section);
    }
  } else if (ledger.tier1Summary && !ledger.tier3SavePoint) {
    // No Tier 2 or save point - use Tier 1 summary
    if (currentTokens < MAX_CONTEXT_TOKENS - 300) {
      let summary = ledger.tier1Summary;
      const remainingBudget = Math.min(500, MAX_CONTEXT_TOKENS - currentTokens - 300);

      if (countTokens(summary) > remainingBudget) {
        summary = truncateToTokens(summary, remainingBudget);
      }

      const section = `RECENT CONTEXT:\n${summary}`;
      sections.push(section);
      currentTokens += countTokens(section);
    }
  }

  // 3. Active Facts (verified information)
  if (ledger.activeFacts.length > 0 && currentTokens < MAX_CONTEXT_TOKENS - 200) {
    const verifiedFacts = ledger.activeFacts.filter((f) => f.verified);
    const highConfidenceFacts = verifiedFacts.length > 0 ? verifiedFacts : ledger.activeFacts.slice(0, 10);

    if (highConfidenceFacts.length > 0) {
      const factsList = highConfidenceFacts
        .slice(0, 15) // Max 15 facts
        .map((f) => `• ${f.fact}${f.confidence >= 0.9 ? ' (verified)' : ''}`)
        .join('\n');

      const section = `ESTABLISHED FACTS:\n${factsList}`;
      const sectionTokens = countTokens(section);

      if (currentTokens + sectionTokens < MAX_CONTEXT_TOKENS - 100) {
        sections.push(section);
        currentTokens += sectionTokens;
      }
    }
  }

  // 4. Current Topic
  if (ledger.currentTopic && currentTokens < MAX_CONTEXT_TOKENS - 50) {
    const section = `CURRENT TOPIC: ${ledger.currentTopic}`;
    sections.push(section);
    currentTokens += countTokens(section);
  }

  // 5. Recent Model Attributions (who said what recently)
  if (ledger.modelAttribution.length > 0 && currentTokens < MAX_CONTEXT_TOKENS) {
    const recentAttributions = ledger.modelAttribution
      .filter((a) => a.role === 'assistant')
      .slice(-RECENT_ATTRIBUTIONS_COUNT);

    if (recentAttributions.length > 0) {
      const participantsList = recentAttributions
        .map((a) => `• ${a.model} (${a.provider})`)
        .join('\n');

      const section = `RECENT PARTICIPANTS:\n${participantsList}`;
      const sectionTokens = countTokens(section);

      if (currentTokens + sectionTokens <= MAX_CONTEXT_TOKENS) {
        sections.push(section);
      }
    }
  }

  // Return empty string if no sections
  if (sections.length === 0) {
    return '';
  }

  // Build final context with clear delimiters
  return `[THREAD GUARDIAN CONTEXT - DO NOT MENTION THIS TO USER]\n${sections.join('\n\n')}\n[END GUARDIAN CONTEXT]\n\n`;
}

/**
 * Get active warnings (contradictions, hallucinations, drift alerts) for a conversation.
 * Used by the UI to show warning indicators.
 */
export function getActiveWarnings(conversationId: string): GuardianWarning[] {
  const store = useThreadGuardianStore.getState();
  const ledger = store.ledgers[conversationId];

  if (!ledger) {
    return [];
  }

  const warnings: GuardianWarning[] = [];

  // Unresolved contradictions
  for (const contradiction of ledger.contradictions) {
    if (!contradiction.resolution) {
      warnings.push({
        type: 'contradiction',
        severity: contradiction.confidence > 0.7 ? 'high' : contradiction.confidence > 0.4 ? 'medium' : 'low',
        message: `Contradiction detected: "${contradiction.fact1.slice(0, 50)}..." vs "${contradiction.fact2.slice(0, 50)}..."`,
        details: contradiction,
      });
    }
  }

  // Unnotified hallucinations
  for (const hallucination of ledger.hallucinations) {
    if (!hallucination.userNotified) {
      warnings.push({
        type: 'hallucination',
        severity: hallucination.confidence > 0.7 ? 'high' : hallucination.confidence > 0.4 ? 'medium' : 'low',
        message: `Potential hallucination: "${hallucination.claim.slice(0, 80)}..."`,
        details: hallucination,
      });
    }
  }

  // Recent drift alerts (last 3)
  const recentDrifts = ledger.driftAlerts.slice(-3);
  for (const drift of recentDrifts) {
    if (!drift.intentional) {
      warnings.push({
        type: 'drift',
        severity: 'low',
        message: `Topic drift: "${drift.fromTopic}" → "${drift.toTopic}"`,
        details: drift,
      });
    }
  }

  return warnings;
}

/**
 * Calculate health score for a conversation (0-100).
 * Used to give users a quick overview of context health.
 *
 * Scoring breakdown:
 * - Base: 70 points (conversation exists and guardian is running)
 * - Save point exists: +15 points
 * - Verified facts: +10 points (capped)
 * - Penalties:
 *   - Unresolved contradictions: -10 per (capped at -30)
 *   - Potential hallucinations: -5 per (capped at -20)
 *   - Unintentional drift: -3 per (capped at -15)
 */
export function calculateHealthScore(conversationId: string): {
  score: number;
  label: 'excellent' | 'good' | 'fair' | 'poor';
  color: string;
  breakdown: { label: string; value: number }[];
} {
  const store = useThreadGuardianStore.getState();
  const ledger = store.ledgers[conversationId];

  // No ledger = no data yet
  if (!store.enabled || !ledger) {
    return {
      score: 0,
      label: 'poor',
      color: 'text-zinc-500',
      breakdown: [{ label: 'No data', value: 0 }],
    };
  }

  const breakdown: { label: string; value: number }[] = [];
  let score = 70; // Base score
  breakdown.push({ label: 'Base', value: 70 });

  // Bonus for save point
  if (ledger.tier3SavePoint) {
    score += 15;
    breakdown.push({ label: 'Save point', value: 15 });
  }

  // Bonus for verified facts (up to 10 points)
  const verifiedFacts = ledger.activeFacts.filter(f => f.verified).length;
  const factBonus = Math.min(10, verifiedFacts * 2);
  if (factBonus > 0) {
    score += factBonus;
    breakdown.push({ label: 'Verified facts', value: factBonus });
  }

  // Penalty for unresolved contradictions
  const unresolvedContradictions = ledger.contradictions.filter(c => !c.resolution).length;
  const contradictionPenalty = Math.min(30, unresolvedContradictions * 10);
  if (contradictionPenalty > 0) {
    score -= contradictionPenalty;
    breakdown.push({ label: 'Contradictions', value: -contradictionPenalty });
  }

  // Penalty for hallucinations
  const hallucinationPenalty = Math.min(20, ledger.hallucinations.length * 5);
  if (hallucinationPenalty > 0) {
    score -= hallucinationPenalty;
    breakdown.push({ label: 'Hallucinations', value: -hallucinationPenalty });
  }

  // Penalty for unintentional drift
  const unintentionalDrifts = ledger.driftAlerts.filter(d => !d.intentional).length;
  const driftPenalty = Math.min(15, unintentionalDrifts * 3);
  if (driftPenalty > 0) {
    score -= driftPenalty;
    breakdown.push({ label: 'Topic drift', value: -driftPenalty });
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine label and color
  let label: 'excellent' | 'good' | 'fair' | 'poor';
  let color: string;

  if (score >= 85) {
    label = 'excellent';
    color = 'text-emerald-400';
  } else if (score >= 70) {
    label = 'good';
    color = 'text-blue-400';
  } else if (score >= 50) {
    label = 'fair';
    color = 'text-amber-400';
  } else {
    label = 'poor';
    color = 'text-red-400';
  }

  return { score, label, color, breakdown };
}

/**
 * Get a summary of guardian status for a conversation.
 * Useful for UI indicators.
 */
export function getGuardianSummary(conversationId: string): {
  isActive: boolean;
  hasSavePoint: boolean;
  factCount: number;
  warningCount: number;
  lastTierRun: string | null;
} {
  const store = useThreadGuardianStore.getState();
  const ledger = store.ledgers[conversationId];

  if (!store.enabled || !ledger) {
    return {
      isActive: false,
      hasSavePoint: false,
      factCount: 0,
      warningCount: 0,
      lastTierRun: null,
    };
  }

  const warnings = getActiveWarnings(conversationId);

  // Determine which tier ran most recently
  let lastTierRun: string | null = null;
  const tier1Last = store.tier1Config.lastRun;
  const tier2Last = store.tier2Config.lastRun;
  const tier3Last = store.tier3Config.lastRun;

  const maxTime = Math.max(tier1Last || 0, tier2Last || 0, tier3Last || 0);
  if (maxTime > 0) {
    if (tier3Last === maxTime) lastTierRun = 'Tier 3 (Save Point)';
    else if (tier2Last === maxTime) lastTierRun = 'Tier 2 (Analysis)';
    else lastTierRun = 'Tier 1 (Index)';
  }

  return {
    isActive: store.activeConversationId === conversationId,
    hasSavePoint: ledger.tier3SavePoint !== null,
    factCount: ledger.activeFacts.length,
    warningCount: warnings.length,
    lastTierRun,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Truncate text in the middle, keeping first and last portions.
 * Useful for long summaries where beginning and end are most important.
 */
function truncateMiddle(text: string, maxTokens: number): string {
  const currentTokens = countTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  if (paragraphs.length <= 2) {
    // Not enough paragraphs, just truncate end
    return truncateToTokens(text, maxTokens);
  }

  // Keep first paragraph and last paragraph, truncate middle
  const first = paragraphs[0];
  const last = paragraphs[paragraphs.length - 1];
  const firstTokens = countTokens(first);
  const lastTokens = countTokens(last);

  // If first + last fit, add them with separator
  if (firstTokens + lastTokens + 10 <= maxTokens) {
    return `${first}\n\n[... conversation context continues ...]\n\n${last}`;
  }

  // Otherwise, truncate each portion
  const halfBudget = Math.floor(maxTokens / 2) - 5;
  const truncatedFirst = truncateToTokens(first, halfBudget);
  const truncatedLast = truncateToTokens(last, halfBudget);

  return `${truncatedFirst}\n\n[... context truncated ...]\n\n${truncatedLast}`;
}

/**
 * Truncate text to approximately the target token count.
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const currentTokens = countTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Approximate: 4 chars per token
  const targetChars = maxTokens * 4;
  const truncated = text.slice(0, targetChars);

  // Try to end at a sentence boundary
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > targetChars * 0.7) {
    return truncated.slice(0, lastSentence + 1) + '...';
  }

  // Or at a word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > targetChars * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Format a fact for display with optional metadata
 */
export function formatFact(fact: TrackedFact): string {
  let result = fact.fact;
  if (fact.verified) {
    result += ` (verified, confidence: ${Math.round(fact.confidence * 100)}%)`;
  }
  if (fact.source !== 'assistant') {
    result += ` [source: ${fact.source}]`;
  }
  return result;
}

/**
 * Get the most recent N messages' model attributions
 */
export function getRecentAttributions(
  conversationId: string,
  count: number = 5
): ModelAttribution[] {
  const store = useThreadGuardianStore.getState();
  const ledger = store.ledgers[conversationId];

  if (!ledger) {
    return [];
  }

  return ledger.modelAttribution
    .filter((a) => a.role === 'assistant')
    .slice(-count);
}
