"use client";

import { providers } from "@sarge/core";
import { useModelStore } from "@sarge/core";
import { getOllamaFriendlyName } from "@sarge/core";
import { cn } from "@sarge/core";
import type { Provider } from "@sarge/core";

interface ProviderBarProps {
  activeProvider: Provider;
  activeModel: string;
  openProvider: Provider | null;
  onProviderClick: (providerId: Provider) => void;
}

export function ProviderBar({ activeProvider, activeModel, openProvider, onProviderClick }: ProviderBarProps) {
  const { getDisplayName } = useModelStore();

  const modelName = activeProvider === "ollama"
    ? getOllamaFriendlyName(activeModel)
    : activeProvider === "lmstudio"
    ? activeModel
    : getDisplayName(activeModel, activeModel);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {providers.map((p) => {
        const isActive = activeProvider === p.id;
        const isOpen = openProvider === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onProviderClick(p.id as Provider)}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap",
              isActive
                ? "bg-orange-500/15 border-2 border-orange-500 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.25)]"
                : isOpen
                ? "bg-zinc-700/50 border-2 border-zinc-500 text-zinc-200"
                : "bg-zinc-800 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
            )}
          >
            {isActive ? `${p.name} · ${modelName}` : p.name}
          </button>
        );
      })}
    </div>
  );
}
