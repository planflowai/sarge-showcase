"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  Download,
  Eye,
} from "lucide-react";
import type { ToggleResult, ToggleCheck } from "@/lib/toggles/pipeline";

/* ─── Toggle color map ─── */
const TOGGLE_COLORS: Record<string, string> = {
  Accessibility: "#22c55e",
  Privacy: "#8b5cf6",
  Security: "#ef4444",
  SEO: "#4285f4",
  Performance: "#eab308",
  Analytics: "#FF6700",
  "Punch List": "#00b4d8",
};

/* ─── Status config ─── */
const STATUS_CONFIG = {
  success: { badge: "Verified", badgeBg: "bg-emerald-500/20", badgeText: "text-emerald-400", glow: "shadow-emerald-500/10", border: "border-emerald-500/20" },
  warning: { badge: "Warnings", badgeBg: "bg-amber-500/20", badgeText: "text-amber-400", glow: "shadow-amber-500/10", border: "border-amber-500/20" },
  failed:  { badge: "Failed",   badgeBg: "bg-red-500/20",    badgeText: "text-red-400",    glow: "shadow-red-500/10",    border: "border-red-500/20" },
  skipped: { badge: "Skipped",  badgeBg: "bg-zinc-500/20",   badgeText: "text-zinc-500",   glow: "",                     border: "border-zinc-700/50" },
};

function CheckIcon({ status }: { status: ToggleCheck["status"] }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />;
    case "warn":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />;
    case "fail":
      return <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />;
  }
}

function StatusIcon({ status }: { status: ToggleResult["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400" />;
    case "skipped":
      return <MinusCircle className="h-4 w-4 text-zinc-500" />;
  }
}

function generateReport(result: ToggleResult): string {
  const lines: string[] = [];
  lines.push(`Toggle Verification Report: ${result.toggle}`);
  lines.push(`Status: ${result.status.toUpperCase()}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push(`Duration: ${result.duration}ms`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Checks:");
  lines.push("-".repeat(50));
  for (const c of result.checks) {
    const icon = c.status === "pass" ? "[PASS]" : c.status === "warn" ? "[WARN]" : "[FAIL]";
    lines.push(`  ${icon} ${c.label}`);
    if (c.detail) lines.push(`        ${c.detail}`);
  }
  lines.push("");
  lines.push("--- End of Report ---");
  return lines.join("\n");
}

export default function ToggleVerificationCard({ result }: { result: ToggleResult }) {
  const isSkipped = result.status === "skipped";
  const autoExpand = result.status === "failed" || result.status === "warning";
  const [expanded, setExpanded] = useState(autoExpand);

  const cfg = STATUS_CONFIG[result.status];
  const color = TOGGLE_COLORS[result.toggle] || "#6b7280";

  const handleExport = () => {
    const text = generateReport(result);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.toggle.toLowerCase().replace(/\s+/g, "-")}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Skipped: compact single-line card
  if (isSkipped) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
        <div className="w-2 h-2 rounded-full bg-zinc-600" />
        <span className="text-xs font-medium text-zinc-500 flex-1">{result.toggle}</span>
        <span className="text-[10px] font-medium text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">
          Skipped
        </span>
      </div>
    );
  }

  const passCount = result.checks.filter((c) => c.status === "pass").length;
  const warnCount = result.checks.filter((c) => c.status === "warn").length;
  const failCount = result.checks.filter((c) => c.status === "fail").length;

  return (
    <div
      className={`rounded-xl border ${cfg.border} ${cfg.glow} shadow-lg overflow-hidden transition-all duration-200`}
      style={{ background: "#1a1a2e" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Color dot */}
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

        {/* Status icon */}
        <StatusIcon status={result.status} />

        {/* Name */}
        <span className="text-sm font-semibold text-zinc-100 flex-1">{result.toggle}</span>

        {/* Duration */}
        {result.duration > 0 && (
          <span className="text-[10px] text-zinc-500 tabular-nums mr-2">
            {result.duration}ms
          </span>
        )}

        {/* Status badge */}
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
          {cfg.badge}
        </span>

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-zinc-800/80">
          {/* Check items */}
          <div className="px-4 py-2.5 space-y-1.5">
            {result.checks.map((check, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-xs ${
                      check.status === "pass"
                        ? "text-zinc-300"
                        : check.status === "warn"
                        ? "text-amber-300"
                        : "text-red-300"
                    }`}
                  >
                    {check.label}
                  </span>
                  {check.detail && (
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                      {check.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/40 text-[10px]">
            {passCount > 0 && (
              <span className="text-emerald-400 font-medium">{passCount} passed</span>
            )}
            {warnCount > 0 && (
              <span className="text-amber-400 font-medium">{warnCount} warning{warnCount !== 1 ? "s" : ""}</span>
            )}
            {failCount > 0 && (
              <span className="text-red-400 font-medium">{failCount} failed</span>
            )}
            <span className="flex-1" />

            {/* Action buttons */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <Eye className="h-3 w-3" />
              <span>Details</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExport();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <Download className="h-3 w-3" />
              <span>Export</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
