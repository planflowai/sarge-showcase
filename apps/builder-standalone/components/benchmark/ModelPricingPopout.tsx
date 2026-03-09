"use client";

import React, { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { getModelPricing, TIER_COLORS, type ModelPricing } from "@/lib/modelPricing";

interface Props {
  modelId: string;
  provider?: string;
  /** Anchor element position for popout placement */
  anchorRect: DOMRect | null;
  onClose: () => void;
}

function formatCost(cost: number | null): string {
  if (cost === null) return "—";
  if (cost === 0) return "$0.00";
  if (cost < 0.10) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function ModelPricingPopout({ modelId, provider, anchorRect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pricing = getModelPricing(modelId, provider);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!pricing) {
    return (
      <div
        ref={ref}
        className="fixed z-[100] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-4 min-w-[240px]"
        style={getPopoutPosition(anchorRect)}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-zinc-200">{modelId}</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-zinc-300">No pricing data available for this model.</p>
        <p className="text-xs text-zinc-400 mt-2">Add it to <code className="bg-zinc-800 px-1 rounded">lib/modelPricing.ts</code></p>
      </div>
    );
  }

  const tierStyle = TIER_COLORS[pricing.tier];

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl min-w-[280px]"
      style={getPopoutPosition(anchorRect)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-zinc-800">
        <span className="text-[15px] font-bold text-white">{pricing.name}</span>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors ml-3">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Cost row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Input / 1M</div>
            <div className={`text-lg font-bold font-mono ${getCostColor(pricing.inputPer1M)}`}>
              {formatCost(pricing.inputPer1M)}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Output / 1M</div>
            <div className={`text-lg font-bold font-mono ${getCostColor(pricing.outputPer1M)}`}>
              {formatCost(pricing.outputPer1M)}
            </div>
          </div>
        </div>

        {/* Context + Tier row */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Context</div>
            <div className="text-[15px] font-bold font-mono text-zinc-200">{pricing.context}</div>
          </div>
          <div>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider"
              style={{ background: tierStyle.bg, color: tierStyle.text }}
            >
              {pricing.tier}
            </span>
          </div>
        </div>

        {/* Note if present */}
        {pricing.note && (
          <div className="text-xs text-zinc-400 italic">{pricing.note}</div>
        )}
      </div>
    </div>
  );
}

function getCostColor(cost: number | null): string {
  if (cost === null) return "text-zinc-400";
  if (cost === 0) return "text-emerald-400";
  if (cost <= 0.50) return "text-emerald-400";
  if (cost <= 3.00) return "text-amber-400";
  return "text-red-400";
}

function getPopoutPosition(rect: DOMRect | null): React.CSSProperties {
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const popoutWidth = 300;
  const popoutHeight = 220;
  const padding = 8;

  let top = rect.bottom + padding;
  let left = rect.left;

  // Keep in viewport
  if (left + popoutWidth > window.innerWidth - padding) {
    left = window.innerWidth - popoutWidth - padding;
  }
  if (left < padding) left = padding;
  if (top + popoutHeight > window.innerHeight - padding) {
    // Show above instead
    top = rect.top - popoutHeight - padding;
  }

  return { top, left };
}

/**
 * Small $ button that triggers the pricing popout.
 * Use this inline next to model names.
 */
export function PricingButton({
  modelId,
  provider,
  className = "",
}: {
  modelId: string;
  provider?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (btnRef.current) {
      setAnchorRect(btnRef.current.getBoundingClientRect());
    }
    setOpen(!open);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold transition-all hover:bg-zinc-700 ${
          open ? "bg-zinc-700 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
        } ${className}`}
        title="View pricing"
      >
        $
      </button>
      {open && (
        <ModelPricingPopout
          modelId={modelId}
          provider={provider}
          anchorRect={anchorRect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
