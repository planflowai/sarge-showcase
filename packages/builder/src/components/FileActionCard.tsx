"use client";

import { useState } from "react";
import { FileCode, Check, X, GitCompare, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@sarge/core";

export interface FileActionCardProps {
  filePath: string;
  proposedContent: string;
  originalContent?: string;
  language: string;
  projectPath: string;
  onApply: () => Promise<void>;
  onReject: () => void;
  onViewDiff: () => void;
}

export default function FileActionCard({
  filePath,
  proposedContent,
  originalContent = "",
  language,
  projectPath,
  onApply,
  onReject,
  onViewDiff,
}: FileActionCardProps) {
  const [status, setStatus] = useState<"pending" | "applying" | "applied" | "rejected">("pending");
  const [error, setError] = useState<string | null>(null);

  // Calculate line changes
  const originalLines = originalContent.split("\n").length;
  const proposedLines = proposedContent.split("\n").length;
  const addedLines = Math.max(0, proposedLines - originalLines);
  const removedLines = Math.max(0, originalLines - proposedLines);

  // Get file name from path
  const fileName = filePath.split("/").pop() || filePath;

  // Handle apply
  const handleApply = async () => {
    setStatus("applying");
    setError(null);
    try {
      await onApply();
      setStatus("applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
      setStatus("pending");
    }
  };

  // Handle reject
  const handleReject = () => {
    setStatus("rejected");
    onReject();
  };

  // Status-based styling
  const getStatusStyles = () => {
    switch (status) {
      case "applied":
        return "bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/30";
      case "rejected":
        return "bg-zinc-100 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 opacity-60";
      default:
        return "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700";
    }
  };

  return (
    <div
      className={cn(
        "my-3 rounded-lg border overflow-hidden shadow-sm transition-all",
        getStatusStyles()
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className={cn(
            "h-4 w-4 flex-shrink-0",
            status === "applied" ? "text-green-500" :
            status === "rejected" ? "text-zinc-400" : "text-indigo-500"
          )} />
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
            {fileName}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {filePath}
          </span>
        </div>

        {/* Line changes */}
        <div className="flex items-center gap-2 text-xs flex-shrink-0 ml-2">
          {addedLines > 0 && (
            <span className="text-green-600 dark:text-green-400 font-mono">+{addedLines}</span>
          )}
          {removedLines > 0 && (
            <span className="text-red-500 dark:text-red-400 font-mono">-{removedLines}</span>
          )}
          {addedLines === 0 && removedLines === 0 && originalContent && (
            <span className="text-zinc-500 font-mono">~modified</span>
          )}
          {!originalContent && (
            <span className="text-green-600 dark:text-green-400 font-mono">new file</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50">
        {status === "pending" && (
          <>
            <Button
              size="sm"
              onClick={handleApply}
              className="h-7 gap-1.5 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-3.5 w-3.5" />
              Apply
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              className="h-7 gap-1.5 px-3 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDiff}
              className="h-7 gap-1.5 px-3 text-xs text-zinc-600 dark:text-zinc-400"
            >
              <GitCompare className="h-3.5 w-3.5" />
              View Diff
            </Button>
          </>
        )}

        {status === "applying" && (
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Writing to disk...</span>
          </div>
        )}

        {status === "applied" && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>Done — applied to {fileName}</span>
          </div>
        )}

        {status === "rejected" && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <XCircle className="h-4 w-4" />
            <span>Changes rejected</span>
          </div>
        )}

        {error && (
          <span className="text-xs text-red-500 ml-2">{error}</span>
        )}
      </div>
    </div>
  );
}
