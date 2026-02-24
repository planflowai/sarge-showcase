"use client";

import { useMemo } from "react";
import { parseEditBlocks } from "@/lib/editBlockParser";
import { cn } from "@/lib/utils";

interface EditBlockItem {
  startLine: number;
  endLine: number;
  isComplete: boolean;
  isStreaming: boolean;
}

interface EditProgressPanelProps {
  content: string;
  isStreaming: boolean;
}

/**
 * EditProgressPanel: Show progress of streaming EDIT blocks
 *
 * Displays:
 * 1. Explanation text (before first EDIT block)
 * 2. List of EDIT blocks with status:
 *    - ✓ Complete blocks in emerald
 *    - ● Streaming blocks with pulsing animation
 * 3. After streaming ends: "Made X changes" summary
 */
export default function EditProgressPanel({
  content,
  isStreaming,
}: EditProgressPanelProps) {
  const parsed = useMemo(() => parseEditBlocks(content), [content]);

  // Find partial blocks (started but not closed) by searching for "EDIT lines N-M:"
  // and checking if they're in the complete blocks list
  const allBlockPatterns = useMemo(() => {
    const regex = /EDIT\s+lines?\s+(\d+)(?:\s*[-–—to]\s*(\d+))?:/gi;
    const matches: { startLine: number; endLine: number; index: number }[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const startLine = parseInt(match[1], 10);
      const endLine = match[2] ? parseInt(match[2], 10) : startLine;
      matches.push({ startLine, endLine, index: match.index });
    }

    return matches;
  }, [content]);

  // Map found patterns to blocks with status
  const editBlocks: EditBlockItem[] = useMemo(() => {
    return allBlockPatterns.map((pattern) => {
      const isComplete = parsed.editBlocks.some(
        (block) =>
          block.startLine === pattern.startLine && block.endLine === pattern.endLine
      );
      return {
        startLine: pattern.startLine,
        endLine: pattern.endLine,
        isComplete,
        isStreaming: !isComplete && isStreaming,
      };
    });
  }, [allBlockPatterns, parsed.editBlocks, isStreaming]);

  const changeCount = parsed.editBlocks.length;

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 space-y-3">
      {/* Explanation text */}
      {parsed.explanation && (
        <div className="text-sm text-zinc-300 leading-relaxed">
          ✏️ {parsed.explanation}
        </div>
      )}

      {/* Edit blocks progress list */}
      {editBlocks.length > 0 && (
        <div className="space-y-2 mt-2">
          {editBlocks.map((block, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {block.isComplete ? (
                <>
                  <span className="text-emerald-400 font-semibold">✓</span>
                  <span className="text-zinc-300">Lines {block.startLine}–{block.endLine}</span>
                </>
              ) : block.isStreaming ? (
                <>
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full bg-emerald-400",
                      "animate-pulse"
                    )}
                  />
                  <span className="text-zinc-300">
                    Editing lines {block.startLine}–{block.endLine}...
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-zinc-500" />
                  <span className="text-zinc-400">Lines {block.startLine}–{block.endLine}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary when done */}
      {!isStreaming && changeCount > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-700 flex items-center gap-2 text-sm text-emerald-400 font-semibold">
          <span>✓</span>
          <span>Made {changeCount} {changeCount === 1 ? "change" : "changes"}</span>
        </div>
      )}
    </div>
  );
}
