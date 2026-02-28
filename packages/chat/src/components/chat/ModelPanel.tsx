"use client";

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
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
  reasoning: "text-amber-400 bg-amber-500/10",
  coder: "text-cyan-400 bg-cyan-500/10",
  heavy: "text-purple-400 bg-purple-500/10",
  balanced: "text-blue-400 bg-blue-500/10",
  fast: "text-emerald-400 bg-emerald-500/10",
  general: "text-zinc-400 bg-zinc-500/10",
};

const TAG_ORDER: Record<string, number> = {
  reasoning: 0,
  coder: 1,
  heavy: 2,
  balanced: 3,
  fast: 4,
  general: 5,
};

interface ModelPanelProps {
  provider: Provider;
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  onClose: () => void;
}

export function ModelPanel({ provider, currentModel, onSelectModel, onClose }: ModelPanelProps) {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(false);
  const { getEffectiveModels, getDisplayName } = useModelStore();

  const providerConfig = providers.find((p) => p.id === provider);
  const isLocal = providerConfig?.type === "local";

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
    const list = isLocal
      ? localModels.map((m) => {
          const hint = provider === "ollama" ? getOllamaHint(m.id) : "";
          return {
            id: m.id,
            name: provider === "ollama" ? getOllamaFriendlyName(m.id) : m.name,
            tag: hint || deriveTag(m.id),
            size: getLocalModelSize(m.id),
          };
        })
      : getEffectiveModels(provider).map((m) => ({
          id: m.id,
          name: getDisplayName(m.id, m.name),
          tag: deriveTag(m.id),
          size: null as string | null,
        }));
    return list.sort((a, b) => (TAG_ORDER[a.tag] ?? 5) - (TAG_ORDER[b.tag] ?? 5));
  }, [isLocal, localModels, provider, getEffectiveModels, getDisplayName]);

  return (
    <div className="flex-shrink-0 bg-zinc-900/98 backdrop-blur-md border-b border-zinc-800/40 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="px-6 h-[130px] flex items-center gap-4">
        {/* Left — provider label */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: providerConfig?.color }} />
          <span className="text-xs font-bold text-zinc-300 whitespace-nowrap">{providerConfig?.name}</span>
          <span className="text-[10px] text-zinc-500">{models.length}</span>
        </div>

        {/* Center — model cards, two rows */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="py-2 text-center text-xs text-zinc-500">Loading...</div>
          ) : models.length === 0 ? (
            <div className="py-2 text-center text-xs text-zinc-500">
              {isLocal ? `No models found. Is ${providerConfig?.name} running?` : "No models available"}
            </div>
          ) : (() => {
            const half = Math.ceil(models.length / 2);
            const row1 = models.slice(0, half);
            const row2 = models.slice(half);
            const card = (m: typeof models[number]) => (
              <button
                key={m.id}
                onClick={() => onSelectModel(m.id)}
                className={cn(
                  "flex-shrink-0 w-[130px] text-center rounded-lg px-2 py-1.5 transition-all border",
                  currentModel === m.id
                    ? "bg-orange-500/10 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                    : "bg-zinc-800/50 border-zinc-800 hover:border-orange-500/30 hover:bg-zinc-800 hover:shadow-[0_0_8px_rgba(249,115,22,0.1)]"
                )}
              >
                <div className="text-[11px] font-semibold text-zinc-200 truncate">{m.name}</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className={cn("text-[9px] font-medium px-1 py-0.5 rounded", TAG_STYLES[m.tag] || TAG_STYLES.general)}>
                    {m.tag}
                  </span>
                  {m.size && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-zinc-700/60 text-zinc-300">{m.size}</span>
                  )}
                </div>
              </button>
            );
            return (
              <div>
                <div className="flex gap-1.5 justify-center">{row1.map(card)}</div>
                {row2.length > 0 && <div className="flex gap-1.5 justify-center mt-1.5">{row2.map(card)}</div>}
              </div>
            );
          })()}
        </div>

        {/* Right — close */}
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
