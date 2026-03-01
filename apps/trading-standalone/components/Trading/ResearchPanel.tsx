"use client";

import { useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Brain,
  Crosshair,
  Loader2,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { useTradingStore } from "@/lib/stores/tradingStore";
import { StockCard } from "./StockCard";
import type { ResearchType, AnalysisResult } from "@/lib/types/trading";

const TAB_CONFIG: { id: ResearchType; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "sentiment", label: "Sentiment", icon: Brain },
  { id: "technical", label: "Technical", icon: Crosshair },
];

const IMPACT_COLORS = {
  HIGH: "bg-red-500/20 text-red-400 border-red-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  LOW: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const REC_COLORS = {
  BULLISH: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30", icon: TrendingUp },
  BEARISH: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: TrendingDown },
  NEUTRAL: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/30", icon: Minus },
};

export function ResearchPanel() {
  const selectedTicker = useTradingStore((s) => s.selectedTicker);
  const researchResults = useTradingStore((s) => s.researchResults);
  const researchLoading = useTradingStore((s) => s.researchLoading);
  const researchTab = useTradingStore((s) => s.researchTab);
  const setResearchTab = useTradingStore((s) => s.setResearchTab);
  const setResearchLoading = useTradingStore((s) => s.setResearchLoading);
  const setResearchResults = useTradingStore((s) => s.setResearchResults);
  const updateTickerResearch = useTradingStore((s) => s.updateTickerResearch);

  const research = selectedTicker ? researchResults[selectedTicker] : null;

  // Fetch research when tab changes
  useEffect(() => {
    if (!selectedTicker || researchLoading) return;

    const fetchResearch = async () => {
      setResearchLoading(true);
      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: selectedTicker, research_type: researchTab }),
        });
        if (res.ok) {
          const data = await res.json();
          setResearchResults(selectedTicker, data);
          updateTickerResearch(selectedTicker, data);
        }
      } catch (err) {
        console.error("[Research] Fetch failed:", err);
      } finally {
        setResearchLoading(false);
      }
    };

    fetchResearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchTab, selectedTicker]);

  if (!selectedTicker) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600">
        <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Select a ticker to research</p>
        <p className="text-xs mt-1 text-zinc-700">Click a symbol in the Watch List</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black font-mono text-white">{selectedTicker}</span>
            {research?.analysis && (
              <AnalysisBadge analysis={research.analysis} />
            )}
          </div>
          {research?.timestamp && (
            <span className="text-[10px] text-zinc-600 font-mono">
              {new Date(research.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setResearchTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              researchTab === id
                ? "text-[#FF6700] border-b-2 border-[#FF6700] bg-[#FF6700]/5"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {researchLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-[#FF6700] animate-spin mb-3" />
            <p className="text-sm text-zinc-500">
              Researching {selectedTicker} ({researchTab})...
            </p>
            <p className="text-[10px] text-zinc-700 mt-1">Searching financial sources + AI analysis</p>
          </div>
        ) : research ? (
          <>
            {/* AI Analysis Summary */}
            {research.analysis && <AnalysisSummary analysis={research.analysis} />}

            {/* News results */}
            {research.news.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Sources ({research.news.length})
                </h3>
                {research.news.map((item, i) => (
                  <StockCard key={i} item={item} />
                ))}
              </div>
            )}

            {research.news.length === 0 && !research.analysis && (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                <AlertTriangle className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm">No results found for {selectedTicker}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <BarChart3 className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">Click a tab to load research</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisBadge({ analysis }: { analysis: AnalysisResult }) {
  const rec = REC_COLORS[analysis.recommendation];
  const RecIcon = rec.icon;

  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${rec.bg} ${rec.border}`}>
      <RecIcon className={`h-3.5 w-3.5 ${rec.text}`} />
      <span className={`text-xs font-bold ${rec.text}`}>{analysis.recommendation}</span>
    </div>
  );
}

function AnalysisSummary({ analysis }: { analysis: AnalysisResult }) {
  const rec = REC_COLORS[analysis.recommendation];

  return (
    <div className={`rounded-lg border ${rec.border} ${rec.bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-black uppercase tracking-wider ${rec.text}`}>
          AI Analysis
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${IMPACT_COLORS[analysis.market_impact]}`}>
            {analysis.market_impact} Impact
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {analysis.confidence}% conf.
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-300 leading-relaxed">{analysis.summary}</p>

      {/* Sentiment score bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-red-400 font-bold">BEARISH</span>
          <span className="text-zinc-500 font-mono">{analysis.sentiment_score > 0 ? "+" : ""}{analysis.sentiment_score}/10</span>
          <span className="text-green-400 font-bold">BULLISH</span>
        </div>
        <div className="relative h-2 rounded-full bg-zinc-800">
          <div
            className="absolute top-0 h-full rounded-full transition-all"
            style={{
              left: analysis.sentiment_score >= 0 ? "50%" : `${50 + (analysis.sentiment_score / 10) * 50}%`,
              width: `${Math.abs(analysis.sentiment_score) * 5}%`,
              backgroundColor: analysis.sentiment_score >= 0 ? "#22c55e" : "#ef4444",
            }}
          />
          <div className="absolute top-0 left-1/2 w-0.5 h-full bg-zinc-600" />
        </div>
      </div>

      {/* Catalysts */}
      {analysis.key_catalysts.length > 0 && (
        <div>
          <span className="text-[10px] font-bold uppercase text-zinc-500">Key Catalysts</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {analysis.key_catalysts.map((catalyst, i) => (
              <span
                key={i}
                className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300"
              >
                {catalyst}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
