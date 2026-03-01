"use client";

import { useState } from "react";
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useTradingStore } from "@/lib/stores/tradingStore";
import type { WatchlistTicker, ResearchResponse } from "@/lib/types/trading";
import { formatRelativeTime } from "@/lib/utils";

const SENTIMENT_CONFIG = {
  bullish: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10", label: "BULL" },
  bearish: { icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10", label: "BEAR" },
  neutral: { icon: Minus, color: "text-zinc-400", bg: "bg-zinc-500/10", label: "—" },
};

export function WatchList() {
  const watchList = useTradingStore((s) => s.watchList);
  const selectedTicker = useTradingStore((s) => s.selectedTicker);
  const setSelectedTicker = useTradingStore((s) => s.setSelectedTicker);
  const addTicker = useTradingStore((s) => s.addTicker);
  const removeTicker = useTradingStore((s) => s.removeTicker);
  const updateTickerResearch = useTradingStore((s) => s.updateTickerResearch);
  const setResearchLoading = useTradingStore((s) => s.setResearchLoading);
  const researchLoading = useTradingStore((s) => s.researchLoading);

  const [newTicker, setNewTicker] = useState("");
  const [researchingTicker, setResearchingTicker] = useState<string | null>(null);

  const handleAdd = () => {
    if (newTicker.trim()) {
      addTicker(newTicker);
      setNewTicker("");
    }
  };

  const handleResearch = async (symbol: string) => {
    setSelectedTicker(symbol);
    setResearchingTicker(symbol);
    setResearchLoading(true);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, research_type: "overview" }),
      });
      if (res.ok) {
        const data: ResearchResponse = await res.json();
        updateTickerResearch(symbol, data);
      }
    } catch (err) {
      console.error("[WatchList] Research failed:", err);
    } finally {
      setResearchLoading(false);
      setResearchingTicker(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Watch List</h2>
      </div>

      {/* Add ticker */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add ticker..."
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-[#FF6700] focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newTicker.trim()}
            className="rounded-md bg-[#FF6700] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#FF6700]/80 disabled:opacity-30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Ticker list */}
      <div className="flex-1 overflow-y-auto">
        {watchList.map((ticker) => (
          <TickerRow
            key={ticker.symbol}
            ticker={ticker}
            isSelected={selectedTicker === ticker.symbol}
            isResearching={researchingTicker === ticker.symbol}
            onClick={() => handleResearch(ticker.symbol)}
            onRemove={() => removeTicker(ticker.symbol)}
          />
        ))}
        {watchList.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-600">
            Add a ticker to start tracking
          </div>
        )}
      </div>
    </div>
  );
}

function TickerRow({
  ticker,
  isSelected,
  isResearching,
  onClick,
  onRemove,
}: {
  ticker: WatchlistTicker;
  isSelected: boolean;
  isResearching: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const cfg = SENTIMENT_CONFIG[ticker.sentiment];
  const SentIcon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors border-b border-zinc-800/50 ${
        isSelected
          ? "bg-[#FF6700]/10 border-l-2 border-l-[#FF6700]"
          : "hover:bg-zinc-800/50"
      }`}
    >
      {/* Sentiment indicator */}
      <div className={`rounded-md p-1.5 ${cfg.bg}`}>
        {isResearching ? (
          <Loader2 className="h-4 w-4 text-[#FF6700] animate-spin" />
        ) : (
          <SentIcon className={`h-4 w-4 ${cfg.color}`} />
        )}
      </div>

      {/* Symbol + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono text-zinc-100">{ticker.symbol}</span>
          {ticker.lastAnalysis && (
            <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          )}
        </div>
        <div className="text-[10px] text-zinc-600">
          {ticker.lastResearch
            ? `Updated ${formatRelativeTime(ticker.lastResearch)}`
            : "Not yet researched"}
        </div>
      </div>

      {/* Confidence score */}
      {ticker.lastAnalysis && (
        <span className="text-[10px] font-mono text-zinc-500">
          {ticker.lastAnalysis.confidence}%
        </span>
      )}

      {/* Remove */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded p-1 text-zinc-700 hover:text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </button>
  );
}
