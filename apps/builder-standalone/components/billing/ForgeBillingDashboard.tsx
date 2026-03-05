"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Flame, ArrowLeft, Settings, ArrowUpDown,
  Sun, Moon, DollarSign, Calendar, TrendingUp, Wallet, RefreshCw,
  Shield, ShieldOff, Plane, Radio, ExternalLink, Download, AlertTriangle,
  CheckCircle, Clock, Coins,
} from "lucide-react";
import { formatCost, calculateCost, getRate, PROVIDER_CONSOLE_URLS } from "@sarge/billing";
import type { ModelBreakdown, AppBreakdown, DailyTotal, UsageEntry } from "@sarge/billing";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { useSettingsStore, useAirGapStore } from "@sarge/core";
import Link from "next/link";

// Provider colors
const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#FF6700", openai: "#10B981", google: "#3B82F6",
  xai: "#A855F7", deepseek: "#06B6D4", ollama: "#6B7280",
  lmstudio: "#6B7280", mistral: "#FF7000", huggingface: "#FFD21E",
  perplexity: "#20B2AA", together: "#6366F1", groq: "#F55036",
};

function costColor(cost: number): string {
  if (cost < 0.01) return "text-emerald-400";
  if (cost <= 1.0) return "text-[#FF6700]";
  return "text-red-400";
}

type SortKey = "model" | "provider" | "callCount" | "totalCost" | "avgTokensPerSecond";
type ChartView = "all" | "trials" | "builder";

interface ProviderBalance {
  provider: string;
  status: "ok" | "error" | "no-key" | "no-api";
  balance?: number;
  currency?: string;
  message?: string;
  consoleUrl?: string;
  lastUpdated: string;
}

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
  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("month");
  const [todayCost, setTodayCost] = useState(0);
  const [weekCost, setWeekCost] = useState(0);
  const [monthCost, setMonthCost] = useState(0);
  const [allTimeCost, setAllTimeCost] = useState(0);
  const [models, setModels] = useState<ModelBreakdown[]>([]);
  const [apps, setApps] = useState<AppBreakdown[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortAsc, setSortAsc] = useState(false);
  const [chartView, setChartView] = useState<ChartView>("all");
  const [refreshing, setRefreshing] = useState(false);

  // Provider balances (from API)
  const [providerBalances, setProviderBalances] = useState<ProviderBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);

  // History
  const [history, setHistory] = useState<UsageEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Provider spend from models
  const providerSpend = useMemo(() => {
    const spend: Record<string, number> = {};
    models.forEach(m => {
      spend[m.provider] = (spend[m.provider] || 0) + m.totalCost;
    });
    return spend;
  }, [models]);

  // Provider spend for pie chart
  const providerPieData = useMemo(() => {
    return Object.entries(providerSpend)
      .filter(([, v]) => v > 0)
      .map(([provider, cost]) => ({
        name: provider,
        value: Math.round(cost * 10000) / 10000,
        fill: PROVIDER_COLORS[provider] || "#666",
      }))
      .sort((a, b) => b.value - a.value);
  }, [providerSpend]);

  const fetchBalances = useCallback(async (force = false) => {
    setBalancesLoading(true);
    try {
      const url = force ? "/api/billing/refresh" : "/api/billing/balances";
      const method = force ? "POST" : "GET";
      const res = await fetch(url, { method });
      const data = await res.json();
      setProviderBalances(data.balances || []);
    } catch {}
    setBalancesLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/billing/history?days=30");
      const data = await res.json();
      setHistory(data.entries || []);
    } catch {}
    setHistoryLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dayRes, weekRes, monthRes, allRes, periodRes, dailyRes] = await Promise.all([
        fetch("/api/billing/stats?period=day"),
        fetch("/api/billing/stats?period=week"),
        fetch("/api/billing/stats?period=month"),
        fetch("/api/billing/stats?period=all"),
        fetch(`/api/billing/stats?period=${period}`),
        fetch("/api/billing/daily?days=30"),
      ]);
      const dayData = await dayRes.json();
      const weekData = await weekRes.json();
      const monthData = await monthRes.json();
      const allData = await allRes.json();
      const periodData = await periodRes.json();
      const dailyData = await dailyRes.json();

      setTodayCost(dayData.totalCost || 0);
      setWeekCost(weekData.totalCost || 0);
      setMonthCost(monthData.totalCost || 0);
      setAllTimeCost(allData.totalCost || 0);
      setModels(periodData.modelBreakdown || []);
      setApps(periodData.appBreakdown || []);
      setDailyTotals(dailyData.dailyTotals || []);
    } catch {}
    setRefreshing(false);
  }, [period]);

  useEffect(() => { refresh(); fetchBalances(); fetchHistory(); }, [refresh, fetchBalances, fetchHistory]);

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

  const chartDataKey = chartView === "trials" ? "trialsCost" : chartView === "builder" ? "builderCost" : "cost";

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-0.5 ${sortKey === k ? "text-[#FF6700]" : "text-zinc-600"}`} />
  );

  /** Fix $0.00 for cloud models — recalculate from tokens if cost is zero */
  const getDisplayCost = (m: ModelBreakdown): number => {
    const isLocal = m.provider === "ollama" || m.provider === "lmstudio";
    if (m.totalCost > 0 || isLocal || m.totalTokensOut === 0) return m.totalCost;
    return calculateCost(m.model, m.provider, m.totalTokensIn, m.totalTokensOut);
  };

  const exportCSV = () => {
    const header = "Date,Model,Provider,App,Tokens In,Tokens Out,Cost,Duration (ms)\n";
    const rows = history.map(e =>
      `${e.timestamp},${e.model},${e.provider},${e.app},${e.tokensIn},${e.tokensOut},${e.cost},${e.durationMs}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-billing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periods: Array<{ key: "day" | "week" | "month" | "all"; label: string }> = [
    { key: "day", label: "Day" }, { key: "week", label: "Week" },
    { key: "month", label: "Month" }, { key: "all", label: "All" },
  ];

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "ok") return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === "no-key") return <AlertTriangle className="w-3.5 h-3.5 text-zinc-500" />;
    if (status === "no-api") return <ExternalLink className="w-3.5 h-3.5 text-amber-400" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center h-12 px-3 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all">
            <ArrowLeft className="w-3.5 h-3.5" /> Exit Billing
          </button>
          <button onClick={() => { refresh(); fetchBalances(true); fetchHistory(); }} disabled={refreshing || balancesLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-all border border-zinc-700 disabled:opacity-50" title="Refresh All">
            <RefreshCw className={`w-3.5 h-3.5 ${(refreshing || balancesLoading) ? "animate-spin" : ""}`} /> Refresh All
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-all border border-zinc-700" title="Export CSV">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center gap-3">
          <DollarSign className="w-5 h-5 text-[#FF6700] drop-shadow-[0_0_8px_rgba(255,103,0,0.6)]" />
          <span className="text-lg font-[900] tracking-[3px] bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent">FORGE BILLING</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={toggleSecureMode} title={secureMode ? "Disable Secure Mode" : "Enable Secure Mode"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${secureMode ? "bg-red-600/30 border-red-500/60 text-red-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
            {secureMode ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={toggleAirGap} title={airGapEnabled ? "Disable Air-Gap" : "Enable Air-Gap"} className={`flex items-center justify-center h-7 w-7 rounded-md text-xs transition-all border ${airGapEnabled ? "bg-amber-500/20 border-amber-400/50 text-amber-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
            {airGapEnabled ? <Plane className="h-3.5 w-3.5 rotate-45" /> : <Radio className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setTheme(isDark ? "light" : "dark")} className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all">
            {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <Link href="/settings" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all">
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Provider Balance Cards Row ── */}
      <div className="flex-shrink-0 px-3 pt-3">
        <div className="grid grid-cols-7 gap-2">
          {providerBalances.map(pb => {
            const color = PROVIDER_COLORS[pb.provider] || "#888";
            const spent = providerSpend[pb.provider] || 0;
            const ago = pb.lastUpdated ? Math.round((Date.now() - new Date(pb.lastUpdated).getTime()) / 60000) : null;
            return (
              <div key={pb.provider} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold text-white capitalize flex-1 truncate">{pb.provider}</span>
                  <StatusIcon status={pb.status} />
                </div>
                {pb.status === "ok" && pb.balance !== undefined ? (
                  <div className="text-lg font-bold font-mono text-emerald-400">${pb.balance.toFixed(2)}</div>
                ) : (
                  <div className="text-xs font-bold text-zinc-400 truncate">{pb.message || "—"}</div>
                )}
                {spent > 0 && (
                  <div className="text-[10px] text-zinc-500">This period: <span className="text-white font-bold">{formatCost(spent)}</span></div>
                )}
                <div className="flex items-center gap-1 mt-auto">
                  {ago !== null && <span className="text-[9px] text-zinc-600">{ago < 1 ? "Just now" : `${ago}m ago`}</span>}
                  {pb.consoleUrl && (
                    <a href={pb.consoleUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-zinc-500 hover:text-[#FF6700] ml-auto flex items-center gap-0.5">
                      Console <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {providerBalances.length === 0 && !balancesLoading && (
            <div className="col-span-7 text-center text-zinc-500 text-sm py-3">
              Loading provider balances...
            </div>
          )}
        </div>
      </div>

      {/* ── Running Total Bar ── */}
      <div className="flex-shrink-0 px-3 pt-2">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Today", value: todayCost, Icon: DollarSign, accent: "text-white" },
            { label: "This Week", value: weekCost, Icon: Calendar, accent: "text-white" },
            { label: "This Month", value: monthCost, Icon: TrendingUp, accent: "text-[#FF6700]" },
            { label: "All Time", value: allTimeCost, Icon: Wallet, accent: "text-[#FFD700]" },
          ].map(({ label, value, Icon, accent }) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 flex items-center gap-3">
              <Icon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
                <div className={`text-xl font-bold font-mono ${accent}`}>{formatCost(value)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="flex flex-1 overflow-hidden px-3 pt-2 pb-3 gap-3">
        {/* LEFT COLUMN (60%) */}
        <div className="flex flex-col flex-[6] overflow-hidden gap-3">
          {/* 30-Day Spend Chart */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white">30-Day Spend</h2>
              <div className="flex items-center gap-0.5">
                {(["all", "trials", "builder"] as ChartView[]).map((view) => (
                  <button key={view} onClick={() => setChartView(view)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                      chartView === view
                        ? view === "trials" ? "bg-[#FFD700]/20 text-[#FFD700]" : "bg-[#FF6700]/20 text-[#FF6700]"
                        : "text-zinc-500 hover:text-white"
                    }`}
                  >{view === "all" ? "All" : view === "trials" ? "Trials" : "Builder"}</button>
                ))}
              </div>
            </div>
            <div className="h-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTotals} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="billingOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF6700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 10, fill: "#bbb" }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis stroke="#555" tick={{ fontSize: 10, fill: "#bbb" }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={38} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "13px", fontWeight: "bold" }}
                    formatter={(value: any) => [`$${(typeof value === 'number' ? value : 0).toFixed(4)}`, chartView === "trials" ? "Trials" : chartView === "builder" ? "Builder" : "All"]}
                    labelFormatter={(label: any) => String(label)} />
                  <Area type="monotone" dataKey={chartDataKey} stroke="#FF6700" strokeWidth={2} fill="url(#billingOrangeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Breakdown Table */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 flex-shrink-0">
              <h2 className="text-sm font-bold text-white">Model Breakdown</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {periods.map(({ key, label }) => (
                    <button key={key} onClick={() => setPeriod(key)}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${period === key ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-zinc-500">{sortedModels.length} models</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="border-b border-zinc-800">
                    <th onClick={() => handleSort("model")} className="text-left px-3 py-2 font-bold text-white cursor-pointer text-xs uppercase tracking-wide">Model<SortIcon k="model" /></th>
                    <th onClick={() => handleSort("provider")} className="text-left px-2 py-2 font-bold text-white cursor-pointer text-xs uppercase tracking-wide">Provider<SortIcon k="provider" /></th>
                    <th className="text-right px-2 py-2 font-bold text-white text-xs uppercase tracking-wide">Tokens In</th>
                    <th className="text-right px-2 py-2 font-bold text-white text-xs uppercase tracking-wide">Tokens Out</th>
                    <th onClick={() => handleSort("callCount")} className="text-right px-2 py-2 font-bold text-white cursor-pointer text-xs uppercase tracking-wide">Rounds<SortIcon k="callCount" /></th>
                    <th onClick={() => handleSort("totalCost")} className="text-right px-2 py-2 font-bold text-white cursor-pointer text-xs uppercase tracking-wide">Cost<SortIcon k="totalCost" /></th>
                    <th className="text-right px-3 py-2 font-bold text-white text-xs uppercase tracking-wide">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-500 text-sm">No usage data for this period</td></tr>
                  )}
                  {sortedModels.map((m, i) => {
                    const displayCost = getDisplayCost(m);
                    const rate = getRate(m.model, m.provider);
                    return (
                      <tr key={`${m.provider}/${m.model}`} className={i % 2 === 0 ? "" : "bg-zinc-900/40"}>
                        <td className="px-3 py-2 font-bold text-white truncate max-w-[200px]">{m.model}</td>
                        <td className="px-2 py-2">
                          <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: (PROVIDER_COLORS[m.provider] || "#666") + "22", color: PROVIDER_COLORS[m.provider] || "#888" }}>
                            {m.provider}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-mono text-right text-zinc-400 text-xs">{m.totalTokensIn.toLocaleString()}</td>
                        <td className="px-2 py-2 font-mono text-right text-zinc-400 text-xs">{m.totalTokensOut.toLocaleString()}</td>
                        <td className="px-2 py-2 font-mono text-right text-white">{m.callCount}</td>
                        <td className={`px-2 py-2 font-mono text-right font-bold ${costColor(displayCost)}`}>{formatCost(displayCost)}</td>
                        <td className="px-3 py-2 font-mono text-right text-zinc-500 text-xs">
                          {rate.input > 0 ? `$${rate.input}/${rate.output}` : "free"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (40%) */}
        <div className="flex flex-col flex-[4] overflow-auto gap-3">
          {/* Cost by Provider (Pie) */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 flex-shrink-0">
            <h2 className="text-sm font-bold text-white mb-2">Spend by Provider</h2>
            {providerPieData.length === 0 ? (
              <div className="text-zinc-500 text-center py-6 text-sm">No spend data</div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-[140px] w-[140px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={providerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} strokeWidth={0}>
                        {providerPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "12px", fontWeight: "bold" }}
                        formatter={(value: any) => [`$${(typeof value === 'number' ? value : 0).toFixed(4)}`]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {providerPieData.map(d => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="text-white font-bold capitalize flex-1">{d.name}</span>
                      <span className="font-mono text-zinc-400">{formatCost(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* App Breakdown */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 flex-shrink-0">
            <h2 className="text-sm font-bold text-white mb-2">App Breakdown</h2>
            {apps.length === 0 ? (
              <div className="text-zinc-500 text-center py-4 text-sm">No data</div>
            ) : (
              <div className="space-y-1.5">
                {apps.sort((a, b) => b.totalCost - a.totalCost).map((a) => {
                  const maxCost = Math.max(...apps.map(x => x.totalCost), 0.001);
                  const pct = (a.totalCost / maxCost) * 100;
                  const color = ({ builder: "#FF6700", foundry: "#FF6700", "trials-cloud": "#FFD700", "trials-hybrid": "#FFD700", guardian: "#10B981", chat: "#06B6D4" } as Record<string, string>)[a.app] || "#6B7280";
                  return (
                    <div key={a.app} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white w-24 truncate">{a.app}</span>
                      <div className="flex-1 h-3.5 bg-zinc-800 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <span className={`text-xs font-mono font-bold w-16 text-right ${costColor(a.totalCost)}`}>{formatCost(a.totalCost)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-Run History */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 flex-shrink-0">
              <h2 className="text-sm font-bold text-white">Recent Runs (30d)</h2>
              <span className="text-xs text-zinc-500">{history.length} entries</span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-2 py-1.5 font-bold text-zinc-400">Time</th>
                    <th className="text-left px-2 py-1.5 font-bold text-zinc-400">Model</th>
                    <th className="text-right px-2 py-1.5 font-bold text-zinc-400">In</th>
                    <th className="text-right px-2 py-1.5 font-bold text-zinc-400">Out</th>
                    <th className="text-right px-2 py-1.5 font-bold text-zinc-400">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={5} className="px-2 py-4 text-center text-zinc-600">{historyLoading ? "Loading..." : "No history"}</td></tr>
                  )}
                  {history.slice(0, 200).map((e, i) => {
                    const rate = getRate(e.model, e.provider);
                    const recalcCost = e.cost > 0 ? e.cost : calculateCost(e.model, e.provider, e.tokensIn, e.tokensOut);
                    return (
                      <tr key={e.id || i} className={`${i % 2 === 0 ? "" : "bg-zinc-900/40"} hover:bg-zinc-800/50`}>
                        <td className="px-2 py-1 text-zinc-500 whitespace-nowrap">
                          <Clock className="w-2.5 h-2.5 inline mr-0.5 text-zinc-600" />
                          {new Date(e.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-2 py-1">
                          <span className="text-white font-bold truncate block max-w-[120px]">{e.model}</span>
                          <span className="text-zinc-600">{e.app}</span>
                        </td>
                        <td className="px-2 py-1 font-mono text-right text-zinc-500">{e.tokensIn.toLocaleString()}</td>
                        <td className="px-2 py-1 font-mono text-right text-zinc-500">{e.tokensOut.toLocaleString()}</td>
                        <td className={`px-2 py-1 font-mono text-right font-bold ${costColor(recalcCost)}`}>{formatCost(recalcCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
