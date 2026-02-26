"use client";

import { useEffect } from "react";
import { useDebateHistoryStore } from "../../stores/debateHistoryStore";
import { useDebateStore } from "../../stores/debateStore";
import { Trash2, FileText } from "lucide-react";
import { formatRelativeDate } from "@sarge/core";
import { cn } from "@sarge/core";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Last Month", "Older"];

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function DebateHistory() {
  const { debates, deleteDebate, getDebate } = useDebateHistoryStore();
  const currentDebate = useDebateStore((s) => s.debate);

  const handleLoadDebate = (id: string) => {
    const debate = getDebate(id);
    if (debate) {
      // Load this debate into the debate store
      useDebateStore.setState({ debate: debate as any, showingSetup: false });
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this debate?")) {
      deleteDebate(id);
    }
  };

  if (debates.length === 0) {
    return (
      <div className="px-1 py-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
        No debate history yet
      </div>
    );
  }

  // Group by relative date
  const grouped: Record<string, typeof debates> = {};
  for (const debate of debates) {
    const label = formatRelativeDate(debate.createdAt);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(debate);
  }

  // Sort each group newest-first
  for (const label of Object.keys(grouped)) {
    grouped[label].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  // Only include groups that have debates, in order
  const activeGroups = GROUP_ORDER.filter((g) => grouped[g]?.length);

  return (
    <Accordion
      type="multiple"
      defaultValue={[]}
      className="space-y-0"
    >
      {activeGroups.map((label) => {
        const debateList = grouped[label];
        return (
          <AccordionItem key={label} value={label} className="border-none">
            <AccordionTrigger className="px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-400 hover:no-underline">
              {label} ({debateList.length})
            </AccordionTrigger>
            <AccordionContent className="pb-1">
              <div className="space-y-0.5">
                {debateList.map((debate) => {
                  const isActive = currentDebate?.id === debate.id;
                  return (
                    <div
                      key={debate.id}
                      className={cn(
                        "group flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 transition-colors cursor-pointer",
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => handleLoadDebate(debate.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                          <p className="truncate text-xs font-medium">
                            {debate.topic.substring(0, 40)}
                            {debate.topic.length > 40 ? "..." : ""}
                          </p>
                        </div>
                        <p className="mt-0.5 text-[10px] opacity-70">
                          {debate.totalRounds} rounds • {debate.agentSlots.length} agents •{" "}
                          {formatDate(debate.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, debate.id)}
                        className={cn(
                          "rounded p-1 opacity-0 transition-opacity group-hover:opacity-100",
                          isActive
                            ? "hover:bg-indigo-700 text-white"
                            : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                        )}
                        title="Delete debate"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
