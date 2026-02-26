// @sarge/core — Foundation plate for all SARGE packages
// Stores, providers, guardians, lib, utilities

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
// promptLibraryStore has a 'Prompt' type that conflicts with promptStore
export { usePromptLibraryStore } from './stores/promptLibraryStore';
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

// ─── Providers ───────────────────────────────────────────
export * from './lib/providers';

// ─── Fallback ────────────────────────────────────────────
export * from './lib/fallback/circuitBreaker';
export * from './lib/fallback/config';
export * from './lib/fallback/errorClassification';
export * from './lib/fallback/fallbackService';
export * from './lib/fallback/providerWrapper';
export * from './lib/fallback/retry';

// ─── Security ────────────────────────────────────────────
export * from './lib/security/cyberSecure';
export * from './lib/security/pathValidator';

// ─── Types (namespaced re-exports to avoid collisions) ──
// juryGuardian types — some names conflict with threadGuardian
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

// threadGuardian types
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

export * from './lib/types/trading';

// ─── Guardians — Engines (namespaced to avoid collisions) ─
export {
  runTier1 as threadRunTier1,
  runTier2 as threadRunTier2,
  runTier3 as threadRunTier3,
  runTierManually,
  isGuardianRunning,
} from './guardians/threadGuardian/engine';
export * from './guardians/threadGuardian/contextBuilder';

export {
  runTier1 as juryRunTier1,
  runTier2 as juryRunTier2,
  vaultNow,
  getJuryStatus,
  isJuryActive,
} from './guardians/juryGuardian/engine';

// ─── Guardians — Components ─────────────────────────────
export { default as GuardianMonitorPanel } from './guardians/components/GuardianMonitorPanel';
export { JuryGuardianIndicator } from './guardians/components/JuryGuardianIndicator';
export { JuryMonitorPanel } from './guardians/components/JuryMonitorPanel';
export { JuryToastContainer as JuryToast } from './guardians/components/JuryToast';
