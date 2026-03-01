"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Shield, ShieldCheck, ShieldAlert,
  Gavel, Play, Square, RotateCcw,
  Sun, Moon,
  Activity, BookOpen, Clock, Settings,
  CheckCircle, AlertCircle, AlertTriangle, TrendingDown,
  RefreshCw, Vault, ChevronDown,
  Search,
} from "lucide-react";
import { useJuryGuardianStore } from "@/lib/stores/juryGuardianStore";
import {
  startJury, stopJury, runTier1, runTier2, vaultNow,
  getJuryStatus, isJuryActive,
} from "@/lib/engine/engine";
import { JuryToastContainer } from "@/components/JuryToast";
import { cn } from "@/lib/utils";

const SESSION_ID = "jury-standalone-session";

// ─── Header ──────────────────────────────────────────────────────────────────
function JuryHeader({
  enabled,
  hasAlerts,
  alertSummary,
  scopeLabel,
  onStart,
  onStop,
  onReset,
  onScopeChange,
}: {
  enabled: boolean;
  hasAlerts: boolean;
  alertSummary: string;
  scopeLabel: string;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onScopeChange: (scope: string) => void;
}) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const iconColor = hasAlerts ? "text-red-400" : enabled ? "text-green-400" : "text-zinc-500";
  const IconComponent = hasAlerts ? ShieldAlert : enabled ? ShieldCheck : Shield;

  return (
    <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
      {/* Left: Icon + Title */}
      <div className="flex items-center gap-3">
        <IconComponent className={cn("h-7 w-7", iconColor)} />
        <h1 className="text-[28px] font-black tracking-wide text-zinc-900 dark:text-zinc-100">
          JURY DUTY
        </h1>
        <Gavel className="h-5 w-5 text-[#FF6700] ml-1" />
      </div>

      {/* Center: Scope + Status */}
      <div className="flex items-center gap-4">
        {/* Scope selector */}
        <div className="relative">
          <select
            value={scopeLabel}
            onChange={(e) => onScopeChange(e.target.value)}
            className="appearance-none bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium px-3 py-1.5 pr-7 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer"
          >
            <option value="Parallel">Parallel (multi-chat)</option>
            <option value="Single">Single (one chat)</option>
            <option value="Architect">Architect</option>
            <option value="Builder">Builder</option>
          </select>
          <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status text */}
        <span className={cn(
          "text-xs font-medium px-3 py-1 rounded-full",
          hasAlerts
            ? "bg-red-500/10 text-red-400 border border-red-500/30"
            : enabled
            ? "bg-green-500/10 text-green-400 border border-green-500/30"
            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30"
        )}>
          {hasAlerts ? `ALERT: ${alertSummary}` : enabled ? "Active — Monitoring" : "Stopped"}
        </span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStart}
          disabled={enabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
            enabled
              ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500 text-white"
          )}
        >
          <Play className="h-3.5 w-3.5" /> Start
        </button>
        <button
          onClick={onStop}
          disabled={!enabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
            !enabled
              ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-500 text-white"
          )}
        >
          <Square className="h-3.5 w-3.5" /> Stop
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1" />
        <button onClick={toggleTheme} className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
          {dark ? <Sun className="h-4 w-4 text-zinc-400" /> : <Moon className="h-4 w-4 text-zinc-600" />}
        </button>
      </div>
    </div>
  );
}

// ─── Panel 1: Jury Status ────────────────────────────────────────────────────
function StatusPanel({ sessionId }: { sessionId: string }) {
  const { enabled, tier1, tier2, tier3, getLedger } = useJuryGuardianStore();
  const ledger = getLedger(sessionId);
  const [juryStatus, setJuryStatus] = useState(getJuryStatus(sessionId));
  const [runningTier, setRunningTier] = useState<1 | 2 | 3 | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setJuryStatus(getJuryStatus(sessionId)), 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleRunTier = async (tier: 1 | 2 | 3) => {
    setRunningTier(tier);
    try {
      if (tier === 1) await runTier1(sessionId);
      else if (tier === 2) await runTier2(sessionId);
      else await vaultNow(sessionId);
    } finally {
      setRunningTier(null);
    }
  };

  const unresolvedContradictions = ledger.contradictions.filter((c) => !c.resolved).length;
  const activeEchos = ledger.echoAlerts.filter((e) => !e.dismissed).length;
  const totalStrikes = Object.values(ledger.modelHealth).reduce((sum, h) => sum + h.strikes, 0);

  const tiers = [
    { label: "T1 — Fast Skim", model: tier1.model, tier: 1 as const, last: juryStatus.lastTier1, interval: `${tier1.intervalSeconds}s` },
    { label: "T2 — Review", model: tier2.model, tier: 2 as const, last: juryStatus.lastTier2, interval: `${tier2.intervalSeconds}s` },
    { label: "T3 — Deep Audit", model: tier3.model, tier: 3 as const, last: juryStatus.lastTier3, interval: `${Math.round(tier3.intervalSeconds / 3600)}h` },
  ];

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-3 overflow-y-auto">
      <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <Activity className="h-4 w-4" /> JURY STATUS
      </h2>

      {/* Tier cards */}
      {tiers.map((t) => (
        <div key={t.tier} className="bg-white dark:bg-zinc-800/60 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.label}</p>
              <p className="text-[10px] text-zinc-500">{t.model}</p>
            </div>
            <button
              onClick={() => handleRunTier(t.tier)}
              disabled={runningTier !== null || !enabled}
              className="px-2.5 py-1 text-[10px] font-bold rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors"
            >
              {runningTier === t.tier ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Run Now"}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-zinc-500">
            <span>Last: {t.last ? new Date(t.last).toLocaleTimeString() : "Never"}</span>
            <span>Every {t.interval}</span>
          </div>
        </div>
      ))}

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 mt-1">
        {[
          { label: "Facts", value: ledger.activeFacts.length, color: "text-emerald-400" },
          { label: "Contradictions", value: unresolvedContradictions, color: unresolvedContradictions > 0 ? "text-red-400" : "text-zinc-400" },
          { label: "Echoes", value: activeEchos, color: activeEchos > 0 ? "text-yellow-400" : "text-zinc-400" },
          { label: "Drift", value: ledger.driftAlerts.length, color: ledger.driftAlerts.length > 0 ? "text-yellow-400" : "text-zinc-400" },
          { label: "Killed", value: ledger.killedResponses.length, color: ledger.killedResponses.length > 0 ? "text-red-400" : "text-zinc-400" },
          { label: "Strikes", value: totalStrikes, color: totalStrikes > 0 ? "text-red-400" : "text-zinc-400" },
        ].map((m) => (
          <div key={m.label} className="bg-white dark:bg-zinc-800/40 rounded-md p-2 text-center border border-zinc-200 dark:border-zinc-700/30">
            <p className={cn("text-lg font-bold", m.color)}>{m.value}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Panel 2: Shared Context Ledger ──────────────────────────────────────────
function LedgerPanel({ sessionId }: { sessionId: string }) {
  const { getLedger } = useJuryGuardianStore();
  const ledger = getLedger(sessionId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "facts" | "contradictions" | "echoes">("all");

  const filteredItems = useMemo(() => {
    const items: Array<{ id: string; type: "fact" | "contradiction" | "echo"; text: string; meta: string; color: string }> = [];

    if (filter === "all" || filter === "facts") {
      ledger.activeFacts.forEach((f) => {
        items.push({
          id: f.id,
          type: "fact",
          text: f.fact,
          meta: `${f.sourceModel} • Pane ${f.sourcePane} • ${f.confidence}% ${f.verified ? "VERIFIED" : ""}`,
          color: "border-l-emerald-500",
        });
      });
    }

    if (filter === "all" || filter === "contradictions") {
      ledger.contradictions.filter((c) => !c.resolved).forEach((c) => {
        items.push({
          id: c.id,
          type: "contradiction",
          text: c.claim,
          meta: c.models.map((m) => `${m.model} (Pane ${m.pane})`).join(" vs "),
          color: "border-l-red-500",
        });
      });
    }

    if (filter === "all" || filter === "echoes") {
      ledger.echoAlerts.filter((e) => !e.dismissed).forEach((e) => {
        items.push({
          id: e.id,
          type: "echo",
          text: e.claim,
          meta: `${e.agreeingModels.join(", ")} • ${e.confidence}% agreement`,
          color: "border-l-yellow-500",
        });
      });
    }

    if (search) {
      const q = search.toLowerCase();
      return items.filter((i) => i.text.toLowerCase().includes(q) || i.meta.toLowerCase().includes(q));
    }

    return items;
  }, [ledger, filter, search]);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-3 overflow-hidden">
      <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <BookOpen className="h-4 w-4" /> SHARED CONTEXT LEDGER
      </h2>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-3 w-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facts, claims..."
            className="w-full pl-7 pr-2 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "facts", "contradictions", "echoes"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded-md transition-colors",
                filter === f
                  ? "bg-[#FF6700] text-white"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {filteredItems.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-8">No items in the ledger yet.</p>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className={cn("bg-white dark:bg-zinc-800/50 border-l-4 rounded-md p-2.5", item.color)}>
              <div className="flex items-start gap-2">
                {item.type === "fact" && <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />}
                {item.type === "contradiction" && <AlertCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />}
                {item.type === "echo" && <AlertTriangle className="h-3 w-3 text-yellow-400 mt-0.5 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs text-zinc-900 dark:text-zinc-200 leading-snug">{item.text}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{item.meta}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Panel 3: Activity Log / Timeline ────────────────────────────────────────
function TimelinePanel({ sessionId }: { sessionId: string }) {
  const { getLedger } = useJuryGuardianStore();
  const ledger = getLedger(sessionId);
  const [filter, setFilter] = useState<"all" | 1 | 2 | 3 | "alerts">("all");

  const events = useMemo(() => {
    const items: Array<{
      id: string;
      type: string;
      timestamp: Date;
      description: string;
      badge: string;
      badgeColor: string;
      textColor: string;
    }> = [];

    ledger.tierLog.forEach((log, i) => {
      items.push({
        id: `tier-${i}-${log.timestamp}`,
        type: `tier${log.tier}`,
        timestamp: new Date(log.timestamp),
        description: `${log.findingsCount} findings in ${log.duration}ms${log.escalated ? " — ESCALATED" : ""}`,
        badge: `T${log.tier}`,
        badgeColor: log.tier === 1 ? "bg-blue-500" : log.tier === 2 ? "bg-purple-500" : "bg-indigo-500",
        textColor: log.tier === 1 ? "text-blue-400" : log.tier === 2 ? "text-purple-400" : "text-indigo-400",
      });
    });

    ledger.echoAlerts.forEach((a) => {
      items.push({
        id: a.id,
        type: "alerts",
        timestamp: new Date(a.timestamp),
        description: `Echo: ${a.claim}`,
        badge: "ECHO",
        badgeColor: "bg-yellow-500",
        textColor: "text-yellow-400",
      });
    });

    ledger.contradictions.forEach((c) => {
      items.push({
        id: c.id,
        type: "alerts",
        timestamp: new Date(c.timestamp),
        description: `Contradiction: ${c.claim}`,
        badge: "CNTR",
        badgeColor: "bg-red-500",
        textColor: "text-red-400",
      });
    });

    ledger.driftAlerts.forEach((d) => {
      items.push({
        id: d.id,
        type: "alerts",
        timestamp: new Date(d.timestamp),
        description: `Drift: ${d.description}`,
        badge: "DRFT",
        badgeColor: "bg-orange-500",
        textColor: "text-orange-400",
      });
    });

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items;
  }, [ledger]);

  const filteredEvents = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "alerts") return e.type === "alerts";
    return e.type === `tier${filter}`;
  });

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-3 overflow-hidden">
      <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <Clock className="h-4 w-4" /> ACTIVITY LOG
      </h2>

      {/* Filters */}
      <div className="flex gap-1">
        {(["all", 1, 2, 3, "alerts"] as const).map((f) => (
          <button
            key={String(f)}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2 py-1 text-[10px] font-medium rounded-md transition-colors",
              filter === f
                ? "bg-[#FF6700] text-white"
                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            )}
          >
            {f === "all" ? "All" : f === "alerts" ? "Alerts" : `Tier ${f}`}
          </button>
        ))}
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
        {filteredEvents.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-8">No activity yet.</p>
        ) : (
          filteredEvents.slice(0, 100).map((event) => (
            <div key={event.id} className="flex items-start gap-2 text-xs">
              <span className="text-[10px] text-zinc-500 w-16 flex-shrink-0 pt-0.5">
                {event.timestamp.toLocaleTimeString()}
              </span>
              <span className={cn("text-[9px] font-bold text-white px-1.5 py-0.5 rounded flex-shrink-0", event.badgeColor)}>
                {event.badge}
              </span>
              <span className={cn("flex-1 leading-snug", event.textColor)}>{event.description}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Panel 4: Configuration ──────────────────────────────────────────────────
function ConfigPanel({ sessionId }: { sessionId: string }) {
  const {
    tier1, tier2, tier3, behavior, scope,
    updateTier1Config, updateTier2Config, updateTier3Config,
    updateBehavior, updateScope,
    getLedger, createSavePoint, resetLedger,
  } = useJuryGuardianStore();
  const ledger = getLedger(sessionId);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleCreateSavePoint = () => {
    createSavePoint(sessionId, {
      timestamp: new Date(),
      summary: `Manual save point — ${ledger.activeFacts.length} facts, ${ledger.contradictions.filter((c) => !c.resolved).length} contradictions`,
      verifiedFacts: ledger.activeFacts.filter((f) => f.verified).map((f) => f.fact),
      unresolvedItems: ledger.contradictions.filter((c) => !c.resolved).map((c) => ({
        description: c.claim,
        models: c.models.map((m) => m.model),
      })),
      messageIdCutoff: "",
      tokenCount: 0,
    });
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-3 overflow-y-auto">
      <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <Settings className="h-4 w-4" /> CONFIGURATION
      </h2>

      {/* Tier configs */}
      {[
        { label: "Tier 1 — Fast Skim", model: tier1.model, interval: tier1.intervalSeconds, update: updateTier1Config, min: 60, max: 300, unit: "s" },
        { label: "Tier 2 — Review", model: tier2.model, interval: tier2.intervalSeconds, update: updateTier2Config, min: 120, max: 600, unit: "s" },
      ].map((t) => (
        <div key={t.label} className="bg-white dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700/30 space-y-2">
          <h4 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{t.label}</h4>
          <input
            type="text"
            value={t.model}
            onChange={(e) => t.update({ model: e.target.value })}
            className="w-full px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-500 w-24">Interval: {t.interval}{t.unit}</label>
            <input type="range" min={t.min} max={t.max} value={t.interval}
              onChange={(e) => t.update({ intervalSeconds: Number(e.target.value) })}
              className="flex-1"
            />
          </div>
          <button
            onClick={async () => {
              if (t.label.includes("1")) await runTier1(sessionId);
              else await runTier2(sessionId);
            }}
            className="w-full py-1 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Run Now
          </button>
        </div>
      ))}

      {/* Tier 3 */}
      <div className="bg-white dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700/30 space-y-2">
        <h4 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Tier 3 — Deep Audit (Cloud)</h4>
        <input
          type="text"
          value={tier3.model}
          onChange={(e) => updateTier3Config({ model: e.target.value })}
          className="w-full px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-900 dark:text-zinc-100"
        />
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-500 w-24">Interval: {tier3.intervalHours || 4}h</label>
          <input type="range" min={1} max={8} value={tier3.intervalHours || 4}
            onChange={(e) => updateTier3Config({ intervalHours: Number(e.target.value), intervalSeconds: Number(e.target.value) * 3600 })}
            className="flex-1"
          />
        </div>
      </div>

      {/* Behavior */}
      <div className="bg-white dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700/30 space-y-2">
        <h4 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Behavior</h4>
        <label className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={behavior.interventionEnabled}
            onChange={(e) => updateBehavior({ interventionEnabled: e.target.checked })} className="rounded" />
          Auto-kill (block hallucinating responses)
        </label>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-500 w-32">Strike threshold: {behavior.strikeLimit}</label>
          <input type="range" min={1} max={10} value={behavior.strikeLimit}
            onChange={(e) => updateBehavior({ strikeLimit: Number(e.target.value) })} className="flex-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-500 w-32">Echo sensitivity: {Math.round(behavior.echoThreshold * 100)}%</label>
          <input type="range" min={50} max={95} value={behavior.echoThreshold * 100}
            onChange={(e) => updateBehavior({ echoThreshold: Number(e.target.value) / 100 })} className="flex-1" />
        </div>
      </div>

      {/* Integration — monitored apps */}
      <div className="bg-white dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700/30 space-y-2">
        <h4 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Monitored Apps</h4>
        {[
          { key: "parallelChat" as const, label: "Multi-Chat" },
          { key: "singleChat" as const, label: "Single Chat" },
          { key: "architect" as const, label: "Architect" },
          { key: "builder" as const, label: "Builder" },
        ].map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={scope[s.key]}
              onChange={(e) => updateScope({ [s.key]: e.target.checked })} className="rounded" />
            {s.label}
          </label>
        ))}
      </div>

      {/* Save Points */}
      <div className="bg-white dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700/30 space-y-2">
        <h4 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">Save Points ({ledger.savePoints.length})</h4>
        <button
          onClick={handleCreateSavePoint}
          className="w-full py-1.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
        >
          <Vault className="h-3 w-3 inline mr-1" /> Create Save Point
        </button>
        {ledger.savePoints.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {ledger.savePoints.slice().reverse().map((sp) => (
              <div key={sp.id} className="text-[10px] text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded">
                <span className="text-zinc-400">{new Date(sp.timestamp).toLocaleTimeString()}</span>
                {" — "}{sp.summary.slice(0, 60)}...
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset */}
      {!confirmReset ? (
        <button
          onClick={() => setConfirmReset(true)}
          className="w-full py-2 text-xs text-red-400 hover:text-red-300 border border-red-900/50 rounded-lg transition-colors"
        >
          Reset All Ledger Data
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => { resetLedger(sessionId); setConfirmReset(false); }}
            className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
          >
            Confirm Reset
          </button>
          <button
            onClick={() => setConfirmReset(false)}
            className="flex-1 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function JuryDutyPage() {
  const {
    enabled, setEnabled, scope, getLedger, resetLedger, updateScope,
  } = useJuryGuardianStore();
  const ledger = getLedger(SESSION_ID);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const unresolvedContradictions = ledger.contradictions.filter((c) => !c.resolved).length;
  const activeEchos = ledger.echoAlerts.filter((e) => !e.dismissed).length;
  const hasAlerts = unresolvedContradictions > 0 || activeEchos > 0;

  const alertParts: string[] = [];
  if (unresolvedContradictions > 0) alertParts.push(`${unresolvedContradictions} contradiction${unresolvedContradictions > 1 ? "s" : ""}`);
  if (activeEchos > 0) alertParts.push(`${activeEchos} echo chamber${activeEchos > 1 ? "s" : ""}`);
  const alertSummary = alertParts.join(", ");

  const scopeLabel = scope.parallelChat ? "Parallel" : scope.singleChat ? "Single" : scope.architect ? "Architect" : "Builder";

  const handleScopeChange = (val: string) => {
    const reset = { parallelChat: false, singleChat: false, architect: false, builder: false };
    if (val === "Parallel") updateScope({ ...reset, parallelChat: true });
    else if (val === "Single") updateScope({ ...reset, singleChat: true });
    else if (val === "Architect") updateScope({ ...reset, architect: true });
    else updateScope({ ...reset, builder: true });
  };

  const handleStart = () => {
    setEnabled(true);
    startJury(SESSION_ID);
  };

  const handleStop = () => {
    stopJury(SESSION_ID);
    setEnabled(false);
  };

  const handleReset = () => {
    stopJury(SESSION_ID);
    setEnabled(false);
    resetLedger(SESSION_ID);
  };

  if (!mounted) {
    return <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <Gavel className="h-8 w-8 text-[#FF6700] animate-pulse" />
    </div>;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toast container */}
      <JuryToastContainer />

      {/* Header */}
      <JuryHeader
        enabled={enabled}
        hasAlerts={hasAlerts}
        alertSummary={alertSummary}
        scopeLabel={scopeLabel}
        onStart={handleStart}
        onStop={handleStop}
        onReset={handleReset}
        onScopeChange={handleScopeChange}
      />

      {/* 4-Panel Grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-3 min-h-0">
        <StatusPanel sessionId={SESSION_ID} />
        <LedgerPanel sessionId={SESSION_ID} />
        <TimelinePanel sessionId={SESSION_ID} />
        <ConfigPanel sessionId={SESSION_ID} />
      </div>
    </div>
  );
}
