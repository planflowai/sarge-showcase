"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Code, Eye, BarChart3, Clock, Flame, Loader2 } from "lucide-react";
import type { RoundResult, BenchmarkScenario } from "@sarge/benchmark";

interface Props {
  result?: RoundResult;
  scenario?: BenchmarkScenario;
  running?: boolean;
  currentModel?: string | null;
  currentRound?: string | null;
  isCloud?: boolean;
  totalCost?: number;
}

type Tab = "preview" | "code" | "breakdown";

export function ForgeTrialsRoundDetail({
  result,
  scenario,
  running = false,
  currentModel,
  currentRound,
  isCloud = false,
  totalCost,
}: Props) {
  const [tab, setTab] = useState<Tab>("preview");

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && !result) {
      setElapsed(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [running, result, currentModel, currentRound]);

  // Build preview HTML
  const previewHtml = useMemo(() => {
    if (!result?.extractedCode) return "";
    const code = result.extractedCode;
    // If it's a full document, use as-is
    if (
      code.toLowerCase().includes("<!doctype") ||
      code.toLowerCase().includes("<html")
    ) {
      return code;
    }
    // Wrap snippet in basic HTML
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:1rem}</style></head><body>${code}</body></html>`;
  }, [result?.extractedCode]);

  // ── Running state: show live splash ──
  if (!result && running) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 gap-6 px-8">
        {/* Animated forge fire */}
        <div className="relative">
          <Flame className="w-24 h-24 text-[#FF6700] animate-pulse drop-shadow-[0_0_30px_rgba(255,103,0,0.6)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-[#FF6700]/30 border-t-[#FFD700] animate-spin" />
          </div>
        </div>

        <div className="text-center space-y-3">
          <h2 className="text-2xl font-[900] tracking-wide bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent">
            {isCloud ? "CLOUD" : "LOCAL"} FORGE TRIALS
          </h2>
          <p className="text-lg font-bold text-zinc-300">
            Testing in progress...
          </p>
        </div>

        {/* Current operation */}
        {currentModel && (
          <div className="w-full max-w-md bg-zinc-900/80 border border-[#FF6700]/20 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#FF6700] animate-spin flex-shrink-0" />
              <span className="text-base font-bold text-[#FFD700]">
                {currentModel}
              </span>
            </div>
            {currentRound && (
              <div className="text-sm font-bold text-zinc-400 pl-8">
                Scenario: <span className="text-zinc-300">{currentRound}</span>
              </div>
            )}
            <div className="flex items-center justify-between pl-8">
              <span className="text-sm font-mono font-bold text-amber-400">
                {elapsed}s elapsed
              </span>
              {isCloud && totalCost != null && totalCost > 0 && (
                <span className="text-sm font-mono font-bold text-emerald-400">
                  ${totalCost.toFixed(4)} spent
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-sm font-bold text-zinc-600 text-center max-w-sm">
          Results will appear here as each scenario completes. Click any scored cell in the matrix to review.
        </p>
      </div>
    );
  }

  // ── No result, not running: idle state ──
  if (!result || !scenario) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4">
        <Flame className="w-16 h-16 text-zinc-800" />
        <div className="text-center">
          <p className="text-xl font-bold text-zinc-500">
            Select a cell
          </p>
          <p className="text-base font-bold text-zinc-600 mt-1">
            Click any scored cell in the matrix to see details
          </p>
        </div>
      </div>
    );
  }

  const { score } = result;
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "preview", label: "Preview", icon: <Eye className="w-3.5 h-3.5" /> },
    { id: "code", label: "Code", icon: <Code className="w-3.5 h-3.5" /> },
    {
      id: "breakdown",
      label: "Breakdown",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
  ];

  const runs = result.runs;
  // Calculate if a run is an outlier (differs from median by > 30 points)
  const medianTotal = score.total;
  function isOutlier(runScore: number) {
    if (!runs || runs.length < 3) return false;
    return Math.abs(runScore - medianTotal) > 30;
  }

  const breakdownItems = [
    {
      label: "Code Extracted",
      score: score.codeExtracted,
      max: 20,
    },
    { label: "Valid HTML", score: score.validHtml, max: 10 },
    {
      label: "Required Elements",
      score: score.requiredElements,
      max: 25,
    },
    {
      label: "Required Keywords",
      score: score.requiredKeywords,
      max: 20,
    },
    { label: "CSS Criteria", score: score.cssCriteria, max: 10 },
    { label: "JS Criteria", score: score.jsCriteria, max: 10 },
    { label: "Code Length", score: score.codeLength, max: 5 },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Detail Header */}
      <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-[800] text-zinc-100">
              {result.modelId}
              <span className="text-zinc-400 font-bold ml-2">
                — {scenario.name}
              </span>
            </h3>
            <div className="flex items-center gap-3 mt-1.5">
              <span
                className={`text-2xl font-[800] ${
                  score.tier === "pass"
                    ? "text-emerald-400"
                    : score.tier === "partial"
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {score.total}
                <span className="text-base font-bold text-zinc-400">
                  /100
                </span>
              </span>
              <span
                className={`px-2.5 py-1 rounded text-sm font-[800] uppercase tracking-wider ${
                  score.tier === "pass"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                    : score.tier === "partial"
                    ? "bg-amber-500/20 text-amber-300 border border-[#FFD700]/30"
                    : "bg-red-500/20 text-red-300 border border-red-400/30"
                }`}
              >
                {score.tier}
              </span>
              <span className="flex items-center gap-1 text-sm font-bold text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                {(result.timeMs / 1000).toFixed(1)}s
              </span>
              {result.timedOut && (
                <span className="text-sm text-red-400 font-bold">
                  TIMED OUT
                </span>
              )}
              {scenario.chainGate && (
                <span className="flex items-center gap-1 text-sm font-bold text-[#FF6700]">
                  <Flame className="w-3.5 h-3.5" />
                  Chain Gate
                </span>
              )}
            </div>

            {/* Individual runs breakdown */}
            {runs && runs.length > 1 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {runs.map((run, i) => (
                  <span
                    key={i}
                    className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                      isOutlier(run.score)
                        ? "text-amber-300 bg-amber-500/15 border-amber-400/40"
                        : run.score >= 60
                        ? "text-emerald-300 bg-emerald-500/10 border-emerald-400/30"
                        : run.score >= 30
                        ? "text-zinc-300 bg-zinc-800 border-zinc-700"
                        : "text-red-300 bg-red-500/10 border-red-400/30"
                    }`}
                  >
                    Run {i + 1}: {run.score}
                    <span className="text-zinc-500 ml-1">
                      ({(run.timeMs / 1000).toFixed(1)}s{run.timedOut ? " timeout" : ""})
                    </span>
                  </span>
                ))}
                <span className="text-xs font-bold text-zinc-400 px-2 py-1">
                  Median: {score.total}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/20">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-bold transition-all ${
              tab === t.id
                ? "bg-[#FF6700]/15 text-[#FFD700] border border-[#FF6700]/40"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {tab === "preview" && (
          <div className="h-full p-3">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full rounded-lg border border-zinc-800 bg-white"
                sandbox="allow-scripts"
                title="Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-base font-bold">
                No code to preview
              </div>
            )}
          </div>
        )}

        {tab === "code" && (
          <div className="h-full p-3">
            <pre className="w-full h-full overflow-auto rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm font-bold text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
              {result.extractedCode || "No code extracted"}
            </pre>
          </div>
        )}

        {tab === "breakdown" && (
          <div className="p-5 space-y-4">
            {breakdownItems.map((item) => {
              const pct = (item.score / item.max) * 100;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-zinc-200">
                      {item.label}
                    </span>
                    <span className="text-sm font-bold font-mono text-zinc-300">
                      {item.score}/{item.max}
                    </span>
                  </div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background:
                          pct >= 70
                            ? "linear-gradient(90deg, #10b981, #34d399)"
                            : pct >= 40
                            ? "linear-gradient(90deg, #FF8C00, #FFD700)"
                            : "linear-gradient(90deg, #ef4444, #f87171)",
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Prompt used */}
            <div className="mt-6 pt-4 border-t border-zinc-800">
              <h4 className="text-sm font-[800] text-zinc-300 uppercase tracking-wider mb-2">
                Prompt
              </h4>
              <p className="text-sm font-bold text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {scenario?.prompt.slice(0, 500)}
                {(scenario?.prompt.length ?? 0) > 500 && "..."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
