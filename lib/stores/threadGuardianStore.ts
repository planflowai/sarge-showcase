/**
 * Thread Guardian Store
 *
 * Zustand store managing the Thread Guardian system state.
 * Persists configuration and ledgers to localStorage.
 *
 * The Thread Guardian monitors long-running conversations for:
 * - Fact tracking and verification
 * - Contradiction detection
 * - Hallucination flagging
 * - Topic drift alerts
 * - Context save points
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";
import {
  GuardianScope,
  ContextLedger,
  TierConfig,
  Tier3SavePoint,
  EscalationEntry,
  TrackedFact,
  ModelAttribution,
  ArchivedLedgerItems,
  DEFAULT_GUARDIAN_SCOPE,
  DEFAULT_TIER1_CONFIG,
  DEFAULT_TIER2_CONFIG,
  DEFAULT_TIER3_CONFIG,
  createEmptyLedger,
  isModeAllowed,
} from '@/lib/types/threadGuardian';

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface ThreadGuardianState {
  /** Whether the guardian system is globally enabled */
  enabled: boolean;

  /** Scope configuration (allowed/excluded modes, per-conversation overrides) */
  scope: GuardianScope;

  /** Tier 1 configuration (Phi-3, fast indexing) */
  tier1Config: TierConfig;

  /** Tier 2 configuration (Phi-4, deep analysis) */
  tier2Config: TierConfig;

  /** Tier 3 configuration (Claude Opus, save points) */
  tier3Config: TierConfig;

  /** Context ledgers keyed by conversation ID */
  ledgers: Record<string, ContextLedger>;

  /** Currently active conversation being guarded */
  activeConversationId: string | null;

  /** Store hydration status */
  hydrated: boolean;
}

// ============================================================================
// ACTIONS INTERFACE
// ============================================================================

interface ThreadGuardianActions {
  /** Hydrate the store from localStorage */
  hydrate: () => void;

  /** Enable or disable the guardian system globally */
  setEnabled: (enabled: boolean) => void;

  /** Update the guardian scope */
  setScope: (scope: Partial<GuardianScope>) => void;

  /** Enable guardian for a specific conversation */
  enableForConversation: (conversationId: string) => void;

  /** Disable guardian for a specific conversation */
  disableForConversation: (conversationId: string) => void;

  /** Check if guardian is allowed for a mode and conversation */
  isGuardianAllowed: (mode: string, conversationId: string) => boolean;

  /** Update a tier's configuration */
  updateTierConfig: (tier: 1 | 2 | 3, config: Partial<TierConfig>) => void;

  /** Set a tier's status */
  setTierStatus: (tier: 1 | 2 | 3, status: TierConfig['status'], error?: string) => void;

  /** Record a tier run */
  recordTierRun: (tier: 1 | 2 | 3) => void;

  /** Set the active conversation being guarded */
  setActiveConversation: (conversationId: string | null) => void;

  /** Get or create a ledger for a conversation */
  getLedger: (conversationId: string) => ContextLedger;

  /** Update a conversation's ledger */
  updateLedger: (conversationId: string, updates: Partial<ContextLedger>) => void;

  /** Add a fact to a ledger */
  addFact: (conversationId: string, fact: Omit<TrackedFact, 'recordedAt'>) => void;

  /** Retire a fact */
  retireFact: (
    conversationId: string,
    fact: string,
    reason: 'superseded' | 'corrected' | 'contradicted' | 'user_rejected' | 'expired',
    supersededBy?: string
  ) => void;

  /** Add model attribution for a message */
  addAttribution: (conversationId: string, attribution: Omit<ModelAttribution, 'timestamp'>) => void;

  /** Add an escalation entry */
  addEscalation: (
    conversationId: string,
    fromTier: 1 | 2 | 3,
    toTier: 2 | 3,
    reason: EscalationEntry['reason'],
    description: string,
    tokenCount: number
  ) => void;

  /** Create a Tier 3 save point */
  createSavePoint: (conversationId: string, savePoint: Tier3SavePoint) => void;

  /** Reset a conversation's ledger */
  resetLedger: (conversationId: string) => void;

  /** Clear all ledgers */
  clearAllLedgers: () => void;

  /** Get statistics for a conversation */
  getStats: (conversationId: string) => {
    factCount: number;
    contradictionCount: number;
    hallucinationCount: number;
    driftCount: number;
    escalationCount: number;
    hasSavePoint: boolean;
    lastTier1Run: number | null;
    lastTier2Run: number | null;
    lastTier3Run: number | null;
  };

  /** Prune old ledger items (move to archive, not delete) */
  pruneLedger: (conversationId: string, maxAgeDays?: number) => {
    prunedFacts: number;
    prunedContradictions: number;
    prunedHallucinations: number;
    prunedDriftAlerts: number;
  };

  /** Emergency reset - clears ledger but preserves last save point as starting state */
  emergencyReset: (conversationId: string) => void;
}

type ThreadGuardianStore = ThreadGuardianState & ThreadGuardianActions;

// ============================================================================
// INITIAL STATE
// ============================================================================

const getInitialState = (): ThreadGuardianState => ({
  enabled: true,
  scope: { ...DEFAULT_GUARDIAN_SCOPE },
  tier1Config: { ...DEFAULT_TIER1_CONFIG },
  tier2Config: { ...DEFAULT_TIER2_CONFIG },
  tier3Config: { ...DEFAULT_TIER3_CONFIG },
  ledgers: {},
  activeConversationId: null,
  hydrated: false,
});

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useThreadGuardianStore = create<ThreadGuardianStore>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      // Hydration
      hydrate: () => {
        set({ hydrated: true });
      },

      // Global enable/disable
      setEnabled: (enabled) => {
        set({ enabled });
        console.log(`[ThreadGuardian] ${enabled ? 'Enabled' : 'Disabled'}`);
      },

      // Scope management
      setScope: (scopeUpdates) => {
        const current = get().scope;
        set({
          scope: {
            ...current,
            ...scopeUpdates,
            // Deep merge perConversation
            perConversation: {
              ...current.perConversation,
              ...(scopeUpdates.perConversation || {}),
            },
          },
        });
      },

      // Per-conversation controls
      enableForConversation: (conversationId) => {
        const { scope, ledgers } = get();
        set({
          scope: {
            ...scope,
            perConversation: {
              ...scope.perConversation,
              [conversationId]: true,
            },
          },
        });
        // Create ledger if doesn't exist
        if (!ledgers[conversationId]) {
          set({
            ledgers: {
              ...ledgers,
              [conversationId]: createEmptyLedger(conversationId),
            },
          });
        }
        console.log(`[ThreadGuardian] Enabled for conversation: ${conversationId}`);
      },

      disableForConversation: (conversationId) => {
        const { scope } = get();
        set({
          scope: {
            ...scope,
            perConversation: {
              ...scope.perConversation,
              [conversationId]: false,
            },
          },
        });
        console.log(`[ThreadGuardian] Disabled for conversation: ${conversationId}`);
      },

      isGuardianAllowed: (mode, conversationId) => {
        const { enabled, scope } = get();

        // Must be globally enabled
        if (!enabled) return false;

        // Check mode restrictions
        if (!isModeAllowed(mode, scope)) return false;

        // Check per-conversation override
        const perConvSetting = scope.perConversation[conversationId];
        if (perConvSetting !== undefined) {
          return perConvSetting;
        }

        // Default: allowed if mode is allowed
        return true;
      },

      // Tier configuration
      updateTierConfig: (tier, config) => {
        const key = `tier${tier}Config` as 'tier1Config' | 'tier2Config' | 'tier3Config';
        const current = get()[key];
        set({
          [key]: { ...current, ...config },
        });
      },

      setTierStatus: (tier, status, error) => {
        const key = `tier${tier}Config` as 'tier1Config' | 'tier2Config' | 'tier3Config';
        const current = get()[key];
        set({
          [key]: {
            ...current,
            status,
            lastError: error || undefined,
          },
        });
      },

      recordTierRun: (tier) => {
        const key = `tier${tier}Config` as 'tier1Config' | 'tier2Config' | 'tier3Config';
        const current = get()[key];
        set({
          [key]: {
            ...current,
            lastRun: Date.now(),
            runCount: current.runCount + 1,
          },
        });
      },

      // Active conversation
      setActiveConversation: (conversationId) => {
        set({ activeConversationId: conversationId });
      },

      // Ledger management
      getLedger: (conversationId) => {
        const { ledgers } = get();
        if (ledgers[conversationId]) {
          return ledgers[conversationId];
        }
        // Create new ledger
        const newLedger = createEmptyLedger(conversationId);
        set({
          ledgers: {
            ...ledgers,
            [conversationId]: newLedger,
          },
        });
        return newLedger;
      },

      updateLedger: (conversationId, updates) => {
        const { ledgers } = get();
        const current = ledgers[conversationId] || createEmptyLedger(conversationId);
        set({
          ledgers: {
            ...ledgers,
            [conversationId]: {
              ...current,
              ...updates,
              updatedAt: Date.now(),
            },
          },
        });
      },

      addFact: (conversationId, fact) => {
        const { ledgers } = get();
        const ledger = ledgers[conversationId] || createEmptyLedger(conversationId);
        const newFact: TrackedFact = {
          ...fact,
          recordedAt: Date.now(),
        };
        set({
          ledgers: {
            ...ledgers,
            [conversationId]: {
              ...ledger,
              activeFacts: [...ledger.activeFacts, newFact],
              updatedAt: Date.now(),
            },
          },
        });
      },

      retireFact: (conversationId, factText, reason, supersededBy) => {
        const { ledgers } = get();
        const ledger = ledgers[conversationId];
        if (!ledger) return;

        const factIndex = ledger.activeFacts.findIndex((f) => f.fact === factText);
        if (factIndex === -1) return;

        const fact = ledger.activeFacts[factIndex];
        const newActiveFacts = [...ledger.activeFacts];
        newActiveFacts.splice(factIndex, 1);

        set({
          ledgers: {
            ...ledgers,
            [conversationId]: {
              ...ledger,
              activeFacts: newActiveFacts,
              retiredFacts: [
                ...ledger.retiredFacts,
                {
                  fact: factText,
                  reason,
                  supersededBy,
                  retiredAt: Date.now(),
                  originalMessageId: fact.messageId,
                },
              ],
              updatedAt: Date.now(),
            },
          },
        });
      },

      addAttribution: (conversationId, attribution) => {
        const { ledgers } = get();
        const ledger = ledgers[conversationId] || createEmptyLedger(conversationId);
        const newAttribution: ModelAttribution = {
          ...attribution,
          timestamp: Date.now(),
        };
        set({
          ledgers: {
            ...ledgers,
            [conversationId]: {
              ...ledger,
              modelAttribution: [...ledger.modelAttribution, newAttribution],
              messageCount: ledger.messageCount + 1,
              totalTokenEstimate: ledger.totalTokenEstimate + attribution.tokenCount,
              updatedAt: Date.now(),
            },
          },
        });
      },

      addEscalation: (conversationId, fromTier, toTier, reason, description, tokenCount) => {
        const { ledgers } = get();
        const ledger = ledgers[conversationId] || createEmptyLedger(conversationId);

        // Also increment escalation count on the tier config
        const tierKey = `tier${fromTier}Config` as 'tier1Config' | 'tier2Config' | 'tier3Config';
        const tierConfig = get()[tierKey];

        const entry: EscalationEntry = {
          fromTier,
          toTier,
          reason,
          description,
          contentTokenCount: tokenCount,
          timestamp: Date.now(),
        };

        set({
          ledgers: {
            ...ledgers,
            [conversationId]: {
              ...ledger,
              escalationLog: [...ledger.escalationLog, entry],
              updatedAt: Date.now(),
            },
          },
          [tierKey]: {
            ...tierConfig,
            escalationCount: tierConfig.escalationCount + 1,
            status: 'escalated',
          },
        });

        console.log(
          `[ThreadGuardian] Escalation: Tier ${fromTier} -> Tier ${toTier} (${reason}: ${description})`
        );
      },

      createSavePoint: (conversationId, savePoint) => {
        const { ledgers } = get();
        const ledger = ledgers[conversationId] || createEmptyLedger(conversationId);

        set({
          ledgers: {
            ...ledgers,
            [conversationId]: {
              ...ledger,
              tier3SavePoint: savePoint,
              updatedAt: Date.now(),
            },
          },
        });

        console.log(
          `[ThreadGuardian] Save point created for ${conversationId} at message ${savePoint.messageIndexCutoff}`
        );
      },

      resetLedger: (conversationId) => {
        const { ledgers } = get();
        set({
          ledgers: {
            ...ledgers,
            [conversationId]: createEmptyLedger(conversationId),
          },
        });
        console.log(`[ThreadGuardian] Ledger reset for ${conversationId}`);
      },

      clearAllLedgers: () => {
        set({ ledgers: {} });
        console.log('[ThreadGuardian] All ledgers cleared');
      },

      getStats: (conversationId) => {
        const { ledgers, tier1Config, tier2Config, tier3Config } = get();
        const ledger = ledgers[conversationId];

        if (!ledger) {
          return {
            factCount: 0,
            contradictionCount: 0,
            hallucinationCount: 0,
            driftCount: 0,
            escalationCount: 0,
            hasSavePoint: false,
            lastTier1Run: null,
            lastTier2Run: null,
            lastTier3Run: null,
          };
        }

        return {
          factCount: ledger.activeFacts.length,
          contradictionCount: ledger.contradictions.length,
          hallucinationCount: ledger.hallucinations.length,
          driftCount: ledger.driftAlerts.length,
          escalationCount: ledger.escalationLog.length,
          hasSavePoint: ledger.tier3SavePoint !== null,
          lastTier1Run: tier1Config.lastRun,
          lastTier2Run: tier2Config.lastRun,
          lastTier3Run: tier3Config.lastRun,
        };
      },

      // Prune old ledger items - moves to archive instead of deleting
      pruneLedger: (conversationId, maxAgeDays = 30) => {
        const { ledgers } = get();
        const ledger = ledgers[conversationId];
        if (!ledger) {
          return { prunedFacts: 0, prunedContradictions: 0, prunedHallucinations: 0, prunedDriftAlerts: 0 };
        }

        const now = Date.now();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        const cutoffTime = now - maxAgeMs;

        // Initialize or get existing archive
        const archive: ArchivedLedgerItems = ledger.archivedItems || {
          archivedFacts: [],
          archivedContradictions: [],
          archivedHallucinations: [],
          archivedDriftAlerts: [],
          lastPruneAt: 0,
        };

        // Prune facts: Move old unverified facts to retired, then to archive
        // KEEP: All facts verified by Tier 3 (regardless of age)
        // KEEP: All facts from current conversation (recent)
        const factsToArchive = ledger.activeFacts.filter(
          (f) => f.recordedAt < cutoffTime && !f.verified
        );
        const factsToKeep = ledger.activeFacts.filter(
          (f) => f.recordedAt >= cutoffTime || f.verified
        );

        // Move pruned facts to retired first
        const newRetiredFacts = [
          ...ledger.retiredFacts,
          ...factsToArchive.map((f) => ({
            fact: f.fact,
            reason: 'expired' as const,
            retiredAt: now,
            originalMessageId: f.messageId,
          })),
        ];

        // Archive old retired facts
        const retiredToArchive = newRetiredFacts.filter((f) => f.retiredAt < cutoffTime);
        const retiredToKeep = newRetiredFacts.filter((f) => f.retiredAt >= cutoffTime);
        archive.archivedFacts = [
          ...archive.archivedFacts,
          ...factsToArchive, // Archive the original tracked facts
        ];

        // Prune contradictions: Archive RESOLVED ones older than maxAge
        // KEEP: All UNRESOLVED contradictions regardless of age
        const contradictionsToArchive = ledger.contradictions.filter(
          (c) => c.flaggedAt < cutoffTime && c.resolution !== undefined
        );
        const contradictionsToKeep = ledger.contradictions.filter(
          (c) => c.flaggedAt >= cutoffTime || c.resolution === undefined
        );
        archive.archivedContradictions = [...archive.archivedContradictions, ...contradictionsToArchive];

        // Prune hallucinations: Archive ADDRESSED ones older than maxAge
        // KEEP: All unaddressed hallucinations regardless of age
        const hallucinationsToArchive = ledger.hallucinations.filter(
          (h) => h.flaggedAt < cutoffTime && h.userNotified
        );
        const hallucinationsToKeep = ledger.hallucinations.filter(
          (h) => h.flaggedAt >= cutoffTime || !h.userNotified
        );
        archive.archivedHallucinations = [...archive.archivedHallucinations, ...hallucinationsToArchive];

        // Prune drift alerts
        const driftToArchive = ledger.driftAlerts.filter((d) => d.flaggedAt < cutoffTime);
        const driftToKeep = ledger.driftAlerts.filter((d) => d.flaggedAt >= cutoffTime);
        archive.archivedDriftAlerts = [...archive.archivedDriftAlerts, ...driftToArchive];

        archive.lastPruneAt = now;

        // Update the ledger
        set({
          ledgers: {
            ...ledgers,
            [conversationId]: {
              ...ledger,
              activeFacts: factsToKeep,
              retiredFacts: retiredToKeep,
              contradictions: contradictionsToKeep,
              hallucinations: hallucinationsToKeep,
              driftAlerts: driftToKeep,
              archivedItems: archive,
              updatedAt: now,
            },
          },
        });

        const result = {
          prunedFacts: factsToArchive.length,
          prunedContradictions: contradictionsToArchive.length,
          prunedHallucinations: hallucinationsToArchive.length,
          prunedDriftAlerts: driftToArchive.length,
        };

        console.log(
          `[ThreadGuardian] Pruned ledger for ${conversationId}: ` +
            `${result.prunedFacts} facts, ${result.prunedContradictions} contradictions, ` +
            `${result.prunedHallucinations} hallucinations, ${result.prunedDriftAlerts} drift alerts`
        );

        return result;
      },

      // Emergency reset - clears ledger but preserves last save point
      emergencyReset: (conversationId) => {
        const { ledgers } = get();
        const ledger = ledgers[conversationId];

        if (!ledger) {
          console.log(`[ThreadGuardian] Emergency reset: No ledger found for ${conversationId}`);
          return;
        }

        const lastSavePoint = ledger.tier3SavePoint;
        const newLedger = createEmptyLedger(conversationId);

        // If we have a save point, use it as the starting state
        if (lastSavePoint) {
          newLedger.tier3SavePoint = lastSavePoint;
          newLedger.activeFacts = lastSavePoint.verifiedFacts;
          newLedger.topicIndex = lastSavePoint.topicSnapshot;
          newLedger.messageCount = lastSavePoint.messageIndexCutoff;
          newLedger.tier1Summary = `[Restored from save point at ${new Date(lastSavePoint.timestamp).toISOString()}]`;
          newLedger.tier2Summary = lastSavePoint.summary.slice(0, 500) + '...';
          console.log(
            `[ThreadGuardian] Emergency reset for ${conversationId}: Restored from save point ` +
              `(${lastSavePoint.verifiedFacts.length} facts, message cutoff: ${lastSavePoint.messageIndexCutoff})`
          );
        } else {
          console.log(`[ThreadGuardian] Emergency reset for ${conversationId}: No save point, starting fresh`);
        }

        set({
          ledgers: {
            ...ledgers,
            [conversationId]: newLedger,
          },
        });
      },
    }),
    {
      name: 'thread-guardian',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated = true;
        }
      },
      // Don't persist running status - always start idle
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        enabled: state.enabled,
        scope: state.scope,
        tier1Config: { ...state.tier1Config, status: 'idle', lastError: undefined },
        tier2Config: { ...state.tier2Config, status: 'idle', lastError: undefined },
        tier3Config: { ...state.tier3Config, status: 'idle', lastError: undefined },
        ledgers: state.ledgers,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

/** Get the active conversation's ledger */
export const useActiveLedger = () => {
  const { activeConversationId, ledgers } = useThreadGuardianStore();
  if (!activeConversationId) return null;
  return ledgers[activeConversationId] || null;
};

/** Check if guardian is running for active conversation */
export const useIsGuardianActive = () => {
  const { enabled, activeConversationId, scope, tier1Config, tier2Config, tier3Config } =
    useThreadGuardianStore();

  if (!enabled || !activeConversationId) return false;

  const perConv = scope.perConversation[activeConversationId];
  if (perConv === false) return false;

  // At least one tier should not be in error state
  return (
    tier1Config.status !== 'error' ||
    tier2Config.status !== 'error' ||
    tier3Config.status !== 'error'
  );
};

/** Get stats for the active conversation */
export const useActiveStats = () => {
  const { activeConversationId, getStats } = useThreadGuardianStore();
  if (!activeConversationId) {
    return {
      factCount: 0,
      contradictionCount: 0,
      hallucinationCount: 0,
      driftCount: 0,
      escalationCount: 0,
      hasSavePoint: false,
      lastTier1Run: null,
      lastTier2Run: null,
      lastTier3Run: null,
    };
  }
  return getStats(activeConversationId);
};
