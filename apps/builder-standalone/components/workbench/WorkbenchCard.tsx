"use client";

import { useState, useRef, useEffect } from "react";
import { MonitorUp, MonitorOff, Trophy, ChevronDown } from "lucide-react";
import { useWorkbenchStore, type WorkbenchSlot, type WorkbenchStatus } from "@/lib/stores/workbenchStore";
import { sendWorkbenchConfig } from "@/lib/workbenchPopoutManager";
import { providers } from "@sarge/core";
import { cn } from "@/lib/utils";

// ─── Provider meta ──────────────────────────────────────────────────────────

const CLOUD_PROVIDERS = providers.filter((p) => p.type === "cloud");

const PROVIDER_META: Record<string, { color: string; name: string }> = {};
for (const p of providers) PROVIDER_META[p.id] = { color: p.color, name: p.name };

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkbenchStatus, { label: string; dotCls: string }> = {
  idle:     { label: "IDLE",     dotCls: "bg-zinc-500" },
  building: { label: "BUILDING", dotCls: "bg-amber-400 animate-pulse" },
  complete: { label: "COMPLETE", dotCls: "bg-emerald-400" },
};

// ─── Model Dropdown ──────────────────────────────────────────────────────────

function ModelDropdown({ slot }: { slot: WorkbenchSlot }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setSlotProvider = useWorkbenchStore((s) => s.setSlotProvider);
  const setSlotModel    = useWorkbenchStore((s) => s.setSlotModel);
  const meta = PROVIDER_META[slot.provider] ?? { color: "#71717a", name: slot.provider };

  const currentProvider = CLOUD_PROVIDERS.find((p) => p.id === slot.provider);
  const currentModel    = currentProvider?.models.find((m) => m.id === slot.model);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 w-full h-6 px-2 rounded text-[10px] font-semibold border bg-zinc-800/60 border-zinc-700/40 hover:border-zinc-600 text-zinc-300 transition-colors truncate"
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
        <span className="truncate flex-1 text-left">{currentModel?.name ?? "Select model"}</span>
        <ChevronDown className="h-2.5 w-2.5 flex-shrink-0 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-56 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
          {CLOUD_PROVIDERS.map((provider) => (
            <div key={provider.id}>
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1 sticky top-0 bg-zinc-900">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: provider.color }} />
                {provider.name}
              </div>
              {provider.models.filter((m) => m.isEnabled).map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSlotProvider(slot.slot, provider.id);
                    setSlotModel(slot.slot, model.id);
                    sendWorkbenchConfig(slot.slot, provider.id, model.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-[11px] hover:bg-zinc-800 transition-colors",
                    slot.model === model.id ? "text-indigo-300 bg-indigo-900/20" : "text-zinc-300"
                  )}
                >
                  {model.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function WorkbenchProgress({ status, color }: { status: WorkbenchStatus; color: string }) {
  return (
    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
      {status === "building" && (
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
            backgroundSize: "200% 100%",
            animation: "workbench-sweep 1.5s ease-in-out infinite",
          }}
        />
      )}
      {status === "complete" && (
        <div className="h-full w-full rounded-full transition-all duration-500" style={{ backgroundColor: color }} />
      )}
    </div>
  );
}

// ─── Live Thumbnail ───────────────────────────────────────────────────────────

function LiveThumbnail({ html, status, color }: { html: string; status: WorkbenchStatus; color: string }) {
  // Scale a 1280×800 iframe to fill the card preview area
  // Container: full card width × 240px tall
  // iframe: 1280×800 → scaled by 0.30 = 384×240px
  const IFRAME_W = 1280;
  const IFRAME_H = 800;
  const SCALE = 0.30;

  return (
    <div
      className="relative bg-zinc-950 rounded overflow-hidden"
      style={{ height: `${IFRAME_H * SCALE}px`, width: `${IFRAME_W * SCALE}px`, maxWidth: "100%" }}
    >
      {html ? (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${IFRAME_W}px`,
              height: `${IFRAME_H}px`,
              transform: `scale(${SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              srcDoc={html}
              sandbox="allow-scripts"
              title="Live preview"
              style={{ width: `${IFRAME_W}px`, height: `${IFRAME_H}px`, border: "none", pointerEvents: "none" }}
            />
          </div>
          {/* LIVE pulse overlay during building */}
          {status === "building" && (
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[8px] font-bold text-amber-400">LIVE</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-1 text-lg font-black"
              style={{ border: `2px solid ${color}30`, color: `${color}60` }}
            >
              {status === "building" ? "⚡" : "◻"}
            </div>
            <p className="text-[8px] text-zinc-600">
              {status === "building" ? "Generating..." : "No preview yet"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WorkbenchCard ────────────────────────────────────────────────────────────

interface WorkbenchCardProps {
  slot: WorkbenchSlot;
  isOpen: boolean;
  onSendOut: () => void;
  onRecall: () => void;
  onLockWinner: () => void;
}

export default function WorkbenchCard({
  slot,
  isOpen,
  onSendOut,
  onRecall,
  onLockWinner,
}: WorkbenchCardProps) {
  const toggleSelected = useWorkbenchStore((s) => s.toggleSlotSelected);
  const meta = PROVIDER_META[slot.provider] ?? { color: "#71717a", name: slot.provider };
  const statusCfg = STATUS_CONFIG[slot.status];
  const borderColor = slot.selected ? `${meta.color}60` : `${meta.color}18`;
  const glowShadow  = slot.status === "building" ? `0 0 16px ${meta.color}18` : "none";

  return (
    <div
      className="flex flex-col rounded-xl border transition-all cursor-pointer h-full"
      style={{ borderColor, backgroundColor: "#0c0c0f", boxShadow: glowShadow, minWidth: "400px" }}
      onClick={() => toggleSelected(slot.slot)}
      title={slot.selected ? "Click to deselect from broadcast" : "Click to select for broadcast"}
    >
      {/* Row 1: monitor label + status */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0"
            style={{ border: `1.5px solid ${meta.color}40`, color: meta.color }}
          >
            {slot.monitorNumber}
          </div>
          <span className="text-[9px] font-mono font-bold text-zinc-500">MON {slot.monitorNumber}</span>
          {slot.selected && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold">✓</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dotCls)} />
          <span className="text-[8px] font-bold tracking-wider text-zinc-500">{statusCfg.label}</span>
        </div>
      </div>

      {/* Row 2: Model selector */}
      <div className="px-3 pb-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <ModelDropdown slot={slot} />
      </div>

      {/* Row 3: Thumbnail */}
      <div className="px-3 pb-2 flex-shrink-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
        <LiveThumbnail html={slot.previewHtml} status={slot.status} color={meta.color} />
      </div>

      {/* Row 4: Progress bar */}
      <div className="px-3 pb-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <WorkbenchProgress status={slot.status} color={meta.color} />
      </div>

      {/* Row 5: Controls */}
      <div
        className="flex items-center gap-1 px-3 py-2 border-t flex-shrink-0"
        style={{ borderColor: `${meta.color}12` }}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen ? (
          <button
            onClick={onRecall}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold bg-red-500/8 hover:bg-red-500/15 text-red-400 border border-red-500/15 transition-all"
          >
            <MonitorOff className="h-3 w-3" /> Recall
          </button>
        ) : (
          <button
            onClick={onSendOut}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all"
            style={{ background: `${meta.color}10`, color: meta.color, border: `1px solid ${meta.color}25` }}
          >
            <MonitorUp className="h-3 w-3" /> Send Out
          </button>
        )}
        {slot.lastCode && (
          <button
            onClick={onLockWinner}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all"
            title="Lock this as winner — loads into main builder"
          >
            <Trophy className="h-3 w-3" /> Lock Winner
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes workbench-sweep {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
