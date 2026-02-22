"use client";

import { useState, useMemo } from "react";
import { useJournalStore, AnalysisRecord } from "@/lib/stores/journalStore";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Trash2, Clock, Cpu, Cloud, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface AnalysisHistoryProps {
  onSelectAnalysis?: (analysis: AnalysisRecord) => void;
}

export function AnalysisHistory({ onSelectAnalysis }: AnalysisHistoryProps) {
  // Use raw state and compute derived value with useMemo to avoid infinite loops
  const analysisHistoryRaw = useJournalStore((s) => s.analysisHistory);
  const deleteAnalysis = useJournalStore((s) => s.deleteAnalysis);

  // Most recent first
  const analysisHistory = useMemo(() => {
    return [...analysisHistoryRaw].reverse();
  }, [analysisHistoryRaw]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>("");
  const [analysisToDelete, setAnalysisToDelete] = useState<AnalysisRecord | null>(null);

  const filteredHistory = filterDate
    ? analysisHistory.filter((a) => {
        const date = new Date(a.timestamp).toISOString().split("T")[0];
        return date === filterDate;
      })
    : analysisHistory;

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteClick = (record: AnalysisRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalysisToDelete(record);
  };

  const handleDeleteConfirm = () => {
    if (analysisToDelete) {
      deleteAnalysis(analysisToDelete.id);
      if (expandedId === analysisToDelete.id) {
        setExpandedId(null);
      }
      setAnalysisToDelete(null);
    }
  };

  if (analysisHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No analysis history yet
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
          Run an analysis to see it saved here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <Calendar className="h-4 w-4 text-zinc-400" />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-xs bg-transparent border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-zinc-700 dark:text-zinc-300"
        />
        {filterDate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setFilterDate("")}
          >
            Clear
          </Button>
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-auto">
          {filteredHistory.length} analysis{filteredHistory.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* History list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filteredHistory.map((record) => {
          const isExpanded = expandedId === record.id;

          return (
            <div
              key={record.id}
              className={cn(
                "rounded-lg border transition-colors cursor-pointer",
                isExpanded
                  ? "bg-zinc-50 dark:bg-zinc-900/50 border-indigo-300 dark:border-indigo-700"
                  : "bg-white dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between p-3"
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Provider icon */}
                  <div
                    className={cn(
                      "p-1.5 rounded",
                      record.provider === "ollama"
                        ? "bg-green-500/10"
                        : "bg-purple-500/10"
                    )}
                  >
                    {record.provider === "ollama" ? (
                      <Cpu className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Cloud className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>

                  {/* Date/time info */}
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {formatDate(record.timestamp)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatTime(record.timestamp)} via{" "}
                      {record.provider === "ollama" ? "Local" : "Claude Opus"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Context summary */}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:inline">
                    {record.context.batchLogsCount} batches,{" "}
                    {record.context.journalEntriesCount} entries
                  </span>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={(e) => handleDeleteClick(record, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-zinc-200 dark:border-zinc-800 mt-1 pt-3">
                  {/* Prompts snapshot */}
                  {record.context.promptsSnapshot && (
                    <div className="mb-3 p-2 rounded bg-zinc-100 dark:bg-zinc-800/50">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Prompts at time of analysis:
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {record.context.promptsSnapshot.d1 && (
                          <span className="text-zinc-500 dark:text-zinc-400">
                            D1: {record.context.promptsSnapshot.d1.substring(0, 30)}...
                          </span>
                        )}
                        {record.context.promptsSnapshot.d2 && (
                          <span className="text-zinc-500 dark:text-zinc-400">
                            D2: {record.context.promptsSnapshot.d2.substring(0, 30)}...
                          </span>
                        )}
                        {record.context.promptsSnapshot.d3 && (
                          <span className="text-zinc-500 dark:text-zinc-400">
                            D3: {record.context.promptsSnapshot.d3.substring(0, 30)}...
                          </span>
                        )}
                        {record.context.promptsSnapshot.judge && (
                          <span className="text-zinc-500 dark:text-zinc-400">
                            Judge: {record.context.promptsSnapshot.judge.substring(0, 30)}...
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Analysis content */}
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-p:text-sm">
                    <ReactMarkdown>{record.analysis}</ReactMarkdown>
                  </div>

                  {/* Load button */}
                  {onSelectAnalysis && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full text-xs"
                      onClick={() => onSelectAnalysis(record)}
                    >
                      Load This Analysis
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!analysisToDelete}
        onClose={() => setAnalysisToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Analysis"
        description={`Are you sure you want to delete this analysis from ${analysisToDelete ? new Date(analysisToDelete.timestamp).toLocaleDateString() : ''}? This action cannot be undone.`}
        variant="destructive"
        confirmText="Delete"
      />
    </div>
  );
}
