#!/usr/bin/env node
/**
 * S.A.R.G.E. BUILDER — TEST AUTOMATION RUNNER
 *
 * Runs all 20 tests from TEST_SUITE_MASTER.md.
 * Pre-flight detects ALL available models. Router picks cheapest first.
 * Logs every API call to COST_LOG.jsonl. Generates FINAL_REPORT.md.
 *
 * Usage: node test-runner.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, readdirSync, appendFileSync } from "fs";
import { join, basename } from "path";
import { execSync, exec } from "child_process";
import { config } from "dotenv";

// ── Load env ────────────────────────────────────────────────────────────
const SCRIPT_DIR = import.meta.dirname || ".";
const STANDALONE_DIR = join(SCRIPT_DIR, "..");
const REPO_ROOT = join(STANDALONE_DIR, "..", "..", "..");
for (const f of [".env.local", ".env"]) {
  for (const dir of [STANDALONE_DIR, REPO_ROOT]) {
    const p = join(dir, f);
    if (existsSync(p)) config({ path: p });
  }
}

// ── Constants ───────────────────────────────────────────────────────────
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const PORT = process.env.PORT || 3101;
const BASE_URL = `http://localhost:${PORT}`;
const PROJECTS_DIR = process.env.BUILDER_PROJECTS_DIR || "L:/ai_builder/projects";
const COST_LOG = join(SCRIPT_DIR, "COST_LOG.jsonl");
const RUNNER_LOG = join(SCRIPT_DIR, "RUNNER_LOG.md");
const FINAL_REPORT = join(SCRIPT_DIR, "FINAL_REPORT.md");
const INTAKE_V2 = join(STANDALONE_DIR, "level11-intake-data-v2.json");
const MIN_SIZE = 5120;
const MAX_HEIGHT = 2160;
const LIGHTHOUSE_PASS = 80;
const MIN_PASS_SCORE = 50;

// Gemini daily limit (free tier ~1500/day, warn at 20 from limit)
const GEMINI_DAILY_LIMIT = 1500;
const GEMINI_WARN_THRESHOLD = 20;

// ── Pricing (from packages/billing/src/rates.ts) ────────────────────────
const RATES = {
  // Local — always free
  "local:*": { input: 0, output: 0 },
  // Anthropic
  "claude-opus-4-6": { input: 5.00, output: 25.00 },
  "claude-sonnet-4-6": { input: 3.00, output: 15.00 },
  "claude-sonnet-4-5-20250514": { input: 3.00, output: 15.00 },
  "claude-haiku-4-5-20251001": { input: 1.00, output: 5.00 },
  // OpenAI
  "gpt-4.1": { input: 2.00, output: 8.00 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-5-mini": { input: 1.10, output: 4.40 },
  "o3": { input: 2.00, output: 8.00 },
  "o4-mini": { input: 1.10, output: 4.40 },
  // Google
  "gemini-2.5-pro": { input: 1.25, output: 10.00 },
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
  "gemini-3-flash": { input: 0.30, output: 2.50 },
  // xAI
  "grok-3": { input: 3.00, output: 15.00 },
  "grok-3-mini": { input: 0.30, output: 0.50 },
  "grok-4": { input: 3.00, output: 15.00 },
  "grok-4-1-fast-non-reasoning": { input: 0.20, output: 0.50 },
  "grok-4.20-experimental-beta-0304-non-reasoning": { input: 2.00, output: 6.00 },
  "grok-code-fast-1": { input: 0.20, output: 0.50 },
  // DeepSeek
  "deepseek-chat": { input: 0.27, output: 1.10 },
  "deepseek-reasoner": { input: 0.27, output: 1.10 },
  // Mistral
  "devstral-2512": { input: 0.30, output: 0.90 },
  "devstral-small-2512": { input: 0.30, output: 0.90 },
  "mistral-medium-3": { input: 0.40, output: 2.00 },
};

function getRate(model, provider) {
  if (provider === "ollama" || provider === "lmstudio") return { input: 0, output: 0 };
  if (RATES[model]) return RATES[model];
  for (const [key, rate] of Object.entries(RATES)) {
    if (key === "local:*") continue;
    if (model.includes(key) || key.includes(model)) return rate;
  }
  return { input: 0, output: 0 };
}

function calcCost(model, provider, tokensIn, tokensOut) {
  const rate = getRate(model, provider);
  return (tokensIn * rate.input + tokensOut * rate.output) / 1_000_000;
}

// ── Cost Logger ─────────────────────────────────────────────────────────
function logCost(entry) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    test: entry.test,
    run: entry.run,
    provider: entry.provider,
    model: entry.model,
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    cost: calcCost(entry.model, entry.provider, entry.tokensIn, entry.tokensOut),
    durationMs: entry.durationMs || 0,
  });
  appendFileSync(COST_LOG, line + "\n");
}

function getGeminiCallsToday() {
  if (!existsSync(COST_LOG)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const lines = readFileSync(COST_LOG, "utf-8").split("\n").filter(Boolean);
  let count = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.provider === "google" && entry.ts.startsWith(today)) count++;
    } catch {}
  }
  return count;
}

// ── Pre-Flight ──────────────────────────────────────────────────────────

let OLLAMA_MODELS = [];
let AVAILABLE_KEYS = {};
let GEMINI_TODAY = 0;
let GEMINI_DEPRIORITIZED = false;

async function preflight() {
  const log = [];
  log.push("# RUNNER PRE-FLIGHT LOG");
  log.push(`Date: ${new Date().toISOString()}`);
  log.push("");

  // 1. Ollama models
  log.push("## Ollama Models");
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      OLLAMA_MODELS = (data.models || []).map(m => m.name);
      log.push(`Status: ONLINE — ${OLLAMA_MODELS.length} models`);
      for (const m of OLLAMA_MODELS) {
        log.push(`  - ${m}`);
      }
    } else {
      log.push(`Status: ERROR ${res.status}`);
    }
  } catch (e) {
    log.push(`Status: OFFLINE — ${e.message}`);
  }
  log.push("");

  // 2. API Keys
  log.push("## API Keys");
  const keyMap = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_API_KEY",
    xai: "XAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    mistral: "MISTRAL_API_KEY",
    huggingface: "HUGGINGFACE_API_KEY",
    resend: "RESEND_API_KEY",
  };
  for (const [provider, envVar] of Object.entries(keyMap)) {
    const exists = !!process.env[envVar];
    AVAILABLE_KEYS[provider] = exists;
    log.push(`  ${provider}: ${exists ? "PRESENT" : "MISSING"} (${envVar})`);
  }
  log.push("");

  // 3. Gemini daily usage
  log.push("## Gemini Daily Usage");
  GEMINI_TODAY = getGeminiCallsToday();
  const remaining = GEMINI_DAILY_LIMIT - GEMINI_TODAY;
  if (remaining <= GEMINI_WARN_THRESHOLD) {
    GEMINI_DEPRIORITIZED = true;
    log.push(`Calls today: ${GEMINI_TODAY} — WARNING: within ${GEMINI_WARN_THRESHOLD} of limit. Gemini deprioritized.`);
  } else {
    log.push(`Calls today: ${GEMINI_TODAY} — ${remaining} remaining`);
  }
  log.push("");

  // 4. Port check
  log.push("## Port Check");
  try {
    const res = await fetch(`${BASE_URL}/api/status`, { signal: AbortSignal.timeout(5000) });
    log.push(`Port ${PORT}: ${res.ok ? "ALIVE" : `ERROR ${res.status}`}`);
  } catch (e) {
    log.push(`Port ${PORT}: DOWN — ${e.message}`);
  }
  log.push("");

  // Write RUNNER_LOG.md
  writeFileSync(RUNNER_LOG, log.join("\n"));
  console.log(log.join("\n"));
}

// ── Smart Router ────────────────────────────────────────────────────────
// Uses ALL available models. Local first, then cheapest cloud.
// Router dynamically builds chain from what preflight detected.

function buildModelChain(difficulty) {
  const chain = [];

  // Tier 1: All local Ollama models (FREE)
  // Prefer code-specialized models first
  const codeModels = OLLAMA_MODELS.filter(m =>
    m.includes("coder") || m.includes("codellama") || m.includes("starcoder") || m.includes("devstral")
  ).sort((a, b) => {
    // Larger models first (14b > 7b > 3b)
    const sizeA = parseInt((a.match(/:(\d+)b/) || [])[1] || "0");
    const sizeB = parseInt((b.match(/:(\d+)b/) || [])[1] || "0");
    return sizeB - sizeA;
  });

  const generalModels = OLLAMA_MODELS.filter(m =>
    !m.includes("coder") && !m.includes("codellama") && !m.includes("starcoder") &&
    !m.includes("nomic") && !m.includes("mxbai") && !m.includes("embed") &&
    !m.includes("devstral") && !m.includes("-vl") && !m.includes("llava") &&
    !m.includes("minicpm-v")
  ).sort((a, b) => {
    const sizeA = parseInt((a.match(/:(\d+)b/) || [])[1] || "0");
    const sizeB = parseInt((b.match(/:(\d+)b/) || [])[1] || "0");
    return sizeB - sizeA;
  });

  if (difficulty === "easy" || difficulty === "medium") {
    // Local code models first
    for (const m of codeModels) {
      chain.push({ provider: "ollama", model: m, type: "local", costPerCall: 0 });
    }
    // Then general local models
    for (const m of generalModels) {
      chain.push({ provider: "ollama", model: m, type: "local", costPerCall: 0 });
    }
  }

  // Tier 2: Cheapest cloud models
  const cloudModels = [
    // Free / near-free
    { provider: "deepseek", model: "deepseek-chat", key: "deepseek", costPerCall: 0.005 },
    { provider: "xai", model: "grok-4-1-fast-non-reasoning", key: "xai", costPerCall: 0.003 },
    { provider: "xai", model: "grok-code-fast-1", key: "xai", costPerCall: 0.003 },
    { provider: "xai", model: "grok-3-mini", key: "xai", costPerCall: 0.003 },
    { provider: "google", model: "gemini-2.0-flash", key: "google", costPerCall: 0.002 },
    { provider: "mistral", model: "devstral-2512", key: "mistral", costPerCall: 0.005 },
    // Cheap
    { provider: "google", model: "gemini-2.5-flash", key: "google", costPerCall: 0.01 },
    { provider: "openai", model: "gpt-4o-mini", key: "openai", costPerCall: 0.003 },
    { provider: "openai", model: "gpt-4.1-mini", key: "openai", costPerCall: 0.008 },
    { provider: "deepseek", model: "deepseek-reasoner", key: "deepseek", costPerCall: 0.005 },
    // Mid-tier
    { provider: "openai", model: "gpt-4.1", key: "openai", costPerCall: 0.04 },
    { provider: "google", model: "gemini-2.5-pro", key: "google", costPerCall: 0.04 },
    { provider: "xai", model: "grok-4.20-experimental-beta-0304-non-reasoning", key: "xai", costPerCall: 0.03 },
    { provider: "openai", model: "o4-mini", key: "openai", costPerCall: 0.02 },
    // Expensive (last resort)
    { provider: "xai", model: "grok-3", key: "xai", costPerCall: 0.07 },
    { provider: "xai", model: "grok-4", key: "xai", costPerCall: 0.07 },
    { provider: "anthropic", model: "claude-haiku-4-5-20251001", key: "anthropic", costPerCall: 0.02 },
    { provider: "anthropic", model: "claude-sonnet-4-5-20250514", key: "anthropic", costPerCall: 0.07 },
    { provider: "openai", model: "o3", key: "openai", costPerCall: 0.04 },
  ];

  for (const cm of cloudModels) {
    if (!AVAILABLE_KEYS[cm.key]) continue;
    if (GEMINI_DEPRIORITIZED && cm.provider === "google") continue;
    chain.push({ provider: cm.provider, model: cm.model, type: "cloud", costPerCall: cm.costPerCall });
  }

  // If Gemini was deprioritized, add it at the very end as fallback
  if (GEMINI_DEPRIORITIZED && AVAILABLE_KEYS.google) {
    chain.push({ provider: "google", model: "gemini-2.5-flash", type: "cloud", costPerCall: 0.01 });
  }

  return chain;
}

const failedModels = new Set();

function routeModel(difficulty) {
  const chain = buildModelChain(difficulty);
  for (const option of chain) {
    const key = `${option.provider}:${option.model}`;
    if (failedModels.has(key)) continue;
    return { provider: option.provider, model: option.model, type: option.type, reason: `${difficulty} — ${option.type === "local" ? "FREE local" : option.model} ($${option.costPerCall.toFixed(3)}/call est.)` };
  }
  // Absolute fallback
  return { provider: "google", model: "gemini-2.5-flash", type: "cloud", reason: "ultimate fallback" };
}

// ── Build Helpers ───────────────────────────────────────────────────────

function extractHtml(content) {
  let html = content.trim();
  const fence = html.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (fence) html = fence[1].trim();
  if (!html.startsWith("<")) {
    const idx = html.indexOf("<!DOCTYPE");
    if (idx !== -1) html = html.slice(idx);
    else {
      const idx2 = html.indexOf("<html");
      if (idx2 !== -1) html = html.slice(idx2);
    }
  }
  return html;
}

async function buildWithOllama(model, systemPrompt, userPrompt, timeoutMs = 180000) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      stream: false,
      options: { num_predict: 16384, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    html: extractHtml(data.response || ""),
    tokensIn: data.prompt_eval_count || 0,
    tokensOut: data.eval_count || 0,
  };
}

async function buildWithCloud(provider, model, systemPrompt, userPrompt, timeoutMs = 180000) {
  const res = await fetch(`${BASE_URL}/api/test/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      model,
      prompt: userPrompt,
      systemPrompt,
      source: "test-runner",
      maxOutputTokens: 16384,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (!res.body) throw new Error("No body");

  let html = "";
  let tokensIn = 0, tokensOut = 0;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.token) html += data.token;
        if (data.content) html += data.content;
        if (data.message?.content) html += data.message.content;
        if (data.usage) {
          tokensIn = data.usage.input_tokens || data.usage.prompt_tokens || 0;
          tokensOut = data.usage.output_tokens || data.usage.completion_tokens || 0;
        }
        if (data.full_content) html = data.full_content;
      } catch {}
    }
  }

  return { html: extractHtml(html), tokensIn, tokensOut };
}

async function buildPage(systemPrompt, userPrompt, difficulty, testNum, runNum) {
  const maxAttempts = 4;
  let lastError = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const escalatedDifficulty = attempt === 0 ? difficulty : (attempt === 1 ? "medium" : "hard");
    const pick = routeModel(escalatedDifficulty);
    const key = `${pick.provider}:${pick.model}`;
    const startMs = Date.now();

    console.log(`  [Attempt ${attempt + 1}] ${key} (${pick.reason})`);

    try {
      let result;
      if (pick.type === "local") {
        result = await buildWithOllama(pick.model, systemPrompt, userPrompt);
      } else {
        result = await buildWithCloud(pick.provider, pick.model, systemPrompt, userPrompt);
      }
      const durationMs = Date.now() - startMs;

      logCost({ test: testNum, run: runNum, provider: pick.provider, model: pick.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut, durationMs });

      if (result.html.length < MIN_SIZE) {
        console.log(`    Too small: ${result.html.length}b < ${MIN_SIZE}b (${(durationMs / 1000).toFixed(1)}s)`);
        failedModels.add(key);
        lastError = `Too small (${result.html.length}b)`;
        continue;
      }

      console.log(`    OK: ${result.html.length}b, ${result.tokensIn}/${result.tokensOut} tokens, ${(durationMs / 1000).toFixed(1)}s`);
      return { ...result, model: pick.model, provider: pick.provider, reason: pick.reason, durationMs };
    } catch (err) {
      const durationMs = Date.now() - startMs;
      console.log(`    FAIL: ${err.message.slice(0, 100)} (${(durationMs / 1000).toFixed(1)}s)`);
      failedModels.add(key);
      lastError = err.message;
      logCost({ test: testNum, run: runNum, provider: pick.provider, model: pick.model, tokensIn: 0, tokensOut: 0, durationMs });
    }
  }

  return { html: "", tokensIn: 0, tokensOut: 0, model: "none", provider: "none", reason: `All failed: ${lastError}`, durationMs: 0 };
}

// ── Lighthouse ──────────────────────────────────────────────────────────

function runLighthouse(htmlPath) {
  try {
    const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
    const output = execSync(
      `npx lighthouse "${fileUrl}" --output=json --quiet --chrome-flags="--headless --no-sandbox --disable-gpu" --only-categories=performance,accessibility,best-practices,seo 2>/dev/null`,
      { timeout: 90000, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 }
    );
    const lh = JSON.parse(output);
    const cats = lh.categories;
    return {
      performance: Math.round((cats.performance?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats["best-practices"]?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
    };
  } catch (err) {
    console.log(`  Lighthouse error: ${err.message.slice(0, 150)}`);
    return { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
  }
}

// ── Page Height Check ───────────────────────────────────────────────────

async function checkPageHeight(htmlPath) {
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle2", timeout: 15000 });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await browser.close();
    return height;
  } catch (err) {
    console.log(`  Height check error: ${err.message.slice(0, 100)}`);
    return 0;
  }
}

// ── Grey Text Check ─────────────────────────────────────────────────────

function checkGreyText(html) {
  const greyPatterns = [
    /zinc-[4-7]00/gi,
    /slate-[4-6]00/gi,
    /gray-[4-6]00/gi,
    /neutral-[4-6]00/gi,
    /color:\s*#[89a-f][89a-f][89a-f][89a-f][89a-f][89a-f]/gi, // muted hex colors
    /color:\s*rgb\(\s*1[2-8]\d/gi, // rgb with grey-ish values
  ];
  const found = [];
  for (const pat of greyPatterns) {
    const matches = html.match(pat);
    if (matches) found.push(...matches);
  }
  return found;
}

// ── Placeholder Check ───────────────────────────────────────────────────

function checkPlaceholders(html) {
  const matches = html.match(/\{\{[^}]+\}\}/g) || [];
  return matches;
}

// ── Broken Image Check ──────────────────────────────────────────────────

function checkBrokenImages(html) {
  const issues = [];
  // Empty src
  const emptySrc = html.match(/<img[^>]*\ssrc\s*=\s*["']\s*["']/gi);
  if (emptySrc) issues.push(...emptySrc.map(m => "Empty src"));
  // source.unsplash.com
  const unsplash = html.match(/source\.unsplash\.com/gi);
  if (unsplash) issues.push(...unsplash.map(() => "source.unsplash.com (deprecated)"));
  return issues;
}

// ── Score a Single Run ──────────────────────────────────────────────────

async function scoreRun(htmlPath, html, testCriteria) {
  const scores = { lighthouse: null, height: 0, greyText: [], placeholders: [], brokenImages: [], customChecks: [], pass: true, failReasons: [] };

  // Lighthouse
  scores.lighthouse = runLighthouse(htmlPath);
  if (scores.lighthouse.performance < LIGHTHOUSE_PASS) { scores.pass = false; scores.failReasons.push(`Perf ${scores.lighthouse.performance} < ${LIGHTHOUSE_PASS}`); }
  if (scores.lighthouse.accessibility < LIGHTHOUSE_PASS) { scores.pass = false; scores.failReasons.push(`A11y ${scores.lighthouse.accessibility} < ${LIGHTHOUSE_PASS}`); }
  if (scores.lighthouse.seo < LIGHTHOUSE_PASS) { scores.pass = false; scores.failReasons.push(`SEO ${scores.lighthouse.seo} < ${LIGHTHOUSE_PASS}`); }
  if (scores.lighthouse.bestPractices < LIGHTHOUSE_PASS) { scores.pass = false; scores.failReasons.push(`BP ${scores.lighthouse.bestPractices} < ${LIGHTHOUSE_PASS}`); }

  // Height
  scores.height = await checkPageHeight(htmlPath);
  if (scores.height > MAX_HEIGHT) { scores.pass = false; scores.failReasons.push(`Height ${scores.height}px > ${MAX_HEIGHT}px`); }

  // Grey text
  scores.greyText = checkGreyText(html);
  if (scores.greyText.length > 0) { scores.pass = false; scores.failReasons.push(`Grey text: ${scores.greyText.slice(0, 3).join(", ")}`); }

  // Placeholders
  scores.placeholders = checkPlaceholders(html);
  if (scores.placeholders.length > 0) { scores.pass = false; scores.failReasons.push(`Placeholders: ${scores.placeholders.slice(0, 3).join(", ")}`); }

  // Broken images
  scores.brokenImages = checkBrokenImages(html);
  if (scores.brokenImages.length > 0) { scores.pass = false; scores.failReasons.push(`Broken images: ${scores.brokenImages.length}`); }

  // Custom checks from test criteria
  if (testCriteria.customChecks) {
    for (const check of testCriteria.customChecks) {
      const result = check.fn(html);
      scores.customChecks.push({ name: check.name, pass: result.pass, detail: result.detail });
      if (!result.pass) { scores.pass = false; scores.failReasons.push(`${check.name}: ${result.detail}`); }
    }
  }

  return scores;
}

// ── Wipe Test Folder ────────────────────────────────────────────────────

function wipeTestFolder(testDir) {
  const keep = ["BUILD_LOG.txt", "run-test.mjs"];
  if (existsSync(testDir)) {
    for (const f of readdirSync(testDir)) {
      if (keep.includes(f)) continue;
      const fp = join(testDir, f);
      try { rmSync(fp, { recursive: true, force: true }); } catch {}
    }
  }
}

// ── Run a Single Test (up to 3 runs) ────────────────────────────────────

async function runTest(testConfig) {
  const { num, name, folder, difficulty, systemPrompt, userPrompt, customChecks, specialHandler } = testConfig;
  const testDir = join(SCRIPT_DIR, folder);
  mkdirSync(testDir, { recursive: true });

  const testLog = [];
  const padNum = String(num).padStart(2, "0");
  testLog.push(`${"=".repeat(60)}`);
  testLog.push(`TEST ${padNum} — ${name}`);
  testLog.push(`Started: ${new Date().toISOString()}`);
  testLog.push(`Difficulty: ${difficulty}`);
  testLog.push(`${"=".repeat(60)}`);
  testLog.push("");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST ${padNum} — ${name}`);
  console.log(`${"=".repeat(60)}`);

  // If test has a special handler (non-HTML tests like email, billing, etc.)
  if (specialHandler) {
    const result = await specialHandler(testDir, testLog, num);
    testLog.push("");
    testLog.push(`RESULT: ${result.status} — ${result.reason}`);
    writeFileSync(join(testDir, "BUILD_LOG.txt"), testLog.join("\n"));
    return result;
  }

  // Standard HTML build test
  const runs = [];
  let needsBuild = false;
  let needsBuildReason = "";

  // Run 1 — always attempt
  console.log("\n  --- Run 1 ---");
  wipeTestFolder(testDir);
  failedModels.clear(); // Reset per test

  const run1Start = Date.now();
  const buildResult = await buildPage(systemPrompt, userPrompt, difficulty, num, 1);
  const run1Ms = Date.now() - run1Start;

  if (!buildResult.html) {
    testLog.push("Run 1: ALL MODELS FAILED — no HTML produced");
    testLog.push(`Reason: ${buildResult.reason}`);
    needsBuild = true;
    needsBuildReason = buildResult.reason;
  } else {
    const htmlPath = join(testDir, "index.html");
    writeFileSync(htmlPath, buildResult.html);
    const scores = await scoreRun(htmlPath, buildResult.html, { customChecks });
    const avgLH = scores.lighthouse ? Math.round((scores.lighthouse.performance + scores.lighthouse.accessibility + scores.lighthouse.seo + scores.lighthouse.bestPractices) / 4) : 0;

    runs.push({
      run: 1,
      model: buildResult.model,
      provider: buildResult.provider,
      reason: buildResult.reason,
      scores,
      avgLH,
      durationMs: run1Ms,
      tokensIn: buildResult.tokensIn,
      tokensOut: buildResult.tokensOut,
    });

    testLog.push(`Run 1: ${buildResult.provider}:${buildResult.model}`);
    testLog.push(`  Reason: ${buildResult.reason}`);
    testLog.push(`  Size: ${buildResult.html.length}b | Time: ${(run1Ms / 1000).toFixed(1)}s`);
    testLog.push(`  Tokens: ${buildResult.tokensIn}/${buildResult.tokensOut}`);
    testLog.push(`  LH: Perf=${scores.lighthouse?.performance} A11y=${scores.lighthouse?.accessibility} SEO=${scores.lighthouse?.seo} BP=${scores.lighthouse?.bestPractices}`);
    testLog.push(`  Height: ${scores.height}px`);
    testLog.push(`  Grey text: ${scores.greyText.length} | Placeholders: ${scores.placeholders.length} | Broken imgs: ${scores.brokenImages.length}`);
    if (scores.customChecks.length > 0) {
      for (const cc of scores.customChecks) {
        testLog.push(`  [${cc.pass ? "PASS" : "FAIL"}] ${cc.name}: ${cc.detail}`);
      }
    }
    testLog.push(`  PASS: ${scores.pass} ${scores.failReasons.length > 0 ? "— " + scores.failReasons.join("; ") : ""}`);
    testLog.push("");

    // If avg score > 50, do runs 2 and 3
    if (avgLH >= MIN_PASS_SCORE) {
      for (const runNum of [2, 3]) {
        console.log(`\n  --- Run ${runNum} ---`);
        wipeTestFolder(testDir);
        failedModels.clear();

        const runStart = Date.now();
        const br = await buildPage(systemPrompt, userPrompt, difficulty, num, runNum);
        const runMs = Date.now() - runStart;

        if (!br.html) {
          testLog.push(`Run ${runNum}: ALL MODELS FAILED`);
          continue;
        }

        const hp = join(testDir, "index.html");
        writeFileSync(hp, br.html);
        const sc = await scoreRun(hp, br.html, { customChecks });
        const avg = sc.lighthouse ? Math.round((sc.lighthouse.performance + sc.lighthouse.accessibility + sc.lighthouse.seo + sc.lighthouse.bestPractices) / 4) : 0;

        runs.push({
          run: runNum,
          model: br.model,
          provider: br.provider,
          reason: br.reason,
          scores: sc,
          avgLH: avg,
          durationMs: runMs,
          tokensIn: br.tokensIn,
          tokensOut: br.tokensOut,
        });

        testLog.push(`Run ${runNum}: ${br.provider}:${br.model}`);
        testLog.push(`  LH: Perf=${sc.lighthouse?.performance} A11y=${sc.lighthouse?.accessibility} SEO=${sc.lighthouse?.seo} BP=${sc.lighthouse?.bestPractices}`);
        testLog.push(`  Height: ${sc.height}px | Grey: ${sc.greyText.length} | Placeholders: ${sc.placeholders.length}`);
        testLog.push(`  PASS: ${sc.pass}`);
        testLog.push("");
      }
    } else {
      testLog.push(`Run 1 avg LH ${avgLH} < ${MIN_PASS_SCORE} — skipping runs 2-3`);
      testLog.push("");
    }
  }

  // Compute median scores
  let medianScores = null;
  let finalStatus = "FAIL";

  if (runs.length > 0) {
    const median = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    };

    medianScores = {
      performance: median(runs.map(r => r.scores.lighthouse?.performance || 0)),
      accessibility: median(runs.map(r => r.scores.lighthouse?.accessibility || 0)),
      seo: median(runs.map(r => r.scores.lighthouse?.seo || 0)),
      bestPractices: median(runs.map(r => r.scores.lighthouse?.bestPractices || 0)),
      height: median(runs.map(r => r.scores.height)),
    };

    const allPass = medianScores.performance >= LIGHTHOUSE_PASS &&
      medianScores.accessibility >= LIGHTHOUSE_PASS &&
      medianScores.seo >= LIGHTHOUSE_PASS &&
      medianScores.bestPractices >= LIGHTHOUSE_PASS &&
      medianScores.height <= MAX_HEIGHT;

    // Check if any run had zero grey/placeholder/broken issues
    const anyClean = runs.some(r =>
      r.scores.greyText.length === 0 &&
      r.scores.placeholders.length === 0 &&
      r.scores.brokenImages.length === 0
    );

    finalStatus = allPass && anyClean ? "PASS" : "FAIL";
  }

  if (needsBuild) {
    finalStatus = "NEEDS BUILD";
  }

  testLog.push("── FINAL ──");
  testLog.push(`Status: ${finalStatus}${needsBuild ? " — " + needsBuildReason : ""}`);
  if (medianScores) {
    testLog.push(`Median Lighthouse: Perf=${medianScores.performance} A11y=${medianScores.accessibility} SEO=${medianScores.seo} BP=${medianScores.bestPractices}`);
    testLog.push(`Median Height: ${medianScores.height}px`);
  }
  testLog.push(`Runs completed: ${runs.length}`);
  testLog.push(`Best model: ${runs.length > 0 ? runs.sort((a, b) => b.avgLH - a.avgLH)[0].provider + ":" + runs.sort((a, b) => b.avgLH - a.avgLH)[0].model : "none"}`);

  writeFileSync(join(testDir, "BUILD_LOG.txt"), testLog.join("\n"));

  return {
    num,
    name,
    status: finalStatus,
    medianScores,
    runs,
    bestModel: runs.length > 0 ? `${runs.sort((a, b) => b.avgLH - a.avgLH)[0].provider}:${runs.sort((a, b) => b.avgLH - a.avgLH)[0].model}` : "none",
    reason: needsBuild ? needsBuildReason : (finalStatus === "PASS" ? "All criteria met" : runs[0]?.scores?.failReasons?.join("; ") || "See log"),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// TEST DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════

const BASE_SYSTEM = `You are a web developer. Build a single-page website.

OUTPUT RULES:
- Output ONLY the complete HTML file. No explanations, no markdown.
- Start with <!DOCTYPE html> and end with </html>.
- ALL CSS in <style> tags, ALL JS in <script> tags.
- Dark mode by default: background #0F0F1A, ALL text #FFFFFF or #F0F2F5, font-weight 500+ body, 700+ headings.
- NO grey text. NO zinc-500, slate-400, slate-500. NO dim text. EVER.
- Min 14px body text, 12px labels.
- Mobile responsive with hamburger nav.
- Page must fit in 2 viewport heights max (under 2160px at 1080p).
- Do NOT use source.unsplash.com — use https://picsum.photos/{w}/{h} for images.
- Use PII placeholders: {{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}.`;

function defineTests() {
  return [
    // TEST 01 — Basic Page
    {
      num: 1, name: "Basic Page", folder: "test-01-basic", difficulty: "easy",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with:
1. Nav bar with links: Home, Services, About, Contact (all href="#")
2. Hero section with heading "Welcome to {{BUSINESS_NAME}}", subheading about premium services, and a "Get Started" CTA button
3. Footer with {{phone}}, {{email}}, {{BUSINESS_NAME}}, and copyright
4. Dark mode default — background #0F0F1A, text #FFFFFF
5. Mobile responsive. No images — text and CSS only.
6. Must be under 2160px total height on desktop`,
      customChecks: [
        { name: "Nav present", fn: (html) => ({ pass: /<nav/i.test(html), detail: /<nav/i.test(html) ? "Found" : "Missing" }) },
        { name: "Hero present", fn: (html) => ({ pass: /hero|welcome/i.test(html), detail: /hero|welcome/i.test(html) ? "Found" : "Missing" }) },
        { name: "Footer present", fn: (html) => ({ pass: /<footer/i.test(html), detail: /<footer/i.test(html) ? "Found" : "Missing" }) },
      ],
    },

    // TEST 02 — Cards + Accordion/Tabs
    {
      num: 2, name: "Cards + Accordion/Tabs", folder: "test-02-cards-tabs", difficulty: "easy",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with:
1. Nav bar with 4 links
2. Section with MINIMUM 4 cards in a CSS grid (2x2 or 4-column). Each card has a title, text, and icon/emoji.
3. An accordion OR tab component with at least 3 items. Must work with JavaScript (click to expand/switch).
4. Footer
5. Dark mode default. No images. Under 2160px height. No scrolling beyond 2 viewports.`,
      customChecks: [
        { name: "4+ cards", fn: (html) => {
          const cards = (html.match(/class="[^"]*card[^"]*"/gi) || []).length;
          const gridItems = (html.match(/grid|card/gi) || []).length;
          return { pass: cards >= 4 || gridItems >= 8, detail: `${cards} card classes, ${gridItems} grid/card refs` };
        }},
        { name: "Accordion/Tab JS", fn: (html) => {
          const hasAccordion = /accordion|collapse|expand|toggle/i.test(html);
          const hasTab = /tab-content|tabpanel|\.tab/i.test(html);
          const hasJS = /<script[\s\S]*?(addEventListener|onclick|click)/i.test(html);
          return { pass: (hasAccordion || hasTab) && hasJS, detail: `Accordion:${hasAccordion} Tab:${hasTab} JS:${hasJS}` };
        }},
      ],
    },

    // TEST 03 — Stock Images + Video
    {
      num: 3, name: "Stock Images + Video", folder: "test-03-media", difficulty: "easy",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with:
1. Nav bar
2. Hero with a large background image from https://picsum.photos/1920/600
3. Section with 3 image cards, each using https://picsum.photos/400/300 with different seed params (?random=1, ?random=2, etc.)
4. YouTube video embed section with a real YouTube iframe (use https://www.youtube.com/embed/dQw4w9WgXcQ as placeholder)
5. Footer
6. All images MUST use picsum.photos — NO other image sources. NO source.unsplash.com.
7. Dark mode default. Under 2160px.`,
      customChecks: [
        { name: "Images load (picsum)", fn: (html) => {
          const picsum = (html.match(/picsum\.photos/gi) || []).length;
          return { pass: picsum >= 3, detail: `${picsum} picsum.photos refs` };
        }},
        { name: "YouTube iframe", fn: (html) => {
          const yt = /youtube\.com\/embed/i.test(html);
          return { pass: yt, detail: yt ? "Found" : "Missing" };
        }},
        { name: "No unsplash", fn: (html) => {
          const bad = /source\.unsplash/i.test(html);
          return { pass: !bad, detail: bad ? "FOUND source.unsplash.com!" : "Clean" };
        }},
      ],
    },

    // TEST 04 — Asset Management
    {
      num: 4, name: "Asset Management", folder: "test-04-assets", difficulty: "medium",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page that demonstrates an asset management system:
1. Page shows a business website with logo placeholder, hero image, service images, team photos, and gallery images
2. Each image src should reference a structured path: /assets/logo/logo.png, /assets/hero/hero-1.jpg, /assets/services/dj/dj-1.jpg, /assets/team/sarge.jpg, /assets/gallery/event-1.jpg
3. A sidebar or section that shows the folder structure as a tree view
4. Dark mode. Under 2160px. Use picsum.photos as fallback for actual display.`,
      customChecks: [
        { name: "Asset paths structured", fn: (html) => {
          const assetPaths = (html.match(/\/assets\/(logo|hero|services|team|gallery)\//gi) || []).length;
          return { pass: assetPaths >= 3, detail: `${assetPaths} structured asset paths` };
        }},
      ],
      specialHandler: async (testDir, testLog, testNum) => {
        // Test 04 checks if the upload system exists in the pipeline
        testLog.push("Checking if asset upload system exists in the build pipeline...");
        let uploadRouteExists = false;
        try {
          const res = await fetch(`${BASE_URL}/api/intake/upload`, { method: "OPTIONS", signal: AbortSignal.timeout(5000) });
          uploadRouteExists = res.status !== 404;
        } catch {}

        if (!uploadRouteExists) {
          testLog.push("NEEDS BUILD: /api/intake/upload route does not exist");
          testLog.push("Missing: Asset upload API endpoint that accepts files and saves to /projects/{ref-code}/assets/{section}/");
          return { num: 4, name: "Asset Management", status: "NEEDS BUILD", medianScores: null, runs: [], bestModel: "none", reason: "No /api/intake/upload route. Need file upload endpoint that saves to structured asset folders." };
        }

        testLog.push("Upload route exists — testing asset intake flow...");
        return { num: 4, name: "Asset Management", status: "NEEDS BUILD", medianScores: null, runs: [], bestModel: "none", reason: "Upload route exists but full asset management pipeline (upload → organize → reference in build) not wired." };
      },
    },

    // TEST 05 — Forms + Newsletter
    {
      num: 5, name: "Forms + Newsletter", folder: "test-05-forms", difficulty: "easy",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with:
1. Nav bar
2. Contact form with: Name (required), Email (required, email validation), Phone, Message (required). Submit button.
3. JavaScript validation that fires on empty required fields — shows red border + error text.
4. On successful submit, show a green success message "Thank you! We'll be in touch."
5. Newsletter signup section: email input + "Subscribe" button. Shows "Subscribed!" on submit.
6. Footer with {{BUSINESS_NAME}}, {{phone}}, {{email}}
7. Dark mode. Under 2160px. No images.
8. Form MUST NOT actually navigate away — use event.preventDefault().`,
      customChecks: [
        { name: "Form present", fn: (html) => ({ pass: /<form/i.test(html), detail: /<form/i.test(html) ? "Found" : "Missing" }) },
        { name: "Validation JS", fn: (html) => {
          const hasValidation = /required|validate|preventDefault/i.test(html);
          return { pass: hasValidation, detail: hasValidation ? "Found" : "Missing" };
        }},
        { name: "Newsletter signup", fn: (html) => {
          const has = /newsletter|subscribe|signup/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
      ],
    },

    // TEST 06 — Conversion Elements
    {
      num: 6, name: "Conversion Elements", folder: "test-06-conversion", difficulty: "medium",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with these conversion elements:
1. A calendar/date picker widget (use native <input type="date"> or build a simple JS calendar)
2. A countdown timer counting down to a specific date (e.g., "Event in 30 days"). Must be live JavaScript that updates every second.
3. A pricing table with 3 tiers (Basic $99, Premium $199, Elite $299) in a card grid. Each with feature list and CTA button.
4. A "Download Brochure" button that links to a #download anchor or creates a simple PDF-like element.
5. Dark mode. Under 2160px. No images.`,
      customChecks: [
        { name: "Calendar/date widget", fn: (html) => {
          const has = /type="date"|calendar|datepicker/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Countdown timer", fn: (html) => {
          const has = /countdown|setInterval|timer/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Pricing table", fn: (html) => {
          const has = /pricing|price|\$\d+/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
      ],
    },

    // TEST 07 — Gallery + Maps + Social
    {
      num: 7, name: "Gallery + Maps + Social", folder: "test-07-display", difficulty: "medium",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with:
1. Image gallery with 6 images from picsum.photos in a grid. Clicking an image opens a lightbox overlay with the full image and an X close button. Lightbox must work with JavaScript.
2. An embedded Google Maps iframe showing Eden Prairie, MN (use https://maps.google.com/maps?q=Eden+Prairie+MN&output=embed)
3. At least one social media embed section (Facebook or Instagram embed placeholder, or social media icon links to facebook.com/level11events and instagram.com/level11events)
4. Dark mode. Under 2160px.`,
      customChecks: [
        { name: "Lightbox JS", fn: (html) => {
          const has = /lightbox|modal|overlay/i.test(html) && /onclick|click|addEventListener/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing lightbox + click handler" };
        }},
        { name: "Map embed", fn: (html) => {
          const has = /maps\.google|google\.com\/maps|openstreetmap/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Social embed/links", fn: (html) => {
          const has = /facebook|instagram|twitter|social/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
      ],
    },

    // TEST 08 — PII + Guardian
    {
      num: 8, name: "PII + Guardian", folder: "test-08-pii", difficulty: "medium",
      systemPrompt: BASE_SYSTEM + `\n\nIMPORTANT: You MUST use these EXACT placeholders in your HTML:
{{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{client_name}}
Do NOT use real business names, phone numbers, or emails. Use ONLY placeholders. The PII injector will replace them after build.`,
      userPrompt: `Build a business website page for an event entertainment company with:
1. Header with {{BUSINESS_NAME}} in the logo area
2. Hero: "Welcome to {{BUSINESS_NAME}} — Premium Entertainment"
3. Contact section: {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}
4. Footer: "© 2026 {{BUSINESS_NAME}}. Contact {{client_name}} at {{phone}}"
5. About snippet mentioning {{BUSINESS_NAME}} at least 3 times
6. Every piece of business-specific text MUST use placeholders. Zero real data.
7. Dark mode. Under 2160px.`,
      customChecks: [
        { name: "Has placeholders", fn: (html) => {
          const placeholders = (html.match(/\{\{[^}]+\}\}/g) || []);
          const unique = [...new Set(placeholders)];
          return { pass: unique.length >= 4, detail: `${unique.length} unique: ${unique.join(", ")}` };
        }},
        { name: "No hardcoded PII", fn: (html) => {
          // Check for common real-data leaks
          const leaks = /Level 11 Events|level11events|612-|Eden Prairie/i.test(html);
          return { pass: !leaks, detail: leaks ? "LEAKED real business data!" : "Clean — only placeholders" };
        }},
      ],
    },

    // TEST 09 — Email Suite
    {
      num: 9, name: "Email Suite", folder: "test-09-emails", difficulty: "hard",
      specialHandler: async (testDir, testLog, testNum) => {
        testLog.push("Testing email sending via /api/email/send...");

        // Check if email route exists
        let emailRouteExists = false;
        try {
          const res = await fetch(`${BASE_URL}/api/email/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: "test@test.com", template: "test", data: {} }),
            signal: AbortSignal.timeout(10000),
          });
          emailRouteExists = res.status !== 404;
          testLog.push(`Email route status: ${res.status}`);
        } catch (e) {
          testLog.push(`Email route error: ${e.message}`);
        }

        if (!emailRouteExists) {
          return { num: 9, name: "Email Suite", status: "NEEDS BUILD", medianScores: null, runs: [], bestModel: "none", reason: "No /api/email/send route" };
        }

        // Test all 3 templates
        const templates = ["welcome", "build_started", "site_live"];
        const results = [];
        for (const template of templates) {
          try {
            const res = await fetch(`${BASE_URL}/api/email/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: "planflowai@outlook.com",
                template,
                data: {
                  business_name: "Level 11 Events",
                  project_name: "Level 11 Events",
                  client_name: "DJ Sarge",
                  live_urls: "https://level11events.vercel.app",
                  ref_code: "L11-LEVEL11-002",
                  scores: { performance: 93, accessibility: 99, seo: 100, bestPractices: 96 },
                },
              }),
              signal: AbortSignal.timeout(15000),
            });
            const body = await res.text();
            results.push({ template, status: res.status, ok: res.ok, body: body.slice(0, 200) });
            testLog.push(`  ${template}: ${res.status} ${res.ok ? "OK" : "FAIL"} — ${body.slice(0, 100)}`);
          } catch (e) {
            results.push({ template, status: 0, ok: false, body: e.message });
            testLog.push(`  ${template}: ERROR — ${e.message}`);
          }
        }

        const allOk = results.every(r => r.ok);
        return {
          num: 9, name: "Email Suite",
          status: allOk ? "PASS" : "NEEDS FIX",
          medianScores: null, runs: [], bestModel: "none",
          reason: allOk ? "All 3 templates sent to planflowai@outlook.com" : `Failed templates: ${results.filter(r => !r.ok).map(r => r.template).join(", ")}`,
        };
      },
    },

    // TEST 10 — Chatbot
    {
      num: 10, name: "Chatbot", folder: "test-10-chatbot", difficulty: "hard",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with an embedded chatbot:
1. A floating chat widget button in the bottom-right corner
2. Clicking it opens a chat panel with a message input and send button
3. Static FAQ: if user types "hours", respond "Monday-Friday, 9am-6pm CST". If "phone", respond "{{phone}}". If "email", respond "{{email}}".
4. For any other message, show "Let me find that for you..." (placeholder for AI response)
5. Chat history visible in the panel. Messages styled as bubbles.
6. Close button to minimize chat.
7. Dark mode. Under 2160px.`,
      customChecks: [
        { name: "Chat widget", fn: (html) => {
          const has = /chat|chatbot|messenger/i.test(html) && /onclick|click|addEventListener/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing chat + JS" };
        }},
        { name: "FAQ responses", fn: (html) => {
          const has = /hours|9am|phone|email/i.test(html);
          return { pass: has, detail: has ? "FAQ logic found" : "No FAQ logic" };
        }},
      ],
    },

    // TEST 11 — Voice
    {
      num: 11, name: "Voice", folder: "test-11-voice", difficulty: "hard",
      specialHandler: async (testDir, testLog, testNum) => {
        testLog.push("Checking voice infrastructure...");

        // Check XTTS endpoint
        const xttsUrl = process.env.NEXT_PUBLIC_XTTS_URL || "http://localhost:8787";
        let xttsAlive = false;
        try {
          const res = await fetch(xttsUrl, { signal: AbortSignal.timeout(5000) });
          xttsAlive = res.ok;
          testLog.push(`XTTS (${xttsUrl}): ${res.ok ? "ALIVE" : `ERROR ${res.status}`}`);
        } catch (e) {
          testLog.push(`XTTS (${xttsUrl}): DOWN — ${e.message}`);
        }

        // Check for voice implementation at L:\AI_PHONE_APP\ai_workbench
        const voiceDir = "L:/AI_PHONE_APP/ai_workbench";
        const voiceExists = existsSync(voiceDir);
        testLog.push(`Voice workbench (${voiceDir}): ${voiceExists ? "EXISTS" : "NOT FOUND"}`);

        if (!xttsAlive && !voiceExists) {
          return { num: 11, name: "Voice", status: "NEEDS BUILD", medianScores: null, runs: [], bestModel: "none", reason: "XTTS server not running and voice workbench not found. Need: 1) XTTS/TTS server running on port 8787, 2) STT integration, 3) Min 3 male + 3 female voice options, 4) Voice chatbot widget." };
        }

        return { num: 11, name: "Voice", status: "NEEDS BUILD", medianScores: null, runs: [], bestModel: "none", reason: `XTTS: ${xttsAlive ? "alive" : "down"}. Voice workbench: ${voiceExists ? "exists" : "missing"}. Full TTS/STT pipeline with voice selection not yet integrated into builder.` };
      },
    },

    // TEST 12 — Generative Media
    {
      num: 12, name: "Generative Media", folder: "test-12-generative-media", difficulty: "hard",
      specialHandler: async (testDir, testLog, testNum) => {
        testLog.push("Testing xAI generative media APIs...");

        const xaiKey = process.env.XAI_API_KEY;
        if (!xaiKey) {
          return { num: 12, name: "Generative Media", status: "NEEDS BUILD", medianScores: null, runs: [], bestModel: "none", reason: "No XAI_API_KEY in .env.local" };
        }

        // Test image generation
        let imageOk = false;
        try {
          testLog.push("Testing grok-imagine-image...");
          const res = await fetch("https://api.x.ai/v1/images/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${xaiKey}` },
            body: JSON.stringify({
              model: "grok-imagine-image",
              prompt: "A professional DJ performing at an elegant wedding reception, golden lighting",
              n: 1,
            }),
            signal: AbortSignal.timeout(60000),
          });
          const body = await res.text();
          imageOk = res.ok;
          testLog.push(`  Image gen: ${res.status} ${res.ok ? "OK" : "FAIL"} — ${body.slice(0, 200)}`);
          logCost({ test: testNum, run: 1, provider: "xai", model: "grok-imagine-image", tokensIn: 0, tokensOut: 0, durationMs: 0 });
        } catch (e) {
          testLog.push(`  Image gen error: ${e.message}`);
        }

        // Test video generation
        let videoOk = false;
        try {
          testLog.push("Testing grok-imagine-video...");
          const res = await fetch("https://api.x.ai/v1/images/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${xaiKey}` },
            body: JSON.stringify({
              model: "grok-imagine-video",
              prompt: "A DJ spinning records at a party with colorful lights, 3 seconds",
              n: 1,
            }),
            signal: AbortSignal.timeout(120000),
          });
          const body = await res.text();
          videoOk = res.ok;
          testLog.push(`  Video gen: ${res.status} ${res.ok ? "OK" : "FAIL"} — ${body.slice(0, 200)}`);
          logCost({ test: testNum, run: 1, provider: "xai", model: "grok-imagine-video", tokensIn: 0, tokensOut: 0, durationMs: 0 });
        } catch (e) {
          testLog.push(`  Video gen error: ${e.message}`);
        }

        const status = imageOk && videoOk ? "PASS" : imageOk || videoOk ? "NEEDS FIX" : "NEEDS BUILD";
        return {
          num: 12, name: "Generative Media",
          status,
          medianScores: null, runs: [], bestModel: "xai",
          reason: `Image: ${imageOk ? "OK" : "FAIL"}. Video: ${videoOk ? "OK" : "FAIL"}. ${!imageOk && !videoOk ? "xAI generative APIs not responding." : ""}`,
        };
      },
    },

    // TEST 13 — Compliance
    {
      num: 13, name: "Compliance", folder: "test-13-compliance", difficulty: "medium",
      systemPrompt: BASE_SYSTEM + `\n\nACCESSIBILITY RULES:
- All images must have descriptive alt text
- All form inputs must have associated <label> elements
- Use semantic HTML: <main>, <nav>, <header>, <footer>, <section>
- All interactive elements must be keyboard-focusable
- Color contrast must meet WCAG AA (4.5:1 for body text)
- Include a cookie consent banner
- Include links to Privacy Policy and Terms of Service pages
- Add lang="en" to <html> tag
- Add <meta name="viewport"> tag`,
      userPrompt: `Build a fully accessible and compliant single HTML page:
1. Cookie consent banner at bottom — dismiss button stores preference in localStorage
2. Privacy Policy section (or link to #privacy)
3. Terms of Service section (or link to #terms)
4. All form inputs with proper labels and aria attributes
5. Semantic HTML throughout (main, nav, header, footer, section)
6. Skip-to-content link at top
7. All interactive elements keyboard-navigable (tabindex, focus styles)
8. lang="en" on html tag, meta viewport present
9. Dark mode. Under 2160px.`,
      customChecks: [
        { name: "Cookie consent", fn: (html) => {
          const has = /cookie|consent|gdpr/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Privacy/Terms", fn: (html) => {
          const privacy = /privacy.policy/i.test(html);
          const terms = /terms.of.service|terms.conditions/i.test(html);
          return { pass: privacy && terms, detail: `Privacy:${privacy} Terms:${terms}` };
        }},
        { name: "Semantic HTML", fn: (html) => {
          const main = /<main/i.test(html);
          const nav = /<nav/i.test(html);
          const header = /<header/i.test(html);
          const footer = /<footer/i.test(html);
          return { pass: main && nav && footer, detail: `main:${main} nav:${nav} header:${header} footer:${footer}` };
        }},
        { name: "lang attribute", fn: (html) => {
          const has = /lang="en"/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Skip-to-content", fn: (html) => {
          const has = /skip.to|skipnav|skip-to-content/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
      ],
    },

    // TEST 14 — Dark/Light Toggle
    {
      num: 14, name: "Dark/Light Toggle", folder: "test-14-darklight", difficulty: "easy",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with a working dark/light mode toggle:
1. Toggle button visible in the nav bar (sun/moon icon or text)
2. Dark mode: background #0F0F1A, ALL text #FFFFFF or #F0F2F5, font-weight 500+
3. Light mode: background #FAFAFA, ALL text #1A1A2E or #111111, font-weight 500+
4. Toggle uses JavaScript to switch a class on <body> or <html>
5. Preference saved to localStorage
6. NO GREY TEXT on either mode. No zinc-500, slate-400, etc.
7. Gold accent color #C9A84C for buttons and highlights
8. Nav, hero section, 3 feature cards, footer
9. Under 2160px.`,
      customChecks: [
        { name: "Toggle button", fn: (html) => {
          const has = /toggle|theme|dark.*mode|light.*mode|sun|moon/i.test(html) && /onclick|click|addEventListener/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "localStorage save", fn: (html) => {
          const has = /localStorage/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Both mode styles", fn: (html) => {
          const dark = /#0F0F1A|dark/i.test(html);
          const light = /#FAFAFA|light/i.test(html);
          return { pass: dark && light, detail: `Dark:${dark} Light:${light}` };
        }},
      ],
    },

    // TEST 15 — Multi-Page
    {
      num: 15, name: "Multi-Page", folder: "test-15-multipage", difficulty: "medium",
      systemPrompt: BASE_SYSTEM.replace("Build a single-page website", "Build a multi-page website") + `\n\nMULTI-PAGE RULES:
- Generate 3 separate HTML files: index.html, services.html, contact.html
- All 3 pages share IDENTICAL nav and footer
- Nav links point to the correct .html files (href="index.html", href="services.html", href="contact.html")
- Use consistent styling across all pages
- Output all 3 files separated by: <!-- FILE: filename.html -->`,
      userPrompt: `Build 3 HTML pages for {{BUSINESS_NAME}}:

PAGE 1 — index.html:
- Hero with "Welcome to {{BUSINESS_NAME}}"
- 3 feature cards
- CTA button linking to contact.html

PAGE 2 — services.html:
- Services heading
- 4 service cards with icons/emojis
- Each with description

PAGE 3 — contact.html:
- Contact form (Name, Email, Phone, Message)
- Business info: {{phone}}, {{email}}, {{address}}
- Map placeholder

ALL PAGES:
- Same nav: Home (index.html), Services (services.html), Contact (contact.html)
- Same footer with {{BUSINESS_NAME}} and {{phone}}
- Dark mode default. Under 2160px each.

Separate each file with: <!-- FILE: filename.html -->`,
      customChecks: [
        { name: "3 pages generated", fn: (html) => {
          const files = (html.match(/<!-- FILE: \w+\.html -->/gi) || []);
          return { pass: files.length >= 2, detail: `${files.length + 1} page markers (${files.map(f => f.match(/\w+\.html/)?.[0]).join(", ")})` };
        }},
        { name: "Nav links correct", fn: (html) => {
          const idx = /href="index\.html"/i.test(html);
          const svc = /href="services\.html"/i.test(html);
          const ct = /href="contact\.html"/i.test(html);
          return { pass: idx && svc && ct, detail: `index:${idx} services:${svc} contact:${ct}` };
        }},
      ],
    },

    // TEST 16 — Blog
    {
      num: 16, name: "Blog", folder: "test-16-blog", difficulty: "medium",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a blog page with:
1. Blog header with title "{{BUSINESS_NAME}} Blog"
2. Category filter buttons: All, Events, Tips, Behind the Scenes. JavaScript filters posts by category.
3. At least 4 blog post cards with: title, date, category tag, excerpt (2-3 lines), "Read More" link
4. Pagination: "Previous" and "Next" buttons (can be non-functional but styled)
5. Sidebar with "Popular Posts" list (3 items)
6. Dark mode. Under 2160px.`,
      customChecks: [
        { name: "Blog posts", fn: (html) => {
          const posts = (html.match(/post|article|blog-card|blog-item/gi) || []).length;
          return { pass: posts >= 4, detail: `${posts} post references` };
        }},
        { name: "Category filter", fn: (html) => {
          const has = /category|filter|All|Events|Tips/i.test(html) && /onclick|click|filter/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Pagination", fn: (html) => {
          const has = /pagination|previous|next|page-\d/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
      ],
    },

    // TEST 17 — Multi-Language
    {
      num: 17, name: "Multi-Language", folder: "test-17-multilang", difficulty: "medium",
      systemPrompt: BASE_SYSTEM,
      userPrompt: `Build a single HTML page with multi-language support:
1. Language switcher in the nav bar — buttons or dropdown for EN and ES (English and Spanish)
2. All visible text wrapped in elements with data-lang-en and data-lang-es attributes
3. JavaScript toggles between languages by showing/hiding elements based on selected language
4. EN content: standard business page with hero, features, contact info
5. ES content: same structure but in Spanish
6. Currently selected language saved to localStorage
7. Dark mode. Under 2160px.`,
      customChecks: [
        { name: "Language switcher", fn: (html) => {
          const has = /lang.*switch|language|i18n|data-lang|EN.*ES|translate/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Spanish content", fn: (html) => {
          const has = /Bienvenid|Servicio|Contacto|Nosotros|Inici/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
        { name: "Toggle JS", fn: (html) => {
          const has = /onclick|addEventListener|switchLang|changeLang|setLanguage/i.test(html);
          return { pass: has, detail: has ? "Found" : "Missing" };
        }},
      ],
    },

    // TEST 18 — Visual Review
    {
      num: 18, name: "Visual Review", folder: "test-18-visual-review", difficulty: "easy",
      specialHandler: async (testDir, testLog, testNum) => {
        testLog.push("Running visual review pipeline test...");

        // First build a simple page
        const sysP = BASE_SYSTEM;
        const userP = `Build a professional business landing page for {{BUSINESS_NAME}} with:
1. Nav, hero section, 3 feature cards, testimonial section, footer
2. Use images from picsum.photos
3. Dark mode. Under 2160px.`;

        const result = await buildPage(sysP, userP, "easy", testNum, 1);
        if (!result.html) {
          return { num: 18, name: "Visual Review", status: "FAIL", medianScores: null, runs: [], bestModel: "none", reason: "Could not build test page" };
        }

        const htmlPath = join(testDir, "index.html");
        writeFileSync(htmlPath, result.html);

        // Take screenshots with Puppeteer
        let screenshotOk = false;
        try {
          const puppeteer = await import("puppeteer");
          const browser = await puppeteer.default.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
          });
          const page = await browser.newPage();
          await page.setViewport({ width: 1920, height: 1080 });
          await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle2", timeout: 15000 });

          const desktopPath = join(testDir, "screenshot-desktop.png");
          await page.screenshot({ path: desktopPath, fullPage: true });
          testLog.push(`Desktop screenshot: ${desktopPath}`);

          await page.setViewport({ width: 375, height: 812 });
          await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle2", timeout: 15000 });
          const mobilePath = join(testDir, "screenshot-mobile.png");
          await page.screenshot({ path: mobilePath, fullPage: true });
          testLog.push(`Mobile screenshot: ${mobilePath}`);

          await browser.close();
          screenshotOk = true;

          // Try vision model review via router
          testLog.push("Sending screenshot to vision model via router...");
          const pick = routeModel("easy");
          try {
            let reviewResult;
            if (pick.type === "local") {
              // Try Ollama vision model
              const visionModels = OLLAMA_MODELS.filter(m => m.includes("-vl") || m.includes("llava") || m.includes("minicpm-v"));
              if (visionModels.length > 0) {
                const imageBuffer = readFileSync(desktopPath);
                const base64 = imageBuffer.toString("base64");
                const res = await fetch(`${OLLAMA_URL}/api/generate`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: visionModels[0],
                    prompt: "Review this website screenshot. List any visual issues: broken layouts, overlapping text, broken images, excessive whitespace.",
                    images: [base64],
                    stream: false,
                    options: { num_predict: 1024 },
                  }),
                  signal: AbortSignal.timeout(60000),
                });
                if (res.ok) {
                  const data = await res.json();
                  reviewResult = { model: visionModels[0], findings: data.response };
                }
              }
            }

            if (!reviewResult && AVAILABLE_KEYS.google) {
              // Gemini fallback (text-based review)
              const geminiKey = process.env.GOOGLE_API_KEY;
              const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: `Review this HTML for visual issues:\n${result.html.slice(0, 8000)}` }] }],
                    generationConfig: { maxOutputTokens: 1024 },
                  }),
                  signal: AbortSignal.timeout(30000),
                },
              );
              if (res.ok) {
                const data = await res.json();
                reviewResult = { model: "gemini-2.5-flash", findings: data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
              }
            }

            if (reviewResult) {
              testLog.push(`Vision review by ${reviewResult.model}:`);
              testLog.push(reviewResult.findings?.slice(0, 500) || "No findings");
            } else {
              testLog.push("Vision review: No model available");
            }
          } catch (e) {
            testLog.push(`Vision review error: ${e.message}`);
          }
        } catch (e) {
          testLog.push(`Screenshot error: ${e.message}`);
        }

        return {
          num: 18, name: "Visual Review",
          status: screenshotOk ? "PASS" : "FAIL",
          medianScores: null, runs: [], bestModel: result.model || "none",
          reason: screenshotOk ? "Screenshots taken and reviewed" : "Screenshot pipeline failed",
        };
      },
    },

    // TEST 19 — Billing
    {
      num: 19, name: "Billing", folder: "test-19-billing", difficulty: "easy",
      specialHandler: async (testDir, testLog, testNum) => {
        testLog.push("Checking billing accuracy...");

        // Read COST_LOG.jsonl and compute totals
        if (!existsSync(COST_LOG)) {
          testLog.push("No COST_LOG.jsonl found — no API calls logged yet");
          return { num: 19, name: "Billing", status: "FAIL", medianScores: null, runs: [], bestModel: "none", reason: "No COST_LOG.jsonl — run other tests first" };
        }

        const lines = readFileSync(COST_LOG, "utf-8").split("\n").filter(Boolean);
        let totalCost = 0;
        const byProvider = {};
        const byModel = {};
        let callCount = 0;

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            callCount++;
            totalCost += entry.cost || 0;
            byProvider[entry.provider] = (byProvider[entry.provider] || 0) + (entry.cost || 0);
            byModel[entry.model] = (byModel[entry.model] || 0) + (entry.cost || 0);
          } catch {}
        }

        testLog.push(`Total API calls logged: ${callCount}`);
        testLog.push(`Total cost: $${totalCost.toFixed(4)}`);
        testLog.push("");
        testLog.push("By Provider:");
        for (const [p, c] of Object.entries(byProvider).sort((a, b) => b[1] - a[1])) {
          testLog.push(`  ${p}: $${c.toFixed(4)}`);
        }
        testLog.push("");
        testLog.push("By Model:");
        for (const [m, c] of Object.entries(byModel).sort((a, b) => b[1] - a[1])) {
          testLog.push(`  ${m}: $${c.toFixed(4)}`);
        }

        // Check Gemini daily
        const geminiToday = getGeminiCallsToday();
        testLog.push("");
        testLog.push(`Gemini calls today: ${geminiToday}/${GEMINI_DAILY_LIMIT}`);

        // Check billing dashboard
        let dashboardOk = false;
        try {
          const res = await fetch(`${BASE_URL}/api/billing/summary`, { signal: AbortSignal.timeout(5000) });
          dashboardOk = res.ok;
          if (res.ok) {
            const data = await res.json();
            testLog.push(`Billing dashboard: $${data.totalCost?.toFixed(4) || "N/A"} (${data.totalCalls || 0} calls)`);
          }
        } catch {
          testLog.push("Billing dashboard: /api/billing/summary not available");
        }

        return {
          num: 19, name: "Billing",
          status: callCount > 0 ? "PASS" : "FAIL",
          medianScores: null, runs: [], bestModel: "none",
          reason: `${callCount} calls, $${totalCost.toFixed(4)} total. Dashboard: ${dashboardOk ? "OK" : "not wired"}. Gemini: ${geminiToday}/${GEMINI_DAILY_LIMIT}`,
        };
      },
    },

    // TEST 20 — Full Site Build
    {
      num: 20, name: "Full Site Build", folder: "test-20-full-site", difficulty: "hard",
      specialHandler: async (testDir, testLog, testNum) => {
        testLog.push("Running full site build via /api/intake/build-multipage...");

        // Load Level 11 Events intake data
        if (!existsSync(INTAKE_V2)) {
          return { num: 20, name: "Full Site Build", status: "FAIL", medianScores: null, runs: [], bestModel: "none", reason: "level11-intake-data-v2.json not found" };
        }

        const intakeData = JSON.parse(readFileSync(INTAKE_V2, "utf-8"));
        const refCode = intakeData.ref_code;

        // Call build-multipage endpoint
        testLog.push(`Calling build-multipage with ref_code: ${refCode}`);
        try {
          const res = await fetch(`${BASE_URL}/api/intake/build-multipage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ref_code: refCode }),
            signal: AbortSignal.timeout(600000), // 10 min
          });

          if (!res.ok) {
            const body = await res.text();
            testLog.push(`Build API returned ${res.status}: ${body.slice(0, 300)}`);
            return { num: 20, name: "Full Site Build", status: "FAIL", medianScores: null, runs: [], bestModel: "none", reason: `Build API error ${res.status}` };
          }

          // Parse NDJSON stream
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          const events = [];
          let doneEvent = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop();
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const d = JSON.parse(line);
                events.push(d);
                if (d.event === "progress") {
                  testLog.push(`  [${d.phase}] ${d.message}`);
                  console.log(`  [${d.phase}] ${d.message}`);
                } else if (d.event === "page_complete" && d.phase === "page") {
                  testLog.push(`  [PAGE] ${d.page} | ${d.model} | ${d.size}b | ${d.status}`);
                  console.log(`  [PAGE] ${d.page} | ${d.model} | ${d.size}b | ${d.status}`);
                  // Log cost
                  logCost({ test: testNum, run: 1, provider: d.provider || "", model: d.model || "", tokensIn: d.tokens?.input || 0, tokensOut: d.tokens?.output || 0, durationMs: d.durationMs || 0 });
                } else if (d.event === "guardian") {
                  testLog.push(`  [GUARDIAN] ${d.page} ${d.pass ? "PASS" : "FAIL"} ${(d.issues || []).join(", ")}`);
                } else if (d.event === "done") {
                  doneEvent = d;
                  testLog.push(`  [DONE] ${d.pagesBuilt}/${d.totalPages} pages | deploy: ${d.deployUrl || "none"}`);
                } else if (d.event === "error") {
                  testLog.push(`  [ERROR] ${d.message}`);
                }
              } catch {}
            }
          }

          if (!doneEvent) {
            return { num: 20, name: "Full Site Build", status: "FAIL", medianScores: null, runs: [], bestModel: "none", reason: "Build stream ended without 'done' event" };
          }

          const allPassed = doneEvent.allPassed;
          const deployUrl = doneEvent.deployUrl || "";

          // Check project directory for built files
          const projectDir = doneEvent.projectDir;
          let htmlFiles = [];
          if (projectDir && existsSync(projectDir)) {
            htmlFiles = readdirSync(projectDir).filter(f => f.endsWith(".html"));
            testLog.push(`Built files: ${htmlFiles.join(", ")}`);
          }

          // Run Lighthouse on index.html if it exists
          let lhScores = null;
          if (projectDir && existsSync(join(projectDir, "index.html"))) {
            lhScores = runLighthouse(join(projectDir, "index.html"));
            testLog.push(`Lighthouse (index.html): Perf=${lhScores.performance} A11y=${lhScores.accessibility} SEO=${lhScores.seo} BP=${lhScores.bestPractices}`);
          }

          return {
            num: 20, name: "Full Site Build",
            status: allPassed ? "PASS" : "FAIL",
            medianScores: lhScores ? { performance: lhScores.performance, accessibility: lhScores.accessibility, seo: lhScores.seo, bestPractices: lhScores.bestPractices } : null,
            runs: [{ model: "pipeline", provider: "auto-router" }],
            bestModel: "auto-router",
            reason: `${doneEvent.pagesBuilt}/${doneEvent.totalPages} pages. Deploy: ${deployUrl || "none"}. ${allPassed ? "All passed" : "Some pages failed"}`,
          };
        } catch (e) {
          testLog.push(`Fatal error: ${e.message}`);
          return { num: 20, name: "Full Site Build", status: "FAIL", medianScores: null, runs: [], bestModel: "none", reason: e.message };
        }
      },
    },
  ];
}

// ══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ══════════════════════════════════════════════════════════════════════════

function generateFinalReport(results, startTime) {
  const totalMs = Date.now() - startTime;
  const lines = [];
  lines.push("# S.A.R.G.E. BUILDER — FINAL TEST REPORT");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total time: ${(totalMs / 1000 / 60).toFixed(1)} minutes`);
  lines.push("");

  // Summary table
  lines.push("## Results Summary");
  lines.push("");
  lines.push("| # | Test | Status | Perf | A11y | SEO | BP | Model | Reason |");
  lines.push("|---|------|--------|------|------|-----|-----|-------|--------|");

  let passCount = 0, failCount = 0, needsBuildCount = 0, needsFixCount = 0;

  for (const r of results) {
    const ms = r.medianScores;
    const perf = ms?.performance ?? "—";
    const a11y = ms?.accessibility ?? "—";
    const seo = ms?.seo ?? "—";
    const bp = ms?.bestPractices ?? "—";
    const statusEmoji = r.status === "PASS" ? "PASS" : r.status === "NEEDS BUILD" ? "NEEDS BUILD" : r.status === "NEEDS FIX" ? "NEEDS FIX" : "FAIL";

    if (r.status === "PASS") passCount++;
    else if (r.status === "NEEDS BUILD") needsBuildCount++;
    else if (r.status === "NEEDS FIX") needsFixCount++;
    else failCount++;

    lines.push(`| ${String(r.num).padStart(2, "0")} | ${r.name} | ${statusEmoji} | ${perf} | ${a11y} | ${seo} | ${bp} | ${r.bestModel} | ${r.reason.slice(0, 60)} |`);
  }

  lines.push("");
  lines.push(`**PASS: ${passCount} | FAIL: ${failCount} | NEEDS BUILD: ${needsBuildCount} | NEEDS FIX: ${needsFixCount}**`);
  lines.push("");

  // Cost summary
  lines.push("## Cost Summary");
  if (existsSync(COST_LOG)) {
    const costLines = readFileSync(COST_LOG, "utf-8").split("\n").filter(Boolean);
    let totalCost = 0;
    const byProvider = {};
    const byModel = {};
    for (const line of costLines) {
      try {
        const e = JSON.parse(line);
        totalCost += e.cost || 0;
        byProvider[e.provider] = (byProvider[e.provider] || 0) + (e.cost || 0);
        byModel[e.model] = (byModel[e.model] || 0) + (e.cost || 0);
      } catch {}
    }
    lines.push(`Total API calls: ${costLines.length}`);
    lines.push(`Total cost: **$${totalCost.toFixed(4)}**`);
    lines.push("");
    lines.push("### By Provider");
    for (const [p, c] of Object.entries(byProvider).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${p}: $${c.toFixed(4)}`);
    }
    lines.push("");
    lines.push("### By Model");
    for (const [m, c] of Object.entries(byModel).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${m}: $${c.toFixed(4)}`);
    }
  } else {
    lines.push("No COST_LOG.jsonl found");
  }
  lines.push("");

  // Needs Build List
  const needsBuildItems = results.filter(r => r.status === "NEEDS BUILD");
  if (needsBuildItems.length > 0) {
    lines.push("## NEEDS BUILD");
    for (const r of needsBuildItems) {
      lines.push(`- **Test ${String(r.num).padStart(2, "0")} — ${r.name}**: ${r.reason}`);
    }
    lines.push("");
  }

  // Needs Fix List
  const needsFixItems = results.filter(r => r.status === "NEEDS FIX");
  if (needsFixItems.length > 0) {
    lines.push("## NEEDS FIX");
    for (const r of needsFixItems) {
      lines.push(`- **Test ${String(r.num).padStart(2, "0")} — ${r.name}**: ${r.reason}`);
    }
    lines.push("");
  }

  // Failed List
  const failedItems = results.filter(r => r.status === "FAIL");
  if (failedItems.length > 0) {
    lines.push("## FAILED");
    for (const r of failedItems) {
      lines.push(`- **Test ${String(r.num).padStart(2, "0")} — ${r.name}**: ${r.reason}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`Total time: ${(totalMs / 1000 / 60).toFixed(1)} minutes`);
  lines.push(`Gemini calls today: ${getGeminiCallsToday()}`);

  return lines.join("\n");
}

function updateTestSuiteMaster(results) {
  const masterPath = join(STANDALONE_DIR, "TEST_SUITE_MASTER.md");
  if (!existsSync(masterPath)) return;

  let content = readFileSync(masterPath, "utf-8");

  for (const r of results) {
    const padNum = String(r.num).padStart(2, "0");
    const statusEmoji = r.status === "PASS" ? "PASS" : r.status === "NEEDS BUILD" ? "NEEDS BUILD" : r.status === "NEEDS FIX" ? "NEEDS FIX" : "FAIL";
    const scoreStr = r.medianScores ? `P${r.medianScores.performance}/A${r.medianScores.accessibility}/S${r.medianScores.seo}/B${r.medianScores.bestPractices}` : "—";

    // Replace the status in the tracker table
    const rowRegex = new RegExp(`\\| ${padNum} \\|[^|]+\\|[^|]+\\| [^|]+ \\| [^|]+ \\|`);
    const match = content.match(rowRegex);
    if (match) {
      // Extract the existing row parts
      const parts = match[0].split("|").map(s => s.trim());
      // parts[0]="" parts[1]=num parts[2]=name parts[3]=folder parts[4]=status parts[5]=score
      if (parts.length >= 6) {
        const newStatus = r.status === "PASS" ? "PASS" : r.status === "NEEDS BUILD" ? "NEEDS BUILD" : r.status === "NEEDS FIX" ? "NEEDS FIX" : "FAIL";
        const newRow = `| ${parts[1]} | ${parts[2]} | ${parts[3]} | ${newStatus} | ${scoreStr} |`;
        content = content.replace(match[0], newRow);
      }
    }
  }

  writeFileSync(masterPath, content);
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  S.A.R.G.E. BUILDER — TEST AUTOMATION RUNNER               ║");
  console.log("║  20 Tests | All Available Models | Cheapest First           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Pre-flight
  console.log("── PRE-FLIGHT ──────────────────────────────────────────────────");
  await preflight();
  console.log("");

  // Run all 20 tests
  const tests = defineTests();
  const results = [];

  for (const testConfig of tests) {
    try {
      const result = await runTest(testConfig);
      results.push(result);
      console.log(`\n  >> TEST ${String(result.num).padStart(2, "0")}: ${result.status} — ${result.reason.slice(0, 80)}`);

      // Update Gemini counter
      GEMINI_TODAY = getGeminiCallsToday();
      if (GEMINI_DAILY_LIMIT - GEMINI_TODAY <= GEMINI_WARN_THRESHOLD && !GEMINI_DEPRIORITIZED) {
        GEMINI_DEPRIORITIZED = true;
        console.log(`  ⚠ Gemini within ${GEMINI_WARN_THRESHOLD} of daily limit — deprioritized`);
      }
    } catch (err) {
      console.log(`\n  >> TEST ${String(testConfig.num).padStart(2, "0")}: FATAL ERROR — ${err.message}`);
      results.push({
        num: testConfig.num,
        name: testConfig.name,
        status: "FAIL",
        medianScores: null,
        runs: [],
        bestModel: "none",
        reason: `Fatal: ${err.message}`,
      });
    }
  }

  // Generate FINAL_REPORT.md
  console.log("\n\n══════════════════════════════════════════════════════════════");
  console.log("GENERATING FINAL REPORT...");
  const report = generateFinalReport(results, startTime);
  writeFileSync(FINAL_REPORT, report);
  console.log(`Written: ${FINAL_REPORT}`);

  // Update TEST_SUITE_MASTER.md
  try {
    updateTestSuiteMaster(results);
    console.log("Updated: TEST_SUITE_MASTER.md");
  } catch (e) {
    console.log(`Could not update TEST_SUITE_MASTER.md: ${e.message}`);
  }

  // Print report to console
  console.log("\n" + report);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
