"use client";

import {
  Download,
  FileJson,
  Printer,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { verifyChain } from "@/lib/utils/forensicHash";

export function ExportView() {
  const entries = useForensicLogStore((s) => s.entries);
  const sessions = useForensicLogStore((s) => s.sessions);
  const exportJSON = useForensicLogStore((s) => s.exportJSON);
  const selectedSessionId = useForensicLogStore((s) => s.selectedSessionId);
  const getSessionEntries = useForensicLogStore((s) => s.getSessionEntries);

  const targetEntries = selectedSessionId ? getSessionEntries(selectedSessionId) : entries;
  const chainResult = targetEntries.length > 0 ? verifyChain(targetEntries) : { valid: true };

  const severityCounts = targetEntries.reduce(
    (acc, e) => {
      acc[e.severity] = (acc[e.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const categoryCounts = targetEntries.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <Download className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Export Forensic Report</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {selectedSessionId
              ? `Exporting ${targetEntries.length} entries from selected session`
              : `Exporting all ${targetEntries.length} entries across ${sessions.length} sessions`}
          </p>
        </div>

        {/* Chain integrity badge */}
        <div className={`flex items-center justify-center gap-2 rounded-lg p-3 text-sm font-medium ${
          chainResult.valid
            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700"
            : "bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-300 dark:border-red-700"
        }`}>
          {chainResult.valid ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          {chainResult.valid ? "Hash Chain Integrity: VERIFIED" : `Chain BROKEN at entry #${chainResult.brokenAt}`}
        </div>

        {/* Stats summary */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Report Summary</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
              <span className="text-zinc-500">Total Entries:</span>{" "}
              <span className="font-bold text-zinc-800 dark:text-zinc-200">{targetEntries.length}</span>
            </div>
            <div className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
              <span className="text-zinc-500">Sessions:</span>{" "}
              <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedSessionId ? 1 : sessions.length}</span>
            </div>
            {Object.entries(severityCounts).map(([sev, count]) => (
              <div key={sev} className="rounded bg-zinc-100 dark:bg-zinc-800 p-2">
                <span className="text-zinc-500 uppercase">{sev}:</span>{" "}
                <span className={`font-bold ${
                  sev === "critical" ? "text-red-500" : sev === "warning" ? "text-amber-500" : sev === "success" ? "text-emerald-500" : "text-blue-500"
                }`}>{count}</span>
              </div>
            ))}
          </div>
          {Object.keys(categoryCounts).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <span key={cat} className="rounded bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
                  {cat}: {count}
                </span>
              ))}
            </div>
          )}
          {targetEntries.length > 0 && (
            <div className="text-[10px] text-zinc-500 pt-1">
              Time range: {new Date(targetEntries[0].timestamp).toLocaleString()} — {new Date(targetEntries[targetEntries.length - 1].timestamp).toLocaleString()}
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => exportJSON()}
            disabled={targetEntries.length === 0}
            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileJson className="h-4 w-4" />
            Export JSON
          </Button>
          <Button
            onClick={() => handlePrint()}
            disabled={targetEntries.length === 0}
            variant="outline"
            className="flex-1 gap-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </div>

        <p className="text-[10px] text-center text-zinc-500">
          JSON export includes all entry data, SHA-256 hashes, and chain verification status.
          Print/PDF uses your browser&apos;s print dialog — select &quot;Save as PDF&quot; for a file.
        </p>
      </div>
    </div>
  );
}
