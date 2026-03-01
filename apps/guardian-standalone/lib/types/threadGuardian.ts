/**
 * Thread Guardian Types
 *
 * The Thread Guardian is a background conversation maintenance system that monitors
 * long-running conversational threads for context health, fact tracking, and drift detection.
 *
 * SCOPE: Only runs on conversational modes (Chat, Builder, Architect).
 * NEVER runs on controlled environments (Debate, Test, Batch, Forensic, Diagnostics, etc.)
 *
 * TIER ARCHITECTURE:
 * - Tier 1 (Phi-3): Fast indexing every 2 min, handles simple content
 * - Tier 2 (Phi-4): Deep analysis every 10 min, handles complex content
 * - Tier 3 (Claude Opus): Save points every 4 hours, handles everything, creates verified snapshots
 */

// ============================================================================
// GUARDIAN SCOPE - Where the guardian can operate
// ============================================================================

export interface GuardianScope {
  /** Modes where guardian is allowed to run */
  allowedModes: string[];

  /** Modes explicitly excluded from guardian monitoring */
  excludedModes: string[];

  /** Per-conversation enable/disable overrides */
  perConversation: Record<string, boolean>;
}

export const DEFAULT_GUARDIAN_SCOPE: GuardianScope = {
  allowedModes: ['chat', 'architect', 'builder'],
  excludedModes: [
    'debate',
    'tribunal',
    'test',
    'batch',
    'forensic',
    'diagnostics',
    'optimizer',
    'review',
    'liveChecker',
  ],
  perConversation: {},
};

// ============================================================================
// CONTEXT LEDGER - Hidden metadata layer tracking conversation health
// ============================================================================

/** A verified or pending fact extracted from the conversation */
export interface TrackedFact {
  /** The fact statement */
  fact: string;

  /** Where this fact came from (user claim, model output, document, etc.) */
  source: 'user' | 'assistant' | 'document' | 'code' | 'external';

  /** Which model stated/confirmed this fact */
  model: string;

  /** Message ID where this fact was stated */
  messageId: string;

  /** Message index (sequential number) */
  messageIndex: number;

  /** Whether this fact has been verified */
  verified: boolean;

  /** Confidence score 0-1 (from the verifying tier) */
  confidence: number;

  /** Message IDs that cite or support this fact */
  citations: string[];

  /** Timestamp when fact was recorded */
  recordedAt: number;
}

/** A fact that has been retired (superseded, corrected, or invalidated) */
export interface RetiredFact {
  /** The original fact */
  fact: string;

  /** Why this fact was retired */
  reason: 'superseded' | 'corrected' | 'contradicted' | 'user_rejected' | 'expired';

  /** What replaced this fact, if applicable */
  supersededBy?: string;

  /** When this fact was retired */
  retiredAt: number;

  /** Original message ID */
  originalMessageId: string;
}

/** Topic tracking for conversation flow */
export interface TopicEntry {
  /** Topic name/description */
  topic: string;

  /** First message index in this topic */
  startIndex: number;

  /** Last message index in this topic (null if current) */
  endIndex: number | null;

  /** First message ID */
  startMessageId: string;

  /** Last message ID (null if current) */
  endMessageId: string | null;

  /** Subtopics within this topic */
  subtopics?: string[];
}

/** A detected contradiction between facts */
export interface Contradiction {
  /** First conflicting fact */
  fact1: string;

  /** Second conflicting fact */
  fact2: string;

  /** Message ID of first fact */
  messageId1: string;

  /** Message ID of second fact */
  messageId2: string;

  /** Which tier flagged this contradiction */
  flaggedByTier: 1 | 2 | 3;

  /** Confidence that this is a real contradiction */
  confidence: number;

  /** Whether user has been notified */
  userNotified: boolean;

  /** Resolution if any */
  resolution?: 'fact1_correct' | 'fact2_correct' | 'both_valid' | 'dismissed';

  /** Timestamp */
  flaggedAt: number;
}

/** A potential hallucination detected */
export interface Hallucination {
  /** The suspicious claim */
  claim: string;

  /** Message ID where claim was made */
  messageId: string;

  /** Message index */
  messageIndex: number;

  /** Model that made the claim */
  model: string;

  /** Which tier flagged this */
  flaggedByTier: 1 | 2 | 3;

  /** Confidence that this is a hallucination (0-1) */
  confidence: number;

  /** Why this was flagged */
  reason: string;

  /** Whether user has been notified */
  userNotified: boolean;

  /** Timestamp */
  flaggedAt: number;
}

/** Topic drift alert */
export interface DriftAlert {
  /** Description of the drift */
  description: string;

  /** Original topic */
  fromTopic: string;

  /** New topic */
  toTopic: string;

  /** Message index where drift occurred */
  atMessageIndex: number;

  /** Message ID where drift occurred */
  atMessageId: string;

  /** Which tier flagged this */
  flaggedByTier: 1 | 2 | 3;

  /** Whether this is intentional drift (user redirected) or unintentional */
  intentional: boolean;

  /** Timestamp */
  flaggedAt: number;
}

/** Tier 3 save point - verified snapshot of conversation state */
export interface Tier3SavePoint {
  /** Comprehensive summary up to this point */
  summary: string;

  /** All verified facts at this point */
  verifiedFacts: TrackedFact[];

  /** Topic index at this point */
  topicSnapshot: TopicEntry[];

  /** When save point was created */
  timestamp: number;

  /** Message ID cutoff (save point covers all messages up to this ID) */
  messageIdCutoff: string;

  /** Message index cutoff */
  messageIndexCutoff: number;

  /** Token count of the summary */
  summaryTokenCount: number;

  /** Model that created this save point */
  createdByModel: string;
}

/** Model attribution for a message */
export interface ModelAttribution {
  /** Message ID */
  messageId: string;

  /** Message index (sequential) */
  messageIndex: number;

  /** Model that generated this response */
  model: string;

  /** Provider (ollama, anthropic, openai, etc.) */
  provider: string;

  /** Estimated token count */
  tokenCount: number;

  /** Message role */
  role: 'user' | 'assistant' | 'system';

  /** Timestamp */
  timestamp: number;
}

/** Escalation log entry */
export interface EscalationEntry {
  /** Tier that escalated */
  fromTier: 1 | 2 | 3;

  /** Tier that received escalation */
  toTier: 2 | 3;

  /** Why escalation occurred */
  reason: 'token_overflow' | 'complexity' | 'contradiction' | 'hallucination' | 'scheduled' | 'manual';

  /** Description of what triggered escalation */
  description: string;

  /** Token count at time of escalation */
  contentTokenCount: number;

  /** Timestamp */
  timestamp: number;
}

/** Archived items from pruning operations */
export interface ArchivedLedgerItems {
  /** Archived facts (pruned due to age) */
  archivedFacts: TrackedFact[];

  /** Archived contradictions (resolved and pruned) */
  archivedContradictions: Contradiction[];

  /** Archived hallucinations (addressed and pruned) */
  archivedHallucinations: Hallucination[];

  /** Archived drift alerts */
  archivedDriftAlerts: DriftAlert[];

  /** When archive was last updated */
  lastPruneAt: number;
}

/** The complete context ledger for a conversation */
export interface ContextLedger {
  /** Conversation ID this ledger tracks */
  conversationId: string;

  /** Current primary topic */
  currentTopic: string;

  /** Active facts being tracked */
  activeFacts: TrackedFact[];

  /** Facts that have been retired */
  retiredFacts: RetiredFact[];

  /** Topic index showing conversation flow */
  topicIndex: TopicEntry[];

  /** Detected contradictions */
  contradictions: Contradiction[];

  /** Potential hallucinations */
  hallucinations: Hallucination[];

  /** Topic drift alerts */
  driftAlerts: DriftAlert[];

  /** Latest Tier 1 (Phi-3) index/summary */
  tier1Summary: string;

  /** Latest Tier 2 (Phi-4) summary with citations */
  tier2Summary: string;

  /** Latest Tier 3 save point */
  tier3SavePoint: Tier3SavePoint | null;

  /** Model attribution for every message */
  modelAttribution: ModelAttribution[];

  /** Escalation history */
  escalationLog: EscalationEntry[];

  /** Total message count */
  messageCount: number;

  /** Estimated total tokens in conversation */
  totalTokenEstimate: number;

  /** Archived items from pruning (don't delete, just move) */
  archivedItems: ArchivedLedgerItems | null;

  /** When ledger was created */
  createdAt: number;

  /** When ledger was last updated */
  updatedAt: number;
}

// ============================================================================
// TIER CONFIGURATION - Settings for each guardian tier
// ============================================================================

export type TierStatus = 'idle' | 'running' | 'error' | 'escalated' | 'disabled';

export type ComplexityType =
  | 'code'
  | 'json'
  | 'table'
  | 'log_dump'
  | 'document'
  | 'multi_file'
  | 'math'
  | 'diagram'
  | 'api_response';

export interface TierConfig {
  /** Model to use for this tier */
  model: string;

  /** Provider (ollama, anthropic, openai, etc.) */
  provider: string;

  /** How often this tier runs (milliseconds) */
  intervalMs: number;

  /** Maximum token capacity before escalating */
  maxTokenCapacity: number;

  /** Content types that auto-escalate to next tier */
  complexityTypes: ComplexityType[];

  /** System prompt for this tier's analysis */
  systemPrompt: string;

  /** Current status */
  status: TierStatus;

  /** Last run timestamp */
  lastRun: number | null;

  /** Total run count */
  runCount: number;

  /** Times this tier escalated */
  escalationCount: number;

  /** Last error message if status is 'error' */
  lastError?: string;
}

// ============================================================================
// DEFAULT TIER CONFIGURATIONS
// ============================================================================

export const DEFAULT_TIER1_CONFIG: TierConfig = {
  model: 'phi3:mini',
  provider: 'ollama',
  intervalMs: 240000, // 4 minutes (per architecture review)
  maxTokenCapacity: 4000,
  complexityTypes: ['code', 'json', 'table'],
  systemPrompt: `You are Tier 1 Organizer. Your ONLY job is to summarize recent conversation into 4-8 short bullets. Include timestamp and topic for each. If input exceeds 3000 characters, output ONLY: [LARGE INPUT DETECTED - Passed to Tier 2]. Never add new rules. Never interpret. Never fix anything. Never assume or create facts. Never override the user. Output ONLY a JSON object with: bullets (array of strings), currentTopic (string), escalated (boolean). Nothing else.`,
  status: 'idle',
  lastRun: null,
  runCount: 0,
  escalationCount: 0,
};

export const DEFAULT_TIER2_CONFIG: TierConfig = {
  model: 'phi4:latest',
  provider: 'ollama',
  intervalMs: 600000, // 10 minutes
  maxTokenCapacity: 16000,
  complexityTypes: ['log_dump', 'document', 'multi_file', 'api_response'],
  systemPrompt: `You are Tier 2 Reviewer. Review Tier 1 summary and any escalated large inputs. Fix factual errors or unclear bullets. Keep it short. Never add, change, or create new rules. Never override the base vault. Never interpret user intent. Output ONLY a JSON object with: correctedBullets (array), newFacts (array with fact, source, citations), contradictions (array), escalatedToTier3 (boolean), reason (string if escalated). Nothing else.`,
  status: 'idle',
  lastRun: null,
  runCount: 0,
  escalationCount: 0,
};

export const DEFAULT_TIER3_CONFIG: TierConfig = {
  model: 'claude-opus-4-6',
  provider: 'anthropic',
  intervalMs: 14400000, // 4 hours
  maxTokenCapacity: 200000,
  complexityTypes: [], // Handles everything
  systemPrompt: `You are Tier 3 Auditor. Review the full ledger plus Tier 2 summary plus all messages since your last save point. Create a clean save point. You may override Tier 1 and Tier 2 ONLY if there is clear factual error. Never add new rules without user approval. Output ONLY a JSON object with: savePointSummary (string, max 2000 tokens — compress if needed), verifiedFacts (array), unresolvedItems (array of objects with timestamp, description, models involved), retiredFacts (array with reason), tier1PromptAdjustment (string or null), tier2PromptAdjustment (string or null), savePointTokenCount (number). Nothing else.`,
  status: 'idle',
  lastRun: null,
  runCount: 0,
  escalationCount: 0,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Create an empty context ledger for a new conversation */
export function createEmptyLedger(conversationId: string): ContextLedger {
  const now = Date.now();
  return {
    conversationId,
    currentTopic: '',
    activeFacts: [],
    retiredFacts: [],
    topicIndex: [],
    contradictions: [],
    hallucinations: [],
    driftAlerts: [],
    tier1Summary: '',
    tier2Summary: '',
    tier3SavePoint: null,
    modelAttribution: [],
    escalationLog: [],
    messageCount: 0,
    totalTokenEstimate: 0,
    archivedItems: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Check if a mode is allowed for guardian monitoring */
export function isModeAllowed(mode: string, scope: GuardianScope): boolean {
  // Explicit exclusion takes precedence
  if (scope.excludedModes.includes(mode)) {
    return false;
  }
  // Must be in allowed list
  return scope.allowedModes.includes(mode);
}
