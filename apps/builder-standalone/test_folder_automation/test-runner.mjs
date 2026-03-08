#!/usr/bin/env node
/**
 * S.A.R.G.E. BUILDER — Test Automation Runner v1.0
 * Runs all 20 tests per TEST_SUITE_MASTER.md
 * Auto-routes models per BUILDER_RULES.md
 *
 * Usage: node test-runner.mjs
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "dotenv";

// === PATHS ===
const TEST_BASE = import.meta.dirname;
const STANDALONE = path.resolve(TEST_BASE, "..", "..");
const ROOT = path.resolve(STANDALONE, "..", "..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(STANDALONE, f);
  if (fs.existsSync(p)) config({ path: p });
}

const OLLAMA_URL = "http://127.0.0.1:11434";
const APP_PORT = 3101;
const APP_URL = `http://localhost:${APP_PORT}`;
const MIN_PAGE_SIZE = 5120;
const MAX_HEIGHT = 2160;
const LH_THRESHOLD = 80;
const MEDIAN_THRESHOLD = 50;
const GEMINI_DAILY_LIMIT = 1500;
const COST_LOG = path.join(TEST_BASE, "COST_LOG.jsonl");
const RUNNER_LOG = path.join(TEST_BASE, "RUNNER_LOG.md");
const FINAL_REPORT = path.join(TEST_BASE, "FINAL_REPORT.md");
const MASTER_MD = path.join(STANDALONE, "TEST_SUITE_MASTER.md");
const L11_DATA = path.join(STANDALONE, "level11-intake-data-v2.json");

// === PRICING (from packages/billing/src/rates.ts) ===
const RATES = {
  "deepseek-chat": { i: 0.27, o: 1.10 },
  "grok-4-1-fast-non-reasoning": { i: 0.20, o: 0.50 },
  "grok-code-fast-1": { i: 0.20, o: 0.50 },
  "gemini-2.5-flash": { i: 0.30, o: 2.50 },
  "gpt-4.1": { i: 2.00, o: 8.00 },
  "gpt-4.1-mini": { i: 0.40, o: 1.60 },
  "grok-4.20-experimental-beta-0304-non-reasoning": { i: 2.00, o: 6.00 },
  "claude-sonnet-4-5-20250514": { i: 3.00, o: 15.00 },
};

// === MODEL CHAIN (BUILDER_RULES.md: local first, cheap cloud, mid, expensive) ===
const MODEL_CHAIN = [
  { provider: "ollama", model: "qwen2.5-coder:14b", type: "local", tier: "Local 14B" },
  { provider: "ollama", model: "qwen2.5-coder:7b", type: "local", tier: "Local 7B" },
  { provider: "ollama", model: "codellama:7b", type: "local", tier: "Local CodeLlama" },
  { provider: "deepseek", model: "deepseek-chat", type: "cloud", tier: "Cheap Cloud", key: "DEEPSEEK_API_KEY" },
  { provider: "xai", model: "grok-4-1-fast-non-reasoning", type: "cloud", tier: "Cheap Cloud", key: "XAI_API_KEY" },
  { provider: "google", model: "gemini-2.5-flash", type: "cloud", tier: "Mid-tier", key: "GOOGLE_API_KEY" },
  { provider: "openai", model: "gpt-4.1", type: "cloud", tier: "Mid-tier", key: "OPENAI_API_KEY" },
  { provider: "xai", model: "grok-4.20-experimental-beta-0304-non-reasoning", type: "cloud", tier: "Premium", key: "XAI_API_KEY" },
  { provider: "anthropic", model: "claude-sonnet-4-5-20250514", type: "cloud", tier: "Premium", key: "ANTHROPIC_API_KEY" },
];

// === GREY TEXT PATTERNS ===
const GREY_RX = [
  /text-zinc-[4-7]00/g, /text-slate-[4-6]00/g, /text-gray-[4-6]00/g, /text-neutral-[4-6]00/g,
  /color:\s*#6b7280/gi, /color:\s*#71717a/gi, /color:\s*#52525b/gi, /color:\s*#3f3f46/gi,
  /color:\s*#94a3b8/gi, /color:\s*#64748b/gi, /color:\s*#9ca3af/gi, /color:\s*#a1a1aa/gi,
  /zinc-500/g, /zinc-600/g, /zinc-700/g, /slate-400/g, /slate-500/g,
];

// === PII DATA ===
const PII = {
  businessName: "Level 11 Events",
  phone: "(612) 555-0111",
  email: "info@level11events.com",
  address: "PO Box 44426, Eden Prairie, MN 55344",
  city: "Eden Prairie",
  state: "MN",
  clientName: "DJ Sarge",
};

// === STATE ===
let ollamaModels = [];
let apiKeys = {};
let geminiToday = 0;
let portAlive = false;
const allResults = [];
let suiteStartTime = 0;

// ╔══════════════════════════════════════════════════════════════╗
// ║  PRE-FLIGHT                                                  ║
// ╚══════════════════════════════════════════════════════════════╝

async function preflight() {
  const log = ["# RUNNER PRE-FLIGHT LOG", `Timestamp: ${new Date().toISOString()}`, ""];

  // 1. Ollama
  log.push("## Ollama Models");
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      ollamaModels = data.models.map(m => m.name);
      log.push(`Status: ONLINE (${ollamaModels.length} models)`);
      const relevant = ollamaModels.filter(m => m.includes("qwen2.5-coder") || m.includes("codellama"));
      log.push(`Builder-relevant: ${relevant.join(", ") || "none"}`);
    } else { log.push("Status: OFFLINE (bad response)"); }
  } catch { log.push("Status: OFFLINE (connection refused)"); }
  log.push("");

  // 2. API keys
  log.push("## API Keys");
  for (const k of ["ANTHROPIC_API_KEY","OPENAI_API_KEY","GOOGLE_API_KEY","XAI_API_KEY","DEEPSEEK_API_KEY","RESEND_API_KEY","GITHUB_TOKEN"]) {
    apiKeys[k] = !!process.env[k];
    log.push(`${k}: ${apiKeys[k] ? "✓" : "✗"}`);
  }
  log.push("");

  // 3. Gemini daily usage
  log.push("## Gemini Daily Usage");
  geminiToday = countGemini();
  log.push(`Calls today: ${geminiToday} / ${GEMINI_DAILY_LIMIT}`);
  if (geminiToday > GEMINI_DAILY_LIMIT - 20) log.push("⚠ Near limit — Gemini deprioritized");
  log.push("");

  // 4. Port
  log.push("## Port Check");
  try {
    const res = await fetch(`${APP_URL}/api/status`, { signal: AbortSignal.timeout(5000) });
    portAlive = res.ok;
  } catch { portAlive = false; }
  log.push(`localhost:${APP_PORT}: ${portAlive ? "✓ alive" : "✗ dead"}`);
  log.push("");

  // 5. Available pool
  log.push("## Available Model Pool");
  const pool = getPool();
  for (const m of pool) log.push(`- ${m.provider}:${m.model} (${m.tier})`);
  if (!pool.length) log.push("⚠ NO MODELS AVAILABLE");
  log.push("");

  fs.writeFileSync(RUNNER_LOG, log.join("\n"));
  console.log(log.join("\n"));
  return pool.length > 0;
}

function countGemini() {
  if (!fs.existsSync(COST_LOG)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return fs.readFileSync(COST_LOG, "utf-8").split("\n").filter(l => {
    try { const e = JSON.parse(l); return e.provider === "google" && e.timestamp?.startsWith(today); } catch { return false; }
  }).length;
}

function getPool() {
  return MODEL_CHAIN.filter(m => {
    if (m.type === "local") return ollamaModels.some(o => o === m.model || o.startsWith(m.model.split(":")[0]));
    if (m.key && !process.env[m.key]) return false;
    if (m.provider === "google" && geminiToday > GEMINI_DAILY_LIMIT - 20) return false;
    return true;
  });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  ROUTER                                                      ║
// ╚══════════════════════════════════════════════════════════════╝

function route(difficulty = "easy", tried = new Set()) {
  const avail = getPool().filter(m => !tried.has(`${m.provider}:${m.model}`));
  if (!avail.length) return null;
  if (difficulty === "hard") { const cloud = avail.filter(m => m.type === "cloud"); if (cloud.length) return cloud[0]; }
  return avail[0];
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  BUILD FUNCTIONS                                             ║
// ╚══════════════════════════════════════════════════════════════╝

function extractHtml(content) {
  let h = content.trim();
  const fence = h.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (fence) h = fence[1].trim();
  if (!h.startsWith("<")) {
    let idx = h.indexOf("<!DOCTYPE");
    if (idx === -1) idx = h.indexOf("<html");
    if (idx > 0) h = h.slice(idx);
  }
  return h;
}

async function buildOllama(model, sys, usr) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, system: sys, prompt: usr, stream: false, options: { num_predict: 16384, temperature: 0.7 } }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return { html: extractHtml(data.response || ""), tIn: data.prompt_eval_count || 0, tOut: data.eval_count || 0 };
}

async function buildCloud(provider, model, sys, usr) {
  const res = await fetch(`${APP_URL}/api/test/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, prompt: usr, systemPrompt: sys, source: "test-runner", maxOutputTokens: 16384 }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  if (!res.body) throw new Error("No body");
  let html = "", tIn = 0, tOut = 0;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value, { stream: true }).split("\n")) {
      if (!line.trim()) continue;
      try {
        const d = JSON.parse(line);
        if (d.token) html += d.token;
        if (d.content) html += d.content;
        if (d.message?.content) html += d.message.content;
        if (d.usage) { tIn = d.usage.input_tokens || d.usage.prompt_tokens || tIn; tOut = d.usage.output_tokens || d.usage.completion_tokens || tOut; }
        if (d.full_content) html = d.full_content;
      } catch {}
    }
  }
  return { html: extractHtml(html), tIn, tOut };
}

async function buildPage(sys, usr, difficulty = "easy") {
  const tried = new Set();
  while (true) {
    const r = route(difficulty, tried);
    if (!r) return { ok: false, error: "All models exhausted", html: "", model: "", provider: "", tier: "", reason: "", tIn: 0, tOut: 0, ms: 0 };
    const key = `${r.provider}:${r.model}`;
    tried.add(key);
    const reason = `${key} — ${r.tier}, attempt ${tried.size}`;
    const t0 = Date.now();
    try {
      const res = r.type === "local" ? await buildOllama(r.model, sys, usr) : await buildCloud(r.provider, r.model, sys, usr);
      const ms = Date.now() - t0;
      if (res.html.length < MIN_PAGE_SIZE) { console.log(`  ✗ ${key}: ${res.html.length}b < ${MIN_PAGE_SIZE}`); continue; }
      if (r.provider === "google") geminiToday++;
      return { ok: true, html: res.html, model: r.model, provider: r.provider, tier: r.tier, reason, tIn: res.tIn, tOut: res.tOut, ms };
    } catch (err) {
      console.log(`  ✗ ${key}: ${err.message.slice(0, 100)} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    }
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  COST                                                        ║
// ╚══════════════════════════════════════════════════════════════╝

function calcCost(provider, model, tIn, tOut) {
  if (provider === "ollama") return 0;
  const r = RATES[model] || { i: 0, o: 0 };
  return (tIn * r.i + tOut * r.o) / 1e6;
}

function logCost(test, run, provider, model, tIn, tOut, cost) {
  fs.appendFileSync(COST_LOG, JSON.stringify({ timestamp: new Date().toISOString(), test, run, provider, model, tokensIn: tIn, tokensOut: tOut, cost: +cost.toFixed(6) }) + "\n");
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PII INJECTION                                               ║
// ╚══════════════════════════════════════════════════════════════╝

function injectPII(html) {
  const map = {
    "{{BUSINESS_NAME}}": PII.businessName, "{{business_name}}": PII.businessName,
    "{{phone}}": PII.phone, "{{PHONE}}": PII.phone,
    "{{email}}": PII.email, "{{EMAIL}}": PII.email,
    "{{address}}": PII.address, "{{ADDRESS}}": PII.address,
    "{{city}}": PII.city, "{{CITY}}": PII.city,
    "{{state}}": PII.state, "{{STATE}}": PII.state,
    "{{client_name}}": PII.clientName, "{{CLIENT_NAME}}": PII.clientName,
    "{{name}}": PII.businessName, "{{NAME}}": PII.businessName,
  };
  for (const [k, v] of Object.entries(map)) html = html.replaceAll(k, v);
  return html;
}

function countPlaceholders(html) { return (html.match(/\{\{[^}]+\}\}/g) || []).length; }

// ╔══════════════════════════════════════════════════════════════╗
// ║  SCORING                                                     ║
// ╚══════════════════════════════════════════════════════════════╝

async function runLighthouse(htmlPath) {
  try {
    const url = `file:///${htmlPath.replace(/\\/g, "/")}`;
    const out = execSync(
      `npx lighthouse "${url}" --output=json --quiet --chrome-flags="--headless --no-sandbox --disable-gpu" --only-categories=performance,accessibility,best-practices,seo 2>/dev/null`,
      { timeout: 90000, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    const c = JSON.parse(out).categories;
    return { perf: Math.round((c.performance?.score||0)*100), a11y: Math.round((c.accessibility?.score||0)*100), seo: Math.round((c.seo?.score||0)*100), bp: Math.round((c["best-practices"]?.score||0)*100) };
  } catch (e) { console.log(`  LH error: ${e.message.slice(0, 80)}`); return { perf: 0, a11y: 0, seo: 0, bp: 0 }; }
}

async function measureHeight(htmlPath) {
  try {
    const pup = await import("puppeteer");
    const browser = await pup.default.launch({ headless: true, args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu"] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle2", timeout: 15000 });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await browser.close();
    return h;
  } catch (e) { console.log(`  Height error: ${e.message.slice(0, 80)}`); return -1; }
}

async function takeScreenshots(htmlPath, outDir) {
  try {
    const pup = await import("puppeteer");
    const browser = await pup.default.launch({ headless: true, args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu"] });
    const page = await browser.newPage();
    const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "desktop.png"), fullPage: true });
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, "mobile.png"), fullPage: true });
    await browser.close();
    return true;
  } catch (e) { console.log(`  Screenshot error: ${e.message.slice(0, 80)}`); return false; }
}

function checkGrey(html) {
  const hits = [];
  for (const rx of GREY_RX) { rx.lastIndex = 0; const m = html.match(rx); if (m) hits.push(...m); }
  return hits;
}

function checkBrokenAssets(html) {
  const issues = [];
  if (/src=["']\s*["']/i.test(html)) issues.push("empty src");
  if (/src=["']#["']/i.test(html)) issues.push("src=#");
  if (/src=["']undefined["']/i.test(html)) issues.push("src=undefined");
  if (/source\.unsplash\.com/i.test(html)) issues.push("source.unsplash.com");
  return issues;
}

async function scoreFile(htmlPath, html) {
  const lh = await runLighthouse(htmlPath);
  const height = await measureHeight(htmlPath);
  const grey = checkGrey(html);
  const placeholders = countPlaceholders(html);
  const broken = checkBrokenAssets(html);
  const avg = (lh.perf + lh.a11y + lh.seo + lh.bp) / 4;
  return {
    lh, avg, height, grey, placeholders, broken,
    lhPass: lh.perf >= LH_THRESHOLD && lh.a11y >= LH_THRESHOLD && lh.seo >= LH_THRESHOLD && lh.bp >= LH_THRESHOLD,
    heightPass: height > 0 && height <= MAX_HEIGHT,
    greyPass: grey.length === 0,
    phPass: placeholders === 0,
    assetPass: broken.length === 0,
  };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  SYSTEM PROMPT                                               ║
// ╚══════════════════════════════════════════════════════════════╝

const SYS = `You are a web developer. Output ONLY a complete HTML file. No markdown, no explanations, no backticks.
Rules:
- Start with <!DOCTYPE html>, end with </html>
- ALL CSS in <style>, ALL JS in <script>. No external files.
- <html lang="en">, <meta name="viewport" content="width=device-width, initial-scale=1">
- Dark mode default: background #0F0F1A, ALL text #FFFFFF or #F0F2F5
- font-weight 500+ body, 700+ headings. Min 14px body, 12px labels.
- NO grey text. NO zinc-500, slate-400, gray-500. NO dim/muted colors. EVER.
- Semantic HTML: header, nav, main, footer.
- Mobile responsive with hamburger nav.
- Under 2160px total height at 1080p desktop.
- Use PII placeholders: {{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}.`;

// ╔══════════════════════════════════════════════════════════════╗
// ║  TEST-SPECIFIC CHECKS                                        ║
// ╚══════════════════════════════════════════════════════════════╝

function has(html, rx) { return rx.test(html); }
function cnt(html, rx) { return (html.match(rx) || []).length; }

const testChecks = {
  t01(html) {
    const p = [], f = [];
    has(html, /<nav[\s>]/i) ? p.push("nav") : f.push("nav missing");
    (has(html, /hero/i) || has(html, /<h1/i)) ? p.push("hero") : f.push("hero missing");
    has(html, /<footer[\s>]/i) ? p.push("footer") : f.push("footer missing");
    cnt(html, /<img[\s>]/gi) === 0 ? p.push("no-images") : f.push("has images");
    return { passed: p, failed: f };
  },
  t02(html) {
    const p = [], f = [];
    const cards = cnt(html, /class=["'][^"']*card/gi);
    cards >= 4 ? p.push(`${cards} cards`) : f.push(`only ${cards} cards (need 4+)`);
    (has(html, /accordion/i) || has(html, /collapsible/i) || has(html, /toggle.*panel/i)) ? p.push("accordion") : f.push("accordion missing");
    (has(html, /\.tab/i) || has(html, /role=["']tab/i)) ? p.push("tabs") : f.push("tabs missing");
    has(html, /addEventListener|onclick/i) ? p.push("JS") : f.push("no JS");
    return { passed: p, failed: f };
  },
  t03(html) {
    const p = [], f = [];
    cnt(html, /picsum\.photos/gi) >= 1 ? p.push("picsum images") : f.push("no picsum images");
    has(html, /youtube\.com\/embed/i) ? p.push("youtube") : f.push("youtube missing");
    !has(html, /source\.unsplash/i) ? p.push("no unsplash") : f.push("uses unsplash");
    return { passed: p, failed: f };
  },
  t05(html) {
    const p = [], f = [];
    has(html, /<form[\s>]/i) ? p.push("form") : f.push("form missing");
    has(html, /required/i) ? p.push("validation") : f.push("no validation");
    (has(html, /newsletter/i) || has(html, /subscribe/i)) ? p.push("newsletter") : f.push("newsletter missing");
    return { passed: p, failed: f };
  },
  t06(html) {
    const p = [], f = [];
    (has(html, /calendar/i) || has(html, /datepicker/i)) ? p.push("calendar") : f.push("calendar missing");
    (has(html, /countdown/i) || has(html, /setInterval/i)) ? p.push("countdown") : f.push("countdown missing");
    (has(html, /pricing/i) && (has(html, /table/i) || has(html, /card/i))) ? p.push("pricing") : f.push("pricing missing");
    (has(html, /\.pdf/i) || has(html, /download/i)) ? p.push("pdf link") : f.push("pdf link missing");
    return { passed: p, failed: f };
  },
  t07(html) {
    const p = [], f = [];
    (has(html, /lightbox/i) || has(html, /overlay/i) || has(html, /modal/i)) ? p.push("lightbox") : f.push("lightbox missing");
    (has(html, /maps\.google|google\.com\/maps|openstreetmap/i)) ? p.push("map") : f.push("map missing");
    (has(html, /twitter|facebook|instagram|social/i)) ? p.push("social") : f.push("social missing");
    return { passed: p, failed: f };
  },
  t13(html) {
    const p = [], f = [];
    has(html, /tabindex/i) ? p.push("tabindex") : f.push("no tabindex");
    (has(html, /cookie/i) && has(html, /consent|banner|accept/i)) ? p.push("cookie consent") : f.push("cookie consent missing");
    has(html, /privacy/i) ? p.push("privacy") : f.push("privacy missing");
    has(html, /terms/i) ? p.push("terms") : f.push("terms missing");
    has(html, /<main[\s>]/i) ? p.push("main") : f.push("no main");
    return { passed: p, failed: f };
  },
  t14(html) {
    const p = [], f = [];
    (has(html, /dark.*mode|light.*mode|theme.*toggle|mode-toggle|theme-switch/i)) ? p.push("toggle") : f.push("toggle missing");
    has(html, /#0F0F1A|#1A1A2E/i) ? p.push("dark bg") : f.push("no dark bg");
    (has(html, /#FAFAFA|#FFFFFF/i) && has(html, /background/i)) ? p.push("light bg") : f.push("no light bg");
    has(html, /addEventListener|onclick/i) ? p.push("JS toggle") : f.push("no JS");
    return { passed: p, failed: f };
  },
  t16(html) {
    const p = [], f = [];
    cnt(html, /post|article|blog-card|blog-item/gi) >= 4 ? p.push("posts") : f.push("not enough posts");
    (has(html, /categor/i) || has(html, /filter/i)) ? p.push("categories") : f.push("categories missing");
    has(html, /pagination|page.*\d|prev.*next/i) ? p.push("pagination") : f.push("pagination missing");
    return { passed: p, failed: f };
  },
  t17(html) {
    const p = [], f = [];
    (has(html, /language.*switch|lang.*switch|data-lang|translate/i)) ? p.push("lang switcher") : f.push("lang switcher missing");
    has(html, /es|español|spanish/i) ? p.push("spanish content") : f.push("no spanish");
    return { passed: p, failed: f };
  },
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  TEST PROMPTS                                                ║
// ╚══════════════════════════════════════════════════════════════╝

const PROMPTS = {
  t01: `Build a single HTML page with:
1. Nav bar: Home, Services, About, Contact (all href="#")
2. Hero section: heading "Welcome to {{BUSINESS_NAME}}", subheading about premium services, "Get Started" CTA button
3. Footer: {{phone}}, {{email}}, {{BUSINESS_NAME}}, copyright
4. Dark mode default, mobile responsive, no images, under 2160px`,

  t02: `Build a page with:
1. Nav bar with hamburger mobile menu
2. Section with MINIMUM 4 cards in a CSS grid (service cards with icon, title, description). Each card must have class="card" in its class list.
3. Accordion section with 3+ collapsible FAQ items (click to expand/collapse, JavaScript MUST work)
4. Tab section with 3+ tabs using role="tab" (click tab to show content, JavaScript MUST work)
5. Footer with {{phone}}, {{email}}
No images. Under 2160px. Dark mode default.`,

  t03: `Build a page with:
1. Nav bar
2. Hero with heading and a background image from https://picsum.photos/seed/hero/1920/600
3. Gallery section with at least 4 images from picsum.photos (use seeds: https://picsum.photos/seed/pic1/400/300, /seed/pic2/400/300, /seed/pic3/400/300, /seed/pic4/400/300)
4. Video section with YouTube embed: <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" allowfullscreen></iframe>
5. Footer
Do NOT use source.unsplash.com. ONLY picsum.photos for images. Dark mode. Under 2160px.`,

  t05: `Build a page with:
1. Nav bar
2. Contact form: Name (required), Email (required, type="email"), Phone, Message (textarea, required)
3. JavaScript form validation: highlight empty required fields in red, show error messages, validate email format
4. Success message shown after valid submission (preventDefault, show "Thank you!")
5. Newsletter signup section: email input + "Subscribe" button, separate from contact form
6. Footer with {{phone}}, {{email}}
Dark mode. Under 2160px. No images.`,

  t06: `Build a page with:
1. Nav bar
2. Calendar widget: monthly view showing current month, days in grid, clickable dates (JavaScript)
3. Countdown timer: counts down to December 31, 2026 showing days/hours/minutes/seconds, uses setInterval to update every second
4. Pricing table: 3 tiers (Basic $99, Standard $199, Premium $399) each with 4-5 features, CTA button
5. PDF download link: <a href="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" download>Download Brochure</a>
6. Footer
Dark mode. Under 2160px. No images.`,

  t07: `Build a page with:
1. Nav bar
2. Image gallery: 6 images from picsum.photos in a grid. Each clickable — opens lightbox overlay (dark overlay with enlarged image and X close button, JavaScript functional)
3. Map section: <iframe src="https://maps.google.com/maps?q=Minneapolis+MN&output=embed" width="100%" height="300" style="border:0"></iframe>
4. Social media section with at least one social embed or placeholder
5. Footer
Dark mode. Under 2160px.`,

  t13: `Build a fully accessible page with:
1. Skip-to-content link: <a href="#main-content" class="skip-link" tabindex="0">Skip to main content</a>
2. All buttons and links have tabindex and visible focus styles (outline on :focus)
3. Cookie consent banner at bottom: "We use cookies..." with Accept/Decline buttons
4. Links to Privacy Policy (href="privacy.html") and Terms (href="terms.html")
5. <main id="main-content"> wrapping content
6. Proper heading hierarchy (h1, h2, h3 in order)
7. ARIA labels on interactive elements
8. Footer
Dark mode. Under 2160px. Use picsum.photos for any images with alt text.`,

  t14: `Build a page with a working dark/light mode toggle:
1. Nav bar with toggle button (sun/moon icon or text)
2. Dark mode (default): background #0F0F1A, text #FFFFFF, accent #C9A84C
3. Light mode: background #FAFAFA, text #1A1A2E, accent #C9A84C
4. Toggle uses addEventListener, saves to localStorage
5. CSS transition: transition background-color 0.3s, color 0.3s
6. Hero, 3 feature cards, footer
7. NO grey text on EITHER mode.
Dark mode default. Under 2160px. No images.`,

  t16: `Build a blog page with:
1. Nav bar
2. Blog header "{{BUSINESS_NAME}} Blog"
3. At least 4 blog post cards: each has class containing "post" or "article", with title, date, category badge, excerpt, "Read More" link
4. Category filter buttons: All, News, Tips, Events — clicking filters cards by data-category (JavaScript)
5. Pagination buttons: 1, 2, 3 at bottom (JavaScript show/hide, 2 posts per page)
6. Footer
Dark mode. Under 2160px. No images.`,

  t17: `Build a multi-language page with:
1. Language switcher in nav: EN and ES buttons
2. All text in spans: <span data-lang-en="English" data-lang-es="Spanish">English</span>
3. JavaScript: clicking EN/ES shows correct language, hides other. Uses data-lang attributes.
4. html lang attribute updates on switch
5. Hero, About, Contact sections — all bilingual
6. Footer with {{phone}}, {{email}}
Dark mode. Under 2160px. No images. Default: English.`,
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  PAGE TEST ORCHESTRATOR                                      ║
// ╚══════════════════════════════════════════════════════════════╝

async function runPageTest(num, name, folder, prompt, difficulty, checkFn) {
  const dir = path.join(TEST_BASE, folder);
  fs.mkdirSync(dir, { recursive: true });
  const blog = [];
  blog.push("=".repeat(60), `TEST ${String(num).padStart(2,"0")} — ${name}`, `Started: ${new Date().toISOString()}`, "=".repeat(60));
  console.log(`\n${"=".repeat(50)}\nTEST ${String(num).padStart(2,"0")} — ${name}\n${"=".repeat(50)}`);

  const result = { num, name, folder, status: "FAIL", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  for (let run = 1; run <= 3; run++) {
    // Wipe (keep BUILD_LOG.txt)
    if (run > 1) {
      for (const f of fs.readdirSync(dir)) {
        if (f !== "BUILD_LOG.txt") fs.rmSync(path.join(dir, f), { recursive: true, force: true });
      }
    }
    blog.push(`\n── Run ${run} ──`);
    console.log(`  Run ${run}...`);

    const b = await buildPage(SYS, prompt, difficulty);
    if (!b.ok) {
      blog.push(`Build FAILED: ${b.error}`);
      result.runs.push({ run, score: 0, model: "none", cost: 0, ms: 0, passed: [], failed: ["build"] });
      break;
    }

    let html = injectPII(b.html);
    const htmlPath = path.join(dir, "index.html");
    fs.writeFileSync(htmlPath, html);

    const cost = calcCost(b.provider, b.model, b.tIn, b.tOut);
    logCost(num, run, b.provider, b.model, b.tIn, b.tOut, cost);
    result.cost += cost;

    blog.push(`Model: ${b.provider}:${b.model} (${b.tier})`);
    blog.push(`Size: ${html.length}b | Tokens: ${b.tIn}/${b.tOut} | Cost: $${cost.toFixed(6)} | Time: ${(b.ms/1000).toFixed(1)}s`);

    const s = await scoreFile(htmlPath, html);
    const passed = [], failed = [];
    s.lhPass ? passed.push("lighthouse") : failed.push(`LH P:${s.lh.perf} A:${s.lh.a11y} S:${s.lh.seo} BP:${s.lh.bp}`);
    s.heightPass ? passed.push("height") : failed.push(`height ${s.height}px`);
    s.greyPass ? passed.push("grey") : failed.push(`grey(${s.grey.length})`);
    s.phPass ? passed.push("placeholders") : failed.push(`ph(${s.placeholders})`);
    s.assetPass ? passed.push("assets") : failed.push(`assets(${s.broken.join(",")})`);
    if (checkFn) { const x = checkFn(html); passed.push(...x.passed); failed.push(...x.failed); }

    blog.push(`LH: P:${s.lh.perf} A:${s.lh.a11y} S:${s.lh.seo} BP:${s.lh.bp} (avg ${s.avg.toFixed(0)})`);
    blog.push(`Height: ${s.height}px | Grey: ${s.grey.length} | PH: ${s.placeholders} | Assets: ${s.broken.length}`);
    blog.push(`PASS: ${passed.join(", ")}`, `FAIL: ${failed.join(", ") || "none"}`);

    result.runs.push({ run, score: s.avg, model: `${b.provider}:${b.model}`, cost, ms: b.ms, passed, failed, lh: s.lh });
    result.winner = `${b.provider}:${b.model}`;

    // Stop after run 1 if below threshold
    if (run === 1 && s.avg <= MEDIAN_THRESHOLD) {
      blog.push(`Score ${s.avg.toFixed(0)} <= ${MEDIAN_THRESHOLD} — stopping`);
      break;
    }
  }

  const scores = result.runs.map(r => r.score).sort((a,b) => a-b);
  result.median = scores.length ? scores[Math.floor(scores.length / 2)] : 0;
  const last = result.runs[result.runs.length - 1];
  if (last && last.failed.length === 0) {
    result.status = "PASS";
    result.reason = `All criteria met. Median: ${result.median.toFixed(0)}`;
  } else {
    result.status = "FAIL";
    result.reason = last ? last.failed.join("; ") : "No runs";
  }

  blog.push(`\nSTATUS: ${result.status} | MEDIAN: ${result.median.toFixed(0)} | COST: $${result.cost.toFixed(6)}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 04 — Asset Management                       ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest04() {
  const dir = path.join(TEST_BASE, "test-04-assets"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 04 — Asset Management", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 04 — Asset Management\n${"=".repeat(50)}`);
  const result = { num: 4, name: "Asset Management", folder: "test-04-assets", status: "NEEDS BUILD", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  for (const ep of ["/api/builder/asset", "/api/builder/assets", "/api/builder/assets/copy-to-project"]) {
    try {
      const res = await fetch(`${APP_URL}${ep}`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({test:true}), signal: AbortSignal.timeout(5000) });
      blog.push(`${ep}: ${res.status}`);
    } catch (e) { blog.push(`${ep}: ${e.message.slice(0,80)}`); }
  }

  const projDir = process.env.BUILDER_PROJECTS_DIR || "L:/AI_MASTER_BUILDS";
  blog.push(`\nProject dir: ${projDir} (exists: ${fs.existsSync(projDir)})`);
  result.reason = "Asset upload endpoints exist but intake-section-based folder routing (logo/, hero/, services/, team/, gallery/) not verified. Need: logo upload accepted, assets routed to correct subfolder by intake section.";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 08 — PII + Guardian                          ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest08() {
  const dir = path.join(TEST_BASE, "test-08-pii"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 08 — PII Injection + Guardian", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 08 — PII + Guardian\n${"=".repeat(50)}`);
  const result = { num: 8, name: "PII + Guardian", folder: "test-08-pii", status: "FAIL", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  const prompt = `Build a page using ALL these placeholders in visible text:
- {{BUSINESS_NAME}} in the hero heading AND footer
- {{phone}} in contact section AND footer
- {{email}} in contact section AND footer
- {{address}} in contact section
- {{city}} and {{state}} in location line
- {{client_name}} in about section
Sections: nav, hero, about, contact, footer. Dark mode. Under 2160px.`;

  const b = await buildPage(SYS, prompt, "easy");
  if (!b.ok) { result.reason = `Build failed: ${b.error}`; blog.push(result.reason); fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n")); return result; }

  const cost = calcCost(b.provider, b.model, b.tIn, b.tOut);
  logCost(8, 1, b.provider, b.model, b.tIn, b.tOut, cost);
  result.cost = cost; result.winner = `${b.provider}:${b.model}`;

  const beforePH = countPlaceholders(b.html);
  blog.push(`Model: ${b.provider}:${b.model}`, `Before PII: ${beforePH} placeholders`);

  let html = injectPII(b.html);
  const afterPH = countPlaceholders(html);
  blog.push(`After PII: ${afterPH} placeholders`);

  const hallucinations = [];
  if (/Acme|ACME/g.test(html)) hallucinations.push("Acme");
  if (/123 Main St/i.test(html)) hallucinations.push("123 Main St");
  if (/example\.com/i.test(html) && !html.includes("w3.org")) hallucinations.push("example.com");
  if (/Anytown|Springfield/i.test(html)) hallucinations.push("fake city");
  blog.push(`Hallucinations: ${hallucinations.length ? hallucinations.join(", ") : "none"}`);

  const htmlPath = path.join(dir, "index.html");
  fs.writeFileSync(htmlPath, html);
  const s = await scoreFile(htmlPath, html);

  const passed = [], failed = [];
  afterPH === 0 ? passed.push("zero-placeholders") : failed.push(`${afterPH} placeholders remain`);
  hallucinations.length === 0 ? passed.push("no-hallucinations") : failed.push(`hallucinations: ${hallucinations.join(",")}`);
  s.lhPass ? passed.push("lighthouse") : failed.push(`LH P:${s.lh.perf} A:${s.lh.a11y}`);
  s.greyPass ? passed.push("grey") : failed.push(`grey(${s.grey.length})`);

  result.runs.push({ run: 1, score: s.avg, model: result.winner, cost, ms: b.ms, passed, failed, lh: s.lh });
  result.median = s.avg;
  result.status = failed.length === 0 ? "PASS" : "FAIL";
  result.reason = failed.length ? failed.join("; ") : "PII injected, zero placeholders, no hallucinations";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 09 — Email Suite                             ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest09() {
  const dir = path.join(TEST_BASE, "test-09-emails"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 09 — Email Suite", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 09 — Email Suite\n${"=".repeat(50)}`);
  const result = { num: 9, name: "Email Suite", folder: "test-09-emails", status: "FAIL", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  if (!apiKeys.RESEND_API_KEY) {
    result.status = "FAIL"; result.reason = "RESEND_API_KEY missing";
    blog.push(result.reason); fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n")); return result;
  }

  const templates = [
    { template: "welcome", data: { clientName: "DJ Sarge", businessName: "Level 11 Events", refCode: "L11-TEST" } },
    { template: "intake_received", data: { clientName: "DJ Sarge", businessName: "Level 11 Events", refCode: "L11-TEST" } },
    { template: "site_live", data: { clientName: "DJ Sarge", businessName: "Level 11 Events", refCode: "L11-TEST", deployUrl: "https://level11events.vercel.app", scores: "P:95 A:98 S:100 BP:96", tier: "gold" } },
  ];
  const passed = [], failed = [];

  for (const t of templates) {
    try {
      const res = await fetch(`${APP_URL}/api/email/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "planflowai@outlook.com", template: t.template, data: t.data }),
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json();
      blog.push(`${t.template}: ${res.status} — ${json.sent ? "SENT" : json.message || "not sent"}`);
      json.sent ? passed.push(t.template) : failed.push(`${t.template}: not sent`);
    } catch (e) { failed.push(`${t.template}: ${e.message.slice(0,60)}`); blog.push(`${t.template}: ERROR`); }
  }

  result.runs.push({ run: 1, score: (passed.length / templates.length) * 100, model: "api", cost: 0, ms: 0, passed, failed });
  result.median = result.runs[0].score;
  result.status = failed.length === 0 ? "PASS" : "FAIL";
  result.reason = failed.length ? failed.join("; ") : "All 3 templates sent to planflowai@outlook.com";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 10 — Chatbot                                ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest10() {
  const dir = path.join(TEST_BASE, "test-10-chatbot"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 10 — Chatbot", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 10 — Chatbot\n${"=".repeat(50)}`);
  const result = { num: 10, name: "Chatbot", folder: "test-10-chatbot", status: "NEEDS BUILD", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  blog.push("Checking for chatbot in build pipeline...");
  blog.push("The builder pipeline (build-multipage) does not generate chatbot widgets.");
  blog.push("Static FAQ, live AI chatbot, and provider switching are not in the page builder.");
  result.reason = "Chatbot widget not in builder pipeline. Need: static FAQ widget, live AI API call, provider switching (2+ providers).";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 11 — Voice                                   ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest11() {
  const dir = path.join(TEST_BASE, "test-11-voice"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 11 — Voice", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 11 — Voice\n${"=".repeat(50)}`);
  const result = { num: 11, name: "Voice", folder: "test-11-voice", status: "NEEDS BUILD", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  const voicePath = "L:/AI_PHONE_APP/ai_workbench";
  blog.push(`Voice workbench: ${fs.existsSync(voicePath) ? "EXISTS" : "NOT FOUND"}`);

  try {
    const res = await fetch(`${APP_URL}/api/voice-key?provider=openai`, { signal: AbortSignal.timeout(5000) });
    blog.push(`/api/voice-key: ${res.status}`);
  } catch (e) { blog.push(`/api/voice-key: ${e.message.slice(0,60)}`); }

  blog.push("Voice exists in @sarge/chat (useVoiceChat) but not portable to builder pipeline.");
  result.reason = "Voice in chat module, not builder pipeline. Need: TTS output, STT input, 3+ male/female voices as embeddable widget.";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 12 — Generative Media                       ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest12() {
  const dir = path.join(TEST_BASE, "test-12-generative-media"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 12 — Generative Media", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 12 — Generative Media\n${"=".repeat(50)}`);
  const result = { num: 12, name: "Generative Media", folder: "test-12-generative-media", status: "NEEDS BUILD", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  if (!apiKeys.XAI_API_KEY) {
    result.reason = "XAI_API_KEY missing"; blog.push(result.reason);
    fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n")); return result;
  }

  // Image generation
  blog.push("Attempting grok-imagine-image...");
  try {
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({ model: "grok-imagine-image", prompt: "Professional event DJ performing at wedding, golden lighting", n: 1 }),
      signal: AbortSignal.timeout(30000),
    });
    const json = await res.json();
    blog.push(`Image: ${res.status} — ${json.data ? `SUCCESS (${json.data[0]?.url?.slice(0,60)}...)` : json.error?.message || "error"}`);
  } catch (e) { blog.push(`Image error: ${e.message.slice(0,80)}`); }

  // Video generation
  blog.push("\nAttempting grok-imagine-video...");
  try {
    const res = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({ model: "grok-imagine-video", prompt: "DJ mixing at premium event with golden stage lighting", n: 1 }),
      signal: AbortSignal.timeout(60000),
    });
    const json = await res.json();
    blog.push(`Video: ${res.status} — ${json.data ? "SUCCESS" : json.error?.message || "error"}`);
  } catch (e) { blog.push(`Video error: ${e.message.slice(0,80)}`); }

  result.reason = "API calls attempted. Pipeline integration (auto-embed in built pages) not implemented. Need: generation during page build, branded assets in output HTML.";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 15 — Multi-Page                              ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest15() {
  const dir = path.join(TEST_BASE, "test-15-multipage"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 15 — Multi-Page Site", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 15 — Multi-Page\n${"=".repeat(50)}`);
  const result = { num: 15, name: "Multi-Page", folder: "test-15-multipage", status: "FAIL", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  const navHtml = `<a href="index.html">Home</a> | <a href="services.html">Services</a> | <a href="contact.html">Contact</a>`;
  const pages = [
    { file: "index.html", name: "Home", prompt: `Build HOME page. Nav: ${navHtml}. Hero, 3 feature cards, footer with {{phone}}, {{email}}. Dark mode. Under 2160px.` },
    { file: "services.html", name: "Services", prompt: `Build SERVICES page. Nav: ${navHtml}. List 4 services. Same header/footer style as Home. Dark mode. Under 2160px.` },
    { file: "contact.html", name: "Contact", prompt: `Build CONTACT page. Nav: ${navHtml}. Contact form + info. Same header/footer. Footer: {{phone}}, {{email}}. Dark mode. Under 2160px.` },
  ];

  const passed = [], failed = [];
  let totalCost = 0;

  for (const pg of pages) {
    blog.push(`\n── Building ${pg.name} ──`);
    const b = await buildPage(SYS, pg.prompt, "hard");
    if (!b.ok) { failed.push(`${pg.name}: build failed`); blog.push(`FAILED: ${b.error}`); continue; }
    const html = injectPII(b.html);
    fs.writeFileSync(path.join(dir, pg.file), html);
    const cost = calcCost(b.provider, b.model, b.tIn, b.tOut);
    logCost(15, 1, b.provider, b.model, b.tIn, b.tOut, cost);
    totalCost += cost;
    result.winner = `${b.provider}:${b.model}`;
    blog.push(`Model: ${b.provider}:${b.model} | Size: ${html.length}b | Cost: $${cost.toFixed(6)}`);
    passed.push(`${pg.name} built`);
  }

  // Nav link check
  const allHtml = pages.map(p => { try { return fs.readFileSync(path.join(dir, p.file), "utf-8"); } catch { return ""; } });
  const navLinks = pages.map(p => p.file);
  for (const h of allHtml) {
    for (const link of navLinks) { if (h.includes(link)) passed.push(`link→${link}`); }
  }

  // Headers/footers
  const hasHeaders = allHtml.every(h => /<header[\s>]/i.test(h));
  const hasFooters = allHtml.every(h => /<footer[\s>]/i.test(h));
  hasHeaders ? passed.push("consistent headers") : failed.push("missing headers");
  hasFooters ? passed.push("consistent footers") : failed.push("missing footers");

  // Lighthouse on index
  const indexPath = path.join(dir, "index.html");
  if (fs.existsSync(indexPath)) {
    const s = await scoreFile(indexPath, allHtml[0] || "");
    s.lhPass ? passed.push("lighthouse") : failed.push(`LH P:${s.lh.perf} A:${s.lh.a11y} S:${s.lh.seo} BP:${s.lh.bp}`);
    result.runs.push({ run: 1, score: s.avg, model: result.winner, cost: totalCost, ms: 0, passed, failed, lh: s.lh });
    result.median = s.avg;
  }

  result.cost = totalCost;
  result.status = failed.length === 0 ? "PASS" : "FAIL";
  result.reason = failed.length ? failed.join("; ") : "3 pages, nav works, consistent headers/footers";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 18 — Visual Review                           ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest18() {
  const dir = path.join(TEST_BASE, "test-18-visual-review"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 18 — Visual Review", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 18 — Visual Review\n${"=".repeat(50)}`);
  const result = { num: 18, name: "Visual Review", folder: "test-18-visual-review", status: "FAIL", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  const b = await buildPage(SYS, PROMPTS.t01, "easy");
  if (!b.ok) { result.reason = `Build failed: ${b.error}`; blog.push(result.reason); fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n")); return result; }

  let html = injectPII(b.html);
  const htmlPath = path.join(dir, "index.html");
  fs.writeFileSync(htmlPath, html);
  const cost = calcCost(b.provider, b.model, b.tIn, b.tOut);
  logCost(18, 1, b.provider, b.model, b.tIn, b.tOut, cost);
  result.cost = cost; result.winner = `${b.provider}:${b.model}`;

  blog.push("Taking screenshots...");
  const ssOk = await takeScreenshots(htmlPath, dir);
  blog.push(`Screenshots: ${ssOk ? "OK" : "FAILED"}`);

  blog.push("\nRunning text-based visual review...");
  const reviewPrompt = `Review this HTML for visual issues:\n1. Grey/dim text\n2. Layout problems\n3. Missing responsive styles\n4. Accessibility issues\nList issues or say "No issues".\n\nHTML:\n${html.slice(0, 6000)}`;
  const review = await buildPage("You are a web design reviewer. List issues only, be concise.", reviewPrompt, "easy");
  if (review.ok) {
    blog.push(`Reviewer: ${review.provider}:${review.model}`);
    blog.push(`Findings:\n${review.html.slice(0, 1500)}`);
    const rc = calcCost(review.provider, review.model, review.tIn, review.tOut);
    logCost(18, 1, review.provider, review.model, review.tIn, review.tOut, rc);
    result.cost += rc;
  } else { blog.push("Review failed — no models available"); }

  const s = await scoreFile(htmlPath, html);
  const passed = [], failed = [];
  ssOk ? passed.push("screenshots") : failed.push("screenshots failed");
  review.ok ? passed.push("visual-review") : failed.push("review failed");
  s.lhPass ? passed.push("lighthouse") : failed.push(`LH P:${s.lh.perf} A:${s.lh.a11y}`);

  result.runs.push({ run: 1, score: s.avg, model: result.winner, cost: result.cost, ms: b.ms, passed, failed, lh: s.lh });
  result.median = s.avg;
  result.status = failed.length === 0 ? "PASS" : "FAIL";
  result.reason = failed.length ? failed.join("; ") : "Screenshots taken, visual review done";
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 19 — Billing                                ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest19() {
  const dir = path.join(TEST_BASE, "test-19-billing"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 19 — Billing Accuracy", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 19 — Billing\n${"=".repeat(50)}`);
  const result = { num: 19, name: "Billing", folder: "test-19-billing", status: "FAIL", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  if (!fs.existsSync(COST_LOG)) {
    result.reason = "No COST_LOG.jsonl — no API calls logged";
    blog.push(result.reason); fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n")); return result;
  }

  const entries = fs.readFileSync(COST_LOG, "utf-8").split("\n").filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  blog.push(`Total entries: ${entries.length}`);

  const byProvider = {};
  let totalCost = 0;
  for (const e of entries) {
    if (!byProvider[e.provider]) byProvider[e.provider] = { calls: 0, cost: 0, tIn: 0, tOut: 0 };
    byProvider[e.provider].calls++;
    byProvider[e.provider].cost += e.cost || 0;
    byProvider[e.provider].tIn += e.tokensIn || 0;
    byProvider[e.provider].tOut += e.tokensOut || 0;
    totalCost += e.cost || 0;
  }

  blog.push("\nBy provider:");
  for (const [p, d] of Object.entries(byProvider)) blog.push(`  ${p}: ${d.calls} calls, $${d.cost.toFixed(6)}, ${d.tIn}/${d.tOut} tokens`);
  blog.push(`\nTotal: $${totalCost.toFixed(6)}`);
  blog.push(`Gemini today: ${entries.filter(e => e.provider === "google").length}`);

  try {
    const res = await fetch(`${APP_URL}/api/billing/stats`, { signal: AbortSignal.timeout(5000) });
    blog.push(`/api/billing/stats: ${res.status}`);
  } catch (e) { blog.push(`/api/billing/stats: ${e.message.slice(0,60)}`); }

  const passed = [], failed = [];
  entries.length > 0 ? passed.push(`${entries.length} calls logged`) : failed.push("no calls logged");
  passed.push(`$${totalCost.toFixed(4)} tracked`);

  result.runs.push({ run: 1, score: entries.length > 0 ? 100 : 0, model: "audit", cost: 0, ms: 0, passed, failed });
  result.median = result.runs[0].score;
  result.status = entries.length > 0 ? "PASS" : "FAIL";
  result.reason = `${entries.length} calls logged, $${totalCost.toFixed(4)} total`;
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIPELINE TEST: 20 — Full Site Build                         ║
// ╚══════════════════════════════════════════════════════════════╝

async function runTest20() {
  const dir = path.join(TEST_BASE, "test-20-full-site"); fs.mkdirSync(dir, { recursive: true });
  const blog = ["TEST 20 — Full Site Build (Level 11 Events)", `Started: ${new Date().toISOString()}`, ""];
  console.log(`\n${"=".repeat(50)}\nTEST 20 — Full Site Build\n${"=".repeat(50)}`);
  const result = { num: 20, name: "Full Site Build", folder: "test-20-full-site", status: "FAIL", reason: "", runs: [], median: 0, cost: 0, winner: "" };

  if (!portAlive) { result.reason = "Port 3101 dead"; blog.push(result.reason); fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n")); return result; }

  let intakeData;
  try { intakeData = JSON.parse(fs.readFileSync(L11_DATA, "utf-8")); } catch (e) {
    result.reason = `Cannot read intake data: ${e.message}`; blog.push(result.reason); fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n")); return result;
  }

  // Submit intake
  blog.push("Submitting intake...");
  try {
    const r = await fetch(`${APP_URL}/api/intake/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intakeData), signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    blog.push(`Submit: ${r.status} — ${j.ref_code || j.message || "ok"}`);
  } catch (e) { blog.push(`Submit error: ${e.message.slice(0,80)}`); }

  // Run pipeline
  blog.push("\nStarting build-multipage...");
  const passed = [], failed = [];
  let pagesBuilt = 0, totalPages = 0, deployUrl = "";

  try {
    const res = await fetch(`${APP_URL}/api/intake/build-multipage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref_code: intakeData.ref_code }),
      signal: AbortSignal.timeout(600000),
    });
    if (!res.ok) throw new Error(`Pipeline ${res.status}`);
    if (!res.body) throw new Error("No body");

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split("\n")) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.event === "progress") blog.push(`  [${evt.phase}] ${evt.message}`);
          if (evt.event === "page_complete") { blog.push(`  PAGE: ${evt.filename} (${evt.size || "?"}b)`); pagesBuilt++; }
          if (evt.event === "guardian") blog.push(`  GUARDIAN: ${evt.page} — ${evt.pass ? "PASS" : "FAIL"}`);
          if (evt.event === "done") { totalPages = evt.totalPages || 0; deployUrl = evt.deployUrl || ""; }
          if (evt.event === "error") failed.push(evt.message);
        } catch {}
      }
    }

    if (pagesBuilt > 0) passed.push(`${pagesBuilt} pages`);
    if (pagesBuilt === totalPages && totalPages > 0) passed.push("all complete");
    else if (totalPages > 0) failed.push(`${totalPages - pagesBuilt} pages failed`);
    if (deployUrl) passed.push(`deployed: ${deployUrl}`); else failed.push("no deploy");
  } catch (e) {
    failed.push(`Pipeline: ${e.message.slice(0,100)}`);
    blog.push(`Pipeline error: ${e.message}`);
  }

  result.runs.push({ run: 1, score: (passed.length / Math.max(passed.length + failed.length, 1)) * 100, model: "pipeline", cost: 0, ms: 0, passed, failed });
  result.median = result.runs[0]?.score || 0;
  result.status = failed.length === 0 && pagesBuilt > 0 ? "PASS" : "FAIL";
  result.reason = failed.length ? failed.join("; ") : `${pagesBuilt} pages built, deployed to ${deployUrl}`;
  blog.push(`\nSTATUS: ${result.status}`, `REASON: ${result.reason}`);
  fs.writeFileSync(path.join(dir, "BUILD_LOG.txt"), blog.join("\n"));
  return result;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  REPORT GENERATION                                           ║
// ╚══════════════════════════════════════════════════════════════╝

function writeReport(results, totalMs) {
  const r = ["# S.A.R.G.E. BUILDER — FINAL TEST REPORT", `Generated: ${new Date().toISOString()}`, ""];
  r.push("## Results", "", "| # | Test | Status | Median | Model | Cost |", "|---|------|--------|--------|-------|------|");
  for (const t of results) {
    const em = t.status === "PASS" ? "✅" : t.status === "NEEDS BUILD" ? "🔧" : "❌";
    r.push(`| ${String(t.num).padStart(2,"0")} | ${t.name} | ${em} ${t.status} | ${t.median.toFixed(0)} | ${t.winner || "—"} | $${t.cost.toFixed(4)} |`);
  }

  const totalCost = results.reduce((s, t) => s + t.cost, 0);
  const pc = results.filter(t => t.status === "PASS").length;
  const fc = results.filter(t => t.status === "FAIL").length;
  const nb = results.filter(t => t.status === "NEEDS BUILD").length;
  r.push("", `**${pc} PASS / ${fc} FAIL / ${nb} NEEDS BUILD**`);
  r.push(`**Total cost: $${totalCost.toFixed(4)}**`);
  r.push(`**Total time: ${(totalMs / 1000 / 60).toFixed(1)} minutes**`);

  const needsBuild = results.filter(t => t.status === "NEEDS BUILD");
  if (needsBuild.length) { r.push("", "## NEEDS BUILD", ""); for (const t of needsBuild) r.push(`- **Test ${String(t.num).padStart(2,"0")} — ${t.name}**: ${t.reason}`); }

  const needsFix = results.filter(t => t.status === "FAIL");
  if (needsFix.length) { r.push("", "## NEEDS FIX", ""); for (const t of needsFix) r.push(`- **Test ${String(t.num).padStart(2,"0")} — ${t.name}**: ${t.reason}`); }

  r.push("", "## Per-Test Details", "");
  for (const t of results) {
    r.push(`### Test ${String(t.num).padStart(2,"0")} — ${t.name}`);
    r.push(`Status: ${t.status} | Median: ${t.median.toFixed(0)} | Cost: $${t.cost.toFixed(4)} | Model: ${t.winner || "—"}`);
    r.push(`Reason: ${t.reason}`);
    for (const run of t.runs) {
      r.push(`  Run ${run.run}: score=${run.score.toFixed(0)} model=${run.model} cost=$${run.cost.toFixed(4)}`);
      if (run.passed?.length) r.push(`    ✓ ${run.passed.join(", ")}`);
      if (run.failed?.length) r.push(`    ✗ ${run.failed.join(", ")}`);
    }
    r.push("");
  }

  fs.writeFileSync(FINAL_REPORT, r.join("\n"));
  console.log(`\nReport: ${FINAL_REPORT}`);
}

function updateMaster(results) {
  if (!fs.existsSync(MASTER_MD)) return;
  let md = fs.readFileSync(MASTER_MD, "utf-8");
  for (const t of results) {
    const num = String(t.num).padStart(2, "0");
    const emoji = t.status === "PASS" ? "✅ PASS" : t.status === "NEEDS BUILD" ? "🔧 NEEDS BUILD" : "❌ FAIL";
    const score = t.median > 0 ? t.median.toFixed(0) : "—";
    const rx = new RegExp(`\\| ${num} \\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|`);
    md = md.replace(rx, (_, name, folder, _s, _sc, notes) => `| ${num} |${name}|${folder}| ${emoji} | ${score} |${notes}|`);
  }
  fs.writeFileSync(MASTER_MD, md);
  console.log(`Master doc updated: ${MASTER_MD}`);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  MAIN                                                        ║
// ╚══════════════════════════════════════════════════════════════╝

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  S.A.R.G.E. Test Automation Runner v1.0         ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  suiteStartTime = Date.now();
  const ready = await preflight();
  if (!ready) console.log("⚠ No models available — tests will attempt and log failures.\n");

  // Run all 20 tests
  allResults.push(await runPageTest(1, "Basic Page", "test-01-basic", PROMPTS.t01, "easy", testChecks.t01));
  allResults.push(await runPageTest(2, "Cards + Accordion/Tabs", "test-02-cards-tabs", PROMPTS.t02, "easy", testChecks.t02));
  allResults.push(await runPageTest(3, "Stock Images + Video", "test-03-media", PROMPTS.t03, "medium", testChecks.t03));
  allResults.push(await runTest04());
  allResults.push(await runPageTest(5, "Forms + Newsletter", "test-05-forms", PROMPTS.t05, "easy", testChecks.t05));
  allResults.push(await runPageTest(6, "Conversion Elements", "test-06-conversion", PROMPTS.t06, "medium", testChecks.t06));
  allResults.push(await runPageTest(7, "Gallery + Maps + Social", "test-07-display", PROMPTS.t07, "medium", testChecks.t07));
  allResults.push(await runTest08());
  allResults.push(await runTest09());
  allResults.push(await runTest10());
  allResults.push(await runTest11());
  allResults.push(await runTest12());
  allResults.push(await runPageTest(13, "Compliance + A11y", "test-13-compliance", PROMPTS.t13, "medium", testChecks.t13));
  allResults.push(await runPageTest(14, "Dark/Light Toggle", "test-14-darklight", PROMPTS.t14, "easy", testChecks.t14));
  allResults.push(await runTest15());
  allResults.push(await runPageTest(16, "Blog Layout", "test-16-blog", PROMPTS.t16, "medium", testChecks.t16));
  allResults.push(await runPageTest(17, "Multi-Language", "test-17-multilang", PROMPTS.t17, "hard", testChecks.t17));
  allResults.push(await runTest18());
  allResults.push(await runTest19());
  allResults.push(await runTest20());

  const totalMs = Date.now() - suiteStartTime;
  writeReport(allResults, totalMs);
  updateMaster(allResults);

  const pc = allResults.filter(t => t.status === "PASS").length;
  const fc = allResults.filter(t => t.status === "FAIL").length;
  const nb = allResults.filter(t => t.status === "NEEDS BUILD").length;
  const cost = allResults.reduce((s, t) => s + t.cost, 0);
  console.log(`\n${"═".repeat(50)}`);
  console.log(`FINAL: ${pc} PASS / ${fc} FAIL / ${nb} NEEDS BUILD`);
  console.log(`COST: $${cost.toFixed(4)} | TIME: ${(totalMs / 1000 / 60).toFixed(1)} min`);
  console.log(`${"═".repeat(50)}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
