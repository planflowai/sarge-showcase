"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { BatchHistoryList } from "@/components/review/BatchHistoryList";
import { VerdictPanel } from "@/components/review/VerdictPanel";
import { EvidencePanel } from "@/components/review/EvidencePanel";
import { LifecyclePanel } from "@/components/review/LifecyclePanel";
import { BatchComparisonView } from "@/components/review/BatchComparisonView";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SkeletonList, PageLoading } from "@/components/ui/skeleton";

export default function ReviewPage() {
  const searchParams = useSearchParams();
  const batchHistory = useTestModeStore((s) => s.batchHistory);
  const hydrateBatchHistory = useTestModeStore((s) => s.hydrateBatchHistory);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [comparisonBatchId, setComparisonBatchId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate batch history on mount
  useEffect(() => {
    hydrateBatchHistory();
    setIsHydrated(true);
  }, [hydrateBatchHistory]);

  // Auto-select latest batch when navigating with ?preselect=latest
  useEffect(() => {
    const preselect = searchParams.get('preselect');
    if (preselect === 'latest' && !hasAutoSelected && batchHistory.length > 0) {
      // Select the most recent batch (last in array)
      const latestBatch = batchHistory[batchHistory.length - 1];
      setSelectedBatchId(latestBatch.batchId);
      setHasAutoSelected(true);
    }
  }, [searchParams, batchHistory, hasAutoSelected]);

  // Show loading state while hydrating
  if (!isHydrated) {
    return <PageLoading message="Loading batch history..." />;
  }

  const selectedBatch = batchHistory.find(b => b.batchId === selectedBatchId);
  const comparisonBatch = batchHistory.find(b => b.batchId === comparisonBatchId);

  return (
    <ErrorBoundary fallbackTitle="Review Error">
    <div className="flex h-full bg-white dark:bg-zinc-950">
      {/* Left Sidebar: Batch History */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Batch History
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {batchHistory.length} batch runs
          </p>
        </div>
        <BatchHistoryList
          batches={batchHistory}
          selectedBatchId={selectedBatchId}
          onSelectBatch={setSelectedBatchId}
          comparisonBatchId={comparisonBatchId}
          onSelectComparison={setComparisonBatchId}
          showComparison={showComparison}
          onToggleComparison={setShowComparison}
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
        ) : showComparison && comparisonBatch ? (
          <BatchComparisonView
            batch1={selectedBatch}
            batch2={comparisonBatch}
          />
        ) : (
          <div className="flex-1 overflow-auto p-6 space-y-6">
            <VerdictPanel batch={selectedBatch} />
            <EvidencePanel batch={selectedBatch} />
            <LifecyclePanel batch={selectedBatch} />
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
