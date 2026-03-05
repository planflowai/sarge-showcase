/**
 * Hybrid Forge Trials — Chain Runner API
 * POST: Runs multi-model chains where each step feeds output to the next.
 * Scores the final output. Streams NDJSON progress events.
 */

import { NextRequest } from "next/server";
import {
  CLOUD_SCENARIOS,
  ALL_HYBRID_SCENARIOS,
  scoreResponse,
  extractCode,
  getCloudTier,
  type HybridBenchmarkConfig,
  type HybridEvent,
  type HybridStepResult,
  type HybridChainResult,
  type ScoreBreakdown,
  type StepChangelog,
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
  signal: AbortSignal,
  onChunk?: (content: string) => void
): Promise<CloudCallResult> {
  const TOKEN_LIMIT = 8192;
  switch (provider) {
    case "deepseek":
      return callOpenAICompat(
        "https://api.deepseek.com/chat/completions",
        process.env.DEEPSEEK_API_KEY || "",
        modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal, onChunk
      );
    case "openai":
      return callOpenAICompat(
        "https://api.openai.com/v1/chat/completions",
        process.env.OPENAI_API_KEY || "",
        modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal, onChunk
      );
    case "xai":
      return callOpenAICompat(
        "https://api.x.ai/v1/chat/completions",
        process.env.XAI_API_KEY || process.env.GROK_API_KEY || "",
        modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal, onChunk
      );
    case "anthropic":
      return callAnthropic(modelId, systemPrompt, userPrompt, timeoutMs, signal, onChunk);
    case "google":
      return callGemini(modelId, systemPrompt, userPrompt, timeoutMs, signal, onChunk);
    case "ollama":
      return callOllama(modelId, systemPrompt, userPrompt, timeoutMs, signal, onChunk);
    case "lmstudio":
      return callOpenAICompat(
        process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1/chat/completions",
        "lm-studio",
        modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal, onChunk
      );
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
      return callOpenAICompat(baseUrl, apiKey, modelId, systemPrompt, userPrompt, TOKEN_LIMIT, timeoutMs, signal, onChunk);
    }
  }
}

// ── Ollama (local models for hybrid chains) ──

async function callOllama(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  signal: AbortSignal,
  onChunk?: (content: string) => void
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
            onChunk?.(content);
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
  signal: AbortSignal,
  onChunk?: (content: string) => void
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
          if (text) { content += text; tokenCount++; onChunk?.(content); }
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
  signal: AbortSignal,
  onChunk?: (content: string) => void
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
        "anthropic-version": "2023-06-01",
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
            onChunk?.(content);
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
  signal: AbortSignal,
  onChunk?: (content: string) => void
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
          if (text) { content += text; tokenCount++; onChunk?.(content); }
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
      signal: AbortSignal.timeout(5000), // Don't let billing stall the chain
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

const LOCAL_MODEL_PREFIX = `CRITICAL INSTRUCTION: You must output ONLY complete, valid HTML.
No explanations. No apologies. No commentary. No markdown. No code blocks.
Your entire response must start with <!DOCTYPE html> and end with </html>.
If you cannot complete the full site, output as much valid HTML as possible starting from <!DOCTYPE html>.
Never output anything outside of HTML tags.

`;

// ── Output validation gate ──
const CHAT_RESPONSE_PATTERNS = [
  "i'm sorry", "as an ai", "as a text-based", "could you provide",
  "i don't see any", "please provide",
];

function validateStepOutput(code: string): { valid: boolean; reason: string } {
  const lower = code.toLowerCase();
  if (!lower.includes("<!doctype") && !lower.includes("<html")) {
    return { valid: false, reason: "No valid HTML (missing <!DOCTYPE or <html>)" };
  }
  // Body tag check — <html> without <body> is CSS-only output
  if (!lower.includes("<body")) {
    return { valid: false, reason: "No <body> tag — likely CSS-only output" };
  }
  if (code.length < 2000) {
    return { valid: false, reason: `Output too short (${code.length} chars, min 2000)` };
  }
  for (const pattern of CHAT_RESPONSE_PATTERNS) {
    if (lower.includes(pattern)) {
      return { valid: false, reason: `Chat response detected ("${pattern}")` };
    }
  }
  return { valid: true, reason: "" };
}

function getStepRoleInstruction(role: string): string | null {
  switch (role.toLowerCase()) {
    case "build":
      return null; // Build = full scenario prompt
    case "improve":
      return "Add missing sections, flesh out placeholder content, improve structure and completeness.";
    case "refine":
      return "Fix all CSS errors, ensure full responsiveness, fix any broken layouts or missing styles.";
    case "polish":
      return "Add animations, transitions, micro-interactions, visual polish. Make it production grade.";
    case "check":
      return "Audit every section. Fix broken elements, validate all required sections exist, ensure JavaScript works. Output the final clean complete HTML.";
    default:
      return `Improve the site based on your role: ${role}. Keep everything working, only add or fix.`;
  }
}

function getStepPrompt(role: string, previousCode: string, scenarioPrompt: string): string {
  const instruction = getStepRoleInstruction(role);
  // "Build" role gets the full scenario prompt
  if (instruction === null) return scenarioPrompt;

  return `You are improving an existing website. Here is the current HTML:

${previousCode}

Your specific task for this step: ${instruction}

CRITICAL: Keep everything that is already working. Do not remove sections. Do not rebuild from scratch. Only add, fix, or improve. Output the complete improved HTML starting with <!DOCTYPE html>.`;
}

// ── Partial HTML extraction for streaming preview ──
// Unlike extractCode (needs closing tags), this grabs whatever HTML exists so far.
function extractPartialHtml(content: string): string {
  // Try code fence: ```html\n...  (no closing fence needed)
  const fenceMatch = content.match(/```(?:html)?\s*\n([\s\S]+)/i);
  if (fenceMatch) {
    let code = fenceMatch[1];
    // Strip trailing ``` if present
    const closeIdx = code.lastIndexOf("```");
    if (closeIdx !== -1) code = code.slice(0, closeIdx);
    return code.trim();
  }
  // Try raw HTML: find <!DOCTYPE or <html
  const lower = content.toLowerCase();
  const start = Math.min(
    lower.indexOf("<!doctype") !== -1 ? lower.indexOf("<!doctype") : Infinity,
    lower.indexOf("<html") !== -1 ? lower.indexOf("<html") : Infinity
  );
  if (start !== Infinity) {
    return content.slice(start).trim();
  }
  return "";
}

// ── Changelog generation — simple HTML diff between steps ──

function extractSections(html: string): string[] {
  const matches = html.match(/<(section|header|footer|nav|main|article|aside)[^>]*>/gi) || [];
  return matches.map(m => {
    // Try to get id or class for identification
    const idMatch = m.match(/id=["']([^"']+)["']/i);
    const classMatch = m.match(/class=["']([^"']+)["']/i);
    const tagMatch = m.match(/<(\w+)/);
    const tag = tagMatch ? tagMatch[1] : "unknown";
    if (idMatch) return `<${tag}#${idMatch[1]}>`;
    if (classMatch) return `<${tag}.${classMatch[1].split(/\s+/)[0]}>`;
    return `<${tag}>`;
  });
}

function countCssRules(html: string): number {
  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  let count = 0;
  for (const block of styleBlocks) {
    const inner = block.replace(/<\/?style[^>]*>/gi, "");
    // Count rule selectors (lines with { )
    const rules = inner.match(/[^{}]+\{/g) || [];
    count += rules.length;
  }
  return count;
}

function countJsFunctions(html: string): number {
  const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  let count = 0;
  for (const block of scriptBlocks) {
    const inner = block.replace(/<\/?script[^>]*>/gi, "");
    const fns = inner.match(/function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>/g) || [];
    count += fns.length;
  }
  return count;
}

function generateChangelog(previousCode: string, currentCode: string): StepChangelog {
  const prevSections = extractSections(previousCode);
  const currSections = extractSections(currentCode);
  const prevCss = countCssRules(previousCode);
  const currCss = countCssRules(currentCode);
  const prevJs = countJsFunctions(previousCode);
  const currJs = countJsFunctions(currentCode);

  const added = currSections.filter(s => !prevSections.includes(s));
  const removed = prevSections.filter(s => !currSections.includes(s));

  const regressionDetails: string[] = [];
  if (removed.length > 0) {
    regressionDetails.push(`Missing from previous step: ${removed.join(", ")}`);
  }

  return {
    sectionsAdded: added,
    sectionsRemoved: removed,
    cssRulesAdded: Math.max(0, currCss - prevCss),
    cssRulesRemoved: Math.max(0, prevCss - currCss),
    jsFunctionsAdded: Math.max(0, currJs - prevJs),
    jsFunctionsRemoved: Math.max(0, prevJs - currJs),
    regressionCheck: removed.length === 0 ? "PASSED" : "FAILED",
    regressionDetails,
  };
}

function formatElapsed(startMs: number): string {
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── POST handler ──

export async function POST(request: NextRequest) {
  const config: HybridBenchmarkConfig & { guardianModelId?: string; guardianProvider?: string } = await request.json();
  const { chains, scenarioId, guardianModelId, guardianProvider } = config;

  const scenario = scenarioId
    ? ALL_HYBRID_SCENARIOS.find((s) => s.id === scenarioId) || CLOUD_SCENARIOS[0]
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
        } catch (err) {
          console.warn("[HYBRID TRIAL] emit() failed — stream may be closed:", err instanceof Error ? err.message : String(err));
        }
      }

      const chainStartTime = Date.now();
      const guardianLabel = guardianModelId
        ? `${guardianModelId} (${guardianProvider})`
        : "Hardcoded validation";

      emit({
        type: "hybrid:start",
        message: `Hybrid Forge Trials — ${chains.length} chains × ${scenario.name} scenario`,
        timestamp: Date.now(),
      });

      emit({
        type: "hybrid:build-log",
        message: `[${formatElapsed(chainStartTime)}] Chain started — Guardian: ${guardianLabel} — Scenario: ${scenario.name}`,
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
        let lastGoodCode = "";

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

          const stepIsLocal = step.provider === "ollama" || step.provider === "lmstudio";
          emit({
            type: "hybrid:build-log",
            chainId: chain.id,
            stepIndex: si,
            message: `[${formatElapsed(chainStartTime)}] Step ${si + 1} started — Model: ${step.modelName} (${stepIsLocal ? "local" : "cloud"}) — Role: ${step.role}`,
            timestamp: Date.now(),
          });

          // First step uses the full scenario prompt; subsequent steps get targeted instructions
          const scenarioPrompt = chain.prompt || scenario.prompt;
          const userPrompt = isFirst
            ? scenarioPrompt
            : getStepPrompt(step.role, previousCode, scenarioPrompt);

          const timeout = isFirst ? scenario.timeout : 180_000; // 3 min for non-scaffold steps

          // Heartbeat keeps the NDJSON stream alive during long model calls.
          // Without this, the connection times out after ~60s of silence and
          // the frontend never receives the results.
          let heartbeatCount = 0;
          const heartbeat = setInterval(() => {
            heartbeatCount++;
            emit({
              type: "hybrid:heartbeat",
              chainId: chain.id,
              stepIndex: si,
              message: `Step ${si + 1}: ${step.modelName} generating... (${heartbeatCount * 10}s)`,
              timestamp: Date.now(),
            });
          }, 10_000);

          // Streaming preview — emit partial HTML as model generates
          let lastStreamEmit = 0;
          let lastStreamLen = 0;
          const onChunk = (accumulated: string) => {
            const now = Date.now();
            // Throttle: at least 500ms gap AND at least 200 chars new content
            if (now - lastStreamEmit < 500 || accumulated.length - lastStreamLen < 200) return;
            // Extract renderable HTML from partial content
            const html = extractPartialHtml(accumulated);
            if (!html || html.length < 50) return;
            lastStreamEmit = now;
            lastStreamLen = accumulated.length;
            emit({
              type: "hybrid:step-streaming",
              chainId: chain.id,
              stepIndex: si,
              partialHtml: html,
              message: `Step ${si + 1}: streaming ${html.length} chars...`,
              timestamp: now,
            });
          };

          // FIX 2: Local models get strict HTML-only system prompt
          const isLocal = step.provider === "ollama" || step.provider === "lmstudio";
          const systemPrompt = isLocal ? LOCAL_MODEL_PREFIX + STEP_SYSTEM : STEP_SYSTEM;

          const result = await callCloudDirect(
            step.provider,
            step.modelId,
            systemPrompt,
            userPrompt,
            timeout,
            abortController.signal,
            onChunk
          );

          clearInterval(heartbeat);

          const cost = await logBilling(baseUrl, step.modelId, step.provider, result.tokenCount, result.timeMs);
          totalCost += cost;
          chainCost += cost;
          chainTimeMs += result.timeMs;

          // Extract code for the next step
          const code = extractCode(result.content) || result.content;

          // Build log — streaming status
          emit({
            type: "hybrid:build-log",
            chainId: chain.id,
            stepIndex: si,
            message: `[${formatElapsed(chainStartTime)}] Step ${si + 1} complete — ${code.length} chars — ${formatTime(result.timeMs)}`,
            timestamp: Date.now(),
          });

          // FIX 1: Output validation gate — validate before passing to next step
          const validation = validateStepOutput(code);
          let stepFailed = false;
          const hasBody = code.toLowerCase().includes("<body");

          if (!validation.valid && !result.error) {
            stepFailed = true;
            console.warn(`[HYBRID] Step ${si + 1} output INVALID: ${validation.reason} (${code.length} chars from ${step.modelName})`);
            emit({
              type: "hybrid:error",
              chainId: chain.id,
              stepIndex: si,
              message: `Step ${si + 1} output invalid — ${validation.reason}. Using last good output.`,
              timestamp: Date.now(),
            });

            // Guardian REJECTED event
            emit({
              type: "hybrid:guardian",
              chainId: chain.id,
              stepIndex: si,
              message: `Step ${si + 1} output REJECTED — ${validation.reason} — passing Step ${si} HTML forward`,
              timestamp: Date.now(),
            });

            emit({
              type: "hybrid:build-log",
              chainId: chain.id,
              stepIndex: si,
              message: `[${formatElapsed(chainStartTime)}] Thread Guardian: Step ${si + 1} output REJECTED — ${validation.reason}`,
              timestamp: Date.now(),
            });

            // Use last known good HTML instead of garbage
            if (lastGoodCode) {
              previousCode = lastGoodCode;
            }
            // Don't update previousCode with bad output
          } else if (code && validation.valid) {
            // Guardian PASSED event
            emit({
              type: "hybrid:guardian",
              chainId: chain.id,
              stepIndex: si,
              message: `Step ${si + 1} output PASSED — ${code.length} chars, valid HTML, body tag ${hasBody ? "present" : "missing"}, no chat patterns detected`,
              timestamp: Date.now(),
            });

            emit({
              type: "hybrid:build-log",
              chainId: chain.id,
              stepIndex: si,
              message: `[${formatElapsed(chainStartTime)}] Thread Guardian: Step ${si + 1} output approved — passing to Step ${si + 2}`,
              timestamp: Date.now(),
            });

            previousCode = code;
            lastGoodCode = code;
          } else {
            previousCode = code;
          }

          // Generate changelog (diff from previous step)
          let changelog: StepChangelog | undefined;
          if (si > 0 && lastGoodCode && !stepFailed) {
            const prevStepCode = stepResults[si - 1]?.extractedCode || "";
            if (prevStepCode) {
              changelog = generateChangelog(prevStepCode, code);
            }
          }

          // Score this step's output (score the actual output, even if invalid)
          const scored = scoreResponse(result.content, scenario.validation);
          scored.score.tier = stepFailed ? "fail" : getCloudTier(scored.score.total);

          const stepResult: HybridStepResult = {
            stepIndex: si,
            modelId: step.modelId,
            provider: step.provider,
            role: step.role,
            content: result.content,
            extractedCode: stepFailed && lastGoodCode ? lastGoodCode : code,
            score: scored.score,
            timeMs: result.timeMs,
            tokenCount: result.tokenCount,
            cost,
            changelog,
          };

          stepResults.push(stepResult);

          emit({
            type: "hybrid:step-complete",
            chainId: chain.id,
            stepIndex: si,
            stepResult,
            message: stepFailed
              ? `${step.role} (${step.modelName}): FAILED — ${validation.reason}`
              : `${step.role} (${step.modelName}): ${scored.score.total}/100 — ${formatTime(result.timeMs)}`,
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

        emit({
          type: "hybrid:build-log",
          chainId: chain.id,
          message: `[${formatElapsed(chainStartTime)}] Chain complete — Final score: ${finalScore.total} — Grade: ${finalScore.tier} — Cost: $${chainCost.toFixed(4)}`,
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
