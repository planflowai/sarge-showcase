"use client";

interface AIBatchHistoryEntry {
  batchId: string;
  savedAt: string;
  source: 'local' | 'cloud';
  testCount: number;
}

interface AILifecyclePanelProps {
  batch: AIBatchHistoryEntry;
}

export function AILifecyclePanel({ batch }: AILifecyclePanelProps) {
  const savedDate = new Date(batch.savedAt);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Compact Header */}
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Metadata</h3>
      </div>

      {/* Compact Inline Stats */}
      <div className="px-4 py-2 flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 dark:text-zinc-400">ID:</span>
          <span className="font-mono text-zinc-800 dark:text-zinc-200">{batch.batchId.slice(0, 12)}...</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 dark:text-zinc-400">Source:</span>
          <span className={`font-medium ${batch.source === 'local' ? 'text-cyan-600 dark:text-cyan-400' : 'text-purple-600 dark:text-purple-400'}`}>
            {batch.source.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 dark:text-zinc-400">Tests:</span>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{batch.testCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 dark:text-zinc-400">Date:</span>
          <span className="text-zinc-700 dark:text-zinc-300">{savedDate.toLocaleDateString()} {savedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
