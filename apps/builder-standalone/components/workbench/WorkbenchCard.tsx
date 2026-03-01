"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MonitorUp, MonitorOff, Trophy, ChevronDown, RotateCcw, Eye, Code2, Star } from "lucide-react";
import { recallWorkbenchSlot, sendWorkbenchConfig } from "@/lib/workbenchPopoutManager";
import { useWorkbenchStore, type WorkbenchSlot, type WorkbenchStatus } from "@/lib/stores/workbenchStore";
import { promoteToAnchor } from "@/lib/pitBroadcastEngine";
import { useBuilderStore } from "@sarge/builder/index.client";
import { useUIStore } from "@sarge/core";
import { providers, fetchOllamaModels } from "@sarge/core";
import type { LocalModel } from "@sarge/core";
import { cn } from "@/lib/utils";

// ─── Provider meta ───────────────────────────────────────────────────────────

const CLOUD_PROVIDERS = providers.filter((p) => p.type === "cloud");

const PROVIDER_META: Record<string, { color: string; name: string }> = {
  ollama: { color: "#22c55e", name: "Ollama" },
};
for (const p of providers) PROVIDER_META[p.id] = { color: p.color, name: p.name };

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkbenchStatus, { label: string; dotCls: string }> = {
  idle:     { label: "IDLE",     dotCls: "bg-zinc-500" },
  building: { label: "BUILDING", dotCls: "bg-amber-400 animate-pulse" },
  complete: { label: "COMPLETE", dotCls: "bg-emerald-400" },
  error:    { label: "ERROR",    dotCls: "bg-red-500" },
};

// ─── Metrics display ──────────────────────────────────────────────────────────

function formatMetrics(slot: WorkbenchSlot): string {
  if (slot.status === "building") {
    if (slot.tokenCount > 0) {
      return `${slot.tokenCount.toLocaleString()} tokens · ${slot.tokensPerSec} tok/s`;
    }
    return "Starting...";
  }
  if (slot.status === "complete" && slot.completedAt && slot.startedAt) {
    const elapsed = (slot.completedAt - slot.startedAt) / 1000;
    if (elapsed >= 60) {
      return `Complete · ${(elapsed / 60).toFixed(1)}min`;
    }
    return `Complete · ${elapsed.toFixed(1)}s`;
  }
  if (slot.status === "error") {
    return slot.errorMsg ? slot.errorMsg.slice(0, 60) : "Failed";
  }
  return "";
}

// ─── Model Dropdown (cloud + local) ─────────────────────────────────────────

function ModelDropdown({ slot }: { slot: WorkbenchSlot }) {
  const [open, setOpen]               = useState(false);
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setSlotProvider = useWorkbenchStore((s) => s.setSlotProvider);
  const setSlotModel    = useWorkbenchStore((s) => s.setSlotModel);

  const meta = PROVIDER_META[slot.provider] ?? { color: "#71717a", name: slot.provider };
  const cloudProvider = CLOUD_PROVIDERS.find((p) => p.id === slot.provider);
  const cloudModel    = cloudProvider?.models.find((m) => m.id === slot.model);
  const isOllama      = slot.provider === "ollama";
  const displayName   = isOllama ? (slot.model || "Select model") : (cloudModel?.name ?? slot.model ?? "Select model");

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Fetch Ollama models when opening dropdown
  const handleOpen = useCallback(() => {
    setOpen((o) => !o);
    if (ollamaModels.length === 0) {
      setOllamaLoading(true);
      fetchOllamaModels()
        .then(setOllamaModels)
        .catch(() => setOllamaModels([]))
        .finally(() => setOllamaLoading(false));
    }
  }, [ollamaModels.length]);

  const pickModel = useCallback((provider: string, modelId: string) => {
    setSlotProvider(slot.slot, provider);
    setSlotModel(slot.slot, modelId);
    sendWorkbenchConfig(slot.slot, provider, modelId);
    setOpen(false);
  }, [slot.slot, setSlotProvider, setSlotModel]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-semibold border bg-zinc-100 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-700 dark:text-zinc-200 transition-colors"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
        <span className="truncate flex-1 text-left">{displayName}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-80 overflow-y-auto rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl">

          {/* ── Local / Ollama ── */}
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2 sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Local — Ollama
          </div>
          {ollamaLoading ? (
            <div className="px-4 py-3 text-xs text-zinc-500">Checking Ollama…</div>
          ) : ollamaModels.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-600">Ollama not running</div>
          ) : (
            ollamaModels.map((m) => (
              <button
                key={m.id}
                onClick={() => pickModel("ollama", m.id)}
                className={cn(
                  "w-full text-left px-4 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                  isOllama && slot.model === m.id
                    ? "text-emerald-300 bg-emerald-900/20"
                    : "text-zinc-300"
                )}
              >
                {m.name || m.id}
              </button>
            ))
          )}

          {/* ── Cloud providers ── */}
          {CLOUD_PROVIDERS.map((provider) => (
            <div key={provider.id}>
              <div
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 sticky top-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800"
                style={{ color: provider.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: provider.color }} />
                {provider.name}
              </div>
              {provider.models.filter((m) => m.isEnabled).map((model) => (
                <button
                  key={model.id}
                  onClick={() => pickModel(provider.id, model.id)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                    !isOllama && slot.provider === provider.id && slot.model === model.id
                      ? "text-indigo-300 bg-indigo-900/20"
                      : "text-zinc-300"
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
    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
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

// ─── Live Thumbnail (fills full card width dynamically) ───────────────────────

function LiveThumbnail({ html, status, color, modelName, providerName }: { html: string; status: WorkbenchStatus; color: string; modelName: string; providerName: string }) {
  const IFRAME_W = 1280;
  const IFRAME_H = 800;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.40);

  // ResizeObserver: scale = containerWidth / IFRAME_W
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setScale(w / IFRAME_W);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative bg-zinc-100 dark:bg-zinc-950 rounded-lg overflow-hidden w-full"
      style={{ height: `${IFRAME_H * scale}px` }}
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
              transform: `scale(${scale})`,
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
          {status === "building" && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-bold text-amber-400 tracking-wide">LIVE</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-full min-h-[120px]">
          <div className="text-center flex flex-col items-center justify-center">
            <p className="text-[22px] font-bold mb-2" style={{ color }}>
              {modelName}
            </p>
            <p className={cn(
              "text-xs font-medium",
              status === "error" ? "text-red-400" : "text-zinc-400 dark:text-zinc-600"
            )}>
              {status === "building" ? "Generating…" : status === "error" ? "Build failed" : "Waiting for broadcast..."}
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
  const setSlotStatus  = useWorkbenchStore((s) => s.setSlotStatus);
  const showToast      = useUIStore((s) => s.showToast);
  const projectPath    = useBuilderStore((s) => s.projectPath);
  const projectName    = useBuilderStore((s) => s.projectName);
  const meta      = PROVIDER_META[slot.provider] ?? { color: "#71717a", name: slot.provider };
  const statusCfg = STATUS_CONFIG[slot.status];

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [ctxMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Monitor 1 gets gold border, others get model brand color
  const isAnchor     = slot.monitorNumber === 1;
  const cardBorder   = isAnchor ? "#FFD700" : meta.color;
  const borderColor  = `${cardBorder}${slot.selected ? "90" : "50"}`;
  const glowShadow   = slot.status === "building"
    ? `0 0 24px ${cardBorder}30`
    : slot.selected ? `0 0 12px ${cardBorder}20` : "none";

  // Resolve display model name from cloud providers
  const cloudProvider = CLOUD_PROVIDERS.find((p) => p.id === slot.provider);
  const cloudModel    = cloudProvider?.models.find((m) => m.id === slot.model);
  const isOllama      = slot.provider === "ollama" || slot.provider === "lmstudio";
  const displayModelName = isOllama ? (slot.model || "No model") : (cloudModel?.name ?? slot.model ?? "No model");

  return (
    <div
      className="flex flex-col transition-all cursor-pointer h-full overflow-hidden bg-white dark:bg-[#0c0c0f]"
      style={{ border: `2px solid ${borderColor}`, borderRadius: "12px", boxShadow: glowShadow }}
      onClick={() => toggleSelected(slot.slot)}
      onContextMenu={handleContextMenu}
      title={slot.selected ? "Click to deselect" : "Click to select for broadcast"}
    >
      {/* Row 1: MON left | model name centered | status right */}
      <div className="relative flex items-center px-4 pt-3 pb-2 flex-shrink-0">
        {/* Left: MON badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
            style={{ border: `2px solid ${cardBorder}50`, color: cardBorder, background: `${cardBorder}12` }}
          >
            {slot.monitorNumber}
          </div>
          <p className="text-sm font-black text-zinc-700 dark:text-zinc-200 tracking-wide">MON {slot.monitorNumber}</p>
          {slot.selected && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 font-black">✓</span>
          )}
        </div>
        {/* Center: model name — absolutely positioned for true center */}
        <p className="absolute left-1/2 -translate-x-1/2 text-[16px] font-bold truncate max-w-[55%] text-center" style={{ color: meta.color }}>{displayModelName}</p>
        {/* Right: anchor badge + status */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {isAnchor && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider" style={{ backgroundColor: "#FFD70020", color: "#FFD700", border: "1px solid #FFD70040" }}>
              ANCHOR
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", statusCfg.dotCls)} />
            <span className="text-[11px] font-bold tracking-widest text-zinc-400">{statusCfg.label}</span>
          </div>
        </div>
      </div>

      {/* Metrics bar — shows token count during build, completion time when done */}
      {(slot.status === "building" || slot.status === "complete" || slot.status === "error") && (
        <div className="px-4 pb-1 flex-shrink-0">
          <p className={cn(
            "text-[11px] font-mono font-semibold truncate",
            slot.status === "building" ? "text-amber-400" :
            slot.status === "error" ? "text-red-400" :
            "text-emerald-400"
          )}>
            {formatMetrics(slot)}
          </p>
        </div>
      )}

      {/* Row 2: Model selector (cloud + local) */}
      <div className="px-4 pb-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <ModelDropdown slot={slot} />
      </div>

      {/* Row 3: Thumbnail — fills card width */}
      <div className="px-4 pb-3 flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
        <LiveThumbnail html={slot.previewHtml} status={slot.status} color={meta.color} modelName={displayModelName} providerName={meta.name} />
      </div>

      {/* Row 4: Progress bar */}
      <div className="px-4 pb-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <WorkbenchProgress status={slot.status} color={meta.color} />
      </div>

      {/* Row 5: Controls */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-t flex-shrink-0"
        style={{ borderColor: `${meta.color}15` }}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen ? (
          <button
            onClick={onRecall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
          >
            <MonitorOff className="h-3.5 w-3.5" /> Recall
          </button>
        ) : (
          <button
            onClick={onSendOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}
          >
            <MonitorUp className="h-3.5 w-3.5" /> Send Out
          </button>
        )}
        {slot.lastCode && (
          <button
            onClick={onLockWinner}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/12 hover:bg-amber-500/25 text-amber-400 border border-amber-500/25 transition-all"
            title="Lock this as winner — loads into builder"
          >
            <Trophy className="h-3.5 w-3.5" /> Lock Winner
          </button>
        )}
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-[9999] min-w-[180px] rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl py-1 overflow-hidden"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
            onClick={() => { onRecall(); setCtxMenu(null); }}
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-400" /> Recall this monitor
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
            onClick={async () => {
              // Promote: copy this slot's code to anchor (Mon 1)
              const ok = await promoteToAnchor(slot.slot, projectPath, projectName);
              if (ok) {
                showToast({ message: `Mon ${slot.monitorNumber} promoted to anchor`, type: "success" });
              } else {
                showToast({ message: "Promote failed — no project open or no code", type: "error" });
              }
              setCtxMenu(null);
            }}
          >
            <Star className="w-3.5 h-3.5 text-amber-400" /> Promote to anchor
          </button>
          {slot.lastCode && (
            <>
              <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
              <button
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                onClick={() => {
                  // View code — open in new window
                  const w = window.open("", "_blank", "width=800,height=600");
                  if (w) { w.document.write(`<html><head><title>Code — Mon ${slot.monitorNumber}</title><style>body{background:#0a0a0a;color:#e4e4e7;font-family:monospace;white-space:pre-wrap;padding:24px;font-size:13px;}</style></head><body>${slot.lastCode.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</body></html>`); w.document.close(); }
                  setCtxMenu(null);
                }}
              >
                <Code2 className="w-3.5 h-3.5 text-blue-400" /> View code
              </button>
              <button
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                onClick={() => {
                  // View preview — open rendered HTML in new window
                  const w = window.open("", "_blank", "width=1024,height=768");
                  if (w) { w.document.write(slot.lastCode); w.document.close(); }
                  setCtxMenu(null);
                }}
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" /> View preview
              </button>
            </>
          )}
          <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
          <button
            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
            onClick={() => {
              setSlotStatus(slot.slot, "idle");
              setCtxMenu(null);
            }}
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-500" /> Reset
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes workbench-sweep {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
