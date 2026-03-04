"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Flame, X, Play, Square, Download, Cloud, Cpu } from "lucide-react";
import { useBenchmarkStore } from "@/lib/stores/benchmarkStore";
import {
  BUILDER_SCENARIOS,
  CLOUD_SCENARIOS,
  type BenchmarkEvent,
  type BenchmarkConfig,
  type CloudBenchmarkConfig,
  type RoundResult,
} from "@sarge/benchmark";
import { ForgeTrialsMatrix } from "./ForgeTrialsMatrix";
import { ForgeTrialsProgress } from "./ForgeTrialsProgress";
import { ForgeTrialsControls } from "./ForgeTrialsControls";
import { ForgeTrialsRoundDetail } from "./ForgeTrialsRoundDetail";

// All 15 default local builder models
const DEFAULT_LOCAL_MODELS = [
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
  const store = useBenchmarkStore();
  const {
    activeTab,
    setActiveTab,
    // Local state
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
    // Cloud state
    cloudRunning,
    cloudResults,
    cloudScorecards,
    cloudEvents,
    cloudSelectedCell,
    cloudSelectedModels,
    cloudCurrentModel,
    cloudCurrentRound,
    cloudTotalCost,
    cloudStartRun,
    cloudStopRun,
    cloudAddResult,
    cloudAddScorecard,
    cloudAddEvent,
    cloudSetCurrentModel,
    cloudSetCurrentRound,
    cloudSetSelectedCell,
    cloudSetSelectedModels,
    cloudSetAbortController,
    cloudCompleteRun,
    cloudSetTotalCost,
    cloudSetWarmupHtml,
    cloudWarmupHtml,
  } = store;

  const [localModels, setLocalModels] = useState<string[]>(
    selectedModels.length > 0 ? selectedModels : DEFAULT_LOCAL_MODELS
  );
  const eventLogRef = useRef<HTMLDivElement>(null);

  // Determine which data to show based on active tab
  const isCloud = activeTab === "cloud";
  const activeRunning = isCloud ? cloudRunning : running;
  const activeResults = isCloud ? cloudResults : results;
  const activeScorecards = isCloud ? cloudScorecards : scorecards;
  const activeEvents = isCloud ? cloudEvents : events;
  const activeSelectedCell = isCloud ? cloudSelectedCell : selectedCell;
  const activeCurrentModel = isCloud ? cloudCurrentModel : currentModel;
  const activeCurrentRound = isCloud ? cloudCurrentRound : currentRound;
  const activeScenarios = isCloud ? CLOUD_SCENARIOS : BUILDER_SCENARIOS;
  const activeModels = isCloud
    ? cloudSelectedModels.map((m) => m.id)
    : localModels;

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [activeEvents]);

  // ── Local: Start benchmark run ──
  const handleLocalStart = useCallback(async () => {
    const runId = `forge-trials-${Date.now()}`;
    const ctrl = new AbortController();
    setAbortController(ctrl);
    startRun(runId, localModels);

    try {
      const config: BenchmarkConfig = {
        models: localModels,
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
        addEvent({ type: "run:error", message: `API error: ${res.status}`, timestamp: Date.now() });
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
            if (event.type === "run:complete" || event.type === "run:stopped") {
              completeRun({
                id: runId,
                startedAt: Date.now(),
                completedAt: Date.now(),
                models: localModels,
                scenarios: BUILDER_SCENARIOS.map((s) => s.id),
                results: useBenchmarkStore.getState().results,
                scorecards: useBenchmarkStore.getState().scorecards,
                status: event.type === "run:complete" ? "completed" : "stopped",
              });
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        addEvent({ type: "run:stopped", message: "Forge Trials stopped by user.", timestamp: Date.now() });
      }
    }
  }, [localModels, startRun, stopRun, addResult, addScorecard, addEvent, setCurrentModel, setCurrentRound, setAbortController, completeRun]);

  // ── Cloud: Start benchmark run ──
  const handleCloudStart = useCallback(async () => {
    if (cloudSelectedModels.length === 0) return;

    const runId = `cloud-trials-${Date.now()}`;
    const ctrl = new AbortController();
    cloudSetAbortController(ctrl);
    cloudStartRun(runId, cloudSelectedModels);

    try {
      const config: CloudBenchmarkConfig = {
        models: cloudSelectedModels,
      };

      const res = await fetch("/api/benchmark/run-cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        cloudAddEvent({ type: "run:error", message: `API error: ${res.status}`, timestamp: Date.now() });
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
            cloudAddEvent(event);
            if (event.modelId) cloudSetCurrentModel(event.modelId);
            if (event.scenarioId) cloudSetCurrentRound(event.scenarioId);
            if (event.result) cloudAddResult(event.result);
            if (event.scorecard) cloudAddScorecard(event.scorecard);
            if (event.warmupHtml) cloudSetWarmupHtml(event.warmupHtml);

            // Extract cost from message (format: "...$X.XXXX...")
            const costMatch = event.message?.match(/\$(\d+\.\d+)/);
            if (costMatch) {
              cloudSetTotalCost(parseFloat(costMatch[1]));
            }

            if (event.type === "run:complete" || event.type === "run:stopped") {
              cloudCompleteRun({
                id: runId,
                startedAt: Date.now(),
                completedAt: Date.now(),
                models: cloudSelectedModels.map((m) => m.id),
                scenarios: CLOUD_SCENARIOS.map((s) => s.id),
                results: useBenchmarkStore.getState().cloudResults,
                scorecards: useBenchmarkStore.getState().cloudScorecards,
                status: event.type === "run:complete" ? "completed" : "stopped",
              });
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        cloudAddEvent({ type: "run:stopped", message: "Cloud Trials stopped by user.", timestamp: Date.now() });
      }
    }
  }, [cloudSelectedModels, cloudStartRun, cloudStopRun, cloudAddResult, cloudAddScorecard, cloudAddEvent, cloudSetCurrentModel, cloudSetCurrentRound, cloudSetAbortController, cloudCompleteRun, cloudSetTotalCost, cloudSetWarmupHtml]);

  const handleStart = isCloud ? handleCloudStart : handleLocalStart;
  const handleStop = isCloud ? () => cloudStopRun() : () => stopRun();

  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      tab: activeTab,
      results: activeResults,
      scorecards: activeScorecards,
      ...(isCloud ? { totalCost: cloudTotalCost } : {}),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-trials-${activeTab}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTab, activeResults, activeScorecards, isCloud, cloudTotalCost]);

  // Find the selected result for detail panel
  const selectedResult: RoundResult | undefined = activeSelectedCell
    ? activeResults.find(
        (r) => r.modelId === activeSelectedCell.modelId && r.scenarioId === activeSelectedCell.scenarioId
      )
    : undefined;

  const handleSetSelectedCell = isCloud ? cloudSetSelectedCell : setSelectedCell;

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header Bar */}
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
          {!activeRunning ? (
            <button
              onClick={handleStart}
              disabled={activeModels.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6700] hover:bg-[#FF6700]/80 text-white font-bold rounded-lg transition-all shadow-[0_0_14px_rgba(255,103,0,0.3)] hover:shadow-[0_0_20px_rgba(255,103,0,0.5)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Start {isCloud ? "Cloud " : ""}Trials
            </button>
          ) : (
            <button onClick={handleStop} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all">
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
          <button onClick={handleExport} disabled={activeResults.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={onClose} className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all" title="Back to Builder">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
        <button
          onClick={() => { if (!running && !cloudRunning) setActiveTab("local"); }}
          disabled={running || cloudRunning}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-base font-bold transition-all border ${
            activeTab === "local"
              ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700] shadow-[0_0_10px_rgba(255,103,0,0.2)]"
              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
          } disabled:cursor-not-allowed`}
        >
          <Cpu className="w-4 h-4" />
          Local Models
        </button>
        <button
          onClick={() => { if (!running && !cloudRunning) setActiveTab("cloud"); }}
          disabled={running || cloudRunning}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-base font-bold transition-all border ${
            activeTab === "cloud"
              ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700] shadow-[0_0_10px_rgba(255,103,0,0.2)]"
              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
          } disabled:cursor-not-allowed`}
        >
          <Cloud className="w-4 h-4" />
          Cloud Models
        </button>

        {/* Cloud cost display */}
        {isCloud && cloudTotalCost > 0 && (
          <span className="ml-4 text-base font-bold text-emerald-400">
            {cloudRunning ? "Running" : "Total"} Cost: ${cloudTotalCost.toFixed(4)}
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Controls + Matrix (60%) */}
        <div className="flex flex-col flex-[6] border-r border-zinc-800 overflow-hidden">
          <ForgeTrialsControls
            models={isCloud ? cloudSelectedModels.map((m) => m.id) : localModels}
            setModels={(ids) => {
              if (!isCloud) setLocalModels(ids);
            }}
            defaultModels={isCloud ? [] : DEFAULT_LOCAL_MODELS}
            running={activeRunning}
            isCloud={isCloud}
            cloudModels={cloudSelectedModels}
            onCloudModelsChange={cloudSetSelectedModels}
          />
          <div className="flex-1 overflow-auto p-4">
            <ForgeTrialsMatrix
              results={activeResults}
              scorecards={activeScorecards}
              models={activeModels}
              scenarios={activeScenarios}
              selectedCell={activeSelectedCell}
              onSelectCell={handleSetSelectedCell}
              currentModel={activeCurrentModel}
              currentRound={activeCurrentRound}
              running={activeRunning}
              isCloud={isCloud}
            />
          </div>
        </div>

        {/* Right: Detail Panel (40%) */}
        <div className="flex flex-col flex-[4] overflow-hidden">
          <ForgeTrialsRoundDetail
            result={selectedResult}
            scenario={activeSelectedCell ? activeScenarios.find((s) => s.id === activeSelectedCell.scenarioId) : undefined}
            running={activeRunning}
            currentModel={activeCurrentModel}
            currentRound={activeCurrentRound}
            isCloud={isCloud}
            totalCost={isCloud ? cloudTotalCost : undefined}
            warmupHtml={isCloud ? cloudWarmupHtml : undefined}
          />
        </div>
      </div>

      {/* Progress Footer */}
      <ForgeTrialsProgress
        events={activeEvents}
        running={activeRunning}
        currentModel={activeCurrentModel}
        currentRound={activeCurrentRound}
        results={activeResults}
        totalModels={activeModels.length}
        totalRounds={activeScenarios.length}
        runsPerScenario={isCloud ? 1 : 3}
        eventLogRef={eventLogRef}
        isCloud={isCloud}
        totalCost={isCloud ? cloudTotalCost : undefined}
      />
    </div>
  );
}
