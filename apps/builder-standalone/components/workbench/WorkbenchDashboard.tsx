"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Send, Rocket, MonitorOff } from "lucide-react";
import { useWorkbenchStore } from "@/lib/stores/workbenchStore";
import {
  WORKBENCH_CHANNEL,
  checkWindowManagement,
  prefetchScreens,
  launchWorkbenchSlot,
  recallWorkbenchSlot,
  recallAllWorkbench,
  isWorkbenchSlotOpen,
  broadcastWorkbenchPrompt,
  getWorkbenchOpenCount,
} from "@/lib/workbenchPopoutManager";
import WorkbenchCard from "./WorkbenchCard";
import { cn } from "@/lib/utils";

// ─── WorkbenchDashboard ───────────────────────────────────────────────────────

export default function WorkbenchDashboard() {
  const {
    slots,
    setActive,
    setSlotStatus,
    setSlotPreview,
    resetSlotStatuses,
    lockWinner,
  } = useWorkbenchStore();

  const [prompt,        setPrompt]        = useState("");
  const [openCount,     setOpenCount]     = useState(0);
  const [launching,     setLaunching]     = useState(false);
  const [workspaceOn,   setWorkspaceOn]   = useState(false);
  const [compareImage,  setCompareImage]  = useState<string | null>(null);
  const [dragOver,      setDragOver]      = useState(false);

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Pre-cache screen layout on mount + position main window on Monitor 4
  useEffect(() => {
    checkWindowManagement().then((s) => {
      if (s === "granted" || s === "prompt") prefetchScreens();
    });

    // Attempt to move this window to Monitor 4 (0-indexed: screens[3])
    const positionOnMonitor4 = async () => {
      try {
        if (!("getScreenDetails" in window)) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const details = await (window as any).getScreenDetails();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const screens = details.screens as any[];
        if (screens.length >= 4) {
          const mon4 = screens[3];
          window.moveTo(mon4.left, mon4.top);
          window.resizeTo(mon4.width, mon4.height);
        }
      } catch { /* permission denied or API unsupported — silent fail */ }
    };
    positionOnMonitor4();
  }, []);

  // Poll open window count
  useEffect(() => {
    if (!workspaceOn) return;
    const id = setInterval(() => {
      const n = getWorkbenchOpenCount();
      setOpenCount(n);
      if (n === 0) setWorkspaceOn(false);
    }, 2000);
    return () => clearInterval(id);
  }, [workspaceOn]);

  // Receive messages from popout windows
  useEffect(() => {
    const ch = new BroadcastChannel(WORKBENCH_CHANNEL);
    ch.onmessage = (e) => {
      const { type, slot, status, html, code } = e.data ?? {};
      if (type === "STATUS"       && slot != null) setSlotStatus(slot, status);
      if (type === "PREVIEW_HTML" && slot != null && html) {
        useWorkbenchStore.getState().setSlotPreview(slot, html, code ?? "");
      }
      if (type === "CODE"         && slot != null && code) {
        const prev = useWorkbenchStore.getState().slots.find((s) => s.slot === slot);
        useWorkbenchStore.getState().setSlotPreview(slot, prev?.previewHtml ?? html ?? "", code);
      }
    };
    return () => ch.close();
  }, [setSlotStatus]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleLaunchAll = useCallback(() => {
    setLaunching(true);
    let opened = 0;
    slots.forEach((s, i) => {
      const ok = launchWorkbenchSlot(s.slot, s.monitorNumber, s.provider, s.model, i);
      if (ok) opened++;
    });
    if (opened > 0) {
      setWorkspaceOn(true);
      setOpenCount(opened);
    }
    setLaunching(false);
  }, [slots]);

  const handleRecallAll = useCallback(() => {
    recallAllWorkbench();
    setWorkspaceOn(false);
    setOpenCount(0);
    resetSlotStatuses();
  }, [resetSlotStatuses]);

  const handleSendOut = useCallback((slot: number, monitorNumber: number, provider: string, model: string, idx: number) => {
    const ok = launchWorkbenchSlot(slot, monitorNumber, provider, model, idx);
    if (ok) {
      setWorkspaceOn(true);
      setOpenCount(getWorkbenchOpenCount());
    }
  }, []);

  const handleRecallSlot = useCallback((slot: number) => {
    recallWorkbenchSlot(slot);
    setSlotStatus(slot, "idle");
    setOpenCount(getWorkbenchOpenCount());
  }, [setSlotStatus]);

  const handleSend = useCallback(() => {
    const text = prompt.trim();
    if (!text) return;
    const selectedSlots = slots.filter((s) => s.selected);
    if (selectedSlots.length === 0) return;
    if (selectedSlots.length === slots.length) {
      // all selected → broadcast null (all)
      broadcastWorkbenchPrompt(text, null);
    } else {
      // targeted
      selectedSlots.forEach((s) => broadcastWorkbenchPrompt(text, s.slot));
    }
    setPrompt("");
  }, [prompt, slots]);

  const handleLockWinner = useCallback((slot: number) => {
    lockWinner(slot);
    // workbenchStore.lockWinner sets active=false, which triggers page.tsx to load the code
  }, [lockWinner]);

  const handleExit = useCallback(() => {
    recallAllWorkbench();
    setActive(false);
  }, [setActive]);

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setCompareImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) { loadImageFile(file); e.preventDefault(); return; }
      }
    }
  }, [loadImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  // ─── Grid layout ─────────────────────────────────────────────────────────────
  // Physical layout:
  //   [slot1=Mon5]  [slot2=Mon1]  [slot3=Mon3]
  //   [slot4=Mon6]  [MON 4=here] [slot5=Mon2]

  const [s1, s2, s3, s4, s5] = slots;

  const selectedCount = slots.filter((s) => s.selected).length;

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <span className="text-base">🔧</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">Workbench</h1>
            <p className="text-[10px] text-zinc-500">5-Monitor Builder Command Center</p>
          </div>
          {workspaceOn && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/8 border border-emerald-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400">{openCount} LIVE</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLaunchAll}
            disabled={launching || workspaceOn}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40"
            title={workspaceOn ? "Already launched" : "Open all monitor popouts"}
          >
            <Rocket className="h-3.5 w-3.5" /> Launch All
          </button>
          <button
            onClick={handleRecallAll}
            disabled={!workspaceOn}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/8 hover:bg-red-500/15 text-red-400 border border-red-500/15 transition-all disabled:opacity-40"
            title={!workspaceOn ? "No windows open" : "Close all monitor popouts"}
          >
            <MonitorOff className="h-3.5 w-3.5" /> Recall All
          </button>
          <button
            onClick={handleExit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-700/30 transition-all"
          >
            <X className="h-3 w-3" /> Exit
          </button>
        </div>
      </div>

      {/* ── Monitor Grid ── */}
      <div className="flex-1 min-h-0 p-4 flex flex-col gap-3 overflow-hidden">
        {/* Row 1: Mon5 | Mon1 | Mon3 */}
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 overflow-hidden">
          {[s1, s2, s3].map((slot, i) => slot && (
            <WorkbenchCard
              key={slot.slot}
              slot={slot}
              isOpen={isWorkbenchSlotOpen(slot.slot)}
              onSendOut={() => handleSendOut(slot.slot, slot.monitorNumber, slot.provider, slot.model, i)}
              onRecall={() => handleRecallSlot(slot.slot)}
              onLockWinner={() => handleLockWinner(slot.slot)}
            />
          ))}
        </div>

        {/* Row 2: Mon6 | [MON 4 = THIS SCREEN] | Mon2 */}
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 overflow-hidden">
          {/* Slot 4 = Mon6 */}
          {s4 && (
            <WorkbenchCard
              slot={s4}
              isOpen={isWorkbenchSlotOpen(s4.slot)}
              onSendOut={() => handleSendOut(s4.slot, s4.monitorNumber, s4.provider, s4.model, 3)}
              onRecall={() => handleRecallSlot(s4.slot)}
              onLockWinner={() => handleLockWinner(s4.slot)}
            />
          )}

          {/* Center: MON 4 placeholder */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800/40 bg-zinc-900/20 h-full"
               style={{ minWidth: "400px" }}>
            <div className="w-10 h-10 rounded-xl border-2 border-zinc-700/40 flex items-center justify-center text-lg font-black text-zinc-600 mb-2">
              4
            </div>
            <p className="text-[10px] font-mono font-bold text-zinc-600">MON 4</p>
            <p className="text-[9px] text-zinc-700 mt-0.5">Command Center</p>
            <p className="text-[9px] text-zinc-700">(This Screen)</p>
          </div>

          {/* Slot 5 = Mon2 */}
          {s5 && (
            <WorkbenchCard
              slot={s5}
              isOpen={isWorkbenchSlotOpen(s5.slot)}
              onSendOut={() => handleSendOut(s5.slot, s5.monitorNumber, s5.provider, s5.model, 4)}
              onRecall={() => handleRecallSlot(s5.slot)}
              onLockWinner={() => handleLockWinner(s5.slot)}
            />
          )}
        </div>
      </div>

      {/* ── Prompt Bar ── */}
      <div className="border-t border-zinc-800/60 bg-zinc-900/40 px-6 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col gap-3">

          {/* ── Broadcast Target Row — centered, big ── */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
              Broadcast To
            </span>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {slots.map((s) => {
                const colors = ["#a855f7", "#3b82f6", "#22c55e", "#ec4899", "#f97316"];
                const c = colors[s.slot - 1] ?? "#71717a";
                return (
                  <button
                    key={s.slot}
                    onClick={() => useWorkbenchStore.getState().toggleSlotSelected(s.slot)}
                    className="px-5 py-2.5 rounded-xl text-sm font-black border-2 transition-all hover:scale-105"
                    style={
                      s.selected
                        ? { backgroundColor: `${c}20`, borderColor: `${c}70`, color: c, boxShadow: `0 0 12px ${c}30` }
                        : { backgroundColor: "transparent", borderColor: "#3f3f46", color: "#52525b" }
                    }
                  >
                    MON {s.monitorNumber}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  const allSelected = slots.every((s) => s.selected);
                  if (allSelected) {
                    slots.forEach((s) => { if (s.selected) useWorkbenchStore.getState().toggleSlotSelected(s.slot); });
                  } else {
                    slots.forEach((s) => { if (!s.selected) useWorkbenchStore.getState().toggleSlotSelected(s.slot); });
                  }
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-all"
              >
                {slots.every((s) => s.selected) ? "Deselect All" : "All"}
              </button>
              <span className="text-xs font-bold text-zinc-600 self-center pl-2">
                {selectedCount} / 5
              </span>
            </div>
          </div>

          {/* Comparison image preview */}
          {compareImage && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40">
              <img
                src={compareImage}
                alt="Reference"
                className="h-20 rounded-lg border border-zinc-600 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-300">📎 Comparison reference</p>
                <p className="text-xs text-zinc-500 mt-0.5">Paste or drag images to compare — describe what to change</p>
              </div>
              <button
                onClick={() => setCompareImage(null)}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-700 hover:bg-red-500 text-zinc-300 text-sm font-bold flex items-center justify-center transition-colors"
              >
                ×
              </button>
            </div>
          )}

          {/* Input row — drag/drop target */}
          <div
            className={cn(
              "flex gap-3 rounded-2xl transition-all",
              dragOver && "ring-2 ring-indigo-500/60 bg-indigo-500/5"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              onPaste={handlePaste}
              placeholder={
                dragOver
                  ? "Drop image here…"
                  : selectedCount === 0
                  ? "Select monitors above to broadcast…"
                  : `Send to ${selectedCount === slots.length ? "all 5 monitors" : `${selectedCount} monitor${selectedCount !== 1 ? "s" : ""}`}… (Enter to send — paste/drop screenshot to compare)`
              }
              rows={2}
              disabled={selectedCount === 0}
              className="flex-1 resize-none rounded-2xl bg-zinc-800 px-5 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-500 disabled:opacity-40 min-h-[52px] max-h-[120px]"
            />
            <button
              onClick={handleSend}
              disabled={!prompt.trim() || selectedCount === 0}
              className="px-6 rounded-2xl text-white font-black text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-all hover:scale-105 flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {selectedCount === slots.length ? "Send to All" : "Send"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
