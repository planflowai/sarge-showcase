import { HtmlValidate } from "html-validate";
import type { AuditResult, AuditViolation } from "../types/audit";

/**
 * Run html-validate against an HTML string and return an AuditResult.
 */
export async function runHTMLValidate(
  html: string
): Promise<AuditResult> {
  const t0 = Date.now();
  const violations: AuditViolation[] = [];

  try {
    const htmlvalidate = new HtmlValidate({
      extends: ["html-validate:recommended"],
      rules: {
        // Relax some rules that are too strict for builder-generated HTML
        "no-inline-style": "off",
        "no-trailing-whitespace": "off",
        "attr-quotes": "off",
      },
    });

    const report = htmlvalidate.validateStringSync(html);

    for (const result of report.results) {
      for (const msg of result.messages) {
        violations.push({
          rule: msg.ruleId || "unknown",
          severity:
            msg.severity === 2
              ? "error"
              : msg.severity === 1
              ? "warning"
              : "notice",
          message: msg.message,
          line: msg.line,
        });
      }
    }

    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter(
      (v) => v.severity === "warning"
    ).length;

    return {
      tool: "html-validate",
      category: "html",
      score: null,
      passed: errorCount === 0,
      violations,
      summary:
        errorCount === 0
          ? `Valid HTML \u2014 0 errors${warningCount > 0 ? `, ${warningCount} warnings` : ""}`
          : `${errorCount} errors, ${warningCount} warnings found`,
      timestamp: new Date().toISOString(),
      duration: Date.now() - t0,
    };
  } catch (err: any) {
    return {
      tool: "html-validate",
      category: "html",
      score: null,
      passed: false,
      violations: [],
      summary: `html-validate failed: ${err.message || "Unknown error"}`,
      timestamp: new Date().toISOString(),
      duration: Date.now() - t0,
    };
  }
}
