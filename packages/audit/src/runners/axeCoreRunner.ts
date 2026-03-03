import { execFile } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import type { AuditResult, AuditViolation } from "../types/audit";

/**
 * Run axe-core accessibility audit against an HTML file using JSDOM.
 *
 * JSDOM + axe-core require native Node.js APIs (Canvas mock, DOM globals) that
 * break when bundled by webpack. So we run it in a standalone Node.js subprocess
 * (axe-worker.mjs) that executes in a native ESM context.
 */
export async function runAxeCore(projectPath: string): Promise<AuditResult> {
  const t0 = Date.now();

  try {
    // Find the worker script
    const candidates = [
      join(__dirname, "axe-worker.mjs"),
      join(process.cwd(), "../../packages/audit/src/runners/axe-worker.mjs"),
      join(process.cwd(), "packages/audit/src/runners/axe-worker.mjs"),
    ];
    const workerPath = candidates.find((p) => existsSync(p));

    if (!workerPath) {
      return {
        tool: "axe-core",
        category: "accessibility",
        score: null,
        passed: false,
        violations: [],
        summary: `axe-core worker script not found. Tried: ${candidates.join(", ")}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - t0,
      };
    }

    const output = await new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath,
        [workerPath, projectPath],
        {
          timeout: 30_000,
          env: { ...process.env },
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error && !stdout) {
            reject(new Error(error.message));
            return;
          }
          resolve(stdout);
        }
      );
    });

    const data = JSON.parse(output.trim());

    if (data.error) {
      return {
        tool: "axe-core",
        category: "accessibility",
        score: null,
        passed: false,
        violations: [],
        summary: data.summary || `axe-core failed: ${data.error}`,
        timestamp: new Date().toISOString(),
        duration: data.duration || Date.now() - t0,
      };
    }

    const violations: AuditViolation[] = (data.violations || []).map(
      (v: any) => ({
        rule: v.rule,
        severity: v.severity,
        message: v.message,
        element: v.element,
        wcag: v.wcag,
        fix: v.fix,
      })
    );

    return {
      tool: "axe-core",
      category: "accessibility",
      score: data.score,
      passed: data.passed,
      violations,
      summary: data.summary,
      timestamp: new Date().toISOString(),
      duration: data.duration || Date.now() - t0,
    };
  } catch (err: any) {
    return {
      tool: "axe-core",
      category: "accessibility",
      score: null,
      passed: false,
      violations: [],
      summary: `axe-core failed: ${err.message || "Unknown error"}`,
      timestamp: new Date().toISOString(),
      duration: Date.now() - t0,
    };
  }
}
