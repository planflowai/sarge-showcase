"use client";

import { useAIAnalysisStore } from "@/lib/stores/aiAnalysisStore";

export function AIBatchView() {
  const aiBatch = useAIAnalysisStore((s) => s.aiBatch);
  const aiBatchRunBatch = useAIAnalysisStore((s) => s.aiBatchRunBatch);
  const aiBatchStopBatch = useAIAnalysisStore((s) => s.aiBatchStopBatch);
  const aiBatchPauseBatch = useAIAnalysisStore((s) => s.aiBatchPauseBatch);
  const aiBatchResumeBatch = useAIAnalysisStore((s) => s.aiBatchResumeBatch);
  const aiBatchSetSpeedMode = useAIAnalysisStore((s) => s.aiBatchSetSpeedMode);

  const handleStart = (testCount: number, source: 'local' | 'cloud') => {
    aiBatchRunBatch(source, testCount);
  };

  const progressPct = aiBatch.batchTotalTests > 0
    ? Math.round((aiBatch.batchCurrentTest / aiBatch.batchTotalTests) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      {/* Control Bar */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Speed Mode */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-400 mr-2">Speed:</span>
            {[1, 2, 3].map((speed) => (
              <button
                key={speed}
                onClick={() => aiBatchSetSpeedMode(speed as 1 | 2 | 3)}
                disabled={aiBatch.batchRunning}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                  aiBatch.speedMode === speed
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700" />

          {/* Quick Run Buttons */}
          {!aiBatch.batchRunning ? (
            <>
              <button
                onClick={() => handleStart(1, 'local')}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-xs font-medium text-white"
              >
                ▶ 1 Local
              </button>
              <button
                onClick={() => handleStart(5, 'local')}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-xs font-medium text-white"
              >
                ▶ 5 Local
              </button>
              <button
                onClick={() => handleStart(10, 'cloud')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium text-white"
              >
                ▶ 10 Cloud
              </button>
            </>
          ) : (
            <>
              <button
                onClick={aiBatch.batchPaused ? aiBatchResumeBatch : aiBatchPauseBatch}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  aiBatch.batchPaused
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {aiBatch.batchPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={aiBatchStopBatch}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium text-white"
              >
                ⏹ Stop
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* Progress */}
          {aiBatch.batchRunning && (
            <div className="flex items-center gap-2 min-w-[200px]">
              <div className="flex-1 h-2 bg-zinc-300 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                Pass {aiBatch.batchCurrentPass}/3 • {aiBatch.batchCurrentTest}/{aiBatch.batchTotalTests}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {!aiBatch.batchRunning && aiBatch.batchPassLogs.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                No Batch Tests Running
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Click a quick run button above to start batch testing
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  Batch Progress
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {aiBatch.batchActivity || 'Running batch tests...'}
                </p>
              </div>

              {/* Pass Logs */}
              {aiBatch.batchPassLogs.length > 0 && (
                <div className="space-y-3">
                  {aiBatch.batchPassLogs.map((passLog, idx) => (
                    <div
                      key={`${passLog.pass}-${passLog.startedAt || idx}`}
                      className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {passLog.pass}
                        </span>
                        {passLog.completedAt && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Complete
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Tests:</span>
                          <span className="ml-1 font-medium text-zinc-900 dark:text-zinc-100">
                            {passLog.summary.completed}/{passLog.summary.totalTests}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Catch Rate:</span>
                          <span className="ml-1 font-medium text-zinc-900 dark:text-zinc-100">
                            {passLog.summary.catchRate}%
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Echoes:</span>
                          <span className="ml-1 font-medium text-zinc-900 dark:text-zinc-100">
                            {passLog.summary.echoTotal}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Caught:</span>
                          <span className="ml-1 font-medium text-zinc-900 dark:text-zinc-100">
                            {passLog.summary.caughtTotal}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
