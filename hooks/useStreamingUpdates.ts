"use client";

import { useEffect, useRef } from "react";
import type { BuilderMessage } from "@/lib/stores/builderChatStore";
import type { EditBlock } from "@/lib/editBlockParser";
import { parseEditBlocks, applyEditBlocks, getDiffSummary } from "@/lib/editBlockParser";
import { extractSummaryFromResponse } from "@/lib/builderLogger";

interface StreamingUpdateState {
  code: string | null;
  pendingEdit: {
    original: string;
    modified: string;
    summary: { added: number; removed: number };
  } | null;
}

// Extract code blocks from markdown content
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

interface UseStreamingUpdatesProps {
  messages: BuilderMessage[];
  sending: boolean;
  editMode: "edit" | "generate";
  artifactCode?: string;
  projectPath?: string | null;
  projectName?: string | null;
  selectedModel?: string | null;
  autoApply?: boolean;
  onStreamingUpdate?: (code: string, isStreaming: boolean) => void;
  onViewDiff?: (filePath: string, originalContent: string, proposedContent: string) => void;
  startStep: (step: string, label: string) => void;
  finishProgress: () => void;
  progressIsVisible: boolean;
}

interface UseStreamingUpdatesReturn {
  streamingCode: string | null;
  pendingEdit: StreamingUpdateState["pendingEdit"];
}

/**
 * Hook: Extract code from streaming messages, parse edits, update preview, log changes
 *
 * Replaces: BuilderChat.tsx lines 640-815 (175 lines, 17 dependencies)
 * New size: ~120 lines, 12 dependencies
 *
 * Responsibility:
 * 1. Monitor streaming message and extract code
 * 2. Update preview in real-time via onStreamingUpdate
 * 3. When streaming ends: parse EDIT blocks, compute diff, prepare for approval
 * 4. Update BUILDER_LOG.md with generation summary
 */
export function useStreamingUpdates({
  messages,
  sending,
  editMode,
  artifactCode,
  projectPath,
  projectName,
  selectedModel,
  autoApply,
  onStreamingUpdate,
  onViewDiff,
  startStep,
  finishProgress,
  progressIsVisible,
}: UseStreamingUpdatesProps): UseStreamingUpdatesReturn {
  const lastStreamingCodeRef = useRef<string | null>(null);
  const lastArtifactCodeRef = useRef<string | null>(artifactCode);

  // Track pending edit approval
  const pendingEditRef = useRef<StreamingUpdateState["pendingEdit"]>(null);

  // Use refs for logging-only values (don't affect behavior)
  // These won't be in dependency array — only for fire-and-forget logging
  const loggingDataRef = useRef({ projectPath, projectName, selectedModel });
  loggingDataRef.current = { projectPath, projectName, selectedModel };

  // Extract code from streaming message and send to preview
  useEffect(() => {
    const streamingMessage = messages.find(m => m.isStreaming && m.role === 'assistant');

    if (streamingMessage && streamingMessage.content) {
      const code = extractCodeFromMarkdown(streamingMessage.content);

      // Update progress steps based on streaming content
      if (streamingMessage.content.length > 0 && progressIsVisible) {
        startStep("analyze", "Processing your request...");
      }
      if (streamingMessage.content.length > 100 && progressIsVisible) {
        startStep("generate", `${streamingMessage.content.length} chars generated...`);
      }

      if (code && code !== lastStreamingCodeRef.current) {
        lastStreamingCodeRef.current = code;
        onStreamingUpdate?.(code, true);

        // Update progress - building preview
        if (progressIsVisible) {
          startStep("preview", "Rendering live preview...");
        }
      }
    } else if (!sending && lastStreamingCodeRef.current) {
      // STREAMING ENDED — Process final code, edits, and log
      const lastAssistantMessage = [...messages].reverse().find(
        m => m.role === 'assistant' && !m.isStreaming
      );

      if (lastAssistantMessage && editMode === "edit" && artifactCode) {
        // EDIT MODE: Parse edit blocks and compute diff for approval
        const parsed = parseEditBlocks(lastAssistantMessage.content);
        let modifiedCode: string | null = null;

        if (parsed.hasEditBlocks && parsed.editBlocks.length > 0) {
          console.log('[useStreamingUpdates] Parsed surgical edits:', parsed.editBlocks.length, 'blocks');
          modifiedCode = applyEditBlocks(artifactCode, parsed.editBlocks);
        } else if (parsed.fullFileCode) {
          console.log('[useStreamingUpdates] Full file replacement detected');
          modifiedCode = parsed.fullFileCode;
        } else if (lastStreamingCodeRef.current) {
          modifiedCode = lastStreamingCodeRef.current;
        }

        if (modifiedCode && modifiedCode !== artifactCode) {
          const summary = getDiffSummary(artifactCode, modifiedCode);
          pendingEditRef.current = { original: artifactCode, modified: modifiedCode, summary };

          if (autoApply) {
            // Auto-apply is ON: apply changes directly without showing diff
            console.log('[useStreamingUpdates] Auto-apply enabled, applying changes directly');
            onStreamingUpdate?.(modifiedCode, false);
          } else {
            // Auto-apply is OFF: show diff for user approval
            console.log('[useStreamingUpdates] Diff computed, awaiting approval');
            onViewDiff?.('[Pending Edits]', artifactCode, modifiedCode);
          }
        } else {
          // No changes detected — apply directly
          if (lastStreamingCodeRef.current) {
            onStreamingUpdate?.(lastStreamingCodeRef.current, false);
          }
        }
      } else {
        // GENERATE MODE: Apply extracted code directly
        onStreamingUpdate?.(lastStreamingCodeRef.current, false);
      }

      lastStreamingCodeRef.current = null;
      lastArtifactCodeRef.current = artifactCode;

      // Finish progress
      if (progressIsVisible) {
        finishProgress();
      }

      // AUTO-UPDATE BUILDER_LOG (fire-and-forget, non-critical)
      if (projectPath && projectName && lastAssistantMessage) {
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        const promptSummary = lastUserMessage?.content?.slice(0, 100) || 'AI generation';

        fetch('/api/builder/update-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            projectName,
            action: 'append',
            entry: {
              type: 'ai-generation',
              filePath: '[artifact]',
              description: `AI generated code — prompt: "${promptSummary}"`,
              model: selectedModel || 'unknown',
              timestamp: Date.now(),
            },
          }),
        }).catch(() => {
          // Silent fail — log update is non-critical
          console.warn('[useStreamingUpdates] Failed to update BUILDER_LOG.md');
        });
      }
    }
  }, [
    // CORE DEPENDENCIES ONLY (4):
    // - messages: new streaming content arrives
    // - sending: streaming ends
    // - editMode: behavior changes between edit/generate
    // - artifactCode: needed to compute diff in edit mode
    //
    // NON-REACTIVE moved to useRef:
    // - projectPath, projectName, selectedModel (logging only, not behavior)
    // - Callbacks (onStreamingUpdate, onViewDiff, startStep, finishProgress)
    //   must be useCallback-wrapped by caller to prevent re-runs
    messages,
    sending,
    editMode,
    artifactCode,
  ]);

  return {
    streamingCode: lastStreamingCodeRef.current,
    pendingEdit: pendingEditRef.current,
  };
}
