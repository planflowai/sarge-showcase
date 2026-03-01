"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Zap, Globe, ChevronDown, X } from "lucide-react";
import { useModelStore, useAIModeStore, fetchOllamaModels, fetchLMStudioModels, providers, groupOllamaModels, cn } from "@sarge/core";
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
  const [showModelPanel, setShowModelPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Fetch local models when ollama or lmstudio is selected
  useEffect(() => {
    if (selectedProvider !== "ollama" && selectedProvider !== "lmstudio") return;
    setOllamaLoading(true);
    setOllamaError(null);
    const fetchFn = selectedProvider === "lmstudio" ? fetchLMStudioModels : fetchOllamaModels;
    fetchFn()
      .then((models) => {
        setOllamaModels(models);
        if (!selectedModel && models.length > 0) {
          onModelSelect(models[0].id, selectedProvider);
        }
      })
      .catch(() => {
        setOllamaModels([]);
        setOllamaError(selectedProvider === "lmstudio" ? "LM Studio not running" : "Ollama not running");
      })
      .finally(() => setOllamaLoading(false));
  }, [selectedProvider, isBuilderModel, selectedModel, onModelSelect]);

  // Close panel on click outside
  useEffect(() => {
    if (!showModelPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowModelPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModelPanel]);

  // Provider lists
  const cloudProviderIds = new Set(["anthropic", "openai", "google", "xai", "deepseek"]);
  const localProviderIds = new Set(["ollama", "lmstudio"]);
  const allProviders = providers.filter((p) => cloudProviderIds.has(p.id) || localProviderIds.has(p.id));
  const cloudProviders = allProviders.filter((p) => p.type === "cloud");
  const localProviders = allProviders.filter((p) => p.type === "local");

  // Models for current provider
  const isLocalProvider = selectedProvider === "ollama" || selectedProvider === "lmstudio";
  const currentProviderModels = useMemo(() => {
    if (!hydrated) return [];
    if (isLocalProvider) {
      return ollamaModels;
    }
    return getEffectiveModels(selectedProvider).filter((m) => isBuilderModel(m.id, selectedProvider));
  }, [hydrated, selectedProvider, isLocalProvider, ollamaModels, isBuilderModel, getEffectiveModels]);

  const handleProviderSelect = (providerId: string) => {
    if (providerId === "ollama" || providerId === "lmstudio") {
      if (ollamaModels.length > 0) {
        onModelSelect(ollamaModels[0].id, providerId);
      } else {
        onModelSelect("", providerId);
      }
    } else {
      const bm = getEffectiveModels(providerId).filter((m) => isBuilderModel(m.id));
      if (bm.length > 0) onModelSelect(bm[0].id, providerId);
    }
    setShowModelPanel(true);
  };

  const currentProviderConfig = providers.find((p) => p.id === selectedProvider);
  const providerColor = currentProviderConfig?.color || "#8b5cf6";

  // Display model name
  const displayModelName = selectedModel
    ? getDisplayName(selectedModel, selectedModel)
    : "Select model";

  return (
    <div className="flex-shrink-0 relative border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70">
      {/* Provider pills row */}
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto">
        {/* Cloud providers */}
        {cloudProviders.map((p) => {
          const isActive = selectedProvider === p.id;
          const pColor = p.color || "#8b5cf6";
          return (
            <button
              key={p.id}
              onClick={() => handleProviderSelect(p.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap border",
                isActive
                  ? "border-current"
                  : "border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
              )}
              style={isActive ? {
                color: pColor,
                backgroundColor: `${pColor}15`,
                borderColor: `${pColor}60`,
              } : undefined}
            >
              {p.name}
            </button>
          );
        })}

        {/* Separator */}
        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />

        {/* Local providers */}
        {localProviders.map((p) => {
          const isActive = selectedProvider === p.id;
          const pColor = p.color || "#10b981";
          return (
            <button
              key={p.id}
              onClick={() => handleProviderSelect(p.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap border",
                isActive
                  ? "border-current"
                  : "border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
              )}
              style={isActive ? {
                color: pColor,
                backgroundColor: `${pColor}15`,
                borderColor: `${pColor}60`,
              } : undefined}
            >
              {p.name}
            </button>
          );
        })}

        {/* Spacer to push model selector right */}
        <div className="flex-1" />
      </div>

      {/* Model selector row — click to open model panel */}
      <div className="flex items-center gap-1.5 px-2 pb-1.5">
        <button
          onClick={() => setShowModelPanel(!showModelPanel)}
          className="flex-1 flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-indigo-500 transition-colors min-w-0"
        >
          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {ollamaLoading ? "Loading..." : ollamaError ? ollamaError : displayModelName}
          </span>
          <ChevronDown className={cn(
            "h-3 w-3 text-zinc-400 transition-transform flex-shrink-0",
            showModelPanel && "rotate-180"
          )} />
        </button>

        {/* Web Search toggle */}
        {onWebSearchToggle && (
          <button
            onClick={onWebSearchToggle}
            title={webSearch ? "Web search ON" : "Web search OFF"}
            className={cn(
              "flex-shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-medium border transition-all",
              webSearch
                ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
                : "bg-transparent border-zinc-700 text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Globe className="h-2.5 w-2.5" />
            Web
          </button>
        )}
      </div>

      {/* Model panel dropdown */}
      {showModelPanel && (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 top-full z-50 bg-zinc-900 border border-zinc-700 rounded-b-lg shadow-2xl max-h-[300px] overflow-y-auto"
        >
          {/* Close button */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {currentProviderConfig?.name} Models
            </span>
            <button onClick={() => setShowModelPanel(false)} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Model cards */}
          <div className="p-2 grid grid-cols-2 gap-1.5">
            {isLocalProvider ? (
              ollamaLoading ? (
                <span className="col-span-2 text-center text-[10px] text-zinc-500 py-4">Loading models...</span>
              ) : currentProviderModels.length === 0 ? (
                <span className="col-span-2 text-center text-[10px] text-zinc-500 py-4">
                  No models available — <Link href="/settings" className="text-indigo-400 hover:underline">Settings</Link>
                </span>
              ) : (
                groupOllamaModels(currentProviderModels.map((m) => m.id)).flatMap((group) =>
                  group.models.map((model) => {
                    const isSelected = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        onClick={() => { onModelSelect(model.id, selectedProvider); setShowModelPanel(false); }}
                        className={cn(
                          "text-left px-2.5 py-2 rounded-lg border transition-all text-[11px]",
                          isSelected
                            ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                            : "border-zinc-800 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                        )}
                      >
                        <div className="font-medium truncate">{getDisplayName(model.id, model.name)}</div>
                        {model.hint && <div className="text-[9px] text-zinc-500 truncate mt-0.5">{model.hint}</div>}
                      </button>
                    );
                  })
                )
              )
            ) : currentProviderModels.length === 0 ? (
              <span className="col-span-2 text-center text-[10px] text-zinc-500 py-4">
                No builder models — <Link href="/settings" className="text-indigo-400 hover:underline">Tag in Settings</Link>
              </span>
            ) : (
              currentProviderModels.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => { onModelSelect(model.id, selectedProvider); setShowModelPanel(false); }}
                    className={cn(
                      "text-left px-2.5 py-2 rounded-lg border transition-all text-[11px]",
                      isSelected
                        ? "border-current bg-opacity-10"
                        : "border-zinc-800 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    )}
                    style={isSelected ? {
                      borderColor: `${providerColor}60`,
                      color: providerColor,
                      backgroundColor: `${providerColor}15`,
                    } : undefined}
                  >
                    <div className="font-medium truncate">{getDisplayName(model.id, model.name)}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
