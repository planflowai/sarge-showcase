"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldCheck, Zap, Monitor, Send, Radio, Target, Shield,
  Rocket, X, AlertTriangle, Activity,
} from "lucide-react";
import { useWarRoomStore, MODE_SLOT_IDS, type WarRoomMode } from "@/lib/stores/warRoomStore";
import type { MonitorSlot } from "@/lib/stores/warRoomStore";
import {
  checkWindowManagement,
  prefetchScreens,
  launchPopouts,
  launchSingleSlot,
  getUnopenedSlotIds,
  recallAllPopouts,
  broadcastPrompt,
  getOpenWindowCount,
  isSlotOpen,
  type PermissionStatus,
} from "@/lib/popoutManager";
import { cn } from "@/lib/utils";
import { providers } from "@/lib/providers";

// ─── Constants ─────────────────────────────────────────────

const MODES: { id: WarRoomMode; label: string }[] = [
  { id: "single", label: "1" },
  { id: "2-way", label: "2" },
  { id: "3-way", label: "3" },
  { id: "4-way", label: "4" },
];

const PROVIDER_META: Record<string, { icon: string; color: string; bg: string; gradient: string }> = {
  anthropic: { icon: "A", color: "#d97706", bg: "rgba(217,119,6,0.10)", gradient: "radial-gradient(ellipse at 30% 20%, rgba(217,119,6,0.06) 0%, rgba(217,119,6,0.02) 50%, transparent 80%)" },
  openai:    { icon: "O", color: "#10b981", bg: "rgba(16,185,129,0.10)", gradient: "radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 50%, transparent 80%)" },
  google:    { icon: "G", color: "#3b82f6", bg: "rgba(59,130,246,0.10)", gradient: "radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.02) 50%, transparent 80%)" },
  xai:       { icon: "X", color: "#ec4899", bg: "rgba(236,72,153,0.10)", gradient: "radial-gradient(ellipse at 30% 20%, rgba(236,72,153,0.06) 0%, rgba(236,72,153,0.02) 50%, transparent 80%)" },
  deepseek:  { icon: "D", color: "#6366f1", bg: "rgba(99,102,241,0.10)", gradient: "radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.02) 50%, transparent 80%)" },
  ollama:    { icon: "L", color: "#fbbf24", bg: "rgba(251,191,36,0.10)", gradient: "radial-gradient(ellipse at 30% 20%, rgba(251,191,36,0.06) 0%, rgba(251,191,36,0.02) 50%, transparent 80%)" },
  lmstudio:  { icon: "S", color: "#22c55e", bg: "rgba(34,197,94,0.10)", gradient: "radial-gradient(ellipse at 30% 20%, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 50%, transparent 80%)" },
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Anthropic", openai: "OpenAI", google: "Google",
  xai: "xAI", deepseek: "DeepSeek", ollama: "Ollama", lmstudio: "LM Studio",
};

const CLOUD_PILL_LABELS: Record<string, string> = {
  anthropic: "Claude", openai: "GPT", google: "Gemini",
  xai: "Grok", deepseek: "DeepSeek",
};

const CLOUD_PROVIDERS = providers.filter((p) => p.type === "cloud");
const OLLAMA_PROVIDER = providers.find((p) => p.id === "ollama");
const LMSTUDIO_PROVIDER = providers.find((p) => p.id === "lmstudio");

function getModelShortName(model: string): string {
  if (model.includes("claude")) {
    const parts = model.replace("claude-", "").split("-");
    const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const ver = parts.slice(1).filter((p) => !p.match(/^\d{8}$/)).join(".");
    return `Claude ${name} ${ver}`.trim();
  }
  if (model.includes("gpt-4o")) return "GPT-4o";
  if (model.includes("gpt-4")) return "GPT-4";
  if (model.includes("grok")) return model.charAt(0).toUpperCase() + model.slice(1).replace("-", " ");
  if (model.includes("gemini")) return model.replace("gemini-", "Gemini ").replace("-pro", " Pro").replace("-flash", " Flash");
  if (model.includes("deepseek")) return "DeepSeek Chat";
  return model;
}

// ─── Model Card ────────────────────────────────────────────

function ModelCard({
  slot, isLive, isDirectTarget, onDirectSelect, sendMode, responseText, tokens,
}: {
  slot: MonitorSlot;
  isLive: boolean;
  isDirectTarget: boolean;
  onDirectSelect: () => void;
  sendMode: "broadcast" | "direct";
  responseText: string;
  tokens: number;
}) {
  const meta = PROVIDER_META[slot.provider] ?? { icon: "?", color: "#71717a", bg: "rgba(113,113,122,0.08)", gradient: "none" };
  const isStreaming = slot.status === "streaming";
  const isError = slot.status === "error";
  const previewRef = useRef<HTMLDivElement>(null);
  const setSlotProvider = useWarRoomStore((s) => s.setSlotProvider);
  const setSlotModel = useWarRoomStore((s) => s.setSlotModel);

  // Auto-scroll preview to bottom
  useEffect(() => {
    if (previewRef.current) previewRef.current.scrollTop = previewRef.current.scrollHeight;
  }, [responseText]);

  return (
    <div
      onClick={sendMode === "direct" ? onDirectSelect : undefined}
      className={cn(
        "relative flex flex-col overflow-hidden transition-all duration-300",
        isDirectTarget && "ring-2 ring-amber-500/50",
        sendMode === "direct" && "cursor-pointer",
        !slot.enabled && "opacity-20 grayscale"
      )}
      style={{
        background: meta.gradient,
        backgroundColor: "#0c0c0f",
        boxShadow: isLive
          ? `inset 0 0 60px ${meta.color}08, 0 0 1px ${meta.color}30`
          : `inset 0 0 40px ${meta.color}04, 0 0 1px ${meta.color}15`,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: `${meta.color}${isLive ? "35" : "18"}`,
      }}
    >
      {/* ── Card Header — Model Picker ── */}
      <div
        className="px-4 py-2"
        style={{
          background: meta.bg,
          borderBottom: `1px solid ${meta.color}15`,
        }}
      >
        {/* Top: Monitor label + Status */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono font-bold text-zinc-600 tracking-wider">
            MON {slot.monitorNumber}
          </span>
          {isLive ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 tracking-wider">LIVE</span>
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[9px] font-bold text-red-400 tracking-wider">ERR</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}15` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${meta.color}50` }} />
              <span className="text-[9px] font-bold tracking-wider" style={{ color: `${meta.color}80` }}>IDLE</span>
            </span>
          )}
        </div>

        {/* Cloud provider pills */}
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider w-10 flex-shrink-0">Cloud</span>
          <div className="flex gap-0.5 flex-wrap">
            {CLOUD_PROVIDERS.map((p) => {
              const selected = slot.provider === p.id;
              const pColor = PROVIDER_META[p.id]?.color ?? "#71717a";
              return (
                <button
                  key={p.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlotProvider(slot.id, p.id);
                    setSlotModel(slot.id, p.models[0]?.id ?? "");
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all",
                    selected ? "text-black" : "text-zinc-600 hover:text-zinc-300 bg-zinc-800/50"
                  )}
                  style={selected ? { backgroundColor: pColor, boxShadow: `0 0 8px ${pColor}40` } : {}}
                >
                  {CLOUD_PILL_LABELS[p.id] ?? p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Local (Ollama) pills */}
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider w-10 flex-shrink-0">Local</span>
          <div className="flex gap-0.5 flex-wrap">
            {OLLAMA_PROVIDER && OLLAMA_PROVIDER.models.length > 0 ? (
              OLLAMA_PROVIDER.models.map((m) => {
                const selected = slot.provider === "ollama" && slot.model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlotProvider(slot.id, "ollama");
                      setSlotModel(slot.id, m.id);
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all",
                      selected ? "text-black" : "text-zinc-600 hover:text-zinc-300 bg-zinc-800/50"
                    )}
                    style={selected ? { backgroundColor: PROVIDER_META.ollama?.color ?? "#fbbf24" } : {}}
                  >
                    {m.name}
                  </button>
                );
              })
            ) : (
              <span className="text-[8px] text-zinc-700 italic">—</span>
            )}
          </div>
        </div>

        {/* LM Studio pills */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider w-10 flex-shrink-0">Studio</span>
          <div className="flex gap-0.5 flex-wrap">
            {LMSTUDIO_PROVIDER && LMSTUDIO_PROVIDER.models.length > 0 ? (
              LMSTUDIO_PROVIDER.models.map((m) => {
                const selected = slot.provider === "lmstudio" && slot.model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlotProvider(slot.id, "lmstudio");
                      setSlotModel(slot.id, m.id);
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all",
                      selected ? "text-black" : "text-zinc-600 hover:text-zinc-300 bg-zinc-800/50"
                    )}
                    style={selected ? { backgroundColor: PROVIDER_META.lmstudio?.color ?? "#22c55e" } : {}}
                  >
                    {m.name}
                  </button>
                );
              })
            ) : (
              <span className="text-[8px] text-zinc-700 italic">—</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Response Preview Area ── */}
      <div
        ref={previewRef}
        className="flex-1 px-5 py-4 overflow-y-auto font-mono text-xs leading-relaxed scrollbar-thin"
      >
        {responseText ? (
          <div className="text-zinc-400 whitespace-pre-wrap break-words">
            {responseText}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm" style={{ backgroundColor: meta.color }} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              {/* Large breathing icon — 120px */}
              <div
                className="w-[120px] h-[120px] rounded-3xl flex items-center justify-center mx-auto mb-4"
                style={{
                  color: meta.color,
                  fontSize: "56px",
                  fontWeight: 900,
                  border: `3px solid ${meta.color}30`,
                  boxShadow: `0 0 30px ${meta.color}15, 0 0 60px ${meta.color}08`,
                  animation: "breathe 3s ease-in-out infinite",
                }}
              >
                {meta.icon}
              </div>
              <div className="text-[12px] font-semibold tracking-wide" style={{ color: `${meta.color}90` }}>
                {isLive ? "Waiting for response..." : "Launch to activate"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Token / Status Footer ── */}
      <div
        className="flex items-center justify-between px-5 py-2 bg-black/30"
        style={{ borderTop: `1px solid ${meta.color}12` }}
      >
        <div className="flex-1 mr-4">
          <div className="h-1 w-full rounded-full bg-zinc-800/80 overflow-hidden">
            {isStreaming ? (
              <div className="h-full rounded-full w-full" style={{
                background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
                animation: "shimmer 1.5s ease-in-out infinite",
              }} />
            ) : isLive ? (
              <div className="h-full rounded-full w-full transition-all duration-500" style={{ backgroundColor: `${meta.color}40` }} />
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-600">
          {tokens > 0 && <span>{tokens.toLocaleString()} tok</span>}
          {isDirectTarget && (
            <span className="flex items-center gap-0.5 text-amber-500 font-bold">
              <Target className="h-2.5 w-2.5" />
              TARGET
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

export default function WarRoom() {
  const [input, setInput] = useState("");
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [permStatus, setPermStatus] = useState<PermissionStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [stepMode, setStepMode] = useState(false);
  const [stepQueue, setStepQueue] = useState<string[]>([]);

  // Per-slot response state from BroadcastChannel
  const [slotResponses, setSlotResponses] = useState<Record<string, string>>({});
  const [slotTokens, setSlotTokens] = useState<Record<string, number>>({});

  const mode = useWarRoomStore((s) => s.mode);
  const setMode = useWarRoomStore((s) => s.setMode);
  const sendMode = useWarRoomStore((s) => s.sendMode);
  const setSendMode = useWarRoomStore((s) => s.setSendMode);
  const directTarget = useWarRoomStore((s) => s.directTarget);
  const setDirectTarget = useWarRoomStore((s) => s.setDirectTarget);
  const slots = useWarRoomStore((s) => s.slots);
  const guardianActive = useWarRoomStore((s) => s.guardianActive);

  const modeSlotIds = MODE_SLOT_IDS[mode];
  const visibleSlots = slots.filter((s) => modeSlotIds.includes(s.id));
  const activeSlots = visibleSlots.filter((s) => s.enabled);

  // Pre-cache screens on mount
  useEffect(() => {
    checkWindowManagement().then((status) => {
      setPermStatus(status);
      if (status === "granted" || status === "prompt") prefetchScreens();
    });
  }, []);

  // Poll open windows
  useEffect(() => {
    if (!workspaceActive) return;
    const interval = setInterval(() => {
      const count = getOpenWindowCount();
      setOpenCount(count);
      if (count === 0) setWorkspaceActive(false);
    }, 2000);
    return () => clearInterval(interval);
  }, [workspaceActive]);

  // Listen for responses from popout windows via BroadcastChannel
  useEffect(() => {
    const ch = new BroadcastChannel("sarge-warroom");
    ch.onmessage = (e) => {
      const { type, payload } = e.data ?? {};
      if (type === "RESPONSE_CHUNK" && payload?.slotId && payload?.text) {
        setSlotResponses((prev) => ({
          ...prev,
          [payload.slotId]: (prev[payload.slotId] ?? "") + payload.text,
        }));
      }
      if (type === "RESPONSE_DONE" && payload?.slotId) {
        if (payload.tokens) {
          setSlotTokens((prev) => ({ ...prev, [payload.slotId]: payload.tokens }));
        }
      }
      if (type === "RESPONSE_START" && payload?.slotId) {
        // Clear previous response for this slot when new one starts
        setSlotResponses((prev) => ({ ...prev, [payload.slotId]: "" }));
        setSlotTokens((prev) => ({ ...prev, [payload.slotId]: 0 }));
      }
    };
    return () => ch.close();
  }, []);

  // ─── Launch ───
  const handleLaunch = useCallback(() => {
    setLaunchError(null);

    if (stepMode && stepQueue.length > 0) {
      const nextSlotId = stepQueue[0];
      const slot = visibleSlots.find((s) => s.id === nextSlotId);
      if (slot) {
        const ok = launchSingleSlot(slot, activeSlots.indexOf(slot));
        if (ok) {
          const remaining = stepQueue.slice(1);
          setStepQueue(remaining);
          setOpenCount(getOpenWindowCount());
          setWorkspaceActive(true);
          if (remaining.length === 0) { setStepMode(false); setLaunchError(null); }
        }
      }
      return;
    }

    setLaunching(true);
    const result = launchPopouts(visibleSlots);
    if (!result.success) {
      setLaunchError("Popups blocked — allow popups for localhost:3004");
    } else {
      setWorkspaceActive(true);
      setOpenCount(result.opened.length);
      if (result.failed.length > 0) {
        setStepMode(true);
        setStepQueue(getUnopenedSlotIds(visibleSlots));
      }
    }
    checkWindowManagement().then(setPermStatus);
    setLaunching(false);
  }, [visibleSlots, activeSlots, stepMode, stepQueue]);

  const handleRecall = useCallback(() => {
    recallAllPopouts();
    setWorkspaceActive(false);
    setOpenCount(0);
    setStepMode(false);
    setStepQueue([]);
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    // Clear all response previews for new broadcast
    setSlotResponses({});
    setSlotTokens({});
    // Send prompt to all popout windows via BroadcastChannel
    broadcastPrompt(input.trim(), sendMode === "direct" ? (directTarget ?? undefined) : undefined);
    setInput("");
  }, [input, sendMode, directTarget]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Grid: full width, full height, no max-width
  const gridClass = cn(
    "grid flex-1 gap-0",
    mode === "single" && "grid-cols-1",
    mode === "2-way" && "grid-cols-2",
    mode === "3-way" && "grid-cols-3",
    mode === "4-way" && "grid-cols-2 grid-rows-2",
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <div className="h-10 flex items-center justify-between px-4 bg-zinc-900/50 border-b border-zinc-800/40 flex-shrink-0 relative">
        {/* Left: Mode pills */}
        <div className="flex items-center gap-0.5 bg-zinc-800/40 rounded-lg p-0.5 border border-zinc-800/60">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "w-7 h-6 rounded text-[11px] font-black transition-all",
                mode === m.id
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Center: Branding */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="relative">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <Zap className="h-1.5 w-1.5 text-amber-400 absolute -right-0.5 -bottom-0.5" />
          </div>
          <span className="text-[11px] font-bold text-zinc-500 tracking-wide">
            <span className="text-indigo-400 font-black">S</span>.A.R.G.E.
            <span className="text-red-400/50 ml-1 text-[9px] tracking-widest uppercase">War Room</span>
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border",
            guardianActive ? "border-emerald-500/20 text-emerald-500/60" : "border-zinc-800 text-zinc-700"
          )}>
            <Shield className="h-2.5 w-2.5" />
            GUARD
          </div>

          {workspaceActive && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/8 border border-emerald-500/15">
              <Activity className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400">{openCount}</span>
            </div>
          )}

          {workspaceActive && !stepMode ? (
            <button onClick={handleRecall}
              className="flex items-center gap-1 px-2 py-1 bg-red-500/8 hover:bg-red-500/15 text-red-400 rounded border border-red-500/15 text-[9px] font-bold transition-all">
              <X className="h-2.5 w-2.5" /> RECALL
            </button>
          ) : stepMode && stepQueue.length > 0 ? (
            <button onClick={handleLaunch}
              className="flex items-center gap-1 px-2 py-1 bg-amber-500/8 hover:bg-amber-500/15 text-amber-400 rounded border border-amber-500/15 text-[9px] font-bold animate-pulse">
              <Monitor className="h-2.5 w-2.5" /> MON {slots.find((s) => s.id === stepQueue[0])?.monitorNumber} ({stepQueue.length})
            </button>
          ) : (
            <button onClick={handleLaunch} disabled={launching || activeSlots.length === 0}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-500/8 hover:bg-indigo-500/15 text-indigo-400 rounded border border-indigo-500/15 text-[9px] font-bold transition-all disabled:opacity-20">
              <Rocket className="h-2.5 w-2.5" /> LAUNCH
            </button>
          )}
        </div>
      </div>

      {/* Error / Step banner */}
      {(launchError || (stepMode && stepQueue.length > 0)) && (
        <div className="px-4 py-1 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-2">
          <AlertTriangle className="h-2.5 w-2.5 text-amber-500/50" />
          <span className="text-[9px] text-amber-400/60 flex-1">
            {stepMode ? `Step-launch: ${stepQueue.length} remaining. Allow popups for one-click.` : launchError}
          </span>
          <button onClick={() => { setLaunchError(null); setStepMode(false); setStepQueue([]); }}>
            <X className="h-2.5 w-2.5 text-amber-500/30 hover:text-amber-400" />
          </button>
        </div>
      )}

      {/* ═══ MAIN CANVAS — Full Viewport Model Cards ═══ */}
      <div className={gridClass}>
        {visibleSlots.map((slot) => (
          <ModelCard
            key={slot.id}
            slot={slot}
            isLive={workspaceActive && isSlotOpen(slot.id)}
            isDirectTarget={sendMode === "direct" && directTarget === slot.id}
            onDirectSelect={() => setDirectTarget(slot.id)}
            sendMode={sendMode}
            responseText={slotResponses[slot.id] ?? ""}
            tokens={slotTokens[slot.id] ?? 0}
          />
        ))}
      </div>

      {/* ═══ BOTTOM INPUT BAR — Full Width ═══ */}
      <div className="flex-shrink-0 border-t border-zinc-800/40 bg-zinc-900/30 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Broadcast/Direct toggle */}
          <button
            onClick={() => setSendMode(sendMode === "broadcast" ? "direct" : "broadcast")}
            className={cn(
              "flex items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-bold border transition-all flex-shrink-0",
              sendMode === "broadcast"
                ? "border-indigo-500/25 bg-indigo-500/8 text-indigo-400"
                : "border-amber-500/25 bg-amber-500/8 text-amber-400"
            )}
          >
            {sendMode === "broadcast" ? <Radio className="h-3 w-3" /> : <Target className="h-3 w-3" />}
            {sendMode === "broadcast" ? "ALL" : "1:1"}
          </button>

          {/* Input — full width */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !workspaceActive ? "Launch workspace to begin broadcasting..."
                : sendMode === "broadcast" ? `Broadcast to ${openCount} monitors — Enter to send`
                : directTarget ? `Direct to ${slots.find((s) => s.id === directTarget)?.label} — Enter to send`
                : "Click a card to select target..."
            }
            rows={1}
            className="flex-1 bg-zinc-800/40 border border-zinc-700/30 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40 resize-none"
          />

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || (sendMode === "direct" && !directTarget) || !workspaceActive}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-[11px] transition-all flex-shrink-0",
              sendMode === "broadcast"
                ? "bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-zinc-800 disabled:text-zinc-700"
                : "bg-amber-600 hover:bg-amber-500 text-white disabled:bg-zinc-800 disabled:text-zinc-700"
            )}
          >
            <Send className="h-3.5 w-3.5" />
            {sendMode === "broadcast" ? "BROADCAST" : "SEND"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.04); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
