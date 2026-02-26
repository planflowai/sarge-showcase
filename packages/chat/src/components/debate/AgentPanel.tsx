"use client";

import { useMemo } from "react";
import { cn } from "@sarge/core";
import type { DebateAgent } from "../../lib/debate/engine";

interface AgentPanelProps {
  agent: DebateAgent | null;
  agentNumber: number;
  roundNumber: number;
  isStreaming: boolean;
  content: string;
  status: "waiting" | "thinking" | "complete";
}

export function AgentPanel({
  agent,
  agentNumber,
  roundNumber,
  isStreaming,
  content,
  status,
}: AgentPanelProps) {
  // If no agent (No LLM), don't render
  if (!agent) {
    return null;
  }

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

  const borderColor = useMemo(() => {
    return agent.color;
  }, [agent.color]);

  return (
    <div
      className="flex flex-col h-full border-l-4 bg-white dark:bg-zinc-900 overflow-hidden"
      style={{ borderColor }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800"
        style={{ backgroundColor: `${borderColor}10` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("w-2 h-2 rounded-full", statusColor)} />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Agent {agentNumber}
          </span>
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {agent.model} ({agent.provider})
        </div>
        {agent.role && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {agent.role}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {roundNumber > 0 ? (
          <>
            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Round {roundNumber}
            </div>
            {content ? (
              <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {content}
              </div>
            ) : isStreaming ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                Thinking...
              </div>
            ) : status === "waiting" ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                Waiting...
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">
            Debate not started
          </div>
        )}
      </div>
    </div>
  );
}
