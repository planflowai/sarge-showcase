"use client";

import { useAIAnalysisStore } from "@/lib/stores/aiAnalysisStore";

export function AIDebateView() {
  const aiDebate = useAIAnalysisStore((s) => s.aiDebate);
  const aiDebateOpenSetup = useAIAnalysisStore((s) => s.aiDebateOpenSetup);
  const aiDebateStart = useAIAnalysisStore((s) => s.aiDebateStart);
  const aiDebateRunRound = useAIAnalysisStore((s) => s.aiDebateRunRound);
  const aiDebateEnd = useAIAnalysisStore((s) => s.aiDebateEnd);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-white dark:bg-zinc-950 p-8">
      <div className="text-center max-w-2xl">
        <div className="text-6xl mb-6">⚔️</div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          AI Debate Arena
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Multi-agent debate system with isolated state. Configure agents, run debates, and analyze results completely separate from the main application.
        </p>

        {!aiDebate.debate ? (
          <button
            onClick={aiDebateOpenSetup}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Start New Debate
          </button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Debate Active: Round {aiDebate.debate.currentRound} of {aiDebate.debate.rounds}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Status: {aiDebate.debate.status}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => aiDebateRunRound()}
                disabled={aiDebate.isRunning || aiDebate.debate.status === 'completed'}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run Round
              </button>
              <button
                onClick={aiDebateEnd}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                End Debate
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            🔒 Isolated State: This debate runs in the AI Analysis sandbox and won't affect your main conversations.
          </p>
        </div>
      </div>
    </div>
  );
}
