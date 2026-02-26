import OpenAI from "openai";
import type { Message, ChatOptions, ChatResponse } from "@/lib/types";
import { useAirGapStore } from "@/lib/stores/airGapStore";

// DeepSeek uses an OpenAI-compatible API
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// Web search for real-time information - calls Tavily directly
async function searchWeb(query: string): Promise<string> {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey === "your-tavily-api-key-here") {
      console.log("[DeepSeek] Tavily API key not configured");
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
      console.log("[DeepSeek] Tavily search failed:", response.status);
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
    console.error("[DeepSeek] Web search error:", err);
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
  return new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });
}

export function listModels() {
  // DeepSeek API only supports two model IDs:
  // - deepseek-chat: V3.2 non-thinking, general purpose and code
  // - deepseek-reasoner: V3.2 thinking model for complex reasoning
  return ["deepseek-chat", "deepseek-reasoner"];
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
    airGapStore.blockCloudAttempt('DeepSeek', 'chat');
    throw new Error('Air-Gap Mode: DeepSeek access blocked');
  }

  const client = createClient(apiKey);

  // Check if the last user message needs web search
  const lastUserMsg = messages.filter(m => m.role === "user").pop();
  const searchQuery = lastUserMsg ? needsWebSearch(lastUserMsg.content) : null;

  let webContext = "";
  if (searchQuery) {
    webContext = await searchWeb(searchQuery);
  }

  // DeepSeek doesn't support vision - strip out images and just use text content
  // If images are present, add a note that they were received but can't be processed
  const formatted = messages.map((m, i) => {
    let content = m.content;

    // Handle images
    if (m.images && m.images.length > 0) {
      // Add a note about images since DeepSeek can't see them
      const imageNote = `[Note: ${m.images.length} image(s) attached. DeepSeek doesn't support vision - analyzing text only.]`;
      content = content ? `${imageNote}\n\n${content}` : imageNote;
    }

    // Inject web search results into the last user message
    if (webContext && m.role === "user" && i === messages.length - 1) {
      content = `[Web Search Results]\n${webContext}\n\n[User Question]\n${content}`;
    }

    return {
      role: m.role as "user" | "assistant" | "system",
      content,
    };
  });

  const response = await client.chat.completions.create({
    model,
    messages: formatted,
    max_tokens: options?.maxTokens ?? 8192,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 1,
  });

  const content = response.choices[0]?.message?.content ?? "";
  const tokens = response.usage?.total_tokens ?? 0;

  return { content, tokens };
}

// Streaming chat for Builder and real-time responses
export async function* streamChat(
  messages: Message[],
  model: string,
  apiKey: string,
  options?: ChatOptions
): AsyncGenerator<{ content: string; done: boolean }> {
  // Air-Gap check
  const airGapStore = useAirGapStore.getState();
  if (airGapStore.airGapEnabled) {
    airGapStore.blockCloudAttempt('DeepSeek', 'streamChat');
    throw new Error('Air-Gap Mode: DeepSeek access blocked');
  }

  const client = createClient(apiKey);

  const formatted = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const stream = await client.chat.completions.create({
    model,
    messages: formatted,
    max_tokens: options?.maxTokens ?? 8192,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 1,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? "";
    const done = chunk.choices[0]?.finish_reason === "stop";
    if (content || done) {
      yield { content, done };
    }
  }
}
