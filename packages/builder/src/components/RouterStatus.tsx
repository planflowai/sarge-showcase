"use client";

import { useEffect } from "react";
import { Router, Zap, Cloud, Server, ChevronRight } from "lucide-react";
import { cn } from "@sarge/core";
import { useBuilderHelpersStore, RouterDecision } from "../stores/builderHelpersStore";

interface RouterStatusProps {
  className?: string;
}

export default function RouterStatus({ className }: RouterStatusProps) {
  const {
    showRouterDecisions,
    lastRouterDecision,
    setShowRouterDecisions,
    hydrated,
    hydrate,
  } = useBuilderHelpersStore();

  // Hydrate on mount
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Tier colors and labels
  const tierInfo: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
    1: {
      label: "Local",
      color: "text-emerald-600 dark:text-emerald-400",
      icon: <Server className="h-3 w-3" />,
    },
    2: {
      label: "Cost-Effective",
      color: "text-blue-600 dark:text-blue-400",
      icon: <Cloud className="h-3 w-3" />,
    },
    3: {
      label: "Premium",
      color: "text-purple-600 dark:text-purple-400",
      icon: <Zap className="h-3 w-3" />,
    },
  };

  return (
    <div className={cn("px-2 pb-2", className)}>
      {/* Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Router className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Smart Router
          </span>
        </div>
        <button
          onClick={() => setShowRouterDecisions(!showRouterDecisions)}
          className={cn(
            "relative w-8 h-4 rounded-full transition-colors",
            showRouterDecisions
              ? "bg-indigo-500"
              : "bg-zinc-300 dark:bg-zinc-600"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all",
              showRouterDecisions ? "left-4" : "left-0.5"
            )}
          />
        </button>
      </div>

      {/* Decision Display */}
      {showRouterDecisions && lastRouterDecision && (
        <div
          className={cn(
            "rounded-lg border p-2 text-xs",
            lastRouterDecision.tier === 1 && "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
            lastRouterDecision.tier === 2 && "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",
            lastRouterDecision.tier === 3 && "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30"
          )}
        >
          {/* Tier and Model */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className={tierInfo[lastRouterDecision.tier]?.color}>
              {tierInfo[lastRouterDecision.tier]?.icon}
            </span>
            <span className={cn("font-medium", tierInfo[lastRouterDecision.tier]?.color)}>
              Tier {lastRouterDecision.tier}
            </span>
            <ChevronRight className="h-3 w-3 text-zinc-400" />
            <span className="text-zinc-700 dark:text-zinc-300 truncate">
              {lastRouterDecision.model}
            </span>
          </div>

          {/* Reason */}
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {lastRouterDecision.reason}
          </div>
        </div>
      )}

      {/* Empty state when no decision yet */}
      {showRouterDecisions && !lastRouterDecision && (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-2 text-center">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Type a message to see routing
          </p>
        </div>
      )}
    </div>
  );
}
