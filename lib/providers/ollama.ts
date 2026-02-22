import { Ollama } from "ollama";
import type { Message, ChatOptions, ChatResponse } from "@/lib/types";

// Tavily search - direct API call (works server-side)
async function searchWeb(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey === "your-tavily-api-key-here") {
    console.log("[Ollama] No Tavily API key, skipping web search");
    return "";
  }

  try {
    // Truncate query if needed (Tavily limit)
    let searchQuery = query.trim();
    if (searchQuery.length > 380) {
      searchQuery = searchQuery.substring(0, 380);
      const lastSpace = searchQuery.lastIndexOf(' ');
      if (lastSpace > 300) {
        searchQuery = searchQuery.substring(0, lastSpace);
      }
    }

    // Add current year for recency
    const currentYear = new Date().getFullYear();
    const enhancedQuery = searchQuery.includes(String(currentYear))
      ? searchQuery
      : `${searchQuery} ${currentYear}`;

    console.log("[Ollama] Web search for:", enhancedQuery);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: enhancedQuery,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
        days: 30,
      }),
    });

    if (!response.ok) {
      console.error("[Ollama] Tavily error:", response.status);
      return "";
    }

    const data = await response.json();

    // Build context from results
    const results: string[] = [];
    if (data.answer) {
      results.push(data.answer);
    }
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((r: { content?: string }) => {
        if (r.content && r.content.length > 20) {
          // Strip URLs
          const cleaned = r.content
            .replace(/https?:\/\/[^\s]+/g, "")
            .replace(/www\.[^\s]+/g, "")
            .trim();
          if (cleaned.length > 20) {
            results.push(cleaned);
          }
        }
      });
    }

    const context = results.slice(0, 5).join("\n\n");
    console.log("[Ollama] Web search returned", results.length, "results");
    return context;
  } catch (err) {
    console.error("[Ollama] Web search error:", err);
    return "";
  }
}

// Detect if a query needs real-time/current information
function needsWebSearch(content: string): string | null {
  const lower = content.toLowerCase();

  // Keywords that suggest real-time info needed - check FIRST (more aggressive)
  const realtimeKeywords = [
    'current', 'today', 'now', 'latest', 'recent',
    'price', 'weather', 'news', 'stock', 'crypto',
    'bitcoin', 'btc', 'eth', 'ethereum', 'dollar',
    '2024', '2025', '2026', 'this year', 'this month',
    'happening', 'update', 'score', 'result'
  ];

  if (realtimeKeywords.some(kw => lower.includes(kw))) {
    console.log("[Ollama] needsWebSearch: matched keyword in:", content.substring(0, 50));
    return content;
  }

  const patterns = [
    // Price/market queries
    /(?:what(?:'s| is) the (?:current |today'?s? )?(?:price|value|cost) of (.+?))\??$/i,
    /(?:how much (?:is|does) (.+?) (?:cost|worth|trading))/i,
    /(.+?) price(?: today| now| current)?\??$/i,
    // Current events
    /(?:what(?:'s| is) (?:happening|going on) (?:with|in) (.+?))/i,
    /(?:latest|recent|current|today'?s?) (?:news|updates?) (?:on|about|for) (.+)/i,
    // Weather
    /(?:what(?:'s| is) the weather (?:in|for|like in) (.+?))\??$/i,
    // Stock/crypto specific
    /(?:btc|bitcoin|eth|ethereum|stock|crypto) (?:price|value)/i,
    // Reviews/ratings of recent things
    /reviews? of (.+?)(?:\s+(?:as of |today|now|\d{4}))?\??$/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      console.log("[Ollama] needsWebSearch: matched pattern in:", content.substring(0, 50));
      return match[1] || content;
    }
  }

  console.log("[Ollama] needsWebSearch: NO MATCH for:", content.substring(0, 50));
  return null;
}

export function createClient(host?: string) {
  return new Ollama({ host: host ?? "http://localhost:11434" });
}

export function listModels() {
  return ["llama3", "codellama", "mistral", "phi3"];
}

export async function chat(
  messages: (Message & { images?: string[] })[],
  model: string,
  options?: ChatOptions,
  host?: string
): Promise<ChatResponse> {
  const client = createClient(host);

  console.log("[Ollama] chat called with model:", model, "messages:", messages.length);

  // Check if the last user message needs web search
  const lastUserMsg = messages.filter(m => m.role === "user").pop();
  console.log("[Ollama] Last user message:", lastUserMsg?.content?.substring(0, 100));

  const searchQuery = lastUserMsg ? needsWebSearch(lastUserMsg.content) : null;
  console.log("[Ollama] Search query result:", searchQuery ? searchQuery.substring(0, 50) : "null");

  let webContext = "";
  if (searchQuery) {
    webContext = await searchWeb(searchQuery);
    console.log("[Ollama] Web context length:", webContext.length);
  }

  // Build messages with web context if available, and handle images for vision models
  const formatted = messages.map((m, i) => {
    // Extract just the base64 data (without the data URL prefix) for Ollama
    const images = m.images?.map(imageUrl => {
      const match = imageUrl.match(/^data:[^;]+;base64,(.+)$/);
      return match ? match[1] : imageUrl;
    }).filter(Boolean);

    // Inject web search results into the last user message
    if (webContext && m.role === "user" && i === messages.length - 1) {
      return {
        role: m.role as "user" | "assistant" | "system",
        content: `[Web Search Results]\n${webContext}\n\n[User Question]\n${m.content}`,
        ...(images && images.length > 0 ? { images } : {}),
      };
    }
    return {
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      ...(images && images.length > 0 ? { images } : {}),
    };
  });

  // Simple chat without tools - works with ALL models
  const response = await client.chat({
    model,
    messages: formatted,
    keep_alive: "1h",
    options: {
      temperature: options?.temperature ?? 0.3,
      top_p: options?.topP ?? 1,
      num_predict: options?.maxTokens ?? 2048,
      num_gpu: 99,
      num_thread: 12,
      num_ctx: 8192,
      num_batch: 256,
    },
  });

  const content = response.message?.content ?? "";
  const tokens =
    (response.eval_count ?? 0) + (response.prompt_eval_count ?? 0);

  return { content, tokens };
}
