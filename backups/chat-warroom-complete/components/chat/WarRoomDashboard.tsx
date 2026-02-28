"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Send, Rocket, X, Copy, Check, GitCompare, ShieldCheck,
  MonitorOff, MonitorUp, Columns2, Columns3, Grid2X2,
  ChevronDown, Trash2, Paperclip, Save,
  ImageIcon, ClipboardCopy, MessageSquare, Mic, Sparkles,
} from "lucide-react";
import { useParallelChatStore } from "@/lib/stores/parallelChatStore";
import { useWarRoomStore, MODE_SLOT_IDS, type WarRoomMode, type MonitorSlot, type SlotStatus } from "@/lib/stores/warRoomStore";
import { providers } from "@/lib/providers";
import { fetchOllamaModels, type LocalModel } from "@/lib/providers/localModels";
import {
  checkWindowManagement,
  prefetchScreens,
  launchPopouts,
  launchSingleSlot,
  recallAllPopouts,
  recallSlot,
  relaunchSlot,
  broadcastPrompt,
  getOpenWindowCount,
  getUnopenedSlotIds,
  isSlotOpen,
} from "@/lib/popoutManager";

// ─── Constants ──────────────────────────────────────────────

const CLOUD_PROVIDERS = providers.filter((p) => p.type === "cloud");

const PROVIDER_META: Record<string, { color: string; name: string }> = {};
for (const p of providers) {
  PROVIDER_META[p.id] = { color: p.color, name: p.name };
}

// ─── Progress Bar ───────────────────────────────────────────

function ProgressBar({ status, color, tokens }: { status: SlotStatus; color: string; tokens: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
        {status === "streaming" && (
          <div
            className="h-full w-full rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
              backgroundSize: "200% 100%",
              animation: "war-progress-sweep 1.5s ease-in-out infinite",
            }}
          />
        )}
        {status === "complete" && (
          <div
            className="h-full rounded-full w-full transition-all duration-500"
            style={{ backgroundColor: color }}
          />
        )}
        {status === "error" && (
          <div className="h-full rounded-full w-full bg-red-500" />
        )}
      </div>
      {tokens > 0 && (
        <span className="text-[9px] font-mono text-zinc-500 flex-shrink-0 w-14 text-right">
          {tokens.toLocaleString()} tok
        </span>
      )}
    </div>
  );
}

// ─── Cloud Model Dropdown ───────────────────────────────────

function CloudDropdown({ slot }: { slot: MonitorSlot }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setSlotProvider = useWarRoomStore((s) => s.setSlotProvider);
  const setSlotModel = useWarRoomStore((s) => s.setSlotModel);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isCloud = CLOUD_PROVIDERS.some((p) => p.id === slot.provider);
  const currentProvider = CLOUD_PROVIDERS.find((p) => p.id === slot.provider);
  const currentModel = currentProvider?.models.find((m) => m.id === slot.model);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-bold border transition-all ${
          isCloud
            ? "bg-blue-500/10 border-blue-500/25 text-blue-400"
            : "bg-zinc-800/60 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isCloud ? "bg-blue-400" : "bg-zinc-600"}`} />
        <span className="max-w-[100px] truncate">{currentModel?.name ?? "Cloud"}</span>
        <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-56 max-h-72 overflow-y-auto rounded-lg border border-zinc-700/50 bg-zinc-900 shadow-2xl scrollbar-thin">
          {CLOUD_PROVIDERS.map((provider) => (
            <div key={provider.id}>
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 sticky top-0 bg-zinc-900">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: provider.color }} />
                {provider.name}
              </div>
              {provider.models
                .filter((m) => m.isEnabled)
                .map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSlotProvider(slot.id, provider.id);
                      setSlotModel(slot.id, model.id);
                      // Notify open popout of model change
                      const ch = new BroadcastChannel("sarge-warroom");
                      ch.postMessage({ type: "CONFIG_UPDATE", payload: { slotId: slot.id, provider: provider.id, model: model.id } });
                      ch.close();
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-zinc-800 transition-colors ${
                      slot.model === model.id ? "bg-blue-900/30 text-blue-300" : "text-zinc-300"
                    }`}
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

// ─── Ollama Model Dropdown ──────────────────────────────────

function OllamaDropdown({ slot, models }: { slot: MonitorSlot; models: LocalModel[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setSlotProvider = useWarRoomStore((s) => s.setSlotProvider);
  const setSlotModel = useWarRoomStore((s) => s.setSlotModel);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isOllama = slot.provider === "ollama";
  const currentModel = models.find((m) => m.id === slot.model);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-bold border transition-all ${
          isOllama
            ? "bg-orange-500/10 border-orange-500/25 text-orange-400"
            : "bg-zinc-800/60 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOllama ? "bg-orange-400" : "bg-zinc-600"}`} />
        <span className="max-w-[100px] truncate">
          {isOllama ? ((currentModel?.name ?? slot.model) || "Ollama") : "Ollama"}
        </span>
        <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-52 max-h-72 overflow-y-auto rounded-lg border border-zinc-700/50 bg-zinc-900 shadow-2xl scrollbar-thin">
          {models.length === 0 ? (
            <div className="px-3 py-3 text-[10px] text-zinc-500 italic text-center">
              No Ollama models
              <br />
              <span className="text-zinc-600">Is Ollama running?</span>
            </div>
          ) : (
            models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSlotProvider(slot.id, "ollama");
                  setSlotModel(slot.id, model.id);
                  // Notify open popout of model change
                  const ch = new BroadcastChannel("sarge-warroom");
                  ch.postMessage({ type: "CONFIG_UPDATE", payload: { slotId: slot.id, provider: "ollama", model: model.id } });
                  ch.close();
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-zinc-800 transition-colors ${
                  isOllama && slot.model === model.id
                    ? "bg-orange-900/30 text-orange-300"
                    : "text-zinc-300"
                }`}
              >
                {model.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status Card (compact — no text, just progress) ────────

function StatusCard({
  slot,
  isLive,
  tokens,
  ollamaModels,
  onRecall,
  onSendOut,
  onClear,
}: {
  slot: MonitorSlot;
  isLive: boolean;
  tokens: number;
  ollamaModels: LocalModel[];
  onRecall: () => void;
  onSendOut: () => void;
  onClear: () => void;
}) {
  const meta = PROVIDER_META[slot.provider] ?? { color: "#71717a", name: slot.provider };

  const statusConfig = {
    idle: { label: "IDLE", dotCls: "bg-zinc-500" },
    streaming: { label: "WRITING", dotCls: "bg-amber-400 animate-pulse" },
    complete: { label: "COMPLETE", dotCls: "bg-emerald-400" },
    error: { label: "ERROR", dotCls: "bg-red-500" },
    offline: { label: "OFFLINE", dotCls: "bg-zinc-700" },
  }[slot.status] ?? { label: "\u2014", dotCls: "bg-zinc-700" };

  return (
    <div
      className="flex flex-col rounded-xl border transition-all"
      style={{
        borderColor: `${meta.color}${isLive ? "40" : "18"}`,
        backgroundColor: "#0c0c0f",
        boxShadow: slot.status === "streaming" ? `0 0 20px ${meta.color}10` : "none",
      }}
    >
      {/* Row 1: MON label + status */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-black"
            style={{ border: `2px solid ${meta.color}40`, color: meta.color }}
          >
            {(meta.name?.[0] ?? "?").toUpperCase()}
          </div>
          <span className="text-[10px] font-mono font-bold text-zinc-500">
            MON {slot.monitorNumber}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotCls}`} />
          <span className="text-[9px] font-bold tracking-wider text-zinc-500">
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Row 2: Cloud + Ollama dropdowns + clear */}
      <div className="flex items-center gap-1.5 px-4 py-1.5">
        <CloudDropdown slot={slot} />
        <OllamaDropdown slot={slot} models={ollamaModels} />
        <button
          onClick={onClear}
          className="ml-auto h-6 w-6 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Clear"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Row 3: Progress bar */}
      <div className="px-4 py-2">
        <ProgressBar status={slot.status} color={meta.color} tokens={tokens} />
      </div>

      {/* Row 4: Controls */}
      <div
        className="flex items-center gap-1.5 px-4 py-2 border-t"
        style={{ borderColor: `${meta.color}10` }}
      >
        {isLive ? (
          <button
            onClick={onRecall}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-500/8 hover:bg-red-500/15 text-red-400 border border-red-500/15 transition-all"
          >
            <MonitorOff className="h-3 w-3" /> Recall
          </button>
        ) : slot.status === "offline" ? (
          <button
            onClick={onSendOut}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
            style={{
              background: `${meta.color}08`,
              color: meta.color,
              border: `1px solid ${meta.color}20`,
            }}
          >
            <MonitorUp className="h-3 w-3" /> Send Out
          </button>
        ) : (
          <span className="text-[9px] text-zinc-600 italic">Not launched</span>
        )}
      </div>
    </div>
  );
}

// ─── Mode Options ───────────────────────────────────────────

const MODE_OPTIONS: { id: WarRoomMode; label: string; icon: React.ReactNode }[] = [
  { id: "2-way", label: "2-Way", icon: <Columns2 className="h-3.5 w-3.5" /> },
  { id: "3-way", label: "3-Way", icon: <Columns3 className="h-3.5 w-3.5" /> },
  { id: "4-way", label: "4-Way", icon: <Grid2X2 className="h-3.5 w-3.5" /> },
];

// ─── Dashboard (main export) ────────────────────────────────

export function WarRoomDashboard() {
  const [input, setInput] = useState("");
  const [workspaceActive, setWorkspaceActive] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [stepMode, setStepMode] = useState(false);
  const [stepQueue, setStepQueue] = useState<string[]>([]);
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);

  // Per-slot response data — stored for Copy/Compare but NOT displayed as text
  const [slotResponses, setSlotResponses] = useState<Record<string, string>>({});
  const [slotTokens, setSlotTokens] = useState<Record<string, number>>({});

  // Toolbar confirmation states
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedAnswers, setCopiedAnswers] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);

  const mode = useWarRoomStore((s) => s.mode);
  const setMode = useWarRoomStore((s) => s.setMode);
  const slots = useWarRoomStore((s) => s.slots);
  const setSlotStatus = useWarRoomStore((s) => s.setSlotStatus);
  const setEnabled = useWarRoomStore((s) => s.setEnabled);

  const modeSlotIds = MODE_SLOT_IDS[mode];
  const visibleSlots = slots.filter((s) => modeSlotIds.includes(s.id));
  const activeSlots = visibleSlots.filter((s) => s.enabled);

  // ─── Effects ───

  // Pre-cache screens on mount
  useEffect(() => {
    checkWindowManagement().then((status) => {
      if (status === "granted" || status === "prompt") prefetchScreens();
    });
  }, []);

  // Fetch Ollama models
  useEffect(() => {
    fetchOllamaModels()
      .then(setOllamaModels)
      .catch(() => setOllamaModels([]));
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
      if (type === "RESPONSE_START" && payload?.slotId) {
        setSlotResponses((prev) => ({ ...prev, [payload.slotId]: "" }));
        setSlotTokens((prev) => ({ ...prev, [payload.slotId]: 0 }));
        setSlotStatus(payload.slotId, "streaming");
      }
      if (type === "RESPONSE_CHUNK" && payload?.slotId && payload?.text) {
        setSlotResponses((prev) => ({
          ...prev,
          [payload.slotId]: (prev[payload.slotId] ?? "") + payload.text,
        }));
      }
      if (type === "RESPONSE_DONE" && payload?.slotId) {
        if (payload.tokens)
          setSlotTokens((prev) => ({ ...prev, [payload.slotId]: payload.tokens }));
        setSlotStatus(payload.slotId, payload.error ? "error" : "complete");
      }
    };
    return () => ch.close();
  }, [setSlotStatus]);

  // ─── Handlers ───

  const handleLaunch = useCallback(() => {
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
          if (remaining.length === 0) setStepMode(false);
        }
      }
      return;
    }

    setLaunching(true);
    const result = launchPopouts(visibleSlots);
    if (result.success) {
      setWorkspaceActive(true);
      setOpenCount(result.opened.length);
      if (result.failed.length > 0) {
        setStepMode(true);
        setStepQueue(getUnopenedSlotIds(visibleSlots));
      }
    }
    setLaunching(false);
  }, [visibleSlots, activeSlots, stepMode, stepQueue]);

  const handleRecallAll = useCallback(() => {
    recallAllPopouts();
    setWorkspaceActive(false);
    setOpenCount(0);
    setStepMode(false);
    setStepQueue([]);
    for (const slot of visibleSlots) setSlotStatus(slot.id, "idle");
    setSlotResponses({});
    setSlotTokens({});
  }, [visibleSlots, setSlotStatus]);

  const handleRecallSlot = useCallback(
    (slotId: string) => {
      recallSlot(slotId);
      setSlotStatus(slotId, "offline");
      setOpenCount(getOpenWindowCount());
    },
    [setSlotStatus],
  );

  const handleSendOut = useCallback(
    (slot: MonitorSlot) => {
      const ok = relaunchSlot(slot);
      if (ok) {
        setSlotStatus(slot.id, "idle");
        setWorkspaceActive(true);
        setOpenCount(getOpenWindowCount());
      }
    },
    [setSlotStatus],
  );

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    setSlotResponses({});
    setSlotTokens({});
    for (const s of activeSlots) setSlotStatus(s.id, "idle");
    broadcastPrompt(input.trim());
    setInput("");
  }, [input, activeSlots, setSlotStatus]);

  // ── Toolbar actions ──

  const handleCopyAll = useCallback(() => {
    const texts = visibleSlots
      .map((s) => {
        const text = slotResponses[s.id];
        if (!text) return null;
        const name = `${PROVIDER_META[s.provider]?.name ?? s.provider} (Mon ${s.monitorNumber})`;
        return `\u2500\u2500 ${name} \u2500\u2500\n${text}`;
      })
      .filter(Boolean)
      .join("\n\n");
    if (texts) {
      navigator.clipboard.writeText(texts);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  }, [visibleSlots, slotResponses]);

  const handleCopyAnswers = useCallback(() => {
    const texts = visibleSlots
      .map((s) => slotResponses[s.id])
      .filter(Boolean)
      .join("\n\n---\n\n");
    if (texts) {
      navigator.clipboard.writeText(texts);
      setCopiedAnswers(true);
      setTimeout(() => setCopiedAnswers(false), 2000);
    }
  }, [visibleSlots, slotResponses]);

  const handleSave = useCallback(() => {
    try {
      const session = {
        timestamp: Date.now(),
        mode,
        slots: visibleSlots.map((s) => ({
          id: s.id,
          provider: s.provider,
          model: s.model,
          response: slotResponses[s.id] ?? "",
          tokens: slotTokens[s.id] ?? 0,
        })),
      };
      const sessions = JSON.parse(localStorage.getItem("warroom-sessions") ?? "[]");
      sessions.unshift(session);
      localStorage.setItem("warroom-sessions", JSON.stringify(sessions.slice(0, 20)));
      setSessionSaved(true);
      setTimeout(() => setSessionSaved(false), 2000);
    } catch {
      /* storage error */
    }
  }, [mode, visibleSlots, slotResponses, slotTokens]);

  const handleCompare = useCallback(() => {
    const responses = visibleSlots
      .map((s) => {
        const text = slotResponses[s.id];
        if (!text) return null;
        return `[${PROVIDER_META[s.provider]?.name ?? s.provider}]: ${text}`;
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
    if (responses) {
      const prompt = `Compare these responses and identify key differences, strengths, and weaknesses:\n\n${responses}`;
      setSlotResponses({});
      setSlotTokens({});
      broadcastPrompt(prompt);
    }
  }, [visibleSlots, slotResponses]);

  const handleCrossCheck = useCallback(() => {
    const slotsWithResponses = visibleSlots.filter((s) => slotResponses[s.id]);
    if (slotsWithResponses.length < 2) return;
    for (let i = 0; i < slotsWithResponses.length; i++) {
      const checker = slotsWithResponses[i];
      const target = slotsWithResponses[(i + 1) % slotsWithResponses.length];
      const targetName = PROVIDER_META[target.provider]?.name ?? target.provider;
      const prompt = `Evaluate this response from ${targetName} for accuracy, completeness, and potential issues:\n\n${slotResponses[target.id]}`;
      const ch = new BroadcastChannel("sarge-warroom");
      ch.postMessage({
        type: "PROMPT",
        payload: { text: prompt, target: checker.id, timestamp: Date.now() },
      });
      ch.close();
    }
    setSlotResponses({});
    setSlotTokens({});
  }, [visibleSlots, slotResponses]);

  const handleClearAll = useCallback(() => {
    setSlotResponses({});
    setSlotTokens({});
    for (const slot of visibleSlots) {
      if (slot.status === "complete" || slot.status === "error")
        setSlotStatus(slot.id, "idle");
    }
    const ch = new BroadcastChannel("sarge-warroom");
    ch.postMessage({ type: "CLEAR" });
    ch.close();
  }, [visibleSlots, setSlotStatus]);

  const handleClearSlot = useCallback(
    (slotId: string) => {
      setSlotResponses((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      setSlotTokens((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      const slot = visibleSlots.find((s) => s.id === slotId);
      if (slot && (slot.status === "complete" || slot.status === "error"))
        setSlotStatus(slotId, "idle");
    },
    [visibleSlots, setSlotStatus],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Grid layout
  const gridClass =
    mode === "2-way"
      ? "grid-cols-2"
      : mode === "3-way"
        ? "grid-cols-3"
        : "grid-cols-2 grid-rows-2";

  const hasResponses = visibleSlots.some((s) => slotResponses[s.id]);

  const tbtn =
    "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/30 transition-all disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800/50">
        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-1 border border-zinc-800/50">
          {MODE_OPTIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                mode === m.id
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopyAll} disabled={!hasResponses} className={tbtn}>
            {copiedAll ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copiedAll ? "Copied!" : "Copy All"}
          </button>
          <button onClick={handleCopyAnswers} disabled={!hasResponses} className={tbtn}>
            {copiedAnswers ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copiedAnswers ? "Copied!" : "Copy Answers"}
          </button>
          <button onClick={handleCrossCheck} disabled={!hasResponses} className={tbtn}>
            <ShieldCheck className="h-3 w-3" /> Cross-check
          </button>
          <button onClick={handleSave} className={tbtn}>
            {sessionSaved ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {sessionSaved ? "Saved!" : "Save"}
          </button>
          <button
            onClick={handleClearAll}
            disabled={!hasResponses}
            className={`${tbtn} hover:!text-red-400`}
          >
            <Trash2 className="h-3 w-3" /> Clear All
          </button>
        </div>

        {/* Workspace Controls */}
        <div className="flex items-center gap-2">
          {workspaceActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/8 border border-emerald-500/15 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold">{openCount} LIVE</span>
            </div>
          )}
          {workspaceActive ? (
            <button
              onClick={handleRecallAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/8 hover:bg-red-500/15 text-red-400 border border-red-500/15 transition-all"
            >
              <X className="h-3 w-3" /> Recall All
            </button>
          ) : stepMode && stepQueue.length > 0 ? (
            <button
              onClick={handleLaunch}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 animate-pulse transition-all"
            >
              <MonitorUp className="h-3.5 w-3.5" />
              MON {slots.find((s) => s.id === stepQueue[0])?.monitorNumber} (
              {stepQueue.length} left)
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={launching || activeSlots.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-30"
            >
              <Rocket className="h-3.5 w-3.5" /> LAUNCH
            </button>
          )}
        </div>
      </div>

      {/* ═══ CARDS GRID ═══ */}
      <div className={`grid ${gridClass} gap-3 p-4 flex-1 overflow-auto`}>
        {visibleSlots.map((slot) => (
          <StatusCard
            key={slot.id}
            slot={slot}
            isLive={workspaceActive && isSlotOpen(slot.id)}
            tokens={slotTokens[slot.id] ?? 0}
            ollamaModels={ollamaModels}
            onRecall={() => handleRecallSlot(slot.id)}
            onSendOut={() => handleSendOut(slot)}
            onClear={() => handleClearSlot(slot.id)}
          />
        ))}
      </div>

      {/* ═══ INPUT BAR (matches Single Chat InputArea) ═══ */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 px-4 pt-3 pb-3">
        <div className="mx-auto max-w-5xl">
          {/* Textarea — same style as single chat */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !workspaceActive
                ? "Launch workspace to begin broadcasting..."
                : `Type a message to send to all models... (Enter to send, Shift+Enter for new line)`
            }
            rows={2}
            className="w-full resize-none rounded-lg bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none border border-zinc-300 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-600 min-h-[44px] max-h-[160px]"
          />

          {/* Bottom action bar — same icons as single chat */}
          <div className="flex items-center justify-center gap-1 mt-2">
            {/* Generate Image */}
            <button
              onClick={() => {
                setInput("Generate an image: ");
              }}
              disabled={!workspaceActive}
              title="Generate image"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors disabled:opacity-30"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            {/* Copy All Responses */}
            <button
              onClick={handleCopyAll}
              disabled={!hasResponses}
              title="Copy all responses"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors disabled:opacity-30"
            >
              {copiedAll ? (
                <Check className="h-5 w-5 text-emerald-400" />
              ) : (
                <ClipboardCopy className="h-5 w-5" />
              )}
            </button>

            {/* Compare */}
            <button
              onClick={handleCompare}
              disabled={!hasResponses}
              title="Compare all responses"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-amber-500 dark:hover:text-amber-400 transition-colors disabled:opacity-30"
            >
              <MessageSquare className="h-5 w-5" />
            </button>

            {/* Switch to Multi-Chat */}
            <button
              onClick={() => {
                setEnabled(false);
                const pc = useParallelChatStore.getState();
                if (!pc.enabled) pc.toggleParallelMode();
              }}
              title="Switch to Multi-Chat"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              <Sparkles className="h-5 w-5" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />

            {/* Attach */}
            <button
              disabled={!workspaceActive}
              title="Attach files"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors disabled:opacity-30"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* Microphone */}
            <button
              disabled
              title="Voice input"
              className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors disabled:opacity-30"
            >
              <Mic className="h-5 w-5" />
            </button>

            {/* Send to All */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || !workspaceActive}
              title="Send to all monitors"
              className="p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:hover:bg-indigo-600"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CSS Animations ═══ */}
      <style jsx>{`
        @keyframes war-progress-sweep {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
