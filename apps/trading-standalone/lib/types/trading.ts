// Tavily Types
export interface TavilySearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilyResponse {
  query: string;
  response_time: number;
  answer: string | null;
  images: string[];
  results: TavilySearchResult[];
}

// Research Types
export type ResearchType = "overview" | "sentiment" | "technical";

export interface AnalysisResult {
  sentiment_score: number;
  key_catalysts: string[];
  market_impact: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  summary: string;
  recommendation: "BULLISH" | "BEARISH" | "NEUTRAL";
}

export interface ResearchResponse {
  symbol: string;
  news: NewsItem[];
  analysis: AnalysisResult | null;
  timestamp: string;
}

// News & Feed Types
export interface NewsItem {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date: string;
  source: string;
}

// Watch List Types
export type Sentiment = "bullish" | "bearish" | "neutral";

export interface WatchlistTicker {
  symbol: string;
  addedAt: string;
  lastResearch: string | null;
  sentiment: Sentiment;
  lastAnalysis: AnalysisResult | null;
}

// Search Types
export interface SearchResponse {
  context: string;
  sourcesChecked: number;
  hasAnswer: boolean;
}

export interface LiveSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date: string;
  source: string;
}
