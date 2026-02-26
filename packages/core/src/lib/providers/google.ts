import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Message, ChatOptions, ChatResponse } from "../types";
import { useAirGapStore } from "../../stores/airGapStore";

// Web search for real-time information - calls Tavily directly
async function searchWeb(query: string): Promise<string> {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === "your-tavily-api-key-here") {
      console.log("[Google] Tavily API key not configured");
      return "";
    }

    // Call Tavily API directly (server can't reliably call itself)
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.substring(0, 380),
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      console.log("[Google] Tavily search failed:", response.status);
      return "";
    }

    const data = await response.json();

    // Build context from results
    const results: string[] = [];
    if (data.answer) results.push(data.answer);
    if (data.results) {
      data.results.slice(0, 4).forEach((r: { content?: string }) => {
        if (r.content) results.push(r.content.substring(0, 300));
      });
    }

    return results.join("\n\n");
  } catch (err) {
    console.error("[Google] Web search error:", err);
    return "";
  }
}

// Detect if a query needs real-time/current information
function needsWebSearch(content: string): string | null {
  const lower = content.toLowerCase();
  const patterns = [
    /(?:what(?:'s| is) the (?:current |today'?s? )?(?:price|value|cost) of (.+?))\??$/i,
    /(?:how much (?:is|does) (.+?) (?:cost|worth|trading))/i,
    /(.+?) price(?: today| now| current)?\??$/i,
    /(?:what(?:'s| is) (?:happening|going on) (?:with|in) (.+?))/i,
    /(?:latest|recent|current|today'?s?) (?:news|updates?) (?:on|about|for) (.+)/i,
    /(?:what(?:'s| is) the weather (?:in|for|like in) (.+?))\??$/i,
    /(?:btc|bitcoin|eth|ethereum|stock|crypto) (?:price|value)/i,
    /reviews? of (.+?)(?:\s+(?:as of |today|now|\d{4}))?\??$/i,
    /search (?:for |the web for )?(.+)/i,
    /look up (.+)/i,
    /find (?:information |info )?(?:on |about )?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1] || content;
    }
  }

  const realtimeKeywords = ['current', 'today', 'now', 'latest', 'recent', 'price of', 'weather in', 'news about', 'search for', 'look up', 'find out'];
  if (realtimeKeywords.some(kw => lower.includes(kw))) {
    return content;
  }

  return null;
}

export function createClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey);
}

export function listModels() {
  return ["gemini-2.0-flash"];
}

export async function chat(
  messages: (Message & { images?: string[] })[],
  model: string,
  apiKey: string,
  options?: ChatOptions
): Promise<ChatResponse> {
  // Air-Gap check
  const airGapStore = useAirGapStore.getState();
  if (airGapStore.airGapEnabled) {
    airGapStore.blockCloudAttempt('Google', 'chat');
    throw new Error('Air-Gap Mode: Google access blocked');
  }

  const client = createClient(apiKey);
  const genModel = client.getGenerativeModel({
    model,
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      topP: options?.topP ?? 1,
    },
  });

  // Check if the last user message needs web search
  const lastUserMsg = messages.filter(m => m.role === "user").pop();
  const searchQuery = lastUserMsg ? needsWebSearch(lastUserMsg.content) : null;

  let webContext = "";
  if (searchQuery) {
    webContext = await searchWeb(searchQuery);
  }

  // Check if any message has images
  const hasImages = messages.some(m => m.images && m.images.length > 0);

  if (hasImages) {
    // For vision requests, send as a single generateContent call
    const lastMessage = messages[messages.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];

    // Add images first if present
    if (lastMessage.images && lastMessage.images.length > 0) {
      for (const imageUrl of lastMessage.images) {
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            }
          });
        }
      }
    }

    // Add text content with web context if available
    const textContent = webContext
      ? `[Web Search Results]\n${webContext}\n\n[User Question]\n${lastMessage.content}`
      : lastMessage.content;

    if (textContent) {
      parts.push({ text: textContent });
    }

    const result = await genModel.generateContent(parts);
    const response = result.response;
    const content = response.text();
    const tokens = response.usageMetadata?.totalTokenCount ?? 0;
    return { content, tokens };
  }

  // Standard text-only flow with chat history
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  const chatSession = genModel.startChat({ history });

  // Add web context to the final message if available
  const finalMessage = webContext
    ? `[Web Search Results]\n${webContext}\n\n[User Question]\n${lastMessage.content}`
    : lastMessage.content;

  const result = await chatSession.sendMessage(finalMessage);
  const response = result.response;

  const content = response.text();
  const tokens =
    (response.usageMetadata?.totalTokenCount ?? 0);

  return { content, tokens };
}
