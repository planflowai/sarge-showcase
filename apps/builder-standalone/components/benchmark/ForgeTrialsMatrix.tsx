"use client";

import React, { useMemo } from "react";
import { Link2, Lock, Flame, Cloud, Timer } from "lucide-react";
import type {
  RoundResult,
  ModelScorecard,
  BenchmarkScenario,
  Tier,
} from "@sarge/benchmark";

interface Props {
  results: RoundResult[];
  scorecards: ModelScorecard[];
  models: string[];
  scenarios: BenchmarkScenario[];
  selectedCell: { modelId: string; scenarioId: string } | null;
  onSelectCell: (cell: { modelId: string; scenarioId: string } | null) => void;
  currentModel: string | null;
  currentRound: string | null;
  running: boolean;
  isCloud?: boolean;
}

function tierColor(tier: Tier): {
  bg: string;
  border: string;
  text: string;
  glow: string;
} {
  switch (tier) {
    case "pass":
      return {
        bg: "bg-emerald-500/15",
        border: "border-emerald-400/40",
        text: "text-emerald-300",
        glow: "shadow-[0_0_10px_rgba(52,211,153,0.2)]",
      };
    case "partial":
      return {
        bg: "bg-amber-500/15",
        border: "border-[#FFD700]/40",
        text: "text-amber-300",
        glow: "shadow-[0_0_10px_rgba(255,215,0,0.2)]",
      };
    case "fail":
      return {
        bg: "bg-red-500/15",
        border: "border-red-400/40",
        text: "text-red-300",
        glow: "shadow-[0_0_10px_rgba(239,68,68,0.2)]",
      };
  }
}

/** Cloud tier colors use stricter thresholds: 90+ green, 70-89 amber, <70 red, 0 dark red */
function cloudScoreColor(score: number): {
  bg: string;
  border: string;
  text: string;
  glow: string;
} {
  if (score >= 90) return tierColor("pass");
  if (score >= 70) return tierColor("partial");
  if (score === 0) return {
    bg: "bg-red-900/30",
    border: "border-red-800/60",
    text: "text-red-500",
    glow: "shadow-[0_0_10px_rgba(127,29,29,0.3)]",
  };
  return tierColor("fail");
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ForgeTrialsMatrix({
  results,
  scorecards,
  models,
  scenarios,
  selectedCell,
  onSelectCell,
  currentModel,
  currentRound,
  running,
  isCloud = false,
}: Props) {
  const getResult = (modelId: string, scenarioId: string): RoundResult | undefined =>
    results.find((r) => r.modelId === modelId && r.scenarioId === scenarioId);

  const getScorecard = (modelId: string): ModelScorecard | undefined =>
    scorecards.find((s) => s.modelId === modelId);

  // Compute grade excluding timed-out rounds
  const computeGrade = useMemo(() => {
    return (modelId: string): { grade: number; tier: string; hasTimedOut: boolean } => {
      const modelResults = results.filter((r) => r.modelId === modelId);
      const valid = modelResults.filter((r) => r.score.total > 0 && !r.timedOut);
      const hasTimedOut = modelResults.some((r) => r.timedOut);
      if (valid.length === 0) return { grade: 0, tier: "unusable", hasTimedOut };
      const avg = Math.round(valid.reduce((s, r) => s + r.score.total, 0) / valid.length);
      let tier: string;
      if (isCloud) {
        tier = avg >= 90 ? "expert" : avg >= 70 ? "strong" : avg >= 50 ? "medium" : avg >= 25 ? "basic" : "unusable";
      } else {
        tier = avg >= 80 ? "expert" : avg >= 65 ? "strong" : avg >= 45 ? "medium" : avg >= 25 ? "basic" : "unusable";
      }
      return { grade: avg, tier, hasTimedOut };
    };
  }, [results, isCloud]);

  // Compute avg time excluding timed-out rounds
  const computeAvgTime = useMemo(() => {
    return (modelId: string): number | null => {
      const modelResults = results.filter((r) => r.modelId === modelId);
      const valid = modelResults.filter((r) => !r.timedOut && r.timeMs > 0);
      if (valid.length === 0) return null;
      return Math.round(valid.reduce((s, r) => s + r.timeMs, 0) / valid.length);
    };
  }, [results]);

  return (
    <div className="w-full">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-950 px-4 py-3 text-left text-xs font-bold text-zinc-400 tracking-wider uppercase border-b border-zinc-800 min-w-[180px]">
                Model
              </th>
              {scenarios.map((s, i) => (
                <th
                  key={s.id}
                  className="px-2 py-3 text-center text-xs font-bold text-zinc-400 tracking-wider uppercase border-b border-zinc-800 min-w-[80px]"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1">
                      R{i + 1}
                      {s.chainGate && <Flame className="w-3 h-3 text-[#FF6700]" />}
                    </span>
                    <span className="text-xs text-zinc-500 font-bold normal-case">
                      {s.name}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-bold text-zinc-400 tracking-wider uppercase border-b border-zinc-800 min-w-[70px]">
                Avg ⏱
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold text-zinc-400 tracking-wider uppercase border-b border-zinc-800 min-w-[80px]">
                Grade
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {models.map((modelId) => {
              const card = getScorecard(modelId);
              const isActive = running && currentModel === modelId;

              return (
                <tr
                  key={modelId}
                  className={`border-b border-zinc-800/50 transition-colors ${
                    isActive ? "bg-[#FF6700]/5" : "hover:bg-zinc-900/50"
                  }`}
                >
                  {/* Model Name */}
                  <td className="sticky left-0 z-10 bg-zinc-950 px-4 py-3 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      {isCloud ? (
                        <Cloud className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      ) : card ? (
                        card.chainCapable ? (
                          <Link2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        )
                      ) : (
                        <span className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className={`text-sm font-bold truncate ${isActive ? "text-[#FF6700]" : "text-zinc-200"}`}>
                        {modelId}
                      </span>
                      {isActive && <div className="ember-ring micro ml-1 flex-shrink-0" />}
                    </div>
                  </td>

                  {/* Round cells */}
                  {scenarios.map((scenario) => {
                    const result = getResult(modelId, scenario.id);
                    const isRunning = running && currentModel === modelId && currentRound === scenario.id;
                    const isSelected = selectedCell?.modelId === modelId && selectedCell?.scenarioId === scenario.id;

                    if (isRunning) {
                      return (
                        <td key={scenario.id} className="px-2 py-3">
                          <div className="flex items-center justify-center w-full h-[52px] rounded-lg border-2 border-[#FF6700]/50 bg-[#FF6700]/10 animate-pulse">
                            <div className="molten-pour micro" />
                          </div>
                        </td>
                      );
                    }

                    if (!result) {
                      return (
                        <td key={scenario.id} className="px-2 py-3">
                          <div className="flex items-center justify-center w-full h-[52px] rounded-lg border border-zinc-800/50 bg-zinc-900/30">
                            <span className="text-zinc-700 text-xs">—</span>
                          </div>
                        </td>
                      );
                    }

                    const isTimedOut = result.timedOut;
                    const colors = isTimedOut
                      ? { bg: "bg-amber-500/10", border: "border-amber-400/60", text: "text-amber-300", glow: "shadow-[0_0_10px_rgba(245,158,11,0.3)]" }
                      : isCloud
                        ? cloudScoreColor(result.score.total)
                        : tierColor(result.score.tier);

                    return (
                      <td key={scenario.id} className="px-2 py-3">
                        <button
                          onClick={() => onSelectCell({ modelId, scenarioId: scenario.id })}
                          className={`relative flex flex-col items-center justify-center w-full h-[52px] rounded-lg border-2 transition-all cursor-pointer ${colors.bg} ${colors.border} ${colors.text} ${
                            isSelected ? `${colors.glow} ring-1 ring-white/20` : ""
                          }`}
                        >
                          <span className="text-lg font-bold leading-none">
                            {result.score.total}
                          </span>
                          <span className="text-[11px] font-bold opacity-70 mt-0.5">
                            {formatTime(result.timeMs)}
                          </span>
                          {/* Timed out indicator */}
                          {isTimedOut && (
                            <span className="absolute bottom-0.5 left-1 flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                              <Timer className="w-2.5 h-2.5" />
                              T/O
                            </span>
                          )}
                          {/* 3-run median badge */}
                          {result.runs && result.runs.length > 1 && (
                            <span className="absolute top-0.5 right-1 text-[9px] font-bold text-zinc-500">
                              {result.runs.length}x
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}

                  {/* Avg Time (excludes timed-out rounds) */}
                  <td className="px-3 py-3 text-center">
                    {(() => {
                      const avg = computeAvgTime(modelId);
                      return avg !== null ? (
                        <span className="text-sm font-bold text-zinc-300 font-mono">
                          {formatTime(avg)}
                        </span>
                      ) : card ? (
                        <span className="text-sm font-bold text-zinc-300 font-mono">
                          {formatTime(card.avgTimeMs)}
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      );
                    })()}
                  </td>

                  {/* Grade (excludes timed-out rounds) */}
                  <td className="px-3 py-3 text-center">
                    {card ? (
                      (() => {
                        const { grade, tier, hasTimedOut } = computeGrade(modelId);
                        return (
                          <div className="flex flex-col items-center">
                            <span
                              className={`text-lg font-bold ${
                                isCloud
                                  ? grade >= 90
                                    ? "text-emerald-400"
                                    : grade >= 70
                                    ? "text-amber-400"
                                    : "text-red-400"
                                  : grade >= 60
                                  ? "text-emerald-400"
                                  : grade >= 30
                                  ? "text-amber-400"
                                  : "text-red-400"
                              }`}
                            >
                              {grade}{hasTimedOut ? "*" : ""}
                            </span>
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                              {tier}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 mt-4 px-2">
        <div className="flex items-center gap-6 text-sm font-bold text-zinc-400">
          {isCloud ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500/30 border border-emerald-400/50" />
                Expert (90+)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/30 border border-[#FFD700]/50" />
                Strong (70-89)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-red-500/30 border border-red-400/50" />
                Below 70
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-red-900/50 border border-red-800/60" />
                Failed (0)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/10 border-2 border-amber-400/60" />
                <Timer className="w-3 h-3 text-amber-400" />
                Timed Out
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500/30 border border-emerald-400/50" />
                Pass (60+)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/30 border border-[#FFD700]/50" />
                Partial (30-59)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-red-500/30 border border-red-400/50" />
                Fail (&lt;30)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/10 border-2 border-amber-400/60" />
                <Timer className="w-3 h-3 text-amber-400" />
                Timed Out
              </span>
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                Chain Capable
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-red-400" />
                Generate Only
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#FF6700]" />
                Chain Gate (R3)
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-zinc-500 italic">* Grade excludes timed-out rounds</span>
      </div>
    </div>
  );
}
