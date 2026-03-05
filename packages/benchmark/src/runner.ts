/**
 * Forge Trials — Shared types for benchmark pipeline
 */

// ── Scenario Definition ──────────────────────────────────────────────

export interface BenchmarkScenario {
  id: string;
  name: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  prompt: string;
  /** If this round depends on a previous round's output, reference it here */
  dependsOn?: string;
  systemPrompt: string;
  timeout: number;
  validation: ValidationCriteria;
  /** If true, this round determines chain eligibility */
  chainGate?: boolean;
}

export interface ValidationCriteria {
  requiredElements?: string[];
  requiredKeywords?: string[];
  cssPatterns?: string[];
  jsPatterns?: string[];
  minLength?: number;
  /** Domain-specific scoring hook (0-100). Averaged with standard score. */
  customValidator?: (output: string) => number;
}

// ── Results ──────────────────────────────────────────────────────────

export type Tier = "pass" | "partial" | "fail";

export interface ScoreBreakdown {
  codeExtracted: number;    // 0-20
  validHtml: number;        // 0-10
  requiredElements: number; // 0-25
  requiredKeywords: number; // 0-20
  cssCriteria: number;      // 0-10
  jsCriteria: number;       // 0-10
  codeLength: number;       // 0-5
  total: number;            // 0-100
  tier: Tier;
}

/** Individual run attempt within a 3-run median test */
export interface RunAttempt {
  score: number;       // total score (0-100)
  timeMs: number;
  timedOut: boolean;
  error?: string;
  tokensOut?: number;  // output token count for this attempt
}

export interface RoundResult {
  modelId: string;
  scenarioId: string;
  score: ScoreBreakdown;    // Median run's full breakdown
  timeMs: number;           // Median time across runs
  rawResponse: string;
  extractedCode: string;
  timestamp: number;
  timedOut: boolean;
  error?: string;
  /** Individual run data (3 runs). Present for 3-run median runs. */
  runs?: RunAttempt[];
  tokensIn?: number;   // estimated input tokens (best run)
  tokensOut?: number;  // output tokens (best run)
  cost?: number;       // billed cost in USD for this round
}

export interface ModelScorecard {
  modelId: string;
  modelSize: string;
  results: RoundResult[];
  overallScore: number;
  chainCapable: boolean;
  tier: "expert" | "strong" | "medium" | "basic" | "unusable";
  avgTimeMs: number;
}

export interface BenchmarkRun {
  id: string;
  startedAt: number;
  completedAt?: number;
  models: string[];
  scenarios: string[];
  results: RoundResult[];
  scorecards: ModelScorecard[];
  status: "running" | "completed" | "stopped" | "error";
}

// ── Progress Events (NDJSON) ─────────────────────────────────────────

export type BenchmarkEventType =
  | "run:start"
  | "warmup:complete"
  | "model:start"
  | "model:loading"
  | "round:start"
  | "round:generating"
  | "round:scoring"
  | "round:complete"
  | "model:complete"
  | "model:skipped"
  | "run:complete"
  | "run:error"
  | "run:stopped";

export interface BenchmarkEvent {
  type: BenchmarkEventType;
  modelId?: string;
  scenarioId?: string;
  result?: RoundResult;
  scorecard?: ModelScorecard;
  progress?: {
    currentModel: number;
    totalModels: number;
    currentRound: number;
    totalRounds: number;
    currentRun?: number;       // 1-3, which run attempt
    totalRuns?: number;        // 3 (runs per scenario)
    estimatedRemainingMs: number;
  };
  message: string;
  timestamp: number;
  warmupHtml?: string;
}

// ── Config ───────────────────────────────────────────────────────────

export interface BenchmarkConfig {
  models: string[];
  scenarioIds?: string[]; // if empty, run all
  ollamaUrl: string;
  numCtx: number;
  numPredict: number;
  keepAlive: string;
  savePath: string;
  /** Resume from a previous run ID */
  resumeRunId?: string;
}

/** Cloud benchmark config — models include provider info */
export interface CloudBenchmarkConfig {
  models: { id: string; provider: string; name: string }[];
  scenarioIds?: string[];
  /** When true, providers run their rounds simultaneously */
  parallel?: boolean;
}

// ── Truth Anchor ────────────────────────────────────────────────────

export interface TruthAnchor {
  id: string;
  timestamp: string;
  siteType: string;
  requiredSections: string[];
  requiredFeatures: string[];
  requiredPages: string[];
  styleRequirements: string[];
  outputFormat: string;
  hash: string;
  originalPrompt: string;
}

// ── Hybrid Chain Types ──────────────────────────────────────────────

export interface HybridStep {
  modelId: string;
  provider: string;
  modelName: string;
  role: string; // "Scaffold" | "Enhance" | "Refactor" | "Finish" | custom
}

export interface HybridChain {
  id: string;
  name: string;
  steps: HybridStep[];
  prompt: string;
}

export interface StepChangelog {
  sectionsAdded: string[];
  sectionsRemoved: string[];
  cssRulesAdded: number;
  cssRulesRemoved: number;
  jsFunctionsAdded: number;
  jsFunctionsRemoved: number;
  regressionCheck: "PASSED" | "FAILED";
  regressionDetails: string[];
}

export interface HybridStepResult {
  stepIndex: number;
  modelId: string;
  provider: string;
  role: string;
  content: string;
  extractedCode: string;
  score: ScoreBreakdown;
  timeMs: number;
  tokenCount: number;
  cost: number;
  changelog?: StepChangelog;
  /** Number of attempts (1 = first try passed, 2-3 = retries/escalation) */
  attempts?: number;
  /** Model that was escalated to on strike 3 */
  escalatedTo?: string;
}

export interface HybridChainResult {
  chainId: string;
  chainName: string;
  steps: HybridStepResult[];
  finalScore: ScoreBreakdown;
  totalTimeMs: number;
  totalCost: number;
  timestamp: number;
  juryVerdict?: JuryVerdict;
  truthAnchor?: TruthAnchor;
}

export interface HybridBenchmarkConfig {
  chains: HybridChain[];
  scenarioId?: string; // default: cloud-r1-restaurant
  guardianModelId?: string;
  guardianProvider?: string;
}

export type HybridEventType =
  | "hybrid:start"
  | "hybrid:chain-start"
  | "hybrid:step-start"
  | "hybrid:step-streaming"
  | "hybrid:step-complete"
  | "hybrid:chain-complete"
  | "hybrid:complete"
  | "hybrid:error"
  | "hybrid:stopped"
  | "hybrid:heartbeat"
  | "hybrid:guardian"
  | "hybrid:jury"
  | "hybrid:build-log";

export interface JuryVerdict {
  modelsUsed: string[];
  completeness: { pass: boolean; detail: string };
  quality: { pass: boolean; detail: string };
  accuracy: { pass: boolean; detail: string };
  overall: "APPROVED" | "APPROVED WITH WARNINGS" | "REJECTED";
  agreementCount: number;
  totalJurors: number;
}

export interface HybridEvent {
  type: HybridEventType;
  chainId?: string;
  stepIndex?: number;
  stepResult?: HybridStepResult;
  chainResult?: HybridChainResult;
  partialHtml?: string;
  juryVerdict?: JuryVerdict;
  truthAnchor?: TruthAnchor;
  message: string;
  timestamp: number;
}

// ── Tier Helpers ─────────────────────────────────────────────────────

export function getTier(score: number): Tier {
  if (score >= 60) return "pass";
  if (score >= 30) return "partial";
  return "fail";
}

export function getModelTier(
  overallScore: number
): ModelScorecard["tier"] {
  if (overallScore >= 80) return "expert";
  if (overallScore >= 65) return "strong";
  if (overallScore >= 45) return "medium";
  if (overallScore >= 25) return "basic";
  return "unusable";
}

// ── Cloud Tier Helpers ──────────────────────────────────────────────

/** Cloud tiers use stricter thresholds: 90+ pass, 70-89 partial */
export function getCloudTier(score: number): Tier {
  if (score >= 90) return "pass";
  if (score >= 70) return "partial";
  return "fail";
}

export function getCloudModelTier(
  overallScore: number
): ModelScorecard["tier"] {
  if (overallScore >= 90) return "expert";
  if (overallScore >= 70) return "strong";
  if (overallScore >= 50) return "medium";
  if (overallScore >= 25) return "basic";
  return "unusable";
}
