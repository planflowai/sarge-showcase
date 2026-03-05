"use client";

import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
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

/* ─── Status → top border + badge color ─── */
const STATUS_STYLES: Record<
  ToggleResult["status"],
  { borderColor: string; badgeColor: string; badgeBg: string; badgeLabel: string }
> = {
  success: { borderColor: "#22c55e", badgeColor: "#22c55e", badgeBg: "rgba(34,197,94,0.15)", badgeLabel: "VERIFIED" },
  warning: { borderColor: "#f59e0b", badgeColor: "#f59e0b", badgeBg: "rgba(245,158,11,0.15)", badgeLabel: "WARNINGS" },
  failed:  { borderColor: "#ef4444", badgeColor: "#ef4444", badgeBg: "rgba(239,68,68,0.15)",  badgeLabel: "FAILED" },
  skipped: { borderColor: "#6b7280", badgeColor: "#6b7280", badgeBg: "rgba(107,114,128,0.15)", badgeLabel: "SKIPPED" },
};

function CheckIcon({ status }: { status: ToggleCheck["status"] }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-[18px] w-[18px] text-emerald-400 flex-shrink-0 mt-0.5" />;
    case "warn":
      return <AlertTriangle className="h-[18px] w-[18px] text-amber-400 flex-shrink-0 mt-0.5" />;
    case "fail":
      return <XCircle className="h-[18px] w-[18px] text-red-400 flex-shrink-0 mt-0.5" />;
  }
}

export function generateReport(result: ToggleResult): string {
  const lines: string[] = [];
  lines.push(`Toggle Verification Report: ${result.toggle}`);
  lines.push(`Status: ${result.status.toUpperCase()}`);
  lines.push(`Summary: ${result.summary}`);
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

export function exportReport(result: ToggleResult) {
  const text = generateReport(result);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.toggle.toLowerCase().replace(/\s+/g, "-")}-report.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ToggleVerificationCard({
  result,
  index = 0,
}: {
  result: ToggleResult;
  index?: number;
}) {
  const isSkipped = result.status === "skipped";
  const style = STATUS_STYLES[result.status];
  const color = TOGGLE_COLORS[result.toggle] || "#6b7280";

  // Skipped: compact muted single-line card
  if (isSkipped) {
    return (
      <div
        className="flex items-center gap-4 px-5 py-3 rounded-xl border border-zinc-700/40"
        style={{
          background: "rgba(26,26,46,0.5)",
          animationDelay: `${index * 100}ms`,
        }}
      >
        <div className="w-3 h-3 rounded-full bg-zinc-700 flex-shrink-0" />
        <span className="text-sm text-zinc-300 flex-1">{result.toggle}</span>
        <span
          className="text-xs font-bold tracking-wider"
          style={{ color: "#6b7280" }}
        >
          SKIPPED
        </span>
      </div>
    );
  }

  // Group checks: pass first, then warn, then fail
  const passed = result.checks.filter((c) => c.status === "pass");
  const warnings = result.checks.filter((c) => c.status === "warn");
  const failures = result.checks.filter((c) => c.status === "fail");
  const hasMultipleGroups =
    (passed.length > 0 ? 1 : 0) + (warnings.length > 0 ? 1 : 0) + (failures.length > 0 ? 1 : 0) > 1;

  return (
    <div
      className="rounded-xl overflow-hidden shadow-lg"
      style={{
        background: "#1a1a2e",
        borderTop: `4px solid ${style.borderColor}`,
        border: `1px solid ${style.borderColor}22`,
        borderTopWidth: "4px",
        borderTopColor: style.borderColor,
        boxShadow: `0 0 20px ${style.borderColor}08`,
        animation: "fadeSlideIn 0.3s ease-out forwards",
        animationDelay: `${index * 100}ms`,
        opacity: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-5">
        {/* Color dot — 12px */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Toggle name — 18px bold */}
        <span className="text-lg font-bold text-zinc-100 flex-1">
          {result.toggle}
        </span>

        {/* Status badge — bold, 14px, all caps */}
        <span
          className="text-sm font-extrabold tracking-wider px-4 py-1.5 rounded-lg"
          style={{
            color: style.badgeColor,
            backgroundColor: style.badgeBg,
          }}
        >
          {style.badgeLabel}
        </span>
      </div>

      {/* Check items — always expanded */}
      <div className="px-6 pb-4 space-y-0">
        {/* Passed checks */}
        {passed.length > 0 && (
          <div className="space-y-2">
            {passed.map((check, i) => (
              <div key={`p-${i}`} className="flex items-start gap-3" style={{ lineHeight: "1.8" }}>
                <CheckIcon status="pass" />
                <span className="text-sm text-zinc-200">{check.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Divider if multiple groups */}
        {hasMultipleGroups && passed.length > 0 && (warnings.length > 0 || failures.length > 0) && (
          <div className="border-t border-zinc-700/40 my-3" />
        )}

        {/* Warning checks */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((check, i) => (
              <div key={`w-${i}`} className="flex items-start gap-3" style={{ lineHeight: "1.8" }}>
                <CheckIcon status="warn" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-amber-300 font-medium">{check.label}</span>
                  {check.detail && (
                    <p className="text-xs text-amber-400/60 mt-0.5 pl-0.5">{check.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        {hasMultipleGroups && warnings.length > 0 && failures.length > 0 && (
          <div className="border-t border-zinc-700/40 my-3" />
        )}

        {/* Failed checks */}
        {failures.length > 0 && (
          <div className="space-y-2">
            {failures.map((check, i) => (
              <div key={`f-${i}`} className="flex items-start gap-3" style={{ lineHeight: "1.8" }}>
                <CheckIcon status="fail" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-red-300 font-semibold">{check.label}</span>
                  {check.detail && (
                    <p className="text-xs text-red-400/60 mt-0.5 pl-0.5">{check.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — Export button */}
      <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-800/60">
        <button
          onClick={() => exportReport(result)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 border border-zinc-700/60 hover:text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export Report
        </button>
      </div>

      {/* Keyframe animation injected via style tag (only once) */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
