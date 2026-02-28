"use client";

import { useState, useEffect, useMemo } from "react";
import { Zap, Globe } from "lucide-react";
import { useModelStore, useAIModeStore, fetchOllamaModels, providers, groupOllamaModels, cn } from "@sarge/core";
import type { LocalModel } from "@sarge/core";
import Link from "next/link";

interface BuilderModelBarProps {
  selectedModel: string | null;
  selectedProvider: string;
  onModelSelect: (modelId: string, provider: string) => void;
  webSearch?: boolean;
  onWebSearchToggle?: () => void;
}

export default function BuilderModelBar({
  selectedModel,
  selectedProvider,
  onModelSelect,
  webSearch = false,
  onWebSearchToggle,
}: BuilderModelBarProps) {
  const { hydrated, hydrate, isBuilderModel, getDisplayName, getEffectiveModels } = useModelStore();
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const aiModeDisplayName = useAIModeStore((s) => s.getDisplayName);
  const executionMode = useAIModeStore((s) => s.executionMode);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Auto-select first builder model for cloud providers on initial load
  useEffect(() => {
    if (!hydrated || selectedProvider === "ollama" || selectedModel) return;
    const allModels = getEffectiveModels(selectedProvider);
    const builderModels = allModels.filter((m) => isBuilderModel(m.id, selectedProvider));
    if (builderModels.length > 0) onModelSelect(builderModels[0].id, selectedProvider);
  }, [hydrated, selectedProvider, selectedModel, getEffectiveModels, isBuilderModel, onModelSelect]);

  // Fetch Ollama models when ollama is selected
  useEffect(() => {
    if (selectedProvider !== "ollama") return;
    setOllamaLoading(true);
    setOllamaError(null);
    fetchOllamaModels()
      .then((models) => {
        setOllamaModels(models);
        if (!selectedModel && models.length > 0) {
          const builderModels = models.filter((m) => isBuilderModel(m.id, "ollama"));
          if (builderModels.length > 0) onModelSelect(builderModels[0].id, "ollama");
        }
      })
      .catch(() => {
        setOllamaModels([]);
        setOllamaError("Ollama not running");
      })
      .finally(() => setOllamaLoading(false));
  }, [selectedProvider, isBuilderModel, selectedModel, onModelSelect]);

  // Provider lists
  const cloudProviderIds = new Set(["anthropic", "openai", "google", "xai", "deepseek"]);
  const allProviders = providers.filter((p) => cloudProviderIds.has(p.id) || p.id === "ollama");
  const cloudProviders = allProviders.filter((p) => p.type === "cloud");
  const localProviders = allProviders.filter((p) => p.type === "local");

  // Models for current provider
  const currentProviderModels = useMemo(() => {
    if (!hydrated) return [];
    if (selectedProvider === "ollama") {
      return ollamaModels.filter((m) => isBuilderModel(m.id, "ollama"));
    }
    return getEffectiveModels(selectedProvider).filter((m) => isBuilderModel(m.id, selectedProvider));
  }, [hydrated, selectedProvider, ollamaModels, isBuilderModel, getEffectiveModels]);

  const handleProviderSelect = (providerId: string) => {
    if (providerId === "ollama") {
      const bm = ollamaModels.filter((m) => isBuilderModel(m.id));
      onModelSelect(bm.length > 0 ? bm[0].id : "", providerId);
    } else {
      const bm = getEffectiveModels(providerId).filter((m) => isBuilderModel(m.id));
      if (bm.length > 0) onModelSelect(bm[0].id, providerId);
    }
  };

  return (
    <div className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70">
      {/* Cloud provider */}
      <select
        value={cloudProviders.some((p) => p.id === selectedProvider) ? selectedProvider : ""}
        onChange={(e) => handleProviderSelect(e.target.value)}
        className="w-24 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
        title="Cloud Provider"
      >
        <option value="" disabled>Cloud…</option>
        {cloudProviders.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Local provider */}
      <select
        value={localProviders.some((p) => p.id === selectedProvider) ? selectedProvider : ""}
        onChange={(e) => handleProviderSelect(e.target.value)}
        className="w-20 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
        title="Local Provider"
      >
        <option value="" disabled>Local…</option>
        {localProviders.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Model dropdown */}
      <div className="w-40 min-w-0">
        {selectedProvider === "ollama" ? (
          ollamaLoading ? (
            <span className="text-[10px] text-zinc-500">Loading…</span>
          ) : ollamaError ? (
            <span className="text-[10px] text-red-400">{ollamaError}</span>
          ) : currentProviderModels.length === 0 ? (
            <span className="text-[10px] text-zinc-500">
              No models —{" "}
              <Link href="/settings" className="text-indigo-500 hover:underline">Settings</Link>
            </span>
          ) : (
            <select
              value={selectedModel || ""}
              onChange={(e) => onModelSelect(e.target.value, selectedProvider)}
              className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
            >
              <option value="" disabled>Model…</option>
              {groupOllamaModels(currentProviderModels.map((m) => m.id)).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {getDisplayName(model.id, model.name)}{model.hint ? ` · ${model.hint}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )
        ) : currentProviderModels.length === 0 ? (
          <span className="text-[10px] text-zinc-500">
            No models —{" "}
            <Link href="/settings" className="text-indigo-500 hover:underline">Settings</Link>
          </span>
        ) : (
          <select
            value={selectedModel || ""}
            onChange={(e) => onModelSelect(e.target.value, selectedProvider)}
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="" disabled>Model…</option>
            {currentProviderModels.map((model) => (
              <option key={model.id} value={model.id}>
                {getDisplayName(model.id, model.name)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* AI Mode badge */}
      <Link
        href="/settings"
        className={cn(
          "flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all hover:ring-1 hover:ring-zinc-500",
          executionMode === "local" && "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400",
          executionMode === "cloud" && "bg-violet-500/20 text-violet-500 dark:text-violet-400",
          executionMode === "hybrid" && "bg-amber-500/20 text-amber-500 dark:text-amber-400"
        )}
        title="AI Orchestration Mode"
      >
        <Zap className="h-2.5 w-2.5" />
        {aiModeDisplayName()}
      </Link>

      {/* Web Search toggle */}
      {onWebSearchToggle && (
        <button
          onClick={onWebSearchToggle}
          title={webSearch ? "Web search ON — click to disable" : "Web search OFF — click to enable (requires TAVILY_API_KEY)"}
          className={cn(
            "flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border transition-all",
            webSearch
              ? "bg-sky-500/20 border-sky-500/40 text-sky-400 hover:bg-sky-500/30"
              : "bg-transparent border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
          )}
        >
          <Globe className="h-2.5 w-2.5" />
          Web
        </button>
      )}
    </div>
  );
}
