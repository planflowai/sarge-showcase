"use client";

import { useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Radio,
  Loader2,
  Pause,
  Play,
  Settings,
} from "lucide-react";
import { useTradingStore } from "@/lib/stores/tradingStore";
import { StockCard } from "./StockCard";

export function LiveFeed() {
  const liveFeed = useTradingStore((s) => s.liveFeed);
  const feedLoading = useTradingStore((s) => s.feedLoading);
  const feedAutoRefresh = useTradingStore((s) => s.feedAutoRefresh);
  const feedRefreshInterval = useTradingStore((s) => s.feedRefreshInterval);
  const feedQuery = useTradingStore((s) => s.feedQuery);
  const setLiveFeed = useTradingStore((s) => s.setLiveFeed);
  const appendToFeed = useTradingStore((s) => s.appendToFeed);
  const setFeedLoading = useTradingStore((s) => s.setFeedLoading);
  const setFeedAutoRefresh = useTradingStore((s) => s.setFeedAutoRefresh);
  const setFeedRefreshInterval = useTradingStore((s) => s.setFeedRefreshInterval);
  const setFeedQuery = useTradingStore((s) => s.setFeedQuery);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchFeed = async (isAppend = false) => {
    setFeedLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: feedQuery, topic: "news" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (isAppend) {
          appendToFeed(data.results || []);
        } else {
          setLiveFeed(data.results || []);
        }
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error("[LiveFeed] Fetch failed:", err);
    } finally {
      setFeedLoading(false);
    }
  };

  // Auto-refresh loop
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (feedAutoRefresh && feedRefreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchFeed(true);
      }, feedRefreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedAutoRefresh, feedRefreshInterval, feedQuery]);

  // Initial fetch
  useEffect(() => {
    if (liveFeed.length === 0) {
      fetchFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Live Feed</h2>
          {feedAutoRefresh && (
            <div className="flex items-center gap-1">
              <Radio className="h-3 w-3 text-green-500 animate-pulse" />
              <span className="text-[9px] text-green-500 font-bold">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchFeed()}
            disabled={feedLoading}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-30"
            title="Refresh now"
          >
            {feedLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => setFeedAutoRefresh(!feedAutoRefresh)}
            className={`rounded p-1.5 transition-colors ${
              feedAutoRefresh
                ? "text-green-500 hover:bg-green-500/10"
                : "text-zinc-600 hover:bg-zinc-800"
            }`}
            title={feedAutoRefresh ? "Pause auto-refresh" : "Start auto-refresh"}
          >
            {feedAutoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 space-y-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-500">Feed Query</label>
            <input
              type="text"
              value={feedQuery}
              onChange={(e) => setFeedQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchFeed()}
              className="w-full mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-[#FF6700] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-500">
              Refresh interval: {feedRefreshInterval}s
            </label>
            <input
              type="range"
              min={15}
              max={300}
              step={15}
              value={feedRefreshInterval}
              onChange={(e) => setFeedRefreshInterval(Number(e.target.value))}
              className="w-full mt-1 accent-[#FF6700]"
            />
          </div>
        </div>
      )}

      {/* Feed items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {liveFeed.length === 0 && !feedLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
            <Radio className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">No feed items yet</p>
            <p className="text-[10px] mt-1">Click refresh or wait for auto-fetch</p>
          </div>
        )}
        {liveFeed.map((item, i) => (
          <StockCard key={`${item.url}-${i}`} item={item} compact />
        ))}
      </div>

      {/* Footer */}
      {lastRefresh && (
        <div className="px-4 py-1.5 border-t border-zinc-800 text-[9px] text-zinc-600 text-center">
          Last refresh: {lastRefresh.toLocaleTimeString()} · {liveFeed.length} items
          {feedAutoRefresh && ` · next in ${feedRefreshInterval}s`}
        </div>
      )}
    </div>
  );
}
