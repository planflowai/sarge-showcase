"use client";

import { useState, useEffect } from "react";
import {
  X,
  Shield,
  Activity,
  BookOpen,
  Clock,
  Settings,
  Play,
  Pause,
  Vault,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { useJuryGuardianStore } from "@/lib/stores/juryGuardianStore";
import { runTier1, runTier2, vaultNow, getJuryStatus } from "@/lib/juryGuardian/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabId = "status" | "ledger" | "timeline" | "config";

interface JuryMonitorPanelProps {
  sessionId: string;
}

export function JuryMonitorPanel({ sessionId }: JuryMonitorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [juryStatus, setJuryStatus] = useState(getJuryStatus(sessionId));

  const {
    enabled,
    setEnabled,
    panelOpen,
    setPanelOpen,
    tier1,
    tier2,
    tier3,
    behavior,
    scope,
    updateTier1Config,
    updateTier2Config,
    updateTier3Config,
    updateBehavior,
    updateScope,
    setInterventionEnabled,
    getLedger,
    dismissEchoAlert,
    resolveContradiction,
    resetLedger,
  } = useJuryGuardianStore();

  const ledger = getLedger(sessionId);

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setJuryStatus(getJuryStatus(sessionId));
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Calculate health score
  const calculateHealthScore = (): number => {
    const unresolvedContradictions = ledger.contradictions.filter((c) => !c.resolved).length;
    const activeEchoAlerts = ledger.echoAlerts.filter((e) => !e.dismissed).length;
    const driftAlerts = ledger.driftAlerts.length;

    let score = 100;
    score -= unresolvedContradictions * 15;
    score -= activeEchoAlerts * 10;
    score -= driftAlerts * 5;

    return Math.max(0, Math.min(100, score));
  };

  const healthScore = calculateHealthScore();

  if (!panelOpen) return null;

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "status", label: "Status", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "ledger", label: "Ledger", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: "timeline", label: "Timeline", icon: <Clock className="h-3.5 w-3.5" /> },
    { id: "config", label: "Config", icon: <Settings className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-[380px] bg-zinc-900 border-l border-zinc-800 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-white">Jury Guardian</span>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "text-indigo-400 border-b-2 border-indigo-400 bg-zinc-800/50"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "status" && (
          <StatusTab
            enabled={enabled}
            setEnabled={setEnabled}
            interventionEnabled={behavior.interventionEnabled}
            setInterventionEnabled={setInterventionEnabled}
            healthScore={healthScore}
            tier1={tier1}
            tier2={tier2}
            tier3={tier3}
            juryStatus={juryStatus}
            sessionId={sessionId}
          />
        )}
        {activeTab === "ledger" && (
          <LedgerTab
            ledger={ledger}
            dismissEchoAlert={(id) => dismissEchoAlert(sessionId, id)}
            resolveContradiction={(id, resolution) => resolveContradiction(sessionId, id, resolution)}
          />
        )}
        {activeTab === "timeline" && <TimelineTab ledger={ledger} />}
        {activeTab === "config" && (
          <ConfigTab
            tier1={tier1}
            tier2={tier2}
            tier3={tier3}
            behavior={behavior}
            scope={scope}
            updateTier1Config={updateTier1Config}
            updateTier2Config={updateTier2Config}
            updateTier3Config={updateTier3Config}
            updateBehavior={updateBehavior}
            updateScope={updateScope}
            resetLedger={() => resetLedger(sessionId)}
          />
        )}
      </div>
    </div>
  );
}

// Status Tab
function StatusTab({
  enabled,
  setEnabled,
  interventionEnabled,
  setInterventionEnabled,
  healthScore,
  tier1,
  tier2,
  tier3,
  juryStatus,
  sessionId,
}: {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  interventionEnabled: boolean;
  setInterventionEnabled: (enabled: boolean) => void;
  healthScore: number;
  tier1: { model: string; intervalSeconds: number; enabled: boolean };
  tier2: { model: string; intervalSeconds: number; enabled: boolean };
  tier3: { model: string; intervalSeconds: number; enabled: boolean; provider?: string };
  juryStatus: ReturnType<typeof getJuryStatus>;
  sessionId: string;
}) {
  const [runningTier, setRunningTier] = useState<1 | 2 | 3 | null>(null);

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

  const formatTime = (date: Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          {enabled ? (
            <Play className="h-4 w-4 text-green-400" />
          ) : (
            <Pause className="h-4 w-4 text-zinc-500" />
          )}
          <span className="text-sm font-medium text-white">
            {enabled ? "Jury Active" : "Jury Disabled"}
          </span>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded transition-colors",
            enabled
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-green-600 hover:bg-green-500 text-white"
          )}
        >
          {enabled ? "Disable" : "Enable"}
        </button>
      </div>

      {/* Active Intervention Toggle */}
      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          {interventionEnabled ? (
            <Shield className="h-4 w-4 text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-zinc-500" />
          )}
          <span className="text-sm font-medium text-white">
            {interventionEnabled ? "🛡️ Active Intervention" : "Toast Only"}
          </span>
        </div>
        <button
          onClick={() => setInterventionEnabled(!interventionEnabled)}
          disabled={!enabled}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded transition-colors",
            enabled
              ? interventionEnabled
                ? "bg-green-600 hover:bg-green-500 text-white"
                : "bg-gray-600 hover:bg-gray-500 text-white"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          )}
        >
          {interventionEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Health Score */}
      <div className="p-3 bg-zinc-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400">Thread Health</span>
          <span
            className={cn(
              "text-lg font-bold",
              healthScore >= 80 ? "text-green-400" : healthScore >= 50 ? "text-yellow-400" : "text-red-400"
            )}
          >
            {healthScore}
          </span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              healthScore >= 80 ? "bg-green-500" : healthScore >= 50 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      {/* Tier Cards */}
      <div className="space-y-2">
        {/* Tier 1 */}
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Tier 1 - Fast Skim</p>
              <p className="text-[10px] text-zinc-400">{tier1.model}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRunTier(1)}
              disabled={runningTier !== null || !enabled}
              className="h-7 text-xs"
            >
              {runningTier === 1 ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Run Now"}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
            <span>Last: {formatTime(juryStatus.lastTier1)}</span>
            <span>Every {tier1.intervalSeconds}s</span>
          </div>
        </div>

        {/* Tier 2 */}
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Tier 2 - Review</p>
              <p className="text-[10px] text-zinc-400">{tier2.model}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRunTier(2)}
              disabled={runningTier !== null || !enabled}
              className="h-7 text-xs"
            >
              {runningTier === 2 ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Run Now"}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
            <span>Last: {formatTime(juryStatus.lastTier2)}</span>
            <span>Every {tier2.intervalSeconds}s</span>
          </div>
        </div>

        {/* Tier 3 */}
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Tier 3 - Deep Audit</p>
              <p className="text-[10px] text-zinc-400">{tier3.model}</p>
            </div>
            <Button
              size="sm"
              onClick={() => handleRunTier(3)}
              disabled={runningTier !== null || !enabled}
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500"
            >
              {runningTier === 3 ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Vault className="h-3 w-3 mr-1" />
              )}
              Vault Now
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
            <span>Last: {formatTime(juryStatus.lastTier3)}</span>
            <span>Every {Math.round(tier3.intervalSeconds / 3600)}h</span>
          </div>
        </div>
      </div>

      {/* Queue Status */}
      <div className="p-3 bg-zinc-800/50 rounded-lg">
        <p className="text-xs text-zinc-400">Queued Responses</p>
        <p className="text-lg font-bold text-white">{juryStatus.queuedResponses}</p>
      </div>
    </div>
  );
}

// Ledger Tab
function LedgerTab({
  ledger,
  dismissEchoAlert,
  resolveContradiction,
}: {
  ledger: ReturnType<typeof useJuryGuardianStore.getState>["ledgers"][string];
  dismissEchoAlert: (id: string) => void;
  resolveContradiction: (id: string, resolution: string) => void;
}) {
  const [showRetired, setShowRetired] = useState(false);

  if (!ledger) {
    return <p className="text-sm text-zinc-400">No ledger data yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Active Facts */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">
          Active Facts ({ledger.activeFacts.length})
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {ledger.activeFacts.length === 0 ? (
            <p className="text-xs text-zinc-500">No facts recorded</p>
          ) : (
            ledger.activeFacts.slice(-10).map((fact) => (
              <div key={fact.id} className="p-2 bg-zinc-800/50 rounded text-xs">
                <div className="flex items-start gap-2">
                  {fact.verified ? (
                    <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-zinc-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-zinc-200">{fact.fact}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {fact.sourceModel} • {fact.confidence}% confidence
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contradictions */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">
          Contradictions ({ledger.contradictions.filter((c) => !c.resolved).length})
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {ledger.contradictions.filter((c) => !c.resolved).length === 0 ? (
            <p className="text-xs text-zinc-500">No unresolved contradictions</p>
          ) : (
            ledger.contradictions
              .filter((c) => !c.resolved)
              .map((contradiction) => (
                <div key={contradiction.id} className="p-2 bg-red-950/30 border border-red-900/50 rounded text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-zinc-200">{contradiction.claim}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {contradiction.models.map((m) => m.model).join(" vs ")}
                      </p>
                    </div>
                    <button
                      onClick={() => resolveContradiction(contradiction.id, "Manually resolved")}
                      className="text-[10px] text-zinc-400 hover:text-white"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Echo Alerts */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">
          Echo Alerts ({ledger.echoAlerts.filter((e) => !e.dismissed).length})
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {ledger.echoAlerts.filter((e) => !e.dismissed).length === 0 ? (
            <p className="text-xs text-zinc-500">No active echo alerts</p>
          ) : (
            ledger.echoAlerts
              .filter((e) => !e.dismissed)
              .map((alert) => (
                <div key={alert.id} className="p-2 bg-yellow-950/30 border border-yellow-900/50 rounded text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-zinc-200">{alert.claim}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {alert.agreeingModels.join(", ")} • {alert.confidence}%
                      </p>
                    </div>
                    <button
                      onClick={() => dismissEchoAlert(alert.id)}
                      className="text-[10px] text-zinc-400 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Drift Alerts */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">
          Drift Alerts ({ledger.driftAlerts.length})
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {ledger.driftAlerts.length === 0 ? (
            <p className="text-xs text-zinc-500">No drift alerts</p>
          ) : (
            ledger.driftAlerts.slice(-5).map((alert) => (
              <div key={alert.id} className="p-2 bg-orange-950/30 border border-orange-900/50 rounded text-xs">
                <div className="flex items-start gap-2">
                  <TrendingDown className="h-3 w-3 text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-zinc-200">{alert.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Retired Facts Toggle */}
      <div>
        <button
          onClick={() => setShowRetired(!showRetired)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          {showRetired ? "Hide" : "Show"} Retired Facts ({ledger.retiredFacts.length})
        </button>
        {showRetired && ledger.retiredFacts.length > 0 && (
          <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
            {ledger.retiredFacts.map((fact) => (
              <div key={fact.id} className="p-2 bg-zinc-800/30 rounded text-xs text-zinc-500">
                <p>{fact.fact}</p>
                <p className="text-[10px] mt-0.5">Retired: {fact.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Killed Responses */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">
          🛑 Killed Responses ({ledger.killedResponses.length})
        </h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {ledger.killedResponses.length === 0 ? (
            <p className="text-xs text-zinc-500">No responses killed yet</p>
          ) : (
            ledger.killedResponses
              .slice(-10)
              .reverse()
              .map((killed) => (
                <div key={killed.id} className="p-2 bg-red-950/40 border border-red-900/50 rounded text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-200 text-[11px] font-medium">
                        {killed.type === "echo" ? "Echo" : "Contradiction"}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{killed.reason}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {killed.model} • {new Date(killed.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

// Timeline Tab
function TimelineTab({
  ledger,
}: {
  ledger: ReturnType<typeof useJuryGuardianStore.getState>["ledgers"][string];
}) {
  const [filter, setFilter] = useState<"all" | 1 | 2 | 3 | "alerts">("all");

  if (!ledger) {
    return <p className="text-sm text-zinc-400">No timeline data yet.</p>;
  }

  // Build timeline events
  const events: Array<{
    id: string;
    type: "tier1" | "tier2" | "tier3" | "echo" | "contradiction" | "drift" | "fact";
    timestamp: Date;
    description: string;
    color: string;
  }> = [];

  // Add tier runs
  ledger.tierLog.forEach((log) => {
    events.push({
      id: `tier-${log.timestamp.toString()}`,
      type: log.tier === 1 ? "tier1" : log.tier === 2 ? "tier2" : "tier3",
      timestamp: new Date(log.timestamp),
      description: `Tier ${log.tier} ran (${log.findingsCount} findings, ${log.duration}ms)`,
      color: log.tier === 1 ? "text-blue-400" : log.tier === 2 ? "text-purple-400" : "text-indigo-400",
    });
  });

  // Add alerts
  ledger.echoAlerts.forEach((alert) => {
    events.push({
      id: alert.id,
      type: "echo",
      timestamp: new Date(alert.timestamp),
      description: `Echo: ${alert.claim}`,
      color: "text-yellow-400",
    });
  });

  ledger.contradictions.forEach((c) => {
    events.push({
      id: c.id,
      type: "contradiction",
      timestamp: new Date(c.timestamp),
      description: `Contradiction: ${c.claim}`,
      color: "text-red-400",
    });
  });

  ledger.driftAlerts.forEach((d) => {
    events.push({
      id: d.id,
      type: "drift",
      timestamp: new Date(d.timestamp),
      description: `Drift: ${d.description}`,
      color: "text-orange-400",
    });
  });

  // Sort by timestamp descending
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Filter
  const filteredEvents = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "alerts") return ["echo", "contradiction", "drift"].includes(e.type);
    if (filter === 1) return e.type === "tier1";
    if (filter === 2) return e.type === "tier2";
    if (filter === 3) return e.type === "tier3";
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {(["all", 1, 2, 3, "alerts"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2 py-1 text-[10px] rounded transition-colors",
              filter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {f === "all" ? "All" : f === "alerts" ? "Alerts" : `Tier ${f}`}
          </button>
        ))}
      </div>

      {/* Events */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <p className="text-xs text-zinc-500">No events yet</p>
        ) : (
          filteredEvents.slice(0, 50).map((event) => (
            <div key={event.id} className="flex items-start gap-2 text-xs">
              <span className="text-[10px] text-zinc-500 w-16 flex-shrink-0">
                {event.timestamp.toLocaleTimeString()}
              </span>
              <span className={cn("flex-1", event.color)}>{event.description}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Config Tab
function ConfigTab({
  tier1,
  tier2,
  tier3,
  behavior,
  scope,
  updateTier1Config,
  updateTier2Config,
  updateTier3Config,
  updateBehavior,
  updateScope,
  resetLedger,
}: {
  tier1: { model: string; intervalSeconds: number; enabled: boolean };
  tier2: { model: string; intervalSeconds: number; enabled: boolean };
  tier3: { model: string; intervalSeconds: number; enabled: boolean; provider?: string; intervalHours?: number };
  behavior: {
    toastOnly: boolean;
    autoSwapEnabled: boolean;
    autoInjectEnabled: boolean;
    echoThreshold: number;
    strikeLimit: number;
  };
  scope: {
    parallelChat: boolean;
    singleChat: boolean;
    architect: boolean;
    builder: boolean;
  };
  updateTier1Config: (config: Partial<typeof tier1>) => void;
  updateTier2Config: (config: Partial<typeof tier2>) => void;
  updateTier3Config: (config: Partial<typeof tier3>) => void;
  updateBehavior: (config: Partial<typeof behavior>) => void;
  updateScope: (config: Partial<typeof scope>) => void;
  resetLedger: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-4">
      {/* Tier 1 Config */}
      <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
        <h4 className="text-xs font-semibold text-zinc-300">Tier 1 - Fast Skim</h4>
        <div>
          <label className="text-[10px] text-zinc-500">Model</label>
          <input
            type="text"
            value={tier1.model}
            onChange={(e) => updateTier1Config({ model: e.target.value })}
            className="w-full mt-1 px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">Interval (seconds): {tier1.intervalSeconds}</label>
          <input
            type="range"
            min={60}
            max={300}
            value={tier1.intervalSeconds}
            onChange={(e) => updateTier1Config({ intervalSeconds: Number(e.target.value) })}
            className="w-full mt-1"
          />
        </div>
      </div>

      {/* Tier 2 Config */}
      <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
        <h4 className="text-xs font-semibold text-zinc-300">Tier 2 - Review</h4>
        <div>
          <label className="text-[10px] text-zinc-500">Model</label>
          <input
            type="text"
            value={tier2.model}
            onChange={(e) => updateTier2Config({ model: e.target.value })}
            className="w-full mt-1 px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">Interval (seconds): {tier2.intervalSeconds}</label>
          <input
            type="range"
            min={120}
            max={600}
            value={tier2.intervalSeconds}
            onChange={(e) => updateTier2Config({ intervalSeconds: Number(e.target.value) })}
            className="w-full mt-1"
          />
        </div>
      </div>

      {/* Tier 3 Config */}
      <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
        <h4 className="text-xs font-semibold text-zinc-300">Tier 3 - Deep Audit (Cloud)</h4>
        <div>
          <label className="text-[10px] text-zinc-500">Model</label>
          <input
            type="text"
            value={tier3.model}
            onChange={(e) => updateTier3Config({ model: e.target.value })}
            className="w-full mt-1 px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">Interval (hours): {tier3.intervalHours || 4}</label>
          <input
            type="range"
            min={1}
            max={8}
            value={tier3.intervalHours || 4}
            onChange={(e) =>
              updateTier3Config({
                intervalHours: Number(e.target.value),
                intervalSeconds: Number(e.target.value) * 3600,
              })
            }
            className="w-full mt-1"
          />
        </div>
      </div>

      {/* Behavior */}
      <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
        <h4 className="text-xs font-semibold text-zinc-300">Behavior</h4>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={behavior.toastOnly}
            onChange={(e) => updateBehavior({ toastOnly: e.target.checked })}
            className="rounded"
          />
          Toast notifications only
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={behavior.autoSwapEnabled}
            onChange={(e) => updateBehavior({ autoSwapEnabled: e.target.checked })}
            className="rounded"
          />
          Auto-swap on 3 strikes
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={behavior.autoInjectEnabled}
            onChange={(e) => updateBehavior({ autoInjectEnabled: e.target.checked })}
            className="rounded"
          />
          Auto-inject corrections
        </label>
        <div>
          <label className="text-[10px] text-zinc-500">
            Echo threshold: {Math.round(behavior.echoThreshold * 100)}%
          </label>
          <input
            type="range"
            min={50}
            max={95}
            value={behavior.echoThreshold * 100}
            onChange={(e) => updateBehavior({ echoThreshold: Number(e.target.value) / 100 })}
            className="w-full mt-1"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">Strike limit: {behavior.strikeLimit}</label>
          <input
            type="range"
            min={1}
            max={5}
            value={behavior.strikeLimit}
            onChange={(e) => updateBehavior({ strikeLimit: Number(e.target.value) })}
            className="w-full mt-1"
          />
        </div>
      </div>

      {/* Scope */}
      <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
        <h4 className="text-xs font-semibold text-zinc-300">Scope</h4>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={scope.parallelChat}
            onChange={(e) => updateScope({ parallelChat: e.target.checked })}
            className="rounded"
          />
          Multi-Chat
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={scope.singleChat}
            onChange={(e) => updateScope({ singleChat: e.target.checked })}
            className="rounded"
          />
          Single Chat
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={scope.architect}
            onChange={(e) => updateScope({ architect: e.target.checked })}
            className="rounded"
          />
          Architect
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={scope.builder}
            onChange={(e) => updateScope({ builder: e.target.checked })}
            className="rounded"
          />
          Builder
        </label>
      </div>

      {/* Reset */}
      <div className="p-3 bg-zinc-800/50 rounded-lg space-y-2">
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-2 text-xs text-red-400 hover:text-red-300 border border-red-900 rounded transition-colors"
          >
            Reset Ledger
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">Are you sure? This clears all facts, alerts, and history.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetLedger();
                  setConfirmReset(false);
                }}
                className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Clear Storage Button */}
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem("jury-guardian-storage");
              window.location.reload();
            }
          }}
          className="w-full py-2 text-xs text-orange-400 hover:text-orange-300 border border-orange-900 rounded transition-colors"
        >
          Clear Storage & Reload
        </button>
      </div>
    </div>
  );
}
