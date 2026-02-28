"use client";

import { providers } from "@sarge/core";
import { cn } from "@sarge/core";
import type { Provider } from "@sarge/core";

interface ProviderBarProps {
  activeProvider: Provider;
  openProvider: Provider | null;
  onProviderClick: (providerId: Provider) => void;
}

const CLOUD_TOP = new Set(["anthropic", "openai", "google"]);
const CLOUD_BOTTOM = new Set(["xai", "deepseek"]);
const CLOUD_IDS = new Set([...CLOUD_TOP, ...CLOUD_BOTTOM]);

export function ProviderBar({ activeProvider, openProvider, onProviderClick }: ProviderBarProps) {
  const cloudTop = providers.filter((p) => CLOUD_TOP.has(p.id));
  const cloudBottom = providers.filter((p) => CLOUD_BOTTOM.has(p.id));
  const local = providers.filter((p) => !CLOUD_IDS.has(p.id));

  const pill = (p: typeof providers[number]) => {
    const isActive = activeProvider === p.id;
    const isOpen = openProvider === p.id;
    const providerColor = p.color || "#f97316";
    return (
      <button
        key={p.id}
        onClick={() => onProviderClick(p.id as Provider)}
        className={cn(
          "px-5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
          isActive
            ? "border-2"
            : isOpen
            ? "bg-zinc-200/50 dark:bg-zinc-700/50 border-2 border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-200"
            : "bg-gray-100/60 dark:bg-zinc-800/60 border border-zinc-300/50 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500"
        )}
        style={isActive ? {
          borderColor: providerColor,
          color: providerColor,
          backgroundColor: `${providerColor}15`,
          boxShadow: `0 0 12px ${providerColor}40`,
        } : undefined}
      >
        {p.name}
      </button>
    );
  };

  return (
    <div className="flex gap-8">
      {/* Cloud providers */}
      <div className="pb-2 border-b border-zinc-300/40 dark:border-zinc-700/40">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 text-center">Cloud</div>
        <div className="flex gap-2">
          {cloudTop.map(pill)}
        </div>
        <div className="flex gap-2 mt-2 justify-center">
          {cloudBottom.map(pill)}
        </div>
      </div>

      {/* Local providers */}
      <div className="pb-2 border-b border-zinc-300/40 dark:border-zinc-700/40">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 text-center">Local</div>
        <div className="flex gap-2">
          {local.map(pill)}
        </div>
        <div className="flex gap-2 mt-2 justify-center">
          <span className="px-5 py-2 rounded-lg text-xs font-bold bg-gray-200/40 dark:bg-zinc-800/40 border border-zinc-300/30 dark:border-zinc-700/30 text-zinc-400 dark:text-zinc-600 cursor-default" title="Coming Soon">
            Hugging Face
          </span>
        </div>
      </div>
    </div>
  );
}
