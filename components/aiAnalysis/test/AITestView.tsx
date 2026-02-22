"use client";

import { useAIAnalysisStore } from "@/lib/stores/aiAnalysisStore";

export function AITestView() {
  const aiTest = useAIAnalysisStore((s) => s.aiTest);
  const aiTestSetMode = useAIAnalysisStore((s) => s.aiTestSetMode);
  const aiTestSetQuestion = useAIAnalysisStore((s) => s.aiTestSetQuestion);
  const aiTestSetPoison = useAIAnalysisStore((s) => s.aiTestSetPoison);
  const aiTestRunTest = useAIAnalysisStore((s) => s.aiTestRunTest);
  const aiTestClearResults = useAIAnalysisStore((s) => s.aiTestClearResults);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              AI Test Mode
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Test poison pill detection in an isolated environment
            </p>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Test Mode
            </label>
            <div className="flex gap-2">
              {(['unfiltered', 'pill', 'pill-prompt'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => aiTestSetMode(mode)}
                  disabled={aiTest.isRunning}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    aiTest.mode === mode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  {mode === 'unfiltered' ? 'Unfiltered' : mode === 'pill' ? 'Poison Pill' : 'Protected'}
                </button>
              ))}
            </div>
          </div>

          {/* Question Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Question
            </label>
            <textarea
              value={aiTest.question}
              onChange={(e) => aiTestSetQuestion(e.target.value)}
              disabled={aiTest.isRunning}
              placeholder="Enter your test question..."
              rows={3}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          {/* Poison Input (if pill mode) */}
          {(aiTest.mode === 'pill' || aiTest.mode === 'pill-prompt') && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Poison Text
              </label>
              <input
                type="text"
                value={aiTest.poison}
                onChange={(e) => aiTestSetPoison(e.target.value)}
                disabled={aiTest.isRunning}
                placeholder="Enter false claim to inject..."
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => aiTestRunTest()}
              disabled={aiTest.isRunning || !aiTest.question.trim()}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiTest.isRunning ? 'Running...' : 'Run Test'}
            </button>
            <button
              onClick={aiTestClearResults}
              disabled={aiTest.isRunning || aiTest.responses.length === 0}
              className="px-6 py-2 bg-zinc-600 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Results
            </button>
          </div>

          {/* Results */}
          {aiTest.responses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Test Results
              </h3>
              <div className="space-y-2">
                {aiTest.responses.map((response, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">
                        Round {response.round} - {response.role}
                      </span>
                      {response.status && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          response.status === 'clean' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                          response.status === 'echo' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                          'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        }`}>
                          {response.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">{response.content}</p>
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {response.tokens} tokens • {response.timeMs}ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
