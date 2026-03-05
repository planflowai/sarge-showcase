export type Provider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek"
  | "mistral"
  | "ollama"
  | "lmstudio";

export type ProviderType = "cloud" | "local";

export interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  endpoint?: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  contextWindow: number;
  isEnabled: boolean;
}

export interface ProviderConfig {
  id: Provider;
  name: string;
  type: ProviderType;
  models: ModelConfig[];
  color: string;
  isEnabled: boolean;
  supportsVoice: boolean;
}

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
}

export interface ChatResponse {
  content: string;
  tokens: number;
}

export interface FallbackInfo {
  originalProvider: Provider;
  originalModel: string;
  fallbackProvider: Provider;
  fallbackModel: string;
  attempts: number;
}

export interface VaultAttachment {
  id: string;
  name: string;
  truncated: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: Provider;
  model?: string;
  timestamp: Date;
  tokenCount?: number;
  latencyMs?: number;
  imageUrl?: string;
  imageUrls?: string[]; // Array of base64 data URLs for multiple images
  fallback?: FallbackInfo;
  isError?: boolean;
  errorCode?: string;
  vaultAttachments?: VaultAttachment[];
  isKilled?: boolean; // Jury Guardian killed this response before entering conversation history
  killedReason?: string; // Reason why response was killed (echo/contradiction/etc)
}

export interface ContextFile {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
  addedAt: Date;
}

export type ChatMode = "chat" | "architect";

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  contextFiles: ContextFile[];
  provider: Provider;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  mode?: ChatMode;
}

// --- Roles ---
export interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: Date;
  isDefault?: boolean;
}

// --- Debate ---
export interface DebateParticipant {
  provider: Provider;
  model: string;
  roleId?: string;
  name?: string;
}

export interface Citation {
  source: string;
  url?: string;
  participantIndex: number;
  round: number;
}

export interface Critique {
  id: string;
  fromParticipantIndex: number;
  content: string;
  round: number;
  timestamp: Date;
}

export interface Agreement {
  statement: string;
  consensusLevel: "agreed" | "disagreed" | "debatable";
  percentage: number;
}

export interface RoundSummary {
  round: number;
  judgeProvider: Provider;
  judgeModel: string;
  summary: string;
  agreements: Agreement[];
  citations: Citation[];
  confidenceOverall: number;
  timestamp: Date;
}

export interface Debate {
  id: string;
  topic: string;
  participants: DebateParticipant[];
  judge: DebateParticipant;
  rounds: number;
  currentRound: number;
  messages: Message[];
  critiques: Critique[];
  roundSummaries: RoundSummary[];
  usedCitations: string[];
  redirects: string[];
  sourceConversationId?: string;
  executiveSummary?: string;
  status: "idle" | "running" | "completed" | "error" | "paused";
  createdAt: Date;
  completedAt?: Date;
}

export type ExportFormat = "markdown" | "json" | "csv" | "pdf";

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeContextFiles: boolean;
  includeTimestamps: boolean;
}

export interface UserSettings {
  theme: "light" | "dark";
  defaultProvider: Provider;
  defaultModel: string;
  fontSize: number;
  sendOnEnter: boolean;
  showTokenCount: boolean;
  showLatency: boolean;
  apiKeys: Partial<Record<Provider, string>>;
  localEndpoint: string;
}

// ============================================================================
// TEST MODE TYPES (FROM full_court_v2)
// ============================================================================

export interface TestTheme {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  border: string;
  borderSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  input: string;
}

export function getTestTheme(darkMode: boolean): TestTheme {
  if (darkMode) {
    return {
      bg: 'bg-[#07070a]',
      bgSecondary: 'bg-zinc-900',
      bgTertiary: 'bg-zinc-800/50',
      border: 'border-zinc-800',
      borderSubtle: 'border-zinc-800/50',
      text: 'text-zinc-100',
      textSecondary: 'text-zinc-400',
      textMuted: 'text-zinc-500',
      textFaint: 'text-zinc-600',
      input: 'bg-zinc-800/50 border border-zinc-700/50',
    };
  }
  return {
    bg: 'bg-gray-50',
    bgSecondary: 'bg-white',
    bgTertiary: 'bg-gray-100',
    border: 'border-gray-200',
    borderSubtle: 'border-gray-100',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    textMuted: 'text-gray-400',
    textFaint: 'text-gray-300',
    input: 'bg-white border border-gray-300',
  };
}

export interface ModelAssignment {
  d1: string;
  d2: string;
  d3: string;
  judge: string;
}

export interface EchoConfig {
  rounds: number;
  poisonRound: number;
  poisonAgent: 'd1' | 'd2' | 'd3';
}

export interface BatchConfig {
  tests: number;
  phases: 'all' | 'baseline' | 'poison' | 'tribunal';
  running: boolean;
  paused: boolean;
  progress: number;
  current: string;
}

// Batch run types
export interface BatchRotationEntry {
  testIndex: number;
  questionId?: string;
  question: string;
  poisonId?: string;
  poison: string;
  poisonMarkers: string[];   // Specific false-fact markers from poison
  models: { d1: string; d2: string; d3: string; judge: string };
  poisonRound: number;       // Random round for injection (locked after pass 1)
  poisonAgent: 'd1' | 'd2';  // Never d3 (last debater is worthless)
  rounds: number;
  // Multi-pill support for Chaos/ARMAGEDDON modes
  pillRounds?: number[];     // Array of rounds to inject pills (for multi-pill modes)
  pillAgents?: ('d1' | 'd2')[]; // Array of agents to inject pills via (parallel to pillRounds)
}

export interface BatchTestResult {
  testIndex: number;
  questionId?: string;
  question: string;
  poison: string;
  poisonMarkers?: string[];
  response?: string;
  verdict?: 'CAUGHT' | 'MISSED' | 'RESISTED' | 'FAILED';
  models?: { d1: string; d2: string; d3: string; judge: string };
  poisonRound?: number;
  poisonAgent?: 'd1' | 'd2';
  rounds?: number;
  mode?: 'unfiltered' | 'pill' | 'pill-prompt' | 'defense';
  responses?: {
    round: number;
    agent: 'd1' | 'd2' | 'd3';
    content: string;
    hasEcho: boolean;
    model?: string;
    matchedMarkers?: string[];
    poisonInjected?: boolean;
  }[];
  judgeResponse?: {
    model?: string;
    content?: string;
    tokens?: number;
    timeMs?: number;
    verdict: 'caught' | 'missed' | 'resisted' | 'failed';
  };
  echoCount?: number;
  caughtRound?: number | null;
  killRound?: number;
  killAgent?: string;
  killTriggered?: boolean;
  recoveredCount?: number;
  recoveryTriggered?: boolean;
  recoveryRound?: number;
  recoveryReason?: string;
  correctionStuck?: boolean;
  judgeCaught?: boolean;
  caught?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface BatchPassLog {
  pass: 'pass1-unfiltered' | 'pass2-pill' | 'pass3-pill-prompt' | 'pass4-defense' | 'defense' | 'chaos' | 'chaos-protected' | 'armageddon' | 'armageddon-protected' | '2-agent' | '3-agent';
  mode: 'unfiltered' | 'pill' | 'pill-prompt' | 'defense' | 'chaos' | 'armageddon';
  source?: 'local' | 'cloud';
  batchId?: string;
  startedAt: string;
  completedAt?: string;
  rotation?: BatchRotationEntry[];
  tests: BatchTestResult[];
  // Forensic tamper-proofing
  passHash?: string;
  modelSeed?: string;
  summary: {
    totalTests: number;
    completed: number;
    echoTotal: number;
    caughtTotal: number;
    catchRate: number;
    avgEchoesPerTest: number;
    recoveredTotal: number;
    kills?: number;
    recovered?: number;
    judgeCaughtTotal?: number;
    missedTotal?: number;
    judgePoisoned?: number;
    truthAnchorAttacks?: number;
  };
}

export interface SystemStatus {
  ollama: 'ready' | 'loading' | 'offline';
  supabase: 'ready' | 'loading' | 'offline';
  modelsLoaded: boolean;
}

export interface SessionStats {
  testsRun: number;
  hallucinations: number;
  caught: number;
  echoChambers: number;
  catchRate: number;
  poisonInjected: number;
  poisonKilled: number;
  avgKillRound: number;
}

export interface ForensicEvent {
  id: string;              // Correlation ID
  timestamp: string;
  event: string;
  icon: string;
  type: 'neutral' | 'danger' | 'warning' | 'success';
  text?: string;           // Alternative to event for display
  modelId?: string;        // Which model triggered this event
  agentRole?: 'd1' | 'd2' | 'd3' | 'judge';
  metadata?: {
    tokens?: number;
    latencyMs?: number;
    temperature?: number;
    error?: string;
    promptTokens?: number;
    completionTokens?: number;
  };
  details?: {
    question?: string;
    response?: string;
    echoExcerpt?: string;
    judgeReasoning?: string;
    judgeConfidence?: number;
    triggerPhrase?: string;
    poisonMarkers?: string[];
    matchedMarkers?: string[];
    verdict?: 'caught' | 'missed' | 'resisted' | 'failed';
    model?: string;
    tokens?: number;
    timeMs?: number;
    round?: number;
    agent?: string;
    status?: 'clean' | 'echo' | 'echoed' | 'flagged' | 'suspect' | 'kill-triggered';
    killTriggered?: boolean;
  };
}

export interface EnhancedForensicEvent extends ForensicEvent {
  message: string;           // Human-readable message
  expandable: boolean;       // Can be expanded for details
  text?: string;             // Alternative to message
  details?: {
    question?: string;
    response?: string;
    echoExcerpt?: string;
    judgeReasoning?: string;
    judgeConfidence?: number;      // 0-100 confidence score
    triggerPhrase?: string;        // Exact phrase that triggered catch/miss
    poisonMarkers?: string[];
    matchedMarkers?: string[];     // Which markers were actually matched
    verdict?: 'caught' | 'missed' | 'resisted' | 'failed';
    model?: string;                // Model ID
    tokens?: number;               // Token count
    timeMs?: number;               // Response time in ms
    round?: number;                // Round number
    agent?: string;                // Agent role (d1, d2, d3, judge)
    status?: 'clean' | 'echo' | 'echoed' | 'flagged' | 'suspect' | 'kill-triggered';  // Response status
    killTriggered?: boolean;
  };
}

// ─── Forensic Logging Types ───────────────────────────────────────

export interface ForensicLogEntry {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  timestamp: string;
  category: 'session' | 'round' | 'response' | 'detection' | 'judge' | 'system' | 'human' | 'kill' | 'observation';
  event: string;
  severity: 'info' | 'warning' | 'critical' | 'success';

  input?: string;
  output?: string;

  modelState?: {
    modelId: string;
    agentRole: 'd1' | 'd2' | 'd3' | 'judge';
    tokens: number;
    promptTokens?: number;
    completionTokens?: number;
    responseTimeMs: number;
    temperature?: number;
  };

  aiDecision: {
    action: string;
    confidence: number;
    modelVersion: string;
    explanation: string;
    factors: string[];
    thresholds: Record<string, string>;
  };

  medicationContext: {
    drugName: string;
    prescribedDose: string;
    administeredDose: string;
    variance: string;
  };

  actors: {
    aiSystem: string;
    humanUsers: string[];
    overrideOccurred: boolean;
    overrideReason: string;
  };

  dataLineage: {
    sources: string[];
    transformations: string[];
    validationChecks: string[];
  };

  compliance: {
    regulations: string[];
    retentionUntil: string;
    auditReady: boolean;
    airGapCompliant?: boolean;
    externalConnections?: string;
  };

  previousValues?: Record<string, unknown>;
  alertHistory: string[];
  acknowledgments: string[];
  relatedEvents: string[];
  systemState: {
    responseTimeMs?: number;
    tokenCount?: number;
    roundNumber?: number;
    echoCountSoFar?: number;
    truthAnchorCount?: number;
  };

  hash: string;
  previousHash: string;
}

export interface ForensicSession {
  id: string;
  type: 'single' | 'batch';
  startTime: string;
  endTime?: string;
  config: {
    mode: string;
    rounds: number;
    poisonRound?: number;
    poisonAgent?: string;
    models: Record<string, string>;
    batchSize?: number;
  };
  entryCount: number;
  verdict?: string;
}

export type ForensicLogViewType = 'timeline' | 'investigation' | 'replay' | 'export';

// ─── Test Slot Types ──────────────────────────────────────────────

export interface TestSlotConfig {
  provider: Provider | null;
  model: string;
  roleId?: string;
}

export interface TestParticipant {
  provider: Provider;
  model: string;
  roleId?: string;
  agentType: 'd1' | 'd2' | 'd3' | 'judge';
}

export interface TestPair {
  id: string;
  name: string;
  prompt: string;
  poison: string;
}

export interface PromptSet {
  id: string;
  name: string;
}

export interface SavedTestPrompt {
  id: string;
  name: string;
  content: string;
}

export interface PromptPools {
  d1: SavedTestPrompt[];
  d2: SavedTestPrompt[];
  d3: SavedTestPrompt[];
  judge: SavedTestPrompt[];
}

export interface SelectedPrompts {
  d1: string;
  d2: string;
  d3: string;
  judge: string;
}

export interface ResponseData {
  role: 'd1' | 'd2' | 'd3' | 'judge';
  model: string;
  content: string;
  time: string;
  tokens: number;
  status: 'clean' | 'echo' | 'flagged' | 'verified' | 'caught';
  highlightText?: string;
}

export interface TestResult {
  id: string;
  prompt: string;
  poison: string;
  unfiltered: ResponseData[];
  tribunal: ResponseData[];
  verdict: 'caught' | 'missed' | 'resisted' | 'failed' | 'pending';
  timestamp: Date;
}

export interface SavedQuestion {
  id: string;
  question: string;
  expectedAnswer?: string;
  poisonId?: string;
  tier?: 'easy' | 'hard' | 'batch' | 'cloud';
}

export interface SavedPoison {
  id: string;
  name: string;
  content: string;
  markers: string[]; // Specific false-fact markers to detect echoes (e.g. ["1920", "paris"])
}

export interface SessionRecord {
  id: string;
  timestamp: Date;
  prompt: string;
  verdict: 'caught' | 'missed' | 'resisted' | 'failed';
  models: ModelAssignment;
  catchRate: number;
}
