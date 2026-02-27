// @sarge/core/index.client — Client-safe exports only
// No Node.js modules (fs, crypto, path, ollama npm package)

// ─── Stores ──────────────────────────────────────────────
export * from './stores/settingsStore';
export * from './stores/modelStore';
export * from './stores/modelRegistryStore';
export * from './stores/providerStore';
export * from './stores/roleStore';
export * from './stores/aiModeStore';
export * from './stores/knowledgeStore';
export * from './stores/vaultStore';
export * from './stores/threadGuardianStore';
export * from './stores/juryGuardianStore';
export * from './stores/fallbackStore';
export * from './stores/airGapStore';
export * from './stores/uiStore';
export * from './stores/promptStore';
export {
  usePromptLibraryStore,
  PROMPT_CATEGORIES,
  PREBUILT_PROMPTS,
  getComplexityColor,
  getOutputTypeLabel,
  type PromptCategory,
  type Prompt as LibraryPrompt,
  type Complexity,
  type OutputType,
} from './stores/promptLibraryStore';
export * from './stores/truthAnchorStore';
export * from './stores/pinStore';
export * from './stores/feedbackStore';
export * from './stores/syncStatusStore';
export * from './stores/saasStore';
export * from './stores/unifiedCapabilitiesStore';
export * from './stores/forensicLogStore';
export * from './stores/testModeStore';
export * from './stores/draftStore';
export * from './stores/journalStore';

// ─── Lib ─────────────────────────────────────────────────
export * from './lib/constants';
export * from './lib/utils';
export * from './lib/types';
export * from './lib/contextInjector';
export * from './lib/capabilityOrchestrator';
export * from './lib/capabilityEventBus';
export * from './lib/ollamaModelGroups';

// ─── Utilities ───────────────────────────────────────────
export * from './lib/utils/storageManager';
export { createDebouncedStorage } from './lib/utils/debouncedStorage';
export { computeForensicHash, verifyChain } from './lib/utils/forensicHash';
export * from './lib/utils/plainEnglish';

// ─── Types (namespaced re-exports to avoid collisions) ──
export type {
  JuryToastData,
  JuryToastType,
  BehaviorConfig as JuryBehaviorConfig,
  SharedContextLedger as JuryLedger,
  KilledResponse as JuryKill,
  PaneResponse as JuryIntervention,
  ActiveFact as JuryActiveFact,
  RetiredFact as JuryRetiredFact,
  Contradiction as JuryContradiction,
  DriftAlert as JuryDriftAlert,
  TierConfig as JuryTierConfig,
  EchoAlert,
  ScopeConfig,
  Tier1Result as JuryTier1Result,
  Tier2Result as JuryTier2Result,
  Tier3Result as JuryTier3Result,
} from './lib/types/juryGuardian';

export type {
  GuardianScope,
  TierStatus,
  TrackedFact,
  RetiredFact as ThreadRetiredFact,
  Contradiction as ThreadContradiction,
  DriftAlert as ThreadDriftAlert,
  TierConfig as ThreadTierConfig,
  Hallucination,
  TopicEntry,
  Tier3SavePoint,
  ModelAttribution,
  EscalationEntry,
  ArchivedLedgerItems,
  ContextLedger,
  ComplexityType,
} from './lib/types/threadGuardian';

export {
  DEFAULT_TIER1_CONFIG,
  DEFAULT_TIER2_CONFIG,
  DEFAULT_TIER3_CONFIG,
} from './lib/types/threadGuardian';

export * from './lib/types/trading';

// ─── Guardians — Engines ─────────────────────────────────
export {
  runTier1 as threadRunTier1,
  runTier2 as threadRunTier2,
  runTier3 as threadRunTier3,
  runTierManually,
  isGuardianRunning,
  startGuardian,
  stopGuardian,
  getGuardianStatus,
  countTokens,
} from './guardians/threadGuardian/engine';
export * from './guardians/threadGuardian/contextBuilder';

export {
  runTier1 as juryRunTier1,
  runTier2 as juryRunTier2,
  vaultNow,
  getJuryStatus,
  isJuryActive,
  startJury,
  stopJury,
  runInterventionCheck,
  queueResponse,
} from './guardians/juryGuardian/engine';

// ─── Guardians — Components ─────────────────────────────
export { default as GuardianMonitorPanel } from './guardians/components/GuardianMonitorPanel';
export { JuryGuardianIndicator } from './guardians/components/JuryGuardianIndicator';
export { JuryMonitorPanel } from './guardians/components/JuryMonitorPanel';
export { JuryToastContainer as JuryToast } from './guardians/components/JuryToast';
