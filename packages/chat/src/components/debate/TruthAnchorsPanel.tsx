"use client";

import { useMemo, useState } from "react";
import { useTruthAnchorStore, type TruthAnchor, type AnchorType } from "@sarge/core";
import { Lock, AlertCircle, CheckCircle2, HelpCircle, X, RefreshCw } from "lucide-react";
import { cn } from "@sarge/core";

function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getAnchorIcon(type: AnchorType) {
  switch (type) {
    case "TRUE":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "FALSE":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case "UNCERTAIN":
      return <HelpCircle className="w-4 h-4 text-yellow-500" />;
  }
}

function getAnchorColors(type: AnchorType) {
  switch (type) {
    case "TRUE":
      return {
        border: "border-l-green-500",
        bg: "bg-green-50 dark:bg-green-950/20",
        text: "text-green-700 dark:text-green-300",
        badge: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
      };
    case "FALSE":
      return {
        border: "border-l-red-500",
        bg: "bg-red-50 dark:bg-red-950/20",
        text: "text-red-700 dark:text-red-300",
        badge: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
      };
    case "UNCERTAIN":
      return {
        border: "border-l-yellow-500",
        bg: "bg-yellow-50 dark:bg-yellow-950/20",
        text: "text-yellow-700 dark:text-yellow-300",
        badge: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200",
      };
  }
}

interface TruthAnchorCardProps {
  anchor: TruthAnchor;
  onDismiss: (id: string) => void;
  onOverride: (id: string) => void;
}

function TruthAnchorCard({ anchor, onDismiss, onOverride }: TruthAnchorCardProps) {
  const colors = getAnchorColors(anchor.type);

  return (
    <div
      className={cn(
        "animate-in fade-in duration-300 border-l-4 rounded-r-md p-3 space-y-2",
        colors.border,
        colors.bg
      )}
    >
      {/* Header: Icon + Type + Confidence */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getAnchorIcon(anchor.type)}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-semibold uppercase tracking-wide", colors.text)}>
              {anchor.type}
            </span>
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", colors.badge)}>
              {anchor.confidence}%
            </span>
          </div>
        </div>
        <button
          onClick={() => onDismiss(anchor.id)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex-shrink-0"
          title="Dismiss this anchor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fact Text */}
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug break-words">
        {anchor.fact}
      </p>

      {/* Metadata: Scope + Timestamp */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-block px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-medium">
          {anchor.scope === "global" ? "🌍 Global" : "📄 Per-debate"}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {timeAgo(anchor.updatedAt)}
        </span>
      </div>

      {/* Override Button */}
      <button
        onClick={() => onOverride(anchor.id)}
        className={cn(
          "w-full text-xs font-semibold py-1.5 rounded transition flex items-center justify-center gap-1",
          "text-gray-700 dark:text-gray-300",
          "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
        )}
        title="Correct this anchor"
      >
        <RefreshCw className="w-3 h-3" />
        Override
      </button>
    </div>
  );
}

interface TruthAnchorsPanelProps {
  className?: string;
}

export function TruthAnchorsPanel({ className }: TruthAnchorsPanelProps) {
  const dismissAnchor = useTruthAnchorStore((s) => s.dismissAnchor);
  const updateAnchor = useTruthAnchorStore((s) => s.updateAnchor);
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null);

  // Get anchors with proper memoization to avoid infinite getSnapshot loop
  const anchors = useMemo(() => {
    return useTruthAnchorStore.getState().getActiveAnchors();
  }, []);

  // Subscribe to store changes
  const storeAnchors = useTruthAnchorStore((s) => s.anchors);
  const activeAnchors = useMemo(() => {
    return storeAnchors.filter((a) => !a.dismissed);
  }, [storeAnchors]);

  const groupedAnchors = useMemo(() => {
    return {
      TRUE: activeAnchors.filter((a) => a.type === "TRUE"),
      FALSE: activeAnchors.filter((a) => a.type === "FALSE"),
      UNCERTAIN: activeAnchors.filter((a) => a.type === "UNCERTAIN"),
    };
  }, [activeAnchors]);

  const lastUpdated = useMemo(() => {
    if (activeAnchors.length === 0) return null;
    const latest = activeAnchors.reduce((max, a) => (a.updatedAt > max.updatedAt ? a : max));
    return timeAgo(latest.updatedAt);
  }, [activeAnchors]);

  const handleOverride = (id: string) => {
    setExpandedOverride(expandedOverride === id ? null : id);
  };

  const handleConfirm = (id: string, newType: AnchorType, newConfidence: number) => {
    updateAnchor(id, { type: newType, confidence: newConfidence });
    setExpandedOverride(null);
  };

  if (activeAnchors.length === 0) {
    return (
      <div className={cn("rounded-lg border border-gray-200 dark:border-gray-800 p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Active Truth Anchors</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No anchors yet. Judge will create them as facts are validated during debate.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Active Truth Anchors</h3>
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {activeAnchors.length}
            </span>
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Updated {lastUpdated}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* TRUE Anchors */}
        {groupedAnchors.TRUE.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
              ✓ Confirmed True
            </h4>
            <div className="space-y-2">
              {groupedAnchors.TRUE.map((anchor) => (
                <div key={anchor.id}>
                  <TruthAnchorCard
                    anchor={anchor}
                    onDismiss={dismissAnchor}
                    onOverride={handleOverride}
                  />
                  {expandedOverride === anchor.id && (
                    <OverridePanel
                      anchor={anchor}
                      onConfirm={handleConfirm}
                      onCancel={() => setExpandedOverride(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FALSE Anchors */}
        {groupedAnchors.FALSE.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
              ✗ Confirmed False
            </h4>
            <div className="space-y-2">
              {groupedAnchors.FALSE.map((anchor) => (
                <div key={anchor.id}>
                  <TruthAnchorCard
                    anchor={anchor}
                    onDismiss={dismissAnchor}
                    onOverride={handleOverride}
                  />
                  {expandedOverride === anchor.id && (
                    <OverridePanel
                      anchor={anchor}
                      onConfirm={handleConfirm}
                      onCancel={() => setExpandedOverride(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UNCERTAIN Anchors */}
        {groupedAnchors.UNCERTAIN.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
              ? Uncertain
            </h4>
            <div className="space-y-2">
              {groupedAnchors.UNCERTAIN.map((anchor) => (
                <div key={anchor.id}>
                  <TruthAnchorCard
                    anchor={anchor}
                    onDismiss={dismissAnchor}
                    onOverride={handleOverride}
                  />
                  {expandedOverride === anchor.id && (
                    <OverridePanel
                      anchor={anchor}
                      onConfirm={handleConfirm}
                      onCancel={() => setExpandedOverride(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface OverridePanelProps {
  anchor: TruthAnchor;
  onConfirm: (id: string, type: AnchorType, confidence: number) => void;
  onCancel: () => void;
}

function OverridePanel({ anchor, onConfirm, onCancel }: OverridePanelProps) {
  const [selectedType, setSelectedType] = useState<AnchorType>(anchor.type);
  const [confidence, setConfidence] = useState(anchor.confidence);

  return (
    <div className="mt-2 p-3 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 space-y-3">
      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
        Update this anchor:
      </div>

      {/* Type Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(["TRUE", "FALSE", "UNCERTAIN"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "py-1.5 px-2 rounded text-xs font-semibold transition",
                selectedType === type
                  ? type === "TRUE"
                    ? "bg-green-500 text-white"
                    : type === "FALSE"
                    ? "bg-red-500 text-white"
                    : "bg-yellow-500 text-white"
                  : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Confidence
          </label>
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{confidence}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(anchor.id, selectedType, confidence)}
          className="flex-1 py-1.5 px-2 rounded text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 px-2 rounded text-xs font-semibold bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
