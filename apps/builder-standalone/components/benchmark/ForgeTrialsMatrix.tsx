"use client";

import React from "react";
import { Link2, Lock, Flame } from "lucide-react";
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
}: Props) {
  const getResult = (
    modelId: string,
    scenarioId: string
  ): RoundResult | undefined =>
    results.find(
      (r) => r.modelId === modelId && r.scenarioId === scenarioId
    );

  const getScorecard = (modelId: string): ModelScorecard | undefined =>
    scorecards.find((s) => s.modelId === modelId);

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
                      {s.chainGate && (
                        <Flame className="w-3 h-3 text-[#FF6700]" />
                      )}
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
                Score
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
                  className={`
                    border-b border-zinc-800/50 transition-colors
                    ${isActive ? "bg-[#FF6700]/5" : "hover:bg-zinc-900/50"}
                  `}
                >
                  {/* Model Name */}
                  <td className="sticky left-0 z-10 bg-zinc-950 px-4 py-3 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      {/* Chain capability icon */}
                      {card ? (
                        card.chainCapable ? (
                          <Link2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        )
                      ) : (
                        <span className="w-3.5 h-3.5 flex-shrink-0" />
                      )}

                      <span
                        className={`text-sm font-bold truncate ${
                          isActive
                            ? "text-[#FF6700]"
                            : "text-zinc-200"
                        }`}
                      >
                        {modelId}
                      </span>

                      {/* Active indicator */}
                      {isActive && (
                        <div className="ember-ring micro ml-1 flex-shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* Round cells */}
                  {scenarios.map((scenario) => {
                    const result = getResult(modelId, scenario.id);
                    const isRunning =
                      running &&
                      currentModel === modelId &&
                      currentRound === scenario.id;
                    const isSelected =
                      selectedCell?.modelId === modelId &&
                      selectedCell?.scenarioId === scenario.id;

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

                    const colors = tierColor(result.score.tier);

                    return (
                      <td key={scenario.id} className="px-2 py-3">
                        <button
                          onClick={() =>
                            onSelectCell({
                              modelId,
                              scenarioId: scenario.id,
                            })
                          }
                          className={`
                            relative flex flex-col items-center justify-center w-full h-[52px] rounded-lg border-2 transition-all cursor-pointer
                            ${colors.bg} ${colors.border} ${colors.text}
                            ${isSelected ? `${colors.glow} ring-1 ring-white/20` : `hover:${colors.glow}`}
                          `}
                        >
                          <span className="text-lg font-bold leading-none">
                            {result.score.total}
                          </span>
                          <span className="text-xs font-bold opacity-70 mt-0.5">
                            {formatTime(result.timeMs)}
                          </span>
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

                  {/* Avg Time */}
                  <td className="px-3 py-3 text-center">
                    {card ? (
                      <span className="text-sm font-bold text-zinc-300 font-mono">
                        {formatTime(card.avgTimeMs)}
                      </span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>

                  {/* Overall Score */}
                  <td className="px-3 py-3 text-center">
                    {card ? (
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-lg font-bold ${
                            card.overallScore >= 60
                              ? "text-emerald-400"
                              : card.overallScore >= 30
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        >
                          {card.overallScore}
                        </span>
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          {card.tier}
                        </span>
                      </div>
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
      <div className="flex items-center gap-6 mt-4 px-2 text-sm font-bold text-zinc-400">
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
      </div>
    </div>
  );
}
