import { createServer, type Server } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import type { AuditResult, AuditViolation } from "../types/audit";

// MIME type map for serving static files
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

/**
 * Run Lighthouse audit against a project folder.
 * Uses chrome-launcher (bundled with Lighthouse) instead of Puppeteer
 * to avoid bufferUtil/ws compatibility issues.
 * Graceful fallback if Chrome cannot launch.
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
  const violations: AuditViolation[] = [];
  const nullScores = {
    performance: null,
    accessibility: null,
    seo: null,
    bestPractices: null,
  };

  let server: Server | null = null;
  let chrome: any = null;

  try {
    // Spin up a temporary static file server
    const port = await startStaticServer(projectPath);
    server = (globalThis as any).__auditServer;

    // Use chrome-launcher (comes with lighthouse) instead of puppeteer
    let chromeLauncher: any;
    try {
      chromeLauncher = await import("chrome-launcher");
    } catch {
      return {
        result: {
          tool: "lighthouse",
          category: "seo",
          score: null,
          passed: false,
          violations: [],
          summary:
            "Lighthouse unavailable — chrome-launcher module not found. Install with: pnpm add chrome-launcher",
          timestamp: new Date().toISOString(),
          duration: Date.now() - t0,
        },
        scores: nullScores,
      };
    }

    // Launch Chrome via chrome-launcher
    try {
      chrome = await chromeLauncher.launch({
        chromeFlags: [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
        ],
      });
    } catch (launchErr: any) {
      // Graceful fallback — Chrome is not available
      return {
        result: {
          tool: "lighthouse",
          category: "seo",
          score: null,
          passed: false,
          violations: [],
          summary: `Lighthouse unavailable — headless Chrome could not launch: ${launchErr.message || "Unknown error"}`,
          timestamp: new Date().toISOString(),
          duration: Date.now() - t0,
        },
        scores: nullScores,
      };
    }

    // Run Lighthouse using chrome-launcher's port
    const lighthouse = await import("lighthouse");
    const lhResult = await lighthouse.default(
      `http://localhost:${port}`,
      {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: [
          "performance",
          "accessibility",
          "seo",
          "best-practices",
        ],
      } as any
    );

    if (!lhResult || !lhResult.lhr) {
      throw new Error("Lighthouse returned no results");
    }

    const { lhr } = lhResult;
    const categories = lhr.categories || {};

    const scores = {
      performance:
        categories.performance?.score != null
          ? Math.round(categories.performance.score * 100)
          : null,
      accessibility:
        categories.accessibility?.score != null
          ? Math.round(categories.accessibility.score * 100)
          : null,
      seo:
        categories.seo?.score != null
          ? Math.round(categories.seo.score * 100)
          : null,
      bestPractices:
        categories["best-practices"]?.score != null
          ? Math.round(categories["best-practices"]!.score! * 100)
          : null,
    };

    // Extract failing audits as violations
    const audits = lhr.audits || {};
    for (const [id, audit] of Object.entries<any>(audits)) {
      if (
        audit.score !== null &&
        audit.score < 1 &&
        audit.score !== undefined
      ) {
        if (
          audit.scoreDisplayMode === "binary" ||
          audit.scoreDisplayMode === "numeric"
        ) {
          violations.push({
            rule: id,
            severity:
              audit.score === 0
                ? "error"
                : audit.score < 0.5
                  ? "warning"
                  : "notice",
            message: audit.title || id,
            fix: audit.description
              ? truncate(audit.description, 300)
              : undefined,
          });
        }
      }
    }

    // Determine pass/fail: all scores >= 80
    const allScoreValues = Object.values(scores).filter(
      (s): s is number => s !== null
    );
    const allPassing = allScoreValues.every((s) => s >= 80);
    const belowThreshold = allScoreValues.filter((s) => s < 80).length;

    const summaryParts: string[] = [];
    if (scores.seo !== null) summaryParts.push(`SEO: ${scores.seo}`);
    if (scores.performance !== null)
      summaryParts.push(`Performance: ${scores.performance}`);
    if (scores.accessibility !== null)
      summaryParts.push(`Accessibility: ${scores.accessibility}`);
    if (scores.bestPractices !== null)
      summaryParts.push(`Best Practices: ${scores.bestPractices}`);

    return {
      result: {
        tool: "lighthouse",
        category: "seo",
        score: scores.seo,
        passed: allPassing,
        violations,
        summary: allPassing
          ? `All passing — ${summaryParts.join(", ")}`
          : `${belowThreshold} below threshold — ${summaryParts.join(", ")}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - t0,
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
        summary: `Lighthouse failed: ${err.message || "Unknown error"}. This may be due to headless Chrome issues.`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - t0,
      },
      scores: nullScores,
    };
  } finally {
    // Cleanup
    try {
      if (chrome) await chrome.kill();
    } catch {}
    try {
      if (server) server.close();
    } catch {}
    (globalThis as any).__auditServer = null;
  }
}

/**
 * Start a temporary static file server for the given directory.
 * Returns the port number.
 */
function startStaticServer(projectPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath =
        req.url === "/" ? "/index.html" : req.url || "/index.html";
      const filePath = join(projectPath, urlPath);

      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      try {
        const content = readFileSync(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      } catch {
        res.writeHead(500);
        res.end("Internal server error");
      }
    });

    // Listen on port 0 for a random available port
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr) {
        (globalThis as any).__auditServer = server;
        resolve(addr.port);
      } else {
        reject(new Error("Could not determine server port"));
      }
    });

    server.on("error", reject);
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
