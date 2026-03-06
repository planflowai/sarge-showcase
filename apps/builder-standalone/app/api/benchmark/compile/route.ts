/**
 * Compile API — Runs @sarge/audit verification against HTML in memory.
 * Writes HTML to a temp directory, runs html-validate + axe-core + Lighthouse,
 * returns AuditReport. Optionally runs up to 3 AI fix passes targeting 95+ scores.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runAudit } from "@sarge/audit";

// ── Enhanced fix prompt checklist ────────────────────────────────────────────

const BASELINE_FIX_CHECKLIST = `
MANDATORY CHECKLIST — inject ALL of these if missing:

SEO:
- <meta name="description" content="..."> (150-160 characters, specific to page content)
- <meta property="og:title" content="...">
- <meta property="og:description" content="...">
- <meta property="og:image" content="..."> (use a placeholder like https://via.placeholder.com/1200x630 if no real image)
- <meta property="og:url" content="...">
- <meta property="og:type" content="website">
- <meta name="twitter:card" content="summary_large_image">
- <meta name="twitter:title" content="...">
- <meta name="twitter:description" content="...">
- <link rel="canonical" href="..."> (use a placeholder URL like https://example.com)
- JSON-LD structured data (<script type="application/ld+json">) matching the business type (LocalBusiness, Organization, etc.)
- Proper heading hierarchy: exactly ONE <h1>, <h2> for sections, <h3> for subsections — never skip levels
- All <img> tags must have descriptive alt text (not empty, not "image", not "photo")
- <html lang="en"> attribute on the html tag
- <meta name="viewport" content="width=device-width, initial-scale=1.0">

FAVICON:
- Add a favicon using an inline SVG data URI: <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
- Add <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
- Choose an emoji that matches the page content (🏠 for real estate, 🍕 for restaurant, 💼 for business, etc.)

BEST PRACTICES:
- All external links (<a> with href starting with http) get rel="noopener noreferrer"
- NEVER use document.write()
- <meta charset="UTF-8"> must be the FIRST child of <head>
- All <img> tags must have explicit width and height attributes
- All resource URLs must use https:// (no http:// mixed content)
- No deprecated APIs (no document.all, no window.event, etc.)
- No console.log() or console.error() in production JavaScript
- Proper <!DOCTYPE html> declaration as the very first line
- No errors in JavaScript — all event listeners on elements that exist

ACCESSIBILITY:
- All text must have sufficient color contrast ratio (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
- Light text on dark backgrounds: use at minimum #d1d5db (gray-300) on #1e293b (slate-800)
- Dark text on light backgrounds: use at minimum #374151 (gray-700) on #f9fafb (gray-50)
- All interactive elements must be keyboard accessible
- All form inputs must have associated labels
- All images must have alt text
- ARIA attributes must be valid
- Add a skip navigation link as the FIRST element in <body>: <a href="#main-content" class="skip-link">Skip to main content</a> with CSS to show only on focus
- Add @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

PERFORMANCE:
- Add loading="lazy" to all <img> tags EXCEPT the first visible one (above the fold)
- Add font-display: swap to all @font-face rules AND Google Font @import URLs (append &display=swap to Google Fonts import URLs)
- Add <link rel="preconnect" href="https://fonts.googleapis.com"> AND <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin> if using Google Fonts
- No render-blocking external resources
- Use srcset and sizes attributes on hero/banner <img> tags for responsive images (e.g., srcset="img-320.jpg 320w, img-640.jpg 640w, img-1280.jpg 1280w" sizes="(max-width: 640px) 100vw, 50vw")
`.trim();

// ── Helpers ──────────────────────────────────────────────────────────────────

interface AuditViolation {
  rule: string;
  severity: string;
  message: string;
  fix?: string;
}

function extractScores(report: any): {
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
} {
  return {
    performance: report?.scores?.performance ?? report?.performance?.score ?? null,
    accessibility: report?.scores?.accessibility ?? report?.accessibility?.score ?? null,
    seo: report?.scores?.seo ?? report?.seo?.score ?? null,
    bestPractices: report?.scores?.bestPractices ?? report?.bestPractices?.score ?? null,
  };
}

function allScoresAbove(scores: ReturnType<typeof extractScores>, threshold: number): boolean {
  const vals = Object.values(scores).filter((s): s is number => s !== null);
  return vals.length > 0 && vals.every(s => s >= threshold);
}

function collectViolations(report: any): AuditViolation[] {
  const violations: AuditViolation[] = [];
  const results = report?.results || [];
  for (const r of results) {
    if (r.violations && Array.isArray(r.violations)) {
      for (const v of r.violations) {
        violations.push({
          rule: v.rule || "unknown",
          severity: v.severity || "warning",
          message: v.message || v.rule || "unknown",
          fix: v.fix,
        });
      }
    }
  }
  return violations;
}

function buildFixPrompt(html: string, violations: AuditViolation[], scores: ReturnType<typeof extractScores>, passNumber: number): string {
  const violationSummary = violations.slice(0, 30).map(v =>
    `- [${v.severity}] ${v.rule}: ${v.message}`
  ).join("\n");

  const scoreSummary = [
    scores.performance !== null ? `Performance: ${scores.performance}` : null,
    scores.accessibility !== null ? `Accessibility: ${scores.accessibility}` : null,
    scores.seo !== null ? `SEO: ${scores.seo}` : null,
    scores.bestPractices !== null ? `Best Practices: ${scores.bestPractices}` : null,
  ].filter(Boolean).join(", ");

  if (passNumber === 1) {
    // First pass: full checklist + violations
    return `You are fixing an HTML file to achieve 95+ on ALL Lighthouse audit categories.
Current scores: ${scoreSummary}
Target: 95+ on Performance, Accessibility, SEO, and Best Practices.

Return ONLY the complete fixed HTML file. No explanations, no markdown fences, just raw HTML starting with <!DOCTYPE html>.

FAILING AUDITS:
${violationSummary}

${BASELINE_FIX_CHECKLIST}

IMPORTANT: Apply ALL fixes from the checklist above even if not explicitly listed in the failing audits. These are common score killers.
Do NOT remove any existing content, styles, or functionality. Only ADD missing elements and FIX issues.

HTML TO FIX:
${html}`;
  }

  // Subsequent passes: targeted at remaining violations only
  return `This HTML file was already fixed once but still has failing Lighthouse audits.
Current scores: ${scoreSummary}
Target: 95+ on ALL categories.

Return ONLY the complete fixed HTML file. No explanations, no markdown fences, just raw HTML starting with <!DOCTYPE html>.

REMAINING FAILING AUDITS (fix these specifically):
${violationSummary}

Focus on these specific issues. Do NOT remove any existing content, styles, or functionality. Only fix the listed issues.

HTML TO FIX:
${html}`;
}

function extractHtmlFromResponse(text: string): string {
  // Try to extract from markdown fences first
  const fenceMatch = text.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // If response starts with <!DOCTYPE or <html, use as-is
  const trimmed = text.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
    return trimmed;
  }

  // Try to find HTML block in the response
  const htmlStart = trimmed.indexOf("<!DOCTYPE");
  const htmlStartLower = trimmed.indexOf("<!doctype");
  const start = htmlStart >= 0 ? htmlStart : htmlStartLower;
  if (start >= 0) {
    return trimmed.slice(start).trim();
  }

  return trimmed;
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text || text.length < 100) return null;

    return extractHtmlFromResponse(text);
  } catch (err) {
    console.warn("[Compile] Gemini call failed:", err);
    return null;
  }
}

// ── Main route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { html, fix, violations: clientViolations } = await request.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "html is required" }, { status: 400 });
    }

    const tempDir = join(tmpdir(), `sarge-compile-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      // Write original HTML
      writeFileSync(join(tempDir, "index.html"), html, "utf-8");

      // Run full audit (WITH Lighthouse)
      const initialReport = await runAudit(tempDir);

      // If not in fix mode, just return the report
      if (!fix) {
        return NextResponse.json(initialReport);
      }

      // ── Fix mode: up to 3 passes targeting 95+ ──────────────────────

      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        return NextResponse.json({
          beforeReport: initialReport,
          afterReport: null,
          fixedHtml: null,
          passes: 0,
          error: "No GOOGLE_API_KEY for AI fix",
        });
      }

      const MAX_PASSES = 3;
      const TARGET_SCORE = 95;

      let currentHtml = html;
      let currentReport = initialReport;
      let currentScores = extractScores(initialReport);
      let currentViolations = clientViolations?.length > 0
        ? clientViolations
        : collectViolations(initialReport);
      let passCount = 0;
      const passLog: Array<{ pass: number; scores: typeof currentScores; violationCount: number }> = [];

      // Log initial state
      passLog.push({ pass: 0, scores: { ...currentScores }, violationCount: currentViolations.length });

      for (let pass = 1; pass <= MAX_PASSES; pass++) {
        // Check if all Lighthouse scores already meet the target
        if (allScoresAbove(currentScores, TARGET_SCORE)) {
          break;
        }

        // Build targeted prompt
        const prompt = buildFixPrompt(currentHtml, currentViolations, currentScores, pass);

        // Call Gemini
        const fixedHtml = await callGemini(apiKey, prompt);
        if (!fixedHtml) {
          console.warn(`[Compile] Pass ${pass} — Gemini returned no usable HTML`);
          break;
        }

        // Write fixed HTML and re-audit WITH Lighthouse
        writeFileSync(join(tempDir, "index.html"), fixedHtml, "utf-8");
        currentReport = await runAudit(tempDir);
        currentHtml = fixedHtml;
        currentScores = extractScores(currentReport);
        currentViolations = collectViolations(currentReport);
        passCount = pass;

        passLog.push({ pass, scores: { ...currentScores }, violationCount: currentViolations.length });

        console.log(`[Compile] Pass ${pass} — Perf: ${currentScores.performance}, A11y: ${currentScores.accessibility}, SEO: ${currentScores.seo}, BP: ${currentScores.bestPractices}, Violations: ${currentViolations.length}`);

        // If all scores are 95+ we can stop
        if (allScoresAbove(currentScores, TARGET_SCORE)) {
          break;
        }
      }

      return NextResponse.json({
        beforeReport: initialReport,
        afterReport: currentReport,
        fixedHtml: currentHtml !== html ? currentHtml : null,
        passes: passCount,
        passLog,
      });

    } finally {
      try {
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Compiler timed out" }, { status: 504 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
