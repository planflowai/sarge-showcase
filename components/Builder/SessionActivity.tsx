"use client";

import { useState, useEffect } from "react";
import { useChangesStore, type ChangeEntry } from "@/lib/stores/changesStore";
import { useBuilderChatStore } from "@/lib/stores/builderChatStore";
import {
  FileCode,
  FilePlus,
  FileX,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Simple relative time formatter (no external dependency)
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}

interface SessionActivityProps {
  onScrollToMessage?: (messageId: string) => void;
  className?: string;
}

export default function SessionActivity({
  onScrollToMessage,
  className,
}: SessionActivityProps) {
  const changes = useChangesStore((s) => s.changes);
  const clearChanges = useChangesStore((s) => s.clearChanges);
  const messages = useBuilderChatStore((s) => s.messages);
  const [expanded, setExpanded] = useState(true);
  const [, forceUpdate] = useState(0);

  // Update relative times periodically
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Get session stats
  const totalMessages = messages.length;
  const userMessages = messages.filter((m) => m.role === "user").length;
  const assistantMessages = messages.filter((m) => m.role === "assistant").length;
  const appliedChanges = changes.filter((c) => c.status === "applied").length;
  const rejectedChanges = changes.filter((c) => c.status === "rejected").length;

  // Group changes by time
  const recentChanges = changes.slice(0, 10);

  const getChangeIcon = (change: ChangeEntry) => {
    if (change.action === "created") return FilePlus;
    if (change.action === "modified") return FileCode;
    if (change.action === "rejected") return FileX;
    return FileCode;
  };

  const getStatusBadge = (status: ChangeEntry["status"]) => {
    switch (status) {
      case "applied":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Applied
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
            <XCircle className="h-2.5 w-2.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
            <Clock className="h-2.5 w-2.5" />
            Pending
          </span>
        );
    }
  };

  // Don't show if no activity
  if (totalMessages === 0 && changes.length === 0) {
    return (
      <div className={cn("p-3", className)}>
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <Activity className="h-4 w-4" />
          <span>No activity yet</span>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">
          Start a conversation to build something
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-2 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-medium text-zinc-300">Session Activity</span>
          {(appliedChanges > 0 || userMessages > 0) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
              {appliedChanges > 0 ? `${appliedChanges} changes` : `${userMessages} messages`}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Session Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
              <div className="text-[10px]">
                <div className="text-zinc-300 font-medium">{totalMessages} messages</div>
                <div className="text-zinc-500">{userMessages} sent</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <div className="text-[10px]">
                <div className="text-zinc-300 font-medium">{appliedChanges} applied</div>
                {rejectedChanges > 0 && (
                  <div className="text-zinc-500">{rejectedChanges} rejected</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Changes */}
          {recentChanges.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Recent Changes
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearChanges();
                  }}
                  className="h-5 px-1.5 text-[10px] text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-2.5 w-2.5 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="space-y-1">
                {recentChanges.map((change) => {
                  const Icon = getChangeIcon(change);
                  return (
                    <button
                      key={change.id}
                      onClick={() => onScrollToMessage?.(change.messageId)}
                      className="w-full flex items-start gap-2 p-2 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/30 transition-colors text-left"
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 mt-0.5 flex-shrink-0",
                          change.action === "created"
                            ? "text-emerald-400"
                            : change.action === "rejected"
                            ? "text-red-400"
                            : "text-blue-400"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-zinc-300 truncate">
                            {change.filePath}
                          </span>
                          {getStatusBadge(change.status)}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                          {change.summary || `${change.action} via ${change.model}`}
                        </p>
                        <span className="text-[9px] text-zinc-600">
                          {formatRelativeTime(change.timestamp)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* No changes yet but has messages */}
          {recentChanges.length === 0 && totalMessages > 0 && (
            <div className="text-[10px] text-zinc-500 text-center py-2">
              No file changes yet. Apply AI suggestions to track changes.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
