"use client";

/**
 * Capability Status Bar
 *
 * Compact display of active AI capabilities.
 * Shows icons for what's enabled, expandable for details.
 */

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useUnifiedCapabilitiesStore,
  CAPABILITY_DEFINITIONS,
  WEBSITE_TEMPLATES,
  type CapabilityId,
} from "@/lib/stores/unifiedCapabilitiesStore";

interface CapabilityStatusBarProps {
  className?: string;
  compact?: boolean;
}

export default function CapabilityStatusBar({
  className,
  compact = false,
}: CapabilityStatusBarProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    websiteType,
    orchestrationMode,
    capabilities,
    hydrated,
    hydrate,
  } = useUnifiedCapabilitiesStore();

  // Hydrate on mount
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Get active capabilities
  const activeCapabilities = Object.entries(capabilities)
    .filter(([_, state]) => state.enabled)
    .map(([id]) => id as CapabilityId);

  // Get template info
  const template = WEBSITE_TEMPLATES[websiteType];

  // Check for missing critical capabilities
  const missingCritical = template.criticalCapabilities.filter(
    (id) => !capabilities[id]?.enabled
  );

  // Orchestration mode labels
  const modeLabels: Record<string, string> = {
    single: "Single",
    sequential: "Pipeline",
    parallel: "Debate",
    parallel_judge: "Trio+Judge",
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Website type badge */}
        <span className="text-xs" title={template.name}>
          {template.icon}
        </span>

        {/* Mode badge */}
        <span
          className={cn(
            "px-1.5 py-0.5 text-[9px] font-medium rounded",
            orchestrationMode === "single" && "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400",
            orchestrationMode === "sequential" && "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
            orchestrationMode === "parallel" && "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400",
            orchestrationMode === "parallel_judge" && "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"
          )}
        >
          {modeLabels[orchestrationMode]}
        </span>

        {/* Active capability icons */}
        <div className="flex items-center gap-0.5">
          {activeCapabilities.slice(0, 4).map((id) => (
            <span
              key={id}
              className="text-xs"
              title={CAPABILITY_DEFINITIONS[id].name}
            >
              {CAPABILITY_DEFINITIONS[id].icon}
            </span>
          ))}
          {activeCapabilities.length > 4 && (
            <span className="text-[9px] text-zinc-500">
              +{activeCapabilities.length - 4}
            </span>
          )}
        </div>

        {/* Warning if missing critical */}
        {missingCritical.length > 0 && (
          <span className="text-yellow-500" title={`Missing: ${missingCritical.map(id => CAPABILITY_DEFINITIONS[id].name).join(', ')}`}>
            <AlertCircle className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-zinc-200 dark:border-zinc-700", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {template.icon} {template.name}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 text-[9px] font-medium rounded",
              orchestrationMode === "single" && "bg-zinc-200 dark:bg-zinc-700",
              orchestrationMode !== "single" && "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400"
            )}
          >
            {modeLabels[orchestrationMode]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Warning badge */}
          {missingCritical.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-3 w-3" />
              {missingCritical.length} missing
            </span>
          )}

          {/* Count badge */}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
            {activeCapabilities.length} active
          </span>

          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
          {/* Active capabilities */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {activeCapabilities.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded"
              >
                {CAPABILITY_DEFINITIONS[id].icon} {CAPABILITY_DEFINITIONS[id].name}
              </span>
            ))}
          </div>

          {/* Missing critical warning */}
          {missingCritical.length > 0 && (
            <div className="text-[10px] text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 rounded px-2 py-1">
              <span className="font-medium">Recommended for {template.name}:</span>{" "}
              {missingCritical.map((id) => CAPABILITY_DEFINITIONS[id].name).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mini version for headers/toolbars
 */
export function CapabilityStatusMini({ className }: { className?: string }) {
  const { capabilities, orchestrationMode, websiteType } = useUnifiedCapabilitiesStore();
  const template = WEBSITE_TEMPLATES[websiteType];

  const activeCount = Object.values(capabilities).filter((c) => c.enabled).length;

  const modeColors: Record<string, string> = {
    single: "text-zinc-500",
    sequential: "text-blue-500",
    parallel: "text-orange-500",
    parallel_judge: "text-purple-500",
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-xs" title={template.name}>
        {template.icon}
      </span>
      <Sparkles className={cn("h-3 w-3", modeColors[orchestrationMode])} />
      <span className="text-[9px] text-zinc-500">{activeCount}</span>
    </div>
  );
}
