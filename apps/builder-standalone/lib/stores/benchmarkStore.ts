/**
 * Forge Trials — Zustand store for benchmark UI state
 * Supports both local (Ollama) and cloud model trials.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RoundResult,
  ModelScorecard,
  BenchmarkEvent,
  BenchmarkRun,
  HybridChainResult,
  HybridEvent,
  HybridChain,
} from "@sarge/benchmark";
import { syncTrialResult, syncBillingEntry, syncHybridRun } from "@sarge/core";
import type { TrialResultRow, BillingRow } from "@sarge/core";

/** Fire-and-forget Supabase sync for a completed round */
function supabaseSyncRound(result: RoundResult, runType: "local" | "cloud", provider: string, runSessionId: string) {
  const row: TrialResultRow = {
    model_id: result.modelId,
    model_name: result.modelId,
    provider,
    run_type: runType,
    round_number: parseInt(result.scenarioId.replace(/\D/g, "")) || 0,
    scenario: result.scenarioId,
    score: result.score.total,
    grade: result.score.tier,
    status: result.timedOut ? "timeout" : result.error ? "failed" : result.score.total >= 70 ? "pass" : "partial",
    tokens_in: result.tokensIn ?? 0,
    tokens_out: result.tokensOut ?? 0,
    cost_usd: result.cost ?? 0,
    time_seconds: parseFloat((result.timeMs / 1000).toFixed(2)),
    breakdown: result.score as unknown as Record<string, unknown>,
    run_session_id: runSessionId,
  };
  syncTrialResult(row).catch(() => {}); // non-blocking

  // Also log billing if there's a cost
  if (result.cost && result.cost > 0) {
    const billing: BillingRow = {
      provider,
      model_id: result.modelId,
      tokens_in: result.tokensIn ?? 0,
      tokens_out: result.tokensOut ?? 0,
      cost_usd: result.cost,
      run_type: "trial",
      run_ref_id: runSessionId,
    };
    syncBillingEntry(billing).catch(() => {});
  }
}

export type TrialsTab = "local" | "cloud" | "hybrid";

interface BenchmarkState {
  // Tab toggle
  activeTab: TrialsTab;
  setActiveTab: (tab: TrialsTab) => void;

  // ── Local Run state ──
  running: boolean;
  currentModel: string | null;
  currentRound: string | null;
  abortController: AbortController | null;
  currentRunId: string | null;
  results: RoundResult[];
  scorecards: ModelScorecard[];
  events: BenchmarkEvent[];
  pastRuns: BenchmarkRun[];
  selectedCell: { modelId: string; scenarioId: string } | null;
  selectedModels: string[];

  // ── Cloud Run state (separate from local) ──
  cloudRunning: boolean;
  cloudCurrentModel: string | null;
  cloudCurrentRound: string | null;
  cloudAbortController: AbortController | null;
  cloudCurrentRunId: string | null;
  cloudResults: RoundResult[];
  cloudScorecards: ModelScorecard[];
  cloudEvents: BenchmarkEvent[];
  cloudPastRuns: BenchmarkRun[];
  cloudSelectedCell: { modelId: string; scenarioId: string } | null;
  cloudSelectedModels: { id: string; provider: string; name: string }[];
  cloudTotalCost: number;
  cloudWarmupHtml: string;

  // ── Local Actions ──
  startRun: (runId: string, models: string[]) => void;
  stopRun: () => void;
  addResult: (result: RoundResult) => void;
  addScorecard: (scorecard: ModelScorecard) => void;
  addEvent: (event: BenchmarkEvent) => void;
  setCurrentModel: (modelId: string | null) => void;
  setCurrentRound: (scenarioId: string | null) => void;
  setSelectedCell: (cell: { modelId: string; scenarioId: string } | null) => void;
  setSelectedModels: (models: string[]) => void;
  completeRun: (run: BenchmarkRun) => void;
  loadPastRuns: (runs: BenchmarkRun[]) => void;
  setAbortController: (ctrl: AbortController | null) => void;
  reset: () => void;

  // ── Cloud Actions ──
  cloudStartRun: (runId: string, models: { id: string; provider: string; name: string }[]) => void;
  cloudStopRun: () => void;
  cloudAddResult: (result: RoundResult) => void;
  cloudAddScorecard: (scorecard: ModelScorecard) => void;
  cloudAddEvent: (event: BenchmarkEvent) => void;
  cloudSetCurrentModel: (modelId: string | null) => void;
  cloudSetCurrentRound: (scenarioId: string | null) => void;
  cloudSetSelectedCell: (cell: { modelId: string; scenarioId: string } | null) => void;
  cloudSetSelectedModels: (models: { id: string; provider: string; name: string }[]) => void;
  cloudCompleteRun: (run: BenchmarkRun) => void;
  cloudSetAbortController: (ctrl: AbortController | null) => void;
  cloudSetTotalCost: (cost: number) => void;
  cloudSetWarmupHtml: (html: string) => void;
  /** Batch-process a single NDJSON event — ONE state update instead of 6+ */
  cloudProcessEvent: (event: BenchmarkEvent) => void;
  cloudReset: () => void;

  // ── Parallel toggle ──
  cloudParallel: boolean;
  setCloudParallel: (parallel: boolean) => void;

  // ── Hybrid state ──
  hybridRunning: boolean;
  hybridMode: "recommended" | "custom";
  hybridChains: HybridChain[];
  hybridResults: HybridChainResult[];
  hybridPastRuns: HybridChainResult[];
  hybridEvents: HybridEvent[];
  hybridAbortController: AbortController | null;
  hybridTotalCost: number;
  hybridSelectedScenario: string;
  hybridCustomPrompt: string;

  // ── Hybrid Actions ──
  setHybridMode: (mode: "recommended" | "custom") => void;
  setHybridChains: (chains: HybridChain[]) => void;
  setHybridSelectedScenario: (id: string) => void;
  setHybridCustomPrompt: (prompt: string) => void;
  hybridStartRun: () => void;
  hybridStopRun: () => void;
  hybridAddResult: (result: HybridChainResult) => void;
  hybridAddEvent: (event: HybridEvent) => void;
  hybridSetAbortController: (ctrl: AbortController | null) => void;
  hybridSetTotalCost: (cost: number) => void;
  hybridSaveRun: () => void;
  hybridClearPastRuns: () => void;
  hybridReset: () => void;

  clearAll: () => void;
}

const LOCAL_INITIAL = {
  running: false,
  currentModel: null as string | null,
  currentRound: null as string | null,
  abortController: null as AbortController | null,
  currentRunId: null as string | null,
  results: [] as RoundResult[],
  scorecards: [] as ModelScorecard[],
  events: [] as BenchmarkEvent[],
  pastRuns: [] as BenchmarkRun[],
  selectedCell: null as { modelId: string; scenarioId: string } | null,
  selectedModels: [] as string[],
};

const CLOUD_INITIAL = {
  cloudRunning: false,
  cloudCurrentModel: null as string | null,
  cloudCurrentRound: null as string | null,
  cloudAbortController: null as AbortController | null,
  cloudCurrentRunId: null as string | null,
  cloudResults: [] as RoundResult[],
  cloudScorecards: [] as ModelScorecard[],
  cloudEvents: [] as BenchmarkEvent[],
  cloudPastRuns: [] as BenchmarkRun[],
  cloudSelectedCell: null as { modelId: string; scenarioId: string } | null,
  cloudSelectedModels: [] as { id: string; provider: string; name: string }[],
  cloudTotalCost: 0,
  cloudWarmupHtml: '',
  cloudParallel: false,
};

const HYBRID_INITIAL = {
  hybridRunning: false,
  hybridMode: "recommended" as "recommended" | "custom",
  hybridChains: [] as HybridChain[],
  hybridResults: [] as HybridChainResult[],
  hybridPastRuns: [] as HybridChainResult[],
  hybridEvents: [] as HybridEvent[],
  hybridAbortController: null as AbortController | null,
  hybridTotalCost: 0,
  hybridSelectedScenario: "cloud-r1-restaurant",
  hybridCustomPrompt: "",
};

export const useBenchmarkStore = create<BenchmarkState>()(
  persist(
    (set, get) => ({
      activeTab: "local" as TrialsTab,
      ...LOCAL_INITIAL,
      ...CLOUD_INITIAL,
      ...HYBRID_INITIAL,

      setActiveTab: (tab) => set({ activeTab: tab }),

      // ── Local Actions ──
      startRun: (runId, models) =>
        set({
          running: true,
          currentRunId: runId,
          selectedModels: models,
          results: [],
          scorecards: [],
          events: [],
          currentModel: null,
          currentRound: null,
          selectedCell: null,
        }),

      stopRun: () =>
        set((s) => {
          s.abortController?.abort();
          return { running: false, abortController: null };
        }),

      addResult: (result) => {
        supabaseSyncRound(result, "local", "ollama", get().currentRunId || "unknown");
        return set((s) => ({
          results: [...s.results, result],
          selectedCell: { modelId: result.modelId, scenarioId: result.scenarioId },
        }));
      },

      addScorecard: (scorecard) =>
        set((s) => ({ scorecards: [...s.scorecards, scorecard] })),

      addEvent: (event) =>
        set((s) => ({ events: [...s.events.slice(-200), event] })),

      setCurrentModel: (modelId) => set({ currentModel: modelId }),
      setCurrentRound: (scenarioId) => set({ currentRound: scenarioId }),
      setSelectedCell: (cell) => set({ selectedCell: cell }),
      setSelectedModels: (models) => set({ selectedModels: models }),
      setAbortController: (ctrl) => set({ abortController: ctrl }),

      completeRun: (run) =>
        set((s) => ({
          running: false,
          abortController: null,
          pastRuns: [run, ...s.pastRuns].slice(0, 20),
        })),

      loadPastRuns: (runs) => set({ pastRuns: runs }),

      reset: () => set(LOCAL_INITIAL),

      // ── Cloud Actions ──
      cloudStartRun: (runId, models) =>
        set({
          cloudRunning: true,
          cloudCurrentRunId: runId,
          cloudSelectedModels: models,
          cloudResults: [],
          cloudScorecards: [],
          cloudEvents: [],
          cloudCurrentModel: null,
          cloudCurrentRound: null,
          cloudSelectedCell: null,
          cloudTotalCost: 0,
        }),

      cloudStopRun: () =>
        set((s) => {
          s.cloudAbortController?.abort();
          return { cloudRunning: false, cloudAbortController: null };
        }),

      cloudAddResult: (result) => {
        // Determine provider from cloudSelectedModels
        const cloudModels = get().cloudSelectedModels;
        const match = cloudModels.find((m) => m.id === result.modelId);
        supabaseSyncRound(result, "cloud", match?.provider || "unknown", get().cloudCurrentRunId || "unknown");
        return set((s) => ({
          cloudResults: [...s.cloudResults, result],
          cloudSelectedCell: { modelId: result.modelId, scenarioId: result.scenarioId },
        }));
      },

      cloudAddScorecard: (scorecard) =>
        set((s) => ({ cloudScorecards: [...s.cloudScorecards, scorecard] })),

      cloudAddEvent: (event) =>
        set((s) => ({ cloudEvents: [...s.cloudEvents.slice(-200), event] })),

      cloudSetCurrentModel: (modelId) => set({ cloudCurrentModel: modelId }),
      cloudSetCurrentRound: (scenarioId) => set({ cloudCurrentRound: scenarioId }),
      cloudSetSelectedCell: (cell) => set({ cloudSelectedCell: cell }),
      cloudSetSelectedModels: (models) => set({ cloudSelectedModels: models }),
      cloudSetAbortController: (ctrl) => set({ cloudAbortController: ctrl }),
      cloudSetTotalCost: (cost) => set({ cloudTotalCost: cost }),
      cloudSetWarmupHtml: (html) => set({ cloudWarmupHtml: html }),

      cloudProcessEvent: (event) =>
        set((s) => {
          const patch: Partial<typeof s> = {
            cloudEvents: [...s.cloudEvents.slice(-200), event],
          };
          if (event.modelId) patch.cloudCurrentModel = event.modelId;
          if (event.scenarioId) patch.cloudCurrentRound = event.scenarioId;
          if (event.warmupHtml) patch.cloudWarmupHtml = event.warmupHtml;
          if (event.scorecard) patch.cloudScorecards = [...s.cloudScorecards, event.scorecard];
          if (event.result) {
            const cloudModels = s.cloudSelectedModels;
            const match = cloudModels.find((m) => m.id === event.result!.modelId);
            supabaseSyncRound(event.result, "cloud", match?.provider || "unknown", s.cloudCurrentRunId || "unknown");
            patch.cloudResults = [...s.cloudResults, event.result];
            patch.cloudSelectedCell = { modelId: event.result.modelId, scenarioId: event.result.scenarioId };
          }
          const costMatch = event.message?.match(/\$(\d+\.\d+)/);
          if (costMatch) patch.cloudTotalCost = parseFloat(costMatch[1]);
          return patch;
        }),

      cloudCompleteRun: (run) =>
        set((s) => ({
          cloudRunning: false,
          cloudAbortController: null,
          cloudPastRuns: [run, ...s.cloudPastRuns].slice(0, 20),
        })),

      cloudReset: () => set(CLOUD_INITIAL),

      // ── Parallel toggle ──
      setCloudParallel: (parallel) => set({ cloudParallel: parallel }),

      // ── Hybrid Actions ──
      setHybridMode: (mode) => set({ hybridMode: mode }),
      setHybridChains: (chains) => set({ hybridChains: chains }),
      setHybridSelectedScenario: (id) => set({ hybridSelectedScenario: id }),
      setHybridCustomPrompt: (prompt) => set({ hybridCustomPrompt: prompt }),
      hybridStartRun: () =>
        set({
          hybridRunning: true,
          hybridResults: [],
          hybridEvents: [],
          hybridTotalCost: 0,
        }),
      hybridStopRun: () =>
        set((s) => {
          s.hybridAbortController?.abort();
          return { hybridRunning: false, hybridAbortController: null };
        }),
      hybridAddResult: (result) =>
        set((s) => ({ hybridResults: [...s.hybridResults, result] })),
      hybridAddEvent: (event) =>
        set((s) => ({ hybridEvents: [...s.hybridEvents.slice(-200), event] })),
      hybridSetAbortController: (ctrl) => set({ hybridAbortController: ctrl }),
      hybridSetTotalCost: (cost) => set({ hybridTotalCost: cost }),
      hybridSaveRun: () => {
        const results = get().hybridResults;
        const scenario = get().hybridSelectedScenario;
        const customPrompt = get().hybridCustomPrompt;
        // Fire-and-forget Supabase sync
        for (const result of results) {
          syncHybridRun({
            scenario,
            custom_prompt: customPrompt || undefined,
            chain: { name: result.chainName, steps: result.steps.map(s => ({ modelId: s.modelId, provider: s.provider, role: s.role })) },
            step_results: result.steps.map(s => ({ stepIndex: s.stepIndex, modelId: s.modelId, provider: s.provider, role: s.role, score: s.score.total, timeMs: s.timeMs, cost: s.cost })),
            final_score: result.finalScore?.total ?? 0,
            final_grade: result.finalScore?.tier ?? "fail",
            total_cost_usd: result.totalCost,
            total_time_seconds: parseFloat((result.totalTimeMs / 1000).toFixed(2)),
            status: "success",
          }).catch(() => {});
        }
        return set((s) => ({
          hybridPastRuns: [...s.hybridResults, ...s.hybridPastRuns].slice(0, 50),
          hybridRunning: false,
          hybridAbortController: null,
        }));
      },
      hybridClearPastRuns: () => set({ hybridPastRuns: [] }),
      hybridReset: () =>
        set((s) => ({
          ...HYBRID_INITIAL,
          // Preserve saved runs across resets
          hybridPastRuns: s.hybridPastRuns,
        })),

      clearAll: () => set({ ...LOCAL_INITIAL, ...CLOUD_INITIAL, ...HYBRID_INITIAL, activeTab: "local" as TrialsTab }),
    }),
    {
      name: "forge-trials-store",
      // Safe localStorage wrapper — catches QuotaExceededError instead of crashing
      storage: {
        getItem: (name: string) => {
          try {
            const raw = localStorage.getItem(name);
            return raw ? JSON.parse(raw) : null;
          } catch (e) {
            console.warn("[BenchmarkStore] Failed to read localStorage:", e);
            return null;
          }
        },
        setItem: (name: string, value: unknown) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            console.warn("[BenchmarkStore] localStorage write failed (likely QuotaExceeded), pruning...", e);
            try {
              // Emergency prune: delete the key and retry with current data
              localStorage.removeItem(name);
              localStorage.setItem(name, JSON.stringify(value));
            } catch (e2) {
              console.error("[BenchmarkStore] localStorage write failed even after prune:", e2);
            }
          }
        },
        removeItem: (name: string) => {
          try { localStorage.removeItem(name); } catch {}
        },
      },
      partialize: (s) => {
        // Strip rawResponse + extractedCode from persisted results to avoid
        // blowing localStorage quota (each is 5-20KB of HTML × 8 rounds × N models)
        const stripHeavy = (r: RoundResult): RoundResult => ({
          ...r,
          rawResponse: "",
          extractedCode: "",
        });
        // Strip heavy fields from hybrid step results (content + extractedCode per step)
        const stripHybridHeavy = (hr: HybridChainResult): HybridChainResult => ({
          ...hr,
          steps: hr.steps.map(step => ({
            ...step,
            content: "",        // full streaming response — 5-30KB per step
            extractedCode: "",  // full HTML — 5-20KB per step
          })),
        });
        return {
          activeTab: s.activeTab,
          pastRuns: s.pastRuns,
          selectedModels: s.selectedModels,
          currentRunId: s.currentRunId,
          results: s.results.map(stripHeavy),
          scorecards: s.scorecards,
          selectedCell: s.selectedCell,
          cloudPastRuns: s.cloudPastRuns,
          cloudSelectedModels: s.cloudSelectedModels,
          cloudCurrentRunId: s.cloudCurrentRunId,
          cloudResults: s.cloudResults.map(stripHeavy),
          cloudScorecards: s.cloudScorecards,
          cloudSelectedCell: s.cloudSelectedCell,
          cloudParallel: s.cloudParallel,
          hybridMode: s.hybridMode,
          hybridChains: s.hybridChains,
          hybridResults: s.hybridResults.map(stripHybridHeavy),
          hybridPastRuns: s.hybridPastRuns.map(stripHybridHeavy),
          hybridSelectedScenario: s.hybridSelectedScenario,
          hybridCustomPrompt: s.hybridCustomPrompt,
        };
      },
    }
  )
);
