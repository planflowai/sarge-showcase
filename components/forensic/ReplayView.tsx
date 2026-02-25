"use client";

import { useMemo } from "react";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Hash,
  Gauge,
} from "lucide-react";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import type { ForensicLogEntry } from "@/lib/types";

const SEVERITY_ICON = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
  success: CheckCircle2,
};

const SEVERITY_COLOR = {
  info: "text-blue-500",
  warning: "text-amber-500",
  critical: "text-red-500",
  success: "text-emerald-500",
};

const SEVERITY_BG = {
  info: "bg-blue-500/10 border-blue-500/30",
  warning: "bg-amber-500/10 border-amber-500/30",
  critical: "bg-red-500/10 border-red-500/30",
  success: "bg-emerald-500/10 border-emerald-500/30",
};

const SPEED_OPTIONS = [
  { label: "0.5x", ms: 3000 },
  { label: "1x", ms: 1500 },
  { label: "2x", ms: 750 },
  { label: "4x", ms: 375 },
];

export function ReplayView() {
  const selectedSessionId = useForensicLogStore((s) => s.selectedSessionId);
  const getSessionEntries = useForensicLogStore((s) => s.getSessionEntries);
  const entries = useForensicLogStore((s) => s.entries);
  const replayIndex = useForensicLogStore((s) => s.replayIndex);
  const replayPlaying = useForensicLogStore((s) => s.replayPlaying);
  const replaySpeed = useForensicLogStore((s) => s.replaySpeed);
  const setReplayIndex = useForensicLogStore((s) => s.setReplayIndex);
  const replayNext = useForensicLogStore((s) => s.replayNext);
  const replayPrev = useForensicLogStore((s) => s.replayPrev);
  const toggleReplayPlay = useForensicLogStore((s) => s.toggleReplayPlay);
  const setReplaySpeed = useForensicLogStore((s) => s.setReplaySpeed);
  const sessions = useForensicLogStore((s) => s.sessions);
  const setSelectedSession = useForensicLogStore((s) => s.setSelectedSession);

  const sessionEntries = selectedSessionId ? getSessionEntries(selectedSessionId) : entries;
  const current = sessionEntries[replayIndex] ?? null;

  // Accumulated state up to current index
  const accumulated = useMemo(() => {
    const acc = { echoCount: 0, alerts: [] as string[], rounds: 0, totalTokens: 0, responses: 0 };
    for (let i = 0; i <= replayIndex && i < sessionEntries.length; i++) {
      const e = sessionEntries[i];
      if (e.category === "round") acc.rounds++;
      if (e.category === "response") acc.responses++;
      if (e.modelState) acc.totalTokens += e.modelState.tokens;
      if (e.systemState?.echoCountSoFar !== undefined) acc.echoCount = e.systemState?.echoCountSoFar;
      acc.alerts = e.alertHistory?.length > 0 ? [...(e.alertHistory ?? [])] : acc.alerts;
    }
    return acc;
  }, [sessionEntries, replayIndex]);

  if (sessionEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <Play className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No entries to replay</p>
        <p className="text-xs mt-1">
          {sessions.length > 0 ? "Select a session from the sidebar" : "Run a test to capture forensic data"}
        </p>
        {sessions.length > 0 && !selectedSessionId && (
          <select
            onChange={(e) => setSelectedSession(e.target.value || null)}
            className="mt-3 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200"
          >
            <option value="">Choose a session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type === "batch" ? "Batch" : "Single"} — {s.config.mode} ({s.entryCount} entries)
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  const progress = sessionEntries.length > 1 ? (replayIndex / (sessionEntries.length - 1)) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Current entry detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {current && <ReplayEntry entry={current} />}
        </div>

        {/* Side panel — running state */}
        <div className="w-64 border-l border-zinc-200 dark:border-zinc-800 p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Running State</div>

          <StatBox label="Step" value={`${replayIndex + 1} / ${sessionEntries.length}`} />
          <StatBox label="Rounds" value={String(accumulated.rounds)} />
          <StatBox label="Responses" value={String(accumulated.responses)} />
          <StatBox label="Total Tokens" value={accumulated.totalTokens.toLocaleString()} />
          <StatBox
            label="Echo Count"
            value={String(accumulated.echoCount)}
            highlight={accumulated.echoCount > 0}
          />

          {accumulated.alerts.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Active Alerts</div>
              <div className="space-y-1">
                {accumulated.alerts.map((a, i) => (
                  <div key={i} className="rounded bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2">
        <div className="relative h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setReplayIndex(Math.round(pct * (sessionEntries.length - 1)));
          }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 shadow transition-all"
            style={{ left: `${progress}%`, marginLeft: "-7px" }}
          />
        </div>
      </div>

      {/* VCR controls */}
      <div className="flex items-center justify-center gap-4 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <button
          onClick={() => setReplayIndex(0)}
          className="rounded p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="First"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={replayPrev}
          disabled={replayIndex === 0}
          className="rounded p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          title="Previous"
        >
          <SkipBack className="h-5 w-5" />
        </button>
        <button
          onClick={toggleReplayPlay}
          className={`rounded-full p-3 transition-colors ${
            replayPlaying
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
        >
          {replayPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button
          onClick={replayNext}
          disabled={replayIndex >= sessionEntries.length - 1}
          className="rounded p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          title="Next"
        >
          <SkipForward className="h-5 w-5" />
        </button>
        <button
          onClick={() => setReplayIndex(sessionEntries.length - 1)}
          className="rounded p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="Last"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        {/* Speed selector */}
        <div className="ml-4 flex items-center gap-1 border-l border-zinc-300 dark:border-zinc-700 pl-4">
          <Gauge className="h-3.5 w-3.5 text-zinc-500" />
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.ms}
              onClick={() => setReplaySpeed(opt.ms)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                replaySpeed === opt.ms
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReplayEntry({ entry }: { entry: ForensicLogEntry }) {
  const SevIcon = SEVERITY_ICON[entry.severity];

  return (
    <div className={`max-w-3xl border rounded-lg p-6 space-y-4 ${SEVERITY_BG[entry.severity]}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <SevIcon className={`h-6 w-6 ${SEVERITY_COLOR[entry.severity]}`} />
        <div className="flex-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{entry.event}</h2>
          <div className="flex gap-3 text-xs text-zinc-500 mt-1">
            <span>#{entry.sequenceNumber}</span>
            <span className="uppercase font-bold">{entry.category}</span>
            <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Model state */}
      {entry.modelState && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "Model", v: entry.modelState.modelId },
            { l: "Role", v: entry.modelState.agentRole.toUpperCase() },
            { l: "Tokens", v: entry.modelState.tokens.toLocaleString() },
            { l: "Latency", v: `${entry.modelState.responseTimeMs}ms` },
          ].map(({ l, v }) => (
            <div key={l} className="rounded bg-white/50 dark:bg-zinc-800/50 p-2 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">{l}</div>
              <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200 truncate">{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      {entry.input && (
        <div>
          <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Input</div>
          <pre className="rounded bg-white/50 dark:bg-zinc-800/50 p-3 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-zinc-700 dark:text-zinc-300">
            {entry.input?.slice(0, 2000)}
          </pre>
        </div>
      )}

      {/* Output */}
      {entry.output && (
        <div>
          <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Output</div>
          <pre className="rounded bg-white/50 dark:bg-zinc-800/50 p-3 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-zinc-700 dark:text-zinc-300">
            {entry.output?.slice(0, 2000)}
          </pre>
        </div>
      )}

      {/* AI Decision */}
      {entry.aiDecision && entry.aiDecision.explanation !== 'N/A' && (
        <div className="rounded bg-white/50 dark:bg-zinc-800/50 p-3 space-y-1 text-xs">
          <div className="text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-400">AI Decision</div>
          <div className="text-zinc-700 dark:text-zinc-300">{entry.aiDecision.action} — <span className="font-bold">{(entry.aiDecision.confidence * 100).toFixed(0)}%</span></div>
          <div className="text-zinc-500">{entry.aiDecision.explanation}</div>
        </div>
      )}

      {/* Compliance + Actors row */}
      <div className="flex items-center gap-3 text-[10px]">
        {entry.compliance && (
          <span className={entry.compliance.auditReady ? "text-emerald-500 font-bold" : "text-red-500"}>
            {entry.compliance.auditReady ? '✓ Audit Ready' : '✗ Not Ready'}
          </span>
        )}
        {entry.actors?.overrideOccurred && (
          <span className="text-amber-500 font-bold">Override: {entry.actors.overrideReason}</span>
        )}
        {entry.compliance && (
          <span className="text-zinc-500">{entry.compliance.regulations.join(' · ')}</span>
        )}
      </div>

      {/* Hash */}
      <div className="border-t border-zinc-300/30 dark:border-zinc-600/30 pt-3 space-y-1">
        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
          <Hash className="h-3 w-3" />
          SHA-256: {entry.hash}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500/60">
          <Hash className="h-3 w-3" />
          Prev: {entry.previousHash}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md p-2 text-center ${
      highlight ? "bg-red-100 dark:bg-red-900/20 ring-1 ring-red-500/30" : "bg-white dark:bg-zinc-800"
    }`}>
      <div className="text-[10px] text-zinc-500 uppercase">{label}</div>
      <div className={`text-sm font-mono font-bold ${highlight ? "text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200"}`}>
        {value}
      </div>
    </div>
  );
}
