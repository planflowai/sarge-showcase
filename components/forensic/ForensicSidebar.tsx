"use client";

import { useState } from "react";
import {
  Clock,
  Search,
  Play,
  Download,
  X,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { verifyChain } from "@/lib/utils/forensicHash";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ForensicLogViewType } from "@/lib/types";

const NAV_ITEMS: { id: ForensicLogViewType; label: string; icon: typeof Clock }[] = [
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "investigation", label: "Investigation", icon: Search },
  { id: "replay", label: "Replay", icon: Play },
  { id: "export", label: "Export", icon: Download },
];

export function ForensicSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const currentView = useForensicLogStore((s) => s.currentView);
  const setCurrentView = useForensicLogStore((s) => s.setCurrentView);
  const closeForensicLog = useForensicLogStore((s) => s.closeForensicLog);
  const entries = useForensicLogStore((s) => s.entries);
  const sessions = useForensicLogStore((s) => s.sessions);
  const selectedSessionId = useForensicLogStore((s) => s.selectedSessionId);
  const setSelectedSession = useForensicLogStore((s) => s.setSelectedSession);
  const clearAll = useForensicLogStore((s) => s.clearAll);
  const openTestMode = useTestModeStore((s) => s.openTestMode);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const chainResult = entries.length > 0 ? verifyChain(entries) : { valid: true };

  if (collapsed) {
    return (
      <aside className="flex w-14 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex h-12 items-center justify-center">
          <button onClick={onToggle} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {NAV_ITEMS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentView(id)}
            className={`mx-2 mb-1 rounded p-2 transition-colors ${
              currentView === id
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
            title={id}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={closeForensicLog}
          className="mx-2 mb-2 rounded p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-60 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Forensic Log
        </span>
        <button onClick={onToggle} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Chain integrity */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className={`flex items-center gap-2 text-xs font-bold ${
          chainResult.valid ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
        }`}>
          {chainResult.valid ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          <span>{chainResult.valid ? "Chain Integrity: Verified" : `Chain Broken at #${chainResult.brokenAt}`}</span>
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">
          {entries.length} entries / {sessions.length} sessions
        </div>
      </div>

      {/* Nav */}
      <div className="p-2 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentView(id)}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              currentView === id
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto border-t border-zinc-200 dark:border-zinc-800 p-2">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 px-2 py-1">Sessions</div>
        {sessions.length === 0 && (
          <div className="px-2 py-4 text-xs font-medium text-zinc-500 text-center">No sessions yet. Run a test to capture logs.</div>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSession(s.id)}
            className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-xs transition-colors mb-0.5 ${
              selectedSessionId === s.id
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            <span className="font-bold truncate">
              {s.type === "batch" ? "Batch" : "Single"} — {s.config.mode}
            </span>
            <span className="text-[10px] text-zinc-500">
              {new Date(s.startTime).toLocaleTimeString()} · {s.entryCount} entries
              {s.verdict && (
                <span className={s.verdict === "caught" ? " text-emerald-500" : " text-red-500"}>
                  {" "}· {s.verdict.toUpperCase()}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 space-y-2">
        <Button
          variant="default"
          size="sm"
          onClick={closeForensicLog}
          className="w-full justify-center gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <X className="h-4 w-4" />
          Back to Workbench
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { closeForensicLog(); openTestMode(); }}
          className="w-full justify-center gap-2 text-sm font-bold border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <FlaskConical className="h-4 w-4" />
          Back to Test UI
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowClearConfirm(true)}
          disabled={entries.length === 0}
          className="w-full justify-start gap-2 text-xs font-semibold text-zinc-500 hover:text-red-500 dark:hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear All Logs
        </Button>
      </div>

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          clearAll();
          setShowClearConfirm(false);
        }}
        title="Clear All Forensic Logs"
        description={`Are you sure you want to delete all ${entries.length} forensic log entries across ${sessions.length} sessions? This action cannot be undone.`}
        variant="destructive"
        confirmText="Clear All"
      />
    </aside>
  );
}
