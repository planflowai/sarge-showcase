/**
 * Hybrid Forge Trials — Chain Runner API
 * POST: Runs multi-model chains where each step feeds output to the next.
 * Scores the final output. Streams NDJSON progress events.
 */

import { NextRequest } from "next/server";
import {
  CLOUD_SCENARIOS,
  scoreResponse,
  extractCode,
  getCloudTier,
  type HybridBenchmarkConfig,
  type HybridEvent,
  type HybridStepResult,
  type HybridChainResult,
  type ScoreBreakdown,
} from "@sarge/benchmark";

// ── Direct cloud API calls (duplicated from run-cloud for isolation) ──

interface CloudCallResult {
  content: string;
  timeMs: number;
  timedOut: boolean;
  tokenCount: number;
  error?: string;
}

/** Models that require max_completion_tokens instead of max_tokens */
function needsCompletionTokensParam(model: string): boolean {
  return model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")
    || model.includes("gpt-5") || model.includes("nano")
    || model.includes("reasoning");
}

async function callCloudDirect(
  provider: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<CloudCallResult> {
  const TOKEN_LIMIT = 8192;
  switch (provider) {
    case "deepseek":
      return callOpenAICompat(
        "https://api.deepseek.com/chat/completions",
        process.env.DEEPSEEK_API_KEY || "",
        modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal
      );
    case "openai":
      return callOpenAICompat(
        "https://api.openai.com/v1/chat/completions",
        process.env.OPENAI_API_KEY || "",
        modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal
      );
    case "xai":
      return callOpenAICompat(
        "https://api.x.ai/v1/chat/completions",
        process.env.XAI_API_KEY || process.env.GROK_API_KEY || "",
        modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal
      );
    case "anthropic":
      return callAnthropic(modelId, systemPrompt, userPrompt, timeoutMs, signal);
    case "google":
      return callGemini(modelId, systemPrompt, userPrompt, timeoutMs, signal);
    case "ollama":
      return callOllama(modelId, systemPrompt, userPrompt, timeoutMs, signal);
    default: {
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      const baseUrlKey = `${provider.toUpperCase()}_BASE_URL`;
      const apiKey = process.env[envKey] || "";
      const KNOWN_BASE_URLS: Record<string, string> = {
        mistral: "https://api.mistral.ai/v1/chat/completions",
        huggingface: "https://api-inference.huggingface.co/v1/chat/completions",
        perplexity: "https://api.perplexity.ai/chat/completions",
        together: "https://api.together.xyz/v1/chat/completions",
        groq: "https://api.groq.com/openai/v1/chat/completions",
      };
      const baseUrl = process.env[baseUrlKey] || KNOWN_BASE_URLS[provider] || "";
      if (!apiKey || !baseUrl) {
        return { content: "", timeMs: 0, timedOut: false, tokenCount: 0, error: `No API key or base URL for provider: ${provider}` };
      }
      return callOpenAICompat(baseUrl, apiKey, modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal);
    }
  }
}

// ── Ollama (local models for hybrid chains) ──

async function callOllama(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<CloudCallResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  signal.addEventListener("abort", onParentAbort);

  let content = "";
  let tokenCount = 0;

  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userPrompt });

    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: `Ollama ${res.status}: ${errText.slice(0, 200)}` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { content: "", timeMs: Date.now() - start, timedOut: false, tokenCount: 0, error: "No response body" };

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            content += data.message.content;
            tokenCount++;
          }
        } catch {}
      }
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
      if (signal.aborted) return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: "Stopped by user" };
      return { content, timeMs: elapsed, timedOut: true, tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)) };
    }
    return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: String(err) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// ── OpenAI-compatible ──

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

  let content = "";
  let tokenCount = 0;

  try {
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userPrompt });

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(needsCompletionTokensParam(model) ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
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
          const text = data.choices?.[0]?.delta?.content;
          if (text) { content += text; tokenCount++; }
        } catch {}
      }
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
      if (signal.aborted) return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: "Stopped by user" };
      return { content, timeMs: elapsed, timedOut: true, tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)) };
    }
    return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: String(err) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// ── Anthropic ──

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
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2024-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        stream: true,
        system: systemPrompt || undefined,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

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

    return {
      content,
      timeMs: Date.now() - start,
      timedOut: false,
      tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)),
    };
  } catch (err: unknown) {
    const elapsed = Date.now() - start;
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

// ── Gemini ──

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
    const contents: { role: string; parts: { text: string }[] }[] = [];
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
          if (text) { content += text; tokenCount++; }
        } catch {}
      }
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
      if (signal.aborted) return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: "Stopped by user" };
      return { content, timeMs: elapsed, timedOut: true, tokenCount: Math.max(tokenCount, Math.ceil(content.length / 4)) };
    }
    return { content: "", timeMs: elapsed, timedOut: false, tokenCount: 0, error: String(err) };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

// ── Billing ──

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
        app: "trials-hybrid",
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

// ── Step Prompts ──

const STEP_SYSTEM = "You are a code builder assistant. Output a single complete HTML file with all CSS in a <style> tag and all JS in a <script> tag. No external dependencies except CDN libraries.";

function getStepPrompt(role: string, previousCode: string): string {
  switch (role.toLowerCase()) {
    case "scaffold":
      return ""; // Uses original scenario prompt
    case "enhance":
      return `You are enhancing an existing website. Here is the current code:\n\n\`\`\`html\n${previousCode}\n\`\`\`\n\nImprove the visual design, add animations, enhance responsive behavior, and polish the user experience. Keep all existing functionality. Output the complete improved HTML file.`;
    case "refactor":
      return `You are refactoring an existing website. Here is the current code:\n\n\`\`\`html\n${previousCode}\n\`\`\`\n\nRefactor for clean, maintainable code. Improve CSS organization, add proper semantic HTML, optimize JavaScript. Fix any bugs. Keep all existing features and styling. Output the complete improved HTML file.`;
    case "finish":
      return `You are doing a final polish pass on a website. Here is the current code:\n\n\`\`\`html\n${previousCode}\n\`\`\`\n\nAdd final polish: micro-interactions, accessibility attributes, performance optimizations, cross-browser fixes. Make it production-ready. Output the complete improved HTML file.`;
    default:
      // Custom role — generic "improve" prompt
      return `You are performing the "${role}" step on an existing website. Here is the current code:\n\n\`\`\`html\n${previousCode}\n\`\`\`\n\nApply your "${role}" improvements while keeping all existing functionality. Output the complete improved HTML file.`;
  }
}

// ── POST handler ──

export async function POST(request: NextRequest) {
  const config: HybridBenchmarkConfig = await request.json();
  const { chains, scenarioId } = config;

  const scenario = scenarioId
    ? CLOUD_SCENARIOS.find((s) => s.id === scenarioId) || CLOUD_SCENARIOS[0]
    : CLOUD_SCENARIOS[0]; // Default: R1 Restaurant

  const baseUrl = new URL(request.url).origin;
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let totalCost = 0;

      function emit(event: HybridEvent) {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {}
      }

      emit({
        type: "hybrid:start",
        message: `Hybrid Forge Trials — ${chains.length} chains × ${scenario.name} scenario`,
        timestamp: Date.now(),
      });

      const allChainResults: HybridChainResult[] = [];

      for (let ci = 0; ci < chains.length; ci++) {
        if (abortController.signal.aborted) break;

        const chain = chains[ci];
        const stepResults: HybridStepResult[] = [];
        let chainCost = 0;
        let chainTimeMs = 0;
        let previousCode = "";

        emit({
          type: "hybrid:chain-start",
          chainId: chain.id,
          message: `Chain ${ci + 1}/${chains.length}: ${chain.name} (${chain.steps.length} steps)`,
          timestamp: Date.now(),
        });

        for (let si = 0; si < chain.steps.length; si++) {
          if (abortController.signal.aborted) break;

          const step = chain.steps[si];
          const isFirst = si === 0;

          emit({
            type: "hybrid:step-start",
            chainId: chain.id,
            stepIndex: si,
            message: `Step ${si + 1}/${chain.steps.length}: ${step.role} → ${step.modelName}`,
            timestamp: Date.now(),
          });

          // First step uses the scenario prompt; subsequent steps use the chain output
          const userPrompt = isFirst
            ? (chain.prompt || scenario.prompt)
            : getStepPrompt(step.role, previousCode);

          const timeout = isFirst ? scenario.timeout : 180_000; // 3 min for non-scaffold steps

          const result = await callCloudDirect(
            step.provider,
            step.modelId,
            STEP_SYSTEM,
            userPrompt,
            timeout,
            abortController.signal
          );

          const cost = await logBilling(baseUrl, step.modelId, step.provider, result.tokenCount, result.timeMs);
          totalCost += cost;
          chainCost += cost;
          chainTimeMs += result.timeMs;

          // Extract code for the next step
          const code = extractCode(result.content) || result.content;
          previousCode = code;

          // Score this step's output
          const scored = scoreResponse(result.content, scenario.validation);
          scored.score.tier = getCloudTier(scored.score.total);

          const stepResult: HybridStepResult = {
            stepIndex: si,
            modelId: step.modelId,
            provider: step.provider,
            role: step.role,
            content: result.content,
            extractedCode: code,
            score: scored.score,
            timeMs: result.timeMs,
            tokenCount: result.tokenCount,
            cost,
          };

          stepResults.push(stepResult);

          emit({
            type: "hybrid:step-complete",
            chainId: chain.id,
            stepIndex: si,
            stepResult,
            message: `${step.role} (${step.modelName}): ${scored.score.total}/100 — ${formatTime(result.timeMs)}`,
            timestamp: Date.now(),
          });

          // If step errored out with no content, stop the chain
          if (result.error && !result.content) {
            emit({
              type: "hybrid:error",
              chainId: chain.id,
              stepIndex: si,
              message: `Chain "${chain.name}" failed at step ${si + 1} (${step.role}): ${result.error}`,
              timestamp: Date.now(),
            });
            break;
          }
        }

        // Final score = last step's score
        const finalScore: ScoreBreakdown = stepResults.length > 0
          ? stepResults[stepResults.length - 1].score
          : { codeExtracted: 0, validHtml: 0, requiredElements: 0, requiredKeywords: 0, cssCriteria: 0, jsCriteria: 0, codeLength: 0, total: 0, tier: "fail" };

        const chainResult: HybridChainResult = {
          chainId: chain.id,
          chainName: chain.name,
          steps: stepResults,
          finalScore,
          totalTimeMs: chainTimeMs,
          totalCost: chainCost,
          timestamp: Date.now(),
        };

        allChainResults.push(chainResult);

        emit({
          type: "hybrid:chain-complete",
          chainId: chain.id,
          chainResult,
          message: `Chain "${chain.name}": ${finalScore.total}/100 — ${formatTime(chainTimeMs)} — $${chainCost.toFixed(4)}`,
          timestamp: Date.now(),
        });
      }

      emit({
        type: abortController.signal.aborted ? "hybrid:stopped" : "hybrid:complete",
        message: abortController.signal.aborted
          ? `Hybrid Trials stopped. Cost: $${totalCost.toFixed(4)}`
          : `Hybrid Trials complete — ${allChainResults.length} chains scored. Total cost: $${totalCost.toFixed(4)}`,
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
