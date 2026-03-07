import { execFile } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import type { AuditResult, AuditViolation } from "../types/audit";

/**
 * Run Lighthouse audit against a project folder.
 *
 * Lighthouse uses import.meta.url extensively for path resolution which breaks
 * when bundled by webpack. So we run it in a standalone Node.js subprocess
 * (lighthouse-worker.mjs) that executes in a native ESM context.
 */
export async function runLighthouse(
  projectPath: string
): Promise<{
  result: AuditResult;
  scores: {
    performance: number | null;
    accessibility: number | null;
    seo: number | null;
    bestPractices: number | null;
  };
}> {
  const t0 = Date.now();
  const nullScores = {
    performance: null,
    accessibility: null,
    seo: null,
    bestPractices: null,
  };

  try {
    // Resolve the worker script path — try multiple locations because
    // __dirname is unreliable in webpack-bundled contexts
    const candidates = [
      join(__dirname, "lighthouse-worker.mjs"),
      join(process.cwd(), "../../packages/audit/src/runners/lighthouse-worker.mjs"),
      join(process.cwd(), "packages/audit/src/runners/lighthouse-worker.mjs"),
    ];
    const workerPath = candidates.find((p) => existsSync(p));

    if (!workerPath) {
      return {
        result: {
          tool: "lighthouse",
          category: "seo",
          score: null,
          passed: false,
          violations: [],
          summary: `Lighthouse worker script not found. Tried: ${candidates.join(", ")}`,
          timestamp: new Date().toISOString(),
          duration: Date.now() - t0,
        },
        scores: nullScores,
      };
    }

    const output = await new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath, // node executable
        [workerPath, projectPath],
        {
          timeout: 120_000, // 120s max — large pages need more time
          env: { ...process.env },
          maxBuffer: 10 * 1024 * 1024, // 10MB
        },
        (error, stdout, stderr) => {
          if (error && !stdout) {
            reject(new Error(error.message));
            return;
          }
          // Worker outputs JSON to stdout even on errors
          resolve(stdout);
        }
      );
    });

    // Parse the JSON output from the worker
    const data = JSON.parse(output.trim());

    if (data.error) {
      return {
        result: {
          tool: "lighthouse",
          category: "seo",
          score: null,
          passed: false,
          violations: [],
          summary: data.summary || `Lighthouse failed: ${data.error}`,
          timestamp: new Date().toISOString(),
          duration: data.duration || Date.now() - t0,
        },
        scores: data.scores || nullScores,
      };
    }

    const violations: AuditViolation[] = (data.violations || []).map(
      (v: any) => ({
        rule: v.rule,
        severity: v.severity,
        message: v.message,
        fix: v.fix,
      })
    );

    const scores = data.scores || nullScores;
    const allScoreValues = Object.values(scores).filter(
      (s): s is number => s !== null
    );
    const allPassing = allScoreValues.every((s) => s >= 80);

    return {
      result: {
        tool: "lighthouse",
        category: "seo",
        score: scores.seo,
        passed: data.passed ?? allPassing,
        violations,
        summary: data.summary || "Lighthouse completed",
        timestamp: new Date().toISOString(),
        duration: data.duration || Date.now() - t0,
      },
      scores,
    };
  } catch (err: any) {
    return {
      result: {
        tool: "lighthouse",
        category: "seo",
        score: null,
        passed: false,
        violations: [],
        summary: `Lighthouse failed: ${err.message || "Unknown error"}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - t0,
      },
      scores: nullScores,
    };
  }
}
