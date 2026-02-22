'use client';

import { useRef, useEffect } from 'react';
import type { TestTheme as Theme, BatchPassLog } from '@/lib/types';

// Map pass numbers to user-friendly labels
const PASS_LABELS: Record<string, { label: string; color: string }> = {
  '1': { label: 'Baseline', color: 'bg-zinc-500' },
  '2': { label: 'Poison', color: 'bg-orange-500' },
  '3': { label: 'Protected', color: 'bg-emerald-500' },
  '4': { label: 'Defense', color: 'bg-blue-500' },
};

// Extract pass number from event message
function getPassFromMessage(msg: string): string | null {
  const passMatch = msg.match(/Pass (\d)/);
  if (passMatch) return passMatch[1];
  if (msg.includes('Chaos') || msg.includes('CHAOS')) return 'C';
  if (msg.includes('ARMAGEDDON') || msg.includes('🔥')) return 'A';
  return null;
}

interface LiveFeedNarrativeProps {
  theme: Theme;
  passLogs: BatchPassLog[];
  isRunning: boolean;
  currentPass: number;
  events: { id: string; event: string; icon: string; type: string; timestamp: string }[];
  speedMode?: number;
}

export function LiveFeedNarrative({ theme, passLogs, isRunning, currentPass, events, speedMode }: LiveFeedNarrativeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  // Color mapping for event types
  const getEventColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'danger': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      default: return theme.textSecondary;
    }
  };

  return (
    <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg overflow-hidden flex flex-col`}>
      <div className={`px-4 py-2 border-b ${theme.border} flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${theme.text}`}>Live Progress</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-indigo-400">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              Running
            </span>
          )}
        </div>
        <span className={`text-xs ${theme.textMuted}`}>{events.length} events</span>
      </div>
      <div
        className="flex-1 overflow-auto p-3 space-y-0.5 font-mono text-[11px] leading-relaxed"
        style={{ maxHeight: '300px', minHeight: '150px' }}
      >
        {events.length === 0 && !isRunning ? (
          <p className={`text-sm ${theme.textMuted} text-center py-8`}>
            Start a batch test to see real-time progress here.
          </p>
        ) : (
          events.map((evt) => {
            const time = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const isHeader = evt.event.includes('━━━');
            const color = getEventColor(evt.type);

            // Get pass context for badge
            const passNum = getPassFromMessage(evt.event);
            const passInfo = passNum && PASS_LABELS[passNum];

            return (
              <div
                key={evt.id}
                className={`${color} ${isHeader ? 'font-bold mt-2 pt-1' : ''} flex items-start gap-1.5`}
              >
                <span className={`${theme.textMuted} shrink-0`}>[{time}]</span>
                {/* Pass badge for context */}
                {passInfo && (
                  <span className={`shrink-0 px-1 py-0.5 rounded text-[8px] font-bold text-white ${passInfo.color}`}>
                    {passInfo.label}
                  </span>
                )}
                {passNum === 'C' && (
                  <span className="shrink-0 px-1 py-0.5 rounded text-[8px] font-bold text-white bg-red-600">
                    Chaos
                  </span>
                )}
                {passNum === 'A' && (
                  <span className="shrink-0 px-1 py-0.5 rounded text-[8px] font-bold text-white bg-orange-700">
                    Armageddon
                  </span>
                )}
                <span className="shrink-0">{evt.icon}</span>
                <span className="flex-1">{evt.event}</span>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
