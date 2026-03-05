"use client";

import { cn } from "@sarge/core";
import { Sparkles, Zap, Star, Rocket, Terminal, Code2, Flame } from "lucide-react";
import type { Provider } from "@sarge/core";
import type { LucideIcon } from "lucide-react";

const providerIcons: Record<Provider, LucideIcon> = {
  anthropic: Sparkles,
  openai: Zap,
  google: Star,
  xai: Rocket,
  deepseek: Code2,
  mistral: Flame,
  ollama: Terminal,
  lmstudio: Terminal,
};

interface ProviderBadgeProps {
  id?: Provider;
  name: string;
  color: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function ProviderBadge({
  id,
  name,
  color,
  isActive,
  onClick,
}: ProviderBadgeProps) {
  const Icon = id ? providerIcons[id] : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors",
        isActive
          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-300"
      )}
    >
      {Icon ? (
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      ) : (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {name}
    </button>
  );
}
