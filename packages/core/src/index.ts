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
export * from './stores/promptLibraryStore';
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

// ─── Types ───────────────────────────────────────────────
export * from './lib/types/juryGuardian';
export * from './lib/types/threadGuardian';
export * from './lib/types/trading';

// ─── Guardians — Engines ─────────────────────────────────
export * from './guardians/threadGuardian/engine';
export * from './guardians/threadGuardian/contextBuilder';
export * from './guardians/juryGuardian/engine';

// ─── Guardians — Components ─────────────────────────────
export { default as GuardianMonitorPanel } from './guardians/components/GuardianMonitorPanel';
export { default as JuryGuardianIndicator } from './guardians/components/JuryGuardianIndicator';
export { default as JuryMonitorPanel } from './guardians/components/JuryMonitorPanel';
export { default as JuryToast } from './guardians/components/JuryToast';
