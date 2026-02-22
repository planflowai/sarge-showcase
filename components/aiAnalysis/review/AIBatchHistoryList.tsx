"use client";

import { cn } from "@/lib/utils";

interface AIBatchHistoryEntry {
  batchId: string;
  savedAt: string;
  source: 'local' | 'cloud';
  testCount: number;
  passLogs: Array<{
    pass: string;
    summary: {
      catchRate: number;
      totalTests: number;
      completed: number;
    };
  }>;
}

interface AIBatchHistoryListProps {
  batches: AIBatchHistoryEntry[];
  selectedBatchId: string | null;
  onSelectBatch: (batchId: string) => void;
}

export function AIBatchHistoryList({
  batches,
  selectedBatchId,
  onSelectBatch,
}: AIBatchHistoryListProps) {
  // Calculate catch rate for a batch
  const getCatchRate = (batch: AIBatchHistoryEntry): number => {
    const pass3 = batch.passLogs.find(p => p.pass === 'pass3-pill-prompt');
    return pass3?.summary.catchRate || 0;
  };

  // Sort batches by date (newest first)
  const sortedBatches = [...batches].sort((a, b) =>
    new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  return (
    <div className="flex-1 overflow-auto">
      {sortedBatches.length === 0 ? (
        <div className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No AI batch runs yet. Run a batch test to see analysis here.
        </div>
      ) : (
        <div className="p-2 space-y-2">
          {sortedBatches.map((batch) => {
            const isSelected = batch.batchId === selectedBatchId;
            const catchRate = getCatchRate(batch);
            const date = new Date(batch.savedAt);
            const timeStr = date.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            const dateStr = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={batch.batchId}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all",
                  isSelected
                    ? "bg-violet-500/15 border-violet-500/50"
                    : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-violet-500/30"
                )}
                onClick={() => onSelectBatch(batch.batchId)}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-medium",
                      batch.source === 'local'
                        ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                        : "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                    )}>
                      {batch.source === 'local' ? 'LOCAL' : 'CLOUD'}
                    </span>
                    {isSelected && (
                      <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                        ● Selected
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-bold",
                    catchRate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                    catchRate >= 60 ? "text-amber-600 dark:text-amber-400" :
                    "text-red-600 dark:text-red-400"
                  )}>
                    {catchRate}%
                  </span>
                </div>

                {/* Info */}
                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {batch.testCount} tests
                    </span>
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{batch.passLogs.length} passes</span>
                    <span className="text-zinc-500 dark:text-zinc-500">{timeStr}</span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px]">
                  {batch.passLogs.map((pass, idx) => {
                    const label =
                      pass.pass === 'pass1-unfiltered' ? 'P1' :
                      pass.pass === 'pass2-pill' ? 'P2' :
                      'P3';
                    const rate = pass.summary.catchRate;
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="text-zinc-500 dark:text-zinc-500">{label}:</span>
                        <span className={cn(
                          "font-semibold",
                          rate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                          rate >= 60 ? "text-amber-600 dark:text-amber-400" :
                          "text-red-600 dark:text-red-400"
                        )}>
                          {rate}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
