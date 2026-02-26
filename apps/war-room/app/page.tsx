"use client";

import { useState } from "react";
import { ShieldCheck, Zap, Monitor, Send, Radio, Target, Power, Shield } from "lucide-react";
import { providers } from "@/lib/providers";
import { useWarRoomStore, type WarRoomMode } from "@/lib/stores/warRoomStore";
import { cn } from "@/lib/utils";

const MODES: { id: WarRoomMode; label: string; slots: number }[] = [
  { id: "single", label: "Single", slots: 1 },
  { id: "2-way", label: "2-Way", slots: 2 },
  { id: "3-way", label: "3-Way", slots: 3 },
  { id: "4-way", label: "4-Way", slots: 4 },
];

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  google: "#3b82f6",
  xai: "#ec4899",
  deepseek: "#6366f1",
  ollama: "#fbbf24",
  lmstudio: "#22c55e",
};

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  idle: { dot: "bg-zinc-500", label: "Idle" },
  streaming: { dot: "bg-emerald-400 animate-pulse", label: "Streaming" },
  error: { dot: "bg-red-500", label: "Error" },
  offline: { dot: "bg-zinc-700", label: "Offline" },
};

export default function WarRoom() {
  const [input, setInput] = useState("");

  const mode = useWarRoomStore((s) => s.mode);
  const setMode = useWarRoomStore((s) => s.setMode);
  const sendMode = useWarRoomStore((s) => s.sendMode);
  const setSendMode = useWarRoomStore((s) => s.setSendMode);
  const directTarget = useWarRoomStore((s) => s.directTarget);
  const setDirectTarget = useWarRoomStore((s) => s.setDirectTarget);
  const slots = useWarRoomStore((s) => s.slots);
  const toggleSlot = useWarRoomStore((s) => s.toggleSlot);
  const setSlotProvider = useWarRoomStore((s) => s.setSlotProvider);
  const setSlotModel = useWarRoomStore((s) => s.setSlotModel);
  const guardianActive = useWarRoomStore((s) => s.guardianActive);

  const activeMode = MODES.find((m) => m.id === mode)!;
  const visibleSlots = slots.slice(0, activeMode.slots);
  const activeSlots = visibleSlots.filter((s) => s.enabled);

  const getModelsForProvider = (providerId: string) => {
    const p = providers.find((pr) => pr.id === providerId);
    return p?.models ?? [];
  };

  const getProviderName = (providerId: string) => {
    const p = providers.find((pr) => pr.id === providerId);
    return p?.name ?? providerId;
  };

  const sendLabel =
    sendMode === "broadcast"
      ? `Broadcast to ${activeSlots.length} Monitor${activeSlots.length !== 1 ? "s" : ""}`
      : directTarget
        ? `Send to ${slots.find((s) => s.id === directTarget)?.label ?? "..."}`
        : "Pick a target";

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* ═══ TOP BAR — Mode Selector ═══ */}
      <div className="h-14 flex items-center justify-between px-6 bg-gradient-to-r from-zinc-900 via-indigo-950/20 to-zinc-900 border-b border-zinc-800 shadow-sm">
        {/* Left: SARGE branding */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <Zap className="h-2 w-2 text-amber-400 absolute -right-0.5 -bottom-0.5" />
          </div>
          <span className="text-sm font-bold text-zinc-300 tracking-wide">
            <span className="text-indigo-400 font-black">S</span>.A.R.G.E.
            <span className="text-red-400/70 ml-2 text-xs tracking-widest uppercase font-semibold">War Room</span>
          </span>
        </div>

        {/* Center: Mode selector */}
        <div className="flex items-center bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-700">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-bold transition-all duration-200",
                mode === m.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Right: Monitor count */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Monitor className="h-4 w-4" />
          <span>{activeSlots.length} of {visibleSlots.length} active</span>
        </div>
      </div>

      {/* ═══ MAIN AREA — Sidebar + Center ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT SIDEBAR — Monitor Slots ─── */}
        <div className="w-[260px] flex-shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col overflow-y-auto">
          <div className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600 text-center">
            Monitor Assignment
          </div>

          <div className="flex-1 px-3 pb-3 space-y-2">
            {visibleSlots.map((slot) => {
              const color = PROVIDER_COLORS[slot.provider] ?? "#71717a";
              const models = getModelsForProvider(slot.provider);
              const statusStyle = STATUS_STYLES[slot.status];

              return (
                <div
                  key={slot.id}
                  className={cn(
                    "rounded-xl border p-3 transition-all duration-200",
                    slot.enabled
                      ? "border-zinc-700 bg-zinc-800/60"
                      : "border-zinc-800/50 bg-zinc-900/30 opacity-50"
                  )}
                >
                  {/* Header: label + toggle + status */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: slot.enabled ? color : "#3f3f46" }}
                      />
                      <span className="text-sm font-bold text-zinc-200">{slot.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", statusStyle.dot)} />
                      <button
                        onClick={() => toggleSlot(slot.id)}
                        className={cn(
                          "w-9 h-5 rounded-full transition-all duration-200 relative",
                          slot.enabled
                            ? "bg-indigo-600"
                            : "bg-zinc-700"
                        )}
                      >
                        <div
                          className={cn(
                            "w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all duration-200",
                            slot.enabled ? "left-[18px]" : "left-[3px]"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Provider select */}
                  {slot.enabled && (
                    <div className="space-y-1.5">
                      <select
                        value={slot.provider}
                        onChange={(e) => setSlotProvider(slot.id, e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                      >
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.type})
                          </option>
                        ))}
                      </select>

                      {/* Model select */}
                      <select
                        value={slot.model}
                        onChange={(e) => setSlotModel(slot.id, e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
                      >
                        {models.length === 0 ? (
                          <option value="">(fetch on connect)</option>
                        ) : (
                          models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── CENTER — Chat Input ─── */}
        <div className="flex-1 flex flex-col">
          {/* Send mode toggle + target picker */}
          <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center gap-4">
            {/* Broadcast / Direct toggle */}
            <div className="flex items-center bg-zinc-800/80 rounded-lg p-0.5 border border-zinc-700">
              <button
                onClick={() => setSendMode("broadcast")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                  sendMode === "broadcast"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Radio className="h-3.5 w-3.5" />
                Broadcast
              </button>
              <button
                onClick={() => setSendMode("direct")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                  sendMode === "direct"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Target className="h-3.5 w-3.5" />
                Direct
              </button>
            </div>

            {/* Direct mode: target selector */}
            {sendMode === "direct" && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-500 mr-1">Target:</span>
                {activeSlots.map((slot) => {
                  const color = PROVIDER_COLORS[slot.provider];
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setDirectTarget(slot.id)}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-medium transition-all border",
                        directTarget === slot.id
                          ? "border-amber-500 bg-amber-600/20 text-amber-300"
                          : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                      )}
                    >
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Broadcast info */}
            {sendMode === "broadcast" && (
              <span className="text-xs text-zinc-500">
                Message will be sent to all {activeSlots.length} active monitor{activeSlots.length !== 1 ? "s" : ""} simultaneously
              </span>
            )}
          </div>

          {/* Chat input area */}
          <div className="flex-1 flex flex-col justify-center px-6 py-6">
            <div className="max-w-3xl w-full mx-auto space-y-4">
              {/* Prompt label */}
              <div className="text-sm text-zinc-400 font-medium">
                {sendMode === "broadcast" ? "Broadcast Prompt" : "Direct Prompt"}
              </div>

              {/* Textarea */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your prompt... All active monitors will receive this message."
                rows={6}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 resize-none"
              />

              {/* Send button */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-600">
                  Enter to send, Shift+Enter for new line
                </div>
                <button
                  disabled={!input.trim() || (sendMode === "direct" && !directTarget)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all",
                    sendMode === "broadcast"
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-zinc-800 disabled:text-zinc-600"
                      : "bg-amber-600 hover:bg-amber-500 text-white disabled:bg-zinc-800 disabled:text-zinc-600"
                  )}
                >
                  <Send className="h-4 w-4" />
                  {sendLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM STRIP — Status Bar ═══ */}
      <div className="h-10 flex items-center justify-between px-6 bg-zinc-900/80 border-t border-zinc-800">
        {/* Monitor status pills */}
        <div className="flex items-center gap-3">
          {slots.map((slot, i) => {
            const isVisible = i < activeMode.slots;
            const color = PROVIDER_COLORS[slot.provider];
            const statusStyle = STATUS_STYLES[slot.status];

            if (!isVisible) return null;

            return (
              <div
                key={slot.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-xs border transition-all",
                  slot.enabled
                    ? "border-zinc-700 bg-zinc-800/50 text-zinc-300"
                    : "border-zinc-800/50 bg-zinc-900/30 text-zinc-600"
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slot.enabled ? color : "#3f3f46" }} />
                <span className="font-medium">{slot.label}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-400">{getProviderName(slot.provider)}</span>
                <span className={cn("w-1.5 h-1.5 rounded-full ml-1", statusStyle.dot)} />
              </div>
            );
          })}
        </div>

        {/* Guardian status */}
        <div className="flex items-center gap-3 text-xs">
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
            guardianActive
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-zinc-700 bg-zinc-800/50 text-zinc-500"
          )}>
            <Shield className="h-3 w-3" />
            <span className="font-medium">Guardian {guardianActive ? "Active" : "Off"}</span>
          </div>
          <div className="text-zinc-600">
            War Room v0.1 | Monitor 4
          </div>
        </div>
      </div>
    </div>
  );
}
