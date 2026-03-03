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
} from "./runner";

// Helpers
export { getTier, getModelTier } from "./runner";

// Scenarios
export { BUILDER_SCENARIOS, getScenario, getChainGateScenario } from "./scenarios";

// Validator
export { scoreResponse, extractCode } from "./validator";
