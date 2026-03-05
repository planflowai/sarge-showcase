"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Play, Square, Plus, Minus, Zap, Wand2, Layers, ChevronDown, ChevronRight,
  Loader2, Check, X, Edit3, Download, Archive,
} from "lucide-react";
import { useBenchmarkStore } from "@/lib/stores/benchmarkStore";
import { useModelStore } from "@sarge/core";
import {
  CLOUD_SCENARIOS,
  type HybridChain,
  type HybridStep,
  type HybridEvent,
  type HybridChainResult,
  type HybridBenchmarkConfig,
  getLetterGrade,
  getGradeColor,
} from "@sarge/benchmark";

const DEFAULT_ROLES = ["Scaffold", "Enhance", "Refactor", "Finish", "Polish"];

const PROVIDER_COLORS: Record<string, string> = {
  ollama: "#6B7280",
  lmstudio: "#6B7280",
  anthropic: "#D97706",
  openai: "#10B981",
  google: "#3B82F6",
  xai: "#8B5CF6",
  deepseek: "#06B6D4",
  mistral: "#F97316",
  groq: "#EF4444",
  together: "#EC4899",
  perplexity: "#6366F1",
};

interface AvailableModel {
  id: string;
  provider: string;
  name: string;
  isLocal: boolean;
}

export function ForgeTrialsHybrid() {
  const store = useBenchmarkStore();
  const {
    hybridMode,
    setHybridMode,
    hybridChains,
    setHybridChains,
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
    // Cloud scorecards for recommended mode
    cloudScorecards,
    scorecards: localScorecards,
  } = store;

  const storeModels = useModelStore((s) => s.models);
  const builderFlags = useModelStore((s) => s.builderFlags);

  const [selectedScenario, setSelectedScenario] = useState("cloud-r1-restaurant");
  const [customPrompt, setCustomPrompt] = useState("");
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [showPastRuns, setShowPastRuns] = useState(false);

  // Available models: merge model store + completed trial scorecards
  // This ensures local models that completed trials appear even if not in model store
  const availableModels: AvailableModel[] = useMemo(() => {
    const seen = new Set<string>();
    const result: AvailableModel[] = [];

    // 1. Models from store with builder flags
    storeModels
      .filter((m) => builderFlags[m.id])
      .forEach((m) => {
        const key = `${m.provider}:${m.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            id: m.id,
            provider: m.provider,
            name: m.name,
            isLocal: m.provider === "ollama" || m.provider === "lmstudio",
          });
        }
      });

    // 2. Local scorecard models (from completed local trials)
    localScorecards.forEach((sc) => {
      const key = `ollama:${sc.modelId}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          id: sc.modelId,
          provider: "ollama",
          name: sc.modelId,
          isLocal: true,
        });
      }
    });

    // 3. Cloud scorecard models (from completed cloud trials)
    cloudScorecards.forEach((sc) => {
      // modelSize holds the provider for cloud scorecards
      const provider = sc.modelSize || "unknown";
      const key = `${provider}:${sc.modelId}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Try to get a friendly name from the model store
        const storeModel = storeModels.find((m) => m.id === sc.modelId && m.provider === provider);
        result.push({
          id: sc.modelId,
          provider,
          name: storeModel?.name || sc.modelId,
          isLocal: false,
        });
      }
    });

    return result;
  }, [storeModels, builderFlags, localScorecards, cloudScorecards]);

  const localModels = availableModels.filter((m) => m.isLocal);
  const cloudModels = availableModels.filter((m) => !m.isLocal);

  // ── Generate recommended chains ──
  const generateRecommended = useCallback(() => {
    // Gather scored models
    const allScorecards = [...localScorecards, ...cloudScorecards];
    const sorted = [...allScorecards].sort((a, b) => b.overallScore - a.overallScore);

    // Best local
    const bestLocal = sorted.find((s) => {
      const m = availableModels.find((am) => am.id === s.modelId);
      return m?.isLocal;
    });
    // Top cloud models
    const topCloud = sorted
      .filter((s) => {
        const m = availableModels.find((am) => am.id === s.modelId);
        return m && !m.isLocal;
      })
      .slice(0, 4);

    if (topCloud.length === 0) {
      // No cloud scores — use available cloud models as fallback
      const fallbackCloud = cloudModels.slice(0, 4);
      if (fallbackCloud.length === 0) return;

      const makeStep = (m: AvailableModel, role: string): HybridStep => ({
        modelId: m.id, provider: m.provider, modelName: m.name, role,
      });

      const scaffoldModel = bestLocal
        ? availableModels.find((m) => m.id === bestLocal.modelId)!
        : fallbackCloud[0];

      const chains: HybridChain[] = [
        {
          id: `rec-${Date.now()}-1`,
          name: `${scaffoldModel.name} → ${fallbackCloud[0].name}`,
          steps: [makeStep(scaffoldModel, "Scaffold"), makeStep(fallbackCloud[0], "Enhance")],
          prompt: "",
        },
      ];

      if (fallbackCloud.length >= 2) {
        chains.push({
          id: `rec-${Date.now()}-2`,
          name: `${scaffoldModel.name} → ${fallbackCloud[0].name} → ${fallbackCloud[1].name}`,
          steps: [makeStep(scaffoldModel, "Scaffold"), makeStep(fallbackCloud[0], "Enhance"), makeStep(fallbackCloud[1], "Refactor")],
          prompt: "",
        });
      }

      setHybridChains(chains);
      return;
    }

    const makeStep = (modelId: string, role: string): HybridStep => {
      const m = availableModels.find((am) => am.id === modelId);
      return {
        modelId,
        provider: m?.provider || "unknown",
        modelName: m?.name || modelId,
        role,
      };
    };

    const scaffoldId = bestLocal?.modelId || topCloud[0].modelId;
    const chains: HybridChain[] = [];

    // Chain 1: Scaffold → Best Cloud (2 steps)
    chains.push({
      id: `rec-${Date.now()}-1`,
      name: "Quick Pair",
      steps: [makeStep(scaffoldId, "Scaffold"), makeStep(topCloud[0].modelId, "Enhance")],
      prompt: "",
    });

    // Chain 2: Scaffold → Cloud A → Cloud B (3 steps)
    if (topCloud.length >= 2) {
      chains.push({
        id: `rec-${Date.now()}-2`,
        name: "Triple Chain",
        steps: [
          makeStep(scaffoldId, "Scaffold"),
          makeStep(topCloud[0].modelId, "Enhance"),
          makeStep(topCloud[1].modelId, "Refactor"),
        ],
        prompt: "",
      });
    }

    // Chain 3: Scaffold → Cloud B → Cloud A (reversed)
    if (topCloud.length >= 2) {
      chains.push({
        id: `rec-${Date.now()}-3`,
        name: "Reverse Triple",
        steps: [
          makeStep(scaffoldId, "Scaffold"),
          makeStep(topCloud[1].modelId, "Enhance"),
          makeStep(topCloud[0].modelId, "Finish"),
        ],
        prompt: "",
      });
    }

    // Chain 4: Full pipeline (4 steps)
    if (topCloud.length >= 3) {
      chains.push({
        id: `rec-${Date.now()}-4`,
        name: "Full Pipeline",
        steps: [
          makeStep(scaffoldId, "Scaffold"),
          makeStep(topCloud[2].modelId, "Enhance"),
          makeStep(topCloud[1].modelId, "Refactor"),
          makeStep(topCloud[0].modelId, "Finish"),
        ],
        prompt: "",
      });
    }

    // Chain 5: Cloud-only chain (best 3)
    if (topCloud.length >= 3) {
      chains.push({
        id: `rec-${Date.now()}-5`,
        name: "Cloud Elite",
        steps: [
          makeStep(topCloud[0].modelId, "Scaffold"),
          makeStep(topCloud[1].modelId, "Enhance"),
          makeStep(topCloud[2].modelId, "Finish"),
        ],
        prompt: "",
      });
    }

    setHybridChains(chains.slice(0, 5));
  }, [localScorecards, cloudScorecards, availableModels, cloudModels, setHybridChains]);

  // ── Add a new empty custom chain ──
  const addCustomChain = useCallback(() => {
    const defaultLocal = localModels[0];
    const defaultCloud = cloudModels[0];
    const chain: HybridChain = {
      id: `custom-${Date.now()}`,
      name: `Chain ${hybridChains.length + 1}`,
      steps: [
        {
          modelId: defaultLocal?.id || defaultCloud?.id || "",
          provider: defaultLocal?.provider || defaultCloud?.provider || "",
          modelName: defaultLocal?.name || defaultCloud?.name || "",
          role: "Scaffold",
        },
        {
          modelId: defaultCloud?.id || defaultLocal?.id || "",
          provider: defaultCloud?.provider || defaultLocal?.provider || "",
          modelName: defaultCloud?.name || defaultLocal?.name || "",
          role: "Enhance",
        },
      ],
      prompt: "",
    };
    setHybridChains([...hybridChains, chain]);
    setExpandedChain(chain.id);
  }, [hybridChains, localModels, cloudModels, setHybridChains]);

  // ── Update a chain ──
  const updateChain = (chainId: string, updates: Partial<HybridChain>) => {
    setHybridChains(
      hybridChains.map((c) => (c.id === chainId ? { ...c, ...updates } : c))
    );
  };

  const removeChain = (chainId: string) => {
    setHybridChains(hybridChains.filter((c) => c.id !== chainId));
  };

  const addStep = (chainId: string) => {
    const chain = hybridChains.find((c) => c.id === chainId);
    if (!chain || chain.steps.length >= 5) return;
    const defaultModel = cloudModels[0] || localModels[0];
    const roleIndex = chain.steps.length;
    updateChain(chainId, {
      steps: [
        ...chain.steps,
        {
          modelId: defaultModel?.id || "",
          provider: defaultModel?.provider || "",
          modelName: defaultModel?.name || "",
          role: DEFAULT_ROLES[roleIndex] || `Step ${roleIndex + 1}`,
        },
      ],
    });
  };

  const removeStep = (chainId: string, stepIndex: number) => {
    const chain = hybridChains.find((c) => c.id === chainId);
    if (!chain || chain.steps.length <= 2) return;
    updateChain(chainId, {
      steps: chain.steps.filter((_, i) => i !== stepIndex),
    });
  };

  const updateStep = (chainId: string, stepIndex: number, updates: Partial<HybridStep>) => {
    const chain = hybridChains.find((c) => c.id === chainId);
    if (!chain) return;
    const newSteps = [...chain.steps];
    newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };
    updateChain(chainId, { steps: newSteps });
  };

  // ── Start hybrid run ──
  const handleStart = useCallback(async () => {
    if (hybridChains.length === 0) return;

    const ctrl = new AbortController();
    hybridSetAbortController(ctrl);
    hybridStartRun();

    try {
      const config: HybridBenchmarkConfig = {
        chains: hybridChains.map((c) => ({
          ...c,
          prompt: customPrompt || c.prompt || "",
        })),
        scenarioId: selectedScenario,
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

            // Extract cost
            const costMatch = event.message?.match(/\$(\d+\.\d+)/);
            if (costMatch) {
              hybridSetTotalCost(parseFloat(costMatch[1]));
            }
          } catch {}
        }
      }
      // Auto-save completed results to pastRuns
      // Use setTimeout to let final hybridAddResult flush to store
      setTimeout(() => hybridSaveRun(), 100);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        hybridAddEvent({ type: "hybrid:stopped", message: "Hybrid Trials stopped.", timestamp: Date.now() });
        // Save partial results on abort too
        setTimeout(() => hybridSaveRun(), 100);
      }
    }
  }, [hybridChains, selectedScenario, customPrompt, hybridStartRun, hybridStopRun, hybridAddResult, hybridAddEvent, hybridSetAbortController, hybridSetTotalCost, hybridSaveRun]);

  // ── Find result for a chain ──
  const getChainResult = (chainId: string): HybridChainResult | undefined =>
    hybridResults.find((r) => r.chainId === chainId);

  // Current running state
  const currentEvent = hybridEvents.length > 0 ? hybridEvents[hybridEvents.length - 1] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Mode Toggle + Controls ── */}
      <div className="px-4 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#FF6700]" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">Hybrid Chains</span>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setHybridMode("recommended")}
              disabled={hybridRunning}
              className={`px-3 py-1 rounded-l-lg text-xs font-bold transition-all border ${
                hybridMode === "recommended"
                  ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                  : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Recommended
            </button>
            <button
              onClick={() => setHybridMode("custom")}
              disabled={hybridRunning}
              className={`px-3 py-1 rounded-r-lg text-xs font-bold transition-all border border-l-0 ${
                hybridMode === "custom"
                  ? "bg-[#FF6700]/15 border-[#FF6700]/50 text-[#FFD700]"
                  : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Wand2 className="w-3 h-3 inline mr-1" />
              Custom
            </button>
          </div>
        </div>

        {/* Scenario selector */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">Scenario:</span>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            disabled={hybridRunning}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-1 flex-1 max-w-[250px]"
          >
            {CLOUD_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.difficulty})
              </option>
            ))}
          </select>
        </div>

        {/* Custom prompt (optional override) */}
        <div className="mb-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Custom prompt (optional — overrides scenario prompt)"
            disabled={hybridRunning}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-1.5 placeholder-zinc-600"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hybridMode === "recommended" && (
            <button
              onClick={generateRecommended}
              disabled={hybridRunning}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#FF6700]/15 hover:bg-[#FF6700]/25 border border-[#FF6700]/40 text-[#FFD700] font-bold rounded text-xs transition-all disabled:opacity-30"
            >
              <Zap className="w-3 h-3" />
              Generate Chains
            </button>
          )}
          {hybridMode === "custom" && (
            <button
              onClick={addCustomChain}
              disabled={hybridRunning || hybridChains.length >= 10}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold rounded text-xs transition-all disabled:opacity-30"
            >
              <Plus className="w-3 h-3" />
              Add Chain
            </button>
          )}
          <button
            onClick={() => hybridReset()}
            disabled={hybridRunning}
            className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800 hover:bg-red-900/30 border border-zinc-700 hover:border-red-700 text-zinc-500 hover:text-red-300 font-bold rounded text-xs transition-all disabled:opacity-30"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Chain List + Results ── */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {hybridChains.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-bold">No chains configured</p>
            <p className="text-xs mt-1">
              {hybridMode === "recommended"
                ? "Click 'Generate Chains' to auto-create chains from trial results"
                : "Click 'Add Chain' to create a custom model chain"}
            </p>
          </div>
        )}

        {hybridChains.map((chain, ci) => {
          const result = getChainResult(chain.id);
          const isExpanded = expandedChain === chain.id;
          const isRunningChain = currentEvent?.chainId === chain.id && hybridRunning;

          return (
            <div
              key={chain.id}
              className={`border rounded-lg transition-all ${
                isRunningChain
                  ? "border-[#FF6700]/50 bg-[#FF6700]/5"
                  : result
                  ? "border-emerald-600/30 bg-emerald-900/5"
                  : "border-zinc-800 bg-zinc-900/40"
              }`}
            >
              {/* Chain header */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                onClick={() => setExpandedChain(isExpanded ? null : chain.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                )}

                <span className="text-xs font-bold text-white flex-shrink-0">
                  {ci + 1}.
                </span>

                {/* Chain name (editable in custom mode) */}
                {hybridMode === "custom" && !hybridRunning ? (
                  <input
                    type="text"
                    value={chain.name}
                    onChange={(e) => updateChain(chain.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none text-sm font-bold text-white outline-none flex-1 min-w-0"
                  />
                ) : (
                  <span className="text-sm font-bold text-white flex-1 min-w-0 truncate">
                    {chain.name}
                  </span>
                )}

                {/* Step pills */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {chain.steps.map((step, si) => (
                    <React.Fragment key={si}>
                      {si > 0 && <span className="text-zinc-700 text-[8px]">→</span>}
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                        style={{
                          borderColor: (PROVIDER_COLORS[step.provider] || "#6B7280") + "60",
                          color: PROVIDER_COLORS[step.provider] || "#6B7280",
                          backgroundColor: (PROVIDER_COLORS[step.provider] || "#6B7280") + "10",
                        }}
                      >
                        {step.modelName.length > 15 ? step.modelName.slice(0, 15) + "…" : step.modelName}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Status */}
                {isRunningChain && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" />
                )}
                {result && (
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${
                    result.finalScore.total >= 90 ? "text-emerald-400" :
                    result.finalScore.total >= 70 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {result.finalScore.total}/100
                  </span>
                )}

                {/* Remove chain button */}
                {hybridMode === "custom" && !hybridRunning && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeChain(chain.id); }}
                    className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Expanded: step details */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-zinc-800/50 pt-2 space-y-2">
                  {chain.steps.map((step, si) => {
                    const stepResult = result?.steps?.[si];
                    const isRunningStep = isRunningChain && currentEvent?.stepIndex === si;

                    return (
                      <div
                        key={si}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border ${
                          isRunningStep
                            ? "border-amber-500/30 bg-amber-900/10"
                            : stepResult
                            ? "border-zinc-700/50 bg-zinc-800/30"
                            : "border-zinc-800/30 bg-zinc-900/20"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-zinc-600 w-5 flex-shrink-0">
                          S{si + 1}
                        </span>

                        {/* Role (editable) */}
                        {hybridMode === "custom" && !hybridRunning ? (
                          <input
                            type="text"
                            value={step.role}
                            onChange={(e) => updateStep(chain.id, si, { role: e.target.value })}
                            className="bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 rounded px-1.5 py-0.5 w-20"
                          />
                        ) : (
                          <span className="text-xs font-bold text-zinc-400 w-20 truncate flex-shrink-0">
                            {step.role}
                          </span>
                        )}

                        <span className="text-zinc-700 text-xs">→</span>

                        {/* Model selector */}
                        {hybridMode === "custom" && !hybridRunning ? (
                          <select
                            value={`${step.provider}:${step.modelId}`}
                            onChange={(e) => {
                              const [provider, ...rest] = e.target.value.split(":");
                              const modelId = rest.join(":");
                              const m = availableModels.find((am) => am.id === modelId && am.provider === provider);
                              if (m) {
                                updateStep(chain.id, si, {
                                  modelId: m.id,
                                  provider: m.provider,
                                  modelName: m.name,
                                });
                              }
                            }}
                            className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 rounded px-1.5 py-0.5 flex-1 min-w-0"
                          >
                            {localModels.length > 0 && (
                              <optgroup label="LOCAL — $0.00">
                                {localModels.map((m) => (
                                  <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                                    [LOCAL] {m.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {cloudModels.length > 0 && (
                              <optgroup label="CLOUD — paid">
                                {cloudModels.map((m) => (
                                  <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                                    [CLOUD] {m.name} ({m.provider})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        ) : (
                          <span className="flex items-center gap-1 flex-1 min-w-0">
                            <span className={`text-[8px] font-bold px-1 py-px rounded ${
                              step.provider === "ollama" || step.provider === "lmstudio"
                                ? "bg-zinc-700 text-zinc-300"
                                : "bg-sky-900/40 text-sky-400"
                            }`}>
                              {step.provider === "ollama" || step.provider === "lmstudio" ? "LOCAL" : "CLOUD"}
                            </span>
                            <span
                              className="text-xs font-bold truncate"
                              style={{ color: PROVIDER_COLORS[step.provider] || "#9CA3AF" }}
                            >
                              {step.modelName}
                            </span>
                          </span>
                        )}

                        {/* Step score */}
                        {stepResult && (
                          <span className={`text-[10px] font-bold tabular-nums flex-shrink-0 ${
                            stepResult.score.total >= 90 ? "text-emerald-400" :
                            stepResult.score.total >= 70 ? "text-amber-400" : "text-red-400"
                          }`}>
                            {stepResult.score.total}/100
                          </span>
                        )}

                        {/* Step time + cost */}
                        {stepResult && (
                          <span className="text-[10px] text-zinc-500 tabular-nums flex-shrink-0">
                            {(stepResult.timeMs / 1000).toFixed(1)}s
                          </span>
                        )}
                        {stepResult && (
                          <span className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${
                            stepResult.cost === 0 ? "text-zinc-600" : "text-emerald-400"
                          }`}>
                            ${stepResult.cost.toFixed(4)}
                          </span>
                        )}
                        {/* Cost estimate for unfinished steps */}
                        {!stepResult && !isRunningStep && (
                          <span className={`text-[9px] font-mono flex-shrink-0 ${
                            step.provider === "ollama" || step.provider === "lmstudio"
                              ? "text-zinc-600" : "text-zinc-500"
                          }`}>
                            {step.provider === "ollama" || step.provider === "lmstudio" ? "$0.00" : "$$"}
                          </span>
                        )}

                        {isRunningStep && (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
                        )}

                        {/* Remove step */}
                        {hybridMode === "custom" && !hybridRunning && chain.steps.length > 2 && (
                          <button
                            onClick={() => removeStep(chain.id, si)}
                            className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add step button */}
                  {hybridMode === "custom" && !hybridRunning && chain.steps.length < 5 && (
                    <button
                      onClick={() => addStep(chain.id)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Step
                    </button>
                  )}

                  {/* Result summary */}
                  {result && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/50 flex items-center gap-3">
                      <span className="text-[10px] font-bold text-zinc-500">RESULT:</span>
                      <span className={`text-xs font-bold ${
                        result.finalScore.total >= 90 ? "text-emerald-400" :
                        result.finalScore.total >= 70 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {result.finalScore.total}/100
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {(result.totalTimeMs / 1000).toFixed(1)}s
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        ${result.totalCost.toFixed(4)}
                      </span>
                      {/* Score progression */}
                      <div className="flex items-center gap-1 ml-auto">
                        {result.steps.map((s, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-zinc-700 text-[8px]">→</span>}
                            <span className={`text-[9px] font-bold tabular-nums ${
                              s.score.total >= 90 ? "text-emerald-400" :
                              s.score.total >= 70 ? "text-amber-400" : "text-red-400"
                            }`}>
                              {s.score.total}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Saved Trial Data (Past Runs) ── */}
      {hybridPastRuns.length > 0 && (
        <div className="border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={() => setShowPastRuns(!showPastRuns)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-zinc-800/40 transition-colors"
          >
            {showPastRuns ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            )}
            <Archive className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-zinc-300">Saved Trial Data</span>
            <span className="text-[10px] text-zinc-500 tabular-nums">{hybridPastRuns.length} run{hybridPastRuns.length !== 1 ? "s" : ""}</span>
            <div className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); hybridClearPastRuns(); setShowPastRuns(false); }}
              className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-1"
            >
              Clear All
            </button>
          </button>
          {showPastRuns && (
            <div className="px-3 pb-3 space-y-1.5 max-h-64 overflow-y-auto">
              {hybridPastRuns.map((run, ri) => {
                const grade = getLetterGrade(run.finalScore.total);
                const gradeColor = getGradeColor(grade);
                const date = new Date(run.timestamp);
                const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                const stepModels = run.steps.map((s) => s.modelId).join(" → ");

                return (
                  <div
                    key={`${run.chainId}-${run.timestamp}-${ri}`}
                    className="border border-zinc-800 rounded-lg px-3 py-2 bg-zinc-900/60 hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-[900] ${gradeColor} min-w-[28px]`}>{grade}</span>
                      <span className="text-xs font-bold text-white truncate flex-1">{run.chainName}</span>
                      <span className={`text-xs font-bold tabular-nums ${
                        run.finalScore.total >= 90 ? "text-emerald-400" :
                        run.finalScore.total >= 70 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {run.finalScore.total}/100
                      </span>
                      <span className="text-[10px] text-zinc-500 tabular-nums flex-shrink-0">{dateStr}</span>
                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `hybrid-trial-${run.chainName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-zinc-600 hover:text-indigo-400 transition-colors flex-shrink-0"
                        title="Export as JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Step scores row */}
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="text-[9px] text-zinc-600 mr-1">Steps:</span>
                      {run.steps.map((s, si) => (
                        <React.Fragment key={si}>
                          {si > 0 && <span className="text-zinc-700 text-[8px]">→</span>}
                          <span
                            className="text-[9px] font-bold px-1 py-px rounded border"
                            style={{
                              borderColor: (PROVIDER_COLORS[s.provider] || "#6B7280") + "40",
                              color: s.score.total >= 90 ? "#34D399" : s.score.total >= 70 ? "#FBBF24" : "#F87171",
                              backgroundColor: (PROVIDER_COLORS[s.provider] || "#6B7280") + "10",
                            }}
                            title={`${s.modelId} (${s.role}) — ${s.score.total}/100`}
                          >
                            {s.score.total}
                          </span>
                        </React.Fragment>
                      ))}
                      <span className="text-[10px] text-zinc-500 ml-auto tabular-nums">
                        {(run.totalTimeMs / 1000).toFixed(1)}s
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 tabular-nums">
                        ${run.totalCost.toFixed(4)}
                      </span>
                    </div>
                    {/* Model chain */}
                    <div className="text-[9px] text-zinc-600 mt-1 font-mono truncate" title={stepModels}>
                      {stepModels}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom status bar ── */}
      <div className="flex items-center h-8 px-3 border-t border-zinc-800 bg-zinc-900/60 flex-shrink-0 gap-3">
        {hybridRunning && currentEvent && (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
            <span className="text-[10px] text-zinc-400 truncate flex-1">
              {currentEvent.message}
            </span>
          </>
        )}
        {!hybridRunning && hybridResults.length > 0 && (
          <span className="text-[10px] font-bold text-emerald-400">
            {hybridResults.length} chain{hybridResults.length !== 1 ? "s" : ""} complete
          </span>
        )}
        {hybridTotalCost > 0 && (
          <span className="text-[10px] font-mono font-bold text-emerald-400 ml-auto">
            ${hybridTotalCost.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
