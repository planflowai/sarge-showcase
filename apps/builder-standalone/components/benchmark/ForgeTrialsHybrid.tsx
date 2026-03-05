"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Play, Square, Plus, Layers, ChevronDown, ChevronRight,
  Loader2, X, Archive, Download, Zap, DollarSign, Trophy, Hand,
} from "lucide-react";
import { useBenchmarkStore } from "@/lib/stores/benchmarkStore";
import { useModelStore } from "@sarge/core";
import {
  ALL_HYBRID_SCENARIOS,
  type HybridChain,
  type HybridStep,
  type HybridEvent,
  type HybridBenchmarkConfig,
  getLetterGrade,
  getGradeColor,
} from "@sarge/benchmark";
import {
  autoSelectModels,
  getRoutingLabel,
  getDifficultyDescription,
  getDifficultyCostTarget,
  type RoutingMode,
  type ModelCandidate,
} from "@/lib/autoRouter";

const DEFAULT_ROLES = ["Build", "Improve", "Refine", "Polish", "Check"];

const PROVIDER_COLORS: Record<string, string> = {
  ollama: "#6B7280", lmstudio: "#6B7280",
  anthropic: "#D97706", openai: "#10B981", google: "#3B82F6",
  xai: "#8B5CF6", deepseek: "#06B6D4", mistral: "#F97316",
  groq: "#EF4444", together: "#EC4899", perplexity: "#6366F1",
  huggingface: "#FF9D00",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-400", medium: "text-amber-400",
  hard: "text-orange-400", expert: "text-red-400",
};

const ROUTING_MODES: { id: RoutingMode; icon: typeof Zap; label: string; desc: string }[] = [
  { id: "score", icon: Zap, label: "Score Routed", desc: "Best trial scores per step" },
  { id: "cost", icon: DollarSign, label: "Cost Optimized", desc: "Cheapest 80+ models" },
  { id: "quality", icon: Trophy, label: "Quality First", desc: "Highest quality, any cost" },
  { id: "manual", icon: Hand, label: "Manual", desc: "Pick models yourself" },
];

export function ForgeTrialsHybrid() {
  const store = useBenchmarkStore();
  const {
    hybridRunning,
    hybridResults,
    hybridEvents,
    hybridTotalCost,
    hybridStartRun,
    hybridStopRun,
    hybridAddResult,
    hybridAddEvent,
    hybridSetAbortController,
    hybridSetTotalCost,
    hybridReset,
    hybridPastRuns,
    hybridSaveRun,
    hybridClearPastRuns,
    hybridSelectedScenario,
    setHybridSelectedScenario,
    hybridCustomPrompt,
    setHybridCustomPrompt,
    cloudScorecards,
    cloudResults: cloudTrialResults,
    scorecards: localScorecards,
    results: localTrialResults,
  } = store;

  const storeModels = useModelStore((s) => s.models);
  const modelRoles = useModelStore((s) => s.modelRoles);

  // Guardian model state
  const [guardianModelId, setGuardianModelId] = useState("");
  const [guardianProvider, setGuardianProvider] = useState("");

  // Chain steps — single chain at a time
  const [steps, setSteps] = useState<HybridStep[]>([
    { modelId: "", provider: "", modelName: "", role: "Build" },
    { modelId: "", provider: "", modelName: "", role: "Improve" },
  ]);
  const [showPastRuns, setShowPastRuns] = useState(false);
  const [stepTabs, setStepTabs] = useState<Record<number, "local" | "cloud">>({});

  // Routing mode — persisted in localStorage
  const [routingMode, setRoutingModeState] = useState<RoutingMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("forge-routing-mode") as RoutingMode) || "score";
    }
    return "score";
  });
  const setRoutingMode = useCallback((mode: RoutingMode) => {
    setRoutingModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("forge-routing-mode", mode);
    }
  }, []);

  // Local models — filtered by "Trials" role
  const localModels = useMemo(() =>
    storeModels
      .filter((m) => {
        if (m.provider !== "ollama" && m.provider !== "lmstudio") return false;
        const roles = modelRoles[m.id];
        if (!roles || roles.length === 0) return true;
        return roles.includes("Trials");
      })
      .map((m) => ({ id: m.id, provider: m.provider, name: m.name })),
    [storeModels, modelRoles]
  );

  // Cloud models — filtered by "Trials" role
  const cloudModels = useMemo(() =>
    storeModels
      .filter((m) => {
        if (m.provider === "ollama" || m.provider === "lmstudio") return false;
        const roles = modelRoles[m.id];
        if (!roles || roles.length === 0) return true;
        return roles.includes("Trials");
      })
      .map((m) => ({ id: m.id, provider: m.provider, name: m.name })),
    [storeModels, modelRoles]
  );

  const allModels: ModelCandidate[] = useMemo(
    () => [...localModels, ...cloudModels],
    [localModels, cloudModels],
  );

  // Cloud models for Guardian selection
  const guardianModels = useMemo(() =>
    storeModels
      .filter((m) => {
        if (m.provider === "ollama" || m.provider === "lmstudio") return false;
        return true;
      })
      .map((m) => ({ id: m.id, provider: m.provider, name: m.name })),
    [storeModels]
  );

  // Trial score lookup
  const getTrialScore = useCallback((modelId: string, provider: string): number | null => {
    if (provider === "ollama" || provider === "lmstudio") {
      const sc = localScorecards.find((s: any) => s.modelId === modelId);
      return sc ? sc.overallScore : null;
    }
    const sc = cloudScorecards.find((s: any) => s.modelId === modelId);
    return sc ? sc.overallScore : null;
  }, [localScorecards, cloudScorecards]);

  const selectedScenarioObj = ALL_HYBRID_SCENARIOS.find((s) => s.id === hybridSelectedScenario);
  const difficulty = selectedScenarioObj?.difficulty || "hard";

  // ── Auto-select models when routing mode or scenario changes ──
  const autoRouted = useMemo(() => {
    if (routingMode === "manual") return null;
    return autoSelectModels(
      difficulty,
      steps.map((s) => ({ role: s.role })),
      routingMode,
      allModels,
      localScorecards,
      cloudScorecards,
      localTrialResults,
      cloudTrialResults,
    );
  }, [routingMode, difficulty, steps.length, allModels, localScorecards, cloudScorecards, localTrialResults, cloudTrialResults,
    // Re-run when step roles change
    steps.map((s) => s.role).join(","),
  ]);

  // Apply auto-selection to steps when autoRouted changes
  useEffect(() => {
    if (!autoRouted || routingMode === "manual" || hybridRunning) return;
    setSteps((prev) => {
      const next = [...prev];
      for (let i = 0; i < next.length && i < autoRouted.length; i++) {
        const ar = autoRouted[i];
        if (ar.modelId) {
          next[i] = { ...next[i], modelId: ar.modelId, provider: ar.provider, modelName: ar.modelName };
        }
      }
      return next;
    });
  }, [autoRouted, routingMode, hybridRunning]);

  // ── Step management ──
  const addStep = () => {
    if (steps.length >= 5) return;
    const role = DEFAULT_ROLES[steps.length] || `Step ${steps.length + 1}`;
    setSteps([...steps, { modelId: "", provider: "", modelName: "", role }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<HybridStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  const updateStepRole = (index: number, role: string) => {
    updateStep(index, { role });
  };

  // ── Cost estimate ──
  const totalEstimate = useMemo(() => {
    if (autoRouted && routingMode !== "manual") {
      return autoRouted.reduce((sum: number, r: { costEstimate: number }) => sum + r.costEstimate, 0);
    }
    let total = 0;
    for (const step of steps) {
      if (step.provider === "ollama" || step.provider === "lmstudio" || !step.provider) {
        // local = free
      } else {
        total += 0.015;
      }
    }
    return total;
  }, [steps, autoRouted, routingMode]);

  const costTarget = getDifficultyCostTarget(difficulty);

  // ── Validation ──
  const hasEmptySteps = steps.some((s) => !s.modelId);
  const canRun = !hybridRunning && !hasEmptySteps && steps.length >= 1;

  // ── Start hybrid run ──
  const handleStart = useCallback(async () => {
    if (!canRun) return;

    const chainId = `hybrid-${Date.now()}`;
    const chain: HybridChain = {
      id: chainId,
      name: steps.map((s) => s.role).join(" \u2192 "),
      steps,
      prompt: hybridCustomPrompt || "",
    };

    const ctrl = new AbortController();
    hybridSetAbortController(ctrl);
    hybridStartRun();

    try {
      const config: HybridBenchmarkConfig & { guardianModelId?: string; guardianProvider?: string; routingMode?: string } = {
        chains: [chain],
        scenarioId: hybridSelectedScenario,
        ...(guardianModelId ? { guardianModelId, guardianProvider } : {}),
        routingMode,
      };

      const res = await fetch("/api/benchmark/run-hybrid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        hybridAddEvent({ type: "hybrid:error", message: `API error: ${res.status}`, timestamp: Date.now() });
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
            const event: HybridEvent = JSON.parse(line);
            hybridAddEvent(event);

            if (event.chainResult) {
              hybridAddResult(event.chainResult);
            }

            const costMatch = event.message?.match(/\$(\d+\.\d+)/);
            if (costMatch) {
              hybridSetTotalCost(parseFloat(costMatch[1]));
            }
          } catch {}
        }
      }
      setTimeout(() => hybridSaveRun(), 100);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        hybridAddEvent({ type: "hybrid:stopped", message: "Hybrid run stopped.", timestamp: Date.now() });
        setTimeout(() => hybridSaveRun(), 100);
      } else {
        hybridAddEvent({ type: "hybrid:error", message: `Run failed: ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now() });
      }
    } finally {
      const { hybridRunning: stillRunning } = useBenchmarkStore.getState();
      if (stillRunning) {
        useBenchmarkStore.setState({ hybridRunning: false, hybridAbortController: null });
      }
    }
  }, [canRun, steps, hybridSelectedScenario, hybridCustomPrompt, hybridStartRun, hybridAddResult, hybridAddEvent, hybridSetAbortController, hybridSetTotalCost, hybridSaveRun, guardianModelId, guardianProvider, routingMode]);

  const handleClear = () => {
    setSteps([
      { modelId: "", provider: "", modelName: "", role: "Build" },
      { modelId: "", provider: "", modelName: "", role: "Improve" },
    ]);
    hybridReset();
  };

  const currentEvent = hybridEvents.length > 0 ? hybridEvents[hybridEvents.length - 1] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── SCENARIO ── */}
      <div className="px-4 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-[#FF6700]" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">Hybrid Chain</span>
        </div>

        {/* Scenario dropdown */}
        <div className="mb-2">
          <label className="text-sm font-bold text-zinc-300 uppercase block mb-1">Scenario</label>
          <select
            value={hybridSelectedScenario}
            onChange={(e) => setHybridSelectedScenario(e.target.value)}
            disabled={hybridRunning}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5"
          >
            {ALL_HYBRID_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.difficulty})
              </option>
            ))}
          </select>
          {selectedScenarioObj && (
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-sm font-bold uppercase ${DIFFICULTY_COLORS[selectedScenarioObj.difficulty] || "text-zinc-200"}`}>
                {selectedScenarioObj.difficulty}
              </span>
              <span className="text-sm text-zinc-400">
                {getDifficultyDescription(selectedScenarioObj.difficulty)}
              </span>
              <span className="text-sm text-zinc-500">
                {selectedScenarioObj.timeout ? `${selectedScenarioObj.timeout / 1000}s` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Custom prompt */}
        <div className="mb-2">
          <label className="text-sm font-bold text-zinc-300 uppercase block mb-1">Custom Prompt (optional)</label>
          <textarea
            value={hybridCustomPrompt}
            onChange={(e) => setHybridCustomPrompt(e.target.value)}
            placeholder="Overrides scenario prompt when filled..."
            disabled={hybridRunning}
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5 placeholder-zinc-500 resize-none"
          />
        </div>

        {/* Prompt preview */}
        {selectedScenarioObj && (
          <div className="mb-1">
            <label className="text-sm font-bold text-zinc-300 uppercase block mb-1">
              {hybridCustomPrompt ? "Sending (custom)" : "Sending (scenario)"}
            </label>
            <div className="bg-zinc-900/80 border border-zinc-700 rounded px-3 py-2 max-h-32 overflow-y-auto">
              <p className="text-sm text-zinc-200 font-medium leading-relaxed whitespace-pre-wrap">
                {hybridCustomPrompt || selectedScenarioObj.prompt}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── AUTO ROUTER ── */}
      <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/30 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Auto Router</span>
        </div>
        <div className="flex gap-1">
          {ROUTING_MODES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setRoutingMode(id)}
              disabled={hybridRunning}
              className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-bold transition-all border ${
                routingMode === id
                  ? id === "score" ? "bg-amber-900/30 text-amber-400 border-amber-600/40"
                  : id === "cost" ? "bg-emerald-900/30 text-emerald-400 border-emerald-600/40"
                  : id === "quality" ? "bg-sky-900/30 text-sky-400 border-sky-600/40"
                  : "bg-zinc-700/50 text-zinc-200 border-zinc-600/40"
                : "text-zinc-400 hover:text-zinc-200 border-transparent"
              } disabled:opacity-50`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
        {routingMode !== "manual" && (
          <div className="mt-1.5 text-sm text-zinc-400">
            {ROUTING_MODES.find((m) => m.id === routingMode)?.desc}
            {" \u00b7 Target: "}
            <span className="text-emerald-400 font-mono">${costTarget.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* ── GUARDIAN SELECTOR ── */}
      <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/20 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Thread Guardian</span>
          <span className="text-sm text-zinc-400">Validates output between steps</span>
        </div>
        <select
          value={guardianModelId ? `${guardianProvider}:${guardianModelId}` : ""}
          onChange={(e) => {
            if (!e.target.value) {
              setGuardianModelId("");
              setGuardianProvider("");
              return;
            }
            const [prov, ...rest] = e.target.value.split(":");
            setGuardianModelId(rest.join(":"));
            setGuardianProvider(prov);
          }}
          disabled={hybridRunning}
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-2 py-1.5"
        >
          <option value="">Hardcoded validation (default)</option>
          {guardianModels.map((m) => (
            <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
              {m.name} ({m.provider})
            </option>
          ))}
        </select>
      </div>

      {/* ── CHAIN STEPS ── */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
            Chain Steps ({steps.length}/5)
          </span>
          {routingMode !== "manual" && (
            <span className="text-sm text-zinc-500">Auto-assigned &middot; click [change] to override</span>
          )}
        </div>

        {steps.map((step, si) => {
          const isRunningStep = hybridRunning && currentEvent?.stepIndex === si;
          const routerInfo = autoRouted && routingMode !== "manual" ? autoRouted[si] : null;

          return (
            <div
              key={si}
              className={`border rounded-lg p-2.5 transition-all ${
                isRunningStep
                  ? "border-[#FF6700]/50 bg-[#FF6700]/5"
                  : "border-zinc-800 bg-zinc-900/40"
              }`}
            >
              {/* Step header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-zinc-200 w-6 flex-shrink-0">
                  S{si + 1}
                </span>
                <input
                  type="text"
                  value={step.role}
                  onChange={(e) => updateStepRole(si, e.target.value)}
                  disabled={hybridRunning}
                  className="bg-transparent border-none text-sm font-bold text-white outline-none flex-1 min-w-0"
                />
                {routerInfo && routerInfo.score !== null && (
                  <span className={`text-sm font-bold tabular-nums ${
                    routerInfo.score >= 80 ? "text-emerald-400" : routerInfo.score >= 60 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {routerInfo.score}
                  </span>
                )}
                {isRunningStep && (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
                )}
                {steps.length > 1 && !hybridRunning && (
                  <button
                    onClick={() => removeStep(si)}
                    className="text-zinc-200 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Auto-routed model display */}
              {routingMode !== "manual" && step.modelId ? (
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-sm font-bold px-1.5 py-0.5 rounded border truncate"
                    style={{
                      borderColor: (PROVIDER_COLORS[step.provider] || "#6B7280") + "60",
                      color: PROVIDER_COLORS[step.provider] || "#D4D4D8",
                    }}
                  >
                    {step.modelName || step.modelId}
                  </span>
                  <span className="text-sm font-mono text-emerald-400">
                    ${routerInfo?.costEstimate.toFixed(3) || "0.000"}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={() => setRoutingMode("manual")}
                    disabled={hybridRunning}
                    className="text-sm text-zinc-400 hover:text-zinc-200 font-bold transition-colors"
                  >
                    [change]
                  </button>
                </div>
              ) : (
                <>
                  {/* LOCAL / CLOUD tabs */}
                  <div className="flex gap-0.5 mb-1.5">
                    <button
                      onClick={() => setStepTabs((t) => ({ ...t, [si]: "local" }))}
                      disabled={hybridRunning}
                      className={`flex-1 text-sm font-bold uppercase py-1 rounded-l transition-colors ${
                        (stepTabs[si] || "local") === "local"
                          ? "bg-zinc-700 text-white"
                          : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      LOCAL ({localModels.length})
                    </button>
                    <button
                      onClick={() => setStepTabs((t) => ({ ...t, [si]: "cloud" }))}
                      disabled={hybridRunning}
                      className={`flex-1 text-sm font-bold uppercase py-1 rounded-r transition-colors ${
                        (stepTabs[si] || "local") === "cloud"
                          ? "bg-zinc-700 text-white"
                          : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      CLOUD ({cloudModels.length})
                    </button>
                  </div>

                  {/* Model dropdown */}
                  <select
                    value={step.modelId ? `${step.provider}:${step.modelId}` : ""}
                    onChange={(e) => {
                      const [provider, ...rest] = e.target.value.split(":");
                      const modelId = rest.join(":");
                      const list = (stepTabs[si] || "local") === "local" ? localModels : cloudModels;
                      const m = list.find((am) => am.id === modelId && am.provider === provider);
                      if (m) {
                        updateStep(si, { modelId: m.id, provider: m.provider, modelName: m.name });
                      }
                    }}
                    disabled={hybridRunning}
                    className={`w-full bg-zinc-800 border text-sm rounded px-2 py-1.5 mb-1 ${
                      step.modelId ? "border-zinc-700 text-zinc-300" : "border-amber-600/50 text-amber-400"
                    }`}
                  >
                    {!step.modelId && (
                      <option value="" disabled>Select a model</option>
                    )}
                    {((stepTabs[si] || "local") === "local" ? localModels : cloudModels).map((m) => {
                      const score = getTrialScore(m.id, m.provider);
                      return (
                        <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                          {m.name}{m.provider !== "ollama" && m.provider !== "lmstudio" ? ` (${m.provider})` : ""}{score !== null ? ` \u2014 ${score}/100` : ""}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}

              {/* Cost estimate */}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-mono ${
                  step.provider === "ollama" || step.provider === "lmstudio"
                    ? "text-zinc-200" : step.provider ? "text-emerald-400" : "text-zinc-300"
                }`}>
                  {!step.provider ? "" :
                    step.provider === "ollama" || step.provider === "lmstudio" ? "Est: $0.00" : `Est: ~$${(routerInfo?.costEstimate || 0.015).toFixed(3)}`}
                </span>
                {step.modelId && (
                  <span
                    className="text-sm font-bold px-1.5 py-0.5 rounded border"
                    style={{
                      borderColor: (PROVIDER_COLORS[step.provider] || "#6B7280") + "60",
                      color: PROVIDER_COLORS[step.provider] || "#D4D4D8",
                    }}
                  >
                    {step.provider === "ollama" || step.provider === "lmstudio" ? "LOCAL" : "CLOUD"}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Add step */}
        {!hybridRunning && steps.length < 5 && (
          <button
            onClick={addStep}
            className="flex items-center gap-1 px-3 py-1.5 w-full justify-center text-sm font-bold text-zinc-200 hover:text-white border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg transition-all"
          >
            <Plus className="w-3 h-3" />
            Add Step
          </button>
        )}

        {/* Total estimate */}
        {steps.some((s) => s.modelId) && (
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-800">
            <span className="text-sm font-bold text-zinc-200">Total Est:</span>
            <span className={`text-sm font-mono font-bold ${
              totalEstimate <= costTarget ? "text-emerald-400" : "text-amber-400"
            }`}>
              ${totalEstimate.toFixed(4)}
              {totalEstimate > costTarget && (
                <span className="text-amber-400 ml-1">(target: ${costTarget.toFixed(2)})</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── RUN / CLEAR ── */}
      <div className="px-4 py-2 border-t border-zinc-800 flex-shrink-0 flex items-center gap-2">
        {!hybridRunning ? (
          <button
            onClick={handleStart}
            disabled={!canRun}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            RUN
          </button>
        ) : (
          <button
            onClick={() => hybridStopRun()}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-all"
          >
            <Square className="w-3.5 h-3.5" />
            STOP
          </button>
        )}
        <button
          onClick={handleClear}
          disabled={hybridRunning}
          className="px-3 py-2 bg-zinc-800 hover:bg-red-900/30 border border-zinc-700 hover:border-red-700 text-zinc-200 hover:text-red-300 font-bold rounded-lg text-sm transition-all disabled:opacity-30"
        >
          CLEAR
        </button>
      </div>

      {/* ── Status bar ── */}
      {(hybridRunning || hybridResults.length > 0) && (
        <div className="flex items-center h-7 px-3 border-t border-zinc-800 bg-zinc-900/60 flex-shrink-0 gap-2">
          {hybridRunning && currentEvent && (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
              <span className="text-sm text-zinc-200 truncate flex-1">{currentEvent.message}</span>
            </>
          )}
          {!hybridRunning && hybridResults.length > 0 && (
            <span className="text-sm font-bold text-emerald-400">
              Complete — {hybridResults[hybridResults.length - 1]?.finalScore?.total ?? "?"}/100
            </span>
          )}
          {hybridTotalCost > 0 && (
            <span className="text-sm font-mono font-bold text-emerald-400 ml-auto">
              ${hybridTotalCost.toFixed(4)}
            </span>
          )}
        </div>
      )}

      {/* ── PAST RUNS ── */}
      {hybridPastRuns.length > 0 && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setShowPastRuns(!showPastRuns)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {showPastRuns ? <ChevronDown className="w-3.5 h-3.5 text-zinc-200" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-200" />}
            <Archive className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-bold text-zinc-200">Past Runs</span>
            <span className="text-sm text-zinc-200 tabular-nums">{hybridPastRuns.length}</span>
            <div className="flex-1" />
            <span
              onClick={(e) => { e.stopPropagation(); hybridClearPastRuns(); setShowPastRuns(false); }}
              className="text-sm text-zinc-200 hover:text-red-400 transition-colors px-1 cursor-pointer"
            >
              Clear All
            </span>
          </button>
          {showPastRuns && (
            <div className="px-3 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
              {hybridPastRuns.map((run: any, ri: any) => {
                const grade = getLetterGrade(run.finalScore.total);
                const gradeColor = getGradeColor(grade);

                return (
                  <div
                    key={`${run.chainId}-${run.timestamp}-${ri}`}
                    className="border border-zinc-800 rounded-lg px-3 py-2 bg-zinc-900/60 hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-[900] ${gradeColor} min-w-[24px]`}>{grade}</span>
                      <span className={`text-sm font-bold tabular-nums ${
                        run.finalScore.total >= 90 ? "text-emerald-400" :
                        run.finalScore.total >= 70 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {run.finalScore.total}/100
                      </span>
                      <span className="text-sm text-zinc-200">
                        {run.steps.length} steps
                      </span>
                      <span className="text-sm text-zinc-200 tabular-nums">
                        {(run.totalTimeMs / 1000).toFixed(1)}s
                      </span>
                      <span className="text-sm font-mono text-emerald-400 tabular-nums">
                        ${run.totalCost.toFixed(4)}
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `hybrid-${run.chainName}-${Date.now()}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-zinc-200 hover:text-indigo-400 transition-colors"
                        title="Export"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Score progression */}
                    <div className="flex items-center gap-1 mt-1">
                      {run.steps.map((s: any, si: any) => (
                        <React.Fragment key={si}>
                          {si > 0 && <span className="text-zinc-300 text-sm">&rarr;</span>}
                          <span
                            className="text-sm font-bold px-1.5 py-0.5 rounded border"
                            style={{
                              borderColor: (PROVIDER_COLORS[s.provider] || "#6B7280") + "40",
                              color: s.score.total >= 90 ? "#34D399" : s.score.total >= 70 ? "#FBBF24" : "#F87171",
                            }}
                          >
                            {s.score.total}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
