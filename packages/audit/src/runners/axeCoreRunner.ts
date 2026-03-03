import { JSDOM } from "jsdom";
import type { AuditResult, AuditViolation } from "../types/audit";

/**
 * Run axe-core accessibility audit against an HTML string using JSDOM.
 * Uses window.eval() to inject axe-core source — more reliable than <script> injection.
 */
export async function runAxeCore(html: string): Promise<AuditResult> {
  const t0 = Date.now();
  const violations: AuditViolation[] = [];

  try {
    // Create a JSDOM instance — runScripts: "dangerously" allows eval'd scripts
    const dom = new JSDOM(html, {
      url: "http://localhost",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });

    const { window } = dom;
    const { document } = window;

    // Import axe-core — dynamic import puts the module on .default
    const axeModule = await import("axe-core");
    const axeSource: string =
      (axeModule as any).default?.source ??
      (axeModule as any).source ??
      "";

    if (!axeSource) {
      throw new Error(
        "Could not load axe-core source. Ensure axe-core is installed."
      );
    }

    // Inject axe-core into the JSDOM window using eval (more reliable than <script>)
    window.eval(axeSource);

    if (typeof (window as any).axe?.run !== "function") {
      throw new Error(
        "axe-core did not initialize in JSDOM — window.axe.run is not a function"
      );
    }

    // Run axe in the JSDOM context
    const axeResults = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("axe-core timed out after 30s")),
        30000
      );

      try {
        (window as any).axe
          .run(document.documentElement, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          })
          .then((results: any) => {
            clearTimeout(timeout);
            resolve(results);
          })
          .catch((err: any) => {
            clearTimeout(timeout);
            reject(err);
          });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    // Map violations
    for (const v of axeResults.violations || []) {
      const severity = mapImpact(v.impact);
      const wcagTags = (v.tags || [])
        .filter((t: string) => t.startsWith("wcag"))
        .join(", ");

      const firstNode =
        v.nodes && v.nodes.length > 0 ? v.nodes[0] : null;

      violations.push({
        rule: v.id,
        severity,
        message: v.description,
        element: firstNode?.html
          ? truncate(firstNode.html, 200)
          : undefined,
        wcag: wcagTags || undefined,
        fix: v.help,
      });
    }

    // Calculate score
    const passCount = (axeResults.passes || []).length;
    const violationCount = (axeResults.violations || []).length;
    const total = passCount + violationCount;
    const score = total > 0 ? Math.round((passCount / total) * 100) : 100;

    const errorCount = violations.filter((v) => v.severity === "error").length;

    dom.window.close();

    return {
      tool: "axe-core",
      category: "accessibility",
      score,
      passed: errorCount === 0,
      violations,
      summary:
        errorCount === 0
          ? `WCAG 2.1 AA — 0 violations (score: ${score}/100)`
          : `${violations.length} violations found (score: ${score}/100)`,
      timestamp: new Date().toISOString(),
      duration: Date.now() - t0,
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

function mapImpact(
  impact: string | undefined
): "error" | "warning" | "notice" {
  switch (impact) {
    case "critical":
    case "serious":
      return "error";
    case "moderate":
      return "warning";
    case "minor":
    default:
      return "notice";
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
