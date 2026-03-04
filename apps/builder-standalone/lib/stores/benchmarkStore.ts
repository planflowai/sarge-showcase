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
} from "@sarge/benchmark";

export type TrialsTab = "local" | "cloud";

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
};

export const useBenchmarkStore = create<BenchmarkState>()(
  persist(
    (set) => ({
      activeTab: "local" as TrialsTab,
      ...LOCAL_INITIAL,
      ...CLOUD_INITIAL,

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
    }),
    {
      name: "forge-trials-store",
      partialize: (s) => ({
        activeTab: s.activeTab,
        pastRuns: s.pastRuns,
        selectedModels: s.selectedModels,
        currentRunId: s.currentRunId,
        results: s.results,
        scorecards: s.scorecards,
        selectedCell: s.selectedCell,
        cloudPastRuns: s.cloudPastRuns,
        cloudSelectedModels: s.cloudSelectedModels,
        cloudCurrentRunId: s.cloudCurrentRunId,
        cloudResults: s.cloudResults,
        cloudScorecards: s.cloudScorecards,
        cloudSelectedCell: s.cloudSelectedCell,
      }),
    }
  )
);
