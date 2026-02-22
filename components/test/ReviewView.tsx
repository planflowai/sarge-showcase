'use client';

import { useState, useMemo, useCallback } from 'react';
import { TestTheme as Theme, SessionRecord, ForensicEvent } from '@/lib/types';
import { formatVerdict } from '@/lib/utils/plainEnglish';

interface ReviewViewProps {
  theme: Theme;
  sessions: SessionRecord[];
  events: ForensicEvent[];
}

function formatDateHeader(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - d.getTime();
  if (diff === 0) return "Today";
  if (diff === 86400000) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export function ReviewView({ theme, sessions, events }: ReviewViewProps) {
  const [selectedSession, setSelectedSession] = useState<string | null>(
    sessions.length > 0 ? sessions[0].id : null
  );

  const selected = sessions.find(s => s.id === selectedSession);

  // Group sessions by date
  const dateGroups = useMemo(() => {
    const groups = new Map<string, SessionRecord[]>();
    for (const s of sessions) {
      const key = formatDateHeader(s.timestamp);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return Array.from(groups.entries());
  }, [sessions]);

  const handleExportJSON = useCallback(() => {
    if (!selected) return;
    const data = {
      session: {
        id: selected.id,
        timestamp: selected.timestamp,
        prompt: selected.prompt,
        verdict: selected.verdict,
        catchRate: selected.catchRate,
        models: selected.models,
      },
      events: events.map(e => ({
        timestamp: e.timestamp,
        event: e.event,
        type: e.type,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarge-session-${selected.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, events]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Session List */}
      <div className={`w-72 border-r ${theme.borderSubtle} ${theme.bgSecondary} flex flex-col`}>
        <div className={`p-3 border-b ${theme.borderSubtle}`}>
          <h3 className={`text-sm font-bold ${theme.text}`}>Test History</h3>
          <p className={`text-xs ${theme.textMuted}`}>{sessions.length} sessions</p>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-3">
          {sessions.length === 0 ? (
            <div className={`text-center py-8 ${theme.textMuted} text-sm`}>
              No sessions yet.<br />Run a test to get started.
            </div>
          ) : (
            dateGroups.map(([dateLabel, dateSessions]) => (
              <div key={dateLabel}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted} px-1 mb-1`}>
                  {dateLabel}
                </div>
                <div className="space-y-1">
                  {dateSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedSession === session.id
                          ? 'bg-indigo-600 text-white'
                          : `${theme.bgTertiary} ${theme.text} hover:bg-gray-200 dark:hover:bg-zinc-700`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono">
                          {session.timestamp.toLocaleTimeString()}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          session.verdict === 'caught'
                            ? selectedSession === session.id ? 'bg-emerald-500/30' : 'bg-emerald-500/10 text-emerald-400'
                            : selectedSession === session.id ? 'bg-red-500/30' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {session.verdict === 'caught' ? '✅ Detected' : '❌ Missed'}
                        </span>
                      </div>
                      <div className={`text-sm truncate ${selectedSession === session.id ? 'text-white/90' : theme.textSecondary}`}>
                        {session.prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Session Detail */}
      <div className="flex-1 p-4 overflow-auto">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className={theme.textMuted}>Select a session to view details</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className={`text-lg font-bold ${theme.text}`}>Session Details</h2>
                <span className={`text-sm px-3 py-1 rounded-full ${
                  selected.verdict === 'caught'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {selected.verdict === 'caught' ? '✅ System Detected It' : '❌ System Missed It'}
                </span>
              </div>
              <div className={`text-sm ${theme.textSecondary} space-y-1`}>
                <p><strong>Time:</strong> {selected.timestamp.toLocaleString()}</p>
                <p><strong>Question:</strong> {selected.prompt}</p>
                <p><strong>Detection Rate:</strong> {selected.catchRate}%</p>
                <p className={`text-xs ${theme.textMuted} mt-2`}>
                  {formatVerdict(selected.verdict, 0)}
                </p>
              </div>
            </div>

            {/* Models Used */}
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3`}>Models Used</h3>
              <div className="grid grid-cols-4 gap-2">
                {(['d1', 'd2', 'd3', 'judge'] as const).map(role => (
                  <div key={role} className={`${theme.bgTertiary} rounded p-2 text-center`}>
                    <div className={`text-xs font-bold ${role === 'judge' ? 'text-amber-500' : theme.text}`}>
                      {role.toUpperCase()}
                    </div>
                    <div className={`text-xs ${theme.textMuted}`}>{selected.models[role]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Log */}
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3`}>Event Log</h3>
              <div className="space-y-1">
                {events.map((event, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                      event.type === 'danger' ? 'bg-red-500/10 border-l-2 border-red-500' :
                      event.type === 'warning' ? 'bg-amber-500/10 border-l-2 border-amber-500' :
                      event.type === 'success' ? 'bg-emerald-500/10 border-l-2 border-emerald-500' :
                      theme.bgTertiary
                    }`}
                  >
                    <span className={`text-xs ${theme.textFaint} font-mono w-20`}>{event.timestamp}</span>
                    <span>{event.icon}</span>
                    <span className={`${
                      event.type === 'danger' ? 'text-red-400' :
                      event.type === 'warning' ? 'text-amber-400' :
                      event.type === 'success' ? 'text-emerald-400 font-bold' :
                      theme.textSecondary
                    }`}>{event.event}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded font-medium`}
              >
                Export JSON
              </button>
              <button
                disabled
                className={`px-4 py-2 ${theme.bgTertiary} ${theme.textMuted} text-sm rounded border ${theme.border} opacity-50 cursor-not-allowed`}
                title="Coming soon"
              >
                Export PDF (Coming Soon)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
