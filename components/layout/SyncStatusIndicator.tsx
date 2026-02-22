"use client";

import { useEffect, useState } from "react";
import { Circle, Cloud, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useSyncStatusStore, type SyncStatus } from "@/lib/stores/syncStatusStore";
import { useAirGapStore } from "@/lib/stores/airGapStore";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<SyncStatus, {
  color: string;
  bgColor: string;
  icon: typeof Circle;
  label: string;
  animate?: boolean;
}> = {
  synced: {
    color: "text-emerald-500",
    bgColor: "bg-emerald-500",
    icon: Cloud,
    label: "Synced",
  },
  pending: {
    color: "text-amber-500",
    bgColor: "bg-amber-500",
    icon: RefreshCw,
    label: "Syncing",
    animate: true,
  },
  error: {
    color: "text-red-500",
    bgColor: "bg-red-500",
    icon: AlertTriangle,
    label: "Sync Error",
  },
  airgap: {
    color: "text-zinc-400",
    bgColor: "bg-zinc-400",
    icon: CloudOff,
    label: "Offline",
  },
};

export function SyncStatusIndicator() {
  const [mounted, setMounted] = useState(false);
  const status = useSyncStatusStore((s) => s.status);
  const queueLength = useSyncStatusStore((s) => s.queue.length);
  const lastError = useSyncStatusStore((s) => s.lastError);
  const processQueue = useSyncStatusStore((s) => s.processQueue);
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);

  // Hydration guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Process queue periodically
  useEffect(() => {
    if (!mounted) return;

    // Process immediately on mount
    processQueue();

    // Then every 30 seconds
    const interval = setInterval(() => {
      processQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [mounted, processQueue]);

  // Update status based on air-gap
  useEffect(() => {
    if (airGapEnabled) {
      useSyncStatusStore.getState().setStatus("airgap");
    }
  }, [airGapEnabled]);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs">
        <Circle className="h-2 w-2 fill-zinc-400 text-zinc-400" />
      </div>
    );
  }

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-default",
        "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      )}
      title={
        status === "error"
          ? `${config.label}: ${lastError || "Unknown error"}`
          : status === "pending"
          ? `${config.label} (${queueLength} items)`
          : config.label
      }
    >
      {/* Status dot */}
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full",
            config.bgColor,
            config.animate && "animate-ping opacity-75"
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            config.bgColor
          )}
        />
      </span>

      {/* Icon */}
      <Icon
        className={cn(
          "h-3 w-3",
          config.color,
          config.animate && "animate-spin"
        )}
      />

      {/* Label - only show on wider screens */}
      <span className={cn("hidden sm:inline", config.color)}>
        {config.label}
        {queueLength > 0 && status === "pending" && (
          <span className="ml-1 opacity-70">({queueLength})</span>
        )}
      </span>
    </div>
  );
}
