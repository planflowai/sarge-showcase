/**
 * @sarge/benchmark — Forge Trials
 * Shared scoring engine, scenario definitions, and runner types.
 */

// Types
export type {
  BenchmarkScenario,
  ValidationCriteria,
  Tier,
  ScoreBreakdown,
  RunAttempt,
  RoundResult,
  ModelScorecard,
  BenchmarkRun,
  BenchmarkEventType,
  BenchmarkEvent,
  BenchmarkConfig,
  CloudBenchmarkConfig,
  HybridStep,
  HybridChain,
  HybridStepResult,
  HybridChainResult,
  HybridBenchmarkConfig,
  HybridEventType,
  HybridEvent,
} from "./runner";

// Helpers
export { getTier, getModelTier, getCloudTier, getCloudModelTier } from "./runner";

// Scenarios (Local)
export { BUILDER_SCENARIOS, getScenario, getChainGateScenario } from "./scenarios";

// Scenarios (Cloud)
export { CLOUD_SCENARIOS, getCloudScenario } from "./cloudScenarios";

// Validator
export { scoreResponse, extractCode } from "./validator";

// Explainers (display-only)
export {
  ROUND_EXPLAINERS,
  CRITERION_EXPLAINERS,
  getScoreExplanation,
  getLetterGrade,
  getGradeColor,
  buildModelSummary,
} from "./explainers";
export type { ModelSummary } from "./explainers";
