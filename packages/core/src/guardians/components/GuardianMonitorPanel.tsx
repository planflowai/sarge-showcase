"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Shield,
  Play,
  Pause,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Settings,
  BookOpen,
  Activity,
  FileText,
  Brain,
  Sparkles,
  ArrowUp,
  RotateCcw,
} from "lucide-react";
import { useThreadGuardianStore } from "../../stores/threadGuardianStore";
import { useAirGapStore, isCloudProvider } from "../../stores/airGapStore";
import { runTierManually, isGuardianRunning } from "../threadGuardian/engine";
import { getActiveWarnings, calculateHealthScore, type GuardianWarning } from "../threadGuardian/contextBuilder";
import type {
  TierConfig,
  ContextLedger,
  TrackedFact,
  Contradiction,
  Hallucination,
  DriftAlert,
  ComplexityType,
} from "../../lib/types/threadGuardian";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";

interface GuardianMonitorPanelProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "status" | "ledger" | "timeline" | "config";

// Tier color schemes
const TIER_COLORS = {
  1: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", accent: "bg-blue-500" },
  2: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", accent: "bg-purple-500" },
  3: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", accent: "bg-amber-500" },
};

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "Never";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatCountdown(nextRunTime: number): string {
  const diff = nextRunTime - Date.now();
  if (diff <= 0) return "Now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}

function formatInterval(ms: number): string {
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}m`;
  return `${ms / 3600000}h`;
}

// ============================================================================
// TIER CARD COMPONENT
// ============================================================================

interface TierCardProps {
  tier: 1 | 2 | 3;
  config: TierConfig;
  conversationId: string;
}

function TierCard({ tier, config, conversationId }: TierCardProps) {
  const [countdown, setCountdown] = useState("");
  const [progress, setProgress] = useState(0);
  const colors = TIER_COLORS[tier];

  // Update countdown and progress
  useEffect(() => {
    const update = () => {
      if (config.lastRun) {
        const nextRun = config.lastRun + config.intervalMs;
        setCountdown(formatCountdown(nextRun));
        const elapsed = Date.now() - config.lastRun;
        setProgress(Math.min(100, (elapsed / config.intervalMs) * 100));
      } else {
        setCountdown("Pending");
        setProgress(0);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [config.lastRun, config.intervalMs]);

  const handleRunNow = async () => {
    await runTierManually(tier, conversationId);
  };

  const statusConfig = {
    idle: { label: "Idle", color: "bg-zinc-500", icon: Clock },
    running: { label: "Running", color: "bg-blue-500 animate-pulse", icon: RefreshCw },
    error: { label: "Error", color: "bg-red-500", icon: XCircle },
    escalated: { label: "Escalated", color: "bg-amber-500", icon: ArrowUp },
    disabled: { label: "Disabled", color: "bg-zinc-600", icon: Pause },
  };

  const status = statusConfig[config.status] || statusConfig.idle;
  const StatusIcon = status.icon;

  return (
    <div className={cn("rounded-lg border p-3", colors.bg, colors.border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium text-sm", colors.text)}>
            Tier {tier}
          </span>
          <span className="text-xs text-zinc-500 truncate max-w-32">
            {config.model}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <StatusIcon className={cn("h-3 w-3", config.status === "running" ? "animate-spin" : "")} />
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              status.color,
              "text-white"
            )}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
        <div className="text-zinc-500">
          Last run: <span className="text-zinc-300">{formatRelativeTime(config.lastRun)}</span>
        </div>
        <div className="text-zinc-500">
          Next: <span className="text-zinc-300">{countdown}</span>
        </div>
        <div className="text-zinc-500">
          Runs: <span className="text-zinc-300">{config.runCount}</span>
        </div>
        <div className="text-zinc-500">
          Escalations: <span className="text-zinc-300">{config.escalationCount}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-700 rounded-full overflow-hidden mb-2">
        <div
          className={cn("h-full transition-all duration-1000", colors.accent)}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Run button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRunNow}
        disabled={config.status === "running"}
        className={cn("w-full h-7 text-xs", colors.text, "hover:bg-white/5")}
      >
        <Play className="h-3 w-3 mr-1" />
        Run Now
      </Button>
    </div>
  );
}

// ============================================================================
// STATUS TAB
// ============================================================================

function StatusTab({ conversationId }: { conversationId: string }) {
  const enabled = useThreadGuardianStore((s) => s.enabled);
  const tier1Config = useThreadGuardianStore((s) => s.tier1Config);
  const tier2Config = useThreadGuardianStore((s) => s.tier2Config);
  const tier3Config = useThreadGuardianStore((s) => s.tier3Config);
  const enableForConversation = useThreadGuardianStore((s) => s.enableForConversation);
  const disableForConversation = useThreadGuardianStore((s) => s.disableForConversation);
  const scope = useThreadGuardianStore((s) => s.scope);

  const isEnabledForConversation = scope.perConversation[conversationId] !== false;
  const healthData = calculateHealthScore(conversationId);

  const handleToggle = () => {
    if (isEnabledForConversation) {
      disableForConversation(conversationId);
    } else {
      enableForConversation(conversationId);
    }
  };

  return (
    <div className="space-y-3">
      {/* Health Score */}
      <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Context Health</span>
          <span className={cn("text-2xl font-bold", healthData.color)}>{healthData.score}</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                healthData.score >= 85 ? "bg-emerald-500" :
                healthData.score >= 70 ? "bg-blue-500" :
                healthData.score >= 50 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${healthData.score}%` }}
            />
          </div>
          <span className={cn("text-xs font-medium capitalize", healthData.color)}>
            {healthData.label}
          </span>
        </div>
        {/* Breakdown */}
        <div className="space-y-1">
          {healthData.breakdown.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">{item.label}</span>
              <span className={item.value >= 0 ? "text-emerald-400" : "text-red-400"}>
                {item.value >= 0 ? `+${item.value}` : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Master toggle for this conversation */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
        <div>
          <div className="text-sm font-medium text-zinc-200">Guardian for this conversation</div>
          <div className="text-xs text-zinc-500">Enable or disable monitoring</div>
        </div>
        <button
          onClick={handleToggle}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            isEnabledForConversation ? "bg-emerald-500" : "bg-zinc-600"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
              isEnabledForConversation ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {/* Tier Cards */}
      <TierCard tier={1} config={tier1Config} conversationId={conversationId} />
      <TierCard tier={2} config={tier2Config} conversationId={conversationId} />
      <TierCard tier={3} config={tier3Config} conversationId={conversationId} />
    </div>
  );
}

// ============================================================================
// LEDGER TAB
// ============================================================================

function LedgerTab({ conversationId }: { conversationId: string }) {
  const [showRetired, setShowRetired] = useState(false);
  const ledger = useThreadGuardianStore((s) => s.ledgers[conversationId]);

  if (!ledger) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="h-12 w-12 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-400">No ledger data yet</p>
        <p className="text-xs text-zinc-500 mt-1">Guardian will populate this as it runs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Topic */}
      {ledger.currentTopic && (
        <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <div className="text-xs text-zinc-500 mb-1">Current Topic</div>
          <div className="text-sm text-zinc-200 font-medium">{ledger.currentTopic}</div>
        </div>
      )}

      {/* Active Facts */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-200">
            Active Facts ({ledger.activeFacts.length})
          </span>
        </div>
        {ledger.activeFacts.length === 0 ? (
          <p className="text-xs text-zinc-500 pl-6">No facts indexed yet</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {ledger.activeFacts.map((fact, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded bg-zinc-800/30 text-xs"
              >
                {fact.verified ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300">{fact.fact}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                    <span>{fact.model}</span>
                    <span>·</span>
                    <span>{Math.round(fact.confidence * 100)}%</span>
                    {fact.citations.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{fact.citations.length} citations</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retired Facts */}
      {ledger.retiredFacts.length > 0 && (
        <div>
          <button
            onClick={() => setShowRetired(!showRetired)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300"
          >
            {showRetired ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Retired Facts ({ledger.retiredFacts.length})
          </button>
          {showRetired && (
            <div className="mt-2 space-y-1.5 pl-6">
              {ledger.retiredFacts.map((fact, i) => (
                <div key={i} className="p-2 rounded bg-zinc-800/20 text-xs text-zinc-500">
                  <p className="line-through">{fact.fact}</p>
                  <p className="text-[10px] mt-1 text-zinc-600">
                    {fact.reason} · {new Date(fact.retiredAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contradictions */}
      {ledger.contradictions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-zinc-200">
              Contradictions ({ledger.contradictions.length})
            </span>
          </div>
          <div className="space-y-2">
            {ledger.contradictions.map((c, i) => (
              <div key={i} className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 font-medium">Fact 1:</span>
                  <span className="text-zinc-300">{c.fact1}</span>
                </div>
                <div className="flex items-start gap-2 mt-1">
                  <span className="text-red-400 font-medium">Fact 2:</span>
                  <span className="text-zinc-300">{c.fact2}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>Tier {c.flaggedByTier}</span>
                  <span>·</span>
                  <span>{Math.round(c.confidence * 100)}% confidence</span>
                  {c.resolution && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-400">Resolved: {c.resolution}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hallucinations */}
      {ledger.hallucinations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-zinc-200">
              Potential Hallucinations ({ledger.hallucinations.length})
            </span>
          </div>
          <div className="space-y-2">
            {ledger.hallucinations.map((h, i) => (
              <div key={i} className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-xs">
                <p className="text-zinc-300">{h.claim}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>{h.model}</span>
                  <span>·</span>
                  <span>Tier {h.flaggedByTier}</span>
                  <span>·</span>
                  <span>{Math.round(h.confidence * 100)}% confidence</span>
                </div>
                {h.reason && <p className="mt-1 text-[10px] text-orange-400">{h.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drift Alerts */}
      {ledger.driftAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-zinc-200">
              Topic Drift ({ledger.driftAlerts.length})
            </span>
          </div>
          <div className="space-y-2">
            {ledger.driftAlerts.slice(-5).map((d, i) => (
              <div key={i} className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                <p className="text-zinc-300">{d.description}</p>
                <div className="mt-1 text-[10px] text-zinc-500">
                  <span className="text-amber-400">{d.fromTopic}</span>
                  <span className="mx-1">→</span>
                  <span className="text-amber-400">{d.toTopic}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TIMELINE TAB
// ============================================================================

interface TimelineEvent {
  id: string;
  timestamp: number;
  tier: 1 | 2 | 3 | null;
  type: "run" | "escalation" | "fact" | "contradiction" | "hallucination" | "savepoint";
  description: string;
}

function TimelineTab({ conversationId }: { conversationId: string }) {
  const [filter, setFilter] = useState<"all" | 1 | 2 | 3>("all");
  const ledger = useThreadGuardianStore((s) => s.ledgers[conversationId]);
  const tier1Config = useThreadGuardianStore((s) => s.tier1Config);
  const tier2Config = useThreadGuardianStore((s) => s.tier2Config);
  const tier3Config = useThreadGuardianStore((s) => s.tier3Config);

  const events = useMemo<TimelineEvent[]>(() => {
    if (!ledger) return [];

    const items: TimelineEvent[] = [];

    // Add escalations
    ledger.escalationLog.forEach((e, i) => {
      items.push({
        id: `esc-${i}`,
        timestamp: e.timestamp,
        tier: e.fromTier,
        type: "escalation",
        description: `Tier ${e.fromTier} → Tier ${e.toTier}: ${e.reason}`,
      });
    });

    // Add contradictions
    ledger.contradictions.forEach((c, i) => {
      items.push({
        id: `con-${i}`,
        timestamp: c.flaggedAt,
        tier: c.flaggedByTier,
        type: "contradiction",
        description: `Contradiction found: "${c.fact1.slice(0, 30)}..." vs "${c.fact2.slice(0, 30)}..."`,
      });
    });

    // Add hallucinations
    ledger.hallucinations.forEach((h, i) => {
      items.push({
        id: `hal-${i}`,
        timestamp: h.flaggedAt,
        tier: h.flaggedByTier,
        type: "hallucination",
        description: `Hallucination flagged: "${h.claim.slice(0, 50)}..."`,
      });
    });

    // Add save point
    if (ledger.tier3SavePoint) {
      items.push({
        id: "savepoint",
        timestamp: ledger.tier3SavePoint.timestamp,
        tier: 3,
        type: "savepoint",
        description: `Save point created (${ledger.tier3SavePoint.verifiedFacts.length} verified facts)`,
      });
    }

    // Sort by timestamp descending
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [ledger]);

  const filteredEvents = filter === "all" ? events : events.filter((e) => e.tier === filter);

  const eventConfig = {
    run: { color: "bg-blue-500", icon: RefreshCw },
    escalation: { color: "bg-amber-500", icon: ArrowUp },
    fact: { color: "bg-emerald-500", icon: CheckCircle },
    contradiction: { color: "bg-red-500", icon: XCircle },
    hallucination: { color: "bg-orange-500", icon: Sparkles },
    savepoint: { color: "bg-amber-400", icon: Shield },
  };

  return (
    <div className="space-y-3">
      {/* Filter buttons */}
      <div className="flex gap-1.5">
        {(["all", 1, 2, 3] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2 py-1 rounded text-xs transition-colors",
              filter === f
                ? "bg-zinc-700 text-zinc-200"
                : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
            )}
          >
            {f === "all" ? "All" : `Tier ${f}`}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-12 w-12 text-zinc-600 mb-3" />
          <p className="text-sm text-zinc-400">No events yet</p>
        </div>
      ) : (
        <div className="relative pl-4 space-y-3">
          {/* Vertical line */}
          <div className="absolute left-1.5 top-2 bottom-2 w-px bg-zinc-700" />

          {filteredEvents.map((event) => {
            const config = eventConfig[event.type];
            const Icon = config.icon;
            return (
              <div key={event.id} className="relative flex gap-3">
                {/* Dot */}
                <div
                  className={cn(
                    "absolute -left-2.5 mt-1.5 h-3 w-3 rounded-full ring-2 ring-zinc-900",
                    config.color
                  )}
                />
                {/* Content */}
                <div className="flex-1 pl-2">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    {event.tier && (
                      <>
                        <span>·</span>
                        <span className={TIER_COLORS[event.tier].text}>Tier {event.tier}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 mt-0.5">{event.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONFIG TAB
// ============================================================================

const COMPLEXITY_TYPES: ComplexityType[] = [
  "code",
  "json",
  "table",
  "log_dump",
  "document",
  "multi_file",
  "math",
  "api_response",
];

const PRESETS = {
  light: { tier1: 300000, tier2: 900000, tier3: 28800000 }, // 5m, 15m, 8h
  standard: { tier1: 120000, tier2: 600000, tier3: 14400000 }, // 2m, 10m, 4h
  aggressive: { tier1: 60000, tier2: 300000, tier3: 3600000 }, // 1m, 5m, 1h
};

function ConfigTab({ conversationId }: { conversationId: string }) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pruneResult, setPruneResult] = useState<{ facts: number; contradictions: number } | null>(null);

  const tier1Config = useThreadGuardianStore((s) => s.tier1Config);
  const tier2Config = useThreadGuardianStore((s) => s.tier2Config);
  const tier3Config = useThreadGuardianStore((s) => s.tier3Config);
  const updateTierConfig = useThreadGuardianStore((s) => s.updateTierConfig);
  const setScope = useThreadGuardianStore((s) => s.setScope);
  const scope = useThreadGuardianStore((s) => s.scope);
  const pruneLedger = useThreadGuardianStore((s) => s.pruneLedger);
  const emergencyReset = useThreadGuardianStore((s) => s.emergencyReset);
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);

  // Check if Tier 3 would use air-gap fallback
  const tier3IsAirGapFallback = airGapEnabled && isCloudProvider(tier3Config.provider);

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const { tier1, tier2, tier3 } = PRESETS[preset];
    updateTierConfig(1, { intervalMs: tier1 });
    updateTierConfig(2, { intervalMs: tier2 });
    updateTierConfig(3, { intervalMs: tier3 });
  };

  const toggleMode = (mode: string) => {
    const current = scope.allowedModes;
    if (current.includes(mode)) {
      setScope({ allowedModes: current.filter((m) => m !== mode) });
    } else {
      setScope({ allowedModes: [...current, mode] });
    }
  };

  const handlePruneNow = () => {
    const result = pruneLedger(conversationId, 30);
    setPruneResult({ facts: result.prunedFacts, contradictions: result.prunedContradictions });
    setTimeout(() => setPruneResult(null), 3000);
  };

  const handleEmergencyReset = () => {
    emergencyReset(conversationId);
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-4">
      {/* Air-gap Status Banner */}
      {tier3IsAirGapFallback && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Air-Gap Mode Active</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Tier 3 will use local fallback model instead of {tier3Config.model} — reduced accuracy
          </p>
        </div>
      )}

      {/* Presets */}
      <div>
        <div className="text-xs font-medium text-zinc-400 mb-2">Quick Presets</div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset("light")}
            className="flex-1 h-8 text-xs"
          >
            Light
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset("standard")}
            className="flex-1 h-8 text-xs"
          >
            Standard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset("aggressive")}
            className="flex-1 h-8 text-xs"
          >
            Aggressive
          </Button>
        </div>
      </div>

      {/* Tier configs */}
      {[
        { tier: 1 as const, config: tier1Config, color: TIER_COLORS[1] },
        { tier: 2 as const, config: tier2Config, color: TIER_COLORS[2] },
        { tier: 3 as const, config: tier3Config, color: TIER_COLORS[3] },
      ].map(({ tier, config, color }) => (
        <div key={tier} className={cn("p-3 rounded-lg border", color.bg, color.border)}>
          <div className={cn("text-sm font-medium mb-2", color.text)}>Tier {tier}</div>

          {/* Model */}
          <div className="mb-2">
            <label className="text-[10px] text-zinc-500 block mb-1">Model</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => updateTierConfig(tier, { model: e.target.value })}
              className="w-full h-7 px-2 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-200"
            />
          </div>

          {/* Interval */}
          <div className="mb-2">
            <label className="text-[10px] text-zinc-500 block mb-1">
              Interval: {formatInterval(config.intervalMs)}
            </label>
            <input
              type="range"
              min={30000}
              max={tier === 3 ? 86400000 : 3600000}
              step={tier === 3 ? 3600000 : 60000}
              value={config.intervalMs}
              onChange={(e) => updateTierConfig(tier, { intervalMs: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Max tokens */}
          <div className="mb-2">
            <label className="text-[10px] text-zinc-500 block mb-1">Max Tokens</label>
            <input
              type="number"
              value={config.maxTokenCapacity}
              onChange={(e) => updateTierConfig(tier, { maxTokenCapacity: Number(e.target.value) })}
              className="w-full h-7 px-2 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-200"
            />
          </div>

          {/* Complexity types */}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Auto-escalate on</label>
            <div className="flex flex-wrap gap-1">
              {COMPLEXITY_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    const current = config.complexityTypes;
                    const updated = current.includes(type)
                      ? current.filter((t) => t !== type)
                      : [...current, type];
                    updateTierConfig(tier, { complexityTypes: updated });
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] transition-colors",
                    config.complexityTypes.includes(type)
                      ? cn(color.accent, "text-white")
                      : "bg-zinc-700 text-zinc-400"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Scope */}
      <div>
        <div className="text-xs font-medium text-zinc-400 mb-2">Run Guardian In</div>
        <div className="flex gap-2">
          {["chat", "architect", "builder"].map((mode) => (
            <button
              key={mode}
              onClick={() => toggleMode(mode)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors",
                scope.allowedModes.includes(mode)
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
              )}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tier 3 Status */}
      <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
        <div className="text-xs font-medium text-zinc-400 mb-2">Tier 3 Status</div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              tier3IsAirGapFallback
                ? "bg-amber-500/20 text-amber-400"
                : "bg-emerald-500/20 text-emerald-400"
            )}
          >
            {tier3IsAirGapFallback ? "Local Fallback (air-gap)" : `Cloud (${tier3Config.model})`}
          </div>
        </div>
      </div>

      {/* Ledger Management */}
      <div>
        <div className="text-xs font-medium text-zinc-400 mb-2">Ledger Management</div>
        <div className="space-y-2">
          {/* Prune Now */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePruneNow}
            className="w-full h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Prune Now (30 days)
          </Button>
          {pruneResult && (
            <div className="text-xs text-emerald-400 text-center">
              Pruned {pruneResult.facts} facts, {pruneResult.contradictions} contradictions
            </div>
          )}

          {/* Emergency Reset */}
          {showResetConfirm ? (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/30 space-y-2">
              <p className="text-xs text-red-400">
                This will clear the ledger but preserve the last save point. Continue?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEmergencyReset}
                  className="flex-1 h-7 text-xs bg-red-600 hover:bg-red-700"
                >
                  Yes, Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
              className="w-full h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Emergency Reset
            </Button>
          )}
        </div>
      </div>

      {/* Reset to Defaults */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          applyPreset("standard");
        }}
        className="w-full h-8 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <RotateCcw className="h-3 w-3 mr-1" />
        Reset to Defaults
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================

export default function GuardianMonitorPanel({
  conversationId,
  isOpen,
  onClose,
}: GuardianMonitorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("status");

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: typeof Shield }[] = [
    { id: "status", label: "Status", icon: Shield },
    { id: "ledger", label: "Ledger", icon: BookOpen },
    { id: "timeline", label: "Timeline", icon: Activity },
    { id: "config", label: "Config", icon: Settings },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-96 max-w-full bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <span className="font-medium text-zinc-200">Thread Guardian</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-zinc-200 border-b-2 border-emerald-500 bg-zinc-800/50"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "status" && <StatusTab conversationId={conversationId} />}
          {activeTab === "ledger" && <LedgerTab conversationId={conversationId} />}
          {activeTab === "timeline" && <TimelineTab conversationId={conversationId} />}
          {activeTab === "config" && <ConfigTab conversationId={conversationId} />}
        </div>
      </div>
    </>
  );
}
