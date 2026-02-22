import { NextRequest, NextResponse } from "next/server";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

interface AnalysisResult {
  sentiment_score: number;
  key_catalysts: string[];
  market_impact: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  summary: string;
  recommendation: "BULLISH" | "BEARISH" | "NEUTRAL";
}

// Extract domain from URL for source attribution
function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace("www.", "").split(".")[0];
  } catch {
    return "unknown";
  }
}

// Preferred models for text analysis, in priority order
const PREFERRED_ANALYSIS_MODELS = [
  "llama3.1:8b",
  "llama3.2:3b",
  "llama3.2:1b",
  "mistral:7b",
  "qwen2:7b",
  "qwen3:8b",
  "gemma3:4b",
  "gemma2:9b",
  "gemma2:2b",
  "phi4-mini:latest",
  "phi3:mini",
];

async function getBestAvailableModel(ollamaUrl: string): Promise<string> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return "llama3.2:3b";
    const data = await res.json();
    const available: string[] = (data.models || []).map((m: { name: string }) => m.name);
    for (const preferred of PREFERRED_ANALYSIS_MODELS) {
      if (available.includes(preferred)) return preferred;
    }
    // Fall back to first available model
    return available[0] || "llama3.2:3b";
  } catch {
    return "llama3.2:3b";
  }
}

// Call local Ollama for analysis
async function analyzeWithOllama(
  symbol: string,
  newsText: string
): Promise<AnalysisResult | null> {
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://127.0.0.1:11434";

  const systemPrompt = `You are a financial news analyst. Analyze the provided news headlines and content for the given stock symbol. You must respond with ONLY valid JSON, no other text.`;

  const userPrompt = `Analyze the following news about ${symbol} stock.

NEWS:
${newsText}

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "sentiment_score": <number from -10 to 10>,
  "key_catalysts": [<array of 2-4 specific events/catalysts>],
  "market_impact": "<HIGH or MEDIUM or LOW>",
  "confidence": <number from 1 to 100>,
  "summary": "<2-3 sentence analysis>",
  "recommendation": "<BULLISH or BEARISH or NEUTRAL>"
}`;

  try {
    const model = await getBestAvailableModel(ollamaUrl);
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 500,
        },
      }),
    });

    if (!response.ok) {
      console.error("Ollama API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.message?.content || "";

    // Try to parse JSON from the response
    // Handle potential markdown code blocks
    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0];
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Validate and normalize the response
    return {
      sentiment_score: Math.max(-10, Math.min(10, Number(parsed.sentiment_score) || 0)),
      key_catalysts: Array.isArray(parsed.key_catalysts)
        ? parsed.key_catalysts.slice(0, 4)
        : [],
      market_impact: ["HIGH", "MEDIUM", "LOW"].includes(parsed.market_impact)
        ? parsed.market_impact
        : "MEDIUM",
      confidence: Math.max(1, Math.min(100, Number(parsed.confidence) || 50)),
      summary: String(parsed.summary || "Analysis unavailable"),
      recommendation: ["BULLISH", "BEARISH", "NEUTRAL"].includes(parsed.recommendation)
        ? parsed.recommendation
        : "NEUTRAL",
    };
  } catch (error) {
    console.error("Ollama analysis error:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { symbol } = await request.json();

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    const cleanSymbol = symbol.toUpperCase().trim();

    // Check for Tavily API key
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey || tavilyKey === "your-tavily-api-key-here") {
      return NextResponse.json(
        { error: "Tavily API key not configured" },
        { status: 500 }
      );
    }

    // Search query optimized for financial news
    const query = `${cleanSymbol} stock news earnings announcement analyst rating today`;

    // Call Tavily API
    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "basic",
        max_results: 10,
        include_answer: false,
        include_raw_content: false,
        include_domains: [
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
        ],
      }),
    });

    if (!tavilyResponse.ok) {
      const errorText = await tavilyResponse.text();
      console.error("Tavily API error:", tavilyResponse.status, errorText);
      return NextResponse.json(
        { error: `News search failed: ${tavilyResponse.status}` },
        { status: tavilyResponse.status }
      );
    }

    const tavilyData: TavilyResponse = await tavilyResponse.json();

    // Transform news results
    const news = (tavilyData.results || []).slice(0, 8).map((result) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score || 0,
      published_date: result.published_date || "",
      source: extractSource(result.url),
    }));

    // Prepare text for AI analysis
    const newsText = news
      .slice(0, 5)
      .map((n, i) => `${i + 1}. ${n.title}\n   ${n.content.substring(0, 300)}...`)
      .join("\n\n");

    // Get AI analysis from Ollama
    let analysis: AnalysisResult | null = null;
    if (newsText.length > 50) {
      analysis = await analyzeWithOllama(cleanSymbol, newsText);
    }

    // Return combined response
    return NextResponse.json({
      symbol: cleanSymbol,
      news,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Research API error:", error);
    return NextResponse.json(
      { error: "Research failed" },
      { status: 500 }
    );
  }
}
