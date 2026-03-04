"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Flame, ArrowLeft, Settings, ChevronDown, ChevronUp, ArrowUpDown,
  Sun, Moon, DollarSign, Calendar, TrendingUp, Wallet, RefreshCw,
  Shield, ShieldOff, Plane, Radio,
} from "lucide-react";
import { formatCost, calculateCost, getRate } from "@sarge/billing";
import type { ModelBreakdown, AppBreakdown, DailyTotal, BillingConfig, UsageEntry } from "@sarge/billing";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { useSettingsStore, useAirGapStore } from "@sarge/core";
import { launchBillingPopout } from "@/lib/billingPopoutManager";
import Link from "next/link";

// Provider colors
const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#FF6700",
  openai: "#10B981",
  google: "#3B82F6",
  xai: "#A855F7",
  deepseek: "#06B6D4",
  ollama: "#6B7280",
  lmstudio: "#6B7280",
  mistral: "#FF7000",
  huggingface: "#FFD21E",
  perplexity: "#20B2AA",
  together: "#6366F1",
  groq: "#F55036",
};

function costColor(cost: number): string {
  if (cost < 0.01) return "text-emerald-400";
  if (cost <= 1.0) return "text-[#FF6700]";
  return "text-red-400";
}

function balanceColor(balance: number): string {
  if (balance > 20) return "text-emerald-400";
  if (balance >= 10) return "text-amber-400";
  return "text-red-400";
}

function balanceBorder(balance: number): string {
  if (balance > 20) return "border-emerald-500/30";
  if (balance >= 10) return "border-amber-500/30";
  return "border-red-500/30";
}

function balanceBarColor(ratio: number): string {
  if (ratio < 0.5) return "bg-emerald-500";
  if (ratio < 0.8) return "bg-amber-500";
  return "bg-red-500";
}

type SortKey = "model" | "provider" | "callCount" | "totalCost" | "avgTokensPerSecond";
type ChartView = "all" | "trials" | "builder";

/** Build model breakdown from filtered usage entries */
function buildModelBreakdown(entries: UsageEntry[]): ModelBreakdown[] {
  const map = new Map<string, ModelBreakdown>();
  for (const e of entries) {
    const key = `${e.provider}/${e.model}`;
    const existing = map.get(key) || {
      model: e.model, provider: e.provider, totalCost: 0, callCount: 0,
      totalTokensIn: 0, totalTokensOut: 0, avgTokensPerSecond: 0,
    };
    existing.totalCost += e.cost;
    existing.callCount += 1;
    existing.totalTokensIn += e.tokensIn;
    existing.totalTokensOut += e.tokensOut;
    map.set(key, existing);
  }
  return Array.from(map.values()).map(m => {
    const relevant = entries.filter(e => e.model === m.model && e.provider === m.provider);
    m.avgTokensPerSecond = relevant.length > 0
      ? Math.round(relevant.reduce((s, e) => s + e.tokensPerSecond, 0) / relevant.length * 10) / 10
      : 0;
    return m;
  });
}

export default function ForgeBillingDashboard({ onClose }: { onClose: () => void }) {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const secureMode = useAirGapStore((s) => s.secureMode);
  const toggleSecureMode = useAirGapStore((s) => s.toggleSecureMode);
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const toggleAirGap = useAirGapStore((s) => s.toggleAirGap);
  const isDark = theme === "dark";

  // Data state
  const [todayCost, setTodayCost] = useState(0);
  const [weekCost, setWeekCost] = useState(0);
  const [monthCost, setMonthCost] = useState(0);
  const [monthTrialsCost, setMonthTrialsCost] = useState(0);
  const [models, setModels] = useState<ModelBreakdown[]>([]);
  const [apps, setApps] = useState<AppBreakdown[]>([]);
  const [periodEntries, setPeriodEntries] = useState<UsageEntry[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [config, setConfig] = useState<BillingConfig>({ balance: 50, alertAt: 10, dailyCap: 5, weeklyCap: 25 });
  const [showSettings, setShowSettings] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortAsc, setSortAsc] = useState(false);
  const [chartView, setChartView] = useState<ChartView>("all");
  const [refreshing, setRefreshing] = useState(false);

  // Editable config fields
  const [editBalance, setEditBalance] = useState("");
  const [editAlertAt, setEditAlertAt] = useState("");
  const [editDailyCap, setEditDailyCap] = useState("");
  const [editWeeklyCap, setEditWeeklyCap] = useState("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dayRes, weekRes, monthRes, periodRes, dailyRes, configRes] = await Promise.all([
        fetch("/api/billing/stats?period=day"),
        fetch("/api/billing/stats?period=week"),
        fetch("/api/billing/stats?period=month"),
        fetch("/api/billing/stats?period=month"),
        fetch("/api/billing/daily?days=30"),
        fetch("/api/billing/balance"),
      ]);
      const dayData = await dayRes.json();
      const weekData = await weekRes.json();
      const monthData = await monthRes.json();
      const periodData = await periodRes.json();
      const dailyData = await dailyRes.json();
      const configData = await configRes.json();

      setTodayCost(dayData.totalCost || 0);
      setWeekCost(weekData.totalCost || 0);
      setMonthCost(monthData.totalCost || 0);
      setModels(periodData.modelBreakdown || []);
      setApps(periodData.appBreakdown || []);
      setPeriodEntries(periodData.entries || []);
      setDailyTotals(dailyData.dailyTotals || []);
      setConfig(configData);
      setEditBalance(String(configData.balance ?? 50));
      setEditAlertAt(String(configData.alertAt ?? 10));
      setEditDailyCap(String(configData.dailyCap ?? ""));
      setEditWeeklyCap(String(configData.weeklyCap ?? ""));

      const trialsApp = (monthData.appBreakdown || []).find((a: AppBreakdown) => a.app === "trials-cloud");
      setMonthTrialsCost(trialsApp ? trialsApp.totalCost : 0);
    } catch {}
    setRefreshing(false);
  }, []);

  // Fetch ONCE on mount — no polling
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sorted models
  const sortedModels = useMemo(() => {
    const sorted = [...models].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return sorted;
  }, [models, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Top 5 models for right panel
  const topModels = useMemo(() =>
    [...models].sort((a, b) => b.totalCost - a.totalCost).slice(0, 5),
  [models]);

  // Days remaining estimate
  const daysRemaining = useMemo(() => {
    if (dailyTotals.length === 0 || monthCost === 0) return null;
    const avgDaily = monthCost / Math.max(dailyTotals.length, 1);
    if (avgDaily <= 0) return null;
    return Math.round(config.balance / avgDaily);
  }, [dailyTotals, monthCost, config.balance]);

  const balanceRatio = useMemo(() => {
    if (config.balance <= 0) return 1;
    return Math.min(monthCost / config.balance, 1);
  }, [monthCost, config.balance]);

  const chartDataKey = chartView === "trials" ? "trialsCost" : chartView === "builder" ? "builderCost" : "cost";

  const saveConfig = async () => {
    try {
      const updated = {
        balance: parseFloat(editBalance) || 0,
        alertAt: parseFloat(editAlertAt) || 10,
        dailyCap: editDailyCap ? parseFloat(editDailyCap) : null,
        weeklyCap: editWeeklyCap ? parseFloat(editWeeklyCap) : null,
      };
      await fetch("/api/billing/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setConfig(updated as BillingConfig);
    } catch {}
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ArrowUpDown className={`w-2.5 h-2.5 inline ml-0.5 ${sortKey === k ? "text-[#FF6700]" : "text-zinc-600"}`} />
  );

  /** Fix $0.00 for cloud models — recalculate from tokens if cost is zero */
  const getDisplayCost = (m: ModelBreakdown): number => {
    const isLocal = m.provider === "ollama" || m.provider === "lmstudio";
    if (m.totalCost > 0 || isLocal || m.totalTokensOut === 0) return m.totalCost;
    return calculateCost(m.model, m.provider, m.totalTokensIn, m.totalTokensOut);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ── Toolbar (48px) ── */}
      <div className="flex items-center h-12 px-3 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0">
        {/* Left: Exit + Refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exit Billing
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-all border border-zinc-700 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Center: Title */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <DollarSign className="w-5 h-5 text-[#FF6700] drop-shadow-[0_0_8px_rgba(255,103,0,0.6)]" />
          <span className="text-lg font-[900] tracking-[3px] bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent">
            FORGE BILLING
          </span>
        </div>

        {/* Right: Header icons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={toggleSecureMode} title={secureMode ? "Disable Secure Mode" : "Enable Secure Mode"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${secureMode ? "bg-red-600/30 border-red-500/60 text-red-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
            {secureMode ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={toggleAirGap} title={airGapEnabled ? "Disable Air-Gap" : "Enable Air-Gap"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${airGapEnabled ? "bg-amber-500/20 border-amber-400/50 text-amber-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
            {airGapEnabled ? <Plane className="h-3.5 w-3.5 rotate-45" /> : <Radio className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setTheme(isDark ? "light" : "dark")} title="Toggle theme" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all">
            {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <Link href="/settings" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all">
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Two-Column Layout — zero scrolling ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN (60%) */}
        <div className="flex flex-col flex-[6] border-r border-zinc-800 overflow-hidden p-3 gap-3">
          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-2 flex-shrink-0">
            {[
              { label: "Today", value: todayCost, Icon: DollarSign },
              { label: "Week", value: weekCost, Icon: Calendar },
              { label: "Month", value: monthCost, Icon: TrendingUp },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
                <div className="flex items-center gap-1 mb-0.5">
                  <Icon className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
                </div>
                <div className="text-lg font-bold font-mono text-white">
                  {formatCost(value)}
                </div>
              </div>
            ))}

            {/* Trials card */}
            <div className="rounded-lg border border-[#FFD700]/20 bg-zinc-900/50 p-2.5">
              <div className="flex items-center gap-1 mb-0.5">
                <Flame className="w-3 h-3 text-[#FFD700]/70" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700]/70">Trials</span>
              </div>
              <div className="text-lg font-bold font-mono text-[#FFD700]">
                {formatCost(monthTrialsCost)}
              </div>
            </div>

            {/* Balance card */}
            <div className={`rounded-lg border bg-zinc-900/50 p-2.5 ${balanceBorder(config.balance)}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <Wallet className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Balance</span>
              </div>
              <div className={`text-lg font-bold font-mono ${balanceColor(config.balance)}`}>
                {formatCost(config.balance)}
              </div>
              <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${balanceBarColor(balanceRatio)}`} style={{ width: `${Math.round(balanceRatio * 100)}%` }} />
              </div>
              {daysRemaining !== null && (
                <div className="text-[9px] mt-0.5 text-zinc-600">~{daysRemaining}d left</div>
              )}
            </div>
          </div>

          {/* 30-Day Spend Chart (compact) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-zinc-300">30-Day Spend</h2>
              <div className="flex items-center gap-0.5">
                {(["all", "trials", "builder"] as ChartView[]).map((view) => (
                  <button
                    key={view}
                    onClick={() => setChartView(view)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      chartView === view
                        ? view === "trials"
                          ? "bg-[#FFD700]/20 text-[#FFD700]"
                          : "bg-[#FF6700]/20 text-[#FF6700]"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    {view === "all" ? "All" : view === "trials" ? "Tri" : "Bld"}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTotals} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="billingOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF6700" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="billingGoldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 9, fill: "#777" }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis stroke="#555" tick={{ fontSize: 9, fill: "#777" }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} width={35} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
                    formatter={(value: any) => [`$${(typeof value === 'number' ? value : 0).toFixed(4)}`, chartView === "trials" ? "Trials" : chartView === "builder" ? "Builder" : "All"]}
                    labelFormatter={(label: any) => String(label)}
                  />
                  <Area type="monotone" dataKey={chartDataKey} stroke={chartView === "trials" ? "#FFD700" : "#FF6700"} strokeWidth={2} fill={chartView === "trials" ? "url(#billingGoldGrad)" : "url(#billingOrangeGrad)"} />
                  {chartView === "all" && (
                    <>
                      <Area type="monotone" dataKey="trialsCost" stroke="#FFD700" strokeWidth={1} strokeDasharray="4 2" fill="none" />
                      <Area type="monotone" dataKey="builderCost" stroke="#FF6700" strokeWidth={1} strokeDasharray="3 2" fill="none" />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Breakdown Table (fills remaining space) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 flex-shrink-0">
              <h2 className="text-xs font-bold text-zinc-300">Model Breakdown</h2>
              <span className="text-[10px] text-zinc-600">{sortedModels.length} models</span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="border-b border-zinc-800">
                    <th onClick={() => handleSort("model")} className="text-left px-3 py-1.5 font-bold text-zinc-500 cursor-pointer">Model<SortIcon k="model" /></th>
                    <th onClick={() => handleSort("provider")} className="text-left px-2 py-1.5 font-bold text-zinc-500 cursor-pointer">Provider<SortIcon k="provider" /></th>
                    <th onClick={() => handleSort("callCount")} className="text-right px-2 py-1.5 font-bold text-zinc-500 cursor-pointer">Rounds<SortIcon k="callCount" /></th>
                    <th onClick={() => handleSort("totalCost")} className="text-right px-2 py-1.5 font-bold text-zinc-500 cursor-pointer">Cost<SortIcon k="totalCost" /></th>
                    <th className="text-right px-3 py-1.5 font-bold text-zinc-500">Cost/Round</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-zinc-600 text-[10px]">No usage data</td></tr>
                  )}
                  {sortedModels.map((m, i) => {
                    const displayCost = getDisplayCost(m);
                    const costPerRound = m.callCount > 0 ? displayCost / m.callCount : 0;
                    return (
                      <tr key={`${m.provider}/${m.model}`} className={i % 2 === 0 ? "" : "bg-zinc-900/40"}>
                        <td className="px-3 py-1.5 font-bold text-white truncate max-w-[180px]">{m.model}</td>
                        <td className="px-2 py-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: (PROVIDER_COLORS[m.provider] || "#666") + "22", color: PROVIDER_COLORS[m.provider] || "#888" }}>
                            {m.provider}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 font-mono text-right text-zinc-400">{m.callCount}</td>
                        <td className={`px-2 py-1.5 font-mono text-right ${costColor(displayCost)}`}>{formatCost(displayCost)}</td>
                        <td className="px-3 py-1.5 font-mono text-right text-zinc-400">{formatCost(costPerRound)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (40%) */}
        <div className="flex flex-col flex-[4] overflow-hidden p-3 gap-3">
          {/* Top Models by Spend */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-zinc-300 mb-2">Top Models by Spend</h2>
            {topModels.length === 0 ? (
              <div className="text-zinc-600 text-center py-4 text-[10px]">No data</div>
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topModels} layout="vertical" margin={{ top: 2, right: 20, left: 60, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#777" }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                    <YAxis type="category" dataKey="model" tick={{ fontSize: 9, fill: "#ccc", fontWeight: "bold" }} width={60} />
                    <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "11px" }} formatter={(value: any) => [`$${(typeof value === 'number' ? value : 0).toFixed(4)}`, "Cost"]} />
                    <Bar dataKey="totalCost" radius={[0, 3, 3, 0]}>
                      {topModels.map((m, i) => (
                        <Cell key={i} fill={PROVIDER_COLORS[m.provider] || "#FF6700"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* App Breakdown */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 flex-shrink-0">
            <h2 className="text-xs font-bold text-zinc-300 mb-2">App Breakdown</h2>
            {apps.length === 0 ? (
              <div className="text-zinc-600 text-center py-4 text-[10px]">No data</div>
            ) : (
              <div className="space-y-1.5">
                {apps.sort((a, b) => b.totalCost - a.totalCost).map((a) => {
                  const maxCost = Math.max(...apps.map(x => x.totalCost), 0.001);
                  const pct = (a.totalCost / maxCost) * 100;
                  const color = ({
                    builder: "#FF6700", foundry: "#FF6700", "forge-trials": "#FFD700",
                    "trials-cloud": "#FFD700", guardian: "#10B981", "jury-duty": "#A855F7",
                    chat: "#06B6D4", debate: "#F43F5E",
                  } as Record<string, string>)[a.app] || "#6B7280";
                  return (
                    <div key={a.app} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-400 w-20 truncate">{a.app}</span>
                      <div className="flex-1 h-3 bg-zinc-800 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <span className={`text-[10px] font-mono font-bold w-14 text-right ${costColor(a.totalCost)}`}>
                        {formatCost(a.totalCost)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alert Settings (collapsible, fills remaining space) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 flex-shrink-0">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 w-full px-3 py-2 font-bold text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Settings className="w-3 h-3" />
              Alert Settings
              {showSettings ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </button>
            {showSettings && (
              <div className="px-3 pb-3 border-t border-zinc-800 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Balance ($)", value: editBalance, set: setEditBalance },
                    { label: "Alert At ($)", value: editAlertAt, set: setEditAlertAt },
                    { label: "Daily Cap ($)", value: editDailyCap, set: setEditDailyCap, ph: "No cap" },
                    { label: "Weekly Cap ($)", value: editWeeklyCap, set: setEditWeeklyCap, ph: "No cap" },
                  ].map(({ label, value, set, ph }) => (
                    <div key={label}>
                      <label className="block text-[10px] font-bold mb-0.5 text-zinc-500">{label}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder={ph}
                        className="w-full px-2 py-1 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-700"
                      />
                    </div>
                  ))}
                </div>
                <button onClick={saveConfig} className="mt-2 w-full px-3 py-1.5 bg-[#FF6700] hover:bg-[#FF8C00] text-white font-bold rounded text-[11px] transition-colors">
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
