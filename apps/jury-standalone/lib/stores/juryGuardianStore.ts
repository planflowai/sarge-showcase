"use client";

import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import type {
  SharedContextLedger,
  TierConfig,
  BehaviorConfig,
  ScopeConfig,
  ActiveFact,
  Contradiction,
  EchoAlert,
  DriftAlert,
  SavePoint,
  JuryToastData,
  KilledResponse,
} from "@/lib/types/juryGuardian";

// Array size limits to prevent localStorage bloat
const MAX_ACTIVE_FACTS = 50;
const MAX_RETIRED_FACTS = 20;
const MAX_CONTRADICTIONS = 30;
const MAX_ECHO_ALERTS = 20;
const MAX_DRIFT_ALERTS = 20;
const MAX_TIER_LOG = 50;
const MAX_SAVE_POINTS = 10;
const MAX_KILLED_RESPONSES = 50;

// Helper to trim array to max size (keeps newest)
function trimArray<T>(arr: T[], maxSize: number): T[] {
  if (arr.length <= maxSize) return arr;
  return arr.slice(-maxSize);
}

// Custom storage with quota error handling
const safeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.warn("[JuryGuardian] Error reading from localStorage:", e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      // Quota exceeded - clear the old entry and try again with minimal data
      console.warn("[JuryGuardian] Storage quota exceeded, clearing old data");
      try {
        localStorage.removeItem(name);
        localStorage.setItem(name, value);
      } catch (e2) {
        console.error("[JuryGuardian] Failed to save to localStorage:", e2);
      }
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn("[JuryGuardian] Error removing from localStorage:", e);
    }
  },
};

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create empty ledger
function createEmptyLedger(sessionId: string): SharedContextLedger {
  return {
    sessionId,
    createdAt: new Date(),
    lastUpdated: new Date(),
    activeFacts: [],
    retiredFacts: [],
    contradictions: [],
    echoAlerts: [],
    driftAlerts: [],
    tierLog: [],
    savePoints: [],
    modelHealth: {},
    killedResponses: [],
  };
}

interface JuryGuardianState {
  // Master toggle
  enabled: boolean;

  // Scope - which modes the jury watches
  scope: ScopeConfig;

  // Tier configurations (Tier 1 interval is 180 seconds per spec adjustment)
  tier1: TierConfig;
  tier2: TierConfig;
  tier3: TierConfig & { intervalHours: number };

  // Behavior settings
  behavior: BehaviorConfig;

  // Active ledgers per session
  ledgers: Record<string, SharedContextLedger>;

  // Toast queue
  toasts: JuryToastData[];

  // Panel visibility
  panelOpen: boolean;

  // Preference - prefer cost-effective models
  preferCost: boolean;

  // Hydration
  hydrated: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  updateScope: (scope: Partial<ScopeConfig>) => void;
  updateTier1Config: (config: Partial<TierConfig>) => void;
  updateTier2Config: (config: Partial<TierConfig>) => void;
  updateTier3Config: (config: Partial<TierConfig & { intervalHours: number }>) => void;
  updateBehavior: (config: Partial<BehaviorConfig>) => void;
  setInterventionEnabled: (enabled: boolean) => void;

  // Ledger actions
  getLedger: (sessionId: string) => SharedContextLedger;
  updateLedger: (sessionId: string, updates: Partial<SharedContextLedger>) => void;
  addFact: (sessionId: string, fact: Omit<ActiveFact, "id">) => void;
  retireFact: (sessionId: string, factId: string, reason: string) => void;
  addContradiction: (sessionId: string, contradiction: Omit<Contradiction, "id">) => void;
  resolveContradiction: (sessionId: string, contradictionId: string, resolution: string) => void;
  addEchoAlert: (sessionId: string, alert: Omit<EchoAlert, "id">) => void;
  dismissEchoAlert: (sessionId: string, alertId: string) => void;
  addDriftAlert: (sessionId: string, alert: Omit<DriftAlert, "id">) => void;
  addStrike: (sessionId: string, model: string, pane: number, reason: string) => void;
  createSavePoint: (sessionId: string, savePoint: Omit<SavePoint, "id">) => void;
  logTierRun: (
    sessionId: string,
    tier: 1 | 2 | 3,
    model: string,
    findingsCount: number,
    escalated: boolean,
    duration: number
  ) => void;
  logKill: (
    sessionId: string,
    data: { content: string; reason: string; model: string; type: "echo" | "contradiction" }
  ) => void;
  resetLedger: (sessionId: string) => void;

  // Toast actions
  addToast: (toast: Omit<JuryToastData, "id" | "timestamp">) => void;
  dismissToast: (toastId: string) => void;
  dismissAllToasts: () => void;

  // Panel
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  // Hydration
  hydrate: () => void;
}

export const useJuryGuardianStore = create<JuryGuardianState>()(
  persist(
    (set, get) => ({
      // Default state
      enabled: false,

      scope: {
        parallelChat: true,
        singleChat: true,
        architect: true,
        builder: true,
        debate: false, // NEVER
        test: false, // NEVER
        tribunal: false, // NEVER
        batch: false, // NEVER
      },

      // Tier 1: Fast skim every 3 minutes (180 seconds - adjusted per spec)
      tier1: {
        model: "phi4-mini",
        intervalSeconds: 180, // Changed from 90 to 180 per Grok's feedback
        enabled: true,
      },

      // Tier 2: Review every 6 minutes
      tier2: {
        model: "mistral:7b",
        intervalSeconds: 360,
        enabled: true,
      },

      // Tier 3: Deep audit every 4 hours
      tier3: {
        model: "claude-sonnet-4-20250514",
        intervalSeconds: 14400, // 4 hours in seconds
        intervalHours: 4,
        enabled: true,
        provider: "anthropic",
      },

      behavior: {
        toastOnly: true,
        autoSwapEnabled: false,
        autoInjectEnabled: false,
        interventionEnabled: false,
        echoThreshold: 0.7,
        strikeLimit: 3,
      },

      ledgers: {},
      toasts: [],
      panelOpen: false,
      preferCost: true,
      hydrated: false,

      // Actions
      setEnabled: (enabled) => set({ enabled }),

      updateScope: (scopeUpdate) =>
        set((state) => ({
          scope: { ...state.scope, ...scopeUpdate },
        })),

      updateTier1Config: (config) =>
        set((state) => ({
          tier1: { ...state.tier1, ...config },
        })),

      updateTier2Config: (config) =>
        set((state) => ({
          tier2: { ...state.tier2, ...config },
        })),

      updateTier3Config: (config) =>
        set((state) => ({
          tier3: { ...state.tier3, ...config },
        })),

      updateBehavior: (config) =>
        set((state) => ({
          behavior: { ...state.behavior, ...config },
        })),

      setInterventionEnabled: (enabled) =>
        set((state) => ({
          behavior: { ...state.behavior, interventionEnabled: enabled },
        })),

      // Ledger actions
      getLedger: (sessionId) => {
        const { ledgers } = get();
        if (!ledgers[sessionId]) {
          const newLedger = createEmptyLedger(sessionId);
          set({ ledgers: { ...ledgers, [sessionId]: newLedger } });
          return newLedger;
        }
        return ledgers[sessionId];
      },

      updateLedger: (sessionId, updates) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                ...updates,
                lastUpdated: new Date(),
              },
            },
          };
        }),

      addFact: (sessionId, fact) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          const newFact: ActiveFact = { ...fact, id: generateId() };
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                activeFacts: trimArray([...ledger.activeFacts, newFact], MAX_ACTIVE_FACTS),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      retireFact: (sessionId, factId, reason) =>
        set((state) => {
          const ledger = state.ledgers[sessionId];
          if (!ledger) return state;

          const fact = ledger.activeFacts.find((f) => f.id === factId);
          if (!fact) return state;

          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                activeFacts: ledger.activeFacts.filter((f) => f.id !== factId),
                retiredFacts: trimArray(
                  [...ledger.retiredFacts, { id: factId, fact: fact.fact, reason, retiredAt: new Date() }],
                  MAX_RETIRED_FACTS
                ),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      addContradiction: (sessionId, contradiction) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          const newContradiction: Contradiction = { ...contradiction, id: generateId() };
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                contradictions: trimArray([...ledger.contradictions, newContradiction], MAX_CONTRADICTIONS),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      resolveContradiction: (sessionId, contradictionId, resolution) =>
        set((state) => {
          const ledger = state.ledgers[sessionId];
          if (!ledger) return state;

          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                contradictions: ledger.contradictions.map((c) =>
                  c.id === contradictionId ? { ...c, resolved: true, resolution } : c
                ),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      addEchoAlert: (sessionId, alert) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          const newAlert: EchoAlert = { ...alert, id: generateId() };
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                echoAlerts: trimArray([...ledger.echoAlerts, newAlert], MAX_ECHO_ALERTS),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      dismissEchoAlert: (sessionId, alertId) =>
        set((state) => {
          const ledger = state.ledgers[sessionId];
          if (!ledger) return state;

          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                echoAlerts: ledger.echoAlerts.map((a) =>
                  a.id === alertId ? { ...a, dismissed: true } : a
                ),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      addDriftAlert: (sessionId, alert) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          const newAlert: DriftAlert = { ...alert, id: generateId() };
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                driftAlerts: trimArray([...ledger.driftAlerts, newAlert], MAX_DRIFT_ALERTS),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      addStrike: (sessionId, model, pane, reason) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          const healthKey = `${model}-${pane}`;
          const currentHealth = ledger.modelHealth[healthKey] || {
            model,
            pane,
            strikes: 0,
            lastFlag: null,
            flagHistory: [],
          };

          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                modelHealth: {
                  ...ledger.modelHealth,
                  [healthKey]: {
                    ...currentHealth,
                    strikes: currentHealth.strikes + 1,
                    lastFlag: new Date(),
                    flagHistory: [
                      ...currentHealth.flagHistory,
                      { reason, timestamp: new Date() },
                    ],
                  },
                },
                lastUpdated: new Date(),
              },
            },
          };
        }),

      createSavePoint: (sessionId, savePoint) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          const newSavePoint: SavePoint = { ...savePoint, id: generateId() };
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                savePoints: trimArray([...ledger.savePoints, newSavePoint], MAX_SAVE_POINTS),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      logTierRun: (sessionId, tier, model, findingsCount, escalated, duration) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                tierLog: trimArray(
                  [
                    ...ledger.tierLog,
                    {
                      tier,
                      timestamp: new Date(),
                      model,
                      findingsCount,
                      escalated,
                      duration,
                    },
                  ],
                  MAX_TIER_LOG
                ),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      logKill: (sessionId, data) =>
        set((state) => {
          const ledger = state.ledgers[sessionId] || createEmptyLedger(sessionId);
          const killedResponse: KilledResponse = {
            id: generateId(),
            timestamp: new Date(),
            model: data.model,
            content: data.content,
            reason: data.reason,
            type: data.type,
          };
          return {
            ledgers: {
              ...state.ledgers,
              [sessionId]: {
                ...ledger,
                killedResponses: trimArray([...ledger.killedResponses, killedResponse], MAX_KILLED_RESPONSES),
                lastUpdated: new Date(),
              },
            },
          };
        }),

      resetLedger: (sessionId) =>
        set((state) => ({
          ledgers: {
            ...state.ledgers,
            [sessionId]: createEmptyLedger(sessionId),
          },
        })),

      // Toast actions
      addToast: (toast) =>
        set((state) => {
          const newToast: JuryToastData = {
            ...toast,
            id: generateId(),
            timestamp: new Date(),
          };
          // Keep max 10 toasts in queue
          const toasts = [...state.toasts, newToast].slice(-10);
          return { toasts };
        }),

      dismissToast: (toastId) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== toastId),
        })),

      dismissAllToasts: () => set({ toasts: [] }),

      // Panel
      setPanelOpen: (open) => set({ panelOpen: open }),
      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

      // Hydration
      hydrate: () => set({ hydrated: true }),
    }),
    {
      name: "jury-guardian-storage",
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        scope: state.scope,
        tier1: state.tier1,
        tier2: state.tier2,
        tier3: state.tier3,
        behavior: state.behavior,
        preferCost: state.preferCost,
        // Don't persist ledgers or toasts - they're session-based
      }),
      onRehydrateStorage: () => (state) => {
        // Called when hydration is complete
        if (state) {
          state.hydrated = true;
        }
      },
    }
  )
);
