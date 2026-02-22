import { NextRequest, NextResponse } from "next/server";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface WebSearchResponse {
  results: SearchResult[];
  error?: string;
  source: "brave" | "google" | "tavily" | "searxng" | "mock";
}

/**
 * Web Search API
 * Searches the web using available search providers
 * Supports: Brave Search API, Google Custom Search, SearXNG (local)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, maxResults = 5 } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Check for air-gap mode
    const airGapEnabled = process.env.AIR_GAP_MODE === "true";
    if (airGapEnabled) {
      return NextResponse.json(
        {
          results: [],
          error: "Web search unavailable in air-gap mode",
          source: "mock" as const
        },
        { status: 200 }
      );
    }

    // Try search providers in order of preference
    let results: SearchResult[] = [];
    let source: WebSearchResponse["source"] = "mock";

    // 1. Try Brave Search API (free tier available)
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveApiKey) {
      try {
        const braveResults = await searchBrave(query, braveApiKey, maxResults);
        if (braveResults.length > 0) {
          results = braveResults;
          source = "brave";
        }
      } catch (err) {
        console.error("[WebSearch] Brave search failed:", err);
      }
    }

    // 2. Try Google Custom Search API
    if (results.length === 0) {
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const googleCx = process.env.GOOGLE_SEARCH_CX;
      if (googleApiKey && googleCx) {
        try {
          const googleResults = await searchGoogle(query, googleApiKey, googleCx, maxResults);
          if (googleResults.length > 0) {
            results = googleResults;
            source = "google";
          }
        } catch (err) {
          console.error("[WebSearch] Google search failed:", err);
        }
      }
    }

    // 3. Try Tavily API
    if (results.length === 0) {
      const tavilyApiKey = process.env.TAVILY_API_KEY;
      if (tavilyApiKey) {
        try {
          const tavilyResults = await searchTavily(query, tavilyApiKey, maxResults);
          if (tavilyResults.length > 0) {
            results = tavilyResults;
            source = "tavily";
          }
        } catch (err) {
          console.error("[WebSearch] Tavily search failed:", err);
        }
      }
    }

    // 4. Try local SearXNG instance
    if (results.length === 0) {
      const searxngUrl = process.env.SEARXNG_URL || "http://localhost:8080";
      try {
        const searxngResults = await searchSearXNG(query, searxngUrl, maxResults);
        if (searxngResults.length > 0) {
          results = searxngResults;
          source = "searxng";
        }
      } catch (err) {
        console.error("[WebSearch] SearXNG search failed:", err);
      }
    }

    // If no results from any provider, return empty with note
    if (results.length === 0) {
      return NextResponse.json({
        results: [],
        error: "No search results found. Configure BRAVE_SEARCH_API_KEY, GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_CX, or run a local SearXNG instance.",
        source: "mock"
      });
    }

    return NextResponse.json({
      results,
      source
    });

  } catch (err) {
    console.error("[WebSearch] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}

// Brave Search API
async function searchBrave(query: string, apiKey: string, maxResults: number): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": apiKey
    }
  });

  if (!res.ok) {
    throw new Error(`Brave search failed: ${res.status}`);
  }

  const data = await res.json();
  const results: SearchResult[] = [];

  if (data.web?.results) {
    for (const item of data.web.results.slice(0, maxResults)) {
      results.push({
        title: item.title || "",
        url: item.url || "",
        snippet: item.description || ""
      });
    }
  }

  return results;
}

// Google Custom Search API
async function searchGoogle(query: string, apiKey: string, cx: string, maxResults: number): Promise<SearchResult[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("num", String(Math.min(maxResults, 10)));

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Google search failed: ${res.status}`);
  }

  const data = await res.json();
  const results: SearchResult[] = [];

  if (data.items) {
    for (const item of data.items.slice(0, maxResults)) {
      results.push({
        title: item.title || "",
        url: item.link || "",
        snippet: item.snippet || ""
      });
    }
  }

  return results;
}

// Tavily Search API
async function searchTavily(query: string, apiKey: string, maxResults: number): Promise<SearchResult[]> {
  const url = "https://api.tavily.com/search";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: "basic",
      include_answer: false,
      include_images: false,
      include_raw_content: false,
      max_results: maxResults
    })
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.status}`);
  }

  const data = await res.json();
  const results: SearchResult[] = [];

  if (data.results) {
    for (const item of data.results.slice(0, maxResults)) {
      results.push({
        title: item.title || "",
        url: item.url || "",
        snippet: item.content || ""
      });
    }
  }

  return results;
}

// SearXNG (local instance)
async function searchSearXNG(query: string, baseUrl: string, maxResults: number): Promise<SearchResult[]> {
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageno", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`SearXNG search failed: ${res.status}`);
  }

  const data = await res.json();
  const results: SearchResult[] = [];

  if (data.results) {
    for (const item of data.results.slice(0, maxResults)) {
      results.push({
        title: item.title || "",
        url: item.url || "",
        snippet: item.content || ""
      });
    }
  }

  return results;
}
