"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Hash,
  Link2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { verifyChain } from "@/lib/utils/forensicHash";
import type { ForensicLogEntry } from "@/lib/types";

const SEVERITY_ICON = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
  success: CheckCircle2,
};

const SEVERITY_COLOR = {
  info: "text-blue-500",
  warning: "text-amber-500",
  critical: "text-red-500",
  success: "text-emerald-500",
};

const NODE_COLOR = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  success: "bg-emerald-500",
};

export function InvestigationView() {
  const sessions = useForensicLogStore((s) => s.sessions);
  const selectedSessionId = useForensicLogStore((s) => s.selectedSessionId);
  const setSelectedSession = useForensicLogStore((s) => s.setSelectedSession);
  const getSessionEntries = useForensicLogStore((s) => s.getSessionEntries);
  const entries = useForensicLogStore((s) => s.entries);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const sessionEntries = selectedSessionId ? getSessionEntries(selectedSessionId) : [];
  const chainResult = sessionEntries.length > 0 ? verifyChain(sessionEntries) : { valid: true };
  const selectedEntry = sessionEntries.find((e) => e.id === selectedEntryId) ?? null;
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="flex h-full">
      {/* Left: chain visualization */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        {/* Session selector */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
          <label className="text-[10px] font-bold uppercase text-zinc-500">Select Session</label>
          <select
            value={selectedSessionId ?? ""}
            onChange={(e) => {
              setSelectedSession(e.target.value || null);
              setSelectedEntryId(null);
            }}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-200"
          >
            <option value="">Choose a session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type === "batch" ? "Batch" : "Single"} — {s.config.mode} ({s.entryCount} entries)
              </option>
            ))}
          </select>

          {/* Chain integrity */}
          {selectedSessionId && sessionEntries.length > 0 && (
            <div className={`flex items-center gap-2 text-xs font-medium rounded-md px-2 py-1.5 ${
              chainResult.valid
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-500"
            }`}>
              {chainResult.valid ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {chainResult.valid ? "Hash Chain Verified" : `Chain Broken at #${chainResult.brokenAt}`}
            </div>
          )}
        </div>

        {/* Chain nodes */}
        <div className="flex-1 overflow-y-auto p-3">
          {sessionEntries.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-8">
              {selectedSessionId ? "No entries in this session" : "Select a session to investigate"}
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-zinc-300 dark:bg-zinc-700" />

              {sessionEntries.map((entry, i) => {
                const isSelected = entry.id === selectedEntryId;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntryId(entry.id)}
                    className={`relative flex w-full items-start gap-3 rounded-md px-1 py-1.5 text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-900/20"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    {/* Node dot */}
                    <div className={`relative z-10 mt-1 h-[18px] w-[18px] rounded-full border-2 border-white dark:border-zinc-950 flex-shrink-0 ${NODE_COLOR[entry.severity]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-zinc-500">#{entry.sequenceNumber}</span>
                        <span className={`text-[10px] font-bold uppercase ${SEVERITY_COLOR[entry.severity]}`}>
                          {entry.severity}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-800 dark:text-zinc-200 truncate">{entry.event}</div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    {isSelected && <ChevronRight className="h-3.5 w-3.5 text-emerald-500 mt-2 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedEntry ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <Link2 className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Select an entry to investigate</p>
            <p className="text-xs mt-1">Click on a chain node to see full forensic details</p>
          </div>
        ) : (
          <EntryDetail entry={selectedEntry} session={selectedSession} />
        )}
      </div>
    </div>
  );
}

function EntryDetail({ entry, session }: { entry: ForensicLogEntry; session?: { config: { mode: string; rounds: number } } }) {
  const SevIcon = SEVERITY_ICON[entry.severity];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <SevIcon className={`h-6 w-6 ${SEVERITY_COLOR[entry.severity]}`} />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{entry.event}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <span>#{entry.sequenceNumber}</span>
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
              <span className="uppercase font-bold">{entry.category}</span>
              <span className={`uppercase font-bold ${SEVERITY_COLOR[entry.severity]}`}>{entry.severity}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Who, What, When, Where, Why, How */}
      <div className="grid grid-cols-2 gap-3">
        <InfoBox label="WHEN" value={new Date(entry.timestamp).toLocaleString()} />
        <InfoBox label="WHAT" value={entry.event} />
        <InfoBox label="WHO" value={entry.modelState ? `${entry.modelState.agentRole.toUpperCase()} (${entry.modelState.modelId})` : "System"} />
        <InfoBox label="WHERE" value={`Sequence #${entry.sequenceNumber} in session ${entry.sessionId.slice(0, 12)}...`} />
        {entry.alertHistory?.length > 0 && <InfoBox label="WHY (Alerts)" value={entry.alertHistory?.join(", ")} />}
        {entry.modelState && <InfoBox label="HOW" value={`${entry.modelState.tokens} tokens in ${entry.modelState.responseTimeMs}ms`} />}
      </div>

      {/* Model state */}
      {entry.modelState && (
        <Section title="Model State">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Model" value={entry.modelState.modelId} />
            <Stat label="Role" value={entry.modelState.agentRole.toUpperCase()} />
            <Stat label="Tokens" value={entry.modelState.tokens.toLocaleString()} />
            <Stat label="Latency" value={`${entry.modelState.responseTimeMs}ms`} />
          </div>
        </Section>
      )}

      {/* Input / Output */}
      {entry.input && (
        <Section title="Input Data">
          <pre className="rounded-md bg-zinc-100 dark:bg-zinc-800 p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {entry.input}
          </pre>
        </Section>
      )}
      {entry.output && (
        <Section title="Output Data">
          <pre className="rounded-md bg-zinc-100 dark:bg-zinc-800 p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {entry.output}
          </pre>
        </Section>
      )}

      {/* AI Decision */}
      {entry.aiDecision && entry.aiDecision.explanation !== 'N/A' && (
        <Section title="AI Decision">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-zinc-500">Action:</span> <span className="text-zinc-800 dark:text-zinc-200">{entry.aiDecision.action}</span></div>
              <div><span className="text-zinc-500">Confidence:</span> <span className="text-zinc-800 dark:text-zinc-200">{(entry.aiDecision.confidence * 100).toFixed(0)}%</span></div>
              <div><span className="text-zinc-500">Model:</span> <span className="font-mono text-zinc-800 dark:text-zinc-200">{entry.aiDecision.modelVersion}</span></div>
            </div>
            <div><span className="text-zinc-500">Explanation:</span> <span className="text-zinc-800 dark:text-zinc-200">{entry.aiDecision.explanation}</span></div>
            {entry.aiDecision?.factors?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entry.aiDecision?.factors?.map((f, i) => (
                  <span key={i} className="rounded bg-cyan-100 dark:bg-cyan-900/30 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300 font-mono">{f}</span>
                ))}
              </div>
            )}
            {entry.aiDecision?.thresholds && Object.keys(entry.aiDecision.thresholds).length > 0 && (
              <div className="font-mono text-[10px] text-zinc-500">
                Thresholds: {Object.entries(entry.aiDecision.thresholds).map(([k, v]) => `${k}=${v}`).join(', ')}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Actors */}
      {entry.actors && (entry.actors.humanUsers?.length > 0 || entry.actors.overrideOccurred) && (
        <Section title="Actors">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 text-xs space-y-1">
            <div><span className="text-zinc-500">AI System:</span> <span className="text-zinc-800 dark:text-zinc-200">{entry.actors.aiSystem}</span></div>
            {entry.actors.humanUsers?.length > 0 && (
              <div><span className="text-zinc-500">Human Users:</span> <span className="text-zinc-800 dark:text-zinc-200">{entry.actors.humanUsers?.join(', ')}</span></div>
            )}
            {entry.actors.overrideOccurred && (
              <div className="text-amber-600 dark:text-amber-400 font-medium">Override: {entry.actors.overrideReason}</div>
            )}
          </div>
        </Section>
      )}

      {/* Data Lineage */}
      {entry.dataLineage && entry.dataLineage?.sources?.length > 1 && (
        <Section title="Data Lineage">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 text-xs space-y-1">
            <div><span className="text-zinc-500">Sources:</span> <span className="text-zinc-800 dark:text-zinc-200">{entry.dataLineage?.sources?.join(' → ')}</span></div>
            {entry.dataLineage?.transformations?.length > 0 && (
              <div><span className="text-zinc-500">Transformations:</span> <span className="font-mono text-zinc-800 dark:text-zinc-200">{entry.dataLineage?.transformations?.join(', ')}</span></div>
            )}
            <div><span className="text-zinc-500">Validation:</span> <span className="font-mono text-zinc-800 dark:text-zinc-200">{entry.dataLineage?.validationChecks?.join(', ')}</span></div>
          </div>
        </Section>
      )}

      {/* Compliance */}
      {entry.compliance && (
        <Section title="Compliance">
          <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-3 text-xs space-y-1">
            <div className="flex flex-wrap gap-1">
              {entry.compliance?.regulations?.map((r, i) => (
                <span key={i} className="rounded bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{r}</span>
              ))}
            </div>
            <div><span className="text-zinc-500">Retention until:</span> <span className="text-zinc-800 dark:text-zinc-200">{entry.compliance.retentionUntil}</span></div>
            <div><span className="text-zinc-500">Audit ready:</span> <span className={entry.compliance.auditReady ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-red-500"}>{entry.compliance.auditReady ? 'YES' : 'NO'}</span></div>
          </div>
        </Section>
      )}

      {/* Previous values */}
      {entry.previousValues && Object.keys(entry.previousValues).length > 0 && (
        <Section title="Changes from Previous">
          <div className="rounded-md bg-zinc-100 dark:bg-zinc-800 p-3 text-xs font-mono space-y-1">
            {Object.entries(entry.previousValues).map(([k, v]) => (
              <div key={k} className="text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500">{k}:</span> {String(v)}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Acknowledgments */}
      {entry.acknowledgments?.length > 0 && (
        <Section title="Acknowledgments">
          <div className="flex flex-wrap gap-1">
            {entry.acknowledgments?.map((a, i) => (
              <span key={i} className="rounded bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">{a}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Related events */}
      {entry.relatedEvents?.length > 0 && (
        <Section title="Related Events">
          <div className="flex flex-wrap gap-1">
            {entry.relatedEvents?.map((r, i) => (
              <span key={i} className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">{r}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Hash chain */}
      <Section title="Cryptographic Chain">
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Hash className="h-3.5 w-3.5" />
            <span className="text-zinc-500">SHA-256:</span>
            <span className="break-all">{entry.hash}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            <Hash className="h-3.5 w-3.5 opacity-50" />
            <span>Previous:</span>
            <span className="break-all">{entry.previousHash}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3">
      <div className="text-[10px] font-bold uppercase text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-800 dark:text-zinc-200 mt-0.5">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2 text-center">
      <div className="text-[10px] text-zinc-500 uppercase">{label}</div>
      <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200 truncate">{value}</div>
    </div>
  );
}
