/**
 * Forge Trials — Explainer Data & Helpers
 * Display-only constants and functions for enriching the right panel.
 * Zero impact on scoring or run logic.
 */

import type { RoundResult, ScoreBreakdown, BenchmarkScenario } from "./runner";

// ── Round Explainers ────────────────────────────────────────────────

/** One-sentence description of what each round tests. */
export const ROUND_EXPLAINERS: Record<string, string> = {
  // Local scenarios
  "r1-html-basics":
    "Tests basic HTML generation — a styled, interactive button with hover effects.",
  "r2-layout":
    "Tests flexbox layout — a navbar with brand, centered links, and a right-aligned button.",
  "r3-modify":
    "Tests code modification — adding a dropdown and dark mode toggle to existing HTML without breaking it.",
  "r4-interactive":
    "Tests DOM manipulation — a todo app with add, check, delete, and live counters.",
  "r5-responsive":
    "Tests responsive design — a 3-tier pricing table using CSS Grid that stacks on mobile.",
  "r6-multi-component":
    "Tests complex layout — a dashboard with fixed sidebar, stat cards, and chart placeholder.",
  "r7-complex-logic":
    "Tests JavaScript logic — a working calculator with chained operations and history panel.",
  "r8-full-page":
    "Tests full-page generation — a complete SaaS landing page with hero, features, pricing, and footer.",

  // Cloud scenarios
  "cloud-r1-restaurant":
    "Full restaurant site — parallax hero, reservation form, testimonial carousel, and embedded map.",
  "cloud-r2-portfolio":
    "Creative portfolio — typing effect, filterable gallery, lightbox modal, and scroll-triggered animations.",
  "cloud-r3-saas":
    "SaaS landing page — pricing toggle, FAQ accordion, comparison table, and mobile hamburger menu.",
  "cloud-r4-ecommerce":
    "E-commerce product page — image gallery, variant selectors, cart drawer, and tabbed content.",
  "cloud-r5-dashboard":
    "Admin dashboard — sortable data table, animated stat cards, SVG chart, and dark mode toggle.",
  "cloud-r6-multipage":
    "Multi-page SPA — JS hash routing, shared header/footer, modals, and form validation across 4 pages.",
  "cloud-r7-refactor":
    "Refactor challenge — upgrade a basic site with responsive design, SEO, scroll animations, and testimonials.",
  "cloud-r8-autonomy":
    "Full autonomy — vague brief for a dog grooming business, model makes all design decisions.",
};

// ── Criterion Explainers ────────────────────────────────────────────

/** One-line description of what each scoring criterion measures. */
export const CRITERION_EXPLAINERS: Record<string, string> = {
  codeExtracted:
    "Did the model produce parseable code inside a code block?",
  validHtml:
    "Is the output a complete HTML document with proper structure?",
  requiredElements:
    "Does the HTML contain the required semantic elements (nav, form, table, etc.)?",
  requiredKeywords:
    "Does the code include domain-specific content and terminology?",
  cssCriteria:
    "Are required CSS patterns present (media queries, flexbox, animations)?",
  jsCriteria:
    "Are required JS patterns present (event listeners, DOM manipulation)?",
  codeLength:
    "Does the output meet the minimum size threshold for this scenario?",
};

// ── Score Explainer ─────────────────────────────────────────────────

/** Map from breakdown key to its display label. */
const CRITERION_LABELS: Record<string, string> = {
  codeExtracted: "Code Extracted",
  validHtml: "Valid HTML",
  requiredElements: "Required Elements",
  requiredKeywords: "Required Keywords",
  cssCriteria: "CSS Criteria",
  jsCriteria: "JS Criteria",
  codeLength: "Code Length",
};

/** Max points per criterion. */
const CRITERION_MAX: Record<string, number> = {
  codeExtracted: 20,
  validHtml: 10,
  requiredElements: 25,
  requiredKeywords: 20,
  cssCriteria: 10,
  jsCriteria: 10,
  codeLength: 5,
};

/**
 * Generate a dynamic one-liner explaining why a criterion scored what it did.
 * Pure display — reads score values, returns a sentence.
 */
export function getScoreExplanation(
  criterion: keyof ScoreBreakdown,
  score: number,
  max: number
): string {
  const pct = max > 0 ? score / max : 0;

  switch (criterion) {
    case "codeExtracted":
      if (score === 0) return "No code block found in the response.";
      if (score < 10) return "Code block found but extremely short (under 50 chars).";
      if (score < 20) return "Code block found but below expected length.";
      return "Clean code block extracted successfully.";

    case "validHtml":
      if (score === 0) return "Output is not HTML — may be plain text, CSS, or JS only.";
      if (score <= 5) return "Output looks like React JSX, not a standalone HTML document.";
      if (score <= 7) return "HTML snippet found but missing <!DOCTYPE> or <html> wrapper.";
      return "Complete HTML document with proper structure.";

    case "requiredElements":
      if (pct === 0) return "None of the required HTML elements were found.";
      if (pct < 0.5) return `Only ${Math.round(pct * 100)}% of required elements present — missing key structural tags.`;
      if (pct < 1) return `Most required elements present (${Math.round(pct * 100)}%) — a few missing.`;
      return "All required HTML elements present.";

    case "requiredKeywords":
      if (pct === 0) return "None of the expected keywords found in the output.";
      if (pct < 0.5) return `Only ${Math.round(pct * 100)}% of keywords matched — content may be incomplete or renamed.`;
      if (pct < 1) return `Most keywords present (${Math.round(pct * 100)}%) — minor omissions.`;
      return "All domain-specific keywords present in the output.";

    case "cssCriteria":
      if (pct === 0) return "No required CSS patterns found — missing layout/animation styles.";
      if (pct < 0.5) return `Only ${Math.round(pct * 100)}% of CSS patterns matched — limited styling.`;
      if (pct < 1) return `Most CSS patterns present (${Math.round(pct * 100)}%) — nearly complete.`;
      return "All required CSS patterns present.";

    case "jsCriteria":
      if (pct === 0) return "No required JS patterns found — may lack interactivity.";
      if (pct < 0.5) return `Only ${Math.round(pct * 100)}% of JS patterns matched — limited functionality.`;
      if (pct < 1) return `Most JS patterns present (${Math.round(pct * 100)}%) — nearly complete.`;
      return "All required JavaScript patterns present.";

    case "codeLength":
      if (score === 0) return "No code output at all.";
      if (score <= 1) return "Output exists but far below the minimum size threshold.";
      if (score <= 3) return "Output is at least 50% of the expected minimum length.";
      return "Output meets the minimum size threshold.";

    default:
      return "";
  }
}

// ── Model Summary ───────────────────────────────────────────────────

/** Letter grade from overall score. */
export function getLetterGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D+";
  if (score >= 45) return "D";
  if (score >= 40) return "D-";
  return "F";
}

/** Grade color class. */
export function getGradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-400";
  if (grade.startsWith("B")) return "text-sky-400";
  if (grade.startsWith("C")) return "text-amber-400";
  if (grade.startsWith("D")) return "text-orange-400";
  return "text-red-400";
}

export interface ModelSummary {
  grade: string;
  gradeColor: string;
  overallScore: number;
  topRounds: { name: string; score: number }[];
  bottomRounds: { name: string; score: number }[];
  strengths: string[];
  weaknesses: string[];
  useCase: string;
}

/**
 * Build a model summary from all completed round results for a single model.
 * Display-only — reads existing results, returns a summary object.
 */
export function buildModelSummary(
  results: RoundResult[],
  scenarios: BenchmarkScenario[]
): ModelSummary | null {
  if (results.length < 2) return null;

  const scenarioMap = new Map(scenarios.map((s) => [s.id, s]));

  // Sort by score for top/bottom
  const sorted = [...results]
    .filter((r) => !r.error)
    .map((r) => ({
      name: scenarioMap.get(r.scenarioId)?.name || r.scenarioId,
      score: r.score.total,
      breakdown: r.score,
    }))
    .sort((a, b) => b.score - a.score);

  if (sorted.length < 2) return null;

  const overallScore = Math.round(
    sorted.reduce((sum, r) => sum + r.score, 0) / sorted.length
  );

  const topRounds = sorted.slice(0, 3);
  const bottomRounds = sorted.slice(-2).reverse();

  // Analyze aggregate strengths/weaknesses across all results
  const avgBreakdown = {
    codeExtracted: 0,
    validHtml: 0,
    requiredElements: 0,
    requiredKeywords: 0,
    cssCriteria: 0,
    jsCriteria: 0,
    codeLength: 0,
  };
  const maxes: Record<string, number> = {
    codeExtracted: 20,
    validHtml: 10,
    requiredElements: 25,
    requiredKeywords: 20,
    cssCriteria: 10,
    jsCriteria: 10,
    codeLength: 5,
  };

  for (const r of sorted) {
    for (const key of Object.keys(avgBreakdown) as (keyof typeof avgBreakdown)[]) {
      avgBreakdown[key] += r.breakdown[key];
    }
  }
  for (const key of Object.keys(avgBreakdown) as (keyof typeof avgBreakdown)[]) {
    avgBreakdown[key] = avgBreakdown[key] / sorted.length;
  }

  // Strengths: criteria scoring above 80% on average
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const labels: Record<string, string> = {
    codeExtracted: "Code extraction",
    validHtml: "HTML structure",
    requiredElements: "Semantic elements",
    requiredKeywords: "Content accuracy",
    cssCriteria: "CSS patterns",
    jsCriteria: "JavaScript logic",
    codeLength: "Output completeness",
  };

  for (const key of Object.keys(avgBreakdown) as (keyof typeof avgBreakdown)[]) {
    const pct = avgBreakdown[key] / maxes[key];
    if (pct >= 0.8) strengths.push(labels[key]);
    else if (pct < 0.5) weaknesses.push(labels[key]);
  }

  // Use case suggestion
  let useCase: string;
  const grade = getLetterGrade(overallScore);
  if (overallScore >= 85) {
    useCase = "Production-grade builder — handles complex multi-section sites with strong code quality.";
  } else if (overallScore >= 70) {
    useCase = "Reliable builder for standard pages — may need guidance on complex layouts or advanced JS.";
  } else if (overallScore >= 55) {
    useCase = "Suitable for simple pages and prototyping — struggles with multi-component builds.";
  } else if (overallScore >= 40) {
    useCase = "Basic scaffolding only — needs significant human editing for production use.";
  } else {
    useCase = "Not recommended for building — output quality is too inconsistent for practical use.";
  }

  return {
    grade,
    gradeColor: getGradeColor(grade),
    overallScore,
    topRounds,
    bottomRounds,
    strengths,
    weaknesses,
    useCase,
  };
}
