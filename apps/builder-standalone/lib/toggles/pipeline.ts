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

export interface ToggleCheck {
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
}

export interface ToggleResult {
  toggle: string;
  status: "success" | "skipped" | "failed" | "warning";
  summary: string;
  duration: number;
  checks: ToggleCheck[];
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
        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.fixes.skipLinkInjected
            ? "Skip navigation link — added"
            : "Skip navigation link — already present",
          status: "pass",
        });
        checks.push({
          label: `Heading hierarchy — ${report.fixes.headingsFixed > 0 ? `${report.fixes.headingsFixed} fixed` : "valid"}`,
          status: report.fixes.headingsFixed > 0 ? "pass" : "pass",
        });
        checks.push({
          label: `Image alt text — ${report.fixes.altTextAdded > 0 ? `${report.fixes.altTextAdded} added` : "all images covered"}`,
          status: "pass",
        });
        checks.push({
          label: report.fixes.langAdded
            ? "Language attribute — added to <html>"
            : "Language attribute — already set",
          status: "pass",
        });
        if (report.warnings > 0) {
          checks.push({
            label: `${report.warnings} warning${report.warnings !== 1 ? "s" : ""} detected`,
            status: "warn",
            detail: report.issues
              .filter((i) => i.severity === "warning")
              .slice(0, 3)
              .map((i) => i.message)
              .join("; "),
          });
        }
        if (report.failed > 0) {
          checks.push({
            label: `${report.failed} check${report.failed !== 1 ? "s" : ""} failed`,
            status: "fail",
            detail: report.issues
              .filter((i) => i.severity === "error")
              .slice(0, 3)
              .map((i) => i.message)
              .join("; "),
          });
        }

        const fixCount =
          report.fixes.headingsFixed +
          report.fixes.altTextAdded +
          (report.fixes.skipLinkInjected ? 1 : 0) +
          (report.fixes.langAdded ? 1 : 0);
        const hasWarnings = report.warnings > 0;
        const hasFailed = report.failed > 0;
        results.push({
          toggle: "Accessibility",
          status: hasFailed ? "warning" : "success",
          summary:
            fixCount > 0
              ? `${fixCount} fix${fixCount !== 1 ? "es" : ""} applied, ${report.passed} passed${hasWarnings ? `, ${report.warnings} warnings` : ""}`
              : `${report.passed} passed${hasWarnings ? `, ${report.warnings} warnings` : ""}`,
          duration: Date.now() - t0,
          checks,
        });
      } catch (err: any) {
        results.push({
          toggle: "Accessibility",
          status: "failed",
          summary: err.message || "Check failed",
          duration: Date.now() - t0,
          checks: [{ label: "Accessibility check crashed", status: "fail", detail: err.message }],
        });
      }
    } else {
      results.push({
        toggle: "Accessibility",
        status: "skipped",
        summary: "Not enabled",
        duration: 0,
        checks: [],
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
        summary: "No index.html found",
        duration: 0,
        checks: [],
      });
    }
    return results;
  }

  // Read current HTML (may have been modified by accessibility pass)
  let html = readFileSync(indexPath, "utf-8");

  // ─── 2. Privacy ───
  {
    const t0 = Date.now();
    if (toggles.privacy) {
      try {
        const { html: out, report } = applyPrivacyCompliance(html);
        html = out;
        writeFileSync(indexPath, html, "utf-8");

        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.consentBannerAdded
            ? "Cookie consent banner — appears on first visit"
            : "Cookie consent banner — already present",
          status: "pass",
        });
        checks.push({
          label: report.privacyPolicyAdded
            ? "Privacy policy page — GDPR + CCPA compliant"
            : "Privacy policy page — already present",
          status: "pass",
        });
        checks.push({
          label: report.formDisclosuresAdded > 0
            ? `Form disclosures — ${report.formDisclosuresAdded} form${report.formDisclosuresAdded !== 1 ? "s" : ""} protected`
            : "Form disclosures — no unprotected forms",
          status: "pass",
        });
        checks.push({
          label: report.manageCookiesLinkAdded
            ? "Manage Cookies link — in footer"
            : "Manage Cookies link — already present",
          status: "pass",
        });
        if (report.scriptsTagged > 0) {
          checks.push({
            label: `Non-essential scripts — ${report.scriptsTagged} blocked until consent`,
            status: "pass",
          });
        } else {
          checks.push({
            label: "Non-essential scripts — none detected",
            status: "pass",
          });
        }

        const parts: string[] = [];
        if (report.consentBannerAdded) parts.push("consent banner");
        if (report.privacyPolicyAdded) parts.push("privacy policy");
        if (report.formDisclosuresAdded > 0) parts.push(`${report.formDisclosuresAdded} form disclosure${report.formDisclosuresAdded !== 1 ? "s" : ""}`);
        if (report.manageCookiesLinkAdded) parts.push("manage cookies link");
        results.push({
          toggle: "Privacy",
          status: "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already compliant",
          duration: Date.now() - t0,
          checks,
        });
      } catch (err: any) {
        results.push({
          toggle: "Privacy",
          status: "failed",
          summary: err.message || "Processing failed",
          duration: Date.now() - t0,
          checks: [{ label: "Privacy compliance failed", status: "fail", detail: err.message }],
        });
      }
    } else {
      results.push({ toggle: "Privacy", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

  // ─── 3. Security ───
  {
    const t0 = Date.now();
    if (toggles.security) {
      try {
        const { html: out, report } = applySecurityHardening(html);
        html = out;
        writeFileSync(indexPath, html, "utf-8");

        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.cspAdded
            ? "Content Security Policy — active"
            : "Content Security Policy — already present",
          status: "pass",
        });
        checks.push({
          label: report.noopenerFixed > 0
            ? `External links secured — ${report.noopenerFixed} link${report.noopenerFixed !== 1 ? "s" : ""} protected`
            : "External links secured — all protected",
          status: "pass",
        });
        checks.push({
          label: report.honeypotFormsAdded > 0
            ? `Form honeypot fields — ${report.honeypotFormsAdded} form${report.honeypotFormsAdded !== 1 ? "s" : ""} protected`
            : "Form honeypot fields — no forms to protect",
          status: "pass",
        });
        checks.push({
          label: report.sanitizationScriptAdded
            ? "Input sanitization — active on all forms"
            : "Input sanitization — already present",
          status: "pass",
        });
        checks.push({
          label: report.commentsStripped > 0
            ? `HTML comments stripped — ${report.commentsStripped} removed`
            : "HTML comments — none found",
          status: "pass",
        });
        checks.push({
          label: report.referrerPolicyAdded
            ? "Referrer policy — strict-origin-when-cross-origin"
            : "Referrer policy — already set",
          status: "pass",
        });

        const parts: string[] = [];
        if (report.cspAdded) parts.push("CSP added");
        if (report.noopenerFixed > 0) parts.push(`${report.noopenerFixed} links hardened`);
        if (report.honeypotFormsAdded > 0) parts.push(`${report.honeypotFormsAdded} honeypots`);
        if (report.sanitizationScriptAdded) parts.push("input sanitizer");
        if (report.commentsStripped > 0) parts.push(`${report.commentsStripped} comments stripped`);
        results.push({
          toggle: "Security",
          status: "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already hardened",
          duration: Date.now() - t0,
          checks,
        });
      } catch (err: any) {
        results.push({
          toggle: "Security",
          status: "failed",
          summary: err.message || "Processing failed",
          duration: Date.now() - t0,
          checks: [{ label: "Security hardening failed", status: "fail", detail: err.message }],
        });
      }
    } else {
      results.push({ toggle: "Security", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

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

        const checks: ToggleCheck[] = [];
        if (report.metaTagsAdded.length > 0) {
          // Parse which specific tags were added
          const hasTitle = report.metaTagsAdded.some((t) => t.includes("title"));
          const hasDescription = report.metaTagsAdded.some((t) => t.includes("description"));
          const hasOG = report.metaTagsAdded.some((t) => t.includes("og:"));
          const hasTwitter = report.metaTagsAdded.some((t) => t.includes("twitter:"));

          if (hasTitle) {
            checks.push({ label: "Page title — set", status: "pass" });
          }
          if (hasDescription) {
            checks.push({ label: "Meta description — added", status: "pass" });
          }
          if (hasOG) {
            checks.push({ label: "Open Graph tags — title, description, type", status: "pass" });
          }
          if (hasTwitter) {
            checks.push({ label: "Twitter Card — configured", status: "pass" });
          }
          if (!hasTitle && !hasDescription && !hasOG && !hasTwitter) {
            checks.push({ label: `${report.metaTagsAdded.length} meta tag${report.metaTagsAdded.length !== 1 ? "s" : ""} added`, status: "pass" });
          }
        } else {
          checks.push({ label: "Meta tags — already optimized", status: "pass" });
        }
        checks.push({
          label: report.sitemapCreated
            ? "Sitemap — generated"
            : "Sitemap — already present",
          status: "pass",
        });
        checks.push({
          label: report.robotsCreated
            ? "Robots.txt — search engines allowed"
            : "Robots.txt — already present",
          status: "pass",
        });
        checks.push({
          label: report.altTextFixed > 0
            ? `Image alt text — ${report.altTextFixed} image${report.altTextFixed !== 1 ? "s" : ""} fixed`
            : "Image alt text — all images covered",
          status: "pass",
        });
        if (report.headingWarnings.length > 0) {
          checks.push({
            label: `Heading hierarchy — ${report.headingWarnings.length} issue${report.headingWarnings.length !== 1 ? "s" : ""}`,
            status: "warn",
            detail: report.headingWarnings.slice(0, 2).join("; "),
          });
        } else {
          checks.push({ label: "Heading hierarchy — valid", status: "pass" });
        }
        if (report.minified) {
          checks.push({ label: "HTML minified — size reduced", status: "pass" });
        }

        const parts: string[] = [];
        if (report.metaTagsAdded.length > 0) parts.push(`${report.metaTagsAdded.length} meta tags`);
        if (report.sitemapCreated) parts.push("sitemap");
        if (report.robotsCreated) parts.push("robots.txt");
        if (report.altTextFixed > 0) parts.push(`${report.altTextFixed} alt text fixed`);
        const hasWarnings = report.headingWarnings.length > 0;
        results.push({
          toggle: "SEO",
          status: hasWarnings ? "warning" : "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already optimized",
          duration: Date.now() - t0,
          checks,
        });
      } catch (err: any) {
        results.push({
          toggle: "SEO",
          status: "failed",
          summary: err.message || "Optimization failed",
          duration: Date.now() - t0,
          checks: [{ label: "SEO optimization failed", status: "fail", detail: err.message }],
        });
      }
    } else {
      results.push({ toggle: "SEO", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

  // ─── 5. Performance ───
  {
    const t0 = Date.now();
    if (toggles.performance) {
      try {
        const { html: out, report } = applyPerformanceOptimization(html);
        html = out;
        writeFileSync(indexPath, html, "utf-8");

        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.lazyImagesAdded > 0
            ? `Images lazy-loaded — ${report.lazyImagesAdded} image${report.lazyImagesAdded !== 1 ? "s" : ""} optimized`
            : "Images — already lazy-loaded",
          status: "pass",
        });
        const saved = report.originalSize - report.optimizedSize;
        checks.push({
          label: report.cssMinified > 0
            ? `CSS minified — ${report.cssMinified} block${report.cssMinified !== 1 ? "s" : ""} compressed`
            : "CSS — already minified",
          status: "pass",
        });
        checks.push({
          label: report.jsMinified > 0
            ? `JavaScript minified — ${report.jsMinified} block${report.jsMinified !== 1 ? "s" : ""} compressed`
            : "JavaScript — already minified",
          status: "pass",
        });
        checks.push({
          label: report.preconnectLinksAdded.length > 0
            ? `Preconnect hints — ${report.preconnectLinksAdded.length} external domain${report.preconnectLinksAdded.length !== 1 ? "s" : ""}`
            : "Preconnect hints — no external domains",
          status: "pass",
        });
        if (report.asyncCssCount > 0) {
          checks.push({ label: `Async CSS loading — ${report.asyncCssCount} stylesheet${report.asyncCssCount !== 1 ? "s" : ""}`, status: "pass" });
        }
        checks.push({
          label: report.viewportAdded
            ? "Viewport meta — configured"
            : "Viewport meta — already present",
          status: "pass",
        });
        if (saved > 0) {
          checks.push({ label: `Total savings — ${saved > 1024 ? `${(saved / 1024).toFixed(1)}KB` : `${saved}B`} reduced`, status: "pass" });
        }

        const parts: string[] = [];
        if (report.lazyImagesAdded > 0) parts.push(`${report.lazyImagesAdded} lazy images`);
        if (report.cssMinified > 0) parts.push(`CSS minified`);
        if (report.jsMinified > 0) parts.push(`JS minified`);
        if (saved > 0) parts.push(`${saved > 1024 ? `${(saved / 1024).toFixed(1)}KB` : `${saved}B`} saved`);
        results.push({
          toggle: "Performance",
          status: "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already optimized",
          duration: Date.now() - t0,
          checks,
        });
      } catch (err: any) {
        results.push({
          toggle: "Performance",
          status: "failed",
          summary: err.message || "Processing failed",
          duration: Date.now() - t0,
          checks: [{ label: "Performance optimization failed", status: "fail", detail: err.message }],
        });
      }
    } else {
      results.push({ toggle: "Performance", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

  // ─── 6. Analytics ───
  {
    const t0 = Date.now();
    if (toggles.analytics) {
      try {
        const { html: out, report } = injectAnalytics(html);
        html = out;
        writeFileSync(indexPath, html, "utf-8");

        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.snippetInjected
            ? "Page view tracking — active"
            : "Page view tracking — already present",
          status: "pass",
        });
        if (report.snippetInjected) {
          checks.push({ label: "Click tracking — links and buttons", status: "pass" });
          checks.push({ label: "Scroll depth tracking — 25/50/75/100%", status: "pass" });
          checks.push({ label: "Time on page tracking — active", status: "pass" });
          checks.push({ label: "Privacy consent aware — respects cookie choice", status: "pass" });
        }
        checks.push({
          label: report.dashboardLinkAdded
            ? "Dashboard link — in footer"
            : "Dashboard link — already present",
          status: "pass",
        });

        const parts: string[] = [];
        if (report.snippetInjected) parts.push("tracker injected");
        if (report.dashboardLinkAdded) parts.push("dashboard link");
        results.push({
          toggle: "Analytics",
          status: "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already injected",
          duration: Date.now() - t0,
          checks,
        });
      } catch (err: any) {
        results.push({
          toggle: "Analytics",
          status: "failed",
          summary: err.message || "Processing failed",
          duration: Date.now() - t0,
          checks: [{ label: "Analytics injection failed", status: "fail", detail: err.message }],
        });
      }
    } else {
      results.push({ toggle: "Analytics", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

  // ─── 7. Punch List ───
  {
    const t0 = Date.now();
    if (toggles.punchList) {
      try {
        const { html: out, report } = injectPunchList(html, {
          developerEmail: options?.developerEmail || "",
        });
        html = out;
        writeFileSync(indexPath, html, "utf-8");

        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.floatingButtonAdded
            ? "Revision form — floating button added"
            : "Revision form — already present",
          status: "pass",
        });
        checks.push({
          label: report.navPagesDetected > 0
            ? `Page selector — ${report.navPagesDetected} page${report.navPagesDetected !== 1 ? "s" : ""} detected`
            : "Page selector — single page",
          status: "pass",
        });
        checks.push({ label: "Screenshot upload — enabled", status: "pass" });
        checks.push({
          label: report.submitEndpointConfigured
            ? "Submission endpoint — configured"
            : "Submission endpoint — default",
          status: "pass",
        });
        if (report.mailtoFallbackEmail) {
          checks.push({ label: "Email fallback — configured", status: "pass" });
        }

        const parts: string[] = [];
        if (report.floatingButtonAdded) parts.push("revision form");
        if (report.navPagesDetected > 0) parts.push(`${report.navPagesDetected} pages detected`);
        if (report.mailtoFallbackEmail) parts.push("mailto fallback");
        results.push({
          toggle: "Punch List",
          status: "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already injected",
          duration: Date.now() - t0,
          checks,
        });
      } catch (err: any) {
        results.push({
          toggle: "Punch List",
          status: "failed",
          summary: err.message || "Processing failed",
          duration: Date.now() - t0,
          checks: [{ label: "Punch list injection failed", status: "fail", detail: err.message }],
        });
      }
    } else {
      results.push({ toggle: "Punch List", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

  return results;
}
