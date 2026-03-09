/**
 * Multi-Page Builder Orchestrator
 *
 * Builds a client website page-by-page from intake data.
 * Each page gets its own prompt, model selection, and save-to-disk step.
 * Progress is reported via callback so the UI can show live updates.
 */

import { PAGE_DIFFICULTY } from "./intakeToPrompt";

export interface PageManifestEntry {
  name: string;
  key: string;
  difficulty: "easy" | "medium" | "hard";
  filename: string;
}

export interface BuildPageResult {
  page: string;
  filename: string;
  difficulty: "easy" | "medium" | "hard";
  model: string;
  provider: string;
  html: string;
  tokens: { input: number; output: number };
  durationMs: number;
  status: "complete" | "failed" | "retried";
  error?: string;
}

export interface BuildProgress {
  phase: "styles" | "nav" | "page" | "complete";
  current: string;
  index: number;
  total: number;
  result?: BuildPageResult;
}

/** Minimum page size (bytes) to count as a successful build */
export const MIN_PAGE_SIZE = 5120; // 5KB

/** Default model fallbacks when no trial data is available */
export const DEFAULT_MODELS: Record<string, { provider: string; model: string }> = {
  easy: { provider: "google", model: "gemini-2.5-flash" },
  medium: { provider: "google", model: "gemini-2.5-flash" },
  hard: { provider: "openai", model: "gpt-4.1" },
};

/**
 * Pick a model for a given difficulty tier.
 * Checks Forge Trial scores first, falls back to defaults.
 */
export function pickModelForDifficulty(
  difficulty: "easy" | "medium" | "hard",
  trialScores?: Record<string, number>,
  availableModels?: Array<{ id: string; provider: string; score?: number; cost?: number }>,
): { provider: string; model: string; reason: string } {
  if (!availableModels || availableModels.length === 0 || !trialScores) {
    const fallback = DEFAULT_MODELS[difficulty];
    return { ...fallback, reason: `Default for ${difficulty} (no trial data)` };
  }

  const minScore = difficulty === "easy" ? 70 : difficulty === "medium" ? 80 : 90;

  // Filter models that meet minimum score threshold
  const qualified = availableModels
    .filter((m) => (trialScores[m.id] ?? 0) >= minScore)
    .sort((a, b) => {
      if (difficulty === "easy") {
        // Cheapest that qualifies
        return (a.cost ?? 999) - (b.cost ?? 999);
      }
      // Best score for medium/hard
      return (trialScores[b.id] ?? 0) - (trialScores[a.id] ?? 0);
    });

  if (qualified.length > 0) {
    const pick = qualified[0];
    return {
      provider: pick.provider,
      model: pick.id,
      reason: `Score ${trialScores[pick.id]}${difficulty === "easy" ? ", cheapest" : ", highest"} for ${difficulty}`,
    };
  }

  const fallback = DEFAULT_MODELS[difficulty];
  return { ...fallback, reason: `Fallback for ${difficulty} (no models scored ${minScore}+)` };
}

/**
 * Generate shared CSS from intake design choices.
 */
export function generateSharedCss(flat: any): string {
  const primary = flat.color_primary || flat.colors?.primary || "#14b8a6";
  const secondary = flat.color_secondary || flat.colors?.secondary || "#8b5cf6";
  const accent = flat.color_accent || flat.colors?.accent || "#ec4899";
  const theme = (flat.theme || "dark").toLowerCase();
  const isDark = theme === "dark";

  return `:root {
  --primary: ${primary};
  --secondary: ${secondary};
  --accent: ${accent};
  --bg: ${isDark ? "#060b18" : "#f8fafc"};
  --card: ${isDark ? "#111827" : "#ffffff"};
  --text: ${isDark ? "#f0f2f5" : "#1a1a2e"};
  --text-muted: ${isDark ? "#94a3b8" : "#64748b"};
  --border: ${isDark ? "#1e293b" : "#e2e8f0"};
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  font-size: 16px;
}
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; height: auto; }`;
}

/**
 * Generate the shared navigation snippet from the page list.
 */
export function generateNavSnippet(pages: string[], businessName?: string): string {
  const links = pages
    .map((p) => {
      const key = p.toLowerCase().replace(/\s+/g, "-");
      const href = key === "home" ? "index.html" : `${key}.html`;
      return `    <a href="${href}" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">${p.charAt(0).toUpperCase() + p.slice(1)}</a>`;
    })
    .join("\n");

  return `<nav style="display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;background:var(--card);border-bottom:1px solid var(--border)">
  <a href="index.html" style="font-size:1.25rem;font-weight:800;color:var(--text);text-decoration:none">${businessName || "{{BUSINESS_NAME}}"}</a>
  <div style="display:flex;gap:1.5rem;align-items:center">
${links}
  </div>
</nav>`;
}

/**
 * Generate BUILD_LOG.md entry for a completed page.
 */
export function buildLogEntry(result: BuildPageResult): string {
  return `## ${result.filename}${result.page !== result.filename ? ` (${result.page})` : ""}
Model: ${result.model} | Provider: ${result.provider}
Tokens: ${result.tokens.input}/${result.tokens.output} | Time: ${(result.durationMs / 1000).toFixed(1)}s
Difficulty: ${result.difficulty} | Status: ${result.status.toUpperCase()}${result.error ? `\nError: ${result.error}` : ""}
`;
}

/**
 * Generate the full BUILD_LOG.md content.
 */
export function generateBuildLog(
  projectName: string,
  refCode: string,
  results: BuildPageResult[],
): string {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const lines = [
    `# Build Log — ${projectName}`,
    `Ref: ${refCode} | Built: ${now}`,
    "",
    `## Summary`,
    `Pages: ${results.length} | Status: ${results.every((r) => r.status === "complete") ? "ALL COMPLETE" : "PARTIAL"}`,
    "",
  ];

  for (const r of results) {
    lines.push(buildLogEntry(r));
  }

  return lines.join("\n");
}

// ── Guardian — hallucination detection + structural validation ──────

/** A single guardian finding */
export interface GuardianFinding {
  type: "HALLUCINATION" | "STRUCTURE" | "NAV" | "CONTRAST";
  message: string;
  action: "auto-replaced" | "flagged";
}

/** Full guardian result with cleaned HTML */
export interface GuardianResult {
  pass: boolean;
  issues: string[];
  findings: GuardianFinding[];
  html: string;
  navOk: boolean;
}

/** Fake phone patterns — 555-*, 800-555-*, 123-456-* */
const KNOWN_FAKE_PHONE = [
  /\+?1?\s*[-.]?\s*\(?555\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4}/g,
  /\(?555\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4}/g,
  /123[-.]456[-.]7890/g,
  /800[-.]555[-.]0\d{3}/g,
];

/** Broader phone pattern — any (XXX) XXX-XXXX or XXX-XXX-XXXX not in a placeholder */
const ANY_PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;

/** Fake email domains models commonly hallucinate */
const FAKE_EMAIL_RE = /[\w.-]+@(?:example\.com|acmecorp\.com|websolutionspro\.com|webdevsolutions\.com|innovateweb\.com|techstart\.com|planflow\.ai|company\.com|business\.com|mycompany\.com|test\.com)\b/gi;

/** Any email not in a placeholder — used for broad scan */
const ANY_EMAIL_RE = /[\w.-]+@[\w.-]+\.\w{2,}/g;

/** Fake business names models commonly hallucinate */
const HALLUCINATED_NAMES = [
  "InnovateWeb Solutions",
  "Acme Corp",
  "Acme Corporation",
  "WebSolutions Pro",
  "WebDev Solutions",
  "TechStart Inc",
  "Digital Solutions",
  "Web Agency Pro",
  "Creative Web Studio",
  "TechVision",
  "NexGen Solutions",
  "BrightPath",
  "PixelPerfect",
];

/** Street address patterns models hallucinate */
const FAKE_ADDRESS_PATTERNS = [
  /\b123\s+\w+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Lane|Ln|Rd|Road|Way|Circle|Ct|Court)\b/gi,
  /\b456\s+\w+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Lane|Ln|Rd|Road|Way|Circle|Ct|Court)\b/gi,
  /\bMain\s+(?:St|Street)\b/gi,
  /\bAnytown\b/gi,
  /\bSpringfield\b/gi,
  /\bInnovation\s+(?:City|Drive|Way|Ave)\b/gi,
  /\bFuture\s+City\b/gi,
  /\bInnovate\s+City\b/gi,
  /\bTech\s+(?:City|Park|Plaza|Hub)\b/gi,
];

/** Emails that are always allowed (not hallucinations) */
const ALLOWED_EMAIL_DOMAINS = [
  "planflowai.com",
  "gmail.com",
  "schema.org",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "w3.org",
  "ogp.me",
  "purl.org",
];

/**
 * Enhanced guardian check — structural validation + hallucination detection.
 *
 * Scans built HTML for fake phones, emails, addresses, and wrong business names.
 * Auto-replaces hallucinated data with {{placeholder}} tokens.
 * Returns cleaned HTML, structured findings, and pass/fail status.
 */
export function guardianCheck(
  html: string,
  pageName: string,
  businessName?: string,
  pageNames?: string[],
): GuardianResult {
  const issues: string[] = [];
  const findings: GuardianFinding[] = [];
  let cleaned = html;

  // ── STRUCTURAL CHECKS ─────────────────────────────────────────────

  if (!cleaned.includes("<html") && !cleaned.includes("<!DOCTYPE")) {
    issues.push("Missing HTML doctype/structure");
    findings.push({ type: "STRUCTURE", message: "Missing HTML doctype/structure", action: "flagged" });
  }

  if (!cleaned.includes("viewport")) {
    issues.push("Missing viewport meta tag");
    findings.push({ type: "STRUCTURE", message: "Missing viewport meta tag", action: "flagged" });
  }

  if (cleaned.length < 500) {
    issues.push(`Page too short (${cleaned.length} chars)`);
    findings.push({ type: "STRUCTURE", message: `Page too short (${cleaned.length} chars)`, action: "flagged" });
  }

  // ── HALLUCINATION: BUSINESS NAMES ─────────────────────────────────

  for (const fake of HALLUCINATED_NAMES) {
    if (cleaned.includes(fake)) {
      const count = cleaned.split(fake).length - 1;
      cleaned = cleaned.split(fake).join("{{BUSINESS_NAME}}");
      const expected = businessName || "{{BUSINESS_NAME}}";
      findings.push({
        type: "HALLUCINATION",
        message: `Found fake business name "${fake}" × ${count} (expected "${expected}" or {{BUSINESS_NAME}})`,
        action: "auto-replaced",
      });
    }
  }

  // If we know the real business name, check for any OTHER business name in <title>, <h1>, nav logo
  if (businessName) {
    const titleMatch = cleaned.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1];
      if (!title.includes(businessName) && !title.includes("{{BUSINESS_NAME}}")) {
        findings.push({
          type: "HALLUCINATION",
          message: `<title> contains "${title}" — does not mention "${businessName}"`,
          action: "flagged",
        });
      }
    }
  }

  // ── HALLUCINATION: PHONE NUMBERS ──────────────────────────────────

  // First pass — known fake patterns (auto-replace)
  for (const pattern of KNOWN_FAKE_PHONE) {
    pattern.lastIndex = 0;
    let match;
    const seen: string[] = [];
    while ((match = pattern.exec(cleaned)) !== null) {
      const raw = match[0];
      if (raw.includes("{{") || seen.includes(raw)) continue;
      seen.push(raw);
    }
    for (const raw of seen) {
      cleaned = cleaned.split(`tel:${raw}`).join("tel:{{phone_tel}}");
      cleaned = cleaned.split(`tel:+${raw}`).join("tel:{{phone_tel}}");
      cleaned = cleaned.split(raw).join("{{phone}}");
      findings.push({
        type: "HALLUCINATION",
        message: `Found fake phone "${raw}" (expected {{phone}})`,
        action: "auto-replaced",
      });
    }
  }

  // Second pass — any remaining phone-like patterns — auto-replace with {{phone}}
  ANY_PHONE_RE.lastIndex = 0;
  let phoneMatch;
  const phonesSeen = new Set<string>();
  while ((phoneMatch = ANY_PHONE_RE.exec(cleaned)) !== null) {
    const raw = phoneMatch[0];
    // Skip if inside a placeholder, tel: href already handled, or HTML entity
    if (raw.includes("{{") || raw.includes("phone_tel") || phonesSeen.has(raw)) continue;
    // Skip if it's inside a CSS value, year range, or dimension
    const before = cleaned.substring(Math.max(0, phoneMatch.index - 30), phoneMatch.index);
    if (before.includes("width:") || before.includes("height:") || before.includes("font-size") ||
        before.includes("rgba(") || before.includes("hsl(") || before.includes("#")) continue;
    phonesSeen.add(raw);
    cleaned = cleaned.split(`tel:${raw}`).join("tel:{{phone_tel}}");
    cleaned = cleaned.split(`tel:+${raw}`).join("tel:{{phone_tel}}");
    cleaned = cleaned.split(raw).join("{{phone}}");
    findings.push({
      type: "HALLUCINATION",
      message: `HALLUCINATION FIXED: replaced phone "${raw}" with {{phone}}`,
      action: "auto-replaced",
    });
    // Reset regex index since we modified the string
    ANY_PHONE_RE.lastIndex = 0;
  }

  // ── HALLUCINATION: EMAIL ADDRESSES ────────────────────────────────

  // Known fake email domains — auto-replace
  FAKE_EMAIL_RE.lastIndex = 0;
  const fakeEmails = cleaned.match(FAKE_EMAIL_RE);
  if (fakeEmails) {
    const unique = fakeEmails.filter((e, i) => fakeEmails.indexOf(e) === i);
    for (const email of unique) {
      cleaned = cleaned.split(`mailto:${email}`).join("mailto:{{email}}");
      cleaned = cleaned.split(email).join("{{email}}");
      findings.push({
        type: "HALLUCINATION",
        message: `Found fake email "${email}" (expected {{email}})`,
        action: "auto-replaced",
      });
    }
  }

  // Broader email scan — auto-replace unknown emails with {{email}}
  ANY_EMAIL_RE.lastIndex = 0;
  let emailMatch;
  const emailsSeen = new Set<string>();
  while ((emailMatch = ANY_EMAIL_RE.exec(cleaned)) !== null) {
    const raw = emailMatch[0];
    if (raw.includes("{{") || emailsSeen.has(raw)) continue;
    const domain = raw.split("@")[1]?.toLowerCase() || "";
    // Skip allowed domains
    if (ALLOWED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) continue;
    // Skip if it's a known real client email (from businessName slug)
    if (businessName && raw.toLowerCase().includes(businessName.toLowerCase().replace(/\s+/g, ""))) continue;
    emailsSeen.add(raw);
    cleaned = cleaned.split(`mailto:${raw}`).join("mailto:{{email}}");
    cleaned = cleaned.split(raw).join("{{email}}");
    findings.push({
      type: "HALLUCINATION",
      message: `HALLUCINATION FIXED: replaced email "${raw}" with {{email}}`,
      action: "auto-replaced",
    });
    ANY_EMAIL_RE.lastIndex = 0;
  }

  // ── HALLUCINATION: STREET ADDRESSES ───────────────────────────────

  for (const pattern of FAKE_ADDRESS_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    const addrSeen = new Set<string>();
    while ((match = pattern.exec(cleaned)) !== null) {
      const raw = match[0];
      if (raw.includes("{{") || addrSeen.has(raw)) continue;
      // Skip if inside a CSS rule or script
      const context = cleaned.substring(Math.max(0, match.index - 50), match.index);
      if (context.includes("{") && !context.includes(">")) continue;
      addrSeen.add(raw);
      cleaned = cleaned.split(raw).join("{{address}}");
      findings.push({
        type: "HALLUCINATION",
        message: `HALLUCINATION FIXED: replaced address "${raw}" with {{address}}`,
        action: "auto-replaced",
      });
      pattern.lastIndex = 0;
    }
  }

  // ── NAV CONSISTENCY ───────────────────────────────────────────────

  let navOk = true;
  if (pageNames && pageNames.length > 0) {
    const expectedLinks = pageNames.map((p) => {
      const key = p.toLowerCase().replace(/\s+/g, "-");
      return key === "home" ? "index.html" : `${key}.html`;
    });
    const missing = expectedLinks.filter((link) => !cleaned.includes(`href="${link}"`));
    navOk = missing.length === 0;
    if (!navOk) {
      findings.push({
        type: "NAV",
        message: `Missing nav links: ${missing.join(", ")}`,
        action: "flagged",
      });
    }
  }

  // ── PII PLACEHOLDER CHECK ─────────────────────────────────────────

  if (!cleaned.includes("{{BUSINESS_NAME}}") && !cleaned.includes("{{phone}}") && !cleaned.includes("{{email}}")) {
    const autoReplaced = findings.some((f) => f.action === "auto-replaced");
    if (!autoReplaced) {
      issues.push("No PII placeholders found — may contain hardcoded data");
      findings.push({ type: "STRUCTURE", message: "No PII placeholders found — may contain hardcoded data", action: "flagged" });
    }
  }

  // ── GREY/MUTED TEXT CHECK (WARNING, not hard fail) ─────────────────
  const GREY_PATTERNS: RegExp[] = [
    /text-zinc-[4-7]00/g, /text-slate-[4-6]00/g, /text-gray-[4-6]00/g, /text-neutral-[4-6]00/g,
    /color:\s*#6b7280/gi, /color:\s*#71717a/gi, /color:\s*#52525b/gi, /color:\s*#3f3f46/gi,
    /color:\s*#94a3b8/gi, /color:\s*#64748b/gi, /color:\s*#9ca3af/gi, /color:\s*#a1a1aa/gi,
    /zinc-500/g, /zinc-600/g, /zinc-700/g, /slate-400/g, /slate-500/g,
  ];
  const greyHits: string[] = [];
  for (const rx of GREY_PATTERNS) {
    rx.lastIndex = 0;
    const m = cleaned.match(rx);
    if (m) greyHits.push(...m);
  }
  if (greyHits.length > 0) {
    findings.push({
      type: "CONTRAST",
      message: `Found ${greyHits.length} grey/muted text instances: ${greyHits.slice(0, 5).join(", ")}${greyHits.length > 5 ? "..." : ""}`,
      action: "flagged",
    });
  }

  // Pass only if no structural issues (hallucination findings don't fail — they auto-replace)
  return { pass: issues.length === 0, issues, findings, html: cleaned, navOk };
}

/**
 * Cross-page nav consistency check — compares nav links across all built pages.
 * Call AFTER all pages are saved to disk.
 */
export function checkNavConsistency(
  pageHtmlMap: Array<{ filename: string; html: string }>,
  expectedPages: string[],
): GuardianFinding[] {
  const findings: GuardianFinding[] = [];

  const expectedLinks = expectedPages.map((p) => {
    const key = p.toLowerCase().replace(/\s+/g, "-");
    return key === "home" ? "index.html" : `${key}.html`;
  });

  // Extract nav links from each page
  const navLinks: Array<{ filename: string; links: string[] }> = [];
  for (const { filename, html } of pageHtmlMap) {
    // Find all href="*.html" links inside <nav> tags
    const navMatch = html.match(/<nav[\s\S]*?<\/nav>/i);
    if (!navMatch) {
      findings.push({
        type: "NAV",
        message: `${filename}: No <nav> element found`,
        action: "flagged",
      });
      continue;
    }
    const hrefMatches = navMatch[0].match(/href="([^"]*\.html)"/g) || [];
    const hrefs = hrefMatches.map((h) => h.replace(/href="([^"]*)"/, "$1"));
    navLinks.push({ filename, links: hrefs });

    // Check for missing expected links
    const missing = expectedLinks.filter((el) => !hrefs.includes(el));
    if (missing.length > 0) {
      findings.push({
        type: "NAV",
        message: `${filename}: Missing nav links: ${missing.join(", ")}`,
        action: "flagged",
      });
    }

    // Check for path-style links (/ instead of .html)
    const pathLinks = navMatch[0].match(/href="\/[a-z][\w-]*"/g);
    if (pathLinks) {
      findings.push({
        type: "NAV",
        message: `${filename}: Uses path-style links instead of .html: ${pathLinks.join(", ")}`,
        action: "flagged",
      });
    }
  }

  // Compare link order across pages
  if (navLinks.length > 1) {
    const reference = navLinks[0];
    for (let i = 1; i < navLinks.length; i++) {
      const page = navLinks[i];
      if (page.links.join(",") !== reference.links.join(",")) {
        findings.push({
          type: "NAV",
          message: `${page.filename}: Nav link order differs from ${reference.filename}`,
          action: "flagged",
        });
      }
    }
  }

  return findings;
}

/**
 * Format guardian findings into BUILD_LOG.md section for a single page.
 */
export function formatGuardianFindings(
  filename: string,
  findings: GuardianFinding[],
): string {
  if (findings.length === 0) return "";
  const lines = [`## Guardian Findings — ${filename}`];
  for (const f of findings) {
    lines.push(`- ${f.type}: ${f.message}`);
  }
  // Summarize actions
  const autoReplaced = findings.filter((f) => f.action === "auto-replaced").length;
  const flagged = findings.filter((f) => f.action === "flagged").length;
  if (autoReplaced > 0) lines.push(`- ACTION: Auto-replaced ${autoReplaced} hallucination(s) with placeholders`);
  if (flagged > 0) lines.push(`- WARNING: ${flagged} issue(s) flagged for review`);
  lines.push("");
  return lines.join("\n");
}
