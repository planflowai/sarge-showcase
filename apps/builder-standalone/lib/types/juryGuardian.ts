// Jury Guardian Types - Thread monitoring system for parallel chat

export interface ActiveFact {
  id: string;
  fact: string;
  sourceModel: string;
  sourcePane: number;
  timestamp: Date;
  verified: boolean;
  verifiedBy: string[]; // which models confirmed
  confidence: number;
  citations: string[];
}

export interface RetiredFact {
  id: string;
  fact: string;
  reason: string;
  retiredAt: Date;
}

export interface Contradiction {
  id: string;
  claim: string;
  models: Array<{ model: string; pane: number; position: string }>;
  timestamp: Date;
  resolved: boolean;
  resolution?: string;
}

export interface EchoAlert {
  id: string;
  claim: string;
  agreeingModels: string[];
  confidence: number;
  timestamp: Date;
  dismissed: boolean;
}

export interface DriftAlert {
  id: string;
  description: string;
  pane: number;
  model: string;
  timestamp: Date;
}

export interface KilledResponse {
  id: string;
  timestamp: Date;
  model: string;
  content: string; // The blocked response
  reason: string;
  type: "echo" | "contradiction";
}

export interface TierLogEntry {
  tier: 1 | 2 | 3;
  timestamp: Date;
  model: string;
  findingsCount: number;
  escalated: boolean;
  duration: number; // ms
}

export interface SavePoint {
  id: string;
  timestamp: Date;
  summary: string;
  verifiedFacts: string[];
  unresolvedItems: Array<{ description: string; models: string[] }>;
  messageIdCutoff: string; // Tier 3 only reads AFTER this point next time
  tokenCount: number;
}

export interface ModelHealth {
  model: string;
  pane: number;
  strikes: number; // 3 strikes = suggest swap
  lastFlag: Date | null;
  flagHistory: Array<{ reason: string; timestamp: Date }>;
}

export interface SharedContextLedger {
  sessionId: string;
  createdAt: Date;
  lastUpdated: Date;

  // Facts tracked across all panes
  activeFacts: ActiveFact[];
  retiredFacts: RetiredFact[];

  // Cross-model contradictions
  contradictions: Contradiction[];

  // Echo chamber alerts
  echoAlerts: EchoAlert[];

  // Drift tracking
  driftAlerts: DriftAlert[];

  // Tier execution log
  tierLog: TierLogEntry[];

  // Save points (Tier 3 only)
  savePoints: SavePoint[];

  // Model health tracking
  modelHealth: Record<string, ModelHealth>;

  // Responses killed by active intervention
  killedResponses: KilledResponse[];
}

// Tier configuration
export interface TierConfig {
  model: string;
  intervalSeconds: number;
  enabled: boolean;
  provider?: string; // for Tier 3 cloud
}

// Behavior settings
export interface BehaviorConfig {
  toastOnly: boolean;
  autoSwapEnabled: boolean;
  autoInjectEnabled: boolean;
  interventionEnabled: boolean; // Active intervention: kill responses before they enter conversation
  echoThreshold: number; // 0.7 = 70% agreement triggers alert
  strikeLimit: number; // 3 = strikes before swap suggestion
}

// Scope settings - which modes the jury watches
export interface ScopeConfig {
  parallelChat: boolean;
  singleChat: boolean;
  architect: boolean;
  builder: boolean;
  debate: boolean; // NEVER
  test: boolean; // NEVER
  tribunal: boolean; // NEVER
  batch: boolean; // NEVER
}

// Tier 1 JSON output format
export interface Tier1Result {
  timestamp: string;
  tier: 1;
  noFindings?: boolean;
  factsFound: Array<{
    fact: string;
    sourceModel: string;
    sourcePane: number;
    confidence: number;
  }>;
  contradictions: Array<{
    claim: string;
    models: string[];
    description: string;
  }>;
  echoRisk: {
    detected: boolean;
    agreeingModels: string[];
    claim: string;
    confidence: number;
  };
  driftDetected: boolean;
  escalateToTier2: boolean;
  reason: string;
}

// Tier 2 JSON output format
export interface Tier2Result {
  timestamp: string;
  tier: 2;
  noFindings?: boolean;
  tier1Corrections: Array<{
    originalFlag: string;
    correction: string;
    action: "dismiss" | "confirm" | "escalate";
  }>;
  verifiedFacts: Array<{
    fact: string;
    verifiedBy: string[];
    confidence: number;
  }>;
  escalateToTier3: boolean;
  reason: string;
}

// Tier 3 JSON output format (save point)
export interface Tier3Result {
  timestamp: string;
  tier: 3;
  summary: string;
  verifiedFacts: string[];
  unresolvedItems: Array<{
    description: string;
    models: string[];
  }>;
  retiredFacts: Array<{
    fact: string;
    reason: string;
  }>;
  overrides: Array<{
    originalTier: 1 | 2;
    originalClaim: string;
    correction: string;
  }>;
  healthAssessment: string;
  tokenCount: number;
}

// Pane response for jury to analyze
export interface PaneResponse {
  pane: number;
  model: string;
  provider: string;
  content: string;
  timestamp: Date;
  messageId: string;
}

// Toast notification types
export type JuryToastType = "echo" | "contradiction" | "drift" | "info" | "strike" | "killed";

export interface JuryToastData {
  id: string;
  type: JuryToastType;
  title: string;
  message: string;
  timestamp: Date;
  sessionId: string;
  alertId?: string; // reference to the alert in ledger
  pane?: number;
  model?: string;
  actions?: Array<{
    label: string;
    action: "dismiss" | "swap" | "inject" | "view";
  }>;
}

// API request/response types
export interface JuryApiRequest {
  tier: 1 | 2 | 3;
  model: string;
  provider: "ollama" | "anthropic" | "openai" | "google" | "xai" | "deepseek";
  messages: Array<{ role: string; content: string }>;
  systemPrompt: string;
}

export interface JuryApiResponse {
  success: boolean;
  result?: Tier1Result | Tier2Result | Tier3Result;
  error?: string;
  duration?: number;
}
