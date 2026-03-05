"use client";

import React, { useState } from "react";
import {
  Check,
  AlertTriangle,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  Eye,
  Code2,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import type { ToggleResult, VerificationData, VerificationItem, WarningItem, ManualItem } from "@/lib/toggles/pipeline";

interface Props {
  result: ToggleResult;
  onRerun?: () => void;
  onRevert?: () => void;
  color: string;
}

/* ── Collapsible section wrapper ── */
function Section({
  title,
  count,
  icon: Icon,
  iconColor,
  borderColor,
  bgColor,
  children,
  defaultOpen,
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? count <= 5);
  if (count === 0) return null;
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor, background: bgColor }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:brightness-110 transition-all"
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: iconColor }} />
        <span className="text-sm font-bold" style={{ color: iconColor }}>
          {title}
        </span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full ml-1" style={{ background: iconColor + "22", color: iconColor }}>
          {count}
        </span>
        <span className="ml-auto">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-300" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
          )}
        </span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

/* ── Before → After diff row ── */
function DiffRow({ item }: { item: VerificationItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = item.before !== "(none)" && item.after !== item.before;

  return (
    <div className="text-xs">
      <div className="flex items-start gap-2">
        <Check className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-zinc-200 font-medium">{item.label}</span>
          {item.section && (
            <span className="text-zinc-300 ml-1.5">[{item.section}]</span>
          )}
          {(hasDiff || item.before === "(none)") && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="ml-2 text-[#FF6700] hover:text-[#FFD700] transition-colors"
            >
              {expanded ? "Hide" : "View Diff"}
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-1.5 ml-5 space-y-1">
          <div className="rounded px-2 py-1 bg-red-950/30 border border-red-900/30">
            <span className="text-red-400/60 select-none mr-1">−</span>
            <code className="text-red-300/80 break-all whitespace-pre-wrap">{item.before}</code>
          </div>
          <div className="rounded px-2 py-1 bg-emerald-950/30 border border-emerald-900/30">
            <span className="text-emerald-400/60 select-none mr-1">+</span>
            <code className="text-emerald-300/80 break-all whitespace-pre-wrap">{item.after}</code>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Warning row ── */
function WarningRow({ item }: { item: WarningItem }) {
  return (
    <div className="text-xs flex items-start gap-2">
      <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-amber-200 font-medium">{item.label}</span>
        {item.detail && item.detail !== item.label && (
          <p className="text-amber-400/60 mt-0.5">{item.detail}</p>
        )}
      </div>
    </div>
  );
}

/* ── Manual action row ── */
function ManualRow({ item }: { item: ManualItem }) {
  return (
    <div className="text-xs flex items-start gap-2">
      <CircleAlert className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-red-200 font-medium">{item.label}</span>
        <p className="text-red-400/60 mt-0.5">{item.instruction}</p>
      </div>
    </div>
  );
}

/* ── Byte savings bar ── */
function ByteBar({ stats }: { stats: VerificationData["stats"] }) {
  if (!stats.bytesBefore || !stats.bytesSaved || stats.bytesSaved <= 0) return null;
  const pct = Math.min(100, Math.round((stats.bytesSaved / stats.bytesBefore) * 100));
  const format = (n: number) => (n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
  return (
    <div className="text-xs mt-1">
      <div className="flex justify-between text-zinc-400 mb-1">
        <span>{format(stats.bytesBefore!)} → {format(stats.bytesAfter!)}</span>
        <span className="text-emerald-400 font-bold">{format(stats.bytesSaved)} saved ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${100 - pct}%`,
            background: "linear-gradient(90deg, #FF6700, #FFD700)",
          }}
        />
      </div>
    </div>
  );
}

/* ── Main VerificationCard ── */
export default function VerificationCard({ result, onRerun, onRevert, color }: Props) {
  const v = result.verification;
  if (!v) {
    // No verification data — fallback to simple summary
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex items-center gap-2 mb-1">
          {result.status === "success" && <Check className="w-4 h-4 text-emerald-400" />}
          {result.status === "failed" && <CircleAlert className="w-4 h-4 text-red-400" />}
          {result.status === "warning" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <span className="text-sm font-bold text-white">{result.toggle}</span>
          <span className="text-xs text-zinc-300 ml-auto">{result.duration}ms</span>
        </div>
        <p className="text-xs text-zinc-400">{result.summary}</p>
      </div>
    );
  }

  const fixCount = v.fixed.length;
  const warnCount = v.warnings.length;
  const manualCount = v.manual.length;

  return (
    <div
      className="rounded-xl border bg-[#0d0d10] overflow-hidden"
      style={{ borderColor: color + "44" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: `1px solid ${color}33` }}
      >
        <div
          className="w-2 h-8 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-white">{result.toggle}</span>
            {result.status === "success" && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                APPLIED
              </span>
            )}
            {result.status === "warning" && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                WARNINGS
              </span>
            )}
            {result.status === "failed" && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                FAILED
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">{result.summary}</p>
        </div>
        <span className="text-xs text-zinc-300 flex-shrink-0">{result.duration}ms</span>
      </div>

      {/* Verification sections */}
      <div className="p-3 space-y-2">
        {/* FIXED section — green */}
        <Section
          title="FIXED"
          count={fixCount}
          icon={Check}
          iconColor="#34d399"
          borderColor="rgba(52,211,153,0.2)"
          bgColor="rgba(6,78,59,0.15)"
          defaultOpen
        >
          {v.fixed.map((item: any, i: any) => (
            <DiffRow key={i} item={item} />
          ))}
        </Section>

        {/* WARNING section — amber */}
        <Section
          title="WARNINGS"
          count={warnCount}
          icon={AlertTriangle}
          iconColor="#fbbf24"
          borderColor="rgba(251,191,36,0.2)"
          bgColor="rgba(120,53,15,0.15)"
          defaultOpen
        >
          {v.warnings.map((item: any, i: any) => (
            <WarningRow key={i} item={item} />
          ))}
        </Section>

        {/* MANUAL section — red */}
        <Section
          title="MANUAL"
          count={manualCount}
          icon={CircleAlert}
          iconColor="#f87171"
          borderColor="rgba(248,113,113,0.2)"
          bgColor="rgba(127,29,29,0.15)"
        >
          {v.manual.map((item: any, i: any) => (
            <ManualRow key={i} item={item} />
          ))}
        </Section>

        {/* Byte savings bar */}
        <ByteBar stats={v.stats} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-800/50">
        {onRerun && (
          <button
            onClick={onRerun}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-[#FF6700] bg-zinc-800/50 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Re-run
          </button>
        )}
        {onRevert && (
          <button
            onClick={onRevert}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-red-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Revert All
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-300">
          {fixCount > 0 && <span className="text-emerald-500">{fixCount} fixed</span>}
          {warnCount > 0 && <span className="text-amber-500">{warnCount} warn</span>}
          {manualCount > 0 && <span className="text-red-500">{manualCount} manual</span>}
        </div>
      </div>
    </div>
  );
}
