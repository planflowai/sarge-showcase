"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldOff,
  Play, Square, RotateCcw, Sun, Moon,
  Search, AlertTriangle, CheckCircle2, XCircle,
  Clock, Zap, Brain, Eye,
} from "lucide-react";
import { useThreadGuardianStore, useActiveLedger, useActiveStats } from "@/lib/stores/threadGuardianStore";
import {
  startGuardian,
  stopGuardian,
  isGuardianRunning,
  runTierManually,
} from "@/lib/engine/engine";
import { cn } from "@/lib/utils";
import type {
  TrackedFact,
  Contradiction,
  Hallucination,
  DriftAlert,
  TierConfig,
  TierStatus,
} from "@/lib/types/threadGuardian";

// ─── Tier Badge ────────────────────────────────────────────────
function TierBadge({ tier, status }: { tier: 1 | 2 | 3; status: TierStatus }) {
  const colors: Record<TierStatus, string> = {
    idle: "bg-zinc-700 text-zinc-300",
    running: "bg-[#FF6700]/20 text-[#FF6700] animate-pulse",
    error: "bg-red-500/20 text-red-400",
    escalated: "bg-yellow-500/20 text-yellow-400",
    disabled: "bg-zinc-800 text-zinc-600",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[11px] font-bold tracking-wider", colors[status])}>
      T{tier} {status.toUpperCase()}
    </span>
  );
}

// ─── Format time ago ───────────────────────────────────────────
function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// ─── Header ────────────────────────────────────────────────────
function GuardianHeader({
  running,
  alertCount,
  statusText,
  onStart,
  onStop,
  onReset,
  darkMode,
  onToggleTheme,
}: {
  running: boolean;
  alertCount: number;
  statusText: string;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}) {
  const ShieldIcon = alertCount > 0 ? ShieldAlert : running ? ShieldCheck : ShieldOff;
  const shieldColor = alertCount > 0 ? "text-red-500" : running ? "text-emerald-500" : "text-zinc-500";

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0a0a0a]">
      <div className="flex items-center gap-4">
        <ShieldIcon className={cn("w-7 h-7", shieldColor)} />
        <h1 className="text-[28px] font-bold tracking-tight">THREAD GUARDIAN</h1>
      </div>

      <p className={cn(
        "text-sm font-semibold px-4 py-1.5 rounded-full",
        alertCount > 0 ? "bg-red-500/10 text-red-400" : running ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-400"
      )}>
        {statusText}
      </p>

      <div className="flex items-center gap-2">
        {!running ? (
          <button onClick={onStart} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors">
            <Play className="w-4 h-4" /> Start
          </button>
        ) : (
          <button onClick={onStop} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors">
            <Square className="w-4 h-4" /> Stop
          </button>
        )}
        <button onClick={onReset} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold transition-colors">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
        <button onClick={onToggleTheme} className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
          {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-zinc-500" />}
        </button>
      </div>
    </div>
  );
}

// ─── Panel 1: Status Overview ──────────────────────────────────
function StatusPanel() {
  const stats = useActiveStats();
  const { tier1Config, tier2Config, tier3Config, enabled } = useThreadGuardianStore();

  const driftPct = stats.driftCount > 0 ? Math.min(stats.driftCount * 15, 100) : 0;
  const driftColor = driftPct < 20 ? "text-emerald-400" : driftPct < 50 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141414] p-6 flex flex-col gap-4 min-h-0">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        <Eye className="w-4 h-4 text-[#FF6700]" /> STATUS
      </h2>

      {/* Tier cards */}
      <div className="flex flex-col gap-3">
        {([
          { tier: 1 as const, config: tier1Config, icon: <Zap className="w-4 h-4" />, label: "Fast Skim" },
          { tier: 2 as const, config: tier2Config, icon: <Brain className="w-4 h-4" />, label: "Deep Analysis" },
          { tier: 3 as const, config: tier3Config, icon: <ShieldCheck className="w-4 h-4" />, label: "Save Point" },
        ]).map(({ tier, config, icon, label }) => (
          <div key={tier} className="flex items-center justify-between px-3 py-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm">
              {icon}
              <span className="font-semibold">Tier {tier}</span>
              <span className="text-zinc-500 text-xs">— {label}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-zinc-500">{config.model}</span>
              <span className="text-zinc-600">Last: {timeAgo(config.lastRun)}</span>
              <TierBadge tier={tier} status={config.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        <Metric label="Messages Monitored" value={stats.factCount > 0 ? "Active" : "0"} color="text-zinc-300" />
        <Metric label="Active Facts" value={String(stats.factCount)} color="text-emerald-400" />
        <Metric label="Contradictions" value={String(stats.contradictionCount)} color={stats.contradictionCount > 0 ? "text-red-400" : "text-zinc-400"} />
        <Metric label="Hallucinations" value={String(stats.hallucinationCount)} color={stats.hallucinationCount > 0 ? "text-red-400" : "text-zinc-400"} />
        <Metric label="Drift Score" value={`${driftPct}%`} color={driftColor} />
        <Metric label="Escalations" value={String(stats.escalationCount)} color="text-yellow-400" />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
      <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
      <span className={cn("text-lg font-bold", color)}>{value}</span>
    </div>
  );
}

// ─── Panel 2: Context Ledger ───────────────────────────────────
function LedgerPanel() {
  const ledger = useActiveLedger();
  const [filter, setFilter] = useState("");

  const facts = ledger?.activeFacts ?? [];
  const contradictions = ledger?.contradictions ?? [];
  const hallucinations = ledger?.hallucinations ?? [];

  const allItems = [
    ...facts.map(f => ({ type: "fact" as const, text: f.fact, confidence: f.confidence, verified: f.verified, ts: f.recordedAt })),
    ...contradictions.map(c => ({ type: "contradiction" as const, text: `${c.fact1} vs ${c.fact2}`, confidence: c.confidence, verified: false, ts: c.flaggedAt })),
    ...hallucinations.map(h => ({ type: "hallucination" as const, text: h.claim, confidence: h.confidence, verified: false, ts: h.flaggedAt })),
  ].filter(item => !filter || item.text.toLowerCase().includes(filter.toLowerCase()))
   .sort((a, b) => b.ts - a.ts);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141414] p-6 flex flex-col gap-4 min-h-0 overflow-hidden">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        <Search className="w-4 h-4 text-[#FF6700]" /> CONTEXT LEDGER
      </h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter facts, contradictions, hallucinations..."
          className="w-full pl-9 pr-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {allItems.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">No items tracked yet. Start the guardian to begin monitoring.</p>
        ) : (
          allItems.map((item, i) => {
            const borderColor = item.type === "contradiction" ? "border-l-red-500" : item.type === "hallucination" ? "border-l-yellow-500" : item.verified ? "border-l-emerald-500" : "border-l-zinc-600";
            const icon = item.type === "contradiction" ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" /> : item.type === "hallucination" ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;

            return (
              <div key={i} className={cn("flex items-start gap-2 px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 border-l-2", borderColor)}>
                {icon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-900 dark:text-zinc-200 break-words">{item.text}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                    <span>{item.type}</span>
                    <span>conf: {Math.round(item.confidence * 100)}%</span>
                    <span>{timeAgo(item.ts)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Panel 3: Timeline ─────────────────────────────────────────
function TimelinePanel() {
  const ledger = useActiveLedger();
  const { tier1Config, tier2Config, tier3Config } = useThreadGuardianStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build timeline from all available data
  const entries: { ts: number; tier: 1 | 2 | 3 | 0; type: string; desc: string; color: string }[] = [];

  // Add tier runs
  if (tier1Config.lastRun) entries.push({ ts: tier1Config.lastRun, tier: 1, type: "run", desc: `Tier 1 scan (${tier1Config.model})`, color: "bg-emerald-500/10 border-emerald-500/30" });
  if (tier2Config.lastRun) entries.push({ ts: tier2Config.lastRun, tier: 2, type: "run", desc: `Tier 2 analysis (${tier2Config.model})`, color: "bg-blue-500/10 border-blue-500/30" });
  if (tier3Config.lastRun) entries.push({ ts: tier3Config.lastRun, tier: 3, type: "run", desc: `Tier 3 save point (${tier3Config.model})`, color: "bg-purple-500/10 border-purple-500/30" });

  if (ledger) {
    // Contradictions
    ledger.contradictions.forEach(c => {
      entries.push({ ts: c.flaggedAt, tier: c.flaggedByTier, type: "contradiction", desc: `Contradiction: ${c.fact1.slice(0, 60)}...`, color: "bg-red-500/10 border-red-500/30" });
    });

    // Hallucinations
    ledger.hallucinations.forEach(h => {
      entries.push({ ts: h.flaggedAt, tier: h.flaggedByTier, type: "hallucination", desc: `Hallucination: ${h.claim.slice(0, 60)}...`, color: "bg-yellow-500/10 border-yellow-500/30" });
    });

    // Drift alerts
    ledger.driftAlerts.forEach(d => {
      entries.push({ ts: d.flaggedAt, tier: d.flaggedByTier, type: "drift", desc: `Drift: ${d.fromTopic} → ${d.toTopic}`, color: "bg-orange-500/10 border-orange-500/30" });
    });

    // Escalations
    ledger.escalationLog.forEach(e => {
      entries.push({ ts: e.timestamp, tier: e.fromTier, type: "escalation", desc: `Escalation T${e.fromTier}→T${e.toTier}: ${e.description.slice(0, 60)}`, color: "bg-yellow-500/10 border-yellow-500/30" });
    });

    // Save point
    if (ledger.tier3SavePoint) {
      entries.push({ ts: ledger.tier3SavePoint.timestamp, tier: 3, type: "savepoint", desc: `Save point created (${ledger.tier3SavePoint.verifiedFacts.length} facts verified)`, color: "bg-blue-500/10 border-blue-500/30" });
    }
  }

  entries.sort((a, b) => b.ts - a.ts);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [entries.length]);

  const tierColors: Record<number, string> = {
    0: "bg-zinc-600",
    1: "bg-emerald-600",
    2: "bg-blue-600",
    3: "bg-purple-600",
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141414] p-6 flex flex-col gap-4 min-h-0 overflow-hidden">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#FF6700]" /> TIMELINE
      </h2>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">No events yet. Start the guardian to see activity.</p>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className={cn("flex items-start gap-3 px-3 py-2 rounded-md border", entry.color)}>
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0 mt-0.5", tierColors[entry.tier])}>
                {entry.tier > 0 ? `T${entry.tier}` : "SYS"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-900 dark:text-zinc-200 break-words">{entry.desc}</p>
                <span className="text-[11px] text-zinc-500">{new Date(entry.ts).toLocaleTimeString()} — {timeAgo(entry.ts)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Panel 4: Configuration ────────────────────────────────────
function ConfigPanel() {
  const store = useThreadGuardianStore();
  const { tier1Config, tier2Config, tier3Config, enabled } = store;
  const ledger = useActiveLedger();
  const activeConversationId = useThreadGuardianStore(s => s.activeConversationId);

  const updateTier = (tier: 1 | 2 | 3, updates: Partial<TierConfig>) => {
    store.updateTierConfig(tier, updates);
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141414] p-6 flex flex-col gap-4 min-h-0 overflow-y-auto">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#FF6700]" /> CONFIGURATION
      </h2>

      {/* Tier configs */}
      {([
        { tier: 1 as const, config: tier1Config, label: "Tier 1 — Fast Skim" },
        { tier: 2 as const, config: tier2Config, label: "Tier 2 — Deep Analysis" },
        { tier: 3 as const, config: tier3Config, label: "Tier 3 — Save Point" },
      ]).map(({ tier, config, label }) => (
        <div key={tier} className="space-y-2 px-3 py-3 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{label}</span>
            <button
              onClick={() => {
                if (activeConversationId) runTierManually(tier, activeConversationId);
              }}
              className="text-[11px] px-2 py-1 rounded bg-[#FF6700]/10 text-[#FF6700] font-bold hover:bg-[#FF6700]/20 transition-colors"
            >
              Run Now
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-zinc-500 font-medium">Model</label>
              <input
                type="text"
                value={config.model}
                onChange={e => updateTier(tier, { model: e.target.value })}
                className="w-full mt-0.5 px-2 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 font-medium">Interval (seconds)</label>
              <input
                type="number"
                value={Math.round(config.intervalMs / 1000)}
                onChange={e => updateTier(tier, { intervalMs: Number(e.target.value) * 1000 })}
                className="w-full mt-0.5 px-2 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#FF6700]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Provider: {config.provider}</span>
            <span>•</span>
            <span>Runs: {config.runCount}</span>
            <span>•</span>
            <span>Escalations: {config.escalationCount}</span>
          </div>
        </div>
      ))}

      {/* Save Points */}
      <div className="space-y-2 px-3 py-3 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Save Points</span>
        {ledger?.tier3SavePoint ? (
          <div className="text-xs space-y-1">
            <p className="text-zinc-400">Created: {new Date(ledger.tier3SavePoint.timestamp).toLocaleString()}</p>
            <p className="text-zinc-400">By: {ledger.tier3SavePoint.createdByModel}</p>
            <p className="text-zinc-400">Facts verified: {ledger.tier3SavePoint.verifiedFacts.length}</p>
            <p className="text-zinc-400 line-clamp-2">{ledger.tier3SavePoint.summary.slice(0, 200)}...</p>
            <button
              onClick={() => {
                if (activeConversationId) {
                  store.emergencyReset(activeConversationId);
                }
              }}
              className="text-[11px] px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 font-bold hover:bg-yellow-500/20 transition-colors"
            >
              Restore Save Point
            </button>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No save points yet. Tier 3 creates save points automatically.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────
export default function GuardianDashboard() {
  const { enabled, setEnabled, activeConversationId, tier1Config, tier2Config, tier3Config } = useThreadGuardianStore();
  const stats = useActiveStats();
  const [darkMode, setDarkMode] = useState(true);
  const [running, setRunning] = useState(false);

  // Sync running state
  useEffect(() => {
    const interval = setInterval(() => {
      setRunning(isGuardianRunning());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Theme toggle
  const toggleTheme = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
  }, [darkMode]);

  // Determine status text
  const alertCount = stats.contradictionCount + stats.hallucinationCount;
  let statusText = "Stopped";
  if (running) {
    if (alertCount > 0) {
      statusText = `ALERT: ${alertCount} issue${alertCount > 1 ? "s" : ""} detected`;
    } else if (tier1Config.status === "running") {
      statusText = "Active — Tier 1 running";
    } else if (tier2Config.status === "running") {
      statusText = "Active — Tier 2 running";
    } else if (tier3Config.status === "running") {
      statusText = "Active — Tier 3 running";
    } else {
      statusText = "Active — monitoring";
    }
  }

  const handleStart = useCallback(() => {
    setEnabled(true);
    // Use a default conversation ID if none is active
    const convId = activeConversationId || "guardian-standalone-session";
    startGuardian(convId);
  }, [setEnabled, activeConversationId]);

  const handleStop = useCallback(() => {
    stopGuardian();
  }, []);

  const handleReset = useCallback(() => {
    stopGuardian();
    const convId = activeConversationId || "guardian-standalone-session";
    useThreadGuardianStore.getState().resetLedger(convId);
  }, [activeConversationId]);

  return (
    <div className="flex flex-col h-full">
      <GuardianHeader
        running={running}
        alertCount={alertCount}
        statusText={statusText}
        onStart={handleStart}
        onStop={handleStop}
        onReset={handleReset}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
      />

      {/* 4-panel grid */}
      <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-4 p-4">
        <StatusPanel />
        <LedgerPanel />
        <TimelinePanel />
        <ConfigPanel />
      </div>
    </div>
  );
}
