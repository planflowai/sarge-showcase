"use client";

import React, { type RefObject, useState, useEffect, useRef } from "react";
import { Flame, Loader2 } from "lucide-react";
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
  // Total individual runs (models × rounds × runs per scenario)
  const totalIndividualRuns = totalModels * totalRounds * runsPerScenario;
  // Each result represents all runs for one model×scenario (median computed)
  const completedMedianTests = results.length;
  // For progress bar, use individual run count from events
  const completedIndividualRuns = completedMedianTests * runsPerScenario;
  const progress =
    totalIndividualRuns > 0 ? (completedIndividualRuns / totalIndividualRuns) * 100 : 0;

  // Estimate remaining time from average per-scenario time (includes all 3 runs)
  const avgMs =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.timeMs, 0) / results.length * runsPerScenario
      : 90000 * runsPerScenario;
  const remainingScenarios = (totalModels * totalRounds) - completedMedianTests;
  const remainingMs = remainingScenarios * avgMs;
  const remainingMin = Math.ceil(remainingMs / 60000);

  // ── Live elapsed timer (counts up while generating) ──
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());

  // Track the latest "generating" event to know when generation started
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

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsed(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [running, isGenerating, latestEvent?.timestamp]);

  // Latest events for the log
  const recentEvents = events.slice(-30);

  return (
    <div className="border-t border-[#FF6700]/20 bg-zinc-900/60 px-5 py-4">
      {/* Progress Bar */}
      <div className="flex items-center gap-4 mb-3">
        {running && (
          <Flame className="w-5 h-5 text-[#FF6700] flex-shrink-0 animate-pulse" />
        )}

        <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #FF6700, #FF8C00, #FFD700)",
              boxShadow:
                running
                  ? "0 0 12px rgba(255, 103, 0, 0.4)"
                  : "none",
            }}
          />
        </div>

        <div className="flex items-center gap-3 text-base font-[800] text-zinc-200 flex-shrink-0 min-w-[380px] justify-end">
          {currentModel && running && (
            <span className="text-[#FF6700] font-bold">
              {currentModel}
            </span>
          )}
          {running && isGenerating && elapsed > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400 font-bold font-mono">
              <Loader2 className="w-4 h-4 animate-spin" />
              {elapsed}s
            </span>
          )}
          <span>
            {completedIndividualRuns}/{totalIndividualRuns} runs
          </span>
          {running && remainingMin > 0 && (
            <span className="text-zinc-400 font-bold">~{remainingMin}m left</span>
          )}
          {isCloud && totalCost != null && totalCost > 0 && (
            <span className={`font-bold font-mono ${running ? "text-amber-400" : "text-emerald-400"}`}>
              ${totalCost.toFixed(4)}
            </span>
          )}
          {!running && completedMedianTests > 0 && (
            <span className="text-emerald-400 font-bold">
              Complete
            </span>
          )}
        </div>
      </div>

      {/* Active Generation Banner (cloud) */}
      {running && isCloud && isGenerating && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm font-bold text-amber-300">
            Generating code with {currentModel}...
          </span>
          {elapsed > 0 && (
            <span className="text-sm font-mono text-amber-400/70">{elapsed}s elapsed</span>
          )}
          {currentRound && (
            <span className="text-sm text-zinc-500 ml-auto">{currentRound}</span>
          )}
        </div>
      )}

      {/* Event Log */}
      <div
        ref={eventLogRef}
        className="h-[32px] overflow-hidden text-base font-bold text-zinc-300 font-mono leading-relaxed"
      >
        {recentEvents.length === 0 ? (
          <span className="text-zinc-500 font-bold">
            Waiting to start...
          </span>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
            {recentEvents.slice(-8).map((e, i) => (
              <span
                key={i}
                className={`flex-shrink-0 ${
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
                    : "text-zinc-200"
                }`}
              >
                {e.type === "round:complete" ? (
                  <>
                    {e.result?.score.tier === "pass"
                      ? "✓"
                      : e.result?.score.tier === "partial"
                      ? "◐"
                      : "✗"}{" "}
                    {e.message}
                  </>
                ) : (
                  e.message
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
