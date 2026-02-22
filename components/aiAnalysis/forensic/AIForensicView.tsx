"use client";

import { useAIAnalysisStore } from "@/lib/stores/aiAnalysisStore";

export function AIForensicView() {
  const aiForensic = useAIAnalysisStore((s) => s.aiForensic);
  const aiForensicSetCurrentView = useAIAnalysisStore((s) => s.aiForensicSetCurrentView);
  const aiForensicExportJSON = useAIAnalysisStore((s) => s.aiForensicExportJSON);
  const aiForensicClearAll = useAIAnalysisStore((s) => s.aiForensicClearAll);

  const views: Array<{ id: typeof aiForensic.currentView; label: string }> = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'investigation', label: 'Investigation' },
    { id: 'replay', label: 'Replay' },
    { id: 'export', label: 'Export' },
  ];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      {/* View Selector */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => aiForensicSetCurrentView(view.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                aiForensic.currentView === view.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {view.label}
            </button>
          ))}

          <div className="flex-1" />

          <button
            onClick={aiForensicExportJSON}
            disabled={aiForensic.entries.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export JSON
          </button>
          <button
            onClick={aiForensicClearAll}
            disabled={aiForensic.entries.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {aiForensic.entries.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                No Forensic Entries
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Forensic log entries will appear here as you run AI tests
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Total Sessions: {aiForensic.sessions.length}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {aiForensic.currentView === 'timeline' && 'Forensic Timeline'}
                    {aiForensic.currentView === 'investigation' && 'Investigation View'}
                    {aiForensic.currentView === 'replay' && 'Event Replay'}
                    {aiForensic.currentView === 'export' && 'Export Options'}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {aiForensic.entries.length} entries • {aiForensic.sessions.length} sessions
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  aiForensic.chainValid
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  Chain {aiForensic.chainValid ? 'Valid' : 'Invalid'}
                </div>
              </div>

              {/* Entries List */}
              <div className="space-y-2">
                {aiForensic.entries.slice(-10).reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          #{entry.sequenceNumber}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          entry.severity === 'critical' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                          entry.severity === 'warning' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                          entry.severity === 'success' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                          'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                        }`}>
                          {entry.severity}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {entry.category}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {entry.event}
                    </p>
                    {entry.input && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                        Input: {entry.input}
                      </p>
                    )}
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
