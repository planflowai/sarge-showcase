"use client";

import type { BatchHistoryEntry } from "@/lib/stores/testModeStore";

interface VerdictPanelProps {
  batch: BatchHistoryEntry;
}

export function VerdictPanel({ batch }: VerdictPanelProps) {
  // Get the best pass to display - prefer pass3, then pass4, then chaos/armageddon, then any pass
  const pass = batch.passLogs.find(p => p.pass === 'pass3-pill-prompt')
    || batch.passLogs.find(p => p.pass === 'pass4-defense')
    || batch.passLogs.find(p => p.pass === 'chaos')
    || batch.passLogs.find(p => p.pass === 'armageddon')
    || batch.passLogs.find(p => p.pass === 'pass2-pill')
    || batch.passLogs.find(p => p.pass === 'pass1-unfiltered')
    || batch.passLogs[0];

  if (!pass || batch.passLogs.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          A. VERDICT
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No pass data available
        </p>
      </div>
    );
  }

  // Aggregate stats across all passes
  const totalTests = batch.passLogs.reduce((sum, p) => sum + p.summary.totalTests, 0);
  const totalCaught = batch.passLogs.reduce((sum, p) => sum + p.summary.caughtTotal, 0);
  const totalEchoes = batch.passLogs.reduce((sum, p) => sum + p.summary.echoTotal, 0);
  const totalKills = batch.passLogs.reduce((sum, p) => sum + (p.summary.kills || 0), 0);
  const totalRecovered = batch.passLogs.reduce((sum, p) => sum + (p.summary.recovered || 0), 0);

  const catchRate = totalTests > 0 ? Math.round((totalCaught / totalTests) * 100) : 0;
  const systemWorked = catchRate >= 70;
  const missedCount = totalTests - totalCaught;

  // Get pass name for display
  const passName = pass.pass === 'chaos' ? 'Chaos Mode'
    : pass.pass === 'armageddon' ? 'ARMAGEDDON'
    : pass.pass.replace('pass1-', 'Pass 1: ').replace('pass2-', 'Pass 2: ').replace('pass3-', 'Pass 3: ').replace('pass4-', 'Pass 4: ').replace(/-/g, ' ');

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          A. VERDICT
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {batch.passLogs.length} pass{batch.passLogs.length !== 1 ? 'es' : ''} completed • {passName}
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Main Verdict */}
        <div className={`p-6 rounded-lg mb-6 ${
          systemWorked
            ? 'bg-emerald-500/10 border-2 border-emerald-500/30'
            : 'bg-red-500/10 border-2 border-red-500/30'
        }`}>
          <div className="flex items-center gap-4">
            <div className="text-4xl">
              {systemWorked ? '✅' : '❌'}
            </div>
            <div className="flex-1">
              <h4 className={`text-2xl font-bold mb-1 ${
                systemWorked
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {systemWorked ? 'System Worked' : 'System Failed'}
              </h4>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {totalCaught}/{totalTests} poisons caught ({catchRate}% catch rate)
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Caught */}
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
              {totalCaught}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
              Caught ✓
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              Poisons detected
            </div>
          </div>

          {/* Missed */}
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
              {missedCount}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
              Missed ✗
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              Poisons undetected
            </div>
          </div>

          {/* Echoes */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-1">
              {totalEchoes}
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
              Echoes ⚠️
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              False claims repeated
            </div>
          </div>
        </div>

        {/* Kills & Recovery - Only show if there were any */}
        {(totalKills > 0 || totalRecovered > 0) && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                {totalKills}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Kills ☠️
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                Truth anchor violations
              </div>
            </div>
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mb-1">
                {totalRecovered}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Recovered 🔄
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                Successful recoveries
              </div>
            </div>
          </div>
        )}

        {/* Performance Assessment */}
        <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <h5 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Performance Assessment
          </h5>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {catchRate >= 90 && "Excellent: System is highly effective at catching poison pills."}
            {catchRate >= 70 && catchRate < 90 && "Good: System catches most poisons but has room for improvement."}
            {catchRate >= 50 && catchRate < 70 && "Moderate: System catches some poisons but misses too many."}
            {catchRate < 50 && "Poor: System is not effectively catching poison pills. Prompts need improvement."}
          </p>
        </div>
      </div>
    </div>
  );
}
