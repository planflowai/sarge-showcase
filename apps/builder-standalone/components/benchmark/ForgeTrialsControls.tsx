"use client";

import React from "react";
import { Check, Cloud, AlertCircle } from "lucide-react";
import { useModelStore } from "@sarge/core";

interface CloudModel {
  id: string;
  provider: string;
  name: string;
}

interface Props {
  models: string[];
  setModels: (models: string[]) => void;
  defaultModels: string[];
  running: boolean;
  isCloud?: boolean;
  cloudModels?: CloudModel[];
  onCloudModelsChange?: (models: CloudModel[]) => void;
}

// Default cloud models by provider
const CLOUD_PROVIDER_GROUPS: { provider: string; label: string; models: { id: string; name: string }[] }[] = [
  {
    provider: "anthropic",
    label: "Anthropic",
    models: [
      { id: "claude-opus-4-5-20250514", name: "Claude Opus 4.5" },
      { id: "claude-sonnet-4-5-20241022", name: "Claude Sonnet 4.5" },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },
  {
    provider: "xai",
    label: "xAI",
    models: [
      { id: "grok-4", name: "Grok 4" },
      { id: "grok-4.1-fast", name: "Grok 4.1 Fast" },
    ],
  },
  {
    provider: "google",
    label: "Google",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ],
  },
  {
    provider: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3" },
      { id: "deepseek-reasoner", name: "DeepSeek R1" },
    ],
  },
];

export function ForgeTrialsControls({
  models,
  setModels,
  defaultModels,
  running,
  isCloud = false,
  cloudModels = [],
  onCloudModelsChange,
}: Props) {
  const storeModels = useModelStore((s) => s.models);

  const getModelStatus = (modelId: string, provider: string): string | null => {
    const m = storeModels.find((m) => m.id === modelId && m.provider === provider);
    return m?.status || null;
  };

  // ── Local Controls ──
  if (!isCloud) {
    const toggleModel = (model: string) => {
      if (running) return;
      if (models.includes(model)) {
        setModels(models.filter((m) => m !== model));
      } else {
        setModels([...models, model]);
      }
    };

    const selectAll = () => { if (!running) setModels([...defaultModels]); };
    const selectNone = () => { if (!running) setModels([]); };

    return (
      <div className="px-4 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-zinc-300 tracking-wider uppercase">
            Models ({models.length}/{defaultModels.length})
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} disabled={running} className="text-xs font-bold text-[#FF6700] hover:text-[#FFD700] transition-colors disabled:opacity-30">All</button>
            <span className="text-zinc-700">|</span>
            <button onClick={selectNone} disabled={running} className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30">None</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {defaultModels.map((model) => {
            const selected = models.includes(model);
            return (
              <button
                key={model}
                onClick={() => toggleModel(model)}
                disabled={running}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-sm font-bold transition-all border ${
                  selected
                    ? "bg-[#FF6700]/15 border-[#FF6700]/40 text-[#FFD700] shadow-[0_0_8px_rgba(255,103,0,0.15)]"
                    : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-600"
                } ${running ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {selected && <Check className="w-3 h-3 text-[#FF6700]" />}
                {model}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Cloud Controls ──
  const toggleCloudModel = (modelId: string, provider: string, name: string) => {
    if (running || !onCloudModelsChange) return;
    const exists = cloudModels.find((m) => m.id === modelId && m.provider === provider);
    if (exists) {
      onCloudModelsChange(cloudModels.filter((m) => !(m.id === modelId && m.provider === provider)));
    } else {
      onCloudModelsChange([...cloudModels, { id: modelId, provider, name }]);
    }
  };

  const selectAllCloud = () => {
    if (running || !onCloudModelsChange) return;
    const all: CloudModel[] = [];
    CLOUD_PROVIDER_GROUPS.forEach((g) => {
      g.models.forEach((m) => {
        all.push({ id: m.id, provider: g.provider, name: m.name });
      });
    });
    onCloudModelsChange(all);
  };

  const selectNoneCloud = () => {
    if (running || !onCloudModelsChange) return;
    onCloudModelsChange([]);
  };

  const totalCloudModels = CLOUD_PROVIDER_GROUPS.reduce((sum, g) => sum + g.models.length, 0);

  return (
    <div className="px-4 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40">
      <h2 className="text-sm font-bold text-zinc-300 tracking-wider uppercase flex items-center gap-2 mb-2">
        <Cloud className="w-4 h-4 text-sky-400" />
        Cloud Models
      </h2>

      {/* Bordered model selection box */}
      <div className="border border-zinc-700/50 rounded-lg p-3">
        {/* Header: count + All/None */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {cloudModels.length}/{totalCloudModels} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={selectAllCloud} disabled={running} className="text-xs font-bold text-[#FF6700] hover:text-[#FFD700] transition-colors disabled:opacity-30">All</button>
            <span className="text-zinc-700">|</span>
            <button onClick={selectNoneCloud} disabled={running} className="text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30">None</button>
          </div>
        </div>

        {/* Provider grid — 3 columns */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          {CLOUD_PROVIDER_GROUPS.map((group) => (
            <div key={group.provider}>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1">
                {group.models.map((model) => {
                  const selected = cloudModels.some((m) => m.id === model.id && m.provider === group.provider);
                  const status = getModelStatus(model.id, group.provider);
                  const isOffline = status === "error";

                  return (
                    <button
                      key={`${group.provider}-${model.id}`}
                      onClick={() => toggleCloudModel(model.id, group.provider, model.name)}
                      disabled={running}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all border ${
                        isOffline
                          ? "bg-zinc-900 border-zinc-800 text-zinc-700 opacity-50"
                          : selected
                          ? "bg-[#FF6700]/15 border-[#FF6700]/40 text-[#FFD700] shadow-[0_0_8px_rgba(255,103,0,0.15)]"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                      } ${running ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      title={isOffline ? "OFFLINE" : status === "active" ? "Verified" : "Not verified"}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: status === "active" ? "#10B981"
                            : status === "error" ? "#EF4444"
                            : status === "unchecked" ? "#F59E0B"
                            : "#6B7280",
                        }}
                      />
                      {selected && <Check className="w-2.5 h-2.5 text-[#FF6700]" />}
                      {model.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
