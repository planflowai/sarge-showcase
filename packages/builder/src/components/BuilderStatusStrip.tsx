"use client";

import { useMemo } from "react";
import { Check, Loader2, FileCode, FilePlus, FileSearch, Brain, Code2, Eye } from "lucide-react";
import { cn } from "@sarge/core";
import { parseStreamingContent } from "../lib/parseStreamingContent";
import type { ProgressStep } from "./ProgressCards";

interface BuilderStatusStripProps {
  /** Latest streaming message content (for file operation detection) */
  streamingContent?: string;
  /** Whether the AI is currently streaming */
  isStreaming: boolean;
  /** Progress steps from useProgressSteps hook */
  progressSteps: ProgressStep[];
  /** Whether progress is visible */
  progressVisible: boolean;
}

const progressIcons = {
  search: FileSearch,
  analyze: Brain,
  generate: Code2,
  write: FileCode,
  preview: Eye,
  detect: FileCode,
};

/**
 * BuilderStatusStrip — slim horizontal bar above ArtifactPanel tabs.
 * Shows file operation status + progress steps during streaming.
 * Collapses to nothing when idle.
 */
export default function BuilderStatusStrip({
  streamingContent,
  isStreaming,
  progressSteps,
  progressVisible,
}: BuilderStatusStripProps) {
  // Parse streaming content to detect file operations
  const parsed = useMemo(() => {
    if (!streamingContent || !isStreaming) return null;
    const result = parseStreamingContent(streamingContent);
    return result.edits.length > 0 ? result : null;
  }, [streamingContent, isStreaming]);

  // Nothing to show — collapse
  if (!progressVisible && !parsed) return null;

  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 overflow-x-auto">
      {/* Progress steps — compact inline pills */}
      {progressVisible && progressSteps.length > 0 && (
        <div className="flex items-center gap-1.5">
          {progressSteps.map((step) => {
            const Icon = progressIcons[step.icon] || FileCode;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all",
                  step.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : step.status === "in_progress"
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                )}
              >
                {step.status === "completed" ? (
                  <Check className="h-2.5 w-2.5" />
                ) : step.status === "in_progress" ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Icon className="h-2.5 w-2.5" />
                )}
                <span className="whitespace-nowrap">{step.label.replace("...", "")}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* File operations — slim inline indicators */}
      {parsed && parsed.edits.length > 0 && (
        <div className="flex items-center gap-2 ml-auto">
          {parsed.edits.map((edit, idx) => {
            const fileName = edit.filePath.split("/").pop() || edit.filePath;
            const isLast = idx === parsed.edits.length - 1;
            const isWriting = isLast && !parsed.isComplete;
            return (
              <div
                key={`${edit.filePath}-${idx}`}
                className="flex items-center gap-1 text-[10px]"
              >
                {isWriting ? (
                  <Loader2 className="h-2.5 w-2.5 text-blue-400 animate-spin" />
                ) : (
                  <Check className="h-2.5 w-2.5 text-emerald-400" />
                )}
                {edit.isNew ? (
                  <FilePlus className="h-2.5 w-2.5 text-emerald-400" />
                ) : (
                  <FileCode className="h-2.5 w-2.5 text-blue-400" />
                )}
                <span className={cn(
                  "font-mono",
                  isWriting ? "text-blue-400" : "text-zinc-400"
                )}>
                  {fileName}
                </span>
                <span className="text-emerald-500">+{edit.lineCount}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
