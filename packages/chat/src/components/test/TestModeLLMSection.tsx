"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useUIStore } from "@sarge/core";
import { useTestModeStore } from "@sarge/core";
import { useModelRegistryStore, type SargePool } from "@sarge/core";
import { providers } from "@sarge/core";
import { fetchOllamaModels, fetchLMStudioModels } from "@sarge/core";
import { Button } from "@/components/ui/button";
import type { Provider } from "@sarge/core";

const SLOT_LABELS = ['D1', 'D2', 'D3', 'Judge'];
const SLOT_POOLS: SargePool[] = ['d1', 'd2', 'd3', 'judge'];

export function TestModeLLMSection() {
  const collapsed = useUIStore((s) => s.testModeLLMSectionCollapsed);
  const setCollapsed = useUIStore((s) => s.setTestModeLLMSectionCollapsed);
  const isRunning = useTestModeStore((s) => s.isRunning);
  const testAgentMode = useTestModeStore((s) => s.testAgentMode);

  const slots = useTestModeStore((s) => s.slots);
  const updateSlot = useTestModeStore((s) => s.updateSlot);

  const {
    registry,
    hydrated: registryHydrated,
    hydrate: hydrateRegistry,
    getModelsForPool,
    registerModels
  } = useModelRegistryStore();

  const [ollamaModels, setOllamaModels] = useState<any[]>([]);
  const [lmstudioModels, setLmstudioModels] = useState<any[]>([]);
  const [useRegistry, setUseRegistry] = useState(false);  // Off by default — shows all models. Turn on to filter by pool assignment.

  // Hydrate stores on mount
  useEffect(() => {
    if (!registryHydrated) hydrateRegistry();
  }, [registryHydrated, hydrateRegistry]);

  // Fetch Ollama models and register them
  useEffect(() => {
    fetchOllamaModels()
      .then(models => {
        setOllamaModels(models);
        if (models.length > 0) {
          registerModels(models.map(m => ({
            id: m.id,
            name: m.name,
            provider: 'ollama',
            category: 'code',
            enabled: true,
            strength: 'medium',
            pools: [],
          })));
        }
      })
      .catch(err => {
        console.warn('Ollama offline or unavailable:', err);
        setOllamaModels([]);
      });
  }, [registerModels]);

  // Fetch LM Studio models and register them
  useEffect(() => {
    fetchLMStudioModels()
      .then(models => {
        setLmstudioModels(models);
        if (models.length > 0) {
          registerModels(models.map(m => ({
            id: m.id,
            name: m.name,
            provider: 'lmstudio',
            category: 'code',
            enabled: true,
            strength: 'medium',
            pools: [],
          })));
        }
      })
      .catch(err => {
        console.warn('LM Studio offline or unavailable:', err);
        setLmstudioModels([]);
      });
  }, [registerModels]);

  const handleProviderChange = (index: number, providerId: string) => {
    const prov = providers.find(p => p.id === providerId);
    const isLocal = prov?.type === "local";
    let defaultModel = "";
    if (isLocal) {
      defaultModel = providerId === 'lmstudio'
        ? (lmstudioModels[0]?.id ?? "")
        : (ollamaModels[0]?.id ?? "");
    } else {
      defaultModel = prov?.models[0]?.id ?? "";
    }

    updateSlot(index, {
      provider: providerId as Provider,
      model: defaultModel,
    });
  };

  if (collapsed) {
    return (
      <div className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(false)}
          className="w-full h-6 text-[10px] gap-1 justify-between"
        >
          <span className="text-zinc-500">LLM Config</span>
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 px-3 py-2 space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          LLM Config
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUseRegistry(!useRegistry)}
            className={`h-5 px-1.5 text-[10px] gap-1 ${useRegistry ? 'text-green-400' : 'text-zinc-500'}`}
            title={useRegistry ? "Registry filter ON - showing only pool-assigned models" : "Registry filter OFF - showing all models"}
          >
            {useRegistry ? '✓' : '○'} Filter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(true)}
            className="h-5 w-5 p-0"
          >
            <ChevronUp className="h-3 w-3 text-zinc-500" />
          </Button>
        </div>
      </div>

      {/* Compact grid - show D1/D2 always, D3 for 3/3j, Judge for 2j/3j */}
      <div className={`grid gap-1.5 ${
        testAgentMode === '2j' ? 'grid-cols-3' :
        testAgentMode === '3j' ? 'grid-cols-4' :
        testAgentMode === '3' ? 'grid-cols-3' :
        'grid-cols-2'
      }`}>
        {slots.map((slot, idx) => {
          // Skip slots not needed for current agent mode
          if (idx === 2 && !['3', '3j'].includes(testAgentMode)) return null; // Skip D3 unless 3 or 3j
          if (idx === 3 && !['2j', '3j'].includes(testAgentMode)) return null; // Skip Judge unless 2j or 3j

          const isJudge = idx === 3;
          const pool = SLOT_POOLS[idx];
          const prov = providers.find(p => p.id === slot.provider);
          const isLocal = prov?.type === "local";

          // Get models - for local providers, show Ollama + registered local models
          let availableModels: any[] = [];
          const registryModelsForPool = getModelsForPool(pool);
          const hasRegistryData = Object.keys(registry).length > 0;

          if (isLocal) {
            // Show models for the specific local provider selected
            const isLMStudio = slot.provider === 'lmstudio';
            const baseModels = isLMStudio ? [...lmstudioModels] : [...ollamaModels];
            const providerKey = isLMStudio ? 'lmstudio' : 'ollama';
            const localModelsFromRegistry = Object.values(registry).filter(m => m.provider === providerKey);
            // Add any registered local models not already in base list
            for (const m of localModelsFromRegistry) {
              if (!baseModels.find(om => om.id === m.id)) {
                baseModels.push({ id: m.id, name: m.name ?? m.id });
              }
            }
            availableModels = baseModels;
          } else {
            // Show cloud provider models
            availableModels = prov?.models ?? [];
          }

          // Filter by registry pool if enabled (only for cloud providers)
          if (!isLocal && useRegistry && hasRegistryData) {
            const poolModelIds = new Set(registryModelsForPool.map(m => m.id));
            availableModels = availableModels.filter(m => poolModelIds.has(m.id));
          }

          // Check if current model is excluded from this pool
          const currentModelEntry = registry[slot.model];
          const isCurrentExcluded = currentModelEntry && !currentModelEntry.pools.includes(pool);

          return (
            <div key={idx} className={`rounded border ${isCurrentExcluded ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'} p-1.5`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                  {SLOT_LABELS[idx]}
                </span>
                {isCurrentExcluded && (
                  <span title="Model not recommended for this pool">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  </span>
                )}
              </div>

              {/* Provider + Model inline */}
              <div className="flex gap-1">
                <select
                  value={slot.provider ?? ""}
                  onChange={(e) => handleProviderChange(idx, e.target.value)}
                  disabled={isRunning}
                  className="flex-1 min-w-0 h-6 px-1 text-[10px] rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 disabled:opacity-50 text-zinc-900 dark:text-zinc-100"
                  title="Provider"
                >
                  <option value="">Provider</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {slot.provider && (
                  <select
                    value={slot.model}
                    onChange={(e) => updateSlot(idx, { model: e.target.value })}
                    disabled={isRunning}
                    className="flex-1 min-w-0 h-6 px-1 text-[10px] rounded border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 disabled:opacity-50 text-zinc-900 dark:text-zinc-100"
                    title="Model"
                  >
                    {availableModels.length === 0 && <option>No models</option>}
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name ?? m.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
