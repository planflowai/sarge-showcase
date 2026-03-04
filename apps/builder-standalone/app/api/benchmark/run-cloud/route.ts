/**
 * Cloud Forge Trials — Benchmark Runner API
 * POST: Runs cloud model benchmarks, streaming NDJSON progress events.
 * Each model × scenario = 3 runs. Median score is the official result.
 * Every call logged to @sarge/billing with context 'trials-cloud'.
 */

import { NextRequest } from "next/server";
import {
  CLOUD_SCENARIOS,
  scoreResponse,
  getCloudTier,
  getCloudModelTier,
  type CloudBenchmarkConfig,
  type BenchmarkEvent,
  type RoundResult,
  type RunAttempt,
  type ModelScorecard,
  type ScoreBreakdown,
} from "@sarge/benchmark";

const RUNS_PER_SCENARIO = 3;

// ── Call cloud model via internal /api/test/stream endpoint ──────────

async function callCloudModel(
  baseUrl: string,
  modelId: string,
  provider: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<{ content: string; timeMs: number; timedOut: boolean; tokenCount: number; error?: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Combine signals
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort);

  try {
    const res = await fetch(`${baseUrl}/api/test/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        provider,
        prompt: userPrompt,
        systemPrompt,
        source: "cloud",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        content: "",
        timeMs: Date.now() - start,
        timedOut: false,
        tokenCount: 0,
        error: `API error: ${res.status} ${res.statusText}`,
      };
    }

    // Collect full streamed response
    const reader = res.body?.getReader();
    if (!reader) {
      return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: "No response body" };
    }

    const decoder = new TextDecoder();
    let content = "";
    let tokenCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      content += chunk;
      tokenCount++;
    }

    return {
      content,
      timeMs: Date.now() - start,
      timedOut: false,
      tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)),
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    if (err instanceof Error && err.name === "AbortError") {
      if (signal.aborted) {
        return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: "Stopped by user" };
      }
      return { content: "", timeMs: elapsed, timedOut: true, tokenCount: 0 };
    }
    return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: String(err) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// ── Log billing ──────────────────────────────────────────────────────

async function logBilling(
  baseUrl: string,
  modelId: string,
  provider: string,
  tokensOut: number,
  durationMs: number
): Promise<number> {
  try {
    const res = await fetch(`${baseUrl}/api/billing/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        provider,
        app: "trials-cloud",
        tokensIn: Math.ceil(tokensOut * 0.3), // Estimate input ~30% of output for prompts
        tokensOut,
        durationMs,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.cost || 0;
    }
  } catch {}
  return 0;
}

// ── POST handler ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const config: CloudBenchmarkConfig = await request.json();
  const { models, scenarioIds } = config;

  const scenarios = scenarioIds
    ? CLOUD_SCENARIOS.filter((s) => scenarioIds.includes(s.id))
    : CLOUD_SCENARIOS;

  const baseUrl = new URL(request.url).origin;
  const abortController = new AbortController();

  // Handle client disconnect
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let totalCost = 0;

      function emit(event: BenchmarkEvent) {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {}
      }

      emit({
        type: "run:start",
        message: `Cloud Forge Trials — ${models.length} models × ${scenarios.length} rounds × ${RUNS_PER_SCENARIO} runs`,
        timestamp: Date.now(),
      });

      const allResults: RoundResult[] = [];
      const allScorecards: ModelScorecard[] = [];

      for (let mi = 0; mi < models.length; mi++) {
        if (abortController.signal.aborted) break;

        const model = models[mi];
        const modelResults: RoundResult[] = [];

        emit({
          type: "model:start",
          modelId: model.id,
          message: `Testing ${model.name} (${model.provider})`,
          timestamp: Date.now(),
          progress: {
            currentModel: mi + 1,
            totalModels: models.length,
            currentRound: 0,
            totalRounds: scenarios.length,
            estimatedRemainingMs: 0,
          },
        });

        for (let si = 0; si < scenarios.length; si++) {
          if (abortController.signal.aborted) break;

          const scenario = scenarios[si];

          emit({
            type: "round:start",
            modelId: model.id,
            scenarioId: scenario.id,
            message: `${model.name} — ${scenario.name}`,
            timestamp: Date.now(),
            progress: {
              currentModel: mi + 1,
              totalModels: models.length,
              currentRound: si + 1,
              totalRounds: scenarios.length,
              currentRun: 0,
              totalRuns: RUNS_PER_SCENARIO,
              estimatedRemainingMs: 0,
            },
          });

          const runs: RunAttempt[] = [];
          let bestResponse = "";
          let bestCode = "";
          let bestScore: ScoreBreakdown | null = null;

          for (let run = 0; run < RUNS_PER_SCENARIO; run++) {
            if (abortController.signal.aborted) break;

            emit({
              type: "round:generating",
              modelId: model.id,
              scenarioId: scenario.id,
              message: `${model.name} — ${scenario.name} — Run ${run + 1}/${RUNS_PER_SCENARIO}`,
              timestamp: Date.now(),
              progress: {
                currentModel: mi + 1,
                totalModels: models.length,
                currentRound: si + 1,
                totalRounds: scenarios.length,
                currentRun: run + 1,
                totalRuns: RUNS_PER_SCENARIO,
                estimatedRemainingMs: 0,
              },
            });

            const result = await callCloudModel(
              baseUrl,
              model.id,
              model.provider,
              scenario.systemPrompt,
              scenario.prompt,
              scenario.timeout,
              abortController.signal
            );

            // Log billing for every cloud call
            const cost = await logBilling(
              baseUrl,
              model.id,
              model.provider,
              result.tokenCount,
              result.timeMs
            );
            totalCost += cost;

            if (result.error && !result.timedOut) {
              runs.push({
                score: 0,
                timeMs: result.timeMs,
                timedOut: false,
                error: result.error,
              });
              continue;
            }

            // Score the response
            emit({
              type: "round:scoring",
              modelId: model.id,
              scenarioId: scenario.id,
              message: `Scoring ${model.name} — ${scenario.name} run ${run + 1}`,
              timestamp: Date.now(),
            });

            const scored = scoreResponse(result.content, scenario.validation);

            // Override tier with cloud-specific thresholds
            scored.score.tier = getCloudTier(scored.score.total);

            runs.push({
              score: scored.score.total,
              timeMs: result.timeMs,
              timedOut: result.timedOut,
            });

            // Track best response (closest to median or highest score)
            if (!bestScore || scored.score.total > bestScore.total) {
              bestResponse = result.content;
              bestCode = scored.code;
              bestScore = scored.score;
            }
          }

          // Compute median
          const validRuns = runs.filter((r) => !r.error);
          const sortedScores = validRuns.map((r) => r.score).sort((a, b) => a - b);
          const medianScore =
            sortedScores.length > 0
              ? sortedScores[Math.floor(sortedScores.length / 2)]
              : 0;
          const medianTime =
            validRuns.length > 0
              ? validRuns.map((r) => r.timeMs).sort((a, b) => a - b)[
                  Math.floor(validRuns.length / 2)
                ]
              : 0;

          // Find the run closest to median score for the detailed breakdown
          let medianBreakdown: ScoreBreakdown = bestScore || {
            codeExtracted: 0,
            validHtml: 0,
            requiredElements: 0,
            requiredKeywords: 0,
            cssCriteria: 0,
            jsCriteria: 0,
            codeLength: 0,
            total: 0,
            tier: "fail",
          };
          medianBreakdown = { ...medianBreakdown, total: medianScore, tier: getCloudTier(medianScore) };

          const roundResult: RoundResult = {
            modelId: model.id,
            scenarioId: scenario.id,
            score: medianBreakdown,
            timeMs: medianTime,
            rawResponse: bestResponse,
            extractedCode: bestCode,
            timestamp: Date.now(),
            timedOut: validRuns.some((r) => r.timedOut),
            runs,
          };

          modelResults.push(roundResult);
          allResults.push(roundResult);

          emit({
            type: "round:complete",
            modelId: model.id,
            scenarioId: scenario.id,
            result: roundResult,
            message: `${model.name} — ${scenario.name}: ${medianScore}/100 (${formatTime(medianTime)}) — $${totalCost.toFixed(4)} spent`,
            timestamp: Date.now(),
            progress: {
              currentModel: mi + 1,
              totalModels: models.length,
              currentRound: si + 1,
              totalRounds: scenarios.length,
              estimatedRemainingMs: 0,
            },
          });
        }

        // Build scorecard for this model
        const validResults = modelResults.filter((r) => r.score.total > 0);
        const overallScore =
          validResults.length > 0
            ? Math.round(
                validResults.reduce((sum, r) => sum + r.score.total, 0) /
                  validResults.length
              )
            : 0;
        const avgTimeMs =
          validResults.length > 0
            ? Math.round(
                validResults.reduce((sum, r) => sum + r.timeMs, 0) /
                  validResults.length
              )
            : 0;

        const scorecard: ModelScorecard = {
          modelId: model.id,
          modelSize: model.provider,
          results: modelResults,
          overallScore,
          chainCapable: true, // Cloud models are always chain-capable
          tier: getCloudModelTier(overallScore),
          avgTimeMs,
        };

        allScorecards.push(scorecard);

        emit({
          type: "model:complete",
          modelId: model.id,
          scorecard,
          message: `${model.name}: ${overallScore}/100 (${scorecard.tier}) — Total: $${totalCost.toFixed(4)}`,
          timestamp: Date.now(),
        });
      }

      emit({
        type: abortController.signal.aborted ? "run:stopped" : "run:complete",
        message: abortController.signal.aborted
          ? `Cloud Trials stopped. Cost: $${totalCost.toFixed(4)}`
          : `Cloud Trials complete — ${allResults.length} rounds scored. Total cost: $${totalCost.toFixed(4)}`,
        timestamp: Date.now(),
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
