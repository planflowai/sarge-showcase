import Anthropic from "@anthropic-ai/sdk";
import type { Message, ChatOptions, ChatResponse } from "../types";
import { useAirGapStore } from "../../stores/airGapStore";

export function createClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

export function listModels() {
  return [
    "claude-opus-4-6",
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
  ];
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
    airGapStore.blockCloudAttempt('Anthropic', 'chat');
    throw new Error('Air-Gap Mode: Anthropic access blocked');
  }

  const client = createClient(apiKey);

  const systemMessages = messages.filter((m) => m.role === "system");
  const systemPrompt = systemMessages.map((m) => m.content).join("\n\n");

  // Format messages, handling images for vision
  const formatted = messages
    .filter((m) => m.role !== "system")
    .filter((m) => (m.content && m.content.trim()) || (m.images && m.images.length > 0)) // Filter out empty messages (unless they have images)
    .map((m) => {
      // If message has images, format for Claude vision API
      if (m.images && m.images.length > 0 && m.role === 'user') {
        const content: Anthropic.ContentBlockParam[] = [];

        // Add images first (Claude prefers images before text)
        for (const imageUrl of m.images) {
          // Extract base64 data and media type from data URL
          const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            content.push({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: match[2],
              }
            });
          }
        }

        // Add text content
        if (m.content) {
          content.push({ type: 'text' as const, text: m.content });
        }

        return {
          role: m.role as "user" | "assistant",
          content,
        };
      }

      // Standard text message
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    });

  // Claude 4.5+ models don't allow both temperature and top_p
  // Use temperature only for these newer models
  const isNewModel = model.includes('4-5') || model.includes('4-6') || model.includes('4.5') || model.includes('4.6');

  // Enable web search tool for Claude - allows real-time internet access
  const webSearchTool = {
    type: "web_search_20250305" as const,
    name: "web_search" as const,
    max_uses: 5,
  };

  const response = await client.messages.create({
    model,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
    // Only include top_p for older models
    ...(isNewModel ? {} : { top_p: options?.topP ?? 1 }),
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: formatted,
    // Enable built-in tools for full cloud capabilities
    tools: [webSearchTool],
  });

  // Extract text content from response (may include tool use blocks)
  let content = "";
  let tokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  for (const block of response.content) {
    if (block.type === "text") {
      content += block.text;
    }
  }

  return { content, tokens };
}
