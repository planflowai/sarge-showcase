"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Square, ExternalLink, Cpu, MemoryStick, RefreshCw, Zap, Shield,
  MessageSquare, Hammer, Activity, AppWindow, Swords, Scale, ShieldCheck,
  Search, MonitorCog, Clock, Rocket, KeyRound,
} from "lucide-react";

/* ── App Definitions ── */

interface AppDef {
  name: string;
  label: string;
  port: number;
  color: string;
  icon: React.ComponentType<any>;
  description: string;
  selfManaged?: boolean;
}

const APPS: AppDef[] = [
  { name: "beast", label: "S.A.R.G.E.", port: 5000, color: "#FF6700", icon: Zap, description: "The Beast — full monolith app" },
  { name: "chat-standalone", label: "Chat", port: 3100, color: "#4285f4", icon: MessageSquare, description: "Standalone chat interface" },
  { name: "builder-standalone", label: "The Foundry", port: 3101, color: "#FF6700", icon: Hammer, description: "AI-powered code builder" },
  { name: "diagnostics-standalone", label: "Diagnostics", port: 3102, color: "#888888", icon: Activity, description: "System diagnostics dashboard" },
  { name: "apps-standalone", label: "Apps Hub", port: 3103, color: "#888888", icon: AppWindow, description: "Resume Tailor & more" },
  { name: "war-room", label: "War Room", port: 3004, color: "#8b5cf6", icon: MonitorCog, description: "6-monitor cockpit" },
  { name: "guardian-standalone", label: "Thread Guardian", port: 3104, color: "#22c55e", icon: Shield, description: "Conversation security monitor" },
  { name: "jury-standalone", label: "Jury Duty", port: 3105, color: "#eab308", icon: Scale, description: "Multi-chat quality cross-check" },
  { name: "debate-standalone", label: "Debate Arena", port: 3106, color: "#ef4444", icon: Swords, description: "AI Tribunal & debates" },
  { name: "forensic-standalone", label: "Forensic Log", port: 3107, color: "#00b4d8", icon: ShieldCheck, description: "Full audit trail viewer" },
  { name: "trading-standalone", label: "Trading Desk", port: 3108, color: "#10a37f", icon: Search, description: "Live market intelligence" },
  { name: "launchpad-standalone", label: "Launch Pad", port: 3109, color: "#FF6700", icon: Rocket, description: "Start/stop all apps", selfManaged: true },
  { name: "env-manager-standalone", label: "ENV Manager", port: 3110, color: "#a855f7", icon: KeyRound, description: "API key management (PIN-locked)" },
];

/* ── Types ── */

interface AppStatus {
  name: string;
  port: number;
  status: "online" | "stopped" | "errored" | "launching";
  cpu: number;
  memory: number;
  uptime: number | null;
  restarts: number;
}

interface SystemStatus {
  totalCpu: number;
  totalMemory: number;
  totalMemoryMB: number;
  runningCount: number;
  totalCount: number;
}

/* ── Helpers ── */

function formatMemory(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function formatUptime(ms: number | null): string {
  if (!ms) return "";
  const elapsed = Date.now() - ms;
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/* ── Component ── */

export function LauncherDashboard() {
  const [statuses, setStatuses] = useState<Record<string, AppStatus>>({});
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/launcher/status");
      const data = await res.json();
      const map: Record<string, AppStatus> = {};
      for (const app of data.apps) map[app.name] = app;
      setStatuses(map);
      setSystem(data.system);
      setLastRefresh(new Date());
      setError(data.error || null);
    } catch {
      setError("Failed to reach launcher API");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStatus]);

  const toggleApp = async (appName: string, action: "start" | "stop") => {
    setToggling((prev) => new Set(prev).add(appName));
    setStatuses((prev) => ({
      ...prev,
      [appName]: { ...prev[appName], status: action === "start" ? "launching" : "stopped" },
    }));
    try {
      const res = await fetch("/api/launcher/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, action }),
      });
      const data = await res.json();
      if (data.success && data.app) {
        setStatuses((prev) => ({ ...prev, [appName]: { ...prev[appName], ...data.app } }));
      }
      setTimeout(fetchStatus, 2000);
    } catch {
      await fetchStatus();
    } finally {
      setToggling((prev) => { const next = new Set(prev); next.delete(appName); return next; });
    }
  };

  const openApp = (port: number) => { window.open(`http://localhost:${port}`, "_blank"); };

  const statusDotColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
      case "launching": return "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse";
      case "errored": return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
      default: return "bg-zinc-600";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "online": return "Running";
      case "launching": return "Starting...";
      case "errored": return "Errored";
      default: return "Stopped";
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-[#0a0a0a]">
      <div className="max-w-[2400px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-1">
            <Rocket className="w-7 h-7 text-[#FF6700]" />
            <h1 className="text-[28px] font-bold tracking-[0.15em] uppercase" style={{ color: "#FF6700" }}>
              LAUNCH PAD
            </h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {system?.totalCount ?? 13} Apps &middot; Click to Launch
          </p>
        </div>

        {/* System stats bar */}
        <div className="flex items-center justify-center gap-6 mb-8 text-sm">
          <div className="flex items-center gap-4 px-6 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-300">CPU: <span className="font-mono font-semibold text-zinc-900 dark:text-white">{system?.totalCpu ?? 0}%</span></span>
            </div>
            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-300">RAM: <span className="font-mono font-semibold text-zinc-900 dark:text-white">{system ? formatMemory(system.totalMemory) : "—"}</span></span>
            </div>
            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 dark:text-zinc-300">Running: <span className="font-mono font-semibold text-green-600 dark:text-green-400">{system?.runningCount ?? 0}</span><span className="text-zinc-400">/{system?.totalCount ?? 13}</span></span>
            </div>
            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
            <button onClick={fetchStatus} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors" title="Refresh now">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-xs">{lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="text-center text-yellow-600 dark:text-yellow-400 text-sm mb-4">PM2: {error}</div>
        )}

        {/* App Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {APPS.map((app) => {
            const status = statuses[app.name];
            const isOnline = status?.status === "online";
            const isLaunching = status?.status === "launching";
            const isSelf = app.selfManaged === true;
            const isToggling = toggling.has(app.name);
            const Icon = app.icon;

            return (
              <div
                key={app.name}
                className="relative rounded-xl border-2 bg-white dark:bg-zinc-900/80 overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
                style={{
                  borderColor: isOnline || isSelf ? app.color : "rgba(63,63,70,0.5)",
                  boxShadow: isOnline || isSelf ? `0 0 20px ${app.color}15, 0 0 40px ${app.color}08` : undefined,
                }}
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: isOnline || isSelf ? app.color : "transparent" }} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${app.color}18`, color: app.color }}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[20px] leading-tight text-zinc-900 dark:text-white">{app.label}</h3>
                        <span className="text-sm font-mono text-zinc-400">:{app.port}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor(isSelf ? "online" : status?.status || "stopped")}`} />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{isSelf ? "Always Running" : statusLabel(status?.status || "stopped")}</span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-4">{app.description}</p>
                  {(isOnline || isSelf) && status && (
                    <div className="flex items-center gap-3 text-sm text-zinc-400 mb-4 font-mono">
                      <span>CPU {status.cpu}%</span>
                      <span>&middot;</span>
                      <span>{formatMemory(status.memory)}</span>
                      {status.uptime && (<><span>&middot;</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatUptime(status.uptime)}</span></>)}
                    </div>
                  )}
                  {isSelf && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3" style={{ backgroundColor: `${app.color}20`, color: app.color }}>
                      <Rocket className="w-3 h-3" />
                      Always Running
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {isSelf ? (
                      <button onClick={() => openApp(app.port)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                        <ExternalLink className="w-4 h-4" /> Open
                      </button>
                    ) : isOnline ? (
                      <>
                        <button onClick={() => toggleApp(app.name, "stop")} disabled={isToggling} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-500 disabled:opacity-50">
                          <Square className="w-4 h-4" /> {isToggling ? "Stopping..." : "Stop"}
                        </button>
                        <button onClick={() => openApp(app.port)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white" style={{ backgroundColor: app.color }}>
                          <ExternalLink className="w-4 h-4" /> Open
                        </button>
                      </>
                    ) : (
                      <button onClick={() => toggleApp(app.name, "start")} disabled={isToggling || isLaunching} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-green-500/10 hover:bg-green-500/20 text-green-500 disabled:opacity-50">
                        <Play className="w-4 h-4" /> {isToggling || isLaunching ? "Starting..." : "Start"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8 text-xs text-zinc-500 dark:text-zinc-600">
          Auto-refreshes every 5s &middot; PM2 ecosystem managed
        </div>
      </div>
    </div>
  );
}
