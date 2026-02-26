"use client";

import { Pause, Play, Trash2, Settings, Loader2 } from "lucide-react";
import { cn } from "@sarge/core";
import { BuilderHelper, HELPER_TYPES } from "../stores/builderHelpersStore";

interface HelperCardProps {
  helper: BuilderHelper;
  isRunning?: boolean;
  onPause: () => void;
  onRemove: () => void;
  onSettings?: () => void;
}

export default function HelperCard({
  helper,
  isRunning = false,
  onPause,
  onRemove,
  onSettings,
}: HelperCardProps) {
  const typeInfo = HELPER_TYPES[helper.type];

  // Color classes based on helper type
  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      text: "text-purple-600 dark:text-purple-400",
    },
    pink: {
      bg: "bg-pink-500/10",
      border: "border-pink-500/30",
      text: "text-pink-600 dark:text-pink-400",
    },
    orange: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      text: "text-orange-600 dark:text-orange-400",
    },
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-600 dark:text-blue-400",
    },
  };

  const colors = colorClasses[typeInfo.color] || colorClasses.blue;

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition-all",
        colors.bg,
        colors.border,
        helper.isPaused && "opacity-50"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        {/* Icon */}
        <span className="text-base">{helper.icon || typeInfo.icon}</span>

        {/* Name */}
        <span className={cn("text-xs font-medium flex-1 truncate", colors.text)}>
          {helper.name}
        </span>

        {/* Running indicator */}
        {isRunning && (
          <Loader2 className={cn("h-3 w-3 animate-spin", colors.text)} />
        )}
      </div>

      {/* Model info */}
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2 truncate">
        {helper.model}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Pause/Resume */}
        <button
          onClick={onPause}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
            helper.isPaused
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
          )}
          title={helper.isPaused ? "Resume helper" : "Pause helper"}
        >
          {helper.isPaused ? (
            <>
              <Play className="h-2.5 w-2.5" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-2.5 w-2.5" />
              Pause
            </>
          )}
        </button>

        {/* Settings (optional) */}
        {onSettings && (
          <button
            onClick={onSettings}
            className="p-1 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="Helper settings"
          >
            <Settings className="h-3 w-3" />
          </button>
        )}

        {/* Remove */}
        <button
          onClick={onRemove}
          className="p-1 rounded text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Remove helper"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
