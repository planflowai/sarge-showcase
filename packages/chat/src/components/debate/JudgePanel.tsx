"use client";

import { useMemo } from "react";
import { cn } from "@sarge/core";
import type { DebateAgent } from "../../lib/debate/engine";

interface JudgePanelProps {
  judge: DebateAgent;
  isStreaming: boolean;
  content: string;
  status: "waiting" | "thinking" | "complete";
  allAgentsComplete: boolean;
}

// Judge color is EXCLUSIVELY AMBER per spec
const JUDGE_COLOR = "#D97706";

export function JudgePanel({
  judge,
  isStreaming,
  content,
  status,
  allAgentsComplete,
}: JudgePanelProps) {
  const statusColor = useMemo(() => {
    switch (status) {
      case "waiting":
        return "bg-zinc-400 dark:bg-zinc-600";
      case "thinking":
        return "bg-yellow-400 dark:bg-yellow-600 animate-pulse";
      case "complete":
        return "bg-emerald-400 dark:bg-emerald-600";
      default:
        return "bg-zinc-400 dark:bg-zinc-600";
    }
  }, [status]);

  return (
    <div
      className="flex flex-col h-full border-l-4 bg-white dark:bg-zinc-900 overflow-hidden"
      style={{ borderColor: JUDGE_COLOR }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800"
        style={{ backgroundColor: `${JUDGE_COLOR}10` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("w-2 h-2 rounded-full", statusColor)} />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Judge
          </span>
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {judge.model}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {!allAgentsComplete ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">
            Waiting for all agents to complete...
          </div>
        ) : content ? (
          <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        ) : isStreaming ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">
            Analyzing...
          </div>
        ) : status === "waiting" ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">
            Waiting...
          </div>
        ) : null}
      </div>
    </div>
  );
}
