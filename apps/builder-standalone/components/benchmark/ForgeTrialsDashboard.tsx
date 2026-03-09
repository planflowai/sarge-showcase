"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Flame, ArrowLeft, Play, Square, Download, Cloud, Cpu, Trash2,
  Shield, ShieldOff, Plane, Radio, DollarSign, Moon, Sun, Settings, Loader2,
  Layers, ToggleLeft, ToggleRight, Activity, AlertTriangle, ChevronDown, ChevronUp,
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
import { useSettingsStore, useAirGapStore, useModelStore } from "@sarge/core";
import { launchBillingPopout } from "@/lib/billingPopoutManager";
import { ForgeTrialsMatrix } from "./ForgeTrialsMatrix";
import { ForgeTrialsControls } from "./ForgeTrialsControls";
import { ForgeTrialsRoundDetail } from "./ForgeTrialsRoundDetail";
import { ForgeTrialsHybrid } from "./ForgeTrialsHybrid";
import { HybridDetailPanel } from "./HybridDetailPanel";
import Link from "next/link";

// Fallback local models if Ollama scan fails
const FALLBACK_LOCAL_MODELS: string[] = [
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

// ── Activity Log Helpers ──────────────────────────────────────────────

interface ActivityEntry {
  id: number;
  type: string;
  modelId?: string;
  scenarioId?: string;
  score?: number;
  message: string;
  timestamp: number;
}

function getEventColor(type: string): string {
  if (type.includes("complete")) return "bg-emerald-900/40 text-emerald-400";
  if (type.includes("error")) return "bg-red-900/40 text-red-400";
  if (type.includes("stopped") || type.includes("skipped")) return "bg-zinc-700/40 text-zinc-400";
  if (type.includes("generating") || type.includes("scoring") || type.includes("loading")) return "bg-amber-900/40 text-amber-400";
  if (type.includes("start")) return "bg-blue-900/40 text-blue-400";
  if (type.includes("warmup")) return "bg-purple-900/40 text-purple-400";
  return "bg-zinc-800/40 text-zinc-300";
}

function formatEventLabel(type: string): string {
  const labels: Record<string, string> = {
    "run:start": "START", "run:complete": "COMPLETE", "run:stopped": "STOPPED", "run:error": "ERROR",
    "model:start": "MODEL", "model:complete": "MODEL \u2713", "model:loading": "LOADING", "model:skipped": "SKIP",
    "round:start": "ROUND", "round:generating": "GEN", "round:scoring": "SCORE", "round:complete": "ROUND \u2713",
    "warmup:complete": "WARMUP \u2713",
  };
  return labels[type] || type;
}

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
    cloudProcessEvent,
    cloudWarmupHtml,
    cloudParallel,
    setCloudParallel,
    hybridRunning,
    hybridTotalCost,
    hybridResults,
    hybridEvents,
    hybridSelectedScenario,
    clearAll,
  } = store;

  // Ensure model store is hydrated (builder flags, Ollama scan)
  const modelsHydrated = useModelStore((s) => s.hydrated);
  const hydrateModels = useModelStore((s) => s.hydrate);
  useEffect(() => {
    if (!modelsHydrated) hydrateModels();
  }, [modelsHydrated, hydrateModels]);

  // Header icon state
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const secureMode = useAirGapStore((s) => s.secureMode);
  const toggleSecureMode = useAirGapStore((s) => s.toggleSecureMode);
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const toggleAirGap = useAirGapStore((s) => s.toggleAirGap);

  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>(FALLBACK_LOCAL_MODELS);
  const [localModels, setLocalModels] = useState<string[]>(
    selectedModels.length > 0 ? selectedModels : FALLBACK_LOCAL_MODELS
  );
  const [ollamaModelsLoaded, setOllamaModelsLoaded] = useState(false);

  // Fetch installed Ollama models on mount
  useEffect(() => {
    if (ollamaModelsLoaded) return;
    (async () => {
      try {
        const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data = await res.json();
        const names: string[] = (data.models || []).map((m: { name: string }) => m.name).sort();
        if (names.length > 0) {
          setAvailableLocalModels(names);
          if (selectedModels.length === 0) setLocalModels(names);
        }
      } catch {
        // Ollama not running — keep fallback
      } finally {
        setOllamaModelsLoaded(true);
      }
    })();
  }, [ollamaModelsLoaded, selectedModels.length]);

  // ── Live Activity Tracking ──
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [stallStatus, setStallStatus] = useState<"ok" | "warning" | "dead">("ok");
  const [eventCount, setEventCount] = useState(0);
  const [lastEventAgo, setLastEventAgo] = useState(0);
  const lastEventTimeRef = useRef(0);
  const activityIdRef = useRef(0);

  const logActivity = useCallback((event: BenchmarkEvent) => {
    lastEventTimeRef.current = Date.now();
    setEventCount((c) => c + 1);
    setActivityLog((prev) => [{
      id: activityIdRef.current++,
      type: event.type,
      modelId: event.modelId,
      scenarioId: event.scenarioId,
      score: event.result?.score?.total,
      message: event.message,
      timestamp: event.timestamp,
    }, ...prev].slice(0, 100));
  }, []);

  // Determine which data to show based on active tab
  const isCloud = activeTab === "cloud";
  const isHybrid = activeTab === "hybrid";
  const activeRunning = isHybrid ? hybridRunning : isCloud ? cloudRunning : running;
  const activeResults = isCloud ? cloudResults : results;
  const activeScorecards = isCloud ? cloudScorecards : scorecards;
  const activeEvents = isCloud ? cloudEvents : events;
  const activeSelectedCell = isCloud ? cloudSelectedCell : selectedCell;
  const activeCurrentModel = isCloud ? cloudCurrentModel : currentModel;
  const activeCurrentRound = isCloud ? cloudCurrentRound : currentRound;
  const activeScenarios = isCloud ? CLOUD_SCENARIOS : BUILDER_SCENARIOS;
  const activeModels = isCloud
    ? cloudSelectedModels.map((m: any) => m.id)
    : localModels;
  const anyRunning = running || cloudRunning || hybridRunning;

  // Stall detection — checks every second during active runs
  useEffect(() => {
    if (!anyRunning) {
      setStallStatus("ok");
      setLastEventAgo(0);
      return;
    }
    const interval = setInterval(() => {
      if (!lastEventTimeRef.current) return;
      const elapsed = Date.now() - lastEventTimeRef.current;
      setLastEventAgo(Math.floor(elapsed / 1000));
      if (elapsed > 30000) setStallStatus("dead");
      else if (elapsed > 10000) setStallStatus("warning");
      else setStallStatus("ok");
    }, 1000);
    return () => clearInterval(interval);
  }, [anyRunning]);

  // Progress calculations
  const runsPerScenario = isCloud ? 1 : 3;
  const totalIndividualRuns = activeModels.length * activeScenarios.length * runsPerScenario;
  const completedMedianTests = activeResults.length;
  const completedIndividualRuns = completedMedianTests * runsPerScenario;
  const progress = totalIndividualRuns > 0 ? (completedIndividualRuns / totalIndividualRuns) * 100 : 0;

  // Estimate remaining time
  const avgMs = activeResults.length > 0
    ? activeResults.reduce((sum: any, r: any) => sum + r.timeMs, 0) / activeResults.length * runsPerScenario
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
    setActivityLog([]); setEventCount(0); lastEventTimeRef.current = Date.now(); activityIdRef.current = 0;

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
            logActivity(event);
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
          } catch (parseErr) {
            console.warn("[FORGE LOCAL] Failed to parse stream event:", parseErr, "line:", line.slice(0, 200));
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        addEvent({ type: "run:stopped", message: "Forge Trials stopped by user.", timestamp: Date.now() });
      } else {
        console.error("[FORGE LOCAL] Stream error:", err);
        addEvent({ type: "run:error", message: `Stream error: ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now() });
      }
    } finally {
      // Ensure running state is cleaned up if stream ends without run:complete/run:stopped
      const state = useBenchmarkStore.getState();
      if (state.running) {
        console.warn("[FORGE LOCAL] Stream ended without run:complete — cleaning up");
        completeRun({
          id: state.currentRunId || "unknown",
          startedAt: Date.now(),
          completedAt: Date.now(),
          models: localModels,
          scenarios: BUILDER_SCENARIOS.map((s) => s.id),
          results: state.results,
          scorecards: state.scorecards,
          status: "completed",
        });
      }
    }
  }, [localModels, startRun, stopRun, addResult, addScorecard, addEvent, setCurrentModel, setCurrentRound, setAbortController, completeRun, logActivity]);

  // ── Cloud: Start benchmark run ──
  const handleCloudStart = useCallback(async () => {
    if (cloudSelectedModels.length === 0) return;

    const runId = `cloud-trials-${Date.now()}`;
    const ctrl = new AbortController();
    cloudSetAbortController(ctrl);
    cloudStartRun(runId, cloudSelectedModels);
    setActivityLog([]); setEventCount(0); lastEventTimeRef.current = Date.now(); activityIdRef.current = 0;

    try {
      const config: CloudBenchmarkConfig = {
        models: cloudSelectedModels,
        parallel: cloudParallel,
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
            // Single batched state update — prevents 6+ re-renders per event
            cloudProcessEvent(event);
            logActivity(event);

            if (event.type === "run:complete" || event.type === "run:stopped") {
              cloudCompleteRun({
                id: runId,
                startedAt: Date.now(),
                completedAt: Date.now(),
                models: cloudSelectedModels.map((m: any) => m.id),
                scenarios: CLOUD_SCENARIOS.map((s) => s.id),
                results: useBenchmarkStore.getState().cloudResults,
                scorecards: useBenchmarkStore.getState().cloudScorecards,
                status: event.type === "run:complete" ? "completed" : "stopped",
              });
            }
          } catch (parseErr) {
            console.warn("[FORGE CLOUD] Failed to parse stream event:", parseErr, "line:", line.slice(0, 200));
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        cloudAddEvent({ type: "run:stopped", message: "Cloud Trials stopped by user.", timestamp: Date.now() });
      } else {
        console.error("[FORGE CLOUD] Stream error:", err);
        cloudAddEvent({ type: "run:error", message: `Stream error: ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now() });
      }
    } finally {
      // Ensure running state is cleaned up if stream ends without run:complete/run:stopped
      const state = useBenchmarkStore.getState();
      if (state.cloudRunning) {
        console.warn("[FORGE CLOUD] Stream ended without run:complete — cleaning up");
        cloudCompleteRun({
          id: state.cloudCurrentRunId || "unknown",
          startedAt: Date.now(),
          completedAt: Date.now(),
          models: cloudSelectedModels.map((m: any) => m.id),
          scenarios: CLOUD_SCENARIOS.map((s) => s.id),
          results: state.cloudResults,
          scorecards: state.cloudScorecards,
          status: "completed",
        });
      }
    }
  }, [cloudSelectedModels, cloudParallel, cloudStartRun, cloudStopRun, cloudAddResult, cloudAddScorecard, cloudAddEvent, cloudSetCurrentModel, cloudSetCurrentRound, cloudSetAbortController, cloudCompleteRun, cloudSetTotalCost, cloudSetWarmupHtml, logActivity]);

  const handleStart = isCloud ? handleCloudStart : handleLocalStart;
  const handleStop = isHybrid
    ? () => store.hybridStopRun()
    : isCloud ? () => cloudStopRun() : () => stopRun();

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
        (r: any) => r.modelId === activeSelectedCell.modelId && r.scenarioId === activeSelectedCell.scenarioId
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

          {!isHybrid && (
            <>
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
            </>
          )}
          {isHybrid && (
            <>
              {!hybridRunning ? (
                <button
                  onClick={() => {
                    // Trigger hybrid start from ForgeTrialsHybrid
                    // The component handles its own start logic
                  }}
                  disabled
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 font-bold rounded-lg text-xs border border-zinc-700 cursor-default"
                  title="Use controls in the Hybrid panel"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Hybrid
                </button>
              ) : (
                <button onClick={handleStop} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition-all">
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </button>
              )}
            </>
          )}
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
              onClick={() => setActiveTab("local")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-l-lg text-xs font-bold transition-all border ${
                activeTab === "local"
                  ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-zinc-300"
              }`}
            >
              <Cpu className="w-3 h-3" />
              Local
              {running && activeTab !== "local" && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </button>
            <button
              onClick={() => setActiveTab("cloud")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold transition-all border border-l-0 ${
                activeTab === "cloud"
                  ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-zinc-300"
              }`}
            >
              <Cloud className="w-3 h-3" />
              Cloud
              {cloudRunning && activeTab !== "cloud" && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </button>
            <button
              onClick={() => setActiveTab("hybrid")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-r-lg text-xs font-bold transition-all border border-l-0 ${
                activeTab === "hybrid"
                  ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-zinc-300"
              }`}
            >
              <Layers className="w-3 h-3" />
              Hybrid
              {hybridRunning && activeTab !== "hybrid" && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
            </button>
          </div>
          {/* Parallel toggle (cloud only) */}
          {isCloud && (
            <button
              onClick={() => setCloudParallel(!cloudParallel)}
              disabled={cloudRunning}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all ml-2 border ${
                cloudParallel
                  ? "bg-emerald-900/20 border-emerald-600/40 text-emerald-400"
                  : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-zinc-200"
              } disabled:opacity-30`}
              title="Run providers in parallel"
            >
              {cloudParallel ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              Parallel
            </button>
          )}
        </div>

        {/* Right: Header icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Cloud cost */}
          {isCloud && cloudTotalCost > 0 && (
            <span className="text-xs font-mono font-bold text-emerald-400 mr-2">
              ${cloudTotalCost.toFixed(4)}
            </span>
          )}

          <button onClick={toggleSecureMode} title={secureMode ? "Disable Secure Mode" : "Enable Secure Mode"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${secureMode ? "bg-red-600/30 border-red-500/60 text-red-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:text-zinc-300"}`}>
            {secureMode ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={toggleAirGap} title={airGapEnabled ? "Disable Air-Gap" : "Enable Air-Gap"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${airGapEnabled ? "bg-amber-500/20 border-amber-400/50 text-amber-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:text-zinc-300"}`}>
            {airGapEnabled ? <Plane className="h-3.5 w-3.5 rotate-45" /> : <Radio className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => launchBillingPopout()} title="Billing" className="flex items-center justify-center h-7 w-7 rounded-md bg-[#FF6700]/15 border border-[#FF6700]/40 text-[#FF6700] hover:bg-[#FF6700]/25 hover:border-[#FF6700]/60 transition-all">
            <DollarSign className="h-4 w-4" />
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:text-zinc-300 transition-all">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <Link href="/settings" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:text-zinc-300 transition-all">
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Progress Strip (compact, below toolbar) ── */}
      <div className="flex items-center h-8 px-3 border-b border-zinc-800/50 bg-zinc-900/40 flex-shrink-0 gap-3">
        {/* Left: model count */}
        <span className="text-sm font-bold text-zinc-200 flex-shrink-0">
          Models ({activeModels.length}/{isCloud ? "∞" : availableLocalModels.length})
        </span>

        {/* Progress bar */}
        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden max-w-[300px]">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #FF6700, #FF8C00, #FFD700)",
              boxShadow: activeRunning ? "0 0 8px rgba(255, 103, 0, 0.5)" : "none",
            }}
          />
        </div>

        {/* Progress text */}
        <span className="text-sm font-bold text-zinc-200 tabular-nums flex-shrink-0">
          {progress.toFixed(0)}%
        </span>

        {/* Status */}
        {activeRunning && activeCurrentModel ? (
          <div className="flex items-center gap-1.5 text-sm flex-shrink-0 min-w-0">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
            <span className="text-[#FF6700] font-bold truncate max-w-[150px]">{activeCurrentModel}</span>
            {activeCurrentRound && <span className="text-zinc-300">· {activeCurrentRound}</span>}
          </div>
        ) : !activeRunning && completedMedianTests > 0 ? (
          <span className="text-sm font-bold text-emerald-400 flex-shrink-0">Complete</span>
        ) : (
          <span className="text-sm text-zinc-300 flex-shrink-0">Ready</span>
        )}

        {/* Event ticker + stall warning */}
        {anyRunning && eventCount > 0 && stallStatus === "ok" && (
          <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-200 tabular-nums">{eventCount}</span>
            {lastEventAgo > 0 && <span className="text-zinc-300">{lastEventAgo}s</span>}
          </div>
        )}
        {stallStatus === "warning" && (
          <div className="flex items-center gap-1 text-xs text-amber-400 font-bold flex-shrink-0">
            <AlertTriangle className="w-3 h-3" />
            <span>Stream may be stalled ({lastEventAgo}s)</span>
          </div>
        )}
        {stallStatus === "dead" && (
          <div className="flex items-center gap-1 text-xs text-red-400 font-bold flex-shrink-0 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            <span>Stream appears dead — consider stopping ({lastEventAgo}s)</span>
          </div>
        )}

        {/* Activity log toggle */}
        {!isHybrid && (
          <button
            onClick={() => setActivityOpen(!activityOpen)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold transition-all border flex-shrink-0 ${
              activityOpen
                ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                : "bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:text-zinc-200"
            }`}
            title="Toggle live activity log"
          >
            <Activity className="w-3 h-3" />
            {activityOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        )}

        {/* Timing + Cost */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {!isHybrid && activeRunning && remainingMin > 0 && (
            <span className="text-xs text-zinc-300">~{remainingMin}m</span>
          )}
          {isCloud && cloudTotalCost > 0 && (
            <span className="text-xs font-mono font-bold text-emerald-400">${cloudTotalCost.toFixed(4)}</span>
          )}
          {isHybrid && hybridTotalCost > 0 && (
            <span className="text-xs font-mono font-bold text-emerald-400">${hybridTotalCost.toFixed(4)}</span>
          )}
          {!isHybrid && (
            <span className="text-xs tabular-nums text-zinc-300">
              R{completedMedianTests}/{activeModels.length * activeScenarios.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Live Activity Panel (collapsible) ── */}
      {activityOpen && !isHybrid && (
        <div className="border-b border-zinc-800/50 bg-zinc-900/60 flex-shrink-0" style={{ maxHeight: "200px" }}>
          <div className="flex items-center h-7 px-3 border-b border-zinc-800/30">
            <Activity className="w-3 h-3 text-[#FF6700] mr-1.5" />
            <span className="text-xs font-bold text-zinc-200 flex-1">
              Live Activity — {eventCount} events
            </span>
            <button
              onClick={() => { setActivityLog([]); setEventCount(0); }}
              disabled={activityLog.length === 0}
              className="text-xs text-zinc-300 hover:text-zinc-100 disabled:opacity-30 px-1.5 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setActivityOpen(false)}
              className="text-xs text-zinc-300 hover:text-zinc-100 px-1"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-2 py-0.5" style={{ maxHeight: "170px" }}>
            {activityLog.length === 0 ? (
              <div className="text-xs text-zinc-300 py-3 text-center">No events yet — start a trial to see live stream data</div>
            ) : (
              activityLog.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 py-[3px] text-xs border-b border-zinc-800/20 last:border-0">
                  <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${getEventColor(entry.type)}`}>
                    {formatEventLabel(entry.type)}
                  </span>
                  {entry.modelId && (
                    <span className="text-zinc-400 truncate max-w-[140px]">{entry.modelId}</span>
                  )}
                  {entry.scenarioId && (
                    <span className="text-zinc-300 truncate max-w-[100px]">· {entry.scenarioId}</span>
                  )}
                  {entry.score !== undefined && (
                    <span className={`font-bold tabular-nums ${entry.score >= 90 ? "text-emerald-400" : entry.score >= 70 ? "text-amber-400" : "text-red-400"}`}>
                      {entry.score}/100
                    </span>
                  )}
                  <span className="text-zinc-400 ml-auto tabular-nums flex-shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      {isHybrid ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-[3] overflow-y-auto border-r border-zinc-800">
            <ForgeTrialsHybrid />
          </div>
          <div className="flex-[7] flex flex-col overflow-hidden">
            <HybridDetailPanel
              running={hybridRunning}
              chainResult={hybridResults.length > 0 ? hybridResults[hybridResults.length - 1] : null}
              events={hybridEvents}
              scenarioId={hybridSelectedScenario}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Controls + Matrix (60%) */}
          <div className="flex flex-col flex-[6] border-r border-zinc-800 overflow-hidden">
            <ForgeTrialsControls
              models={isCloud ? cloudSelectedModels.map((m: any) => m.id) : localModels}
              setModels={(ids) => {
                if (!isCloud) setLocalModels(ids);
              }}
              defaultModels={isCloud ? [] : availableLocalModels}
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
              provider={isCloud && activeSelectedCell ? cloudSelectedModels.find((m: any) => m.id === activeSelectedCell.modelId)?.provider : undefined}
              allResults={activeResults}
              allScenarios={activeScenarios}
            />
          </div>
        </div>
      )}
    </div>
  );
}
