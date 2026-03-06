"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Zap, Globe, ChevronDown, X, RefreshCw, ImageIcon } from "lucide-react";
import { useModelStore, useAIModeStore, useCustomProviderStore, fetchOllamaModels, fetchLMStudioModels, providers, groupOllamaModels, cn } from "@sarge/core";
import type { LocalModel } from "@sarge/core";
import Link from "next/link";

// Brand colors per provider
const PROVIDER_BRAND_COLORS: Record<string, string> = {
  anthropic: "#D97706",
  openai: "#10B981",
  google: "#3B82F6",
  xai: "#8B5CF6",
  deepseek: "#06B6D4",
  mistral: "#F97316",
  groq: "#EF4444",
  together: "#EC4899",
  perplexity: "#6366F1",
  huggingface: "#FF9D00",
  ollama: "#6B7280",
  lmstudio: "#6B7280",
};

interface BuilderModelBarProps {
  selectedModel: string | null;
  selectedProvider: string;
  onModelSelect: (modelId: string, provider: string) => void;
  webSearch?: boolean;
  onWebSearchToggle?: () => void;
  autoImages?: boolean;
  onAutoImagesToggle?: () => void;
}

export default function BuilderModelBar({
  selectedModel,
  selectedProvider,
  onModelSelect,
  webSearch = false,
  onWebSearchToggle,
  autoImages = true,
  onAutoImagesToggle,
}: BuilderModelBarProps) {
  const { hydrated, hydrate, isBuilderModel, getDisplayName, getEffectiveModels, verifyModel: verifyModelFn, verifyAllCloudModels } = useModelStore();
  const allStoreModels = useModelStore((s) => s.models);
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const aiModeDisplayName = useAIModeStore((s) => s.getDisplayName);
  const executionMode = useAIModeStore((s) => s.executionMode);
  const [showModelPanel, setShowModelPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [verifying, setVerifying] = useState(false);

  const isLocalProvider = selectedProvider === "ollama" || selectedProvider === "lmstudio";

  // Status dot for current selected model
  const currentModelStatus = useMemo(() => {
    if (!selectedModel || isLocalProvider) return null;
    const m = allStoreModels.find(m => m.id === selectedModel && m.provider === selectedProvider);
    return m?.status || null;
  }, [selectedModel, selectedProvider, isLocalProvider, allStoreModels]);

  const statusDotColor = currentModelStatus === "active" ? "#10B981"
    : currentModelStatus === "error" ? "#EF4444"
    : currentModelStatus === "unchecked" ? "#F59E0B"
    : "#6B7280";

  const handleVerifyAll = useCallback(async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      await verifyAllCloudModels();
    } finally {
      setVerifying(false);
    }
  }, [verifying, verifyAllCloudModels]);

  const getModelStatus = useCallback((modelId: string, providerId: string) => {
    const m = allStoreModels.find(m => m.id === modelId && m.provider === providerId);
    return m?.status || null;
  }, [allStoreModels]);

  const statusDotFor = useCallback((status: string | null) => {
    if (status === "active") return "#10B981";
    if (status === "error") return "#EF4444";
    if (status === "unchecked") return "#F59E0B";
    return "#6B7280";
  }, []);

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

  // Provider lists — merge custom providers with built-in
  const customProviders = useCustomProviderStore((s) => s.providers);
  const builtInCloud = providers.filter((p) => p.type === "cloud");
  const localProviders = providers.filter((p) => p.type === "local");
  const cloudProviders = useMemo(() => {
    const custom = customProviders.map((cp) => ({
      id: cp.id,
      name: cp.name,
      type: "cloud" as const,
      color: cp.color,
      isEnabled: true,
      supportsVoice: false,
      models: [],
    }));
    return [...builtInCloud, ...custom];
  }, [builtInCloud, customProviders]);

  // Models for current provider
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

  const currentProviderConfig = cloudProviders.find((p) => p.id === selectedProvider) || localProviders.find((p) => p.id === selectedProvider);
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
        {cloudProviders.map((p, index) => {
          const isActive = selectedProvider === p.id;
          const brandColor = PROVIDER_BRAND_COLORS[p.id] || p.color || "#8b5cf6";
          return (
            <button
              key={p.id + '-' + index}
              onClick={() => handleProviderSelect(p.id)}
              className={cn(
                "px-3 py-2 rounded-md text-[13px] font-bold transition-all whitespace-nowrap border",
                isActive
                  ? "border-current"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
              )}
              style={isActive ? {
                minHeight: '36px',
                color: brandColor,
                backgroundColor: `${brandColor}15`,
                borderColor: brandColor,
              } : { minHeight: '36px' }}
              title={p.name}
            >
              {p.name}
            </button>
          );
        })}

        {/* Separator */}
        <div className="w-px h-6 bg-zinc-600 mx-1" />

        {/* Local providers */}
        {localProviders.map((p) => {
          const isActive = selectedProvider === p.id;
          const brandColor = PROVIDER_BRAND_COLORS[p.id] || "#6B7280";
          return (
            <button
              key={p.id}
              onClick={() => handleProviderSelect(p.id)}
              className={cn(
                "px-3 py-2 rounded-md text-[13px] font-bold transition-all whitespace-nowrap border",
                isActive
                  ? "border-current"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
              )}
              style={isActive ? {
                minHeight: '36px',
                color: brandColor,
                backgroundColor: `${brandColor}15`,
                borderColor: brandColor,
              } : { minHeight: '36px' }}
              title={p.name}
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
        {/* Status dot for current model */}
        {!isLocalProvider && selectedModel && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusDotColor }}
            title={currentModelStatus === "active" ? "Verified — online"
              : currentModelStatus === "error" ? "Error — failed verification"
              : currentModelStatus === "unchecked" ? "Checking..."
              : "Not verified"}
          />
        )}
        <button
          onClick={() => setShowModelPanel(!showModelPanel)}
          className="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-zinc-600 bg-zinc-800 hover:border-[#FF6700]/50 transition-colors min-w-0"
          style={{ minHeight: '40px' }}
        >
          <span className="text-sm font-bold text-white truncate">
            {ollamaLoading ? "Loading..." : ollamaError ? ollamaError : displayModelName}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-[#FF6700] transition-transform flex-shrink-0",
            showModelPanel && "rotate-180"
          )} />
        </button>

        {/* Web Search toggle */}
        {onWebSearchToggle && (
          <button
            onClick={onWebSearchToggle}
            title={webSearch ? "Web search ON" : "Web search OFF"}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[13px] font-bold border transition-all",
              webSearch
                ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
                : "bg-transparent border-zinc-700 text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            Web
          </button>
        )}

        {/* Auto Images toggle */}
        {onAutoImagesToggle && (
          <button
            onClick={onAutoImagesToggle}
            title={autoImages ? "Auto images ON — searches stock photos before builds" : "Auto images OFF"}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[13px] font-bold border transition-all",
              autoImages
                ? "bg-violet-500/20 border-violet-500/40 text-violet-400"
                : "bg-transparent border-zinc-700 text-zinc-500 hover:text-zinc-300"
            )}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Images
          </button>
        )}
      </div>

      {/* Model panel dropdown */}
      {showModelPanel && (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 top-full z-50 bg-zinc-900 border border-zinc-700 rounded-b-lg shadow-2xl max-h-[300px] overflow-y-auto"
        >
          {/* Header with verify + close */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {currentProviderConfig?.name} Models
            </span>
            <div className="flex items-center gap-1.5">
              {!isLocalProvider && (
                <button
                  onClick={handleVerifyAll}
                  disabled={verifying}
                  title={verifying ? "Verifying all..." : "Verify all cloud models"}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn("h-2.5 w-2.5", verifying && "animate-spin")} />
                  {verifying ? "Checking..." : "Verify All"}
                </button>
              )}
              <button onClick={() => setShowModelPanel(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-3 w-3" />
              </button>
            </div>
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
                const mStatus = getModelStatus(model.id, selectedProvider);
                const dotColor = statusDotFor(mStatus);
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
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dotColor }}
                        title={mStatus === "active" ? "Online" : mStatus === "error" ? "Failed" : mStatus === "unchecked" ? "Checking..." : "Not verified"}
                      />
                      <span className="font-medium truncate">{getDisplayName(model.id, model.name)}</span>
                    </div>
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
