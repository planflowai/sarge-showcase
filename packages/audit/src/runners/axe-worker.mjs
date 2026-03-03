#!/usr/bin/env node
/**
 * axe-core worker — runs in a standalone Node.js process (NOT bundled by webpack).
 *
 * Usage: node axe-worker.mjs <path-to-html-file>
 * Reads the HTML file, runs axe-core against it using JSDOM, outputs JSON to stdout.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

function mapImpact(impact) {
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

async function main() {
  const projectPath = process.argv[2];
  if (!projectPath) {
    console.log(JSON.stringify({ error: "No project path provided" }));
    process.exit(1);
  }

  const t0 = Date.now();

  try {
    // Read index.html from the project directory
    const htmlPath = join(projectPath, "index.html");
    if (!existsSync(htmlPath)) {
      console.log(JSON.stringify({
        error: `index.html not found at ${htmlPath}`,
        score: null, passed: false, violations: [],
        summary: `index.html not found at ${htmlPath}`,
        duration: Date.now() - t0,
      }));
      process.exit(0);
    }
    const html = readFileSync(htmlPath, "utf-8");

    // Create JSDOM — no pretendToBeVisual, no runScripts
    const dom = new JSDOM(html, { url: "http://localhost" });
    const win = dom.window;

    // Patch globals — axe-core needs window/document on global
    global.window = win;
    global.document = win.document;
    global.Node = win.Node;
    global.HTMLElement = win.HTMLElement;
    global.SVGElement = win.SVGElement;
    global.Element = win.Element;
    global.DocumentFragment = win.DocumentFragment;

    // Mock Image to avoid Canvas.Image errors
    if (typeof win.Image === "undefined" || true) {
      win.Image = class MockImage {
        constructor(w, h) { this.width = w || 0; this.height = h || 0; }
        src = "";
        alt = "";
        naturalWidth = 1;
        naturalHeight = 1;
        complete = true;
        addEventListener() {}
        removeEventListener() {}
      };
      global.Image = win.Image;
    }

    // Mock canvas getContext to avoid canvas dependency
    if (win.HTMLCanvasElement?.prototype) {
      win.HTMLCanvasElement.prototype.getContext = () => null;
    }

    // Import and run axe-core
    const axeModule = await import("axe-core");
    const axe = axeModule.default || axeModule;

    if (typeof axe.run !== "function") {
      throw new Error("axe-core loaded but axe.run is not a function");
    }

    const axeResults = await axe.run(win.document.documentElement, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });

    // Map violations
    const violations = [];
    for (const v of axeResults.violations || []) {
      const severity = mapImpact(v.impact);
      const wcagTags = (v.tags || [])
        .filter(t => t.startsWith("wcag"))
        .join(", ");
      const firstNode = v.nodes?.[0] || null;

      violations.push({
        rule: v.id,
        severity,
        message: v.description,
        element: firstNode?.html ? firstNode.html.slice(0, 200) : undefined,
        wcag: wcagTags || undefined,
        fix: v.help,
      });
    }

    // Calculate score
    const passCount = (axeResults.passes || []).length;
    const violationCount = (axeResults.violations || []).length;
    const total = passCount + violationCount;
    const score = total > 0 ? Math.round((passCount / total) * 100) : 100;
    const errorCount = violations.filter(v => v.severity === "error").length;

    console.log(JSON.stringify({
      error: null,
      score,
      passed: errorCount === 0,
      violations,
      summary: errorCount === 0
        ? `WCAG 2.1 AA — 0 violations (score: ${score}/100)`
        : `${violations.length} violations found (score: ${score}/100)`,
      duration: Date.now() - t0,
    }));

    // Cleanup
    try { dom.window.close(); } catch {}
  } catch (err) {
    console.log(JSON.stringify({
      error: err.message || "Unknown error",
      score: null,
      passed: false,
      violations: [],
      summary: `axe-core failed: ${err.message || "Unknown error"}`,
      duration: Date.now() - t0,
    }));
  }

  process.exit(0);
}

main();
