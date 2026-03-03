#!/usr/bin/env node
/**
 * Lighthouse worker — runs in a standalone Node.js process (NOT bundled by webpack).
 *
 * Usage: node lighthouse-worker.mjs <projectPath>
 * Outputs JSON result to stdout.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const MIME_TYPES = {
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

// Common Chrome install locations on Windows
const WINDOWS_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA || ""}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.PROGRAMFILES || ""}\\Google\\Chrome\\Application\\chrome.exe`,
];

function findChromePath() {
  for (const p of WINDOWS_CHROME_PATHS) {
    try { if (p && existsSync(p)) return p; } catch {}
  }
  if (process.env.CHROME_PATH) {
    try { if (existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH; } catch {}
  }
  return undefined;
}

function startStaticServer(projectPath) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath = req.url === "/" ? "/index.html" : req.url || "/index.html";
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
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr) {
        resolve({ server, port: addr.port });
      } else {
        reject(new Error("Could not determine server port"));
      }
    });
    server.on("error", reject);
  });
}

async function main() {
  const projectPath = process.argv[2];
  if (!projectPath) {
    console.log(JSON.stringify({ error: "No projectPath provided" }));
    process.exit(1);
  }

  const t0 = Date.now();
  let server = null;
  let chrome = null;

  try {
    // Find Chrome
    const chromePath = findChromePath();
    if (!chromePath) {
      console.log(JSON.stringify({
        error: null,
        scores: { performance: null, accessibility: null, seo: null, bestPractices: null },
        summary: "Chrome not found — install Google Chrome to enable Lighthouse audits",
        violations: [],
        duration: Date.now() - t0,
      }));
      return;
    }

    // Start static server
    const srv = await startStaticServer(projectPath);
    server = srv.server;
    const port = srv.port;

    // Launch Chrome
    const chromeLauncher = await import("chrome-launcher");
    const launchFn = chromeLauncher.launch || chromeLauncher.default?.launch;
    if (typeof launchFn !== "function") {
      console.log(JSON.stringify({
        error: null,
        scores: { performance: null, accessibility: null, seo: null, bestPractices: null },
        summary: "chrome-launcher.launch is not a function",
        violations: [],
        duration: Date.now() - t0,
      }));
      return;
    }

    chrome = await launchFn({
      chromePath,
      chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });

    // Run Lighthouse
    const lighthouse = await import("lighthouse");
    const lhRun = lighthouse.default || lighthouse;

    const lhResult = await lhRun(
      `http://localhost:${port}`,
      {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
      }
    );

    if (!lhResult || !lhResult.lhr) {
      throw new Error("Lighthouse returned no results");
    }

    const { lhr } = lhResult;
    const categories = lhr.categories || {};

    const scores = {
      performance: categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null,
      accessibility: categories.accessibility?.score != null ? Math.round(categories.accessibility.score * 100) : null,
      seo: categories.seo?.score != null ? Math.round(categories.seo.score * 100) : null,
      bestPractices: categories["best-practices"]?.score != null ? Math.round(categories["best-practices"].score * 100) : null,
    };

    // Extract failing audits as violations
    const violations = [];
    const audits = lhr.audits || {};
    for (const [id, audit] of Object.entries(audits)) {
      if (audit.score !== null && audit.score < 1 && audit.score !== undefined) {
        if (audit.scoreDisplayMode === "binary" || audit.scoreDisplayMode === "numeric") {
          violations.push({
            rule: id,
            severity: audit.score === 0 ? "error" : audit.score < 0.5 ? "warning" : "notice",
            message: audit.title || id,
            fix: audit.description ? audit.description.slice(0, 300) : undefined,
          });
        }
      }
    }

    const allScoreValues = Object.values(scores).filter(s => s !== null);
    const allPassing = allScoreValues.every(s => s >= 80);
    const belowThreshold = allScoreValues.filter(s => s < 80).length;

    const summaryParts = [];
    if (scores.seo !== null) summaryParts.push(`SEO: ${scores.seo}`);
    if (scores.performance !== null) summaryParts.push(`Performance: ${scores.performance}`);
    if (scores.accessibility !== null) summaryParts.push(`Accessibility: ${scores.accessibility}`);
    if (scores.bestPractices !== null) summaryParts.push(`Best Practices: ${scores.bestPractices}`);

    console.log(JSON.stringify({
      error: null,
      scores,
      violations,
      summary: allPassing
        ? `All passing — ${summaryParts.join(", ")}`
        : `${belowThreshold} below threshold — ${summaryParts.join(", ")}`,
      passed: allPassing,
      duration: Date.now() - t0,
    }));
  } catch (err) {
    console.log(JSON.stringify({
      error: err.message || "Unknown error",
      scores: { performance: null, accessibility: null, seo: null, bestPractices: null },
      summary: `Lighthouse failed: ${err.message || "Unknown error"}`,
      violations: [],
      duration: Date.now() - t0,
    }));
  } finally {
    try { if (chrome) await chrome.kill(); } catch {}
    try { if (server) server.close(); } catch {}
    process.exit(0);
  }
}

main();
