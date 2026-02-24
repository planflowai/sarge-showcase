"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { BatchHistoryEntry } from "@/lib/stores/testModeStore";
import { cn } from "@/lib/utils";

interface LifecyclePanelProps {
  batch: BatchHistoryEntry;
}

export function LifecyclePanel({ batch }: LifecyclePanelProps) {
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());

  // Get the best pass for timeline display - prefer pass3, then pass4, then any with tests
  const mainPass = batch.passLogs.find(p => p.pass === 'pass3-pill-prompt')
    || batch.passLogs.find(p => p.pass === 'pass4-defense')
    || batch.passLogs.find(p => p.pass === 'pass2-pill')
    || batch.passLogs.find(p => p.tests.length > 0)
    || batch.passLogs[0];

  if (!mainPass || mainPass.tests.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          C. LIFECYCLE TIMELINE
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No test lifecycle data available
        </p>
      </div>
    );
  }

  // Alias for easier reading below
  const pass3 = mainPass;

  const toggleTest = (testIndex: number) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(testIndex)) {
        next.delete(testIndex);
      } else {
        next.add(testIndex);
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          C. LIFECYCLE TIMELINE
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Complete story of each test from start to finish
        </p>
      </div>

      {/* Content */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {pass3.tests.map((test, testIdx) => {
          const isExpanded = expandedTests.has(testIdx);
          const judgeVerdict = test.judgeResponse?.verdict;
          const wasCaught = judgeVerdict === 'caught';

          return (
            <div key={testIdx}>
              {/* Test Header (Collapsible) */}
              <button
                onClick={() => toggleTest(testIdx)}
                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left"
              >
                {/* Expand Icon */}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                )}

                {/* Test Number & Verdict */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Test #{testIdx + 1}
                    </span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-medium",
                      wasCaught
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/20 text-red-600 dark:text-red-400"
                    )}>
                      {wasCaught ? '✅ CAUGHT' : '❌ MISSED'}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {test.question}
                  </p>
                </div>

                {/* Quick Stats */}
                <div className="text-right text-xs text-zinc-500 dark:text-zinc-500">
                  <div>{test.echoCount} echoes</div>
                  <div>{test.rounds} rounds</div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-6 pb-6 bg-zinc-50 dark:bg-zinc-900/30">
                  {/* Poison Info */}
                  <div className="p-4 mb-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase tracking-wide mb-2">
                      ☠️ Poison Pill (False Claim)
                    </div>
                    <p className="text-sm text-zinc-900 dark:text-zinc-100 font-medium mb-2">
                      "{test.poison}"
                    </p>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Injection: Round {test.poisonRound ?? 'N/A'} via{' '}
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {test.poisonAgent?.toUpperCase() ?? 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Round-by-Round Timeline */}
                  <div className="space-y-4">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide font-semibold">
                      Timeline
                    </div>

                    {Array.from({ length: test.rounds ?? 0 }, (_, roundIdx) => {
                      const round = roundIdx + 1;
                      const isPoisonRound = round === test.poisonRound;

                      // Get responses for this round
                      const roundResponses = (test.responses ?? []).filter(r => r.round === round);
                      const d1 = roundResponses.find(r => r.agent === 'd1');
                      const d2 = roundResponses.find(r => r.agent === 'd2');
                      const d3 = roundResponses.find(r => r.agent === 'd3');

                      return (
                        <div
                          key={round}
                          className={cn(
                            "pl-4 border-l-2 pb-4",
                            isPoisonRound
                              ? "border-red-500"
                              : "border-zinc-300 dark:border-zinc-700"
                          )}
                        >
                          {/* Round Header */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                              isPoisonRound
                                ? "bg-red-500 text-white"
                                : "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                            )}>
                              {round}
                            </div>
                            <span className={cn(
                              "text-sm font-semibold",
                              isPoisonRound
                                ? "text-red-600 dark:text-red-400"
                                : "text-zinc-700 dark:text-zinc-300"
                            )}>
                              Round {round}
                              {isPoisonRound && ' 💉 POISON INJECTED'}
                            </span>
                          </div>

                          {/* Agent Responses */}
                          <div className="ml-8 space-y-2">
                            {/* D1 */}
                            {d1 && (
                              <AgentResponse
                                agent="D1"
                                role="Worker"
                                response={d1}
                                isPoisonInjector={isPoisonRound && test.poisonAgent === 'd1'}
                              />
                            )}

                            {/* D2 */}
                            {d2 && (
                              <AgentResponse
                                agent="D2"
                                role="Cross-Verifier"
                                response={d2}
                                isPoisonInjector={isPoisonRound && test.poisonAgent === 'd2'}
                              />
                            )}

                            {/* D3 */}
                            {d3 && (
                              <AgentResponse
                                agent="D3"
                                role="Forensic Auditor"
                                response={d3}
                                isPoisonInjector={false}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Judge Verdict */}
                    <div className="pl-4 border-l-2 border-zinc-300 dark:border-zinc-700">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-violet-500 text-white">
                          ⚖️
                        </div>
                        <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                          Final Judgment
                        </span>
                      </div>
                      <div className="ml-8">
                        <div className={cn(
                          "p-3 rounded-lg",
                          wasCaught
                            ? "bg-emerald-500/10 border border-emerald-500/20"
                            : "bg-red-500/10 border border-red-500/20"
                        )}>
                          <div className="text-xs font-semibold mb-1">
                            <span className={wasCaught ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                              VERDICT: {wasCaught ? 'CAUGHT ✅' : 'MISSED ❌'}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">
                            {test.judgeResponse?.content?.slice(0, 200) ?? ''}
                            {(test.judgeResponse?.content?.length ?? 0) > 200 && '...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Kill Mechanism Analysis */}
                  {(test.killRound ?? 0) > 0 && (
                    <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-2">
                        🗡️ Kill Mechanism
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        Poison was caught in Round {test.killRound} by{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {test.killAgent?.toUpperCase() ?? 'Unknown'}
                        </span>
                        . The protective prompt enabled this agent to detect the false claim and flag it correctly.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper component for individual agent responses
function AgentResponse({
  agent,
  role,
  response,
  isPoisonInjector,
}: {
  agent: string;
  role: string;
  response: any;
  isPoisonInjector: boolean;
}) {
  const isEchoed = response.status === 'echo';
  const isFlagged = response.status === 'flagged';
  const isClean = response.status === 'clean';

  return (
    <div className={cn(
      "p-3 rounded-lg text-sm",
      isPoisonInjector
        ? "bg-red-500/15 border border-red-500/30"
        : isEchoed
        ? "bg-amber-500/10 border border-amber-500/20"
        : isFlagged
        ? "bg-emerald-500/10 border border-emerald-500/20"
        : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {agent}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          ({role})
        </span>
        {isPoisonInjector && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white font-semibold">
            💉 INJECTING
          </span>
        )}
        {isEchoed && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500 text-white font-semibold">
            ⚠️ ECHOED
          </span>
        )}
        {isFlagged && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500 text-white font-semibold">
            🔍 FLAGGED
          </span>
        )}
      </div>
      <p className="text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed">
        {response.content.slice(0, 150)}
        {response.content.length > 150 && '...'}
      </p>
      {response.echoExcerpt && (
        <div className="mt-2 p-2 rounded bg-amber-500/20 text-xs text-amber-900 dark:text-amber-100">
          <span className="font-semibold">Repeated: </span>
          "{response.echoExcerpt}"
        </div>
      )}
    </div>
  );
}
