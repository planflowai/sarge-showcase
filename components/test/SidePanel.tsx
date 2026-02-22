'use client';

import { TestTheme as Theme, SessionStats, ForensicEvent } from '@/lib/types' // Test types;

interface SidePanelProps {
  theme: Theme;
  stats: SessionStats;
  events: ForensicEvent[];
}

export function SidePanel({ theme, stats, events }: SidePanelProps) {
  return (
    <div className={`w-64 border-l ${theme.borderSubtle} ${theme.bgSecondary} flex flex-col overflow-hidden`}>
      {/* Stats */}
      <div className={`p-3 border-b ${theme.borderSubtle}`}>
        <div className={`text-xs ${theme.textMuted} uppercase tracking-wider mb-2`}>Session Stats</div>
        <div className="grid grid-cols-2 gap-2">
          <div className={`${theme.bgTertiary} rounded-lg p-2 border ${theme.borderSubtle}`}>
            <div className={`text-[10px] ${theme.textMuted}`}>Tests</div>
            <div className={`text-xl font-bold ${theme.text}`}>{stats.testsRun}</div>
          </div>
          <div className={`${theme.bgTertiary} rounded-lg p-2 border ${theme.borderSubtle}`}>
            <div className={`text-[10px] ${theme.textMuted}`}>Catch Rate</div>
            <div className="text-xl font-bold text-emerald-400">{stats.catchRate}%</div>
          </div>
          <div className={`${theme.bgTertiary} rounded-lg p-2 border ${theme.borderSubtle}`}>
            <div className={`text-[10px] ${theme.textMuted}`}>Hallucinations</div>
            <div className="text-xl font-bold text-red-400">{stats.hallucinations}</div>
          </div>
          <div className={`${theme.bgTertiary} rounded-lg p-2 border ${theme.borderSubtle}`}>
            <div className={`text-[10px] ${theme.textMuted}`}>Echo Chambers</div>
            <div className="text-xl font-bold text-purple-400">{stats.echoChambers}</div>
          </div>
        </div>
        
        {/* Kill Confirmation */}
        {stats.poisonInjected > 0 && (
          <div className={`mt-3 p-2 rounded-lg border ${theme.borderSubtle} ${theme.bgTertiary}`}>
            <div className={`text-[10px] ${theme.textMuted} uppercase mb-1`}>Kill Confirmation</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">☠️</span>
                <span className={`text-sm ${theme.text}`}>{stats.poisonInjected} injected</span>
              </div>
              <span className="text-sm">→</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <span className="text-sm text-emerald-400 font-bold">{stats.poisonKilled} killed</span>
              </div>
            </div>
            {stats.avgKillRound > 0 && (
              <div className={`text-[10px] ${theme.textMuted} mt-1 text-center`}>
                Avg kill: Round {stats.avgKillRound.toFixed(1)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forensic Timeline */}
      <div className="flex-1 p-3 overflow-auto">
        <div className={`text-xs ${theme.textMuted} uppercase tracking-wider mb-2`}>Forensic Timeline</div>
        {events.length === 0 ? (
          <div className={`text-xs ${theme.textFaint} text-center py-4`}>
            Run a test to see events
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                  item.type === 'danger' ? 'bg-red-500/10 border-l-2 border-red-500' :
                  item.type === 'warning' ? 'bg-amber-500/10 border-l-2 border-amber-500' :
                  item.type === 'success' ? 'bg-emerald-500/10 border-l-2 border-emerald-500' :
                  `hover:${theme.bgTertiary}`
                }`}
              >
                <span className={`text-[10px] ${theme.textFaint} font-mono w-16`}>{item.timestamp}</span>
                <span>{item.icon}</span>
                <span className={`${
                  item.type === 'danger' ? 'text-red-400' :
                  item.type === 'warning' ? 'text-amber-400' :
                  item.type === 'success' ? 'text-emerald-400 font-bold' :
                  theme.textSecondary
                }`}>{item.event}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className={`p-3 border-t ${theme.borderSubtle}`}>
        <div className={`text-xs ${theme.textMuted} uppercase tracking-wider mb-2`}>Quick Actions</div>
        <div className="space-y-1">
          <button className={`w-full text-left px-2 py-2 rounded ${theme.bgTertiary} hover:bg-gray-200 dark:hover:bg-zinc-700/50 text-xs ${theme.textSecondary} flex items-center gap-2`}>
            📥 Export CSV
          </button>
          <button className={`w-full text-left px-2 py-2 rounded ${theme.bgTertiary} hover:bg-gray-200 dark:hover:bg-zinc-700/50 text-xs ${theme.textSecondary} flex items-center gap-2`}>
            📄 Export PDF Report
          </button>
        </div>
      </div>
    </div>
  );
}
