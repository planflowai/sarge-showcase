import type { TavilySearchResult, LiveSearchResult, NewsItem } from "@/lib/types/trading";

function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace("www.", "").split(".")[0];
  } catch {
    return "unknown";
  }
}

export function transformToNewsItems(results: TavilySearchResult[]): NewsItem[] {
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score || 0,
    published_date: r.published_date || new Date().toISOString(),
    source: extractSource(r.url),
  }));
}

export function transformToLiveResults(results: TavilySearchResult[]): LiveSearchResult[] {
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score || 0,
    published_date: r.published_date || new Date().toISOString(),
    source: extractSource(r.url),
  }));
}

export const FINANCIAL_DOMAINS = [
  "bloomberg.com",
  "reuters.com",
  "cnbc.com",
  "marketwatch.com",
  "seekingalpha.com",
  "finance.yahoo.com",
  "wsj.com",
  "barrons.com",
  "fool.com",
  "investopedia.com",
  "benzinga.com",
  "thestreet.com",
];
