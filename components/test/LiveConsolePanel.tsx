import { useRef, useState, useEffect } from 'react';
import type { EnhancedForensicEvent, TestTheme as Theme, BatchPassLog, ForensicEvent } from '@/lib/types';
import { ChevronDown, ChevronRight, Copy, Check, Download, GitCompare } from 'lucide-react';

interface BatchHistoryEntry {
  batchId: string;
  savedAt: string;
  source: 'local' | 'cloud';
  testCount: number;
  passLogs: BatchPassLog[];
  events: ForensicEvent[];
}

interface LiveConsolePanelProps {
  events: EnhancedForensicEvent[];
  isRunning: boolean;
  theme: Theme;
  passLogs?: BatchPassLog[];
  batchHistory?: BatchHistoryEntry[];
  currentBatchId?: string;
}

export function LiveConsolePanel({ events, isRunning, theme, passLogs = [], batchHistory = [], currentBatchId }: LiveConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'echoes' | 'kills' | 'judge'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // Get comparable runs (exclude current)
  const comparableRuns = batchHistory.filter(h => h.batchId !== currentBatchId);
  const compareRun = compareRunId ? batchHistory.find(h => h.batchId === compareRunId) : null;

  const handleCopy = () => {
    const text = events.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `[${time}] ${e.icon} ${e.message || e.event}`;
    }).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      eventCount: events.length,
      events: events.map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        icon: e.icon,
        message: e.message || e.event,
        details: e.details,
      })),
      passSummaries: passLogs.map(p => ({
        pass: p.pass,
        mode: p.mode,
        summary: p.summary,
        passHash: p.passHash,
        modelSeed: p.modelSeed,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarge-forensic-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    // CSV Headers
    const headers = [
      'Timestamp',
      'Type',
      'Message',
      'Model',
      'Agent',
      'Round',
      'Tokens',
      'Time (ms)',
      'Status',
      'Verdict',
      'Confidence',
      'Trigger Phrase',
      'Matched Markers',
    ];

    // Build rows
    const rows = events.map(e => {
      const d = e.details || {};
      return [
        e.timestamp,
        e.type,
        `"${(e.message || e.event || '').replace(/"/g, '""')}"`, // Escape quotes
        d.model || '',
        d.agent || '',
        d.round || '',
        d.tokens || '',
        d.timeMs || '',
        d.status || '',
        d.verdict || '',
        d.judgeConfidence || '',
        d.triggerPhrase ? `"${d.triggerPhrase.replace(/"/g, '""')}"` : '',
        d.matchedMarkers ? `"${d.matchedMarkers.join(', ')}"` : '',
      ].join(',');
    });

    // Add pass summary section
    const passRows = [
      '',
      'PASS SUMMARIES',
      'Pass,Mode,Tests,Echoes,Caught,Catch Rate,Kills,Hash',
      ...passLogs.map(p => [
        p.pass,
        p.mode,
        `${p.summary.completed}/${p.summary.totalTests}`,
        p.summary.echoTotal,
        p.summary.caughtTotal,
        `${p.summary.catchRate?.toFixed(0) || 0}%`,
        p.summary.kills || 0,
        p.passHash || '',
      ].join(',')),
    ];

    const csvContent = [headers.join(','), ...rows, ...passRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarge-forensic-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter events
  const filteredEvents = events.filter(e => {
    const msg = (e.message || e.event || '').toLowerCase();

    // Search filter
    if (searchTerm && !msg.includes(searchTerm.toLowerCase())) return false;

    // Type filter
    if (filter === 'echoes' && !msg.includes('echo')) return false;
    if (filter === 'kills' && !msg.includes('kill')) return false;
    if (filter === 'judge' && !msg.includes('judge')) return false;

    return true;
  });

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  // Calculate live stats including run time
  const runTime = (() => {
    if (events.length < 2) return null;
    const firstEvent = new Date(events[0].timestamp).getTime();
    const lastEvent = new Date(events[events.length - 1].timestamp).getTime();
    const durationMs = lastEvent - firstEvent;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSecs}s` : `${seconds}s`;
  })();

  const liveStats = {
    totalEvents: events.length,
    echoes: events.filter(e => (e.message || e.event || '').toLowerCase().includes('echo')).length,
    kills: events.filter(e => (e.message || e.event || '').toLowerCase().includes('kill')).length,
    judgeCalls: events.filter(e => (e.message || e.event || '').toLowerCase().includes('judge')).length,
    runTime,
  };

  return (
    <div className={`flex flex-col border-t ${theme.border} min-h-[400px] flex-1`}>
      {/* Header with controls */}
      <div className={`shrink-0 px-4 py-2 ${theme.bgSecondary} border-b ${theme.border}`}>
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${theme.text}`}>📋 Forensic Live Feed</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-indigo-400">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                Streaming
              </span>
            )}
          </div>

          {/* Live stats badges - centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 text-xs font-semibold">
            {liveStats.runTime && (
              <span className="px-2.5 py-1 rounded-md bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                ⏱ {liveStats.runTime}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-600">
              {liveStats.totalEvents} Events
            </span>
            <span className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              {liveStats.echoes} Echoes
            </span>
            <span className="px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700">
              {liveStats.kills} Kills
            </span>
            <span className="px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
              {liveStats.judgeCalls} Judge
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 w-36 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none"
            />

            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200"
            >
              <option value="all">All</option>
              <option value="echoes">Echoes</option>
              <option value="kills">Kills</option>
              <option value="judge">Judge</option>
            </select>

            {/* Copy */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200 transition-colors border border-gray-300 dark:border-zinc-600"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {/* Export JSON */}
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors"
            >
              <Download size={12} />
              JSON
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-500 dark:hover:bg-emerald-600 text-white transition-colors"
            >
              <Download size={12} />
              CSV
            </button>

            {/* Compare toggle */}
            {comparableRuns.length > 0 && (
              <button
                onClick={() => setShowCompare(!showCompare)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
                  showCompare ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-600'
                }`}
              >
                <GitCompare size={12} />
                Compare
              </button>
            )}
          </div>
        </div>

        {/* Run Comparison Selector */}
        {showCompare && comparableRuns.length > 0 && (
          <div className={`flex items-center gap-3 mt-2 pt-2 border-t ${theme.border}`}>
            <span className={`text-xs font-medium ${theme.textSecondary}`}>Compare with:</span>
            <select
              value={compareRunId || ''}
              onChange={(e) => setCompareRunId(e.target.value || null)}
              className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 flex-1 max-w-xs"
            >
              <option value="">Select a previous run...</option>
              {comparableRuns.map(run => {
                const date = new Date(run.savedAt);
                const label = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${run.testCount} tests (${run.source})`;
                return (
                  <option key={run.batchId} value={run.batchId}>{label}</option>
                );
              })}
            </select>
            {compareRun && <RunComparisonBadge current={passLogs} compare={compareRun.passLogs} events={events} compareEvents={compareRun.events} />}
          </div>
        )}
      </div>

      {/* Console Content */}
      <div ref={scrollRef} className={`flex-1 overflow-auto ${theme.bg} p-3 font-mono text-sm space-y-1`}>
        {filteredEvents.length === 0 ? (
          <div className={`text-zinc-500 dark:text-zinc-400 font-medium text-center py-8`}>
            {events.length === 0 ? 'No events yet. Start a batch to see live feed...' : 'No matches for filter.'}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <ForensicEventLine key={event.id} event={event} theme={theme} />
          ))
        )}
      </div>

      {/* Pass Summaries - Centered with clear badges */}
      {passLogs.length > 0 && (
        <div className={`shrink-0 border-t ${theme.border} px-4 py-3`}>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wide`}>Passes:</span>
            {passLogs.map((log, index) => (
              <PassSummaryCard
                key={`${index}-${log.pass}-${log.summary.completed}`}
                log={log}
                theme={theme}
                previousLog={index > 0 ? passLogs[index - 1] : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Pass labels and colors
const PASS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  '1': { label: 'Baseline', color: 'text-zinc-400', bg: 'bg-zinc-600' },
  '2': { label: 'Poison', color: 'text-orange-400', bg: 'bg-orange-600' },
  '3': { label: 'Protected', color: 'text-emerald-400', bg: 'bg-emerald-600' },
  '4': { label: 'Defense', color: 'text-blue-400', bg: 'bg-blue-600' },
  'C': { label: 'Chaos', color: 'text-red-400', bg: 'bg-red-600' },
  'A': { label: 'Armageddon', color: 'text-orange-500', bg: 'bg-orange-700' },
};

// Extract pass number from message
function getPassFromMessage(msg: string): string | null {
  const passMatch = msg.match(/Pass (\d)/);
  if (passMatch) return passMatch[1];
  if (msg.includes('Chaos') || msg.includes('CHAOS')) return 'C';
  if (msg.includes('ARMAGEDDON') || msg.includes('🔥')) return 'A';
  return null;
}

// Status color mapping
function getStatusColor(status: string): { text: string; bg: string } {
  switch (status.toLowerCase()) {
    case 'clean': return { text: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    case 'echoed':
    case 'echo': return { text: 'text-red-400', bg: 'bg-red-500/20' };
    case 'flagged':
    case 'kill': return { text: 'text-red-500', bg: 'bg-red-600/30' };
    case 'suspect': return { text: 'text-amber-400', bg: 'bg-amber-500/20' };
    default: return { text: 'text-zinc-400', bg: 'bg-zinc-500/20' };
  }
}

interface ForensicEventLineProps {
  event: EnhancedForensicEvent;
  theme: Theme;
}

function ForensicEventLine({ event, theme }: ForensicEventLineProps) {
  const [expanded, setExpanded] = useState(false);
  const msg = event.message || event.event || '';

  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Detect special event types
  const isDebateFlow = msg.includes('DEBATE FLOW') || msg.includes('R1 D1') || msg.includes('R2 D1');
  const isEchoTracking = msg.includes('ECHO TRACKING') || msg.includes('Echo ');
  const isKillTracking = msg.includes('KILL') || msg.includes('🛑');
  const isJudge = msg.includes('Judge') || msg.includes('⚖️');
  const isHeader = msg.includes('━━━');
  const isPassHeader = isHeader && (msg.includes('PASS 1') || msg.includes('PASS 2') || msg.includes('PASS 3') || msg.includes('PASS 4') || msg.includes('CHAOS') || msg.includes('ARMAGEDDON'));
  const isPassHash = msg.includes('HASH:') || msg.includes('🔐');

  // Get pass context
  const passNum = getPassFromMessage(msg);
  const passInfo = passNum ? PASS_LABELS[passNum] : null;

  // Color based on event type - use theme.text for neutral to be visible in light/dark
  const colorClass = {
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    neutral: theme.text
  }[event.type] || theme.text;

  // Check if expandable (has details or is a response line)
  const hasDetails = event.details && (event.details.response || event.details.question || event.details.judgeReasoning);
  const isExpandable = hasDetails || event.expandable;

  // Extract snippet and full text for debate flow lines
  const snippetMatch = msg.match(/"([^"]{1,150})\.\.\.?"/);
  const hasFullText = event.details?.response && event.details.response.length > 150;

  return (
    <div className={`group ${isHeader ? 'mt-3 pt-2 border-t border-gray-300 dark:border-zinc-700' : ''} ${isKillTracking ? 'bg-red-500/10 border-l-2 border-red-500 pl-2 py-1 -ml-2' : ''} ${isEchoTracking ? 'bg-amber-500/10 border-l-2 border-amber-500 pl-2 py-0.5 -ml-2' : ''}`}>
      {/* Special rendering for Pass Headers - cleaner, no emoji icons */}
      {isPassHeader ? (
        <div className="flex items-center gap-2 py-1">
          <span className={`${theme.textSecondary} shrink-0 text-[11px] font-mono`}>[{time}]</span>
          <span className={`flex-1 font-bold text-sm tracking-wide ${
            msg.includes('PASS 1') || msg.includes('BASELINE') ? 'text-gray-700 dark:text-zinc-300' :
            msg.includes('PASS 2') || msg.includes('POISON') ? 'text-orange-600 dark:text-orange-400' :
            msg.includes('PASS 3') || msg.includes('PROTECTED') ? 'text-emerald-600 dark:text-emerald-400' :
            msg.includes('PASS 4') || msg.includes('DEFENSE') ? 'text-blue-600 dark:text-blue-400' :
            msg.includes('CHAOS') ? 'text-red-600 dark:text-red-400' :
            msg.includes('ARMAGEDDON') ? 'text-orange-700 dark:text-orange-500' :
            colorClass
          }`}>
            {msg}
          </span>
        </div>
      ) : (
      <div className="flex items-start gap-2">
        {/* Timestamp */}
        <span className={`${theme.textSecondary} shrink-0 text-[11px] font-mono`}>[{time}]</span>

        {/* Pass badge */}
        {passInfo && (
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${passInfo.bg}`}>
            {passInfo.label}
          </span>
        )}

        {/* Icon */}
        <span className="shrink-0 text-base">{event.icon}</span>

        {/* Message */}
        <span className={`flex-1 ${colorClass} ${isHeader ? 'font-bold' : ''} ${isPassHash ? 'font-mono text-[10px] text-cyan-600 dark:text-cyan-400' : ''}`}>
          {msg}
        </span>

        {/* Expand button */}
        {isExpandable && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 p-0.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Inline metrics if available */}
        {event.details?.tokens && (
          <span className={`shrink-0 text-[9px] ${theme.textSecondary} font-mono`}>
            {event.details.tokens}tok
          </span>
        )}
        {event.details?.timeMs && (
          <span className={`shrink-0 text-[9px] ${theme.textSecondary} font-mono`}>
            {(event.details.timeMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      )}

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="ml-8 mt-2 space-y-2 text-xs border-l-2 border-zinc-700 pl-3 pb-2">
          {/* Full Question */}
          {event.details?.question && (
            <div className={`${theme.bgTertiary} rounded p-2`}>
              <div className={`text-[10px] font-bold ${theme.textSecondary} uppercase mb-1`}>Question</div>
              <div className={theme.text}>{event.details.question}</div>
            </div>
          )}

          {/* Full Response - scrollable if long */}
          {event.details?.response && (
            <div className={`${theme.bgTertiary} rounded p-2`}>
              <div className="flex items-center justify-between mb-1">
                <div className={`text-[10px] font-bold ${theme.textSecondary} uppercase`}>Full Response</div>
                <div className={`text-[9px] ${theme.textMuted}`}>{event.details.response.length} chars</div>
              </div>
              <div className={`${theme.text} whitespace-pre-wrap ${event.details.response.length > 500 ? 'max-h-48 overflow-y-auto' : ''}`}>
                {event.details.response}
              </div>
            </div>
          )}

          {/* Judge Reasoning */}
          {event.details?.judgeReasoning && (
            <div className="bg-indigo-900/30 border border-indigo-500/30 rounded p-2">
              <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Judge Reasoning</div>
              <div className="text-indigo-200 whitespace-pre-wrap">{event.details.judgeReasoning}</div>
              {event.details?.judgeConfidence !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-indigo-400">Confidence:</span>
                  <div className="flex-1 h-1.5 bg-indigo-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${event.details.judgeConfidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-300">{event.details.judgeConfidence}%</span>
                </div>
              )}
            </div>
          )}

          {/* Trigger phrase for judge calls */}
          {event.details?.triggerPhrase && (
            <div className="bg-red-900/30 border border-red-500/30 rounded p-2">
              <div className="text-[10px] font-bold text-red-400 uppercase mb-1">Trigger Phrase</div>
              <div className="text-red-200 font-bold">"{event.details.triggerPhrase}"</div>
            </div>
          )}

          {/* Echo excerpt */}
          {event.details?.echoExcerpt && (
            <div className="bg-amber-900/30 border border-amber-500/30 rounded p-2">
              <div className="text-[10px] font-bold text-amber-400 uppercase mb-1">Echo Detected</div>
              <div className="text-amber-200">"{event.details.echoExcerpt}"</div>
              {event.details?.matchedMarkers && event.details.matchedMarkers.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {event.details.matchedMarkers.map((m, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-amber-600/30 text-amber-300 font-mono">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Metrics breakdown */}
          {(event.details?.tokens || event.details?.timeMs || event.details?.model) && (
            <div className={`flex items-center gap-3 text-[10px] ${theme.textSecondary}`}>
              {event.details.model && <span>Model: <span className={theme.text}>{event.details.model}</span></span>}
              {event.details.tokens && <span>Tokens: <span className={theme.text}>{event.details.tokens}</span></span>}
              {event.details.timeMs && <span>Time: <span className={theme.text}>{(event.details.timeMs / 1000).toFixed(2)}s</span></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact inline pass summary badge
interface PassSummaryCardProps {
  log: BatchPassLog;
  theme: Theme;
  previousLog?: BatchPassLog;
}

function PassSummaryCard({ log, theme, previousLog }: PassSummaryCardProps) {
  // Map pass names to full display names and complete Tailwind classes (no dynamic construction)
  const getPassStyles = (passName: string): { name: string; classes: string } => {
    switch (passName) {
      case 'pass1-unfiltered':
        return { name: 'Baseline', classes: 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-100 border-gray-400 dark:border-zinc-500' };
      case 'pass2-pill':
        return { name: 'Poison', classes: 'bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200 border-orange-400 dark:border-orange-600' };
      case 'pass3-pill-prompt':
        return { name: 'Protected', classes: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-400 dark:border-emerald-600' };
      case 'pass4-defense':
        return { name: 'Defense', classes: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border-blue-400 dark:border-blue-600' };
      case 'chaos':
        return { name: 'Chaos', classes: 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 border-red-400 dark:border-red-600' };
      case 'armageddon':
        return { name: 'Armageddon', classes: 'bg-orange-200 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 border-orange-500 dark:border-orange-700' };
      case 'chaos-protected':
        return { name: 'Chaos+Prot', classes: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border-purple-400 dark:border-purple-600' };
      case 'armageddon-protected':
        return { name: 'Arma+Prot', classes: 'bg-pink-100 dark:bg-pink-900/60 text-pink-800 dark:text-pink-200 border-pink-400 dark:border-pink-600' };
      case '2-agent':
        return { name: '2 LLMs', classes: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-400 dark:border-cyan-600' };
      case 'lite':
        return { name: 'Lite', classes: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 border-sky-400 dark:border-sky-600' };
      default:
        return { name: passName, classes: 'bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-100 border-gray-400 dark:border-zinc-500' };
    }
  };

  const info = getPassStyles(log.pass);
  const s = log.summary;
  const prev = previousLog?.summary;

  // Calculate delta for catch rate
  const rateDelta = prev ? Math.round((s.catchRate || 0) - (prev.catchRate || 0)) : null;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border font-semibold text-xs shadow-sm ${info.classes}`}>
      <span className="font-bold">{info.name}</span>
      <span className="font-mono">{s.catchRate?.toFixed(0) || 0}%</span>
      {rateDelta !== null && rateDelta !== 0 && (
        <span className={`font-bold ${rateDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {rateDelta > 0 ? '↑' : '↓'}{Math.abs(rateDelta)}
        </span>
      )}
      {s.echoTotal > 0 && (
        <span className="text-amber-600 dark:text-amber-400 font-mono">{s.echoTotal}e</span>
      )}
      {(s.kills ?? 0) > 0 && (
        <span className="text-red-600 dark:text-red-400">🗡{s.kills}</span>
      )}
    </div>
  );
}

// Run Comparison Badge - Shows delta between current and selected run
interface RunComparisonBadgeProps {
  current: BatchPassLog[];
  compare: BatchPassLog[];
  events: EnhancedForensicEvent[];
  compareEvents: ForensicEvent[];
}

function RunComparisonBadge({ current, compare, events, compareEvents }: RunComparisonBadgeProps) {
  // Calculate current run stats
  const currentStats = {
    echoes: current.reduce((sum, p) => sum + p.summary.echoTotal, 0),
    caught: current.reduce((sum, p) => sum + p.summary.caughtTotal, 0),
    kills: current.reduce((sum, p) => sum + (p.summary.kills || 0), 0),
    avgCatchRate: current.length > 0
      ? current.reduce((sum, p) => sum + (p.summary.catchRate || 0), 0) / current.length
      : 0,
  };

  // Calculate compare run stats
  const compareStats = {
    echoes: compare.reduce((sum, p) => sum + p.summary.echoTotal, 0),
    caught: compare.reduce((sum, p) => sum + p.summary.caughtTotal, 0),
    kills: compare.reduce((sum, p) => sum + (p.summary.kills || 0), 0),
    avgCatchRate: compare.length > 0
      ? compare.reduce((sum, p) => sum + (p.summary.catchRate || 0), 0) / compare.length
      : 0,
  };

  // Calculate run times
  const currentTime = events.length >= 2
    ? new Date(events[events.length - 1].timestamp).getTime() - new Date(events[0].timestamp).getTime()
    : 0;
  const compareTime = compareEvents.length >= 2
    ? new Date(compareEvents[compareEvents.length - 1].timestamp).getTime() - new Date(compareEvents[0].timestamp).getTime()
    : 0;

  const timeDelta = currentTime - compareTime;
  const echoDelta = currentStats.echoes - compareStats.echoes;
  const catchDelta = Math.round(currentStats.avgCatchRate - compareStats.avgCatchRate);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
  };

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-zinc-500">vs Previous:</span>

      {/* Time comparison */}
      <span className={`px-1.5 py-0.5 rounded ${timeDelta < 0 ? 'bg-emerald-600/20 text-emerald-400' : timeDelta > 0 ? 'bg-red-600/20 text-red-400' : 'bg-zinc-600/20 text-zinc-400'}`}>
        ⏱ {timeDelta !== 0 ? (timeDelta < 0 ? '↓' : '↑') : '='}{Math.abs(timeDelta) > 0 ? formatTime(Math.abs(timeDelta)) : '0s'}
      </span>

      {/* Echo comparison (lower is better) */}
      <span className={`px-1.5 py-0.5 rounded ${echoDelta < 0 ? 'bg-emerald-600/20 text-emerald-400' : echoDelta > 0 ? 'bg-red-600/20 text-red-400' : 'bg-zinc-600/20 text-zinc-400'}`}>
        Echoes: {echoDelta !== 0 ? (echoDelta < 0 ? '↓' : '↑') : '='}{Math.abs(echoDelta)}
      </span>

      {/* Catch rate comparison (higher is better) */}
      <span className={`px-1.5 py-0.5 rounded ${catchDelta > 0 ? 'bg-emerald-600/20 text-emerald-400' : catchDelta < 0 ? 'bg-red-600/20 text-red-400' : 'bg-zinc-600/20 text-zinc-400'}`}>
        Catch: {catchDelta !== 0 ? (catchDelta > 0 ? '↑' : '↓') : '='}{Math.abs(catchDelta)}%
      </span>
    </div>
  );
}
