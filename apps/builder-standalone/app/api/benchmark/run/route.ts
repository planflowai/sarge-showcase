/**
 * Forge Trials — Benchmark Runner API
 * POST: Runs the full benchmark pipeline, streaming NDJSON progress events.
 * Each model × scenario is run 3 times. The median score is used as the official result.
 * Models that score 0 on the first 2 easy rounds are skipped (unusable).
 */

import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  BUILDER_SCENARIOS,
  scoreResponse,
  getTier,
  getModelTier,
  type BenchmarkConfig,
  type BenchmarkEvent,
  type RoundResult,
  type RunAttempt,
  type ModelScorecard,
  type BenchmarkRun,
  type ScoreBreakdown,
} from "@sarge/benchmark";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const SAVE_DIR =
  process.env.BENCHMARK_SAVE_DIR ||
  (process.platform === "win32"
    ? "L:/AI_MASTER_BUILDS/.benchmarks"
    : "/AI_MASTER_BUILDS/.benchmarks");

const RUNS_PER_SCENARIO = 3;

// ── Ollama Call (non-streaming, with timeout) ────────────────────────

async function callOllama(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  numCtx: number,
  numPredict: number,
  keepAlive: string,
  parentSignal?: AbortSignal
): Promise<{ content: string; timeMs: number; timedOut: boolean; error?: string }> {
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (parentSignal) parentSignal.addEventListener("abort", onParentAbort);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        options: {
          num_ctx: numCtx,
          num_predict: numPredict,
        },
        keep_alive: keepAlive,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        content: "",
        timeMs: Date.now() - start,
        timedOut: false,
        error: `Ollama ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    return {
      content: data.message?.content || "",
      timeMs: Date.now() - start,
      timedOut: false,
    };
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error && err.name === "AbortError";
    if (parentSignal?.aborted) {
      return { content: "", timeMs: Date.now() - start, timedOut: false, error: "Stopped by user" };
    }
    return {
      content: "",
      timeMs: Date.now() - start,
      timedOut: isAbort,
      error: isAbort ? "Timed out" : String(err),
    };
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
  }
}

// ── Median helper ────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// ── Incremental Save ─────────────────────────────────────────────────

async function saveResults(runId: string, run: BenchmarkRun) {
  try {
    await fs.mkdir(SAVE_DIR, { recursive: true });
    const filePath = path.join(SAVE_DIR, `${runId}.json`);
    await fs.writeFile(filePath, JSON.stringify(run, null, 2));
  } catch {
    // Non-fatal — log but don't crash
  }
}

// ── Load previous run for resume ─────────────────────────────────────

async function loadRun(runId: string): Promise<BenchmarkRun | null> {
  try {
    const filePath = path.join(SAVE_DIR, `${runId}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ── Estimate remaining time ──────────────────────────────────────────

function estimateRemaining(
  startTime: number,
  completed: number,
  total: number
): number {
  if (completed === 0) return total * 90_000;
  const elapsed = Date.now() - startTime;
  const avgPerRun = elapsed / completed;
  return Math.max(0, Math.round((total - completed) * avgPerRun));
}

// ── Main Handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const config: BenchmarkConfig = await req.json();
  const {
    models,
    scenarioIds,
    ollamaUrl: _unused,
    numCtx = 32768,
    numPredict = 4096,
    keepAlive = "1h",
    resumeRunId,
  } = config;

  // Determine scenarios to run
  const scenarios = scenarioIds?.length
    ? BUILDER_SCENARIOS.filter((s) => scenarioIds.includes(s.id))
    : BUILDER_SCENARIOS;

  // Resume support: load existing results to skip completed pairs
  let existingResults: RoundResult[] = [];
  const runId = resumeRunId || `forge-trials-${Date.now()}`;
  if (resumeRunId) {
    const prev = await loadRun(resumeRunId);
    if (prev) existingResults = prev.results;
  }

  const completedPairs = new Set(
    existingResults.map((r) => `${r.modelId}::${r.scenarioId}`)
  );

  // Build the NDJSON stream
  const encoder = new TextEncoder();
  let stopped = false;

  // Propagate client disconnect to abort ongoing Ollama calls
  const runAbortController = new AbortController();
  req.signal.addEventListener("abort", () => {
    stopped = true;
    runAbortController.abort();
  });

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: BenchmarkEvent) {
        try {
          controller.enqueue(
            encoder.encode(JSON.stringify(event) + "\n")
          );
        } catch {
          // Stream closed — mark as stopped to exit loops
          stopped = true;
        }
      }

      const allResults: RoundResult[] = [...existingResults];
      const scorecards: ModelScorecard[] = [];
      const totalModels = models.length;
      const totalRounds = scenarios.length;
      const totalTests = totalModels * totalRounds * RUNS_PER_SCENARIO;
      const startTime = Date.now();
      let completedIndividualRuns = 0;

      emit({
        type: "run:start",
        message: `Forge Trials starting: ${totalModels} models \u00d7 ${totalRounds} rounds \u00d7 ${RUNS_PER_SCENARIO} runs`,
        progress: {
          currentModel: 0,
          totalModels,
          currentRound: 0,
          totalRounds,
          currentRun: 0,
          totalRuns: RUNS_PER_SCENARIO,
          estimatedRemainingMs: totalTests * 90_000,
        },
        timestamp: Date.now(),
      });

      for (let mi = 0; mi < models.length; mi++) {
        if (stopped) break;
        const modelId = models[mi];

        emit({
          type: "model:start",
          modelId,
          message: `Loading ${modelId}...`,
          progress: {
            currentModel: mi + 1,
            totalModels,
            currentRound: 0,
            totalRounds,
            currentRun: 0,
            totalRuns: RUNS_PER_SCENARIO,
            estimatedRemainingMs: estimateRemaining(
              startTime, completedIndividualRuns, totalTests
            ),
          },
          timestamp: Date.now(),
        });

        const modelResults: RoundResult[] = [];
        let modelSkipped = false;

        for (let ri = 0; ri < scenarios.length; ri++) {
          if (stopped || modelSkipped) break;
          const scenario = scenarios[ri];

          // Skip if already completed (resume)
          if (completedPairs.has(`${modelId}::${scenario.id}`)) {
            const existing = existingResults.find(
              (r) =>
                r.modelId === modelId && r.scenarioId === scenario.id
            );
            if (existing) modelResults.push(existing);
            completedIndividualRuns += RUNS_PER_SCENARIO;
            continue;
          }

          // ── 3-run median loop ──────────────────────────────────
          const runAttempts: RunAttempt[] = [];
          const runScores: ScoreBreakdown[] = [];
          const runResponses: { raw: string; code: string }[] = [];

          for (let run = 0; run < RUNS_PER_SCENARIO; run++) {
            if (stopped) break;

            emit({
              type: "round:start",
              modelId,
              scenarioId: scenario.id,
              message: `${modelId} \u2192 R${ri + 1} Run ${run + 1}/${RUNS_PER_SCENARIO}: ${scenario.name}`,
              progress: {
                currentModel: mi + 1,
                totalModels,
                currentRound: ri + 1,
                totalRounds,
                currentRun: run + 1,
                totalRuns: RUNS_PER_SCENARIO,
                estimatedRemainingMs: estimateRemaining(
                  startTime, completedIndividualRuns, totalTests
                ),
              },
              timestamp: Date.now(),
            });

            emit({
              type: "round:generating",
              modelId,
              scenarioId: scenario.id,
              message: `Run ${run + 1}/${RUNS_PER_SCENARIO} generating... (timeout: ${scenario.timeout / 1000}s)`,
              timestamp: Date.now(),
            });

            // Heartbeat keeps the NDJSON stream alive during long Ollama calls.
            // Without this, the browser closes the connection after ~60s of silence,
            // which aborts the Ollama request and wastes the entire generation.
            let hbCount = 0;
            const heartbeat = setInterval(() => {
              hbCount++;
              emit({
                type: "round:generating",
                modelId,
                scenarioId: scenario.id,
                message: `${modelId} generating... (${hbCount * 10}s)`,
                timestamp: Date.now(),
              });
            }, 10_000);

            const { content, timeMs, timedOut, error } = await callOllama(
              modelId,
              scenario.systemPrompt,
              scenario.prompt,
              scenario.timeout,
              numCtx,
              numPredict,
              keepAlive,
              runAbortController.signal
            );

            clearInterval(heartbeat);

            emit({
              type: "round:scoring",
              modelId,
              scenarioId: scenario.id,
              message: `Scoring Run ${run + 1}/${RUNS_PER_SCENARIO}...`,
              timestamp: Date.now(),
            });

            const { code, score } = scoreResponse(
              content,
              scenario.validation
            );

            runAttempts.push({
              score: score.total,
              timeMs,
              timedOut,
              error,
            });
            runScores.push(score);
            runResponses.push({
              raw: content.slice(0, 10000),
              code: code.slice(0, 15000),
            });

            completedIndividualRuns++;

            // Emit per-run completion (no result — that's reserved for the median)
            emit({
              type: "round:complete",
              modelId,
              scenarioId: scenario.id,
              message: `${modelId} R${ri + 1} Run ${run + 1}/${RUNS_PER_SCENARIO}: ${score.total}/100 (${score.tier.toUpperCase()}) \u2014 ${timeMs}ms`,
              progress: {
                currentModel: mi + 1,
                totalModels,
                currentRound: ri + 1,
                totalRounds,
                currentRun: run + 1,
                totalRuns: RUNS_PER_SCENARIO,
                estimatedRemainingMs: estimateRemaining(
                  startTime, completedIndividualRuns, totalTests
                ),
              },
              timestamp: Date.now(),
            });
          }

          // ── Compute median ───────────────────────────────────
          const medianScore = median(runAttempts.map((a) => a.score));
          const medianTime = median(runAttempts.map((a) => a.timeMs));

          // Pick the run closest to the median for its full ScoreBreakdown + code
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < runAttempts.length; i++) {
            const dist = Math.abs(runAttempts[i].score - medianScore);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = i;
            }
          }

          const medianBreakdown = runScores[bestIdx];
          // Override the total and tier to use the actual median
          const finalBreakdown: ScoreBreakdown = {
            ...medianBreakdown,
            total: medianScore,
            tier: getTier(medianScore),
          };

          const anyTimedOut = runAttempts.some((a) => a.timedOut);
          const anyError = runAttempts.find((a) => a.error)?.error;

          const result: RoundResult = {
            modelId,
            scenarioId: scenario.id,
            score: finalBreakdown,
            timeMs: medianTime,
            rawResponse: runResponses[bestIdx].raw,
            extractedCode: runResponses[bestIdx].code,
            timestamp: Date.now(),
            timedOut: medianScore === 0 && anyTimedOut,
            error: medianScore === 0 ? anyError : undefined,
            runs: runAttempts,
          };

          modelResults.push(result);
          allResults.push(result);

          // Emit the final median result (with result field for store)
          emit({
            type: "round:complete",
            modelId,
            scenarioId: scenario.id,
            result,
            message: `${modelId} R${ri + 1} MEDIAN: ${medianScore}/100 (${finalBreakdown.tier.toUpperCase()}) \u2014 ${medianTime}ms [${runAttempts.map((a) => a.score).join(", ")}]`,
            progress: {
              currentModel: mi + 1,
              totalModels,
              currentRound: ri + 1,
              totalRounds,
              currentRun: RUNS_PER_SCENARIO,
              totalRuns: RUNS_PER_SCENARIO,
              estimatedRemainingMs: estimateRemaining(
                startTime, completedIndividualRuns, totalTests
              ),
            },
            timestamp: Date.now(),
          });

          // Incremental save
          const partialRun: BenchmarkRun = {
            id: runId,
            startedAt: startTime,
            models,
            scenarios: scenarios.map((s) => s.id),
            results: allResults,
            scorecards,
            status: "running",
          };
          await saveResults(runId, partialRun);

          // ── Early termination: skip unusable models ─────────
          // After completing the first 2 rounds (easy), if both
          // median scores are 0, this model can't produce code.
          if (ri === 1) {
            const earlyScores = modelResults.map((r) => r.score.total);
            if (earlyScores.every((s) => s === 0)) {
              modelSkipped = true;

              emit({
                type: "model:skipped",
                modelId,
                message: `${modelId} skipped \u2014 scored 0 on first 2 rounds (unusable)`,
                progress: {
                  currentModel: mi + 1,
                  totalModels,
                  currentRound: ri + 1,
                  totalRounds,
                  estimatedRemainingMs: estimateRemaining(
                    startTime, completedIndividualRuns, totalTests
                  ),
                },
                timestamp: Date.now(),
              });

              // Count the skipped runs toward progress
              const skippedRounds = scenarios.length - (ri + 1);
              completedIndividualRuns += skippedRounds * RUNS_PER_SCENARIO;
            }
          }
        }

        // Build scorecard for this model
        // Chain gate: median R3 score >= 60
        const chainGateResult = modelResults.find(
          (r) =>
            scenarios.find((s) => s.id === r.scenarioId)?.chainGate
        );
        const chainCapable =
          chainGateResult ? chainGateResult.score.total >= 60 : true;

        const validScores = modelResults.filter(
          (r) => !r.timedOut && !r.error
        );
        const overallScore =
          validScores.length > 0
            ? Math.round(
                validScores.reduce(
                  (sum, r) => sum + r.score.total,
                  0
                ) / validScores.length
              )
            : 0;
        const avgTimeMs =
          validScores.length > 0
            ? Math.round(
                validScores.reduce((sum, r) => sum + r.timeMs, 0) /
                  validScores.length
              )
            : 0;

        const scorecard: ModelScorecard = {
          modelId,
          modelSize: "",
          results: modelResults,
          overallScore,
          chainCapable,
          tier: getModelTier(overallScore),
          avgTimeMs,
        };

        scorecards.push(scorecard);

        emit({
          type: "model:complete",
          modelId,
          scorecard,
          message: `${modelId} complete: ${overallScore}/100 (${scorecard.tier}) ${chainCapable ? "\uD83D\uDD17 Chain" : "\uD83D\uDD12 Generate-only"}${modelSkipped ? " [early exit]" : ""} \u2014 avg ${avgTimeMs}ms`,
          progress: {
            currentModel: mi + 1,
            totalModels,
            currentRound: totalRounds,
            totalRounds,
            estimatedRemainingMs: estimateRemaining(
              startTime, completedIndividualRuns, totalTests
            ),
          },
          timestamp: Date.now(),
        });
      }

      // Final save
      const finalRun: BenchmarkRun = {
        id: runId,
        startedAt: startTime,
        completedAt: Date.now(),
        models,
        scenarios: scenarios.map((s) => s.id),
        results: allResults,
        scorecards,
        status: stopped ? "stopped" : "completed",
      };
      await saveResults(runId, finalRun);

      emit({
        type: stopped ? "run:stopped" : "run:complete",
        message: stopped
          ? "Forge Trials stopped by user."
          : `Forge Trials complete: ${scorecards.length} models scored in ${Math.round((Date.now() - startTime) / 60000)}m`,
        timestamp: Date.now(),
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
