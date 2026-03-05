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
  type JuryVerdict,
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

// ── Thread Guardian 3-Tier Check ──

const GUARDIAN_T1_SYSTEM = `You are a code quality guardian. Analyze the provided HTML output and check:
1. Valid HTML structure (DOCTYPE, html, head, body tags present and properly nested)
2. CSS exists in <style> tags (not empty)
3. Content exists in <body> (not just boilerplate)
4. No broken/unclosed tags

Output ONLY a JSON object:
{"tier":1,"passed":boolean,"charCount":number,"hasDOCTYPE":boolean,"hasHead":boolean,"hasBody":boolean,"hasCSS":boolean,"hasContent":boolean,"issues":["string"],"escalate":boolean}`;

const GUARDIAN_T2_SYSTEM = `You are a content quality auditor. You receive HTML and a scenario description. Check:
1. Does the content match the scenario? (e.g., if it's a restaurant site, does it have menu/hours/location?)
2. Is it a real, filled-out site or a generic template with "Lorem ipsum" placeholders?
3. Are there at least 3 distinct content sections?
4. Does it have real text content (not just headings with no body text)?

Output ONLY a JSON object:
{"tier":2,"passed":boolean,"scenarioMatch":boolean,"isGeneric":boolean,"sectionCount":number,"hasRealContent":boolean,"issues":["string"],"escalate":boolean}`;

const GUARDIAN_T3_SYSTEM = `You are a forensic code auditor. Perform a deep analysis of this HTML:
1. Accessibility: alt tags, ARIA labels, semantic HTML
2. Responsiveness: media queries present, viewport meta tag
3. JavaScript quality: no errors, event handlers present if interactive
4. CSS quality: consistent styling, no conflicting rules
5. Overall production readiness

Output ONLY a JSON object:
{"tier":3,"passed":boolean,"accessibility":{"score":number,"issues":["string"]},"responsiveness":{"hasMediaQueries":boolean,"hasViewport":boolean},"jsQuality":{"hasErrors":boolean,"hasEventHandlers":boolean},"cssQuality":{"ruleCount":number,"issues":["string"]},"productionReady":boolean,"summary":"string"}`;

interface GuardianTierResult {
  tier: 1 | 2 | 3;
  passed: boolean;
  message: string;
  escalate: boolean;
  durationMs: number;
}

/**
 * Run Thread Guardian 3-tier escalation check on step output.
 * T1: Algorithmic + basic AI structure check
 * T2: Content quality + scenario match (only if T1 flags or guardian model configured)
 * T3: Full forensic audit (only if T1 or T2 escalate)
 *
 * Uses the chain's existing callCloudDirect for model calls.
 * Non-blocking: failures are logged but never block the chain.
 */
async function runGuardianTieredCheck(
  code: string,
  scenarioPrompt: string,
  guardianModelId: string | undefined,
  guardianProvider: string | undefined,
  stepIndex: number,
  signal: AbortSignal,
  emit: (event: HybridEvent) => void,
  chainStartTime: number,
  chainId: string,
): Promise<GuardianTierResult[]> {
  const results: GuardianTierResult[] = [];

  // If no guardian model configured, do algorithmic-only T1 check
  if (!guardianModelId || !guardianProvider) {
    // T1 algorithmic check (already done by validateStepOutput — just emit the log)
    const t1: GuardianTierResult = {
      tier: 1,
      passed: true,
      message: `${code.length} chars, valid HTML structure confirmed (algorithmic)`,
      escalate: false,
      durationMs: 0,
    };
    results.push(t1);
    emit({
      type: "hybrid:guardian",
      chainId,
      stepIndex,
      message: `[Guardian T1] Step ${stepIndex + 1} output — PASSED (${t1.message})`,
      timestamp: Date.now(),
    });
    emit({
      type: "hybrid:build-log",
      chainId,
      stepIndex,
      message: `[${formatElapsed(chainStartTime)}] Guardian T1: PASSED — ${t1.message}`,
      timestamp: Date.now(),
    });
    return results;
  }

  // ── T1: Structure check via AI model ──
  const t1Start = Date.now();
  try {
    const t1Result = await callCloudDirect(
      guardianProvider, guardianModelId,
      GUARDIAN_T1_SYSTEM,
      `Analyze this HTML output (${code.length} chars):\n\n${code.slice(0, 8000)}`,
      30_000, signal
    );
    const t1Duration = Date.now() - t1Start;
    let t1Parsed: { passed?: boolean; escalate?: boolean; issues?: string[] } = {};
    try { t1Parsed = JSON.parse(t1Result.content); } catch { /* parse failure = pass */ }

    const t1: GuardianTierResult = {
      tier: 1,
      passed: t1Parsed.passed !== false,
      message: t1Parsed.passed !== false
        ? `${code.length} chars, valid HTML, scenario match confirmed`
        : `Issues: ${(t1Parsed.issues || []).join(", ")}`,
      escalate: t1Parsed.escalate === true,
      durationMs: t1Duration,
    };
    results.push(t1);

    emit({
      type: "hybrid:guardian",
      chainId, stepIndex,
      message: `[Guardian T1] Step ${stepIndex + 1} output — ${t1.passed ? "PASSED" : "FLAGGED"} (${t1.message})`,
      timestamp: Date.now(),
    });
    emit({
      type: "hybrid:build-log",
      chainId, stepIndex,
      message: `[${formatElapsed(chainStartTime)}] Guardian T1: ${t1.passed ? "PASSED" : "FLAGGED"} — ${t1.message} (${formatTime(t1Duration)})`,
      timestamp: Date.now(),
    });

    // ── T2: Content quality check (if T1 escalates) ──
    if (t1.escalate) {
      const t2Start = Date.now();
      try {
        const t2Result = await callCloudDirect(
          guardianProvider, guardianModelId,
          GUARDIAN_T2_SYSTEM,
          `Scenario: ${scenarioPrompt.slice(0, 2000)}\n\nHTML to evaluate:\n${code.slice(0, 8000)}`,
          30_000, signal
        );
        const t2Duration = Date.now() - t2Start;
        let t2Parsed: { passed?: boolean; escalate?: boolean; scenarioMatch?: boolean; isGeneric?: boolean; issues?: string[] } = {};
        try { t2Parsed = JSON.parse(t2Result.content); } catch { /* parse failure = pass */ }

        const t2: GuardianTierResult = {
          tier: 2,
          passed: t2Parsed.passed !== false,
          message: t2Parsed.passed !== false
            ? `content quality: good, ${t2Parsed.scenarioMatch !== false ? "scenario match" : "no match"}, no generic placeholders detected`
            : `Issues: ${(t2Parsed.issues || []).join(", ")}`,
          escalate: t2Parsed.escalate === true,
          durationMs: t2Duration,
        };
        results.push(t2);

        emit({
          type: "hybrid:guardian",
          chainId, stepIndex,
          message: `[Guardian T2] Step ${stepIndex + 1} output — ${t2.passed ? "PASSED" : "FLAGGED"} (${t2.message})`,
          timestamp: Date.now(),
        });
        emit({
          type: "hybrid:build-log",
          chainId, stepIndex,
          message: `[${formatElapsed(chainStartTime)}] Guardian T2: ${t2.passed ? "PASSED" : "FLAGGED"} — ${t2.message} (${formatTime(t2Duration)})`,
          timestamp: Date.now(),
        });

        // ── T3: Full forensic audit (if T2 escalates) ──
        if (t2.escalate) {
          const t3Start = Date.now();
          try {
            const t3Result = await callCloudDirect(
              guardianProvider, guardianModelId,
              GUARDIAN_T3_SYSTEM,
              `Full HTML for forensic audit:\n${code.slice(0, 12000)}`,
              45_000, signal
            );
            const t3Duration = Date.now() - t3Start;
            let t3Parsed: { passed?: boolean; summary?: string; productionReady?: boolean } = {};
            try { t3Parsed = JSON.parse(t3Result.content); } catch { /* parse failure = pass */ }

            const t3: GuardianTierResult = {
              tier: 3,
              passed: t3Parsed.passed !== false,
              message: t3Parsed.summary || (t3Parsed.productionReady ? "production ready" : "needs improvement"),
              escalate: false,
              durationMs: t3Duration,
            };
            results.push(t3);

            emit({
              type: "hybrid:guardian",
              chainId, stepIndex,
              message: `[Guardian T3] Step ${stepIndex + 1} output — ${t3.passed ? "PASSED" : "FLAGGED"} (${t3.message})`,
              timestamp: Date.now(),
            });
            emit({
              type: "hybrid:build-log",
              chainId, stepIndex,
              message: `[${formatElapsed(chainStartTime)}] Guardian T3: ${t3.passed ? "PASSED" : "FLAGGED"} — ${t3.message} (${formatTime(t3Duration)})`,
              timestamp: Date.now(),
            });
          } catch (err) {
            emit({
              type: "hybrid:build-log",
              chainId, stepIndex,
              message: `[${formatElapsed(chainStartTime)}] Guardian T3: SKIPPED — ${err instanceof Error ? err.message : "error"}`,
              timestamp: Date.now(),
            });
          }
        } else {
          emit({
            type: "hybrid:guardian",
            chainId, stepIndex,
            message: `[Guardian T3] Not triggered — T1 and T2 passed`,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        emit({
          type: "hybrid:build-log",
          chainId, stepIndex,
          message: `[${formatElapsed(chainStartTime)}] Guardian T2: SKIPPED — ${err instanceof Error ? err.message : "error"}`,
          timestamp: Date.now(),
        });
      }
    } else {
      // T1 passed without escalation — T2 and T3 not triggered
      emit({
        type: "hybrid:guardian",
        chainId, stepIndex,
        message: `[Guardian T2] Not triggered — T1 passed without escalation`,
        timestamp: Date.now(),
      });
      emit({
        type: "hybrid:guardian",
        chainId, stepIndex,
        message: `[Guardian T3] Not triggered — T1 and T2 passed`,
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    emit({
      type: "hybrid:build-log",
      chainId, stepIndex,
      message: `[${formatElapsed(chainStartTime)}] Guardian T1: SKIPPED — ${err instanceof Error ? err.message : "error"}`,
      timestamp: Date.now(),
    });
  }

  return results;
}

// ── Jury Duty — Final Output Verdict ──

const JURY_SYSTEM_PROMPT = `You are a code quality juror. You evaluate an HTML website output against the original scenario prompt.

Evaluate on three criteria:
1. COMPLETENESS — Are all requested sections/features present? List what's present and what's missing.
2. QUALITY — Is this production grade HTML/CSS/JS or placeholder/template quality? Check styling, interactivity, responsiveness.
3. ACCURACY — Does the output match what the scenario asked for? Is the content relevant and specific?

Output ONLY a JSON object:
{"completeness":{"pass":boolean,"detail":"string"},"quality":{"pass":boolean,"detail":"string"},"accuracy":{"pass":boolean,"detail":"string"}}`;

interface JuryModelResult {
  model: string;
  provider: string;
  completeness: { pass: boolean; detail: string };
  quality: { pass: boolean; detail: string };
  accuracy: { pass: boolean; detail: string };
  error?: string;
}

/**
 * Run Jury Duty verdict at chain completion.
 * Uses up to 3 models from the chain steps to evaluate the final output.
 * Non-blocking: failures produce partial verdicts.
 */
async function runJuryVerdict(
  finalCode: string,
  scenarioPrompt: string,
  chainSteps: Array<{ modelId: string; provider: string; modelName: string }>,
  guardianModelId: string | undefined,
  guardianProvider: string | undefined,
  signal: AbortSignal,
  emit: (event: HybridEvent) => void,
  chainStartTime: number,
  chainId: string,
): Promise<JuryVerdict | null> {
  // Pick up to 3 unique models for the jury
  const juryModels: Array<{ modelId: string; provider: string; name: string }> = [];

  // Add guardian model first if configured
  if (guardianModelId && guardianProvider) {
    juryModels.push({ modelId: guardianModelId, provider: guardianProvider, name: guardianModelId });
  }

  // Add unique models from chain steps (avoid duplicates)
  const seen = new Set(juryModels.map(m => `${m.provider}:${m.modelId}`));
  for (const step of chainSteps) {
    const key = `${step.provider}:${step.modelId}`;
    if (!seen.has(key) && juryModels.length < 3) {
      seen.add(key);
      juryModels.push({ modelId: step.modelId, provider: step.provider, name: step.modelName });
    }
  }

  if (juryModels.length === 0) {
    emit({
      type: "hybrid:build-log",
      chainId,
      message: `[${formatElapsed(chainStartTime)}] Jury Duty: SKIPPED — no models available for jury`,
      timestamp: Date.now(),
    });
    return null;
  }

  emit({
    type: "hybrid:build-log",
    chainId,
    message: `[${formatElapsed(chainStartTime)}] Jury Duty: Convening ${juryModels.length} juror${juryModels.length > 1 ? "s" : ""} — ${juryModels.map(m => m.name).join(", ")}`,
    timestamp: Date.now(),
  });

  const juryPrompt = `Original scenario prompt:\n${scenarioPrompt.slice(0, 3000)}\n\nFinal HTML output to evaluate (${finalCode.length} chars):\n${finalCode.slice(0, 10000)}`;

  // Run all jury models in parallel
  const juryResults: JuryModelResult[] = await Promise.all(
    juryModels.map(async (juror) => {
      try {
        const result = await callCloudDirect(
          juror.provider, juror.modelId,
          JURY_SYSTEM_PROMPT, juryPrompt,
          45_000, signal
        );

        let parsed: { completeness?: { pass?: boolean; detail?: string }; quality?: { pass?: boolean; detail?: string }; accuracy?: { pass?: boolean; detail?: string } } = {};
        try { parsed = JSON.parse(result.content); } catch {
          // Try extracting JSON from response
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) try { parsed = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
        }

        return {
          model: juror.name,
          provider: juror.provider,
          completeness: { pass: parsed.completeness?.pass !== false, detail: parsed.completeness?.detail || "evaluated" },
          quality: { pass: parsed.quality?.pass !== false, detail: parsed.quality?.detail || "evaluated" },
          accuracy: { pass: parsed.accuracy?.pass !== false, detail: parsed.accuracy?.detail || "evaluated" },
        };
      } catch (err) {
        return {
          model: juror.name,
          provider: juror.provider,
          completeness: { pass: true, detail: "juror error — defaulting to pass" },
          quality: { pass: true, detail: "juror error — defaulting to pass" },
          accuracy: { pass: true, detail: "juror error — defaulting to pass" },
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })
  );

  // Aggregate verdict
  const totalJurors = juryResults.length;
  const completenessPass = juryResults.filter(r => r.completeness.pass).length;
  const qualityPass = juryResults.filter(r => r.quality.pass).length;
  const accuracyPass = juryResults.filter(r => r.accuracy.pass).length;

  const allPass = completenessPass === totalJurors && qualityPass === totalJurors && accuracyPass === totalJurors;
  const anyFail = completenessPass < Math.ceil(totalJurors / 2) || qualityPass < Math.ceil(totalJurors / 2) || accuracyPass < Math.ceil(totalJurors / 2);

  const agreementCount = Math.min(completenessPass, qualityPass, accuracyPass);

  const verdict: JuryVerdict = {
    modelsUsed: juryResults.map(r => r.model),
    completeness: {
      pass: completenessPass >= Math.ceil(totalJurors / 2),
      detail: completenessPass === totalJurors
        ? juryResults[0].completeness.detail
        : `${completenessPass}/${totalJurors} pass — ${juryResults.find(r => !r.completeness.pass)?.completeness.detail || ""}`,
    },
    quality: {
      pass: qualityPass >= Math.ceil(totalJurors / 2),
      detail: qualityPass === totalJurors
        ? juryResults[0].quality.detail
        : `${qualityPass}/${totalJurors} pass — ${juryResults.find(r => !r.quality.pass)?.quality.detail || ""}`,
    },
    accuracy: {
      pass: accuracyPass >= Math.ceil(totalJurors / 2),
      detail: accuracyPass === totalJurors
        ? juryResults[0].accuracy.detail
        : `${accuracyPass}/${totalJurors} pass — ${juryResults.find(r => !r.accuracy.pass)?.accuracy.detail || ""}`,
    },
    overall: allPass ? "APPROVED" : anyFail ? "REJECTED" : "APPROVED WITH WARNINGS",
    agreementCount,
    totalJurors,
  };

  // Emit jury verdict
  const verdictIcon = (pass: boolean) => pass ? "✅" : "⚠️";
  const verdictLines = [
    `JURY VERDICT — ${agreementCount}/${totalJurors} models agree`,
    `${verdictIcon(verdict.completeness.pass)} Completeness: ${verdict.completeness.pass ? "PASS" : "SPLIT"} — ${verdict.completeness.detail}`,
    `${verdictIcon(verdict.quality.pass)} Quality: ${verdict.quality.pass ? "PASS" : "SPLIT"} — ${verdict.quality.detail}`,
    `${verdictIcon(verdict.accuracy.pass)} Accuracy: ${verdict.accuracy.pass ? "PASS" : "SPLIT"} — ${verdict.accuracy.detail}`,
    `Overall: ${verdict.overall}`,
  ].join("\n");

  emit({
    type: "hybrid:jury",
    chainId,
    juryVerdict: verdict,
    message: verdictLines,
    timestamp: Date.now(),
  });

  emit({
    type: "hybrid:build-log",
    chainId,
    message: `[${formatElapsed(chainStartTime)}] Jury Duty: ${verdict.overall} — ${agreementCount}/${totalJurors} agree — Completeness: ${verdict.completeness.pass ? "PASS" : "SPLIT"}, Quality: ${verdict.quality.pass ? "PASS" : "SPLIT"}, Accuracy: ${verdict.accuracy.pass ? "PASS" : "SPLIT"}`,
    timestamp: Date.now(),
  });

  return verdict;
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
            // Regression check — detect sections removed from previous step
            let regressionBlocked = false;
            if (si > 0 && lastGoodCode) {
              const regressionChangelog = generateChangelog(lastGoodCode, code);
              if (regressionChangelog.regressionCheck === "FAILED") {
                regressionBlocked = true;
                stepFailed = true;
                const removedStr = regressionChangelog.sectionsRemoved.join(", ");
                emit({
                  type: "hybrid:guardian",
                  chainId: chain.id,
                  stepIndex: si,
                  message: `[Guardian T1] Step ${si + 1} output — REJECTED (regression detected — removed: ${removedStr} — passing Step ${si} HTML forward)`,
                  timestamp: Date.now(),
                });
                emit({
                  type: "hybrid:build-log",
                  chainId: chain.id,
                  stepIndex: si,
                  message: `[${formatElapsed(chainStartTime)}] Guardian T1: Step ${si + 1} output REJECTED — regression detected — removed: ${removedStr}`,
                  timestamp: Date.now(),
                });
                previousCode = lastGoodCode;
              }
            }

            if (!regressionBlocked) {
              // No regression — run Guardian 3-tier check
              const scenarioPromptForGuardian = chain.prompt || scenario.prompt;
              const guardianResults = await runGuardianTieredCheck(
                code, scenarioPromptForGuardian,
                guardianModelId, guardianProvider,
                si, abortController.signal,
                emit, chainStartTime, chain.id,
              );

              // If any guardian tier rejected, use last good code
              const guardianRejected = guardianResults.some(r => !r.passed);
              if (guardianRejected && lastGoodCode) {
                emit({
                  type: "hybrid:build-log",
                  chainId: chain.id,
                  stepIndex: si,
                  message: `[${formatElapsed(chainStartTime)}] Thread Guardian: Step ${si + 1} output flagged — using last good HTML`,
                  timestamp: Date.now(),
                });
                previousCode = lastGoodCode;
              } else {
                previousCode = code;
                lastGoodCode = code;
              }
            }
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

        // ── Jury Duty — final output verdict (at chain completion only) ──
        let juryVerdict: JuryVerdict | null = null;
        if (lastGoodCode && !abortController.signal.aborted) {
          const scenarioPromptForJury = chain.prompt || scenario.prompt;
          juryVerdict = await runJuryVerdict(
            lastGoodCode, scenarioPromptForJury,
            chain.steps, guardianModelId, guardianProvider,
            abortController.signal, emit, chainStartTime, chain.id,
          );
        }

        const chainResult: HybridChainResult = {
          chainId: chain.id,
          chainName: chain.name,
          steps: stepResults,
          finalScore,
          totalTimeMs: chainTimeMs,
          totalCost: chainCost,
          timestamp: Date.now(),
          juryVerdict: juryVerdict || undefined,
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
