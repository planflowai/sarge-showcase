"use client";

import { useState } from "react";
import { useAIAnalysisStore } from "@/lib/stores/aiAnalysisStore";
import { AIBatchHistoryList } from "./AIBatchHistoryList";
import { AIVerdictPanel } from "./AIVerdictPanel";
import { AIEvidencePanel } from "./AIEvidencePanel";
import { AILifecyclePanel } from "./AILifecyclePanel";

export function AIReviewView() {
  const aiBatch = useAIAnalysisStore((s) => s.aiBatch);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const selectedBatch = aiBatch.history.find((b) => b.batchId === selectedBatchId);

  return (
    <div className="flex h-full bg-white dark:bg-zinc-950">
      {/* Left Sidebar: Batch History */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            AI Batch History
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {aiBatch.history.length} batch runs
          </p>
        </div>
        <AIBatchHistoryList
          batches={aiBatch.history}
          selectedBatchId={selectedBatchId}
          onSelectBatch={setSelectedBatchId}
        />
      </div>

      {/* Right Side: Analysis */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedBatch ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                No Batch Selected
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select a batch from the history to view analysis
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <AIVerdictPanel batch={selectedBatch} />
            <AIEvidencePanel batch={selectedBatch} />
            <AILifecyclePanel batch={selectedBatch} />
          </div>
        )}
      </div>
    </div>
  );
}
