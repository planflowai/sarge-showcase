"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@sarge/core";
import {
  useComplianceStore,
  type AuditScores,
  type AuditViolation,
} from "../stores/complianceStore";

// ─── Score color helpers (same thresholds as Hybrid tab) ─────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-red-400";
}

function scoreBorderColor(score: number): string {
  if (score >= 90) return "border-emerald-800/30";
  if (score >= 70) return "border-amber-800/30";
  return "border-red-800/30";
}

function severityColor(severity: string): string {
  if (severity === "critical" || severity === "serious" || severity === "error")
    return "bg-red-900/40 text-red-400";
  if (severity === "moderate" || severity === "warning")
    return "bg-amber-900/40 text-amber-400";
  return "bg-zinc-700/40 text-zinc-400";
}

// ─── Score Card ─────────────────────────────────────────────────────────────────

function ScoreCard({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after?: number | null;
}) {
  const hasAfter = after != null && after !== before;
  return (
    <div
      className={cn(
        "bg-zinc-900/40 border rounded-lg p-2 text-center",
        hasAfter ? scoreBorderColor(after!) : scoreBorderColor(before)
      )}
    >
      <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1 truncate">
        {label}
      </div>
      {hasAfter ? (
        <div className="flex items-center justify-center gap-1">
          <span
            className={cn(
              "text-xs font-bold line-through opacity-50",
              scoreColor(before)
            )}
          >
            {before}
          </span>
          <span className="text-zinc-500 text-[10px]">&rarr;</span>
          <span className={cn("text-base font-[900]", scoreColor(after!))}>
            {after}
          </span>
        </div>
      ) : (
        <div className={cn("text-base font-[900]", scoreColor(before))}>
          {before}
        </div>
      )}
    </div>
  );
}

// ─── Main CompliancePanel ───────────────────────────────────────────────────────

export default function CompliancePanel({
  onApplyFix,
}: {
  onApplyFix?: (fixedHtml: string) => void;
}) {
  const result = useComplianceStore((s) => s.result);
  const loading = useComplianceStore((s) => s.loading);
  const error = useComplianceStore((s) => s.error);
  const collapsed = useComplianceStore((s) => s.collapsed);
  const toggleCollapsed = useComplianceStore((s) => s.toggleCollapsed);
  const clear = useComplianceStore((s) => s.clear);

  const [violationsOpen, setViolationsOpen] = useState(false);

  // Nothing to show
  if (!result && !loading && !error) return null;

  const scores = result?.after || result?.before;
  const hasAfter = result?.after != null;

  return (
    <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950/80">
      {/* Header bar — always visible */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-900/50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 text-[#FF6700] animate-spin flex-shrink-0" />
        ) : scores?.passed ? (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
        ) : (
          <Shield className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        )}

        <span className="text-xs font-bold text-zinc-300">Compliance</span>

        {loading && (
          <span className="text-[10px] text-[#FF6700] animate-pulse">
            Auditing...
          </span>
        )}

        {error && (
          <span className="text-[10px] text-red-400 truncate">{error}</span>
        )}

        {/* Badge */}
        {!loading && scores && (
          <span
            className={cn(
              "ml-auto text-[10px] font-bold px-2 py-0.5 rounded border",
              scores.passed
                ? "bg-emerald-900/30 text-emerald-400 border-emerald-600/30"
                : "bg-amber-900/30 text-amber-400 border-amber-600/30"
            )}
          >
            {scores.passed ? "PASSED" : "NEEDS REVIEW"}
          </span>
        )}

        {/* Collapse indicator */}
        <span className="ml-auto text-zinc-500">
          {collapsed ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </span>
      </button>

      {/* Expanded content */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Score cards — 4 columns */}
          {scores && (
            <div className="grid grid-cols-4 gap-2">
              <ScoreCard
                label="Performance"
                before={result!.before.performance}
                after={result?.after?.performance}
              />
              <ScoreCard
                label="Accessibility"
                before={result!.before.accessibility}
                after={result?.after?.accessibility}
              />
              <ScoreCard
                label="SEO"
                before={result!.before.seo}
                after={result?.after?.seo}
              />
              <ScoreCard
                label="Best Practices"
                before={result!.before.bestPractices}
                after={result?.after?.bestPractices}
              />
            </div>
          )}

          {/* AI Fix badge + apply button */}
          {hasAfter && result?.fixedHtml && (
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#FF6700]" />
              <span className="text-[10px] font-bold text-zinc-300">
                AI fix applied ({result.before.violations.length} violations &rarr;{" "}
                {result.after!.violations.length})
              </span>
              {onApplyFix && (
                <button
                  onClick={() => onApplyFix(result.fixedHtml!)}
                  className="ml-auto px-2 py-1 text-[10px] font-bold rounded border border-[#FF6700]/40 text-[#FF6700] hover:bg-[#FF6700]/10 transition-colors"
                >
                  Apply Fix
                </button>
              )}
            </div>
          )}

          {/* Violations list — collapsible */}
          {result && result.before.violations.length > 0 && (
            <div>
              <button
                onClick={() => setViolationsOpen(!violationsOpen)}
                className="flex items-center gap-2 w-full text-left py-1"
              >
                {violationsOpen ? (
                  <ChevronDown className="h-3 w-3 text-zinc-400" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-zinc-400" />
                )}
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-bold text-zinc-300 uppercase">
                  Violations
                </span>
                <span className="text-[10px] text-zinc-500">
                  &middot; {result.before.violations.length} found
                </span>
              </button>

              {violationsOpen && (
                <div className="space-y-1 max-h-40 overflow-y-auto mt-1">
                  {result.before.violations.slice(0, 15).map((v, i) => (
                    <div
                      key={`${v.rule}-${i}`}
                      className="flex items-start gap-2 text-[10px] bg-zinc-900/40 border border-zinc-800 rounded px-2 py-1"
                    >
                      <span
                        className={cn(
                          "font-bold flex-shrink-0 px-1 py-px rounded uppercase",
                          severityColor(v.severity)
                        )}
                      >
                        {v.severity}
                      </span>
                      <span className="text-zinc-300 font-mono flex-shrink-0">
                        {v.rule}
                      </span>
                      <span className="text-zinc-400 truncate">
                        {v.message}
                      </span>
                    </div>
                  ))}
                  {result.before.violations.length > 15 && (
                    <div className="text-[10px] text-zinc-500 px-2">
                      +{result.before.violations.length - 15} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dismiss */}
          <button
            onClick={clear}
            className="text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
