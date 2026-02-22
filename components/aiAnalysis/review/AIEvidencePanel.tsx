"use client";

interface AIBatchHistoryEntry {
  batchId: string;
  passLogs: Array<{
    pass: string;
    summary: {
      totalTests: number;
      completed: number;
    };
  }>;
}

interface AIEvidencePanelProps {
  batch: AIBatchHistoryEntry;
}

export function AIEvidencePanel({ batch }: AIEvidencePanelProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Compact Header */}
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Evidence</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{batch.passLogs.length} passes</span>
      </div>

      {/* Compact Grid */}
      <div className="p-3 grid grid-cols-4 gap-2 text-xs">
        {batch.passLogs.map((pass, idx) => (
          <div key={idx} className="px-2 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
            <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {pass.pass.replace('pass', 'P').replace('-', ' ').slice(0, 12)}
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">
              {pass.summary.completed}/{pass.summary.totalTests}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
