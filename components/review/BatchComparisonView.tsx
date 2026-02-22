"use client";

import type { BatchHistoryEntry } from "@/lib/stores/testModeStore";
import { cn } from "@/lib/utils";

interface BatchComparisonViewProps {
  batch1: BatchHistoryEntry;
  batch2: BatchHistoryEntry;
}

export function BatchComparisonView({ batch1, batch2 }: BatchComparisonViewProps) {
  const pass1_1 = batch1.passLogs.find(p => p.pass === 'pass1-unfiltered');
  const pass2_1 = batch1.passLogs.find(p => p.pass === 'pass2-pill');
  const pass3_1 = batch1.passLogs.find(p => p.pass === 'pass3-pill-prompt');

  const pass1_2 = batch2.passLogs.find(p => p.pass === 'pass1-unfiltered');
  const pass2_2 = batch2.passLogs.find(p => p.pass === 'pass2-pill');
  const pass3_2 = batch2.passLogs.find(p => p.pass === 'pass3-pill-prompt');

  const catchRate1 = pass3_1?.summary.catchRate || 0;
  const catchRate2 = pass3_2?.summary.catchRate || 0;
  const diff = catchRate1 - catchRate2;

  const date1 = new Date(batch1.savedAt).toLocaleDateString();
  const date2 = new Date(batch2.savedAt).toLocaleDateString();

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Batch Comparison
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Side-by-side analysis of two batch runs
        </p>
      </div>

      {/* Summary Comparison */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Batch 1 */}
        <div className="p-6 rounded-lg border-2 border-violet-500/30 bg-violet-500/5">
          <div className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-2">
            Batch 1 (Selected)
          </div>
          <div className="mb-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{date1}</div>
            <div className={cn(
              "text-xs px-2 py-1 rounded inline-block font-medium",
              batch1.source === 'local'
                ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                : "bg-purple-500/20 text-purple-600 dark:text-purple-400"
            )}>
              {batch1.source.toUpperCase()}
            </div>
          </div>
          <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            {catchRate1}%
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {batch1.testCount} tests • {batch1.passLogs.length} passes
          </div>
        </div>

        {/* Batch 2 */}
        <div className="p-6 rounded-lg border-2 border-amber-500/30 bg-amber-500/5">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide mb-2">
            Batch 2 (Comparison)
          </div>
          <div className="mb-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{date2}</div>
            <div className={cn(
              "text-xs px-2 py-1 rounded inline-block font-medium",
              batch2.source === 'local'
                ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                : "bg-purple-500/20 text-purple-600 dark:text-purple-400"
            )}>
              {batch2.source.toUpperCase()}
            </div>
          </div>
          <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            {catchRate2}%
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {batch2.testCount} tests • {batch2.passLogs.length} passes
          </div>
        </div>
      </div>

      {/* Difference */}
      <div className={cn(
        "p-6 rounded-lg mb-6",
        diff > 0
          ? "bg-emerald-500/10 border border-emerald-500/20"
          : diff < 0
          ? "bg-red-500/10 border border-red-500/20"
          : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
      )}>
        <div className="text-center">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
            Catch Rate Difference
          </div>
          <div className={cn(
            "text-5xl font-bold mb-2",
            diff > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : diff < 0
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-600 dark:text-zinc-400"
          )}>
            {diff > 0 ? '+' : ''}{diff}%
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {diff > 0 && 'Batch 1 performed better'}
            {diff < 0 && 'Batch 2 performed better'}
            {diff === 0 && 'Both batches performed equally'}
          </div>
        </div>
      </div>

      {/* Pass-by-Pass Comparison */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Pass-by-Pass Comparison
        </h3>

        {/* Pass 1 */}
        {(pass1_1 || pass1_2) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                Pass 1: Unfiltered
              </div>
              {pass1_1 ? (
                <>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {pass1_1.summary.catchRate}%
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {pass1_1.summary.echoTotal} echoes
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">N/A</div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                Pass 1: Unfiltered
              </div>
              {pass1_2 ? (
                <>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {pass1_2.summary.catchRate}%
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {pass1_2.summary.echoTotal} echoes
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">N/A</div>
              )}
            </div>
          </div>
        )}

        {/* Pass 2 */}
        {(pass2_1 || pass2_2) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">
                Pass 2: Poison (No Protection)
              </div>
              {pass2_1 ? (
                <>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {pass2_1.summary.catchRate}%
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {pass2_1.summary.echoTotal} echoes
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">N/A</div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">
                Pass 2: Poison (No Protection)
              </div>
              {pass2_2 ? (
                <>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {pass2_2.summary.catchRate}%
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {pass2_2.summary.echoTotal} echoes
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">N/A</div>
              )}
            </div>
          </div>
        )}

        {/* Pass 3 */}
        {(pass3_1 || pass3_2) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                Pass 3: Protected
              </div>
              {pass3_1 ? (
                <>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {pass3_1.summary.catchRate}%
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {pass3_1.summary.echoTotal} echoes
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">N/A</div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
                Pass 3: Protected
              </div>
              {pass3_2 ? (
                <>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {pass3_2.summary.catchRate}%
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    {pass3_2.summary.echoTotal} echoes
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">N/A</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Key Insights */}
      <div className="mt-6 p-6 rounded-lg bg-violet-500/10 border border-violet-500/20">
        <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-100 mb-3">
          Key Insights
        </h3>
        <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li className="flex items-start gap-2">
            <span className="text-violet-600 dark:text-violet-400 shrink-0">•</span>
            <span>
              <strong>{batch1.source === 'local' ? 'Local' : 'Cloud'}</strong> models (Batch 1) achieved{' '}
              <strong>{catchRate1}%</strong> catch rate
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-600 dark:text-violet-400 shrink-0">•</span>
            <span>
              <strong>{batch2.source === 'local' ? 'Local' : 'Cloud'}</strong> models (Batch 2) achieved{' '}
              <strong>{catchRate2}%</strong> catch rate
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-600 dark:text-violet-400 shrink-0">•</span>
            <span>
              {diff > 0
                ? `Batch 1 outperformed Batch 2 by ${diff} percentage points`
                : diff < 0
                ? `Batch 2 outperformed Batch 1 by ${Math.abs(diff)} percentage points`
                : 'Both batches achieved the same catch rate'}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
