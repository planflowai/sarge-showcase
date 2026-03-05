/**
 * @sarge/guardian — Thread Guardian + Jury Duty engines
 *
 * Thread Guardian: 3-tier AI model escalation for security/validation
 * Jury Duty: Multi-model quality monitoring and intervention
 */

// Thread Guardian
export {
  routeGuardianRequest,
  type GuardianRequest,
  type GuardianResponse,
} from "./thread-guardian";

// Jury Duty
export {
  TIER1_SYSTEM_PROMPT,
  TIER2_SYSTEM_PROMPT,
  TIER3_SYSTEM_PROMPT,
  queueResponse,
  getNewResponses,
  clearResponsesUpTo,
  stopJury,
  runInterventionCheck,
  isJuryActive,
  getJuryStatus,
  parseJsonResponse,
} from "./jury-duty";

// Types
export type {
  ActiveFact,
  RetiredFact,
  Contradiction,
  EchoAlert,
  DriftAlert,
  KilledResponse,
  TierLogEntry,
  SavePoint,
  ModelHealth,
  SharedContextLedger,
  TierConfig,
  BehaviorConfig,
  ScopeConfig,
  Tier1Result,
  Tier2Result,
  Tier3Result,
  PaneResponse,
  JuryToastType,
  JuryToastData,
  JuryApiRequest,
  JuryApiResponse,
} from "./types";
