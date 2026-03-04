"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Flame, ArrowLeft, Play, Square, Download, Cloud, Cpu, Trash2,
  Shield, ShieldOff, Plane, Radio, DollarSign, Moon, Sun, Settings, Loader2,
} from "lucide-react";
import { useBenchmarkStore } from "@/lib/stores/benchmarkStore";
import {
  BUILDER_SCENARIOS,
  CLOUD_SCENARIOS,
  type BenchmarkEvent,
  type BenchmarkConfig,
  type CloudBenchmarkConfig,
  type RoundResult,
} from "@sarge/benchmark";
import { useSettingsStore, useAirGapStore } from "@sarge/core";
import { launchBillingPopout } from "@/lib/billingPopoutManager";
import { ForgeTrialsMatrix } from "./ForgeTrialsMatrix";
import { ForgeTrialsControls } from "./ForgeTrialsControls";
import { ForgeTrialsRoundDetail } from "./ForgeTrialsRoundDetail";
import Link from "next/link";

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
    clearAll,
  } = store;

  // Header icon state
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const secureMode = useAirGapStore((s) => s.secureMode);
  const toggleSecureMode = useAirGapStore((s) => s.toggleSecureMode);
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const toggleAirGap = useAirGapStore((s) => s.toggleAirGap);

  const [localModels, setLocalModels] = useState<string[]>(
    selectedModels.length > 0 ? selectedModels : DEFAULT_LOCAL_MODELS
  );

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

  // Progress calculations
  const runsPerScenario = isCloud ? 1 : 3;
  const totalIndividualRuns = activeModels.length * activeScenarios.length * runsPerScenario;
  const completedMedianTests = activeResults.length;
  const completedIndividualRuns = completedMedianTests * runsPerScenario;
  const progress = totalIndividualRuns > 0 ? (completedIndividualRuns / totalIndividualRuns) * 100 : 0;

  // Estimate remaining time
  const avgMs = activeResults.length > 0
    ? activeResults.reduce((sum, r) => sum + r.timeMs, 0) / activeResults.length * runsPerScenario
    : 90000 * runsPerScenario;
  const remainingScenarios = (activeModels.length * activeScenarios.length) - completedMedianTests;
  const remainingMs = remainingScenarios * avgMs;
  const remainingMin = Math.ceil(remainingMs / 60000);

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
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ── Toolbar (48px) ── */}
      <div className="flex items-center h-12 px-3 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0">
        {/* Left: Exit + Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit Forge
          </button>

          <div className="h-5 w-px bg-zinc-700 mx-1" />

          {!activeRunning ? (
            <button
              onClick={handleStart}
              disabled={activeModels.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6700] hover:bg-[#FF6700]/80 text-white font-bold rounded-lg text-xs transition-all shadow-[0_0_10px_rgba(255,103,0,0.2)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5" />
              Start
            </button>
          ) : (
            <button onClick={handleStop} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition-all">
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
          <button onClick={handleExport} disabled={activeResults.length === 0} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-all border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => { if (confirm("Clear all Forge Trials data? This cannot be undone.")) clearAll(); }}
            disabled={activeRunning || (results.length === 0 && cloudResults.length === 0)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-300 rounded-lg text-xs transition-all border border-zinc-700 hover:border-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>

        {/* Center: Title + Tab Toggle */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <Flame className="w-5 h-5 text-[#FF6700] drop-shadow-[0_0_8px_rgba(255,103,0,0.6)]" />
          <span className="text-lg font-[900] tracking-[3px] bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent">
            FORGE TRIALS
          </span>
          <div className="flex items-center gap-0.5 ml-2">
            <button
              onClick={() => { if (!running && !cloudRunning) setActiveTab("local"); }}
              disabled={running || cloudRunning}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-l-lg text-xs font-bold transition-all border ${
                activeTab === "local"
                  ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                  : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
              } disabled:cursor-not-allowed`}
            >
              <Cpu className="w-3 h-3" />
              Local
            </button>
            <button
              onClick={() => { if (!running && !cloudRunning) setActiveTab("cloud"); }}
              disabled={running || cloudRunning}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-r-lg text-xs font-bold transition-all border border-l-0 ${
                activeTab === "cloud"
                  ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                  : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
              } disabled:cursor-not-allowed`}
            >
              <Cloud className="w-3 h-3" />
              Cloud
            </button>
          </div>
        </div>

        {/* Right: Header icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Cloud cost */}
          {isCloud && cloudTotalCost > 0 && (
            <span className="text-xs font-mono font-bold text-emerald-400 mr-2">
              ${cloudTotalCost.toFixed(4)}
            </span>
          )}

          <button onClick={toggleSecureMode} title={secureMode ? "Disable Secure Mode" : "Enable Secure Mode"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${secureMode ? "bg-red-600/30 border-red-500/60 text-red-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
            {secureMode ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={toggleAirGap} title={airGapEnabled ? "Disable Air-Gap" : "Enable Air-Gap"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${airGapEnabled ? "bg-amber-500/20 border-amber-400/50 text-amber-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
            {airGapEnabled ? <Plane className="h-3.5 w-3.5 rotate-45" /> : <Radio className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => launchBillingPopout()} title="Billing" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-500 hover:text-[#FF6700] hover:border-[#FF6700]/50 transition-all">
            <DollarSign className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <Link href="/settings" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all">
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Progress Strip (compact, below toolbar) ── */}
      <div className="flex items-center h-8 px-3 border-b border-zinc-800/50 bg-zinc-900/40 flex-shrink-0 gap-3">
        {/* Left: model count */}
        <span className="text-[10px] font-bold text-zinc-500 flex-shrink-0">
          Models ({activeModels.length}/{isCloud ? "∞" : DEFAULT_LOCAL_MODELS.length})
        </span>

        {/* Progress bar */}
        <div className="flex-1 h-[3px] bg-zinc-800 rounded-full overflow-hidden max-w-[300px]">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #FF6700, #FF8C00, #FFD700)",
              boxShadow: activeRunning ? "0 0 6px rgba(255, 103, 0, 0.3)" : "none",
            }}
          />
        </div>

        {/* Progress text */}
        <span className="text-[10px] font-bold text-zinc-400 tabular-nums flex-shrink-0">
          {progress.toFixed(0)}%
        </span>

        {/* Status */}
        {activeRunning && activeCurrentModel ? (
          <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0 min-w-0">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
            <span className="text-[#FF6700] font-bold truncate max-w-[150px]">{activeCurrentModel}</span>
            {activeCurrentRound && <span className="text-zinc-600">· {activeCurrentRound}</span>}
          </div>
        ) : !activeRunning && completedMedianTests > 0 ? (
          <span className="text-[10px] font-bold text-emerald-400 flex-shrink-0">Complete</span>
        ) : (
          <span className="text-[10px] text-zinc-600 flex-shrink-0">Ready</span>
        )}

        {/* Timing + Cost */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {activeRunning && remainingMin > 0 && (
            <span className="text-[10px] text-zinc-500">~{remainingMin}m</span>
          )}
          {isCloud && cloudTotalCost > 0 && (
            <span className="text-[10px] font-mono font-bold text-emerald-400">${cloudTotalCost.toFixed(4)}</span>
          )}
          <span className="text-[10px] tabular-nums text-zinc-500">
            R{completedMedianTests}/{activeModels.length * activeScenarios.length}
          </span>
        </div>
      </div>

      {/* ── Main Content ── */}
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
          <div className="flex-1 overflow-auto p-3">
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
            provider={isCloud && activeSelectedCell ? cloudSelectedModels.find((m) => m.id === activeSelectedCell.modelId)?.provider : undefined}
          />
        </div>
      </div>
    </div>
  );
}
