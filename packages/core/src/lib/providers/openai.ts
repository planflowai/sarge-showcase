import OpenAI from "openai";
import type { Message, ChatOptions, ChatResponse } from "../types";
import { useAirGapStore } from "../../stores/airGapStore";

// Web search for real-time information - calls Tavily directly
async function searchWeb(query: string): Promise<string> {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === "your-tavily-api-key-here") {
      console.log("[OpenAI] Tavily API key not configured");
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
      console.log("[OpenAI] Tavily search failed:", response.status);
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
    console.error("[OpenAI] Web search error:", err);
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
  return new OpenAI({ apiKey });
}

export function listModels() {
  return ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"];
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
    airGapStore.blockCloudAttempt('OpenAI', 'chat');
    throw new Error('Air-Gap Mode: OpenAI access blocked');
  }

  const client = createClient(apiKey);

  // Check if the last user message needs web search
  const lastUserMsg = messages.filter(m => m.role === "user").pop();
  const searchQuery = lastUserMsg ? needsWebSearch(lastUserMsg.content) : null;

  let webContext = "";
  if (searchQuery) {
    webContext = await searchWeb(searchQuery);
  }

  // Format messages, handling images for vision models
  const formatted = messages.map((m, i) => {
    // Determine content - inject web search results into last user message
    const isLastUserMessage = m.role === "user" && i === messages.length - 1;
    let messageContent = m.content;

    if (webContext && isLastUserMessage) {
      messageContent = `[Web Search Results]\n${webContext}\n\n[User Question]\n${m.content}`;
    }

    // If message has images, format for vision API
    if (m.images && m.images.length > 0 && m.role === 'user') {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

      // Add text content first
      if (messageContent) {
        content.push({ type: 'text', text: messageContent });
      }

      // Add images
      for (const imageUrl of m.images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }

      return {
        role: m.role as "user" | "assistant" | "system",
        content,
      };
    }

    // Standard text message
    return {
      role: m.role as "user" | "assistant" | "system",
      content: messageContent,
    };
  });

  // Newer OpenAI models (o1, o3, gpt-5-nano, etc.) use max_completion_tokens instead of max_tokens
  const useNewTokenParam = model.startsWith('o1') || model.startsWith('o3') || model.includes('gpt-5') || model.includes('nano');

  const tokenLimit = options?.maxTokens ?? 4096;

  const requestParams: Record<string, unknown> = {
    model,
    messages: formatted,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 1,
    stream: false,
  };

  if (useNewTokenParam) {
    requestParams.max_completion_tokens = tokenLimit;
  } else {
    requestParams.max_tokens = tokenLimit;
  }

  const response = await client.chat.completions.create(requestParams as unknown as Parameters<typeof client.chat.completions.create>[0]) as OpenAI.Chat.ChatCompletion;

  const content = response.choices[0]?.message?.content ?? "";
  const tokens = response.usage?.total_tokens ?? 0;

  return { content, tokens };
}
