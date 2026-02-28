import { NextRequest, NextResponse } from "next/server";

// Tavily Search API - strips sources for blind pass
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Tavily has a 400 character limit - truncate and clean up
    let searchQuery = query.trim();
    if (searchQuery.length > 380) {
      // Take first 380 chars, try to end at a word boundary
      searchQuery = searchQuery.substring(0, 380);
      const lastSpace = searchQuery.lastIndexOf(' ');
      if (lastSpace > 300) {
        searchQuery = searchQuery.substring(0, lastSpace);
      }
    }

    const apiKey = process.env.TAVILY_API_KEY;
    console.log("TAVILY_API_KEY loaded:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET");
    if (!apiKey || apiKey === "your-tavily-api-key-here") {
      return NextResponse.json(
        { error: "Tavily API key not configured" },
        { status: 500 }
      );
    }

    // Add current year to query for recency
    const currentYear = new Date().getFullYear();
    const enhancedQuery = searchQuery.includes(String(currentYear))
      ? searchQuery
      : `${searchQuery} ${currentYear}`;

    // Call Tavily Search API
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: enhancedQuery,
        search_depth: "advanced", // Better for current info
        max_results: 7,
        include_answer: true,
        include_raw_content: false,
        days: 30, // Only results from last 30 days
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tavily API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Tavily search failed: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Strip sources - blind pass (remove URLs, source names, domains)
    const strippedResults: string[] = [];

    // Include Tavily's AI answer if available (already source-free)
    if (data.answer) {
      strippedResults.push(data.answer);
    }

    // Process individual results - strip source info
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((result: { content?: string; title?: string }) => {
        if (result.content) {
          // Remove any URLs that might be in the content
          let cleaned = result.content
            .replace(/https?:\/\/[^\s]+/g, "")
            .replace(/www\.[^\s]+/g, "")
            .trim();

          // Remove common source attribution patterns
          cleaned = cleaned
            .replace(/according to [^,.]+(,|\.)/gi, "")
            .replace(/reported by [^,.]+(,|\.)/gi, "")
            .replace(/source: [^,.]+(,|\.)/gi, "")
            .replace(/via [^,.]+(,|\.)/gi, "")
            .trim();

          if (cleaned.length > 20) {
            strippedResults.push(cleaned);
          }
        }
      });
    }

    // Combine into context (limit to prevent token overflow)
    const context = strippedResults.slice(0, 6).join("\n\n");
    const sourcesCount = data.results?.length || 0;

    return NextResponse.json({
      context,
      sourcesChecked: sourcesCount,
      hasAnswer: !!data.answer,
    });
  } catch (error) {
    console.error("Tavily search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
