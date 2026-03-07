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

/**
 * Quick guardian check — validates built HTML has required elements.
 */
export function guardianCheck(
  html: string,
  pageName: string,
): { pass: boolean; issues: string[] } {
  const issues: string[] = [];

  // Must have basic HTML structure
  if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
    issues.push("Missing HTML doctype/structure");
  }

  // Must have PII placeholders (not real data)
  if (!html.includes("{{BUSINESS_NAME}}") && !html.includes("{{phone}}") && !html.includes("{{email}}")) {
    issues.push("No PII placeholders found — may contain hardcoded data");
  }

  // Must have responsive viewport
  if (!html.includes("viewport")) {
    issues.push("Missing viewport meta tag");
  }

  // Minimum content length
  if (html.length < 500) {
    issues.push(`Page too short (${html.length} chars)`);
  }

  return { pass: issues.length === 0, issues };
}
