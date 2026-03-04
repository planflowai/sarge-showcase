"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X, Flame, Settings, ChevronDown, ChevronUp, ArrowUpDown, Sun, Moon } from "lucide-react";
import { formatCost } from "@sarge/billing";
import type { ModelBreakdown, AppBreakdown, DailyTotal, BillingConfig } from "@sarge/billing";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import { useSettingsStore } from "@sarge/core";

// Provider colors
const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#FF6700",
  openai: "#10B981",
  google: "#3B82F6",
  xai: "#A855F7",
  deepseek: "#06B6D4",
  ollama: "#6B7280",
  lmstudio: "#6B7280",
};

// App colors
const APP_COLORS: Record<string, string> = {
  builder: "#FF6700",
  foundry: "#FF6700",
  beast: "#3B82F6",
  "forge-trials": "#FFD700",
  guardian: "#10B981",
  "jury-duty": "#A855F7",
  chat: "#06B6D4",
  debate: "#F43F5E",
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

type SortKey = "model" | "provider" | "callCount" | "totalTokensIn" | "totalTokensOut" | "totalCost" | "avgTokensPerSecond";

export default function ForgeBillingDashboard({ onClose }: { onClose: () => void }) {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isDark = theme === "dark";

  // Data state
  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("day");
  const [todayCost, setTodayCost] = useState(0);
  const [weekCost, setWeekCost] = useState(0);
  const [monthCost, setMonthCost] = useState(0);
  const [models, setModels] = useState<ModelBreakdown[]>([]);
  const [apps, setApps] = useState<AppBreakdown[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [config, setConfig] = useState<BillingConfig>({ balance: 50, alertAt: 10, dailyCap: 5, weeklyCap: 25 });
  const [showSettings, setShowSettings] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortAsc, setSortAsc] = useState(false);

  // Editable config fields
  const [editBalance, setEditBalance] = useState("");
  const [editAlertAt, setEditAlertAt] = useState("");
  const [editDailyCap, setEditDailyCap] = useState("");
  const [editWeeklyCap, setEditWeeklyCap] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [dayRes, weekRes, monthRes, periodRes, dailyRes, configRes] = await Promise.all([
        fetch("/api/billing/stats?period=day"),
        fetch("/api/billing/stats?period=week"),
        fetch("/api/billing/stats?period=month"),
        fetch(`/api/billing/stats?period=${period}`),
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
      setDailyTotals(dailyData.dailyTotals || []);
      setConfig(configData);
      setEditBalance(String(configData.balance ?? 50));
      setEditAlertAt(String(configData.alertAt ?? 10));
      setEditDailyCap(String(configData.dailyCap ?? ""));
      setEditWeeklyCap(String(configData.weeklyCap ?? ""));
    } catch {}
  }, [period]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 10_000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Sorted models
  const sortedModels = useMemo(() => {
    const sorted = [...models].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [models, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Top 5 models by cost for chart
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
    <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortKey === k ? "text-[#FF6700]" : "text-zinc-600"}`} />
  );

  const periods: Array<{ key: "day" | "week" | "month" | "all"; label: string }> = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${isDark ? "bg-[#0a0a0a] text-[#F5F5F5]" : "bg-[#fafafa] text-[#1a1a1a]"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#FF6700]/20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Flame className="w-8 h-8 text-[#FF6700]" />
          <h1
            className="text-5xl font-[900] tracking-[4px] bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent"
            style={{ filter: "drop-shadow(0 0 20px rgba(255,103,0,0.4))" }}
          >
            FORGE BILLING
          </h1>
          <Flame className="w-8 h-8 text-[#FF6700]" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-zinc-200 text-zinc-600"}`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" : "hover:bg-zinc-200 text-zinc-600 hover:text-black"}`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

        {/* ROW 1: Hero Stats */}
        <div className="grid grid-cols-4 gap-6">
          {[
            { label: "TODAY", value: todayCost },
            { label: "THIS WEEK", value: weekCost },
            { label: "THIS MONTH", value: monthCost },
          ].map(({ label, value }) => (
            <div key={label} className={`rounded-xl border p-6 text-center ${isDark ? "bg-[#0f0f12] border-zinc-800" : "bg-white border-zinc-200"}`}>
              <div className="text-4xl font-bold font-mono text-[#F5F5F5] dark:text-[#F5F5F5]">
                <span className={isDark ? "text-[#F5F5F5]" : "text-[#1a1a1a]"}>{formatCost(value)}</span>
              </div>
              <div className={`text-sm font-bold mt-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{label}</div>
            </div>
          ))}
          {/* Balance card */}
          <div className={`rounded-xl border p-6 text-center ${isDark ? "bg-[#0f0f12]" : "bg-white"} ${balanceBorder(config.balance)}`}>
            <div className={`text-4xl font-bold font-mono ${balanceColor(config.balance)}`}>
              {formatCost(config.balance)}
            </div>
            <div className={`text-sm font-bold mt-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>BALANCE</div>
            {daysRemaining !== null && (
              <div className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                ~{daysRemaining} days remaining
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Spend Chart */}
        <div className={`rounded-xl border p-6 ${isDark ? "bg-[#141414] border-zinc-800" : "bg-white border-zinc-200"}`}>
          <h2 className="text-lg font-bold mb-4">30-Day Spend</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTotals} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6700" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FF6700" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#222" : "#e5e7eb"} />
                <XAxis
                  dataKey="date"
                  stroke={isDark ? "#888" : "#666"}
                  tick={{ fontSize: 12, fill: isDark ? "#aaa" : "#555" }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  stroke={isDark ? "#888" : "#666"}
                  tick={{ fontSize: 12, fill: isDark ? "#aaa" : "#555" }}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1a1a1a" : "#fff",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: isDark ? "#F5F5F5" : "#1a1a1a",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                  labelFormatter={(label: string) => `Date: ${label}`}
                />
                {config.dailyCap && (
                  <ReferenceLine y={config.dailyCap} stroke="#EF4444" strokeDasharray="5 5" label={{ value: `Cap: $${config.dailyCap}`, fill: "#EF4444", fontSize: 12 }} />
                )}
                <Area type="monotone" dataKey="cost" stroke="#FF6700" strokeWidth={2.5} fill="url(#orangeGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROW 3: Period Tabs + Model Breakdown Table */}
        <div className={`rounded-xl border ${isDark ? "bg-[#0f0f12] border-zinc-800" : "bg-white border-zinc-200"}`}>
          {/* Period tabs */}
          <div className="flex items-center gap-1 px-6 pt-5 pb-3">
            {periods.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors duration-200 ${
                  period === key
                    ? "bg-[#FF6700] text-white"
                    : isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-black"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                  {[
                    { key: "model" as SortKey, label: "Model" },
                    { key: "provider" as SortKey, label: "Provider" },
                    { key: "callCount" as SortKey, label: "Calls" },
                    { key: "totalTokensIn" as SortKey, label: "Tokens In" },
                    { key: "totalTokensOut" as SortKey, label: "Tokens Out" },
                    { key: "totalCost" as SortKey, label: "Total Cost" },
                    { key: "avgTokensPerSecond" as SortKey, label: "Avg tok/s" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className={`text-left px-3 py-3 font-bold cursor-pointer select-none ${isDark ? "text-[#F5F5F5]" : "text-[#1a1a1a]"}`}
                    >
                      {label}<SortIcon k={key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedModels.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-500">No usage data for this period</td></tr>
                )}
                {sortedModels.map((m, i) => {
                  const isLocal = m.provider === "ollama" || m.provider === "lmstudio";
                  return (
                    <tr
                      key={`${m.provider}/${m.model}`}
                      className={i % 2 === 0
                        ? (isDark ? "bg-[#0f0f12]" : "bg-white")
                        : (isDark ? "bg-[#141418]" : "bg-zinc-50")
                      }
                    >
                      <td className={`px-3 py-2.5 font-bold ${isDark ? "text-[#F5F5F5]" : "text-[#1a1a1a]"}`}>{m.model}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold"
                          style={{ backgroundColor: (PROVIDER_COLORS[m.provider] || "#666") + "22", color: PROVIDER_COLORS[m.provider] || "#888" }}
                        >
                          {m.provider}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 font-mono ${isDark ? "text-[#F5F5F5]" : "text-[#1a1a1a]"}`}>{m.callCount}</td>
                      <td className={`px-3 py-2.5 font-mono ${isDark ? "text-[#F5F5F5]" : "text-[#1a1a1a]"}`}>{m.totalTokensIn.toLocaleString()}</td>
                      <td className={`px-3 py-2.5 font-mono ${isDark ? "text-[#F5F5F5]" : "text-[#1a1a1a]"}`}>{m.totalTokensOut.toLocaleString()}</td>
                      <td className={`px-3 py-2.5 font-mono text-right ${costColor(m.totalCost)}`}>
                        {formatCost(m.totalCost)}
                        {isLocal && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">LOCAL</span>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 font-mono ${isDark ? "text-[#F5F5F5]" : "text-[#1a1a1a]"}`}>{m.avgTokensPerSecond}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ROW 4: Side-by-side — Top Models + App Breakdown */}
        <div className="grid grid-cols-2 gap-6">
          {/* Top Models */}
          <div className={`rounded-xl border p-6 ${isDark ? "bg-[#0f0f12] border-zinc-800" : "bg-white border-zinc-200"}`}>
            <h2 className="text-lg font-bold mb-4">Top Models by Spend</h2>
            {topModels.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">No data</div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topModels} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#222" : "#e5e7eb"} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: isDark ? "#aaa" : "#555" }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                    <YAxis type="category" dataKey="model" tick={{ fontSize: 12, fill: isDark ? "#ddd" : "#333", fontWeight: "bold" }} width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: isDark ? "#1a1a1a" : "#fff", border: "1px solid #333", borderRadius: "8px", color: isDark ? "#F5F5F5" : "#1a1a1a", fontWeight: "bold" }}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                    />
                    <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
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
          <div className={`rounded-xl border p-6 ${isDark ? "bg-[#0f0f12] border-zinc-800" : "bg-white border-zinc-200"}`}>
            <h2 className="text-lg font-bold mb-4">App Breakdown</h2>
            {apps.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">No data</div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apps} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#222" : "#e5e7eb"} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: isDark ? "#aaa" : "#555" }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                    <YAxis type="category" dataKey="app" tick={{ fontSize: 12, fill: isDark ? "#ddd" : "#333", fontWeight: "bold" }} width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: isDark ? "#1a1a1a" : "#fff", border: "1px solid #333", borderRadius: "8px", color: isDark ? "#F5F5F5" : "#1a1a1a", fontWeight: "bold" }}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                    />
                    <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
                      {apps.map((a, i) => (
                        <Cell key={i} fill={APP_COLORS[a.app] || "#6B7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* ROW 5: Alert Settings (collapsible) */}
        <div className={`rounded-xl border ${isDark ? "bg-[#0f0f12] border-zinc-800" : "bg-white border-zinc-200"}`}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 w-full px-6 py-4 font-bold text-sm ${isDark ? "text-zinc-300 hover:text-white" : "text-zinc-600 hover:text-black"} transition-colors`}
          >
            <Settings className="w-4 h-4" />
            Alert Settings
            {showSettings ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>
          {showSettings && (
            <div className={`px-6 pb-6 border-t ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
              <div className="grid grid-cols-4 gap-4 pt-4">
                <div>
                  <label className={`block text-sm font-bold mb-1.5 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Balance ($)</label>
                  <input
                    type="number"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-mono ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-zinc-100 border-zinc-300 text-black"} border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-bold mb-1.5 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Alert At ($)</label>
                  <input
                    type="number"
                    value={editAlertAt}
                    onChange={(e) => setEditAlertAt(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-mono ${isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-zinc-100 border-zinc-300 text-black"} border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-bold mb-1.5 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Daily Cap ($)</label>
                  <input
                    type="number"
                    value={editDailyCap}
                    onChange={(e) => setEditDailyCap(e.target.value)}
                    placeholder="No cap"
                    className={`w-full px-3 py-2 rounded-lg text-sm font-mono ${isDark ? "bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600" : "bg-zinc-100 border-zinc-300 text-black"} border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-bold mb-1.5 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Weekly Cap ($)</label>
                  <input
                    type="number"
                    value={editWeeklyCap}
                    onChange={(e) => setEditWeeklyCap(e.target.value)}
                    placeholder="No cap"
                    className={`w-full px-3 py-2 rounded-lg text-sm font-mono ${isDark ? "bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600" : "bg-zinc-100 border-zinc-300 text-black"} border`}
                  />
                </div>
              </div>
              <button
                onClick={saveConfig}
                className="mt-4 px-6 py-2 bg-[#FF6700] hover:bg-[#FF8C00] text-white font-bold rounded-lg text-sm transition-colors duration-200"
              >
                Save Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
