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

  // ── Hybrid Actions ──
  setHybridMode: (mode: "recommended" | "custom") => void;
  setHybridChains: (chains: HybridChain[]) => void;
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
};

export const useBenchmarkStore = create<BenchmarkState>()(
  persist(
    (set) => ({
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

      addResult: (result) =>
        set((s) => ({
          results: [...s.results, result],
          selectedCell: { modelId: result.modelId, scenarioId: result.scenarioId },
        })),

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

      cloudAddResult: (result) =>
        set((s) => ({
          cloudResults: [...s.cloudResults, result],
          cloudSelectedCell: { modelId: result.modelId, scenarioId: result.scenarioId },
        })),

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
      hybridSaveRun: () =>
        set((s) => ({
          hybridPastRuns: [...s.hybridResults, ...s.hybridPastRuns].slice(0, 50),
        })),
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
      partialize: (s) => {
        // Strip rawResponse + extractedCode from persisted results to avoid
        // blowing localStorage quota (each is 5-20KB of HTML × 8 rounds × N models)
        const stripHeavy = (r: RoundResult): RoundResult => ({
          ...r,
          rawResponse: "",
          extractedCode: "",
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
          hybridResults: s.hybridResults,
          hybridPastRuns: s.hybridPastRuns,
        };
      },
    }
  )
);
