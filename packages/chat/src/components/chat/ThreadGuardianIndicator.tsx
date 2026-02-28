"use client";

import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { useThreadGuardianStore } from "@sarge/core";
import { useAirGapStore, isCloudProvider } from "@sarge/core";
import { isGuardianRunning, getGuardianStatus } from "@sarge/core";
import { getActiveWarnings } from "@sarge/core";
import { cn } from "@sarge/core";
import { GuardianMonitorPanel } from "@sarge/core";

interface ThreadGuardianIndicatorProps {
  conversationId: string;
  className?: string;
}

type GuardianState = "idle" | "running" | "escalated" | "error" | "disabled" | "airgap";

function getGuardianState(conversationId: string): GuardianState {
  const store = useThreadGuardianStore.getState();
  const airGapStore = useAirGapStore.getState();

  if (!store.enabled) return "disabled";

  const { tier1Config, tier2Config, tier3Config } = store;

  // Check for errors
  if (
    tier1Config.status === "error" ||
    tier2Config.status === "error" ||
    tier3Config.status === "error"
  ) {
    return "error";
  }

  // Check for escalations
  if (
    tier1Config.status === "escalated" ||
    tier2Config.status === "escalated" ||
    tier3Config.status === "escalated"
  ) {
    return "escalated";
  }

  // Check if running
  if (
    tier1Config.status === "running" ||
    tier2Config.status === "running" ||
    tier3Config.status === "running"
  ) {
    return "running";
  }

  // Check if air-gap mode would affect Tier 3
  if (airGapStore.airGapEnabled && isCloudProvider(tier3Config.provider)) {
    return "airgap";
  }

  return "idle";
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "Never";

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    const secs = Math.floor(diff / 1000);
    return `${secs}s ago`;
  }
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

export default function ThreadGuardianIndicator({
  conversationId,
  className,
}: ThreadGuardianIndicatorProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [state, setState] = useState<GuardianState>("disabled");

  const enabled = useThreadGuardianStore((s) => s.enabled);
  const hydrated = useThreadGuardianStore((s) => s.hydrated);
  const tier1Config = useThreadGuardianStore((s) => s.tier1Config);
  const tier2Config = useThreadGuardianStore((s) => s.tier2Config);
  const tier3Config = useThreadGuardianStore((s) => s.tier3Config);
  const activeConversationId = useThreadGuardianStore((s) => s.activeConversationId);

  // Debug logging
  useEffect(() => {
    console.log('[ThreadGuardianIndicator] Mount/Update:', {
      conversationId,
      enabled,
      hydrated,
      tier1Status: tier1Config.status,
      tier2Status: tier2Config.status,
      tier3Status: tier3Config.status
    });
  }, [conversationId, enabled, hydrated, tier1Config.status, tier2Config.status, tier3Config.status]);

  // Update state periodically
  useEffect(() => {
    const updateState = () => {
      setState(getGuardianState(conversationId));
    };

    updateState();
    const interval = setInterval(updateState, 1000);
    return () => clearInterval(interval);
  }, [conversationId, enabled, tier1Config.status, tier2Config.status, tier3Config.status]);

  // Don't render until hydrated
  if (!hydrated) {
    console.log('[ThreadGuardianIndicator] Waiting for hydration...');
    return null;
  }

  // Don't render if guardian is disabled
  if (!enabled) {
    console.log('[ThreadGuardianIndicator] Guardian disabled, not rendering');
    return null;
  }

  const stateConfig = {
    idle: {
      color: "bg-emerald-500",
      ringColor: "ring-emerald-500/30",
      icon: ShieldCheck,
      label: "All Clear",
    },
    running: {
      color: "bg-blue-500",
      ringColor: "ring-blue-500/30",
      icon: Shield,
      label: "Processing",
    },
    escalated: {
      color: "bg-amber-500",
      ringColor: "ring-amber-500/30",
      icon: ShieldAlert,
      label: "Escalated",
    },
    error: {
      color: "bg-red-500",
      ringColor: "ring-red-500/30",
      icon: ShieldX,
      label: "Error",
    },
    disabled: {
      color: "bg-zinc-500",
      ringColor: "ring-zinc-500/30",
      icon: Shield,
      label: "Disabled",
    },
    airgap: {
      color: "bg-amber-500",
      ringColor: "ring-amber-500/30",
      icon: ShieldAlert,
      label: "Air-Gap Mode",
    },
  };

  const config = stateConfig[state];
  const IconComponent = config.icon;
  const warnings = getActiveWarnings(conversationId);
  const isActive = activeConversationId === conversationId;

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          onClick={() => setShowPanel(true)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={cn(
            "relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all",
            "hover:bg-zinc-800/50",
            state === "running" && "animate-pulse"
          )}
          title="Thread Guardian — monitoring conversation quality"
        >
          <div className="relative">
            <IconComponent className="h-6 w-6 text-zinc-400" />
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-zinc-900",
                config.color,
                state === "running" && "animate-pulse"
              )}
            />
          </div>
          {warnings.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-bold text-amber-400">
              {warnings.length}
            </span>
          )}
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 shadow-xl min-w-48">
            <div className="text-xs font-medium text-zinc-200 mb-2">
              Thread Guardian: {isActive ? "Active" : "Monitoring"}
            </div>
            <div className="space-y-1 text-[10px] text-zinc-400">
              <div className="flex items-center justify-between gap-4">
                <span className="text-blue-400">Tier 1:</span>
                <span>{formatRelativeTime(tier1Config.lastRun)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-purple-400">Tier 2:</span>
                <span>{formatRelativeTime(tier2Config.lastRun)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-amber-400">Tier 3:</span>
                <span>{formatRelativeTime(tier3Config.lastRun)}</span>
              </div>
            </div>
            {state === "airgap" && (
              <div className="mt-2 pt-2 border-t border-zinc-700 text-[10px] text-amber-400">
                Tier 3 running locally — reduced accuracy
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-700 text-[10px] text-amber-400">
                {warnings.length} warning{warnings.length > 1 ? "s" : ""} detected
              </div>
            )}
            <div className="mt-2 text-[10px] text-zinc-500">Click for details</div>
            {/* Tooltip arrow */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-zinc-800 border-l border-t border-zinc-700" />
          </div>
        )}
      </div>

      {/* Monitor Panel */}
      <GuardianMonitorPanel
        conversationId={conversationId}
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
      />
    </>
  );
}
