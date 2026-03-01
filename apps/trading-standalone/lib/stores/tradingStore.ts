"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  WatchlistTicker,
  LiveSearchResult,
  ResearchResponse,
  Sentiment,
  ResearchType,
} from "@/lib/types/trading";

interface TradingState {
  // Watch list
  watchList: WatchlistTicker[];
  selectedTicker: string | null;

  // Live feed
  liveFeed: LiveSearchResult[];
  feedLoading: boolean;
  feedRefreshInterval: number; // seconds
  feedAutoRefresh: boolean;
  feedQuery: string;

  // Research
  researchResults: Record<string, ResearchResponse>;
  researchLoading: boolean;
  researchTab: ResearchType;

  // Market status
  isMarketOpen: boolean;

  // Quick search
  quickSearchQuery: string;
  quickSearchLoading: boolean;

  // Actions — Watch list
  addTicker: (symbol: string) => void;
  removeTicker: (symbol: string) => void;
  setSelectedTicker: (symbol: string | null) => void;
  updateTickerSentiment: (symbol: string, sentiment: Sentiment) => void;
  updateTickerResearch: (symbol: string, research: ResearchResponse) => void;

  // Actions — Feed
  setLiveFeed: (items: LiveSearchResult[]) => void;
  appendToFeed: (items: LiveSearchResult[]) => void;
  setFeedLoading: (loading: boolean) => void;
  setFeedRefreshInterval: (seconds: number) => void;
  setFeedAutoRefresh: (enabled: boolean) => void;
  setFeedQuery: (query: string) => void;

  // Actions — Research
  setResearchResults: (symbol: string, results: ResearchResponse) => void;
  setResearchLoading: (loading: boolean) => void;
  setResearchTab: (tab: ResearchType) => void;

  // Actions — Market
  setMarketOpen: (open: boolean) => void;

  // Actions — Quick search
  setQuickSearchQuery: (query: string) => void;
  setQuickSearchLoading: (loading: boolean) => void;

  // Housekeeping
  clearFeed: () => void;
  clearResearch: () => void;
}

export const useTradingStore = create<TradingState>()(
  persist(
    (set, get) => ({
      watchList: [
        { symbol: "AAPL", addedAt: new Date().toISOString(), lastResearch: null, sentiment: "neutral", lastAnalysis: null },
        { symbol: "MSFT", addedAt: new Date().toISOString(), lastResearch: null, sentiment: "neutral", lastAnalysis: null },
        { symbol: "NVDA", addedAt: new Date().toISOString(), lastResearch: null, sentiment: "neutral", lastAnalysis: null },
        { symbol: "GOOGL", addedAt: new Date().toISOString(), lastResearch: null, sentiment: "neutral", lastAnalysis: null },
        { symbol: "TSLA", addedAt: new Date().toISOString(), lastResearch: null, sentiment: "neutral", lastAnalysis: null },
      ],
      selectedTicker: null,
      liveFeed: [],
      feedLoading: false,
      feedRefreshInterval: 60,
      feedAutoRefresh: true,
      feedQuery: "stock market today breaking news",
      researchResults: {},
      researchLoading: false,
      researchTab: "overview",
      isMarketOpen: false,
      quickSearchQuery: "",
      quickSearchLoading: false,

      addTicker: (symbol) => {
        const upper = symbol.toUpperCase().trim();
        if (!upper || get().watchList.some((t) => t.symbol === upper)) return;
        set((s) => ({
          watchList: [
            ...s.watchList,
            {
              symbol: upper,
              addedAt: new Date().toISOString(),
              lastResearch: null,
              sentiment: "neutral" as Sentiment,
              lastAnalysis: null,
            },
          ],
        }));
      },

      removeTicker: (symbol) => {
        set((s) => ({
          watchList: s.watchList.filter((t) => t.symbol !== symbol),
          selectedTicker: s.selectedTicker === symbol ? null : s.selectedTicker,
        }));
      },

      setSelectedTicker: (symbol) => set({ selectedTicker: symbol }),

      updateTickerSentiment: (symbol, sentiment) => {
        set((s) => ({
          watchList: s.watchList.map((t) =>
            t.symbol === symbol ? { ...t, sentiment } : t
          ),
        }));
      },

      updateTickerResearch: (symbol, research) => {
        const sentiment: Sentiment =
          research.analysis?.recommendation === "BULLISH"
            ? "bullish"
            : research.analysis?.recommendation === "BEARISH"
            ? "bearish"
            : "neutral";

        set((s) => ({
          watchList: s.watchList.map((t) =>
            t.symbol === symbol
              ? {
                  ...t,
                  lastResearch: new Date().toISOString(),
                  sentiment,
                  lastAnalysis: research.analysis,
                }
              : t
          ),
          researchResults: { ...s.researchResults, [symbol]: research },
        }));
      },

      setLiveFeed: (items) => set({ liveFeed: items }),
      appendToFeed: (items) => {
        set((s) => {
          // Deduplicate by URL
          const existing = new Set(s.liveFeed.map((i) => i.url));
          const newItems = items.filter((i) => !existing.has(i.url));
          return { liveFeed: [...newItems, ...s.liveFeed].slice(0, 100) };
        });
      },
      setFeedLoading: (loading) => set({ feedLoading: loading }),
      setFeedRefreshInterval: (seconds) => set({ feedRefreshInterval: seconds }),
      setFeedAutoRefresh: (enabled) => set({ feedAutoRefresh: enabled }),
      setFeedQuery: (query) => set({ feedQuery: query }),

      setResearchResults: (symbol, results) =>
        set((s) => ({ researchResults: { ...s.researchResults, [symbol]: results } })),
      setResearchLoading: (loading) => set({ researchLoading: loading }),
      setResearchTab: (tab) => set({ researchTab: tab }),

      setMarketOpen: (open) => set({ isMarketOpen: open }),

      setQuickSearchQuery: (query) => set({ quickSearchQuery: query }),
      setQuickSearchLoading: (loading) => set({ quickSearchLoading: loading }),

      clearFeed: () => set({ liveFeed: [] }),
      clearResearch: () => set({ researchResults: {} }),
    }),
    {
      name: "trading-standalone-store",
      partialize: (state) => ({
        watchList: state.watchList,
        feedRefreshInterval: state.feedRefreshInterval,
        feedAutoRefresh: state.feedAutoRefresh,
        feedQuery: state.feedQuery,
      }),
    }
  )
);
