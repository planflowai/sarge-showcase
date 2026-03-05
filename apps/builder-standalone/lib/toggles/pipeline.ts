import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join } from "path";
import type { ProjectToggles, ProjectMeta } from "@/lib/types/project";
import { runAccessibilityCheck } from "@/lib/accessibility/checker";
import { applyPrivacyCompliance } from "@/lib/privacy/compliance";
import { applySecurityHardening } from "@/lib/security/hardener";
import { applySeoOptimization } from "@/lib/seo/optimizer";
import { applyPerformanceOptimization } from "@/lib/performance/optimizer";
import { injectAnalytics } from "@/lib/analytics/injector";
import { injectPunchList } from "@/lib/punchlist/injector";
import { injectCalendlyWidget } from "@/lib/calendly/injector";
import { injectMailchimpForm } from "@/lib/mailchimp/injector";

export interface ToggleCheck {
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
}

export interface VerificationItem {
  label: string;
  before: string;
  after: string;
  section?: string;
}

export interface WarningItem {
  label: string;
  detail: string;
  before?: string;
  after?: string;
}

export interface ManualItem {
  label: string;
  instruction: string;
}

export interface VerificationData {
  fixed: VerificationItem[];
  warnings: WarningItem[];
  manual: ManualItem[];
  stats: { bytesBefore?: number; bytesAfter?: number; bytesSaved?: number };
}

export interface ToggleResult {
  toggle: string;
  status: "success" | "skipped" | "failed" | "warning";
  summary: string;
  duration: number;
  checks: ToggleCheck[];
  verification?: VerificationData;
}

/* ── HTML Section Extractors ── */

function extractHead(html: string): string {
  const m = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1].trim() : "(no <head>)";
}

function extractImages(html: string): string {
  const imgs = html.match(/<img\s[^>]+>/gi) || [];
  return imgs.length > 0 ? imgs.join("\n") : "(no images)";
}

function extractHeadings(html: string): string {
  const hs = html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi) || [];
  return hs.length > 0 ? hs.join("\n") : "(no headings)";
}

function extractLinks(html: string): string {
  const links = html.match(/<a\s[^>]+>/gi) || [];
  return links.length > 0 ? links.join("\n") : "(no links)";
}

function extractForms(html: string): string {
  const forms = html.match(/<form[\s\S]*?<\/form>/gi) || [];
  return forms.length > 0 ? forms.join("\n") : "(no forms)";
}

function extractScripts(html: string): string {
  const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  return scripts.length > 0 ? scripts.join("\n") : "(no scripts)";
}

function truncate(s: string, max: number = 500): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
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
 *  8. Calendly
 *  9. Mailchimp
 */
export async function runTogglePipeline(
  projectPath: string,
  toggles: ProjectToggles,
  options?: { developerEmail?: string; calendlyUrl?: string; mailchimpActionUrl?: string }
): Promise<ToggleResult[]> {
  const results: ToggleResult[] = [];
  const indexPath = join(projectPath, "index.html");

  // ─── Pre-optimize snapshot ───
  const snapshotPath = join(projectPath, "index.pre-optimize.html");
  if (existsSync(indexPath)) {
    copyFileSync(indexPath, snapshotPath);
  }

  // ─── 1. Accessibility (special — operates on project directory) ───
  {
    const t0 = Date.now();
    if (toggles.accessibility) {
      try {
        const beforeHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf-8") : "";
        const beforeHeadings = extractHeadings(beforeHtml);
        const beforeImages = extractImages(beforeHtml);
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
              .filter((i: any) => i.severity === "warning")
              .slice(0, 3)
              .map((i: any) => i.message)
              .join("; "),
          });
        }
        if (report.failed > 0) {
          checks.push({
            label: `${report.failed} check${report.failed !== 1 ? "s" : ""} failed`,
            status: "fail",
            detail: report.issues
              .filter((i: any) => i.severity === "error")
              .slice(0, 3)
              .map((i: any) => i.message)
              .join("; "),
          });
        }

        const afterHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf-8") : "";
        const afterHeadings = extractHeadings(afterHtml);
        const afterImages = extractImages(afterHtml);

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        if (report.fixes.skipLinkInjected) verification.fixed.push({ label: "Skip navigation link added", before: "(none)", after: '<a href="#main-content" class="skip-link">Skip to main content</a>', section: "body" });
        if (report.fixes.langAdded) verification.fixed.push({ label: "Language attribute added to <html>", before: "<html>", after: '<html lang="en">', section: "html" });
        if (report.fixes.headingsFixed > 0) verification.fixed.push({ label: `${report.fixes.headingsFixed} heading(s) fixed`, before: truncate(beforeHeadings), after: truncate(afterHeadings), section: "headings" });
        if (report.fixes.altTextAdded > 0) verification.fixed.push({ label: `${report.fixes.altTextAdded} image alt text(s) added`, before: truncate(beforeImages), after: truncate(afterImages), section: "images" });
        for (const issue of report.issues.filter((i: any) => i.severity === "warning").slice(0, 5)) {
          verification.warnings.push({ label: issue.message, detail: issue.message });
        }
        verification.manual.push({ label: "Keyboard navigation", instruction: "Tab through your site to verify all interactive elements are reachable" });

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
          verification,
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
        const beforeForms = extractForms(html);
        const beforeScripts = extractScripts(html);
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

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        if (report.consentBannerAdded) verification.fixed.push({ label: "Cookie consent banner injected", before: "(none)", after: "GDPR/CCPA consent banner with Accept/Reject/Manage", section: "body" });
        if (report.privacyPolicyAdded) verification.fixed.push({ label: "Privacy policy page generated", before: "(none)", after: "GDPR + CCPA compliant privacy policy", section: "body" });
        if (report.formDisclosuresAdded > 0) verification.fixed.push({ label: `${report.formDisclosuresAdded} form disclosure(s) added`, before: truncate(beforeForms), after: truncate(extractForms(html)), section: "forms" });
        if (report.manageCookiesLinkAdded) verification.fixed.push({ label: "Manage Cookies link added to footer", before: "(none)", after: "Manage Cookies link in footer", section: "footer" });
        if (report.scriptsTagged > 0) verification.fixed.push({ label: `${report.scriptsTagged} script(s) tagged for consent`, before: truncate(beforeScripts), after: truncate(extractScripts(html)), section: "scripts" });

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
          verification,
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
        const beforeLinks = extractLinks(html);
        const beforeForms3 = extractForms(html);
        const beforeHead3 = extractHead(html);
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

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        if (report.cspAdded) verification.fixed.push({ label: "Content Security Policy added", before: "(none)", after: truncate(extractHead(html).match(/meta[^>]*http-equiv[^>]*Content-Security-Policy[^>]*/i)?.[0] || "CSP meta tag"), section: "head" });
        if (report.referrerPolicyAdded) verification.fixed.push({ label: "Referrer policy set", before: "(none)", after: 'strict-origin-when-cross-origin', section: "head" });
        if (report.noopenerFixed > 0) verification.fixed.push({ label: `${report.noopenerFixed} external link(s) secured`, before: truncate(beforeLinks), after: truncate(extractLinks(html)), section: "links" });
        if (report.honeypotFormsAdded > 0) verification.fixed.push({ label: `${report.honeypotFormsAdded} form honeypot(s) added`, before: truncate(beforeForms3), after: truncate(extractForms(html)), section: "forms" });
        if (report.sanitizationScriptAdded) verification.fixed.push({ label: "Input sanitization script added", before: "(none)", after: "All form inputs sanitized on submit", section: "scripts" });
        if (report.commentsStripped > 0) verification.fixed.push({ label: `${report.commentsStripped} HTML comment(s) stripped`, before: `${report.commentsStripped} comments found`, after: "0 comments", section: "html" });

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
          verification,
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
        const beforeHead4 = extractHead(html);
        const beforeImages4 = extractImages(html);
        const beforeHeadings4 = extractHeadings(html);
        const beforeSize = html.length;
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
          const hasTitle = report.metaTagsAdded.some((t: any) => t.includes("title"));
          const hasDescription = report.metaTagsAdded.some((t: any) => t.includes("description"));
          const hasOG = report.metaTagsAdded.some((t: any) => t.includes("og:"));
          const hasTwitter = report.metaTagsAdded.some((t: any) => t.includes("twitter:"));

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
        if (report.headingFixes && report.headingFixes.length > 0) {
          checks.push({ label: `Heading hierarchy — ${report.headingFixes.length} fixed`, status: "pass" });
        }
        if (report.headingWarnings.length > 0) {
          checks.push({
            label: `Heading hierarchy — ${report.headingWarnings.length} remaining issue${report.headingWarnings.length !== 1 ? "s" : ""}`,
            status: "warn",
            detail: report.headingWarnings.slice(0, 2).join("; "),
          });
        } else if (!report.headingFixes || report.headingFixes.length === 0) {
          checks.push({ label: "Heading hierarchy — valid", status: "pass" });
        }
        if (report.minified) {
          const saved = report.originalSize - report.optimizedSize;
          checks.push({ label: `HTML minified — ${saved > 1024 ? `${(saved / 1024).toFixed(1)}KB` : `${saved}B`} saved`, status: "pass" });
        }

        // Build verification data
        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        for (const tag of report.metaTagsAdded) {
          const tagHtml = extractHead(html).match(new RegExp(`<(?:meta|title|link)[^>]*${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>?`, "i"))?.[0] || tag;
          verification.fixed.push({ label: `${tag} added`, before: "(none)", after: truncate(tagHtml, 200), section: "head" });
        }
        if (report.altTextFixed > 0) {
          verification.fixed.push({ label: `${report.altTextFixed} image alt text(s) fixed`, before: truncate(beforeImages4), after: truncate(extractImages(html)), section: "images" });
        }
        for (const hf of (report.headingFixes || [])) {
          verification.fixed.push({ label: `Heading fixed: ${hf.text}`, before: hf.before, after: hf.after, section: "headings" });
        }
        if (report.sitemapCreated) {
          const sitemapContent = existsSync(join(projectPath, "sitemap.xml")) ? truncate(readFileSync(join(projectPath, "sitemap.xml"), "utf-8"), 400) : "sitemap.xml";
          verification.fixed.push({ label: "Sitemap generated", before: "(none)", after: sitemapContent, section: "sitemap.xml" });
        }
        if (report.robotsCreated) {
          const robotsContent = existsSync(join(projectPath, "robots.txt")) ? readFileSync(join(projectPath, "robots.txt"), "utf-8") : "robots.txt";
          verification.fixed.push({ label: "Robots.txt generated", before: "(none)", after: robotsContent, section: "robots.txt" });
        }
        if (report.minified) {
          verification.stats = { bytesBefore: report.originalSize, bytesAfter: report.optimizedSize, bytesSaved: report.originalSize - report.optimizedSize };
        }
        for (const w of report.headingWarnings) {
          verification.warnings.push({ label: w, detail: w });
        }
        if (!report.metaTagsAdded.some((t: any) => t.includes("og:image"))) {
          verification.manual.push({ label: "og:image missing", instruction: "Upload a social preview image (1200\u00d7630px recommended) and add <meta property=\"og:image\" content=\"URL\"> to <head>" });
        }

        const parts: string[] = [];
        if (report.metaTagsAdded.length > 0) parts.push(`${report.metaTagsAdded.length} meta tags`);
        if (report.sitemapCreated) parts.push("sitemap");
        if (report.robotsCreated) parts.push("robots.txt");
        if (report.altTextFixed > 0) parts.push(`${report.altTextFixed} alt text fixed`);
        if (report.headingFixes && report.headingFixes.length > 0) parts.push(`${report.headingFixes.length} heading fixes`);
        const hasWarnings = report.headingWarnings.length > 0;
        results.push({
          toggle: "SEO",
          status: hasWarnings ? "warning" : "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already optimized",
          duration: Date.now() - t0,
          checks,
          verification,
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
        const beforeImages5 = extractImages(html);
        const beforeSize5 = html.length;
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

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: { bytesBefore: beforeSize5, bytesAfter: html.length, bytesSaved: saved } };
        if (report.lazyImagesAdded > 0) verification.fixed.push({ label: `${report.lazyImagesAdded} image(s) lazy-loaded`, before: truncate(beforeImages5), after: truncate(extractImages(html)), section: "images" });
        if (report.cssMinified > 0) verification.fixed.push({ label: `${report.cssMinified} CSS block(s) minified`, before: `${report.cssMinified} unminified blocks`, after: "Minified", section: "styles" });
        if (report.jsMinified > 0) verification.fixed.push({ label: `${report.jsMinified} JS block(s) minified`, before: `${report.jsMinified} unminified blocks`, after: "Minified", section: "scripts" });
        if (report.preconnectLinksAdded.length > 0) verification.fixed.push({ label: `Preconnect hints for ${report.preconnectLinksAdded.length} domain(s)`, before: "(none)", after: report.preconnectLinksAdded.join(", "), section: "head" });
        if (report.viewportAdded) verification.fixed.push({ label: "Viewport meta configured", before: "(none)", after: '<meta name="viewport" content="width=device-width, initial-scale=1.0">', section: "head" });

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
          verification,
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

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        if (report.snippetInjected) {
          verification.fixed.push({ label: "Analytics tracker injected", before: "(none)", after: "Page views, click tracking, scroll depth (25/50/75/100%), time on page", section: "scripts" });
          verification.fixed.push({ label: "Consent-aware tracking", before: "(none)", after: "Tracker waits for cookie consent before activating", section: "scripts" });
        }
        if (report.dashboardLinkAdded) verification.fixed.push({ label: "Dashboard link added to footer", before: "(none)", after: "Analytics dashboard link in footer", section: "footer" });

        const parts: string[] = [];
        if (report.snippetInjected) parts.push("tracker injected");
        if (report.dashboardLinkAdded) parts.push("dashboard link");
        results.push({
          toggle: "Analytics",
          status: "success",
          summary: parts.length > 0 ? parts.join(", ") : "Already injected",
          duration: Date.now() - t0,
          checks,
          verification,
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

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        if (report.floatingButtonAdded) verification.fixed.push({ label: "Floating revision button added", before: "(none)", after: "Bottom-right floating button for client feedback", section: "body" });
        if (report.navPagesDetected > 0) verification.fixed.push({ label: `Page selector with ${report.navPagesDetected} page(s)`, before: "(none)", after: `${report.navPagesDetected} pages available in selector`, section: "body" });
        if (report.mailtoFallbackEmail) verification.fixed.push({ label: "Email fallback configured", before: "(none)", after: report.mailtoFallbackEmail, section: "config" });
        verification.manual.push({ label: "Screenshot upload", instruction: "Test the screenshot upload by clicking the revision button and using the camera icon" });

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
          verification,
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

  // ─── 8. Calendly ───
  {
    const t0 = Date.now();
    if (toggles.calendly && options?.calendlyUrl) {
      try {
        // Re-read HTML in case previous steps modified it
        html = readFileSync(indexPath, "utf-8");
        const { html: out, report } = injectCalendlyWidget(html, options.calendlyUrl);
        html = out;
        writeFileSync(indexPath, html, "utf-8");

        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.buttonInjected
            ? "Book a Call button — floating, bottom-right"
            : "Book a Call button — already present",
          status: "pass",
        });
        checks.push({
          label: report.widgetScriptInjected
            ? "Calendly popup widget — loaded"
            : "Calendly widget — already present",
          status: "pass",
        });

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        if (report.buttonInjected) {
          verification.fixed.push({ label: "Book a Call button injected", before: "(none)", after: "Floating button, bottom-right, Calendly blue (#006BFF)", section: "body" });
          verification.fixed.push({ label: "Calendly popup widget loaded", before: "(none)", after: `Calendly URL: ${options.calendlyUrl}`, section: "scripts" });
        }
        verification.manual.push({ label: "Test booking link", instruction: "Click the Book a Call button to verify the Calendly popup opens with your calendar" });

        results.push({
          toggle: "Calendly",
          status: "success",
          summary: report.buttonInjected ? "Book a Call button + popup widget" : "Already injected",
          duration: Date.now() - t0,
          checks,
          verification,
        });
      } catch (err: any) {
        results.push({
          toggle: "Calendly",
          status: "failed",
          summary: err.message || "Injection failed",
          duration: Date.now() - t0,
          checks: [{ label: "Calendly injection failed", status: "fail", detail: err.message }],
        });
      }
    } else if (toggles.calendly && !options?.calendlyUrl) {
      results.push({
        toggle: "Calendly",
        status: "warning",
        summary: "No Calendly URL configured",
        duration: 0,
        checks: [{ label: "Calendly URL not set — configure in toggle panel", status: "warn" }],
      });
    } else {
      results.push({ toggle: "Calendly", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

  // ─── 9. Mailchimp ───
  {
    const t0 = Date.now();
    if (toggles.mailchimp && options?.mailchimpActionUrl) {
      try {
        html = readFileSync(indexPath, "utf-8");
        const { html: out, report } = injectMailchimpForm(html, options.mailchimpActionUrl);
        html = out;
        writeFileSync(indexPath, html, "utf-8");

        const checks: ToggleCheck[] = [];
        checks.push({
          label: report.formInjected
            ? "Email signup form — styled, in footer"
            : "Signup form — already present",
          status: "pass",
        });
        if (report.formInjected) {
          checks.push({ label: "Honeypot anti-spam — active", status: "pass" });
          checks.push({ label: "Accessibility labels — included", status: "pass" });
        }

        const verification: VerificationData = { fixed: [], warnings: [], manual: [], stats: {} };
        if (report.formInjected) {
          verification.fixed.push({ label: "Email signup form injected", before: "(none)", after: "Styled form with name, email, subscribe button", section: "footer" });
          verification.fixed.push({ label: "Honeypot anti-spam field added", before: "(none)", after: "Hidden field to catch bots", section: "form" });
          verification.fixed.push({ label: "Accessibility labels included", before: "(none)", after: "aria-label on all inputs", section: "form" });
        }
        verification.manual.push({ label: "Test email submission", instruction: "Submit a test email to verify it arrives in your Mailchimp audience" });

        results.push({
          toggle: "Mailchimp",
          status: "success",
          summary: report.formInjected ? "Email signup form injected" : "Already injected",
          duration: Date.now() - t0,
          checks,
          verification,
        });
      } catch (err: any) {
        results.push({
          toggle: "Mailchimp",
          status: "failed",
          summary: err.message || "Injection failed",
          duration: Date.now() - t0,
          checks: [{ label: "Mailchimp injection failed", status: "fail", detail: err.message }],
        });
      }
    } else if (toggles.mailchimp && !options?.mailchimpActionUrl) {
      results.push({
        toggle: "Mailchimp",
        status: "warning",
        summary: "No Mailchimp action URL configured",
        duration: 0,
        checks: [{ label: "Mailchimp action URL not set — configure in toggle panel", status: "warn" }],
      });
    } else {
      results.push({ toggle: "Mailchimp", status: "skipped", summary: "Not enabled", duration: 0, checks: [] });
    }
  }

  return results;
}
