/**
 * Compile API — Runs @sarge/audit verification against HTML in memory.
 * Writes HTML to a temp directory, runs html-validate + axe-core + Lighthouse,
 * returns AuditReport. Optionally calls Gemini to fix violations and re-audits.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runAudit } from "@sarge/audit";

export async function POST(request: NextRequest) {
  try {
    const { html, fix, violations } = await request.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "html is required" }, { status: 400 });
    }

    // Create temp directory
    const tempDir = join(tmpdir(), `sarge-compile-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      // Write HTML
      writeFileSync(join(tempDir, "index.html"), html, "utf-8");

      // Run audit (skip Lighthouse for speed in fix mode)
      const report = await runAudit(tempDir, { skipLighthouse: !!fix });

      if (fix && violations && violations.length > 0) {
        // Call Gemini 2.5 Flash to fix violations
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
          return NextResponse.json({ beforeReport: report, afterReport: null, fixedHtml: null, error: "No GOOGLE_API_KEY for AI fix" });
        }

        const violationSummary = violations.slice(0, 20).map((v: { rule: string; severity: string; message: string }) =>
          `- [${v.severity}] ${v.rule}: ${v.message}`
        ).join("\n");

        const fixPrompt = `Fix these HTML issues in the code below. Return ONLY the complete fixed HTML file, no explanations.

ISSUES:
${violationSummary}

HTML:
\`\`\`html
${html}
\`\`\``;

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: fixPrompt }] }],
              }),
              signal: AbortSignal.timeout(30000),
            }
          );

          if (res.ok) {
            const data = await res.json();
            let fixedHtml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // Extract code from markdown fences if present
            const fenceMatch = fixedHtml.match(/```(?:html)?\s*\n([\s\S]*?)```/);
            if (fenceMatch) fixedHtml = fenceMatch[1].trim();

            if (fixedHtml.length > 100) {
              // Write fixed HTML and re-audit
              writeFileSync(join(tempDir, "index.html"), fixedHtml, "utf-8");
              const afterReport = await runAudit(tempDir, { skipLighthouse: true });
              return NextResponse.json({ beforeReport: report, afterReport, fixedHtml });
            }
          }
        } catch (fixErr) {
          console.warn("[Compile] AI fix failed:", fixErr);
        }

        return NextResponse.json({ beforeReport: report, afterReport: null, fixedHtml: null });
      }

      return NextResponse.json(report);
    } finally {
      // Clean up temp directory
      try {
        if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json({ error: "Compiler timed out after 30 seconds" }, { status: 504 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
