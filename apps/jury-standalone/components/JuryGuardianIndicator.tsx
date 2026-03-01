"use client";

import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { useJuryGuardianStore } from "@/lib/stores/juryGuardianStore";
import { getJuryStatus, isJuryActive } from "@/lib/engine/engine";
import { cn } from "@/lib/utils";
import { JuryMonitorPanel } from "./JuryMonitorPanel";

interface JuryGuardianIndicatorProps {
  sessionId: string;
  className?: string;
}

type JuryState = "idle" | "running" | "alerts" | "error" | "disabled";

function computeJuryState(
  enabled: boolean,
  sessionId: string,
  ledger: ReturnType<typeof useJuryGuardianStore.getState>["ledgers"][string] | undefined
): JuryState {
  if (!enabled) return "disabled";

  if (!ledger) return "idle";

  // Check for active alerts
  const hasUnresolvedContradictions = ledger.contradictions.some((c) => !c.resolved);
  const hasActiveEchoAlerts = ledger.echoAlerts.some((e) => !e.dismissed);

  if (hasUnresolvedContradictions || hasActiveEchoAlerts) {
    return "alerts";
  }

  // Check if actively running
  if (isJuryActive(sessionId)) {
    return "running";
  }

  return "idle";
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";

  const now = Date.now();
  const timestamp = new Date(date).getTime();
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

export function JuryGuardianIndicator({ sessionId, className }: JuryGuardianIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [state, setState] = useState<JuryState>("disabled");
  const [mounted, setMounted] = useState(false);

  const enabled = useJuryGuardianStore((s) => s.enabled);
  const panelOpen = useJuryGuardianStore((s) => s.panelOpen);
  const setPanelOpen = useJuryGuardianStore((s) => s.setPanelOpen);
  const hydrated = useJuryGuardianStore((s) => s.hydrated);
  const ledger = useJuryGuardianStore((s) => s.ledgers[sessionId]);

  // Hydration effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update state when dependencies change
  useEffect(() => {
    if (!mounted) return;

    const updateState = () => {
      setState(computeJuryState(enabled, sessionId, ledger));
    };

    updateState();
    const interval = setInterval(updateState, 2000);
    return () => clearInterval(interval);
  }, [sessionId, enabled, ledger, mounted]);

  // Don't render until hydrated
  if (!hydrated) return null;

  const stateConfig = {
    idle: {
      color: "bg-green-500",
      icon: ShieldCheck,
      label: "All Clear",
    },
    running: {
      color: "bg-blue-500",
      icon: Shield,
      label: "Monitoring",
    },
    alerts: {
      color: "bg-yellow-500",
      icon: ShieldAlert,
      label: "Alerts Active",
    },
    error: {
      color: "bg-red-500",
      icon: ShieldX,
      label: "Error",
    },
    disabled: {
      color: "bg-zinc-500",
      icon: Shield,
      label: "Disabled",
    },
  };

  const config = stateConfig[state];
  const IconComponent = config.icon;

  // Count active alerts
  const alertCount =
    (ledger?.contradictions.filter((c) => !c.resolved).length || 0) +
    (ledger?.echoAlerts.filter((e) => !e.dismissed).length || 0);

  const juryStatus = getJuryStatus(sessionId);

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          onClick={() => setPanelOpen(true)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={cn(
            "relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all",
            "hover:bg-zinc-800/50",
            state === "running" && "animate-pulse"
          )}
          title="Jury Guardian"
        >
          <div className="relative">
            <IconComponent className="h-4 w-4 text-zinc-400" />
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-zinc-900",
                config.color,
                state === "running" && "animate-pulse"
              )}
            />
          </div>
          {alertCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500/20 px-1 text-[10px] font-bold text-yellow-400">
              {alertCount}
            </span>
          )}
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 shadow-xl min-w-48">
            <div className="text-xs font-medium text-zinc-200 mb-2">
              Jury Guardian: {enabled ? config.label : "Disabled"}
            </div>
            {enabled && (
              <div className="space-y-1 text-[10px] text-zinc-400">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-blue-400">Tier 1:</span>
                  <span>{formatRelativeTime(juryStatus.lastTier1)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-purple-400">Tier 2:</span>
                  <span>{formatRelativeTime(juryStatus.lastTier2)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-indigo-400">Tier 3:</span>
                  <span>{formatRelativeTime(juryStatus.lastTier3)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">Queued:</span>
                  <span>{juryStatus.queuedResponses} responses</span>
                </div>
              </div>
            )}
            {alertCount > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-700 text-[10px] text-yellow-400">
                {alertCount} alert{alertCount > 1 ? "s" : ""} require attention
              </div>
            )}
            <div className="mt-2 text-[10px] text-zinc-500">Click for details</div>
            {/* Tooltip arrow */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-zinc-800 border-l border-t border-zinc-700" />
          </div>
        )}
      </div>

      {/* Monitor Panel */}
      {panelOpen && <JuryMonitorPanel sessionId={sessionId} />}
    </>
  );
}
