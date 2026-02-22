import OpenAI from "openai";
import type { Message, ChatOptions, ChatResponse } from "@/lib/types";
import { useAirGapStore } from "@/lib/stores/airGapStore";

export function createClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });
}

export function listModels() {
  return ["grok-4", "grok-4-fast-reasoning", "grok-4-fast-non-reasoning", "grok-4-1-fast-reasoning", "grok-4-1-fast-non-reasoning"];
}

// Extended types for xAI/Grok responses
interface ExtendedMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
  reasoning_content?: string;
  reasoning?: string;
  refusal?: string;
}

interface ExtendedChoice {
  index: number;
  message: ExtendedMessage;
  finish_reason: string | null;
  text?: string;
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
    airGapStore.blockCloudAttempt('xAI', 'chat');
    throw new Error('Air-Gap Mode: xAI access blocked');
  }

  const client = createClient(apiKey);

  // Grok doesn't have widespread vision support yet - strip images and add note
  const formatted = messages.map((m) => {
    if (m.images && m.images.length > 0 && m.role === 'user') {
      const imageNote = `[Note: ${m.images.length} image(s) attached. Grok doesn't support vision in this model - analyzing text only.]`;
      return {
        role: m.role as "user" | "assistant" | "system",
        content: m.content ? `${imageNote}\n\n${m.content}` : imageNote,
      };
    }
    return {
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    };
  });

  // Initial request
  let response = await client.chat.completions.create({
    model,
    messages: formatted,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 1,
    stream: false,
  }) as OpenAI.Chat.ChatCompletion;

  console.log('[xAI Provider] Initial response:', JSON.stringify(response, null, 2));

  let choice = response.choices[0] as unknown as ExtendedChoice;
  let message = choice?.message;
  let totalTokens = response.usage?.total_tokens ?? 0;

  // Handle tool calls - Grok reasoning models may request web search
  // We need to complete the tool call flow to get the final answer
  if (message?.tool_calls && message.tool_calls.length > 0 && !message.content) {
    console.log('[xAI Provider] Processing tool calls...');

    // Build the conversation with tool results
    const toolMessages: Array<{
      role: "user" | "assistant" | "system" | "tool";
      content: string | null;
      tool_calls?: typeof message.tool_calls;
      tool_call_id?: string;
    }> = [
      ...formatted,
      {
        role: "assistant" as const,
        content: null,
        tool_calls: message.tool_calls,
      },
    ];

    // Add tool results for each tool call
    for (const toolCall of message.tool_calls) {
      // Type guard for function-based tool calls
      if ('function' in toolCall && toolCall.function?.name === 'web_search') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log('[xAI Provider] Web search requested:', args.query);

          // xAI handles the search server-side - we just acknowledge
          toolMessages.push({
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              status: "completed",
              message: "Search completed by xAI"
            }),
          });
        } catch (e) {
          console.error('[xAI Provider] Failed to parse tool arguments:', e);
          toolMessages.push({
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify({ status: "error", message: "Failed to parse arguments" }),
          });
        }
      }
    }

    // Make follow-up request to get final answer
    try {
      console.log('[xAI Provider] Sending follow-up request with tool results');

      const followUpResponse = await client.chat.completions.create({
        model,
        messages: toolMessages as Parameters<typeof client.chat.completions.create>[0]['messages'],
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP ?? 1,
        stream: false,
      }) as OpenAI.Chat.ChatCompletion;

      console.log('[xAI Provider] Follow-up response:', JSON.stringify(followUpResponse, null, 2));

      const followUpChoice = followUpResponse.choices[0] as unknown as ExtendedChoice;
      if (followUpChoice?.message) {
        choice = followUpChoice;
        message = followUpChoice.message;
        totalTokens += followUpResponse.usage?.total_tokens ?? 0;
      }
    } catch (followUpErr) {
      console.error('[xAI Provider] Follow-up request failed:', followUpErr);
      // Fall through to use original response
    }
  }

  // Extract content from the response
  let content = message?.content ?? "";

  // Reasoning models may return reasoning in separate fields
  if (!content && message?.reasoning_content) {
    console.log('[xAI Provider] Using reasoning_content field');
    content = message.reasoning_content;
  }
  if (!content && message?.reasoning) {
    console.log('[xAI Provider] Using reasoning field');
    content = message.reasoning;
  }

  // If still no content but there are tool_calls, the tool execution didn't produce a response
  if (!content && message?.tool_calls && message.tool_calls.length > 0) {
    console.log('[xAI Provider] Tool calls present but no content - tool execution may have failed');

    const webSearchCall = message.tool_calls.find(tc => 'function' in tc && tc.function?.name === 'web_search');
    if (webSearchCall && 'function' in webSearchCall && webSearchCall.function) {
      try {
        const args = JSON.parse(webSearchCall.function.arguments);
        content = `🔍 **Searching for:** "${args.query || 'your question'}"\n\n` +
          `Grok's web search encountered an issue. Please try again or rephrase your question.`;
      } catch {
        content = `🔍 Web search encountered an issue. Please try again.`;
      }
    } else {
      // Other tool calls
      content = message.tool_calls.map(tc => {
        if ('function' in tc && tc.function) {
          return `[Tool: ${tc.function.name}] ${tc.function.arguments}`;
        }
        return '[Tool Call]';
      }).join('\n\n');
    }
  }

  // Additional fallbacks
  if (!content) {
    console.log('[xAI Provider] Empty content. Full choice:', JSON.stringify(choice, null, 2));

    if (message?.refusal) {
      content = `[Refusal] ${message.refusal}`;
    }

    if (!content && choice?.text) {
      content = choice.text;
    }

    // Last resort: stringify message
    if (!content && message && Object.keys(message).length > 0) {
      const messageStr = JSON.stringify(message);
      if (messageStr !== '{}' && messageStr !== '{"role":"assistant"}') {
        console.log('[xAI Provider] Using stringified message as fallback');
        content = `[Raw response]: ${messageStr}`;
      }
    }
  }

  console.log('[xAI Provider] Final content length:', content.length);
  console.log('[xAI Provider] Total tokens:', totalTokens);

  return { content, tokens: totalTokens };
}
