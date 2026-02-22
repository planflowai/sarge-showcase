'use client';

import { useState, useMemo } from 'react';
import type { TestTheme as Theme, BatchPassLog, BatchTestResult } from '@/lib/types';
import { passDescription, translateStatus, buildTestNarrative } from '@/lib/utils/plainEnglish';
import { useForensicLogStore } from '@/lib/stores/forensicLogStore';

/** Highlight matched markers in text with red bold spans */
function HighlightedText({ text, markers }: { text: string; markers?: string[] }) {
  if (!markers || markers.length === 0) return <span>{text}</span>;
  const regex = new RegExp(`(${markers.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        markers.some(m => part.toLowerCase() === m.toLowerCase())
          ? <mark key={i} className="bg-red-500/30 text-red-300 font-bold px-0.5 rounded">{part}</mark>
          : part
      )}
    </span>
  );
}

interface LivePassColumnProps {
  theme: Theme;
  passName: string;
  passLabel: string;
  icon: string;
  mode: 'unfiltered' | 'pill' | 'pill-prompt' | 'defense' | 'chaos' | 'armageddon';
  passLog?: BatchPassLog;
  isActive: boolean;
  totalTests: number;
  currentTest: number;
  showSuccessBanner?: boolean;
}

// Short inline labels (1-line max) for non-experts
const PASS_SHORT_LABELS: Record<string, string> = {
  unfiltered: 'Testing normal answers (no lies)',
  pill: 'Injecting a lie to see if it spreads',
  'pill-prompt': 'Using safety instructions to block lies',
  defense: 'Final check — truth anchors + kill switch',
  chaos: 'Random multi-agent poison attacks',
  armageddon: 'Maximum stress — all defenses disabled',
};

// Detailed tooltips for hover
const PASS_TOOLTIPS: Record<string, string> = {
  unfiltered: 'Runs without any protection — establishes what the AI says normally',
  pill: 'Deliberately adds false information — tests if agents repeat it',
  'pill-prompt': 'Gives agents anti-lie instructions — tests if prompts stop the poison',
  defense: 'Uses locked true facts + kill switch — stops contradictions even if prompts fail',
  chaos: 'Multiple poisons, multiple agents, randomized timing — breaks everything',
  armageddon: 'Judge poisoned, recovery disabled, continuous attacks — designed to break the system',
};

// Explanatory text for each pass mode
const PASS_EXPLANATIONS: Record<string, { waiting: string; active: string; complete: string }> = {
  unfiltered: {
    waiting: 'Waiting to run baseline test without any protection to establish ground truth.',
    active: 'Running unprotected test to see how agents respond without safeguards.',
    complete: 'Baseline established. This shows natural agent behavior.',
  },
  pill: {
    waiting: 'Waiting to inject poison (false information) into the conversation.',
    active: 'Poison injected! Watching if agents echo the false claim or catch it.',
    complete: 'Poison test done. Check if lies spread or were caught.',
  },
  'pill-prompt': {
    waiting: 'Waiting to test with protection prompts active.',
    active: 'Protected mode active. Agents have anti-poison instructions.',
    complete: 'Protection test done. Compare catch rate to unprotected.',
  },
  defense: {
    waiting: 'Waiting to run defense pass with truth anchors.',
    active: 'Defense mode: Truth anchors lock verified facts. Kills trigger on contradictions.',
    complete: 'Defense complete. Check kills and recovery stats.',
  },
  chaos: {
    waiting: 'Waiting to run chaos mode with randomized poison injection.',
    active: 'Chaos mode active! Random agents receive poison at random rounds.',
    complete: 'Chaos test complete. Unpredictable injection patterns tested.',
  },
  armageddon: {
    waiting: 'Waiting to unleash ARMAGEDDON mode.',
    active: 'ARMAGEDDON: All agents poisoned! Maximum stress test in progress.',
    complete: 'ARMAGEDDON complete. Total system resilience tested.',
  },
};

export function LivePassColumn({
  theme,
  passName,
  passLabel,
  icon,
  mode,
  passLog,
  isActive,
  totalTests,
  currentTest,
  showSuccessBanner,
}: LivePassColumnProps) {

  const isComplete = !!passLog?.completedAt;
  const testsRun = passLog?.summary.completed ?? (isActive ? currentTest : 0);
  const total = totalTests;
  const echoCount = passLog?.summary.echoTotal ?? 0;
  const catchRate = passLog?.summary.catchRate ?? 0;
  const caughtCount = passLog?.summary.caughtTotal ?? 0;
  const kills = passLog?.summary.kills ?? 0;
  const recovered = passLog?.summary.recovered ?? 0;
  const progress = total > 0 ? (testsRun / total) * 100 : 0;

  // Get explanation based on state
  const explanation = PASS_EXPLANATIONS[mode] || PASS_EXPLANATIONS.unfiltered;
  const currentExplanation = isComplete ? explanation.complete : isActive ? explanation.active : explanation.waiting;

  const borderColor = isComplete
    ? 'border-emerald-500/40'
    : isActive
    ? 'border-amber-500/50 ring-2 ring-amber-500/30'
    : theme.border;

  return (
    <div className={`${theme.bgSecondary} border-2 ${borderColor} rounded-lg flex flex-col min-w-0 overflow-hidden`}>
      {/* Success Banner — only for Protected column with high catch rate */}
      {showSuccessBanner && (
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-2 text-center">
          <div className="text-white font-black text-sm flex items-center justify-center gap-1.5">
            <span className="text-lg">✓</span>
            <span>Poison Neutralized</span>
          </div>
          <div className="text-emerald-100 text-[11px] font-bold">
            {caughtCount}/{testsRun} threats ({Math.round(catchRate)}%)
          </div>
          <button
            onClick={() => {
              useForensicLogStore.getState().openForensicLog();
            }}
            className="mt-1.5 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold text-white transition-colors"
          >
            View Proof →
          </button>
        </div>
      )}

      {/* Header - Compact */}
      <div className="p-2 shrink-0">
        <div className="flex items-center justify-between mb-1 group/title relative">
          <span className={`text-sm font-black cursor-help ${
            isComplete ? 'text-emerald-600 dark:text-emerald-400' : isActive ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-800 dark:text-zinc-200'
          }`}>
            {icon} {passLabel}
          </span>
          {/* Hover tooltip for pass title */}
          <div className="absolute left-0 top-full mt-1 px-2 py-1.5 bg-zinc-900 text-[10px] text-zinc-200 rounded-lg opacity-0 group-hover/title:opacity-100 transition-opacity pointer-events-none border border-zinc-700 z-20 shadow-xl whitespace-nowrap">
            {PASS_TOOLTIPS[mode] || 'Testing in progress...'}
          </div>
          {/* Status Badge */}
          {isComplete && !showSuccessBanner ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-bold">
              ✓ Done
            </span>
          ) : isActive ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-[9px] font-bold">
              <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span> Running
            </span>
          ) : !isComplete && !isActive && testsRun === 0 ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-full text-[9px] font-bold">
              Waiting
            </span>
          ) : null}
        </div>

        {/* Short inline label - bold 1-liner for non-experts */}
        <p className={`text-[10px] font-bold mb-1 ${
          isActive ? 'text-amber-600 dark:text-amber-400' : isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
        }`}>
          {PASS_SHORT_LABELS[mode] || 'Testing...'}
        </p>

        {/* Progress bar - thinner */}
        <div className={`h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-2`}>
          <div
            className={`h-full transition-all duration-300 ${
              isComplete ? 'bg-emerald-500' : isActive ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats - Compact grid */}
        {mode === 'unfiltered' ? (
          /* Baseline: 2x2 grid to match defense height */
          <div className="grid grid-cols-2 gap-1">
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
              <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400">📊 Tests</span>
              <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">{testsRun}/{total}</span>
            </div>
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
              <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400">✓ Done</span>
              <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">{Math.round(progress)}%</span>
            </div>
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
              <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-500">—</span>
              <span className="text-lg font-black text-zinc-500 dark:text-zinc-500">—</span>
            </div>
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
              <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-500">—</span>
              <span className="text-lg font-black text-zinc-500 dark:text-zinc-500">—</span>
            </div>
          </div>
        ) : mode === 'defense' ? (
          /* Defense pass: 2x2 compact grid with Kills/Recovered */
          <div className="grid grid-cols-2 gap-1">
            {/* Top Left: Lie Spread */}
            <div className={`flex flex-col items-center px-1.5 py-1.5 rounded ${echoCount > 0 ? 'bg-orange-100 dark:bg-orange-500/20 ring-1 ring-orange-400/50' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              <span className={`text-[9px] font-bold uppercase ${echoCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-500'}`}>⚠️ Spread</span>
              <span className={`text-lg font-black ${echoCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400'}`}>
                {echoCount}
              </span>
            </div>
            {/* Top Right: Judge Caught */}
            <div className={`flex flex-col items-center px-1.5 py-1.5 rounded ${caughtCount > 0 ? 'bg-emerald-100 dark:bg-emerald-500/20 ring-1 ring-emerald-400/50' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              <span className={`text-[9px] font-bold uppercase ${caughtCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>✅ Caught</span>
              <span className={`text-lg font-black ${caughtCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                {caughtCount}/{testsRun || 0}
              </span>
            </div>
            {/* Bottom Left: Kills */}
            <div className={`flex flex-col items-center px-1.5 py-2 rounded ${kills > 0 ? 'bg-gradient-to-br from-red-100 to-red-50 dark:from-red-500/30 dark:to-red-500/10 ring-1 ring-red-400/60' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              <span className={`text-[9px] font-bold uppercase ${kills > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>🗡️ Kills</span>
              <span className={`text-xl font-black ${kills > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}>
                {kills}
              </span>
            </div>
            {/* Bottom Right: Recovered */}
            <div className={`flex flex-col items-center px-1.5 py-2 rounded ${recovered > 0 ? 'bg-gradient-to-br from-cyan-100 to-blue-50 dark:from-cyan-500/30 dark:to-blue-500/10 ring-1 ring-cyan-400/60' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              <span className={`text-[9px] font-bold uppercase ${recovered > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-zinc-500'}`}>🔄 Recov</span>
              <span className={`text-xl font-black ${recovered > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-zinc-400'}`}>
                {recovered}
              </span>
            </div>
          </div>
        ) : (
          /* Poison/Protected: 2x2 compact grid */
          <div className="grid grid-cols-2 gap-1">
            {/* Top Left: Lie Spread */}
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-orange-100 dark:bg-orange-500/15">
              <span className="text-[9px] font-bold text-orange-700 dark:text-orange-400">⚠️ Spread</span>
              <span className={`text-lg font-black ${echoCount > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-zinc-500 dark:text-zinc-500'}`}>
                {echoCount}
              </span>
            </div>
            {/* Top Right: Judge Caught */}
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-emerald-100 dark:bg-emerald-500/15">
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">✅ Caught</span>
              <span className={`text-lg font-black ${
                catchRate >= 80 ? 'text-emerald-700 dark:text-emerald-400' : catchRate >= 50 ? 'text-amber-700 dark:text-amber-400' : caughtCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-500'
              }`}>
                {caughtCount}/{testsRun || 0}
              </span>
            </div>
            {/* Bottom Left: Catch Rate */}
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-indigo-100 dark:bg-indigo-500/15">
              <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-400">📈 Rate</span>
              <span className={`text-lg font-black ${
                catchRate >= 80 ? 'text-emerald-700 dark:text-emerald-400' : catchRate >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-500'
              }`}>
                {Math.round(catchRate)}%
              </span>
            </div>
            {/* Bottom Right: Tests */}
            <div className="flex flex-col items-center px-1.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
              <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400">📊 Tests</span>
              <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">{testsRun}/{total}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
