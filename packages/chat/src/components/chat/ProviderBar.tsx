"use client";

import { providers } from "@sarge/core";
import { cn } from "@sarge/core";
import type { Provider } from "@sarge/core";

interface ProviderBarProps {
  activeProvider: Provider;
  openProvider: Provider | null;
  onProviderClick: (providerId: Provider) => void;
}

const CLOUD_IDS = new Set(["anthropic", "openai", "google", "xai", "deepseek"]);

export function ProviderBar({ activeProvider, openProvider, onProviderClick }: ProviderBarProps) {
  const cloud = providers.filter((p) => CLOUD_IDS.has(p.id));
  const local = providers.filter((p) => !CLOUD_IDS.has(p.id));

  const pill = (p: typeof providers[number]) => {
    const isActive = activeProvider === p.id;
    const isOpen = openProvider === p.id;
    return (
      <button
        key={p.id}
        onClick={() => onProviderClick(p.id as Provider)}
        className={cn(
          "px-5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
          isActive
            ? "bg-orange-500/15 border-2 border-orange-500 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.25)]"
            : isOpen
            ? "bg-zinc-700/50 border-2 border-zinc-500 text-zinc-200"
            : "bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
        )}
      >
        {p.name}
      </button>
    );
  };

  return (
    <div className="flex gap-8">
      {/* Cloud providers */}
      <div>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Cloud</div>
        <div className="flex flex-wrap gap-2">
          {cloud.map(pill)}
        </div>
      </div>

      {/* Local providers */}
      <div>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Local</div>
        <div className="flex flex-wrap gap-2">
          {local.map(pill)}
        </div>
      </div>
    </div>
  );
}
