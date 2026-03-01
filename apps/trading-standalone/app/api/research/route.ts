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

function extractSource(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "").split(".")[0];
  } catch {
    return "unknown";
  }
}

// Preferred models for analysis, in priority order
const PREFERRED_MODELS = [
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

async function getBestModel(ollamaUrl: string): Promise<string> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return "llama3.2:3b";
    const data = await res.json();
    const available: string[] = (data.models || []).map((m: { name: string }) => m.name);
    for (const preferred of PREFERRED_MODELS) {
      if (available.includes(preferred)) return preferred;
    }
    return available[0] || "llama3.2:3b";
  } catch {
    return "llama3.2:3b";
  }
}

async function analyzeWithOllama(
  symbol: string,
  newsText: string,
  researchType: string
): Promise<AnalysisResult | null> {
  const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://127.0.0.1:11434";

  const typePrompts: Record<string, string> = {
    overview: `Provide an overall stock analysis for ${symbol} based on the latest news. Focus on key developments, market position, and near-term outlook.`,
    sentiment: `Analyze the market sentiment for ${symbol} stock based on the following news. Focus on bullish/bearish signals, social media sentiment indicators, and institutional positioning.`,
    technical: `Provide a technical analysis perspective for ${symbol} stock. Focus on price action patterns, support/resistance levels, and momentum indicators mentioned in recent news.`,
  };

  const systemPrompt = `You are a financial analyst specializing in ${researchType} analysis. Respond with ONLY valid JSON, no other text.`;

  const userPrompt = `${typePrompts[researchType] || typePrompts.overview}

NEWS:
${newsText}

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "sentiment_score": <number from -10 to 10>,
  "key_catalysts": [<array of 2-4 specific events/catalysts>],
  "market_impact": "<HIGH or MEDIUM or LOW>",
  "confidence": <number from 1 to 100>,
  "summary": "<2-3 sentence ${researchType} analysis>",
  "recommendation": "<BULLISH or BEARISH or NEUTRAL>"
}`;

  try {
    const model = await getBestModel(ollamaUrl);
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
        options: { temperature: 0.3, num_predict: 500 },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.message?.content || "";

    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0];
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      sentiment_score: Math.max(-10, Math.min(10, Number(parsed.sentiment_score) || 0)),
      key_catalysts: Array.isArray(parsed.key_catalysts) ? parsed.key_catalysts.slice(0, 4) : [],
      market_impact: ["HIGH", "MEDIUM", "LOW"].includes(parsed.market_impact) ? parsed.market_impact : "MEDIUM",
      confidence: Math.max(1, Math.min(100, Number(parsed.confidence) || 50)),
      summary: String(parsed.summary || "Analysis unavailable"),
      recommendation: ["BULLISH", "BEARISH", "NEUTRAL"].includes(parsed.recommendation) ? parsed.recommendation : "NEUTRAL",
    };
  } catch (error) {
    console.error("[Trading Research] Ollama analysis error:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { symbol, research_type = "overview" } = await request.json();

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    const cleanSymbol = symbol.toUpperCase().trim();

    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey || tavilyKey === "your-tavily-api-key-here") {
      return NextResponse.json(
        { error: "Tavily API key not configured. Set TAVILY_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // Build search query based on research type
    const queryMap: Record<string, string> = {
      overview: `${cleanSymbol} stock news earnings analyst rating today`,
      sentiment: `${cleanSymbol} stock sentiment analyst opinion bullish bearish social media`,
      technical: `${cleanSymbol} stock price technical analysis chart support resistance`,
    };
    const query = queryMap[research_type] || queryMap.overview;

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
          "bloomberg.com", "reuters.com", "cnbc.com", "marketwatch.com",
          "seekingalpha.com", "finance.yahoo.com", "wsj.com", "barrons.com",
          "fool.com", "investopedia.com", "benzinga.com", "thestreet.com",
        ],
      }),
    });

    if (!tavilyResponse.ok) {
      const errorText = await tavilyResponse.text();
      console.error("[Trading Research] Tavily error:", tavilyResponse.status, errorText);
      return NextResponse.json(
        { error: `Research failed: ${tavilyResponse.status}` },
        { status: tavilyResponse.status }
      );
    }

    const tavilyData: TavilyResponse = await tavilyResponse.json();

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
      analysis = await analyzeWithOllama(cleanSymbol, newsText, research_type);
    }

    return NextResponse.json({
      symbol: cleanSymbol,
      news,
      analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Trading Research] Error:", error);
    return NextResponse.json({ error: "Research failed" }, { status: 500 });
  }
}
