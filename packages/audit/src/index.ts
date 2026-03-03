// @sarge/audit — Independent third-party verification for S.A.R.G.E. apps

export type { AuditViolation, AuditResult, AuditReport } from "./types/audit";
export { loadHTML } from "./utils/htmlLoader";
export { runHTMLValidate } from "./runners/htmlValidateRunner";
export { runAxeCore } from "./runners/axeCoreRunner";
export { runLighthouse } from "./runners/lighthouseRunner";

import { loadHTML } from "./utils/htmlLoader";
import { runHTMLValidate } from "./runners/htmlValidateRunner";
import { runAxeCore } from "./runners/axeCoreRunner";
import { runLighthouse } from "./runners/lighthouseRunner";
import type { AuditResult, AuditReport } from "./types/audit";

type ToolName = "html-validate" | "axe-core" | "lighthouse";

export interface RunAuditOptions {
  tools?: ToolName[];
  skipLighthouse?: boolean;
}

/**
 * Run a full audit suite against a project's index.html.
 *
 * By default runs all three tools sequentially.
 * Set `skipLighthouse: true` for quick checks (html-validate + axe-core only).
 */
export async function runAudit(
  projectPath: string,
  options?: RunAuditOptions
): Promise<AuditReport> {
  const t0 = Date.now();
  const results: AuditResult[] = [];

  const toolsToRun: ToolName[] = options?.tools || [
    "html-validate",
    "axe-core",
    ...(options?.skipLighthouse ? [] : ["lighthouse" as ToolName]),
  ];

  // If no explicit tools list was provided but skipLighthouse is true, filter it out
  if (!options?.tools && options?.skipLighthouse) {
    // Already handled above
  }

  let lhScores = {
    performance: null as number | null,
    accessibility: null as number | null,
    seo: null as number | null,
    bestPractices: null as number | null,
  };

  // Load HTML once for html-validate and axe-core
  let rawHTML: string | null = null;
  try {
    const loaded = loadHTML(projectPath);
    rawHTML = loaded.raw;
  } catch (err: any) {
    // If we can't load HTML, return a failed report
    return {
      projectPath,
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - t0,
      results: [
        {
          tool: "html-loader",
          category: "html",
          score: null,
          passed: false,
          violations: [],
          summary: `Failed to load index.html: ${err.message}`,
          timestamp: new Date().toISOString(),
          duration: 0,
        },
      ],
      overallPassed: false,
      scores: {
        html: null,
        accessibility: null,
        seo: null,
        performance: null,
        bestPractices: null,
      },
    };
  }

  // Run tools sequentially to avoid port conflicts
  for (const tool of toolsToRun) {
    try {
      switch (tool) {
        case "html-validate": {
          const result = await runHTMLValidate(rawHTML);
          results.push(result);
          break;
        }
        case "axe-core": {
          const result = await runAxeCore(projectPath);
          results.push(result);
          break;
        }
        case "lighthouse": {
          const { result, scores } = await runLighthouse(projectPath);
          results.push(result);
          lhScores = scores;
          break;
        }
      }
    } catch (err: any) {
      // If a tool throws unexpectedly, record a failed result and continue
      results.push({
        tool,
        category: tool === "html-validate" ? "html" : tool === "axe-core" ? "accessibility" : "seo",
        score: null,
        passed: false,
        violations: [],
        summary: `${tool} crashed: ${err.message || "Unknown error"}`,
        timestamp: new Date().toISOString(),
        duration: 0,
      });
    }
  }

  const overallPassed = results.every((r) => r.passed);

  return {
    projectPath,
    timestamp: new Date().toISOString(),
    totalDuration: Date.now() - t0,
    results,
    overallPassed,
    scores: {
      html: null, // html-validate is pass/fail only
      accessibility:
        results.find((r) => r.tool === "axe-core")?.score ?? null,
      seo: lhScores.seo,
      performance: lhScores.performance,
      bestPractices: lhScores.bestPractices,
    },
  };
}
