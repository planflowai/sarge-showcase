"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Loader2,
  Sun,
  Moon,
  Activity,
  CircleDot,
} from "lucide-react";
import { useTradingStore } from "@/lib/stores/tradingStore";
import { isMarketOpen } from "@/lib/utils";
import { WatchList } from "./WatchList";
import { ResearchPanel } from "./ResearchPanel";
import { LiveFeed } from "./LiveFeed";

export function TradingDashboard() {
  const [darkMode, setDarkMode] = useState(true);
  const marketOpen = useTradingStore((s) => s.isMarketOpen);
  const setMarketOpen = useTradingStore((s) => s.setMarketOpen);
  const quickSearchQuery = useTradingStore((s) => s.quickSearchQuery);
  const setQuickSearchQuery = useTradingStore((s) => s.setQuickSearchQuery);
  const quickSearchLoading = useTradingStore((s) => s.quickSearchLoading);
  const setQuickSearchLoading = useTradingStore((s) => s.setQuickSearchLoading);
  const appendToFeed = useTradingStore((s) => s.appendToFeed);

  // Check market status every minute
  useEffect(() => {
    setMarketOpen(isMarketOpen());
    const interval = setInterval(() => {
      setMarketOpen(isMarketOpen());
    }, 60000);
    return () => clearInterval(interval);
  }, [setMarketOpen]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark", !darkMode);
  };

  const handleQuickSearch = useCallback(async () => {
    if (!quickSearchQuery.trim() || quickSearchLoading) return;
    setQuickSearchLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: quickSearchQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        appendToFeed(data.results || []);
        setQuickSearchQuery("");
      }
    } catch (err) {
      console.error("[QuickSearch] Failed:", err);
    } finally {
      setQuickSearchLoading(false);
    }
  }, [quickSearchQuery, quickSearchLoading, setQuickSearchLoading, appendToFeed, setQuickSearchQuery]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-5">
        <div className="flex items-center gap-4">
          <Activity className="h-5 w-5 text-[#FF6700]" />
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-[#FF6700]">
              Trading Desk
            </h1>
            <p className="text-[9px] text-zinc-600 font-medium tracking-wider">
              Live Market Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Market status */}
          <div className="flex items-center gap-2">
            <CircleDot
              className={`h-3.5 w-3.5 ${
                marketOpen ? "text-green-500" : "text-red-500"
              }`}
            />
            <span className={`text-[10px] font-bold uppercase ${
              marketOpen ? "text-green-500" : "text-red-500"
            }`}>
              {marketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>

          <div className="w-px h-5 bg-zinc-800" />

          <span className="text-[10px] text-zinc-600 font-mono">The Foundry</span>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Watch List */}
        <div className="w-72 border-r border-zinc-800 flex-shrink-0 overflow-hidden">
          <WatchList />
        </div>

        {/* Center — Research Panel */}
        <div className="flex-1 border-r border-zinc-800 overflow-hidden">
          <ResearchPanel />
        </div>

        {/* Right — Live Feed */}
        <div className="w-96 flex-shrink-0 overflow-hidden">
          <LiveFeed />
        </div>
      </div>

      {/* Bottom bar — Quick search */}
      <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-2.5">
        <div className="relative max-w-4xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={quickSearchQuery}
            onChange={(e) => setQuickSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickSearch()}
            placeholder="Search markets... (e.g., 'AAPL latest news', 'semiconductor stocks today', 'Fed rate decision')"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-10 pr-12 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF6700] focus:outline-none focus:ring-1 focus:ring-[#FF6700]/30"
          />
          {quickSearchLoading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FF6700] animate-spin" />
          ) : (
            <button
              onClick={handleQuickSearch}
              disabled={!quickSearchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[#FF6700] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#FF6700]/80 disabled:opacity-30 transition-colors"
            >
              GO
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
