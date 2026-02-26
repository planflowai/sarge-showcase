"use client";

/**
 * Dependency Graph
 *
 * Clean, compact visual of active AI capabilities.
 * Shows what's enabled without overwhelming the user.
 */

import { useMemo, useState, useEffect } from "react";
import { Image, Gamepad2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@sarge/core";
import {
  useUnifiedCapabilitiesStore,
  CAPABILITY_DEFINITIONS,
  WEBSITE_TEMPLATES,
  type CapabilityId,
} from "@sarge/core";
import { useCapabilityEventValue } from "@sarge/core";

interface DependencyGraphProps {
  className?: string;
  compact?: boolean;
}

export default function DependencyGraph({ className, compact = false }: DependencyGraphProps) {
  const { capabilities, orchestrationMode, websiteType } = useUnifiedCapabilitiesStore();
  const [expanded, setExpanded] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<Array<{ url: string; type: string }>>([]);

  const lastAsset = useCapabilityEventValue('asset:generated');

  useEffect(() => {
    if (lastAsset) {
      setGeneratedAssets(prev => {
        const updated = [...prev, { url: lastAsset.url, type: lastAsset.type }];
        return updated.slice(-6);
      });
    }
  }, [lastAsset]);

  const isGameTemplate = websiteType?.startsWith('game_');
  const hasAssetGenerator = capabilities.asset_generator?.enabled;

  // Get active capabilities
  const activeCapabilities = useMemo(() => {
    return Object.entries(capabilities)
      .filter(([_, state]) => state.enabled)
      .map(([id]) => id as CapabilityId);
  }, [capabilities]);

  if (activeCapabilities.length === 0) {
    return null; // Don't show anything if no capabilities
  }

  // Mode label
  const modeLabel = {
    single: "Single AI",
    sequential: "Pipeline",
    parallel: "Debate",
    parallel_judge: "Trio + Judge",
  }[orchestrationMode] || "Single AI";

  // Compact view - just icons
  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        {/* Header with expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              Active: {activeCapabilities.length}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              {modeLabel}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-zinc-400" />
          ) : (
            <ChevronDown className="h-3 w-3 text-zinc-400" />
          )}
        </button>

        {/* Icon row - same size as AI Templates */}
        <div className="grid grid-cols-4 gap-1.5">
          {activeCapabilities.map((id) => {
            const def = CAPABILITY_DEFINITIONS[id];
            if (!def) return null;
            return (
              <div
                key={id}
                className="flex items-center justify-center p-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50"
                title={def.name}
              >
                <span className="text-xl">{def.icon}</span>
              </div>
            );
          })}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="pt-2 space-y-1 border-t border-zinc-200 dark:border-zinc-700">
            {activeCapabilities.map((id) => {
              const def = CAPABILITY_DEFINITIONS[id];
              if (!def) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400"
                >
                  <span>{def.icon}</span>
                  <span>{def.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Asset preview for games */}
        {isGameTemplate && hasAssetGenerator && generatedAssets.length > 0 && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-1 mb-1">
              <Gamepad2 className="w-3 h-3 text-pink-500" />
              <span className="text-[9px] text-zinc-500">
                {generatedAssets.length} assets
              </span>
            </div>
            <div className="flex gap-1">
              {generatedAssets.slice(0, 4).map((asset, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded overflow-hidden bg-zinc-200 dark:bg-zinc-700"
                >
                  <img
                    src={asset.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view (non-compact)
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Active Capabilities
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
          {modeLabel}
        </span>
      </div>

      {/* Capability chips */}
      <div className="flex flex-wrap gap-1.5">
        {activeCapabilities.map((id) => {
          const def = CAPABILITY_DEFINITIONS[id];
          if (!def) return null;

          const categoryColors: Record<string, string> = {
            orchestration: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300",
            monitoring: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
            verification: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300",
            safety: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300",
            content: "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
            assets: "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300",
          };

          return (
            <span
              key={id}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium",
                categoryColors[def.category] || "bg-zinc-100 dark:bg-zinc-800"
              )}
            >
              <span>{def.icon}</span>
              <span>{def.name}</span>
            </span>
          );
        })}
      </div>

      {/* Asset Generator Ready */}
      {hasAssetGenerator && generatedAssets.length === 0 && (
        <div className="p-2 bg-pink-50 dark:bg-pink-500/10 rounded-lg border border-dashed border-pink-300 dark:border-pink-500/30">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-pink-500" />
            <span className="text-[10px] text-pink-700 dark:text-pink-400">
              Asset Generator ready
            </span>
          </div>
        </div>
      )}

      {/* Generated Assets Gallery */}
      {generatedAssets.length > 0 && (
        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <div className="flex items-center gap-1 mb-2">
            <Gamepad2 className="w-3 h-3 text-pink-500" />
            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
              Generated Assets ({generatedAssets.length})
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {generatedAssets.map((asset, i) => (
              <div
                key={i}
                className="aspect-square rounded overflow-hidden bg-zinc-200 dark:bg-zinc-700"
              >
                <img
                  src={asset.url}
                  alt={`Asset ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mini version for status bar
 */
export function DependencyGraphMini({ className }: { className?: string }) {
  const { capabilities } = useUnifiedCapabilitiesStore();

  const activeIcons = useMemo(() => {
    return Object.entries(capabilities)
      .filter(([_, state]) => state.enabled)
      .map(([id]) => CAPABILITY_DEFINITIONS[id as CapabilityId]?.icon)
      .filter(Boolean)
      .slice(0, 5);
  }, [capabilities]);

  const total = Object.values(capabilities).filter((c) => c.enabled).length;

  if (activeIcons.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {activeIcons.map((icon, i) => (
        <span key={i} className="text-xs">{icon}</span>
      ))}
      {total > 5 && (
        <span className="text-[9px] text-zinc-500">+{total - 5}</span>
      )}
    </div>
  );
}
