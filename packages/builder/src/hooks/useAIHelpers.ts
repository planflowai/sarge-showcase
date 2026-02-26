"use client";

import { useEffect } from "react";
import type { BuilderMessage } from "@/lib/stores/builderChatStore";
import type { HelperResponse, BuilderHelper, TriggerMode } from "@/lib/stores/builderHelpersStore";
import { buildHelperPrompt } from "@/lib/helperPrompts";

interface UseAIHelpersProps {
  messages: BuilderMessage[];
  sending: boolean;
  code: string | null;
  getActiveHelpers: (triggerMode?: TriggerMode) => BuilderHelper[];
  addResponse: (response: Omit<HelperResponse, 'id'>) => string;
  updateResponse: (id: string, updates: Partial<HelperResponse>) => void;
  setActiveHelper: (id: string | null) => void;
}

// Extract code from markdown content
function extractCodeFromMarkdown(content: string): string | null {
  const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
  const matches = [...content.matchAll(codeBlockRegex)];

  if (matches.length > 0) {
    return matches[matches.length - 1][1].trim();
  }

  const partialMatch = content.match(/```(?:\w+)?\n([\s\S]+)$/);
  if (partialMatch) {
    return partialMatch[1].trim();
  }

  return null;
}

/**
 * Hook: Trigger after-build AI helpers when code generation completes
 *
 * Replaces: BuilderChat.tsx lines 731-813 (83 lines)
 * New size: ~90 lines, 4 dependencies
 *
 * Responsibility:
 * 1. Wait for streaming to end
 * 2. Get active helpers with type 'after_build'
 * 3. For each helper:
 *    - Extract code from final message
 *    - Build helper prompt
 *    - Call /api/test/stream
 *    - Stream response into helper response store
 * 4. Handle errors and cleanup
 */
export function useAIHelpers({
  messages,
  sending,
  code,
  getActiveHelpers,
  addResponse,
  updateResponse,
  setActiveHelper,
}: UseAIHelpersProps): void {
  useEffect(() => {
    // Only trigger after-build helpers when streaming ends and we have code
    if (sending || !code) return;

    const lastAssistantMessage = [...messages].reverse().find(
      m => m.role === 'assistant' && !m.isStreaming
    );

    if (!lastAssistantMessage) return;

    // Get active helpers that should run after build
    const afterBuildHelpers = getActiveHelpers('after_build' as const);
    if (afterBuildHelpers.length === 0) return;

    // Get the final code that was just built
    const finalCode = lastAssistantMessage.content;
    const codeForHelpers = extractCodeFromMarkdown(finalCode) || code;

    if (!codeForHelpers) return;

    // Trigger each helper
    afterBuildHelpers.forEach(async (helper) => {
      let responseId: string | null = null;

      try {
        console.log('[useAIHelpers] Triggering helper:', helper.name);
        setActiveHelper(helper.id);

        // Add pending response to store
        responseId = addResponse({
          helperId: helper.id,
          helperName: helper.name,
          helperIcon: helper.icon,
          helperModel: helper.model,
          content: '',
          status: 'pending',
          timestamp: Date.now(),
        });

        // Build the prompt for this helper
        const helperPrompt = buildHelperPrompt(
          helper.type,
          helper.systemPrompt,
          codeForHelpers
        );

        // Call streaming API
        const response = await fetch('/api/test/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: helper.model,
            prompt: helperPrompt,
            systemPrompt: helper.systemPrompt,
            source: helper.provider === 'ollama' ? 'local' : 'cloud',
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        updateResponse(responseId, { status: 'streaming' });

        // Stream response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let totalContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((l) => l.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                totalContent += data.message.content;
                updateResponse(responseId, { content: totalContent });
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }

        updateResponse(responseId, { status: 'complete', content: totalContent });
        console.log('[useAIHelpers] Helper completed:', helper.name);
      } catch (err) {
        console.error('[useAIHelpers] Helper error:', err);
        if (responseId) {
          updateResponse(responseId, {
            status: 'error',
            content: `Error: ${(err as Error).message}`,
          });
        }
      } finally {
        setActiveHelper(null);
      }
    });
  }, [messages, sending, code, getActiveHelpers, addResponse, updateResponse, setActiveHelper]);
}
