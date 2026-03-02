import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { ProjectToggles, ProjectMeta } from "@/lib/types/project";
import { runAccessibilityCheck } from "@/lib/accessibility/checker";
import { applyPrivacyCompliance } from "@/lib/privacy/compliance";
import { applySecurityHardening } from "@/lib/security/hardener";
import { applySeoOptimization } from "@/lib/seo/optimizer";
import { applyPerformanceOptimization } from "@/lib/performance/optimizer";
import { injectAnalytics } from "@/lib/analytics/injector";
import { injectPunchList } from "@/lib/punchlist/injector";

export interface ToggleResult {
  toggle: string;
  status: "success" | "skipped" | "failed";
  details: string;
  duration: number;
}

/**
 * Ordered toggle pipeline. Runs each enabled toggle in sequence,
 * chaining HTML output from one step to the next.
 *
 * Order:
 *  1. Accessibility (reads/writes its own files)
 *  2. Privacy
 *  3. Security
 *  4. SEO
 *  5. Performance
 *  6. Analytics
 *  7. Punch List
 */
export async function runTogglePipeline(
  projectPath: string,
  toggles: ProjectToggles,
  options?: { developerEmail?: string }
): Promise<ToggleResult[]> {
  const results: ToggleResult[] = [];
  const indexPath = join(projectPath, "index.html");

  // ─── 1. Accessibility (special — operates on project directory) ───
  {
    const t0 = Date.now();
    if (toggles.accessibility) {
      try {
        const report = await runAccessibilityCheck(projectPath);
        const fixCount =
          report.fixes.headingsFixed +
          report.fixes.altTextAdded +
          (report.fixes.skipLinkInjected ? 1 : 0) +
          (report.fixes.langAdded ? 1 : 0);
        results.push({
          toggle: "Accessibility",
          status: "success",
          details:
            fixCount > 0
              ? `${fixCount} fix${fixCount !== 1 ? "es" : ""} applied, ${report.passed} passed, ${report.warnings} warning${report.warnings !== 1 ? "s" : ""}`
              : `${report.passed} passed, ${report.warnings} warning${report.warnings !== 1 ? "s" : ""}`,
          duration: Date.now() - t0,
        });
      } catch (err: any) {
        results.push({
          toggle: "Accessibility",
          status: "failed",
          details: err.message || "Check failed",
          duration: Date.now() - t0,
        });
      }
    } else {
      results.push({
        toggle: "Accessibility",
        status: "skipped",
        details: "Not enabled",
        duration: 0,
      });
    }
  }

  // For the remaining toggles, we read HTML, process, and write back.
  // If index.html doesn't exist, skip all HTML-based toggles.
  if (!existsSync(indexPath)) {
    const htmlToggles = ["Privacy", "Security", "SEO", "Performance", "Analytics", "Punch List"];
    for (const name of htmlToggles) {
      results.push({
        toggle: name,
        status: "skipped",
        details: "No index.html found",
        duration: 0,
      });
    }
    return results;
  }

  // Read current HTML (may have been modified by accessibility pass)
  let html = readFileSync(indexPath, "utf-8");

  // Helper: run an HTML transform toggle
  function runHtmlToggle(
    name: string,
    enabled: boolean,
    transform: (h: string) => { html: string; summary: string }
  ) {
    const t0 = Date.now();
    if (!enabled) {
      results.push({ toggle: name, status: "skipped", details: "Not enabled", duration: 0 });
      return;
    }
    try {
      const result = transform(html);
      html = result.html;
      // Write intermediate result so each step chains
      writeFileSync(indexPath, html, "utf-8");
      results.push({
        toggle: name,
        status: "success",
        details: result.summary,
        duration: Date.now() - t0,
      });
    } catch (err: any) {
      results.push({
        toggle: name,
        status: "failed",
        details: err.message || "Processing failed",
        duration: Date.now() - t0,
      });
    }
  }

  // ─── 2. Privacy ───
  runHtmlToggle("Privacy", toggles.privacy, (h) => {
    const { html: out, report } = applyPrivacyCompliance(h);
    const parts: string[] = [];
    if (report.consentBannerAdded) parts.push("consent banner");
    if (report.privacyPolicyAdded) parts.push("privacy policy");
    if (report.formDisclosuresAdded > 0) parts.push(`${report.formDisclosuresAdded} form disclosure${report.formDisclosuresAdded !== 1 ? "s" : ""}`);
    if (report.scriptsTagged > 0) parts.push(`${report.scriptsTagged} script${report.scriptsTagged !== 1 ? "s" : ""} tagged`);
    if (report.manageCookiesLinkAdded) parts.push("manage cookies link");
    return { html: out, summary: parts.length > 0 ? parts.join(", ") : "Already compliant" };
  });

  // ─── 3. Security ───
  runHtmlToggle("Security", toggles.security, (h) => {
    const { html: out, report } = applySecurityHardening(h);
    const parts: string[] = [];
    if (report.cspAdded) parts.push("CSP added");
    if (report.nosniffAdded) parts.push("nosniff");
    if (report.referrerPolicyAdded) parts.push("referrer policy");
    if (report.noopenerFixed > 0) parts.push(`${report.noopenerFixed} link${report.noopenerFixed !== 1 ? "s" : ""} hardened`);
    if (report.honeypotFormsAdded > 0) parts.push(`${report.honeypotFormsAdded} honeypot${report.honeypotFormsAdded !== 1 ? "s" : ""}`);
    if (report.sanitizationScriptAdded) parts.push("input sanitizer");
    if (report.commentsStripped > 0) parts.push(`${report.commentsStripped} comment${report.commentsStripped !== 1 ? "s" : ""} stripped`);
    return { html: out, summary: parts.length > 0 ? parts.join(", ") : "Already hardened" };
  });

  // ─── 4. SEO (special — reads/writes to disk, needs ProjectMeta) ───
  {
    const t0 = Date.now();
    if (toggles.seo) {
      try {
        // Write current HTML so SEO optimizer reads the chained version
        writeFileSync(indexPath, html, "utf-8");

        // Read project.json for meta info
        const metaPath = join(projectPath, "project.json");
        let meta: ProjectMeta | null = null;
        if (existsSync(metaPath)) {
          try { meta = JSON.parse(readFileSync(metaPath, "utf-8")); } catch { /* ignore */ }
        }

        // SEO optimizer needs ProjectMeta — use real or minimal fallback
        const projectMeta: ProjectMeta = meta || {
          name: "project",
          clientName: "",
          clientEmail: "",
          domain: "",
          createdAt: new Date().toISOString(),
          toggles: toggles,
          deployUrls: { github: "", vercel: "", netlify: "", cloudflare: "" },
          revisions: { round: 1, maxRounds: 3, items: [] },
        };

        const report = applySeoOptimization(projectPath, projectMeta);

        // Re-read HTML from disk (SEO optimizer wrote its changes)
        html = readFileSync(indexPath, "utf-8");

        const parts: string[] = [];
        if (report.metaTagsAdded.length > 0) parts.push(`${report.metaTagsAdded.length} meta tag${report.metaTagsAdded.length !== 1 ? "s" : ""}`);
        if (report.sitemapCreated) parts.push("sitemap");
        if (report.robotsCreated) parts.push("robots.txt");
        if (report.altTextFixed > 0) parts.push(`${report.altTextFixed} alt text fixed`);
        if (report.minified) parts.push("minified");
        results.push({
          toggle: "SEO",
          status: "success",
          details: parts.length > 0 ? parts.join(", ") : "Already optimized",
          duration: Date.now() - t0,
        });
      } catch (err: any) {
        results.push({
          toggle: "SEO",
          status: "failed",
          details: err.message || "Optimization failed",
          duration: Date.now() - t0,
        });
      }
    } else {
      results.push({ toggle: "SEO", status: "skipped", details: "Not enabled", duration: 0 });
    }
  }

  // ─── 5. Performance ───
  runHtmlToggle("Performance", toggles.performance, (h) => {
    const { html: out, report } = applyPerformanceOptimization(h);
    const parts: string[] = [];
    if (report.cssMinified > 0) parts.push(`${report.cssMinified} CSS minified`);
    if (report.jsMinified > 0) parts.push(`${report.jsMinified} JS minified`);
    if (report.lazyImagesAdded > 0) parts.push(`${report.lazyImagesAdded} lazy image${report.lazyImagesAdded !== 1 ? "s" : ""}`);
    if (report.preconnectLinksAdded.length > 0) parts.push(`${report.preconnectLinksAdded.length} preconnect hint${report.preconnectLinksAdded.length !== 1 ? "s" : ""}`);
    if (report.viewportAdded) parts.push("viewport");
    const saved = report.originalSize - report.optimizedSize;
    if (saved > 0) parts.push(`${saved}B saved`);
    return { html: out, summary: parts.length > 0 ? parts.join(", ") : "Already optimized" };
  });

  // ─── 6. Analytics ───
  runHtmlToggle("Analytics", toggles.analytics, (h) => {
    const { html: out, report } = injectAnalytics(h);
    const parts: string[] = [];
    if (report.snippetInjected) parts.push("tracker injected");
    if (report.dashboardLinkAdded) parts.push("dashboard link");
    return { html: out, summary: parts.length > 0 ? parts.join(", ") : "Already injected" };
  });

  // ─── 7. Punch List ───
  runHtmlToggle("Punch List", toggles.punchList, (h) => {
    const { html: out, report } = injectPunchList(h, {
      developerEmail: options?.developerEmail || "",
    });
    const parts: string[] = [];
    if (report.floatingButtonAdded) parts.push("revision form");
    if (report.navPagesDetected > 0) parts.push(`${report.navPagesDetected} page${report.navPagesDetected !== 1 ? "s" : ""} detected`);
    if (report.mailtoFallbackEmail) parts.push("mailto fallback");
    return { html: out, summary: parts.length > 0 ? parts.join(", ") : "Already injected" };
  });

  return results;
}
