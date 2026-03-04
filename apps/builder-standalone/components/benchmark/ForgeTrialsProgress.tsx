"use client";

import React, { type RefObject, useState, useEffect, useRef } from "react";
import { Flame, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { BenchmarkEvent, RoundResult } from "@sarge/benchmark";

interface Props {
  events: BenchmarkEvent[];
  running: boolean;
  currentModel: string | null;
  currentRound: string | null;
  results: RoundResult[];
  totalModels: number;
  totalRounds: number;
  runsPerScenario: number;
  eventLogRef: RefObject<HTMLDivElement | null>;
  isCloud?: boolean;
  totalCost?: number;
}

export function ForgeTrialsProgress({
  events,
  running,
  currentModel,
  currentRound,
  results,
  totalModels,
  totalRounds,
  runsPerScenario,
  eventLogRef,
  isCloud = false,
  totalCost,
}: Props) {
  const totalIndividualRuns = totalModels * totalRounds * runsPerScenario;
  const completedMedianTests = results.length;
  const completedIndividualRuns = completedMedianTests * runsPerScenario;
  const progress =
    totalIndividualRuns > 0 ? (completedIndividualRuns / totalIndividualRuns) * 100 : 0;

  // Estimate remaining time
  const avgMs =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.timeMs, 0) / results.length * runsPerScenario
      : 90000 * runsPerScenario;
  const remainingScenarios = (totalModels * totalRounds) - completedMedianTests;
  const remainingMs = remainingScenarios * avgMs;
  const remainingMin = Math.ceil(remainingMs / 60000);

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const isGenerating = running && latestEvent &&
    (latestEvent.type === "round:generating" || latestEvent.type === "round:start" || latestEvent.type === "round:scoring");

  useEffect(() => {
    if (running && isGenerating) {
      lastEventTimeRef.current = latestEvent?.timestamp || Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - lastEventTimeRef.current) / 1000));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsed(0);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  }, [running, isGenerating, latestEvent?.timestamp]);

  const [showLog, setShowLog] = useState(false);
  const recentEvents = events.slice(-30);

  return (
    <div className="border-t border-[#FF6700]/20 bg-zinc-900/60 px-4 py-2.5">
      {/* Line 1: Progress bar + run count */}
      <div className="flex items-center gap-3 mb-1.5">
        {running && (
          <Flame className="w-4 h-4 text-[#FF6700] flex-shrink-0 animate-pulse" />
        )}
        <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #FF6700, #FF8C00, #FFD700)",
              boxShadow: running ? "0 0 10px rgba(255, 103, 0, 0.3)" : "none",
            }}
          />
        </div>
        <span className="text-xs font-bold text-zinc-300 tabular-nums flex-shrink-0">
          {progress.toFixed(0)}% · {completedIndividualRuns}/{totalIndividualRuns}
        </span>
      </div>

      {/* Line 2: Status left, timing right */}
      <div className="flex items-center justify-between text-sm">
        {/* Left: status */}
        <div className="flex items-center gap-2 text-zinc-300 font-bold min-w-0">
          {running && currentModel ? (
            <>
              {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" />}
              <span className="text-[#FF6700] truncate">{currentModel}</span>
              {currentRound && (
                <span className="text-zinc-500 flex-shrink-0">· {currentRound}</span>
              )}
            </>
          ) : !running && completedMedianTests > 0 ? (
            <span className="text-emerald-400">Complete</span>
          ) : (
            <span className="text-zinc-500">Ready</span>
          )}
        </div>

        {/* Right: timing + cost + log toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {running && isGenerating && elapsed > 0 && (
            <span className="text-xs font-mono text-amber-400">{elapsed}s</span>
          )}
          {running && remainingMin > 0 && (
            <span className="text-xs text-zinc-500">~{remainingMin}m left</span>
          )}
          {isCloud && totalCost != null && totalCost > 0 && (
            <span className={`text-xs font-mono font-bold ${running ? "text-amber-400" : "text-emerald-400"}`}>
              ${totalCost.toFixed(4)}
            </span>
          )}
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title={showLog ? "Hide log" : "Show log"}
          >
            {showLog ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable event log */}
      {showLog && (
        <div
          ref={eventLogRef}
          className="mt-1.5 max-h-[120px] overflow-y-auto text-xs font-mono text-zinc-400 border-t border-zinc-800/50 pt-1.5 space-y-0.5"
        >
          {recentEvents.length === 0 ? (
            <span className="text-zinc-600">No events yet</span>
          ) : (
            recentEvents.map((e, i) => (
              <div
                key={i}
                className={
                  e.type === "round:complete"
                    ? e.result?.score.tier === "pass"
                      ? "text-emerald-400"
                      : e.result?.score.tier === "partial"
                      ? "text-amber-400"
                      : "text-red-400"
                    : e.type === "run:complete"
                    ? "text-[#FFD700]"
                    : e.type === "model:start" || e.type === "round:start"
                    ? "text-[#FF8C00]"
                    : "text-zinc-400"
                }
              >
                {e.type === "round:complete" ? (
                  <>
                    {e.result?.score.tier === "pass" ? "✓" : e.result?.score.tier === "partial" ? "◐" : "✗"}{" "}
                    {e.message}
                  </>
                ) : (
                  e.message
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
