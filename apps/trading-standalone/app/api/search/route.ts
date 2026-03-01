import { NextRequest, NextResponse } from "next/server";

// Live Market Search via Tavily
export async function POST(req: NextRequest) {
  try {
    const { query, topic = "news" } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Tavily has a 400 character limit
    let searchQuery = query.trim();
    if (searchQuery.length > 380) {
      searchQuery = searchQuery.substring(0, 380);
      const lastSpace = searchQuery.lastIndexOf(" ");
      if (lastSpace > 300) searchQuery = searchQuery.substring(0, lastSpace);
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === "your-tavily-api-key-here") {
      return NextResponse.json(
        { error: "Tavily API key not configured. Set TAVILY_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // Enhance query with current year for recency
    const currentYear = new Date().getFullYear();
    const enhancedQuery = searchQuery.includes(String(currentYear))
      ? searchQuery
      : `${searchQuery} ${currentYear}`;

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: enhancedQuery,
        search_depth: "advanced",
        topic,
        max_results: 10,
        include_answer: true,
        include_raw_content: false,
        days: 7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Trading Search] Tavily error:", response.status, errorText);
      return NextResponse.json(
        { error: `Search failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return full results with source attribution for the trading dashboard
    const results = (data.results || []).map(
      (r: { title: string; url: string; content: string; score: number; published_date?: string }) => {
        let source = "unknown";
        try {
          source = new URL(r.url).hostname.replace("www.", "").split(".")[0];
        } catch {}
        return {
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score || 0,
          published_date: r.published_date || "",
          source,
        };
      }
    );

    return NextResponse.json({
      results,
      answer: data.answer || null,
      query: enhancedQuery,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Trading Search] Error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
