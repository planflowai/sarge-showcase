"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search } from "lucide-react";
import { providers } from "@sarge/core";
import { useModelStore } from "@sarge/core";
import { fetchOllamaModels, fetchLMStudioModels, getOllamaFriendlyName, getOllamaHint } from "@sarge/core";
import type { LocalModel, Provider } from "@sarge/core";
import { cn } from "@sarge/core";

function deriveTag(modelId: string): string {
  const id = modelId.toLowerCase();
  if (/\bo[34]\b|reasoner|\br1[:\b]/.test(id)) return "reasoning";
  if (/code|coder/.test(id)) return "coder";
  if (/haiku|mini|flash|fast|\b[1-4]b\b|nano|tiny|small/.test(id)) return "fast";
  if (/opus|gpt-4\.1(?!.*mini)|grok-4(?!.*(fast|code))/.test(id)) return "heavy";
  if (/sonnet|4o|pro|chat|medium|2\.5/.test(id)) return "balanced";
  return "general";
}

function getLocalModelSize(modelId: string): string | null {
  const match = modelId.match(/[:\-](\d+\.?\d*)b/i);
  return match ? `${match[1]}B` : null;
}

const TAG_STYLES: Record<string, string> = {
  fast: "text-emerald-400 bg-emerald-500/10",
  balanced: "text-blue-400 bg-blue-500/10",
  heavy: "text-purple-400 bg-purple-500/10",
  reasoning: "text-amber-400 bg-amber-500/10",
  coder: "text-cyan-400 bg-cyan-500/10",
  general: "text-zinc-400 bg-zinc-500/10",
};

interface ModelPanelProps {
  provider: Provider;
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  onClose: () => void;
}

export function ModelPanel({ provider, currentModel, onSelectModel, onClose }: ModelPanelProps) {
  const [search, setSearch] = useState("");
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(false);
  const { getEffectiveModels, getDisplayName } = useModelStore();

  const providerConfig = providers.find((p) => p.id === provider);
  const isLocal = providerConfig?.type === "local";

  // Reset search when provider changes
  useEffect(() => { setSearch(""); }, [provider]);

  // Fetch local models
  useEffect(() => {
    if (!isLocal) return;
    setLoading(true);
    const fetcher = provider === "lmstudio" ? fetchLMStudioModels : fetchOllamaModels;
    fetcher()
      .then(setLocalModels)
      .catch(() => setLocalModels([]))
      .finally(() => setLoading(false));
  }, [provider, isLocal]);

  const models = useMemo(() => {
    if (isLocal) {
      return localModels.map((m) => {
        const hint = provider === "ollama" ? getOllamaHint(m.id) : "";
        return {
          id: m.id,
          name: provider === "ollama" ? getOllamaFriendlyName(m.id) : m.name,
          tag: hint || deriveTag(m.id),
          size: getLocalModelSize(m.id),
        };
      });
    }
    return getEffectiveModels(provider).map((m) => ({
      id: m.id,
      name: getDisplayName(m.id, m.name),
      tag: deriveTag(m.id),
      size: null as string | null,
    }));
  }, [isLocal, localModels, provider, getEffectiveModels, getDisplayName]);

  const filtered = search
    ? models.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase())
      )
    : models;

  return (
    <div className="flex-shrink-0 bg-zinc-900/98 backdrop-blur-md border-b border-zinc-800/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="mx-auto max-w-[1680px] px-8 py-3 h-[340px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: providerConfig?.color }}
            />
            <span className="text-sm font-bold text-zinc-200">
              {providerConfig?.name} Models
            </span>
            <span className="text-xs text-zinc-500">
              {filtered.length} available
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search — always visible to prevent layout shift */}
        <div className="relative mb-2 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter models..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/40 transition-colors"
            autoFocus
          />
        </div>

        {/* Model grid — fills remaining space, scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-4 text-center text-sm text-zinc-500">Loading models...</div>
          ) : filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-zinc-500">
              {isLocal
                ? `No models found. Is ${providerConfig?.name} running?`
                : search
                ? "No models match your search"
                : "No models available"}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelectModel(m.id)}
                  className={cn(
                    "text-left rounded-lg px-2.5 py-2 transition-all border",
                    currentModel === m.id
                      ? "bg-orange-500/10 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                      : "bg-zinc-800/50 border-zinc-800 hover:border-orange-500/30 hover:bg-zinc-800 hover:shadow-[0_0_8px_rgba(249,115,22,0.1)]"
                  )}
                >
                  <div className="text-[11px] font-semibold text-zinc-200 truncate mb-0.5">
                    {m.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "text-[9px] font-medium px-1 py-0.5 rounded",
                        TAG_STYLES[m.tag] || TAG_STYLES.general
                      )}
                    >
                      {m.tag}
                    </span>
                    {m.size && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-zinc-700/60 text-zinc-300">
                        {m.size}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
