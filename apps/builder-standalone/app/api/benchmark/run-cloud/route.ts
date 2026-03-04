/**
 * Cloud Forge Trials — Benchmark Runner API
 * POST: Runs cloud model benchmarks, streaming NDJSON progress events.
 * Calls cloud provider APIs DIRECTLY (no self-fetch through /api/test/stream).
 * Every call logged to @sarge/billing with context 'trials-cloud'.
 */

import { NextRequest } from "next/server";
import {
  CLOUD_SCENARIOS,
  scoreResponse,
  extractCode,
  getCloudTier,
  getCloudModelTier,
  type CloudBenchmarkConfig,
  type BenchmarkEvent,
  type RoundResult,
  type RunAttempt,
  type ModelScorecard,
  type ScoreBreakdown,
} from "@sarge/benchmark";

const RUNS_PER_SCENARIO = 1;

const WARMUP_PROMPT = `Build a dramatic "FORGE TRIALS" splash page. Single HTML file:
- Black background (#0a0a0a)
- Large centered "FORGE TRIALS" title with orange (#FF6700) to gold (#FFD700) CSS gradient text
- Animated pulsing ember ring around the title using CSS @keyframes
- Subtitle: "Cloud Model Benchmark — Initializing..."
- Small animated loading dots below
- Forge-themed, dark, professional
Keep it under 80 lines. No external dependencies.`;

// ── Result type from direct cloud calls ─────────────────────────────

interface CloudCallResult {
  content: string;
  timeMs: number;
  timedOut: boolean;
  tokenCount: number;
  error?: string;
}

// ── Direct cloud API calls (no self-fetch) ──────────────────────────

async function callCloudDirect(
  provider: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<CloudCallResult> {
  switch (provider) {
    case "deepseek":
      return callOpenAICompat(
        "https://api.deepseek.com/chat/completions",
        process.env.DEEPSEEK_API_KEY || "",
        modelId, systemPrompt, userPrompt, 8192, timeoutMs, signal
      );
    case "openai":
      return callOpenAICompat(
        "https://api.openai.com/v1/chat/completions",
        process.env.OPENAI_API_KEY || "",
        modelId, systemPrompt, userPrompt, 4096, timeoutMs, signal
      );
    case "xai":
      return callOpenAICompat(
        "https://api.x.ai/v1/chat/completions",
        process.env.XAI_API_KEY || process.env.GROK_API_KEY || "",
        modelId, systemPrompt, userPrompt, 4096, timeoutMs, signal
      );
    case "anthropic":
      return callAnthropic(modelId, systemPrompt, userPrompt, timeoutMs, signal);
    case "google":
      return callGemini(modelId, systemPrompt, userPrompt, timeoutMs, signal);
    default:
      return { content: "", timeMs: 0, timedOut: false, tokenCount: 0, error: `Unknown provider: ${provider}` };
  }
}

// ── OpenAI-compatible (DeepSeek, OpenAI, xAI) ──────────────────────

async function callOpenAICompat(
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number,
  signal: AbortSignal
): Promise<CloudCallResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort);

  // Accumulate outside try so catch can access partial content
  let content = "";
  let tokenCount = 0;

  try {
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userPrompt });

    console.log(`[CLOUD TRIAL] Calling ${model} at ${apiUrl} (timeout=${timeoutMs}ms, key=${apiKey ? "set" : "MISSING"})...`);

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: true }),
      signal: controller.signal,
    });

    console.log(`[CLOUD TRIAL] ${model} response status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.log(`[CLOUD TRIAL] ${model} ERROR: ${errText.slice(0, 200)}`);
      return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: `API ${res.status}: ${errText.slice(0, 200)}` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: "No response body" };

    const decoder = new TextDecoder();
    let sseBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });

      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const delta = data.choices?.[0]?.delta;
          // ONLY collect content — skip reasoning_content (DeepSeek R1)
          const text = delta?.content;
          if (text) {
            content += text;
            tokenCount++;
          }
        } catch {}
      }
    }

    console.log(`[CLOUD TRIAL] ${model} DONE: ${content.length} chars, ${tokenCount} tokens, ${Date.now() - start}ms`);
    console.log(`[CLOUD TRIAL] ${model} first 200 chars: ${content.slice(0, 200)}`);

    return {
      content,
      timeMs: Date.now() - start,
      timedOut: false,
      tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)),
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    console.log(`[CLOUD TRIAL] ${model} CATCH: ${err instanceof Error ? err.name + ": " + err.message : String(err)} after ${elapsed}ms, accumulated ${content.length} chars`);

    if (err instanceof Error && err.name === "AbortError") {
      // User stopped — discard content
      if (signal.aborted) return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: "Stopped by user" };
      // Timeout — KEEP accumulated content (this is the key fix)
      console.log(`[CLOUD TRIAL] ${model} TIMEOUT but has ${content.length} chars of content — keeping it`);
      return { content, timeMs: elapsed, timedOut: true, tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)) };
    }
    return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: String(err) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// ── Anthropic (Claude) ──────────────────────────────────────────────

async function callAnthropic(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<CloudCallResult> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort);

  let content = "";
  let tokenCount = 0;

  try {
    console.log(`[CLOUD TRIAL] Calling Anthropic ${model} (timeout=${timeoutMs}ms)...`);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        system: systemPrompt || undefined,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    console.log(`[CLOUD TRIAL] Anthropic ${model} response status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: `Anthropic ${res.status}: ${errText.slice(0, 200)}` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: "No response body" };

    const decoder = new TextDecoder();
    let sseBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });

      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "content_block_delta" && data.delta?.text) {
            content += data.delta.text;
            tokenCount++;
          }
        } catch {}
      }
    }

    console.log(`[CLOUD TRIAL] Anthropic ${model} DONE: ${content.length} chars, ${tokenCount} tokens`);

    return {
      content,
      timeMs: Date.now() - start,
      timedOut: false,
      tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)),
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    console.log(`[CLOUD TRIAL] Anthropic ${model} CATCH: ${err instanceof Error ? err.name : String(err)} after ${elapsed}ms, accumulated ${content.length} chars`);

    if (err instanceof Error && err.name === "AbortError") {
      if (signal.aborted) return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: "Stopped by user" };
      return { content, timeMs: elapsed, timedOut: true, tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)) };
    }
    return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: String(err) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// ── Google (Gemini) ─────────────────────────────────────────────────

async function callGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<CloudCallResult> {
  const start = Date.now();
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort);

  let content = "";
  let tokenCount = 0;

  try {
    console.log(`[CLOUD TRIAL] Calling Gemini ${model} (timeout=${timeoutMs}ms)...`);

    const contents: any[] = [];
    if (systemPrompt) {
      contents.push({ role: "user", parts: [{ text: systemPrompt }] });
      contents.push({ role: "model", parts: [{ text: "Understood." }] });
    }
    contents.push({ role: "user", parts: [{ text: userPrompt }] });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      }
    );

    console.log(`[CLOUD TRIAL] Gemini ${model} response status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: `Gemini ${res.status}: ${errText.slice(0, 200)}` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: "No response body" };

    const decoder = new TextDecoder();
    let sseBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });

      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            content += text;
            tokenCount++;
          }
        } catch {}
      }
    }

    console.log(`[CLOUD TRIAL] Gemini ${model} DONE: ${content.length} chars, ${tokenCount} tokens`);

    return {
      content,
      timeMs: Date.now() - start,
      timedOut: false,
      tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)),
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
    console.log(`[CLOUD TRIAL] Gemini ${model} CATCH: ${err instanceof Error ? err.name : String(err)} after ${elapsed}ms, accumulated ${content.length} chars`);

    if (err instanceof Error && err.name === "AbortError") {
      if (signal.aborted) return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: "Stopped by user" };
      return { content, timeMs: elapsed, timedOut: true, tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)) };
    }
    return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: String(err) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// ── Log billing ─────────────────────────────────────────────────────

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
        tokensIn: Math.ceil(tokensOut * 0.3),
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
        message: `Cloud Forge Trials — ${models.length} models × ${scenarios.length} rounds`,
        timestamp: Date.now(),
      });

      // ── Warmup: generate splash page to prove model is alive ──
      if (!abortController.signal.aborted && models.length > 0) {
        const firstModel = models[0];
        const warmupResult = await callCloudDirect(
          firstModel.provider,
          firstModel.id,
          "You are a code builder. Output a single complete HTML file.",
          WARMUP_PROMPT,
          30_000,
          abortController.signal
        );

        if (warmupResult.content && !warmupResult.error) {
          const warmupCode = extractCode(warmupResult.content);
          emit({
            type: "warmup:complete",
            modelId: firstModel.id,
            message: `Warmup complete — ${firstModel.name} is responding`,
            timestamp: Date.now(),
            warmupHtml: warmupCode || warmupResult.content,
          });

          const warmupCost = await logBilling(baseUrl, firstModel.id, firstModel.provider, warmupResult.tokenCount, warmupResult.timeMs);
          totalCost += warmupCost;
        }
      }

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
          let bestTokenCount = 0;
          let roundCost = 0;

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

            // Direct API call — no self-fetch
            console.log(`[CLOUD TRIAL] >>> ${model.name} — ${scenario.name} — Run ${run + 1}/${RUNS_PER_SCENARIO}`);
            const result = await callCloudDirect(
              model.provider,
              model.id,
              scenario.systemPrompt,
              scenario.prompt,
              scenario.timeout,
              abortController.signal
            );
            console.log(`[CLOUD TRIAL] <<< ${model.name} — ${scenario.name}: ${result.content.length} chars, timedOut=${result.timedOut}, error=${result.error || "none"}`);

            // Log billing
            const cost = await logBilling(
              baseUrl,
              model.id,
              model.provider,
              result.tokenCount,
              result.timeMs
            );
            totalCost += cost;
            roundCost += cost;

            if (result.error && !result.timedOut) {
              runs.push({
                score: 0,
                timeMs: result.timeMs,
                timedOut: false,
                error: result.error,
                tokensOut: 0,
              });
              continue;
            }

            // Log what extractCode receives and returns
            const codeForLog = extractCode(result.content);
            console.log(`[CLOUD TRIAL] extractCode input (first 200): ${result.content.slice(0, 200)}`);
            console.log(`[CLOUD TRIAL] extractCode output (first 200): ${codeForLog ? codeForLog.slice(0, 200) : "EMPTY"}`);

            // Score the response
            emit({
              type: "round:scoring",
              modelId: model.id,
              scenarioId: scenario.id,
              message: `Scoring ${model.name} — ${scenario.name} run ${run + 1}`,
              timestamp: Date.now(),
            });

            const scored = scoreResponse(result.content, scenario.validation);
            scored.score.tier = getCloudTier(scored.score.total);

            runs.push({
              score: scored.score.total,
              timeMs: result.timeMs,
              timedOut: result.timedOut,
              tokensOut: result.tokenCount,
            });

            if (!bestScore || scored.score.total > bestScore.total) {
              bestResponse = result.content;
              bestCode = scored.code;
              bestScore = scored.score;
              bestTokenCount = result.tokenCount;
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
          const anyTimedOut = validRuns.some((r) => r.timedOut);
          // If any run timed out, force tier to "partial" — score reflects incomplete output,
          // not the model's true capability. PARTIAL scores must not count toward routing decisions.
          medianBreakdown = {
            ...medianBreakdown,
            total: medianScore,
            tier: anyTimedOut ? "partial" : getCloudTier(medianScore),
          };

          const roundResult: RoundResult = {
            modelId: model.id,
            scenarioId: scenario.id,
            score: medianBreakdown,
            timeMs: medianTime,
            rawResponse: bestResponse,
            extractedCode: bestCode,
            timestamp: Date.now(),
            timedOut: anyTimedOut,
            runs,
            tokensIn: Math.ceil(bestTokenCount * 0.3),
            tokensOut: bestTokenCount,
            cost: roundCost,
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

        // Build scorecard for this model — exclude timedOut from grade
        const validResults = modelResults.filter((r) => r.score.total > 0 && !r.timedOut);
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
          chainCapable: true,
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
