/**
 * Score all PlanFlowAI pages — audit + AI fix loop + certificate.
 *
 * Strategy: Split into short audit-only API calls + direct Gemini fix calls.
 * Tracks best-scoring version per page (doesn't blindly keep last pass).
 * Skips fix passes for categories already at target.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3101";
const PROJECT_DIR = "L:/ai_builder/projects/planflowai";
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";

const MAX_PASSES = 3;
const TARGET_SCORE = 95;

const PAGES = [
  { name: "Home",        file: "index.html" },
  { name: "Showroom",    file: "showroom.html" },
  { name: "Pricing",     file: "pricing.html" },
  { name: "Services",    file: "services.html" },
  { name: "How It Works",file: "how-it-works.html" },
  { name: "About",       file: "about.html" },
  { name: "Contact",     file: "contact.html" },
];

// ── Fix prompt checklist ────────────────────────────────────────────────────

const BASELINE_FIX_CHECKLIST = `
MANDATORY CHECKLIST — inject ALL of these if missing:

SEO:
- <meta name="description" content="..."> (150-160 characters)
- <meta property="og:title" content="...">
- <meta property="og:description" content="...">
- <meta property="og:image" content="https://via.placeholder.com/1200x630">
- <meta property="og:url" content="...">
- <meta property="og:type" content="website">
- <meta name="twitter:card" content="summary_large_image">
- <link rel="canonical" href="https://planflowai.com">
- JSON-LD structured data matching business type
- Proper heading hierarchy: ONE <h1>, <h2> for sections
- All <img> tags must have descriptive alt text
- <html lang="en">
- <meta name="viewport" content="width=device-width, initial-scale=1.0">

FAVICON:
- <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">

BEST PRACTICES:
- External links get rel="noopener noreferrer"
- <meta charset="UTF-8"> must be FIRST child of <head>
- All <img> tags: explicit width and height attributes
- All URLs use https://
- No console.log() in production JS
- <!DOCTYPE html> as first line

ACCESSIBILITY:
- Sufficient color contrast (WCAG AA: 4.5:1 normal, 3:1 large)
- All interactive elements keyboard accessible
- All form inputs have labels
- Skip navigation link as FIRST in <body>
- @media (prefers-reduced-motion: reduce) rule

PERFORMANCE (CRITICAL — do NOT increase page size unnecessarily):
- loading="lazy" on ALL <img> EXCEPT the first visible one
- font-display: swap on @font-face and Google Fonts URLs
- Preconnect hints for Google Fonts if used
- MINIMIZE total HTML size — remove unnecessary whitespace, comments, dead CSS
- Combine duplicate CSS rules
- Remove any redundant or repeated styles
`.trim();

// ── Inline external CSS/JS ────────────────────────────────────────────────

function inlineExternalRefs(html, projectDir) {
  let result = html;
  result = result.replace(
    /<link\s+rel="stylesheet"\s+href="(styles\.css)"[^>]*>/gi,
    (match, file) => {
      const p = join(projectDir, file);
      return existsSync(p) ? `<style>\n${readFileSync(p, "utf-8")}\n</style>` : match;
    }
  );
  result = result.replace(
    /<script\s+src="(main\.js)"[^>]*><\/script>/gi,
    (match, file) => {
      const p = join(projectDir, file);
      return existsSync(p) ? `<script>\n${readFileSync(p, "utf-8")}\n</script>` : match;
    }
  );
  return result;
}

// ── Audit-only call ──────────────────────────────────────────────────────

async function auditPage(html) {
  const res = await fetch(`${BASE}/api/benchmark/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, fix: false }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Audit HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Score helpers ────────────────────────────────────────────────────────

function extractScores(report) {
  if (report?.scores) {
    return {
      performance: report.scores.performance ?? null,
      accessibility: report.scores.accessibility ?? null,
      seo: report.scores.seo ?? null,
      bestPractices: report.scores.bestPractices ?? null,
    };
  }
  const results = report?.results || [];
  const lh = results.find(r => r.tool === "lighthouse");
  const axe = results.find(r => r.tool === "axe-core");
  return {
    performance: lh?.scores?.performance ?? null,
    accessibility: lh?.scores?.accessibility ?? axe?.score ?? null,
    seo: lh?.scores?.seo ?? lh?.score ?? null,
    bestPractices: lh?.scores?.bestPractices ?? null,
  };
}

function collectViolations(report) {
  const violations = [];
  for (const r of (report?.results || [])) {
    for (const v of (r.violations || [])) {
      violations.push({
        rule: v.rule || "unknown",
        severity: v.severity || "warning",
        message: v.message || v.rule || "unknown",
        fix: v.fix,
      });
    }
  }
  return violations;
}

function allAbove(scores, threshold) {
  const vals = Object.values(scores).filter(s => s !== null);
  return vals.length > 0 && vals.every(s => s >= threshold);
}

function minScore(scores) {
  const vals = Object.values(scores).filter(s => s !== null);
  return vals.length > 0 ? Math.min(...vals) : 0;
}

// ── Gemini fix call ─────────────────────────────────────────────────────

function buildFixPrompt(html, violations, scores, passNumber) {
  const violationSummary = violations.slice(0, 30).map(v =>
    `- [${v.severity}] ${v.rule}: ${v.message}`
  ).join("\n");

  const scoreSummary = [
    scores.performance !== null ? `Performance: ${scores.performance}` : null,
    scores.accessibility !== null ? `Accessibility: ${scores.accessibility}` : null,
    scores.seo !== null ? `SEO: ${scores.seo}` : null,
    scores.bestPractices !== null ? `Best Practices: ${scores.bestPractices}` : null,
  ].filter(Boolean).join(", ");

  // Identify which categories need fixing
  const needsFix = [];
  if (scores.performance !== null && scores.performance < TARGET_SCORE) needsFix.push("Performance");
  if (scores.accessibility !== null && scores.accessibility < TARGET_SCORE) needsFix.push("Accessibility");
  if (scores.seo !== null && scores.seo < TARGET_SCORE) needsFix.push("SEO");
  if (scores.bestPractices !== null && scores.bestPractices < TARGET_SCORE) needsFix.push("Best Practices");

  const focusCategories = needsFix.length > 0
    ? `Focus on improving: ${needsFix.join(", ")}.`
    : "All categories need improvement.";

  if (passNumber === 1) {
    return `You are fixing an HTML file to achieve ${TARGET_SCORE}+ on ALL Lighthouse audit categories.
Current scores: ${scoreSummary}
${focusCategories}

CRITICAL RULE: Do NOT increase the HTML file size by more than 20%. Current size: ${html.length} bytes.
If a category is already at ${TARGET_SCORE}+, do NOT add anything for that category.

Return ONLY the complete fixed HTML file. No explanations, no markdown fences, just raw HTML starting with <!DOCTYPE html>.

FAILING AUDITS:
${violationSummary}

${BASELINE_FIX_CHECKLIST}

IMPORTANT: Apply fixes from the checklist above for categories that are BELOW ${TARGET_SCORE}.
Do NOT remove existing content. Only ADD missing elements and FIX issues.
MINIMIZE bloat — don't add unnecessary whitespace, comments, or duplicate styles.

HTML TO FIX:
${html}`;
  }

  return `This HTML file was already fixed but still has failing Lighthouse audits.
Current scores: ${scoreSummary}
${focusCategories}

CRITICAL RULE: Do NOT increase HTML file size. Try to REDUCE it. Current: ${html.length} bytes.

Return ONLY the complete fixed HTML. No explanations, no markdown fences, just raw HTML starting with <!DOCTYPE html>.

REMAINING ISSUES:
${violationSummary}

Fix these specifically. Do NOT remove content. Do NOT add anything for categories already at ${TARGET_SCORE}+.
REDUCE CSS/JS where possible — combine duplicate rules, remove dead code.

HTML TO FIX:
${html}`;
}

function extractHtmlFromResponse(text) {
  const fenceMatch = text.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const trimmed = text.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) return trimmed;
  const start = Math.max(trimmed.indexOf("<!DOCTYPE"), trimmed.indexOf("<!doctype"));
  return start >= 0 ? trimmed.slice(start).trim() : trimmed;
}

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(300000),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    console.log(`  [GEMINI] HTTP ${res.status}: ${errText.slice(0, 200)}`);
    return null;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text || text.length < 100) {
    console.log(`  [GEMINI] Response too short (${text.length} chars)`);
    return null;
  }
  return extractHtmlFromResponse(text);
}

// ── Main loop ─────────────────────────────────────────────────────────────

const results = [];

for (const page of PAGES) {
  const filePath = join(PROJECT_DIR, page.file);
  let rawHtml;
  try {
    rawHtml = readFileSync(filePath, "utf-8");
  } catch {
    console.log(`[SKIP] ${page.name} — file not found`);
    continue;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[PAGE] ${page.name} (${page.file}) — ${rawHtml.length} bytes`);
  console.log(`${"=".repeat(60)}`);

  try {
    let currentHtml = inlineExternalRefs(rawHtml, PROJECT_DIR);
    console.log(`[AUDIT] Initial (${currentHtml.length} bytes with inlined refs)...`);

    let report = await auditPage(currentHtml);
    let scores = extractScores(report);
    let violations = collectViolations(report);

    console.log(`[BEFORE] Perf: ${scores.performance ?? "?"} | A11y: ${scores.accessibility ?? "?"} | SEO: ${scores.seo ?? "?"} | BP: ${scores.bestPractices ?? "?"} | V: ${violations.length}`);

    const beforeScores = { ...scores };
    let passCount = 0;

    // Track the best version (highest minimum score across all categories)
    let bestHtml = currentHtml;
    let bestScores = { ...scores };
    let bestMinScore = minScore(scores);

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      if (allAbove(scores, TARGET_SCORE)) {
        console.log(`[DONE] All >= ${TARGET_SCORE}`);
        break;
      }

      // Skip if all non-null scores are at target
      const nonNullScores = Object.values(scores).filter(s => s !== null);
      if (nonNullScores.length === 0) {
        console.log(`[SKIP] No Lighthouse scores available`);
        break;
      }

      console.log(`[FIX] Pass ${pass}/${MAX_PASSES} — Gemini 2.5 Flash...`);
      const prompt = buildFixPrompt(currentHtml, violations, scores, pass);
      const fixedHtml = await callGemini(prompt);

      if (!fixedHtml) {
        console.log(`[FIX] Pass ${pass} — no usable HTML, stopping`);
        break;
      }

      const sizeChange = fixedHtml.length - currentHtml.length;
      const sizePct = ((sizeChange / currentHtml.length) * 100).toFixed(1);
      console.log(`[FIX] Pass ${pass} — ${fixedHtml.length} bytes (${sizeChange >= 0 ? "+" : ""}${sizePct}%), auditing...`);

      currentHtml = fixedHtml;
      report = await auditPage(currentHtml);
      scores = extractScores(report);
      violations = collectViolations(report);
      passCount = pass;

      const thisMin = minScore(scores);
      console.log(`[PASS ${pass}] Perf: ${scores.performance ?? "?"} | A11y: ${scores.accessibility ?? "?"} | SEO: ${scores.seo ?? "?"} | BP: ${scores.bestPractices ?? "?"} | V: ${violations.length} | Min: ${thisMin}`);

      // Keep the best version (highest minimum score)
      if (thisMin > bestMinScore) {
        bestHtml = currentHtml;
        bestScores = { ...scores };
        bestMinScore = thisMin;
        console.log(`  → New best (min ${thisMin})`);
      }
    }

    // Use best version
    const finalScores = bestScores;
    const finalHtml = bestHtml;

    console.log(`[AFTER] Perf: ${finalScores.performance ?? "?"} | A11y: ${finalScores.accessibility ?? "?"} | SEO: ${finalScores.seo ?? "?"} | BP: ${finalScores.bestPractices ?? "?"} (best of ${passCount + 1} versions)`);

    // Save best HTML
    if (passCount > 0 && bestMinScore > minScore(beforeScores)) {
      writeFileSync(filePath, finalHtml);
      console.log(`[SAVED] ${page.file} (${finalHtml.length} bytes)`);
    } else if (passCount > 0) {
      console.log(`[KEPT] Original — fix loop didn't improve minimum score`);
    }

    results.push({
      name: page.name,
      file: page.file,
      scores: {
        performance: finalScores.performance ?? 0,
        accessibility: finalScores.accessibility ?? 0,
        seo: finalScores.seo ?? 0,
        bestPractices: finalScores.bestPractices ?? 0,
      },
      beforeScores,
      passes: passCount,
    });
  } catch (err) {
    console.log(`[ERROR] ${page.name}: ${err.message}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n\n${"=".repeat(70)}`);
console.log("FINAL SCORES — PlanFlowAI (7 Pages)");
console.log("=".repeat(70));
console.log("Page            | Perf | A11y | SEO  | BP   | Fixes | Tier");
console.log("-".repeat(70));

function tier(scores) {
  const min = Math.min(scores.performance, scores.accessibility, scores.seo, scores.bestPractices);
  if (min >= 95) return "PLATINUM";
  if (min >= 90) return "GOLD";
  if (min >= 80) return "SILVER";
  return "NONE";
}

for (const r of results) {
  const s = r.scores;
  console.log(
    `${r.name.padEnd(16)}| ${String(s.performance).padStart(4)} | ${String(s.accessibility).padStart(4)} | ${String(s.seo).padStart(4)} | ${String(s.bestPractices).padStart(4)} | ${String(r.passes).padStart(5)} | ${tier(s)}`
  );
}

if (results.length > 0) {
  const avg = {
    performance: Math.round(results.reduce((s, r) => s + r.scores.performance, 0) / results.length),
    accessibility: Math.round(results.reduce((s, r) => s + r.scores.accessibility, 0) / results.length),
    seo: Math.round(results.reduce((s, r) => s + r.scores.seo, 0) / results.length),
    bestPractices: Math.round(results.reduce((s, r) => s + r.scores.bestPractices, 0) / results.length),
  };
  console.log("-".repeat(70));
  console.log(`${"AVERAGE".padEnd(16)}| ${String(avg.performance).padStart(4)} | ${String(avg.accessibility).padStart(4)} | ${String(avg.seo).padStart(4)} | ${String(avg.bestPractices).padStart(4)} |       | ${tier(avg)}`);

  const overallTier = tier({
    performance: Math.min(...results.map(r => r.scores.performance)),
    accessibility: Math.min(...results.map(r => r.scores.accessibility)),
    seo: Math.min(...results.map(r => r.scores.seo)),
    bestPractices: Math.min(...results.map(r => r.scores.bestPractices)),
  });
  console.log(`\nOverall Tier (weakest page): ${overallTier}`);
  console.log(`Pages scored: ${results.length}/${PAGES.length}`);

  // Before → After
  console.log(`\n${"=".repeat(70)}`);
  console.log("BEFORE → AFTER");
  console.log("=".repeat(70));
  for (const r of results) {
    const b = r.beforeScores;
    const a = r.scores;
    const d = (cat) => {
      const diff = (a[cat] ?? 0) - (b[cat] ?? 0);
      return diff > 0 ? `+${diff}` : diff === 0 ? "=" : String(diff);
    };
    console.log(`${r.name.padEnd(16)}| P: ${b.performance ?? "?"}→${a.performance}(${d("performance")}) A: ${b.accessibility ?? "?"}→${a.accessibility}(${d("accessibility")}) S: ${b.seo ?? "?"}→${a.seo}(${d("seo")}) B: ${b.bestPractices ?? "?"}→${a.bestPractices}(${d("bestPractices")})`);
  }

  // Certificate
  if (overallTier !== "NONE") {
    console.log(`\n[CERT] Generating ${overallTier} certificate...`);
    try {
      const certRes = await fetch(`${BASE}/api/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: overallTier.toLowerCase(),
          clientName: "PlanFlowAI",
          siteUrl: "https://planflowai.com",
          scores: avg,
          pages: results.map(r => ({ name: r.name, scores: r.scores })),
          model: "gpt-4.1 + gemini-2.5-flash",
          provider: "openai + google",
          buildTimeMs: 0,
          cost: 0,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (certRes.ok) {
        const buf = await certRes.arrayBuffer();
        const certPath = join(PROJECT_DIR, `certificate-${overallTier.toLowerCase()}.pdf`);
        writeFileSync(certPath, Buffer.from(buf));
        console.log(`[CERT] Saved: ${certPath} (${buf.byteLength} bytes)`);
      } else {
        console.log(`[CERT ERROR] HTTP ${certRes.status}: ${(await certRes.text()).slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`[CERT ERROR] ${err.message}`);
    }
  }
}
