"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { FileCode, FilePlus, Check, X, ChevronDown, ChevronUp, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EditCardProps {
  filePath: string;
  isNew: boolean;
  isStreaming: boolean;
  linesAdded: number;
  linesRemoved: number;
  summary?: string;
  onApply?: () => Promise<void>;
  onReject?: () => void;
  onViewDiff?: () => void;
  status: "streaming" | "pending" | "applied" | "rejected";
  autoApply?: boolean;  // Auto-apply without user interaction
}

export default function EditCard({
  filePath,
  isNew,
  isStreaming,
  linesAdded,
  linesRemoved,
  summary,
  onApply,
  onReject,
  onViewDiff,
  status,
  autoApply = false,
}: EditCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fileName = filePath.split("/").pop() || filePath;
  const dirPath = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";

  // Handle apply action
  const handleApply = useCallback(async () => {
    if (!onApply) return;
    setIsApplying(true);
    try {
      await onApply();
    } finally {
      setIsApplying(false);
    }
  }, [onApply]);

  // Auto-apply if enabled and status is pending
  useEffect(() => {
    if (autoApply && status === "pending" && !isApplying) {
      console.log(`[EditCard] Auto-applying ${filePath}`);
      handleApply();
    }
  }, [autoApply, status, isApplying, handleApply, filePath]);

  const statusColors = {
    streaming: "border-blue-500/50 bg-blue-500/5",
    pending: "border-zinc-700 bg-zinc-800/50",
    applied: "border-emerald-500/50 bg-emerald-500/5",
    rejected: "border-red-500/30 bg-red-500/5 opacity-60",
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-all duration-200 my-2",
        statusColors[status]
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Status indicator */}
          {status === "streaming" ? (
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
          ) : status === "applied" ? (
            <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          ) : status === "rejected" ? (
            <X className="h-5 w-5 text-red-400 flex-shrink-0" />
          ) : isNew ? (
            <FilePlus className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <FileCode className="h-5 w-5 text-blue-400 flex-shrink-0" />
          )}

          {/* File info */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200 truncate">
                {isNew ? "Create" : "Edit"}: {fileName}
              </span>
              {!isStreaming && (
                <span className="text-[10px] text-zinc-500">
                  {dirPath && `${dirPath}/`}
                </span>
              )}
            </div>
            {/* Line changes */}
            {!isStreaming && (linesAdded > 0 || linesRemoved > 0) && (
              <div className="flex items-center gap-2 mt-0.5">
                {linesAdded > 0 && (
                  <span className="text-[10px] text-emerald-400">+{linesAdded}</span>
                )}
                {linesRemoved > 0 && (
                  <span className="text-[10px] text-red-400">-{linesRemoved}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isStreaming ? (
            <span className="text-sm text-blue-400 animate-pulse">Writing...</span>
          ) : status === "pending" || status === "streaming" ? (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <Check className="h-4 w-4" />
              Done
            </span>
          ) : null}

          {status === "pending" && (
            <>
              {onViewDiff && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewDiff}
                  className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Diff
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onReject}
                className="h-7 px-2 text-xs text-zinc-400 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isApplying}
                className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isApplying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Apply
                  </>
                )}
              </Button>
            </>
          )}

          {status === "applied" && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              Applied
            </span>
          )}

          {status === "rejected" && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Summary (if available and expanded or streaming) */}
      {summary && (status === "streaming" || expanded) && (
        <div className="px-3 pb-2 text-xs text-zinc-400 border-t border-zinc-700/50 pt-2">
          {summary}
        </div>
      )}

      {/* Expand toggle for completed edits with summary */}
      {summary && status !== "streaming" && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-zinc-500 hover:text-zinc-400 border-t border-zinc-700/30"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show details
            </>
          )}
        </button>
      )}
    </div>
  );
}
