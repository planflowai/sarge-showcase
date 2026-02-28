"use client";

import { providers } from "@sarge/core";
import { cn } from "@sarge/core";
import type { Provider } from "@sarge/core";

interface ProviderBarProps {
  activeProvider: Provider;
  openProvider: Provider | null;
  onProviderClick: (providerId: Provider) => void;
}

export function ProviderBar({ activeProvider, openProvider, onProviderClick }: ProviderBarProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {providers.map((p) => {
        const isActive = activeProvider === p.id;
        const isOpen = openProvider === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onProviderClick(p.id as Provider)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap text-center",
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
      })}
    </div>
  );
}
