"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Send, Rocket, MonitorOff, Plus, FolderOpen, Save, Trash2, Lightbulb, Hammer, Pencil, RefreshCw, Upload, Globe, Package, Download, Copy, BookOpen, Eraser, CheckSquare, Square } from "lucide-react";
import { useWorkbenchStore } from "@/lib/stores/workbenchStore";
import { useBuilderStore, useArtifactStore } from "@sarge/builder/index.client";
import { useUIStore } from "@sarge/core";
import { useDeployStore, type DeployTarget } from "@/lib/stores/deployStore";
import {
  WORKBENCH_CHANNEL,
  checkWindowManagement,
  prefetchScreens,
  getScreenForMonitor,
  launchWorkbenchSlot,
  recallWorkbenchSlot,
  recallAllWorkbench,
  isWorkbenchSlotOpen,
  broadcastWorkbenchPrompt,
  getWorkbenchOpenCount,
} from "@/lib/workbenchPopoutManager";
import { broadcastToAllMonitors, abortAllStreams } from "@/lib/pitBroadcastEngine";
import WorkbenchCard from "./WorkbenchCard";
import { cn } from "@/lib/utils";

// ─── Deploy target definitions ────────────────────────────────────────────────

const DEPLOY_TARGETS: { id: DeployTarget; label: string }[] = [
  { id: "github",     label: "GitHub" },
  { id: "vercel",     label: "Vercel" },
  { id: "netlify",    label: "Netlify" },
  { id: "cloudflare", label: "Cloudflare Pages" },
];

// ─── Target Dropdown (shared by Push and Deploy) ──────────────────────────────

function TargetDropdown({
  targets,
  selected,
  onToggle,
  onConfirm,
  onClose,
  actionLabel,
}: {
  targets: typeof DEPLOY_TARGETS;
  selected: DeployTarget[];
  onToggle: (t: DeployTarget) => void;
  onConfirm: () => void;
  onClose: () => void;
  actionLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 w-56 rounded-xl border bg-zinc-900 dark:bg-zinc-900 border-zinc-700 dark:border-zinc-700 shadow-2xl overflow-hidden"
    >
      {targets.map((t) => {
        const checked = selected.includes(t.id);
        const isGithub = t.id === "github";
        return (
          <button
            key={t.id}
            onClick={() => { if (!isGithub) onToggle(t.id); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors",
              isGithub ? "text-zinc-500 cursor-default" : "text-zinc-300 hover:bg-zinc-800 dark:hover:bg-zinc-800 cursor-pointer"
            )}
          >
            {checked
              ? <CheckSquare className="w-3.5 h-3.5 text-[#FF6700]" />
              : <Square className="w-3.5 h-3.5 text-zinc-600" />
            }
            {t.label}
            {isGithub && <span className="text-zinc-600 text-[10px] ml-auto">required</span>}
          </button>
        );
      })}
      <div className="border-t border-zinc-800 px-3 py-2">
        <button
          onClick={onConfirm}
          disabled={selected.length === 0}
          className="w-full h-8 rounded-lg text-xs font-bold text-white bg-[#FF6700] hover:bg-[#FF6700]/85 disabled:opacity-40 transition-colors"
        >
          {actionLabel} {selected.length} target{selected.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

// ─── Toolbar button style helpers ─────────────────────────────────────────────

const tbBtn = "flex items-center gap-1 h-8 px-3 rounded-md text-xs font-semibold text-zinc-400 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/40 transition-colors";
const tbBtnPrimary = "flex items-center gap-1 h-8 px-3 rounded-md text-xs font-bold text-white bg-[#FF6700]/80 hover:bg-[#FF6700] border border-[#FF6700]/50 transition-colors";
const tbBtnDanger = "flex items-center gap-1 h-8 px-3 rounded-md text-xs font-semibold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-zinc-300 dark:border-zinc-700/40 transition-colors";

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

  const showToast = useUIStore((s) => s.showToast);

  const [prompt,        setPrompt]        = useState("");
  const [openCount,     setOpenCount]     = useState(0);
  const [launching,     setLaunching]     = useState(false);
  const [workspaceOn,   setWorkspaceOn]   = useState(false);
  const [compareImage,  setCompareImage]  = useState<string | null>(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [lastAction,    setLastAction]    = useState("Ready");

  // Push/Deploy dropdown state
  const [showPushDropdown,   setShowPushDropdown]   = useState(false);
  const [showDeployDropdown, setShowDeployDropdown] = useState(false);
  const [pushTargets,   setPushTargets]   = useState<DeployTarget[]>(["github"]);
  const [deployTargets, setDeployTargets] = useState<DeployTarget[]>(["github"]);

  // Project info from builder store
  const projectName = useBuilderStore((s) => s.projectName);
  const projectPath = useBuilderStore((s) => s.projectPath);
  const fileTree    = useBuilderStore((s) => s.fileTree);

  // Deploy store
  const { pushProject, isDeploying } = useDeployStore();

  // ─── Effects ────────────────────────────────────────────────────────────────

  // Pre-cache screen layout on mount + position main window on Monitor 4
  useEffect(() => {
    const initScreens = async () => {
      const status = await checkWindowManagement();
      if (status === "granted" || status === "prompt") {
        await prefetchScreens();
      }

      // Position dashboard on Mon 4 using the same grid detection as popouts
      if (!sessionStorage.getItem("pit-positioned")) {
        const mon4 = getScreenForMonitor(4);
        if (mon4) {
          window.moveTo(mon4.availLeft, mon4.availTop);
          window.resizeTo(mon4.availWidth, mon4.availHeight);
        }
        sessionStorage.setItem("pit-positioned", "1");
      }
    };
    initScreens();
  }, []);

  // Mon 1 (anchor) starts empty — builds only when user broadcasts

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

  const handleLaunchAll = useCallback(async () => {
    setLaunching(true);
    let opened = 0;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const ok = launchWorkbenchSlot(s.slot, s.monitorNumber, s.provider, s.model, i);
      if (ok) opened++;
      // Stagger openings to prevent popup-blocker and focus-steal glitches
      if (i < slots.length - 1) await new Promise((r) => setTimeout(r, 150));
    }
    if (opened > 0) {
      setWorkspaceOn(true);
      setOpenCount(opened);
    }
    setLaunching(false);
  }, [slots]);

  const handleRecallAll = useCallback(() => {
    abortAllStreams();
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

    // Fire parallel streaming builds from the dashboard
    const count = broadcastToAllMonitors(text, projectPath, projectName);

    setPrompt("");
    const msg = `Broadcast sent to ${count} monitor${count !== 1 ? "s" : ""}`;
    setLastAction(msg);
    showToast({ message: msg, type: "success" });
  }, [prompt, slots, showToast, projectPath, projectName]);

  const handleLockWinner = useCallback((slot: number) => {
    lockWinner(slot);
  }, [lockWinner]);

  const handleExit = useCallback(() => {
    recallAllWorkbench();
    setActive(false);
  }, [setActive]);

  // ── Clear all monitors ──
  const handleClear = useCallback(() => {
    abortAllStreams();
    // Clear preview/code then reset status to idle
    const store = useWorkbenchStore.getState();
    store.slots.forEach((s) => {
      // setSlotPreview sets status to "complete", so we set idle after
      store.setSlotPreview(s.slot, "", "");
    });
    store.resetSlotStatuses();
    setLastAction("All monitors cleared");
    showToast({ message: "All monitors cleared", type: "success" });
  }, [showToast]);

  // ── Toolbar action with toast ──
  const toolbarAction = useCallback((action: string, toastMsg: string) => {
    setLastAction(action);
    showToast({ message: toastMsg, type: "success" });
  }, [showToast]);

  // ── Build actions — broadcast to selected monitors ──
  const broadcastBuildAction = useCallback((action: string, promptPrefix: string) => {
    const selectedSlots = slots.filter((s) => s.selected);
    if (selectedSlots.length === 0) {
      showToast({ message: "No monitors selected", type: "warning" });
      return;
    }
    // Use the current prompt text or a default instruction
    const userText = prompt.trim() || "a modern landing page with hero section, features grid, and dark mode";
    const fullPrompt = `${promptPrefix}: ${userText}`;
    const count = broadcastToAllMonitors(fullPrompt, projectPath, projectName);
    setPrompt("");
    const msg = `${action} — sent to ${count} monitor${count !== 1 ? "s" : ""}`;
    setLastAction(msg);
    showToast({ message: msg, type: "success" });
  }, [slots, prompt, showToast, projectPath, projectName]);

  // ── Push handler ──
  const handlePushConfirm = useCallback(async () => {
    setShowPushDropdown(false);
    const toast = useUIStore.getState().showToast;
    if (!projectPath) {
      toast({ message: "No project open — load a project first", type: "error", duration: 6000 });
      return;
    }
    const targetNames = pushTargets.map((t) => DEPLOY_TARGETS.find((d) => d.id === t)?.label ?? t).join(", ");
    setLastAction(`Pushing to ${targetNames}...`);
    toast({ message: `Pushing ${projectName || "project"} to ${targetNames}...`, type: "info", duration: 8000 });
    try {
      await pushProject(projectPath, projectName || "", pushTargets);
      const state = useDeployStore.getState();
      if (state.error) {
        toast({ message: `Push failed: ${state.error}`, type: "error", duration: 8000 });
        setLastAction("Push failed");
      } else if (state.lastPush?.message === "No changes to push") {
        toast({ message: `No changes to push for ${projectName || "project"}`, type: "warning", duration: 6000 });
        setLastAction("No changes to push");
      } else {
        toast({ message: `Successfully pushed ${projectName || "project"} to ${targetNames}`, type: "success", duration: 6000 });
        setLastAction(`Pushed to ${targetNames}`);
      }
    } catch (err: any) {
      toast({ message: `Push error: ${err?.message || "Unknown error"}`, type: "error", duration: 8000 });
      setLastAction("Push error");
    }
  }, [projectPath, projectName, pushTargets, pushProject]);

  // ── Deploy handler ──
  const handleDeployConfirm = useCallback(async () => {
    setShowDeployDropdown(false);
    const toast = useUIStore.getState().showToast;
    if (!projectPath) {
      toast({ message: "No project open — load a project first", type: "error", duration: 6000 });
      return;
    }
    const targetNames = deployTargets.map((t) => DEPLOY_TARGETS.find((d) => d.id === t)?.label ?? t).join(", ");
    setLastAction(`Deploying to ${targetNames}...`);
    toast({ message: `Deploying ${projectName || "project"} to ${targetNames}...`, type: "info", duration: 8000 });
    try {
      await pushProject(projectPath, projectName || "", deployTargets);
      const state = useDeployStore.getState();
      if (state.error) {
        toast({ message: `Deploy failed: ${state.error}`, type: "error", duration: 8000 });
        setLastAction("Deploy failed");
      } else {
        toast({ message: `Successfully deployed ${projectName || "project"} to ${targetNames}`, type: "success", duration: 6000 });
        setLastAction(`Deployed to ${targetNames}`);
      }
    } catch (err: any) {
      toast({ message: `Deploy error: ${err?.message || "Unknown error"}`, type: "error", duration: 8000 });
      setLastAction("Deploy error");
    }
  }, [projectPath, projectName, deployTargets, pushProject]);

  const togglePushTarget = useCallback((t: DeployTarget) => {
    setPushTargets((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }, []);

  const toggleDeployTarget = useCallback((t: DeployTarget) => {
    setDeployTargets((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }, []);

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
  const [s1, s2, s3, s4, s5] = slots;
  const selectedCount = slots.filter((s) => s.selected).length;

  return (
    <div className="flex flex-col h-full w-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden">

      {/* ── Header ── */}
      <div className="relative flex items-center justify-end px-6 py-3 border-b border-zinc-200 dark:border-zinc-800/60 flex-shrink-0 bg-white dark:bg-transparent">
        {/* Centered title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <h1 className="text-4xl font-[800] tracking-[2px] bg-gradient-to-r from-[#FF6700] to-[#FFD700] bg-clip-text text-transparent">THE PIT</h1>
          {workspaceOn && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/8 border border-emerald-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400">{openCount} LIVE</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLaunchAll}
            disabled={launching || workspaceOn}
            className="flex items-center gap-2 h-12 px-6 rounded-lg text-base font-bold bg-[#FF6700] hover:bg-[#FF6700]/85 text-white transition-all disabled:opacity-40"
            title={workspaceOn ? "Already launched" : "Open all monitor popouts"}
          >
            <Rocket className="h-5 w-5" /> Launch All
          </button>
          <button
            onClick={handleRecallAll}
            className="flex items-center gap-2 h-12 px-6 rounded-lg text-base font-bold text-zinc-700 dark:text-white border-2 border-zinc-400 dark:border-white/60 hover:border-zinc-600 dark:hover:border-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-all"
            title="Close all monitor popouts"
          >
            <MonitorOff className="h-5 w-5" /> Recall All
          </button>
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 h-12 px-5 rounded-lg text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/40 transition-all"
          >
            <X className="h-4 w-4" /> Exit
          </button>
        </div>
      </div>

      {/* ── Toolbar — project, build, deploy actions ── */}
      <div className="flex items-center justify-between px-5 py-1.5 bg-zinc-50 dark:bg-[#141414] border-y border-zinc-200 dark:border-zinc-800/40 flex-shrink-0">
        {/* Left: Project management */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => toolbarAction("New project...", "Project created")} className={tbBtn}>
            <Plus className="h-3.5 w-3.5" /> New
          </button>
          <button onClick={() => toolbarAction("Open project...", `Opened: ${projectName || "project"}`)} className={tbBtn}>
            <FolderOpen className="h-3.5 w-3.5" /> Open
          </button>
          <button onClick={() => toolbarAction("Project saved", "Project saved")} className={tbBtn}>
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button onClick={() => toolbarAction("Delete project...", "Project deleted")} className={tbBtnDanger}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={handleClear} className={tbBtn}>
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
        {/* Center: Build actions */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => broadcastBuildAction("Plan", "Plan the architecture and structure for")} className={tbBtn}>
            <Lightbulb className="h-3.5 w-3.5" /> Plan
          </button>
          <button onClick={() => broadcastBuildAction("Build", "Build")} className={tbBtnPrimary}>
            <Hammer className="h-3.5 w-3.5" /> Build
          </button>
          <button onClick={() => broadcastBuildAction("Edit", "Edit and improve the existing code for")} className={tbBtn}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={() => broadcastBuildAction("Regen", "Regenerate from scratch")} className={tbBtn}>
            <RefreshCw className="h-3.5 w-3.5" /> Regen
          </button>
        </div>
        {/* Right: Deploy actions */}
        <div className="flex items-center gap-1.5">
          {/* Push with dropdown */}
          <div className="relative">
            <button onClick={() => { setShowPushDropdown((v) => !v); setShowDeployDropdown(false); }} className={tbBtnPrimary}>
              <Upload className="h-3.5 w-3.5" /> Push
            </button>
            {showPushDropdown && (
              <TargetDropdown
                targets={DEPLOY_TARGETS}
                selected={pushTargets}
                onToggle={togglePushTarget}
                onConfirm={handlePushConfirm}
                onClose={() => setShowPushDropdown(false)}
                actionLabel="Push to"
              />
            )}
          </div>
          {/* Deploy with dropdown */}
          <div className="relative">
            <button onClick={() => { setShowDeployDropdown((v) => !v); setShowPushDropdown(false); }} className={tbBtn}>
              <Globe className="h-3.5 w-3.5" /> Deploy
            </button>
            {showDeployDropdown && (
              <TargetDropdown
                targets={DEPLOY_TARGETS}
                selected={deployTargets}
                onToggle={toggleDeployTarget}
                onConfirm={handleDeployConfirm}
                onClose={() => setShowDeployDropdown(false)}
                actionLabel="Deploy to"
              />
            )}
          </div>
          <button onClick={() => toolbarAction("Exporting...", "Export started")} className={tbBtn}>
            <Package className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={() => toolbarAction("Downloading...", "Download started")} className={tbBtn}>
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      </div>

      {/* ── Monitor Grid ── */}
      <div className="flex-1 min-h-0 p-4 flex flex-col gap-3 overflow-hidden">
        {/* Row 1: Mon5 | Mon1 (ANCHOR) | Mon3 */}
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
          {s4 && (
            <WorkbenchCard
              slot={s4}
              isOpen={isWorkbenchSlotOpen(s4.slot)}
              onSendOut={() => handleSendOut(s4.slot, s4.monitorNumber, s4.provider, s4.model, 3)}
              onRecall={() => handleRecallSlot(s4.slot)}
              onLockWinner={() => handleLockWinner(s4.slot)}
            />
          )}

          {/* Center: MON 4 — Command Center with live build preview */}
          <div className="relative flex flex-col rounded-xl border-2 border-[#FF6700]/30 bg-white/50 dark:bg-zinc-900/20 h-full overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0 border-b border-[#FF6700]/15">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md border border-[#FF6700]/40 flex items-center justify-center text-xs font-black text-[#FF6700]/60 bg-[#FF6700]/5">4</div>
                <span className="text-xs font-black text-zinc-600 dark:text-zinc-400 tracking-wider">
                  {projectName ? `${projectName} · Command Center` : "COMMAND CENTER"}
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-600">MON 4 · This Screen</span>
            </div>
            {/* Live preview — shows anchor (Mon 1) build */}
            <div className="flex-1 min-h-0 relative bg-white">
              {(() => {
                const anchorCode = s2?.previewHtml || s2?.lastCode || "";
                return anchorCode ? (
                  <iframe
                    srcDoc={anchorCode}
                    sandbox="allow-scripts"
                    title="Anchor build preview"
                    className="absolute inset-0 w-full h-full border-none pointer-events-none"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm font-bold text-zinc-400 dark:text-zinc-600">No build loaded</p>
                  </div>
                );
              })()}
            </div>
          </div>

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

      {/* ── Status Bar — between grid and broadcast ── */}
      <div className="flex items-center justify-between h-8 px-5 bg-zinc-50 dark:bg-[#111] border-y border-zinc-200 dark:border-zinc-800/30 flex-shrink-0 text-xs text-zinc-500">
        {/* Left: project info */}
        <div className="flex items-center gap-2">
          <FolderOpen className="h-3 w-3 text-[#FF6700]/60" />
          <span className="font-medium text-zinc-600 dark:text-zinc-400">{projectName || "No project"}</span>
          {fileTree.length > 0 && (
            <span className="text-zinc-400 dark:text-zinc-600">· {fileTree.length} files</span>
          )}
        </div>
        {/* Center: last action */}
        <span className="text-zinc-500 dark:text-zinc-600 font-medium">{lastAction}</span>
        {/* Right: quick actions */}
        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1 px-2 py-1 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            <Package className="h-3 w-3" /> Assets
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            <Copy className="h-3 w-3" /> Copy
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            <BookOpen className="h-3 w-3" /> Vault
          </button>
        </div>
      </div>

      {/* ── Broadcast Bar ── */}
      <div className="border-t border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 px-6 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col gap-3">

          {/* ── Prompt Input + Broadcast Button — above monitor selection ── */}
          {compareImage && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-200 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700/40">
              <img
                src={compareImage}
                alt="Reference"
                className="h-20 rounded-lg border border-zinc-400 dark:border-zinc-600 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Comparison reference</p>
                <p className="text-xs text-zinc-500 mt-0.5">Paste or drag images to compare — describe what to change</p>
              </div>
              <button
                onClick={() => setCompareImage(null)}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-zinc-300 dark:bg-zinc-700 hover:bg-red-500 text-zinc-600 dark:text-zinc-300 text-sm font-bold flex items-center justify-center transition-colors"
              >
                ×
              </button>
            </div>
          )}

          <div
            className={cn(
              "flex gap-3 transition-all",
              dragOver && "ring-2 ring-[#FF6700]/60 bg-[#FF6700]/5 rounded-2xl"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
              onPaste={handlePaste}
              placeholder={
                dragOver
                  ? "Drop image here…"
                  : selectedCount === 0
                  ? "Select monitors below to broadcast…"
                  : "Type a prompt to broadcast to The Pit..."
              }
              disabled={selectedCount === 0}
              className="flex-1 h-12 rounded-xl bg-white dark:bg-zinc-800 px-5 text-base text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none border border-zinc-300 dark:border-zinc-700 focus:border-[#FF6700]/50 disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!prompt.trim() || selectedCount === 0}
              className="px-8 h-12 rounded-xl text-white font-black text-sm bg-[#FF6700] hover:bg-[#FF6700]/85 disabled:opacity-30 disabled:hover:bg-[#FF6700] transition-all hover:scale-105 flex items-center gap-2 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
              Broadcast
            </button>
          </div>

          {/* ── Broadcast Target Row — below input ── */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
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
                        : { backgroundColor: "transparent", borderColor: "#d4d4d8", color: "#a1a1aa" }
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
                className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all"
              >
                {slots.every((s) => s.selected) ? "Deselect All" : "All"}
              </button>
              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-600 self-center pl-2">
                {selectedCount} / 5
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
