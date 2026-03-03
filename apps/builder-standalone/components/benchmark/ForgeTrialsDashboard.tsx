"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Flame, X, Play, Square, Download, RotateCcw } from "lucide-react";
import { useBenchmarkStore } from "@/lib/stores/benchmarkStore";
import {
  BUILDER_SCENARIOS,
  type BenchmarkEvent,
  type BenchmarkConfig,
  type RoundResult,
} from "@sarge/benchmark";
import { ForgeTrialsMatrix } from "./ForgeTrialsMatrix";
import { ForgeTrialsProgress } from "./ForgeTrialsProgress";
import { ForgeTrialsControls } from "./ForgeTrialsControls";
import { ForgeTrialsRoundDetail } from "./ForgeTrialsRoundDetail";

// All 15 default builder models
const DEFAULT_MODELS = [
  "qwen2.5-coder:7b",
  "deepseek-coder:6.7b",
  "codellama:7b",
  "starcoder2:7b",
  "phi3:medium",
  "phi4-mini",
  "qwen3:8b",
  "qwen2:7b",
  "deepseek-r1:7b",
  "deepseek-r1:8b",
  "cogito:8b",
  "llama3.1:8b",
  "gemma2:9b",
  "mistral:7b",
  "gemma3:4b",
];

interface Props {
  onClose: () => void;
}

export default function ForgeTrialsDashboard({ onClose }: Props) {
  const {
    running,
    results,
    scorecards,
    events,
    selectedCell,
    selectedModels,
    currentModel,
    currentRound,
    setSelectedModels,
    startRun,
    stopRun,
    addResult,
    addScorecard,
    addEvent,
    setCurrentModel,
    setCurrentRound,
    setSelectedCell,
    setAbortController,
    completeRun,
  } = useBenchmarkStore();

  const [models, setModels] = useState<string[]>(
    selectedModels.length > 0 ? selectedModels : DEFAULT_MODELS
  );
  const eventLogRef = useRef<HTMLDivElement>(null);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  // Start benchmark run
  const handleStart = useCallback(async () => {
    const runId = `forge-trials-${Date.now()}`;
    const ctrl = new AbortController();
    setAbortController(ctrl);
    startRun(runId, models);

    try {
      const config: BenchmarkConfig = {
        models,
        ollamaUrl: "http://127.0.0.1:11434",
        numCtx: 32768,
        numPredict: 4096,
        keepAlive: "1h",
        savePath: "",
      };

      const res = await fetch("/api/benchmark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        addEvent({
          type: "run:error",
          message: `API error: ${res.status}`,
          timestamp: Date.now(),
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event: BenchmarkEvent = JSON.parse(line);
            addEvent(event);

            if (event.modelId) setCurrentModel(event.modelId);
            if (event.scenarioId) setCurrentRound(event.scenarioId);
            if (event.result) addResult(event.result);
            if (event.scorecard) addScorecard(event.scorecard);

            if (
              event.type === "run:complete" ||
              event.type === "run:stopped"
            ) {
              completeRun({
                id: runId,
                startedAt: Date.now(),
                completedAt: Date.now(),
                models,
                scenarios: BUILDER_SCENARIOS.map((s) => s.id),
                results: useBenchmarkStore.getState().results,
                scorecards: useBenchmarkStore.getState().scorecards,
                status:
                  event.type === "run:complete" ? "completed" : "stopped",
              });
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        addEvent({
          type: "run:stopped",
          message: "Forge Trials stopped by user.",
          timestamp: Date.now(),
        });
      }
    }
  }, [
    models,
    startRun,
    stopRun,
    addResult,
    addScorecard,
    addEvent,
    setCurrentModel,
    setCurrentRound,
    setAbortController,
    completeRun,
  ]);

  const handleStop = useCallback(() => {
    stopRun();
  }, [stopRun]);

  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      results,
      scorecards,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-trials-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, scorecards]);

  // Find the selected result for detail panel
  const selectedResult: RoundResult | undefined = selectedCell
    ? results.find(
        (r) =>
          r.modelId === selectedCell.modelId &&
          r.scenarioId === selectedCell.scenarioId
      )
    : undefined;

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ── Header Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#FF6700]/20 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
        <div className="flex-1" />
        <div className="flex items-center gap-5">
          <Flame className="w-10 h-10 text-[#FF6700] drop-shadow-[0_0_14px_rgba(255,103,0,0.7)]" />
          <div className="text-center">
            <h1 className="text-5xl font-[900] tracking-[4px] bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,103,0,0.4)]">
              FORGE TRIALS
            </h1>
            <p className="text-base font-bold text-zinc-400 tracking-widest mt-1">
              Model Capability Scorecard
            </p>
          </div>
          <Flame className="w-10 h-10 text-[#FF6700] drop-shadow-[0_0_14px_rgba(255,103,0,0.7)]" />
        </div>

        <div className="flex-1 flex items-center justify-end gap-3">
          {!running ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6700] hover:bg-[#FF6700]/80 text-white font-bold rounded-lg transition-all shadow-[0_0_14px_rgba(255,103,0,0.3)] hover:shadow-[0_0_20px_rgba(255,103,0,0.5)]"
            >
              <Play className="w-4 h-4" />
              Start Trials
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={results.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all"
            title="Back to Builder"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Controls + Matrix (60%) */}
        <div className="flex flex-col flex-[6] border-r border-zinc-800 overflow-hidden">
          {/* Model selection controls */}
          <ForgeTrialsControls
            models={models}
            setModels={setModels}
            defaultModels={DEFAULT_MODELS}
            running={running}
          />

          {/* Scorecard Matrix */}
          <div className="flex-1 overflow-auto p-4">
            <ForgeTrialsMatrix
              results={results}
              scorecards={scorecards}
              models={models}
              scenarios={BUILDER_SCENARIOS}
              selectedCell={selectedCell}
              onSelectCell={setSelectedCell}
              currentModel={currentModel}
              currentRound={currentRound}
              running={running}
            />
          </div>
        </div>

        {/* Right: Detail Panel (40%) */}
        <div className="flex flex-col flex-[4] overflow-hidden">
          <ForgeTrialsRoundDetail
            result={selectedResult}
            scenario={
              selectedCell
                ? BUILDER_SCENARIOS.find(
                    (s) => s.id === selectedCell.scenarioId
                  )
                : undefined
            }
          />
        </div>
      </div>

      {/* ── Progress Footer ───────────────────────────────────────── */}
      <ForgeTrialsProgress
        events={events}
        running={running}
        currentModel={currentModel}
        currentRound={currentRound}
        results={results}
        totalModels={models.length}
        totalRounds={BUILDER_SCENARIOS.length}
        runsPerScenario={3}
        eventLogRef={eventLogRef}
      />
    </div>
  );
}
