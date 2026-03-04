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
} from "./runner";

// Helpers
export { getTier, getModelTier, getCloudTier, getCloudModelTier } from "./runner";

// Scenarios (Local)
export { BUILDER_SCENARIOS, getScenario, getChainGateScenario } from "./scenarios";

// Scenarios (Cloud)
export { CLOUD_SCENARIOS, getCloudScenario } from "./cloudScenarios";

// Validator
export { scoreResponse, extractCode } from "./validator";
