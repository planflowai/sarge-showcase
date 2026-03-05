"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Flame, ArrowLeft, Settings, ArrowUpDown,
  Sun, Moon, DollarSign, Calendar, TrendingUp, Wallet, RefreshCw,
  Shield, ShieldOff, Plane, Radio, ExternalLink, Download, AlertTriangle,
  CheckCircle, Clock, ChevronDown, ChevronRight, Pencil, Check,
} from "lucide-react";
import { formatCost, calculateCost, getRate, PROVIDER_CONSOLE_URLS } from "@sarge/billing";
import type { ModelBreakdown, AppBreakdown, DailyTotal, UsageEntry } from "@sarge/billing";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
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
type HistoryPeriod = "day" | "week" | "month";

interface ProviderBalance {
  provider: string;
  status: "ok" | "error" | "no-key" | "no-api";
  balance?: number;
  currency?: string;
  message?: string;
  consoleUrl?: string;
  lastUpdated: string;
}

/** User-entered balances stored in localStorage */
function loadManualBalances(): Record<string, number> {
  try {
    const raw = localStorage.getItem("forge-manual-balances");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveManualBalances(balances: Record<string, number>) {
  localStorage.setItem("forge-manual-balances", JSON.stringify(balances));
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

  // User-entered manual balances (localStorage)
  const [manualBalances, setManualBalances] = useState<Record<string, number>>({});
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => { setManualBalances(loadManualBalances()); }, []);

  const saveBalance = (provider: string) => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      const updated = { ...manualBalances, [provider]: val };
      setManualBalances(updated);
      saveManualBalances(updated);
    }
    setEditingBalance(null);
    setEditValue("");
  };

  // History
  const [history, setHistory] = useState<UsageEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("month");
  const [historyOpen, setHistoryOpen] = useState(true);

  // Provider spend from models
  const providerSpend = useMemo(() => {
    const spend: Record<string, number> = {};
    models.forEach(m => { spend[m.provider] = (spend[m.provider] || 0) + m.totalCost; });
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

  // Filtered history by period
  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const cutoff = historyPeriod === "day" ? now - 86400000
      : historyPeriod === "week" ? now - 604800000
      : now - 2592000000;
    return history.filter(e => new Date(e.timestamp).getTime() >= cutoff);
  }, [history, historyPeriod]);

  // Group history by date for collapsible day sections
  const groupedHistory = useMemo(() => {
    const groups: Record<string, UsageEntry[]> = {};
    for (const e of filteredHistory) {
      const dayKey = new Date(e.timestamp).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(e);
    }
    return Object.entries(groups);
  }, [filteredHistory]);

  // Track which day groups are collapsed
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const toggleDay = (day: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

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
    return [...models].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [models, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const chartDataKey = chartView === "trials" ? "trialsCost" : chartView === "builder" ? "builderCost" : "cost";

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ArrowUpDown className={`w-3.5 h-3.5 inline ml-1 ${sortKey === k ? "text-[#FF6700]" : "text-zinc-300"}`} />
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
    if (status === "ok") return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === "no-key") return <AlertTriangle className="w-4 h-4 text-zinc-400" />;
    if (status === "no-api") return <ExternalLink className="w-4 h-4 text-amber-400" />;
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center h-12 px-3 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm font-bold transition-all">
            <ArrowLeft className="w-4 h-4" /> Exit
          </button>
          <button onClick={() => { refresh(); fetchBalances(true); fetchHistory(); }} disabled={refreshing || balancesLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-bold transition-all border border-zinc-700 disabled:opacity-50" title="Refresh All">
            <RefreshCw className={`w-4 h-4 ${(refreshing || balancesLoading) ? "animate-spin" : ""}`} /> Refresh All
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-bold transition-all border border-zinc-700" title="Export CSV">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center gap-3">
          <DollarSign className="w-5 h-5 text-[#FF6700] drop-shadow-[0_0_8px_rgba(255,103,0,0.6)]" />
          <span className="text-lg font-[900] tracking-[3px] bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent">FORGE BILLING</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={toggleSecureMode} title={secureMode ? "Disable Secure Mode" : "Enable Secure Mode"} className={`flex items-center justify-center h-7 w-7 rounded-md text-sm transition-all border ${secureMode ? "bg-red-600/30 border-red-500/60 text-red-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
            {secureMode ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          </button>
          <button onClick={toggleAirGap} title={airGapEnabled ? "Disable Air-Gap" : "Enable Air-Gap"} className={`flex items-center justify-center h-7 w-7 rounded-md text-sm transition-all border ${airGapEnabled ? "bg-amber-500/20 border-amber-400/50 text-amber-300" : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
            {airGapEnabled ? <Plane className="h-4 w-4 rotate-45" /> : <Radio className="h-4 w-4" />}
          </button>
          <button onClick={() => setTheme(isDark ? "light" : "dark")} className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all">
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/settings" className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all">
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── Provider Balance Cards Row — CENTERED ── */}
      <div className="flex-shrink-0 px-4 pt-3">
        <div className="grid grid-cols-4 xl:grid-cols-7 gap-2">
          {providerBalances.map(pb => {
            const color = PROVIDER_COLORS[pb.provider] || "#888";
            const spent = providerSpend[pb.provider] || 0;
            const manualBal = manualBalances[pb.provider];
            const displayBalance = pb.status === "ok" && pb.balance !== undefined ? pb.balance : manualBal;
            const remaining = displayBalance !== undefined ? Math.max(displayBalance - spent, 0) : undefined;
            const isEditing = editingBalance === pb.provider;
            const ago = pb.lastUpdated ? Math.round((Date.now() - new Date(pb.lastUpdated).getTime()) / 60000) : null;
            return (
              <div key={pb.provider} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-bold text-white capitalize">{pb.provider}</span>
                  <StatusIcon status={pb.status} />
                </div>
                {/* Balance display — live API or manual, colored to match provider */}
                {displayBalance !== undefined ? (
                  <div className="text-2xl font-bold font-mono" style={{ color }}>${displayBalance.toFixed(2)}</div>
                ) : isEditing ? null : (
                  <div className="text-sm font-bold text-zinc-300 text-center">{pb.message || "—"}</div>
                )}
                {/* Remaining after spend */}
                {remaining !== undefined && spent > 0 && (
                  <div className="text-xs text-zinc-300 font-bold">Remaining: <span className="text-white">${remaining.toFixed(2)}</span></div>
                )}
                {spent > 0 && (
                  <div className="text-xs text-zinc-300 font-bold">Spent: <span className="text-white">{formatCost(spent)}</span></div>
                )}
                {/* Editable balance input */}
                {isEditing ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-sm text-zinc-300 font-bold">$</span>
                    <input type="number" autoFocus value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveBalance(pb.provider); if (e.key === "Escape") setEditingBalance(null); }}
                      className="w-20 px-2 py-1 rounded text-sm font-mono font-bold bg-zinc-800 border border-zinc-600 text-white text-center" />
                    <button onClick={() => saveBalance(pb.provider)} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingBalance(pb.provider); setEditValue(manualBal?.toString() || ""); }}
                    className="text-xs text-zinc-400 hover:text-[#FF6700] flex items-center gap-1 font-bold transition-colors" title="Set your balance">
                    <Pencil className="w-3 h-3" /> {manualBal !== undefined ? "Edit" : "Set"} Balance
                  </button>
                )}
                <div className="flex items-center gap-2">
                  {ago !== null && <span className="text-xs text-zinc-400">{ago < 1 ? "Just now" : `${ago}m ago`}</span>}
                  {pb.consoleUrl && (
                    <a href={pb.consoleUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-300 hover:text-[#FF6700] flex items-center gap-0.5 font-bold">
                      Console <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {providerBalances.length === 0 && !balancesLoading && (
            <div className="col-span-full text-center text-zinc-300 text-sm font-bold py-3">Loading provider balances...</div>
          )}
        </div>
      </div>

      {/* ── Running Total Bar ── */}
      <div className="flex-shrink-0 px-4 pt-3">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Today", value: todayCost, Icon: DollarSign, accent: "text-white" },
            { label: "This Week", value: weekCost, Icon: Calendar, accent: "text-white" },
            { label: "This Month", value: monthCost, Icon: TrendingUp, accent: "text-[#FF6700]" },
            { label: "All Time", value: allTimeCost, Icon: Wallet, accent: "text-[#FFD700]" },
          ].map(({ label, value, Icon, accent }) => (
            <div key={label} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 flex items-center gap-3">
              <Icon className="w-5 h-5 text-zinc-300 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">{label}</div>
                <div className={`text-2xl font-bold font-mono ${accent}`}>{formatCost(value)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="flex flex-1 overflow-hidden px-4 pt-3 pb-3 gap-3">
        {/* LEFT COLUMN (60%) */}
        <div className="flex flex-col flex-[6] overflow-hidden gap-3">
          {/* 30-Day Spend Chart */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white">30-Day Spend</h2>
              <div className="flex items-center gap-1">
                {(["all", "trials", "builder"] as ChartView[]).map((view) => (
                  <button key={view} onClick={() => setChartView(view)}
                    className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                      chartView === view
                        ? view === "trials" ? "bg-[#FFD700]/20 text-[#FFD700]" : "bg-[#FF6700]/20 text-[#FF6700]"
                        : "text-zinc-300 hover:text-white"
                    }`}
                  >{view === "all" ? "All" : view === "trials" ? "Trials" : "Builder"}</button>
                ))}
              </div>
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTotals} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="billingOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF6700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12, fill: "#ddd", fontWeight: "bold" }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis stroke="#666" tick={{ fontSize: 12, fill: "#ddd", fontWeight: "bold" }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={45} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #555", borderRadius: "6px", color: "#fff", fontSize: "14px", fontWeight: "bold" }}
                    formatter={(value: any) => [`$${(typeof value === 'number' ? value : 0).toFixed(4)}`, chartView === "trials" ? "Trials" : chartView === "builder" ? "Builder" : "All"]}
                    labelFormatter={(label: any) => String(label)} />
                  <Area type="monotone" dataKey={chartDataKey} stroke="#FF6700" strokeWidth={2} fill="url(#billingOrangeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Breakdown Table */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 flex-shrink-0">
              <h2 className="text-sm font-bold text-white">Model Breakdown</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {periods.map(({ key, label }) => (
                    <button key={key} onClick={() => setPeriod(key)}
                      className={`px-2.5 py-1 rounded text-sm font-bold transition-colors ${period === key ? "bg-zinc-700 text-white" : "text-zinc-300 hover:text-white"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-sm font-bold text-zinc-300">{sortedModels.length} models</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="border-b border-zinc-700">
                    <th onClick={() => handleSort("model")} className="text-left px-3 py-2.5 font-bold text-white cursor-pointer text-sm">Model<SortIcon k="model" /></th>
                    <th onClick={() => handleSort("provider")} className="text-left px-3 py-2.5 font-bold text-white cursor-pointer text-sm">Provider<SortIcon k="provider" /></th>
                    <th className="text-right px-3 py-2.5 font-bold text-white text-sm">Tokens In</th>
                    <th className="text-right px-3 py-2.5 font-bold text-white text-sm">Tokens Out</th>
                    <th onClick={() => handleSort("callCount")} className="text-right px-3 py-2.5 font-bold text-white cursor-pointer text-sm">Rounds<SortIcon k="callCount" /></th>
                    <th onClick={() => handleSort("totalCost")} className="text-right px-3 py-2.5 font-bold text-white cursor-pointer text-sm">Cost<SortIcon k="totalCost" /></th>
                    <th className="text-right px-3 py-2.5 font-bold text-white text-sm">Rate (in/out)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-300 text-sm font-bold">No usage data for this period</td></tr>
                  )}
                  {sortedModels.map((m, i) => {
                    const displayCost = getDisplayCost(m);
                    const rate = getRate(m.model, m.provider);
                    return (
                      <tr key={`${m.provider}/${m.model}`} className={i % 2 === 0 ? "" : "bg-zinc-800/30"}>
                        <td className="px-3 py-2.5 font-bold text-white text-base truncate max-w-[200px]">{m.model}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-2.5 py-1 rounded text-base font-bold" style={{ backgroundColor: (PROVIDER_COLORS[m.provider] || "#666") + "33", color: PROVIDER_COLORS[m.provider] || "#ccc" }}>
                            {m.provider}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right text-zinc-200 text-base">{m.totalTokensIn.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono text-right text-zinc-200 text-base">{m.totalTokensOut.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono text-right text-white text-base font-bold">{m.callCount}</td>
                        <td className={`px-3 py-2.5 font-mono text-right text-base font-bold ${costColor(displayCost)}`}>{formatCost(displayCost)}</td>
                        <td className="px-3 py-2.5 font-mono text-right text-zinc-300 text-base">
                          {rate.input > 0 ? `$${rate.input}/$${rate.output}` : "free"}
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
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3 flex-shrink-0">
            <h2 className="text-sm font-bold text-white mb-2">Spend by Provider</h2>
            {providerPieData.length === 0 ? (
              <div className="text-zinc-300 text-center py-6 text-sm font-bold">No spend data</div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-[140px] w-[140px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={providerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} strokeWidth={0}>
                        {providerPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #555", borderRadius: "6px", color: "#fff", fontSize: "14px", fontWeight: "bold" }}
                        formatter={(value: any) => [`$${(typeof value === 'number' ? value : 0).toFixed(4)}`]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {providerPieData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="text-sm font-bold text-white capitalize flex-1">{d.name}</span>
                      <span className="text-sm font-mono font-bold text-zinc-200">{formatCost(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* App Breakdown */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3 flex-shrink-0">
            <h2 className="text-sm font-bold text-white mb-2">App Breakdown</h2>
            {apps.length === 0 ? (
              <div className="text-zinc-300 text-center py-4 text-sm font-bold">No data</div>
            ) : (
              <div className="space-y-2">
                {apps.sort((a, b) => b.totalCost - a.totalCost).map((a) => {
                  const maxCost = Math.max(...apps.map(x => x.totalCost), 0.001);
                  const pct = (a.totalCost / maxCost) * 100;
                  const color = ({ builder: "#FF6700", foundry: "#FF6700", "trials-cloud": "#FFD700", "trials-hybrid": "#FFD700", guardian: "#10B981", chat: "#06B6D4" } as Record<string, string>)[a.app] || "#6B7280";
                  return (
                    <div key={a.app} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white w-28 truncate">{a.app}</span>
                      <div className="flex-1 h-4 bg-zinc-800 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <span className={`text-sm font-mono font-bold w-20 text-right ${costColor(a.totalCost)}`}>{formatCost(a.totalCost)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-Run History — Collapsible + Period Filter + Grouped by Day */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 flex-1 flex flex-col overflow-hidden min-h-0">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-700 flex-shrink-0 hover:bg-zinc-800/50 transition-colors w-full text-left"
            >
              <div className="flex items-center gap-2">
                {historyOpen ? <ChevronDown className="w-4 h-4 text-zinc-300" /> : <ChevronRight className="w-4 h-4 text-zinc-300" />}
                <h2 className="text-sm font-bold text-white">Recent Runs</h2>
                <span className="text-sm font-bold text-zinc-300">{filteredHistory.length} entries</span>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {(["day", "week", "month"] as HistoryPeriod[]).map(hp => (
                  <button key={hp} onClick={() => setHistoryPeriod(hp)}
                    className={`px-2.5 py-1 rounded text-sm font-bold transition-colors ${historyPeriod === hp ? "bg-zinc-700 text-white" : "text-zinc-300 hover:text-white"}`}>
                    {hp === "day" ? "Day" : hp === "week" ? "Week" : "Month"}
                  </button>
                ))}
              </div>
            </button>
            {historyOpen && (
              <div className="flex-1 overflow-auto">
                {filteredHistory.length === 0 && (
                  <div className="px-3 py-4 text-center text-zinc-300 text-base font-bold">{historyLoading ? "Loading..." : "No runs this period"}</div>
                )}
                {groupedHistory.map(([dayLabel, entries]) => {
                  const dayTotal = entries.reduce((s, e) => s + (e.cost > 0 ? e.cost : calculateCost(e.model, e.provider, e.tokensIn, e.tokensOut)), 0);
                  const isCollapsed = collapsedDays.has(dayLabel);
                  return (
                    <div key={dayLabel}>
                      <button onClick={() => toggleDay(dayLabel)}
                        className="flex items-center justify-between w-full px-3 py-2 bg-zinc-800/60 hover:bg-zinc-800 border-b border-zinc-700 transition-colors">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? <ChevronRight className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                          <span className="text-base font-bold text-white">{dayLabel}</span>
                          <span className="text-sm font-bold text-zinc-400">{entries.length} runs</span>
                        </div>
                        <span className={`text-base font-mono font-bold ${costColor(dayTotal)}`}>{formatCost(dayTotal)}</span>
                      </button>
                      {!isCollapsed && (
                        <table className="w-full">
                          <tbody>
                            {entries.map((e, i) => {
                              const recalcCost = e.cost > 0 ? e.cost : calculateCost(e.model, e.provider, e.tokensIn, e.tokensOut);
                              return (
                                <tr key={e.id || `${dayLabel}-${i}`} className={`${i % 2 === 0 ? "" : "bg-zinc-800/30"} hover:bg-zinc-800/50`}>
                                  <td className="px-3 py-2 text-zinc-200 text-base font-bold whitespace-nowrap w-24">
                                    {new Date(e.timestamp).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="text-base font-bold text-white truncate max-w-[160px]">{e.model}</div>
                                    <div className="text-xs font-bold text-zinc-400">{e.app}</div>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-right text-zinc-200 text-base">{e.tokensIn.toLocaleString()}</td>
                                  <td className="px-3 py-2 font-mono text-right text-zinc-200 text-base">{e.tokensOut.toLocaleString()}</td>
                                  <td className={`px-3 py-2 font-mono text-right text-base font-bold ${costColor(recalcCost)}`}>{formatCost(recalcCost)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
