"use client";

import { useState, useCallback } from "react";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Newspaper,
  Brain,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Zap,
  Target,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsItem {
  title: string;
  url: string;
  published_date: string;
  content: string;
  score: number;
  source: string;
}

interface AnalysisResult {
  sentiment_score: number;
  key_catalysts: string[];
  market_impact: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  summary: string;
  recommendation: "BULLISH" | "BEARISH" | "NEUTRAL";
}

interface ResearchData {
  news: NewsItem[];
  analysis: AnalysisResult | null;
  symbol: string;
  timestamp: string;
}

export default function ResearchHub() {
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [expandedNews, setExpandedNews] = useState<number | null>(null);

  const searchSymbol = useCallback(async () => {
    if (!symbol.trim()) return;

    setLoading(true);
    setError("");
    setResearchData(null);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to fetch research data");
      }

      const data = await response.json();
      setResearchData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const sendToTradingPipeline = () => {
    if (!researchData) return;
    // Store research in sessionStorage and navigate to trading page
    sessionStorage.setItem("research_data", JSON.stringify(researchData));
    window.location.href = `/trading?symbol=${researchData.symbol}`;
  };

  const getSentimentColor = (score: number) => {
    if (score >= 5) return "text-green-500";
    if (score <= -5) return "text-red-500";
    return "text-yellow-500";
  };

  const getSentimentBg = (score: number) => {
    if (score >= 5) return "bg-green-500";
    if (score <= -5) return "bg-red-500";
    return "bg-yellow-500";
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "HIGH":
        return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300 dark:border-red-700";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700";
      default:
        return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300 dark:border-green-700";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-zinc-950 dark:via-blue-950/10 dark:to-indigo-950/10">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <Search className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Research Hub
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 ml-14">
            Real-time market intelligence powered by Tavily + Local AI Analysis
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Enter symbol (e.g. AAPL, TSLA, NVDA)"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                onKeyDown={(e) => e.key === "Enter" && searchSymbol()}
              />
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block px-2 py-1 text-xs font-mono bg-slate-200 dark:bg-zinc-700 rounded text-slate-500 dark:text-zinc-400">
                Enter
              </kbd>
            </div>
            <button
              onClick={searchSymbol}
              disabled={loading || !symbol.trim()}
              className={cn(
                "px-8 py-4 rounded-xl font-semibold flex items-center gap-3 transition-all duration-200 shadow-lg",
                loading || !symbol.trim()
                  ? "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:scale-[1.02]"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results */}
        {researchData && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* News Column - 3 cols */}
            <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Newspaper className="h-5 w-5 text-orange-500" />
                    Breaking News
                    <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium">
                      {researchData.news.length}
                    </span>
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Clock className="h-4 w-4" />
                    {new Date(researchData.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
                {researchData.news.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No recent news found for {researchData.symbol}</p>
                  </div>
                ) : (
                  researchData.news.map((item, i) => (
                    <div
                      key={i}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedNews(expandedNews === i ? null : i)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-1 h-full min-h-[60px] bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 leading-tight">
                            {item.title}
                          </h3>
                          <p
                            className={cn(
                              "text-sm text-slate-600 dark:text-slate-400 mb-2 transition-all",
                              expandedNews === i ? "" : "line-clamp-2"
                            )}
                          >
                            {item.content}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {item.source}
                              </span>
                              <span>
                                {item.published_date
                                  ? new Date(item.published_date).toLocaleDateString()
                                  : "Recent"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {expandedNews === i ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Analysis Column - 2 cols */}
            <div className="lg:col-span-2 space-y-6">
              {/* AI Analysis Card */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Brain className="h-5 w-5 text-indigo-500" />
                    AI Analysis
                  </h2>
                </div>

                {researchData.analysis ? (
                  <div className="p-6 space-y-5">
                    {/* Symbol & Recommendation */}
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-slate-800 dark:text-slate-200">
                        {researchData.symbol}
                      </span>
                      <span
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1.5",
                          researchData.analysis.recommendation === "BULLISH"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                            : researchData.analysis.recommendation === "BEARISH"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                        )}
                      >
                        {researchData.analysis.recommendation === "BULLISH" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : researchData.analysis.recommendation === "BEARISH" ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <Activity className="h-4 w-4" />
                        )}
                        {researchData.analysis.recommendation}
                      </span>
                    </div>

                    {/* Sentiment Score */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Sentiment Score
                        </span>
                        <span
                          className={cn(
                            "text-2xl font-black",
                            getSentimentColor(researchData.analysis.sentiment_score)
                          )}
                        >
                          {researchData.analysis.sentiment_score > 0 ? "+" : ""}
                          {researchData.analysis.sentiment_score}/10
                        </span>
                      </div>
                      <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            getSentimentBg(researchData.analysis.sentiment_score)
                          )}
                          style={{
                            width: `${
                              ((researchData.analysis.sentiment_score + 10) / 20) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-slate-400">
                        <span>Bearish</span>
                        <span>Neutral</span>
                        <span>Bullish</span>
                      </div>
                    </div>

                    {/* Market Impact & Confidence */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                          Market Impact
                        </span>
                        <span
                          className={cn(
                            "inline-flex px-2.5 py-1 rounded-lg text-sm font-bold border",
                            getImpactBadge(researchData.analysis.market_impact)
                          )}
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          {researchData.analysis.market_impact}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                          Confidence
                        </span>
                        <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                          {researchData.analysis.confidence}%
                        </span>
                      </div>
                    </div>

                    {/* Key Catalysts */}
                    {researchData.analysis.key_catalysts.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 block mb-2 flex items-center gap-1.5">
                          <Target className="h-4 w-4" />
                          Key Catalysts
                        </span>
                        <div className="space-y-2">
                          {researchData.analysis.key_catalysts.map((catalyst, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-zinc-800 p-2 rounded-lg"
                            >
                              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0" />
                              {catalyst}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 block mb-2">
                        Summary
                      </span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 bg-gradient-to-br from-slate-50 to-indigo-50/50 dark:from-zinc-800 dark:to-indigo-900/20 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 leading-relaxed">
                        {researchData.analysis.summary}
                      </p>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={sendToTradingPipeline}
                      className="w-full mt-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                    >
                      <Send className="h-5 w-5" />
                      Send to Trading Pipeline
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Analysis not available</p>
                    <p className="text-sm mt-1">
                      Ensure Ollama is running locally
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 p-6">
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wider">
                  Search Stats
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                      {researchData.news.length}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      Articles Found
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {researchData.analysis ? "1" : "0"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      AI Analysis
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!researchData && !loading && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="p-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Search className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                Start Your Research
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Enter a stock symbol above to get real-time news and AI-powered
                sentiment analysis. Use this intelligence to make informed trading
                decisions.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL"].map((sym) => (
                  <button
                    key={sym}
                    onClick={() => {
                      setSymbol(sym);
                      setTimeout(() => searchSymbol(), 100);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
