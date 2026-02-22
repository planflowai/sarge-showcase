"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
  Hash,
  Link2,
  Search,
  Filter,
  Play,
  ShieldCheck,
  ShieldAlert,
  Skull,
  Target,
  Stethoscope,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { useDiagnosticsStore } from "@/lib/stores/diagnosticsStore";
import type { ForensicLogEntry, ForensicSession } from "@/lib/types";
import { translateForensicEvent } from "@/lib/utils/plainEnglish";
import { verifyChain } from "@/lib/utils/forensicHash";

const SEVERITY_CONFIG = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "INFO" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "WARN" },
  critical: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", label: "CRIT" },
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "PASS" },
};

const CATEGORY_COLORS: Record<string, string> = {
  session: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  round: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
  response: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
  detection: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  judge: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  system: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  human: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  session: "Test Session",
  round: "Debate Round",
  response: "AI Response",
  detection: "Lie Detection",
  judge: "Final Decision",
  system: "System",
  human: "User Action",
};

function formatDateHeader(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - d.getTime();
  if (diff === 0) return "Today";
  if (diff === 86400000) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

// Highlight key events with special colors
function getEventHighlight(event: string): { bg: string; text: string; icon: string } | null {
  const lower = event.toLowerCase();
  if (lower.includes('kill') || lower.includes('killed')) {
    return { bg: 'bg-red-100 dark:bg-red-500/20 ring-1 ring-red-400/50', text: 'text-red-700 dark:text-red-400', icon: '🗡️' };
  }
  if (lower.includes('recovery') || lower.includes('recovered') || lower.includes('context wiped')) {
    return { bg: 'bg-cyan-100 dark:bg-cyan-500/20 ring-1 ring-cyan-400/50', text: 'text-cyan-700 dark:text-cyan-400', icon: '🔄' };
  }
  if (lower.includes('locked truth') || lower.includes('truth anchor')) {
    return { bg: 'bg-emerald-100 dark:bg-emerald-500/20 ring-1 ring-emerald-400/50', text: 'text-emerald-700 dark:text-emerald-400', icon: '🔒' };
  }
  return null;
}

function LogEntryCard({ entry, isExpanded, onToggle, onDiagnose }: { entry: ForensicLogEntry; isExpanded: boolean; onToggle: () => void; onDiagnose?: (entry: ForensicLogEntry) => void }) {
  const sev = SEVERITY_CONFIG[entry.severity];
  const SevIcon = sev.icon;
  const catColor = CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.system;
  const highlight = getEventHighlight(entry.event);

  // Show diagnose button for errors, warnings, or detection events
  const showDiagnose = entry.severity === 'warning' || entry.severity === 'critical' || entry.category === 'detection';

  return (
    <div className={`border rounded-lg ${highlight ? highlight.bg : `${sev.border} ${sev.bg}`} transition-all`}>
      {/* Header row */}
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {highlight ? (
          <span className="text-base">{highlight.icon}</span>
        ) : (
          <SevIcon className={`h-4 w-4 flex-shrink-0 ${sev.color}`} />
        )}
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${catColor}`}>
          {CATEGORY_LABELS[entry.category] ?? entry.category}
        </span>
        <span className={`flex-1 text-sm ${highlight ? highlight.text + ' font-semibold' : 'text-zinc-800 dark:text-zinc-200'} truncate`}>{translateForensicEvent(entry.event)}</span>
        {entry.modelState && (
          <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
            {entry.modelState.agentRole.toUpperCase()} · {entry.modelState.modelId.slice(0, 20)}
          </span>
        )}
        <span className="text-[10px] text-zinc-500 flex-shrink-0 font-mono">
          #{entry.sequenceNumber}
        </span>
        <span className="text-[10px] text-zinc-500 flex-shrink-0">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 space-y-3 text-xs">
          {/* Model state */}
          {entry.modelState && (
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
                <div className="text-[10px] text-zinc-500 uppercase">Model</div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate">{entry.modelState.modelId}</div>
              </div>
              <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
                <div className="text-[10px] text-zinc-500 uppercase">Role</div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200">{entry.modelState.agentRole.toUpperCase()}</div>
              </div>
              <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
                <div className="text-[10px] text-zinc-500 uppercase">Tokens</div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200">{entry.modelState.tokens.toLocaleString()}</div>
              </div>
              <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
                <div className="text-[10px] text-zinc-500 uppercase">Latency</div>
                <div className="font-mono text-zinc-800 dark:text-zinc-200">{entry.modelState.responseTimeMs}ms</div>
              </div>
            </div>
          )}

          {/* Input */}
          {entry.input && (
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Input</div>
              <pre className="rounded bg-zinc-100 dark:bg-zinc-800 p-2 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono text-[11px]">
                {entry.input.slice(0, 2000)}{entry.input.length > 2000 ? "..." : ""}
              </pre>
            </div>
          )}

          {/* Output */}
          {entry.output && (
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Output</div>
              <pre className="rounded bg-zinc-100 dark:bg-zinc-800 p-2 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono text-[11px]">
                {entry.output.slice(0, 2000)}{entry.output.length > 2000 ? "..." : ""}
              </pre>
            </div>
          )}

          {/* Alert history */}
          {entry.alertHistory.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Alert History</div>
              <div className="flex flex-wrap gap-1">
                {entry.alertHistory.map((a, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px]">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Previous values */}
          {entry.previousValues && Object.keys(entry.previousValues).length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Changes from Previous</div>
              <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2 font-mono text-[11px]">
                {Object.entries(entry.previousValues).map(([k, v]) => (
                  <div key={k} className="text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500">{k}:</span> {String(v)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System state */}
          <div className="flex gap-4">
            {entry.systemState.roundNumber !== undefined && (
              <span className="text-zinc-500">Round: <span className="text-zinc-800 dark:text-zinc-200">{entry.systemState.roundNumber}</span></span>
            )}
            {entry.systemState.echoCountSoFar !== undefined && (
              <span className="text-zinc-500">Lies Repeated: <span className="text-zinc-800 dark:text-zinc-200">{entry.systemState.echoCountSoFar}</span></span>
            )}
            {entry.systemState.tokenCount !== undefined && (
              <span className="text-zinc-500">Total tokens: <span className="text-zinc-800 dark:text-zinc-200">{entry.systemState.tokenCount}</span></span>
            )}
          </div>

          {/* AI Decision (condensed) */}
          {entry.aiDecision && entry.aiDecision.explanation !== 'N/A' && (
            <div className="rounded bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800 p-2 space-y-1">
              <div className="text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-400">AI Decision</div>
              <div className="text-zinc-700 dark:text-zinc-300">{entry.aiDecision.action} — <span className="font-bold">{(entry.aiDecision.confidence * 100).toFixed(0)}% confidence</span></div>
              <div className="text-zinc-500">{entry.aiDecision.explanation}</div>
              {entry.aiDecision.factors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.aiDecision.factors.map((f, i) => (
                    <span key={i} className="rounded bg-cyan-100 dark:bg-cyan-900/20 px-1 py-0.5 text-[9px] font-mono text-cyan-700 dark:text-cyan-300">{f}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actors (condensed) */}
          {entry.actors?.overrideOccurred && (
            <div className="rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-2">
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Human Override: </span>
              <span className="text-amber-700 dark:text-amber-300">{entry.actors.overrideReason}</span>
            </div>
          )}

          {/* Compliance (condensed) */}
          {entry.compliance && (
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span className={entry.compliance.auditReady ? "text-emerald-500 font-bold" : "text-red-500"}>
                {entry.compliance.auditReady ? '✓ Audit Ready' : '✗ Not Audit Ready'}
              </span>
              <span>·</span>
              <span>{entry.compliance.regulations.join(', ')}</span>
              <span>·</span>
              <span>Retain until {entry.compliance.retentionUntil}</span>
            </div>
          )}

          {/* Related events */}
          {entry.relatedEvents.length > 0 && (
            <div className="flex items-center gap-1 text-zinc-500">
              <Link2 className="h-3 w-3" />
              <span>Related: {entry.relatedEvents.join(", ")}</span>
            </div>
          )}

          {/* Hash */}
          <div className="flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-700 pt-2 font-mono text-[10px] text-zinc-500">
            <Hash className="h-3 w-3" />
            <span className="truncate">SHA-256: {entry.hash}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
            <Hash className="h-3 w-3 opacity-50" />
            <span className="truncate">Previous: {entry.previousHash}</span>
          </div>

          {/* Diagnose button for flagged entries */}
          {showDiagnose && onDiagnose && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDiagnose(entry);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-sm font-medium"
              >
                <Stethoscope className="h-4 w-4" />
                Diagnose this issue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Session card with chain integrity banner and outcome
function SessionCard({
  session,
  sessionEntries,
  isCollapsed,
  onToggle,
  expandedEntryId,
  setExpandedEntry,
  setCurrentView,
  onDiagnose,
}: {
  session: ForensicSession;
  sessionEntries: ForensicLogEntry[];
  isCollapsed: boolean;
  onToggle: () => void;
  expandedEntryId: string | null;
  setExpandedEntry: (id: string | null) => void;
  setCurrentView: (view: "timeline" | "investigation" | "replay" | "export") => void;
  onDiagnose?: (entry: ForensicLogEntry) => void;
}) {
  // Compute session stats
  const echoCount = sessionEntries.filter(e =>
    e.event.toLowerCase().includes('echoed') ||
    e.event.toLowerCase().includes('repeated the lie') ||
    (e.severity === 'warning' && e.category === 'response')
  ).length;

  const challengeCount = sessionEntries.filter(e =>
    e.event.toLowerCase().includes('challenged') ||
    e.event.toLowerCase().includes('flagged') ||
    (e.severity === 'success' && e.category === 'response')
  ).length;

  const judgeEntry = sessionEntries.find(e => e.category === 'judge');
  const verdict = session.verdict || (judgeEntry?.event.toLowerCase().includes('caught') ? 'caught' :
                  judgeEntry?.event.toLowerCase().includes('missed') ? 'missed' : null);

  // Chain integrity for this session
  const chainResult = sessionEntries.length > 1 ? verifyChain(sessionEntries) : { valid: true };

  // Determine outcome color
  const outcomeColor = verdict === 'caught' ? 'emerald' : verdict === 'missed' ? 'red' : 'zinc';
  const hasPoisonKilled = sessionEntries.some(e => e.event.toLowerCase().includes('killed') || e.event.toLowerCase().includes('neutralized'));
  const killCount = sessionEntries.filter(e => e.event.toLowerCase().includes('kill')).length;
  const recoveredCount = sessionEntries.filter(e => e.event.toLowerCase().includes('recovery') || e.event.toLowerCase().includes('recovered')).length;

  // Truth anchors / locked truths count
  const truthsLocked = sessionEntries.filter(e =>
    e.event.toLowerCase().includes('locked truth') ||
    e.event.toLowerCase().includes('truth anchor') ||
    e.event.toLowerCase().includes('judge locked')
  ).length;

  // Caught percentage - based on challenges vs echoes
  const totalResponses = echoCount + challengeCount;
  const caughtPct = totalResponses > 0 ? Math.round((challengeCount / totalResponses) * 100) : (verdict === 'caught' ? 100 : 0);

  // Export session as JSON
  const exportSession = () => {
    const data = {
      session,
      entries: sessionEntries,
      stats: { echoCount, challengeCount, killCount, recoveredCount, verdict },
      chainIntegrity: chainResult.valid ? 'INTACT' : `BROKEN at #${chainResult.brokenAt}`,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      {/* Summary card - always visible at top */}
      <div className={`px-3 py-2 flex items-center justify-between gap-3 ${
        verdict === 'caught' ? 'bg-emerald-50 dark:bg-emerald-950/30' : verdict === 'missed' ? 'bg-red-50 dark:bg-red-950/30' : 'bg-zinc-50 dark:bg-zinc-900/50'
      } border-b border-zinc-200 dark:border-zinc-800`}>
        {/* Session summary - compact metrics bar */}
        <div className="flex items-center gap-2 flex-wrap text-[10px]">
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            #{session.id.slice(3, 11)}
          </span>
          <span className="text-zinc-400">•</span>
          {killCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded font-bold">
              🗡️ {killCount}
            </span>
          )}
          {recoveredCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 rounded font-bold">
              🔄 {recoveredCount}
            </span>
          )}
          {caughtPct > 0 && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${
              caughtPct >= 80 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
              caughtPct >= 50 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
              'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
            }`}>
              ✅ {caughtPct}%
            </span>
          )}
          {truthsLocked > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded font-bold">
              🔒 {truthsLocked}
            </span>
          )}
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${
            chainResult.valid
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
          }`}>
            {chainResult.valid ? (
              <><ShieldCheck className="h-2.5 w-2.5" /> OK</>
            ) : (
              <><ShieldAlert className="h-2.5 w-2.5" /> !</>
            )}
          </span>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentView('replay')}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
          >
            <Play className="h-3 w-3" />
            Replay
          </button>
          <button
            onClick={exportSession}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-colors"
          >
            📤 Export
          </button>
        </div>
      </div>

      {/* Session header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          session.type === 'batch' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
        }`}>
          {session.type === 'batch' ? 'Batch Test' : 'Single Test'}
        </span>
        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
          {session.config.mode === 'pill-prompt' ? 'Protected' : session.config.mode === 'pill' ? 'Poison' : 'Unfiltered'}
        </span>
        <span className="text-[10px] text-zinc-500">
          {sessionEntries.length} events · {new Date(session.startTime).toLocaleTimeString()}
        </span>
        <div className="flex-1" />

        {/* Stats badges */}
        {echoCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold">
            <Skull className="h-3 w-3" />
            {echoCount} echoed
          </span>
        )}
        {challengeCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
            <Target className="h-3 w-3" />
            {challengeCount} challenged
          </span>
        )}

        {/* Verdict badge */}
        {verdict && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            verdict === 'caught'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            {verdict === 'caught' ? '✓ CAUGHT' : '✗ MISSED'}
          </span>
        )}
        {hasPoisonKilled && (
          <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-bold">
            🗡️ KILLED
          </span>
        )}
      </button>

      {/* Entries */}
      {!isCollapsed && (
        <div className="p-2 space-y-1.5 max-h-[500px] overflow-y-auto">
          {sessionEntries.map((entry) => (
            <LogEntryCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedEntryId === entry.id}
              onToggle={() => setExpandedEntry(expandedEntryId === entry.id ? null : entry.id)}
              onDiagnose={onDiagnose}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TimelineView() {
  const router = useRouter();
  const getFilteredEntries = useForensicLogStore((s) => s.getFilteredEntries);
  const filters = useForensicLogStore((s) => s.filters);
  const setFilters = useForensicLogStore((s) => s.setFilters);
  const expandedEntryId = useForensicLogStore((s) => s.expandedEntryId);
  const setExpandedEntry = useForensicLogStore((s) => s.setExpandedEntry);
  const entries = useForensicLogStore((s) => s.entries);
  const sessions = useForensicLogStore((s) => s.sessions);
  const setCurrentView = useForensicLogStore((s) => s.setCurrentView);
  const closeForensicLog = useForensicLogStore((s) => s.closeForensicLog);
  const setPrefilledCustomRequest = useDiagnosticsStore((s) => s.setPrefilledCustomRequest);

  // Handle diagnose button click - navigates to diagnostics with prefilled context
  const handleDiagnose = (entry: ForensicLogEntry) => {
    // Build the diagnostic request from forensic entry
    const severityLabel = entry.severity === 'critical' ? 'CRITICAL' : entry.severity === 'warning' ? 'WARNING' : entry.severity.toUpperCase();
    const categoryLabel = CATEGORY_LABELS[entry.category] ?? entry.category;

    let requestText = `Forensic log flagged a ${severityLabel} issue in ${categoryLabel}.\n\n`;
    requestText += `Event: ${entry.event}\n`;
    requestText += `Entry ID: ${entry.id}\n`;
    requestText += `Timestamp: ${new Date(entry.timestamp).toLocaleString()}\n`;

    if (entry.modelState) {
      requestText += `\nModel: ${entry.modelState.modelId}`;
      requestText += `\nRole: ${entry.modelState.agentRole}`;
      requestText += `\nTokens: ${entry.modelState.tokens}`;
      requestText += `\nLatency: ${entry.modelState.responseTimeMs}ms`;
    }

    if (entry.input) {
      requestText += `\n\nInput (truncated): ${entry.input.slice(0, 500)}${entry.input.length > 500 ? '...' : ''}`;
    }

    if (entry.output) {
      requestText += `\n\nOutput (truncated): ${entry.output.slice(0, 500)}${entry.output.length > 500 ? '...' : ''}`;
    }

    if (entry.alertHistory.length > 0) {
      requestText += `\n\nAlert History: ${entry.alertHistory.join(', ')}`;
    }

    requestText += `\n\nInvestigate this issue and propose a fix.`;

    // Determine target based on model info
    const target = entry.modelState?.modelId || 'general';

    // Set prefilled request in diagnostics store
    setPrefilledCustomRequest({ request: requestText, target });

    // Close the forensic log overlay
    closeForensicLog();

    // Navigate to diagnostics
    router.push('/diagnostics');
  };

  // Hydration state - wait for zustand to rehydrate from localStorage
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Small delay to ensure localStorage has loaded
    const timer = setTimeout(() => setHydrated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const filtered = getFilteredEntries();
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());

  type DateGroup = { dateLabel: string; sessions: { session: ForensicSession; entries: ForensicLogEntry[] }[] };

  // Group sessions by date (last 7 days), most recent first
  const dateGroups = useMemo(() => {
    // Get entries for each session, sort by timestamp descending
    const sessionData: { session: ForensicSession; entries: ForensicLogEntry[]; timestamp: Date }[] = [];

    for (const session of sessions) {
      // Get entries for this session
      const sessionEntries = entries.filter(e => e.sessionId === session.id);

      // Apply search filter if set
      let filteredSessionEntries = sessionEntries;
      if (filters.searchText) {
        const q = filters.searchText.toLowerCase();
        filteredSessionEntries = sessionEntries.filter(e =>
          e.event.toLowerCase().includes(q) ||
          e.input?.toLowerCase().includes(q) ||
          e.output?.toLowerCase().includes(q)
        );
      }
      // Apply severity filter
      if (filters.severity.length > 0) {
        filteredSessionEntries = filteredSessionEntries.filter(e => filters.severity.includes(e.severity));
      }
      // Apply category filter
      if (filters.category.length > 0) {
        filteredSessionEntries = filteredSessionEntries.filter(e => filters.category.includes(e.category));
      }

      // Skip session if no entries match filters (but show if no filters applied)
      if (filteredSessionEntries.length === 0 && (filters.searchText || filters.severity.length > 0 || filters.category.length > 0)) {
        continue;
      }

      const timestamp = new Date(session.startTime);
      sessionData.push({
        session,
        entries: sessionEntries, // Show all entries in session, even if filtered
        timestamp,
      });
    }

    // Filter to last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSessions = sessionData.filter(s => s.timestamp >= sevenDaysAgo);

    // Sort by timestamp descending (most recent first)
    recentSessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Group by date
    const byDate = new Map<string, { session: ForensicSession; entries: ForensicLogEntry[] }[]>();
    for (const { session, entries: sessionEntries, timestamp } of recentSessions) {
      const key = formatDateHeader(timestamp);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push({ session, entries: sessionEntries });
    }

    // Convert to array, preserving date order (Today first)
    const dateOrder = ['Today', 'Yesterday'];
    const result: DateGroup[] = [];

    for (const dateLabel of dateOrder) {
      if (byDate.has(dateLabel)) {
        result.push({ dateLabel, sessions: byDate.get(dateLabel)! });
        byDate.delete(dateLabel);
      }
    }

    // Add remaining dates
    for (const [dateLabel, dateSessions] of byDate) {
      result.push({ dateLabel, sessions: dateSessions });
    }

    return result;
  }, [sessions, entries, filters.searchText, filters.severity, filters.category]);

  const toggleSession = (id: string) => {
    setCollapsedSessions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const severities = ["info", "warning", "critical", "success"];
  const categories = ["session", "round", "response", "detection", "judge", "system", "human"];

  // Show loading state while hydrating
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-zinc-500">Loading forensic logs...</div>
      </div>
    );
  }

  // Count total entries and sessions for stats
  const totalEntries = entries.length;
  const totalSessions = sessions.length;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={filters.searchText}
            onChange={(e) => setFilters({ searchText: e.target.value })}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-8 pr-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            showFilters || filters.severity.length > 0 || filters.category.length > 0
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {(filters.severity.length > 0 || filters.category.length > 0) && (
            <span className="ml-1 rounded-full bg-emerald-500 px-1.5 text-[10px] text-white">
              {filters.severity.length + filters.category.length}
            </span>
          )}
        </button>
        <span className="text-xs text-zinc-500">
          {filtered.length} / {entries.length} entries
        </span>
      </div>

      {/* Filter options */}
      {showFilters && (
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 space-y-2">
          <div>
            <span className="text-[10px] font-bold uppercase text-zinc-500 mr-2">Severity:</span>
            {severities.map((s) => {
              const active = filters.severity.includes(s);
              const cfg = SEVERITY_CONFIG[s as keyof typeof SEVERITY_CONFIG];
              return (
                <button
                  key={s}
                  onClick={() =>
                    setFilters({
                      severity: active
                        ? filters.severity.filter((x) => x !== s)
                        : [...filters.severity, s],
                    })
                  }
                  className={`mr-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                    active ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-zinc-500 mr-2">Category:</span>
            {categories.map((c) => {
              const active = filters.category.includes(c);
              return (
                <button
                  key={c}
                  onClick={() =>
                    setFilters({
                      category: active
                        ? filters.category.filter((x) => x !== c)
                        : [...filters.category, c],
                    })
                  }
                  className={`mr-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                    active ? CATEGORY_COLORS[c] : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {CATEGORY_LABELS[c] ?? c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entries — grouped by session */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {totalSessions === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No forensic log entries</p>
            <p className="text-xs mt-1">Run a test or batch to start capturing forensic data</p>
          </div>
        ) : dateGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <Filter className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No sessions match your filters</p>
            <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="flex items-center gap-4 px-2 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                {totalSessions} session{totalSessions !== 1 ? 's' : ''} · {totalEntries} total events
              </span>
              <span className="text-[10px] text-zinc-500">Showing last 7 days</span>
            </div>

            {dateGroups.map((dateGroup) => (
              <div key={dateGroup.dateLabel} className="space-y-3">
                {/* Date header */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{dateGroup.dateLabel}</span>
                  <span className="text-[10px] text-zinc-400">({dateGroup.sessions.length} session{dateGroup.sessions.length !== 1 ? 's' : ''})</span>
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                </div>

                {dateGroup.sessions.map(({ session, entries: sessionEntries }) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    sessionEntries={sessionEntries}
                    isCollapsed={collapsedSessions.has(session.id)}
                    onToggle={() => toggleSession(session.id)}
                    expandedEntryId={expandedEntryId}
                    setExpandedEntry={setExpandedEntry}
                    setCurrentView={setCurrentView}
                    onDiagnose={handleDiagnose}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
