"use client";

interface AIBatchHistoryEntry {
  batchId: string;
  passLogs: Array<{
    pass: string;
    summary: {
      catchRate: number;
      totalTests: number;
      completed: number;
      caughtTotal: number;
      echoTotal: number;
    };
  }>;
}

interface AIVerdictPanelProps {
  batch: AIBatchHistoryEntry;
}

export function AIVerdictPanel({ batch }: AIVerdictPanelProps) {
  // Get Pass 3 (protected) results
  const pass3 = batch.passLogs.find(p => p.pass === 'pass3-pill-prompt');

  if (!pass3) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          A. VERDICT
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No protected pass data available
        </p>
      </div>
    );
  }

  const { summary } = pass3;
  const catchRate = summary.catchRate;
  const systemWorked = catchRate >= 70;

  const caughtCount = summary.caughtTotal;
  const totalTests = summary.totalTests;
  const missedCount = totalTests - caughtCount;
  const echoCount = summary.echoTotal;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Header + Main Verdict Combined */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        systemWorked
          ? 'bg-emerald-500/10 border-b border-emerald-500/20'
          : 'bg-red-500/10 border-b border-red-500/20'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{systemWorked ? '✅' : '❌'}</span>
          <div>
            <h3 className={`text-base font-bold ${
              systemWorked ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {systemWorked ? 'System Worked' : 'System Failed'}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {caughtCount}/{totalTests} caught ({catchRate}%)
            </p>
          </div>
        </div>
      </div>

      {/* Compact Stats Row */}
      <div className="grid grid-cols-3 gap-2 p-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-500/10">
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{caughtCount}</span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Caught</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-500/10">
          <span className="text-lg font-bold text-red-600 dark:text-red-400">{missedCount}</span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Missed</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-500/10">
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{echoCount}</span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Echoes</span>
        </div>
      </div>
    </div>
  );
}
