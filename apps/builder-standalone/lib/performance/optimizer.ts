import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface PerformanceReport {
  cssMinified: number;
  jsMinified: number;
  lazyImagesAdded: number;
  asyncDecodingAdded: number;
  preconnectLinksAdded: string[];
  viewportAdded: boolean;
  asyncCssCount: number;
  originalSize: number;
  optimizedSize: number;
}

// ─── CSS minification (inline <style> blocks) ───

function minifyInlineCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")   // remove comments
    .replace(/\s*([{}:;,>~+])\s*/g, "$1") // collapse around symbols
    .replace(/;\s*}/g, "}")              // remove trailing semicolons
    .replace(/\s+/g, " ")               // collapse whitespace
    .trim();
}

// ─── JS minification (inline <script> blocks) ───

function minifyInlineJs(js: string): string {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, "")           // remove block comments
    .replace(/(?<![:"'])\/\/(?![\/\*]).*$/gm, "") // remove line comments (avoid URLs)
    .replace(/^\s+/gm, "")                       // remove leading whitespace
    .replace(/\n\s*\n/g, "\n")                   // collapse blank lines
    .trim();
}

// ─── Extract external domains from HTML ───

const KNOWN_PRECONNECT_DOMAINS: Record<string, string> = {
  "fonts.googleapis.com": "https://fonts.googleapis.com",
  "fonts.gstatic.com": "https://fonts.gstatic.com",
  "cdnjs.cloudflare.com": "https://cdnjs.cloudflare.com",
  "cdn.jsdelivr.net": "https://cdn.jsdelivr.net",
  "unpkg.com": "https://unpkg.com",
  "ajax.googleapis.com": "https://ajax.googleapis.com",
  "stackpath.bootstrapcdn.com": "https://stackpath.bootstrapcdn.com",
  "cdn.tailwindcss.com": "https://cdn.tailwindcss.com",
  "kit.fontawesome.com": "https://kit.fontawesome.com",
  "ka-f.fontawesome.com": "https://ka-f.fontawesome.com",
};

function extractExternalDomains(html: string): string[] {
  const domains = new Set<string>();
  const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let match;
  while ((match = urlRegex.exec(html)) !== null) {
    const domain = match[1];
    if (KNOWN_PRECONNECT_DOMAINS[domain]) {
      domains.add(KNOWN_PRECONNECT_DOMAINS[domain]);
    }
  }
  return Array.from(domains);
}

// ─── Main optimizer ───

export function applyPerformanceOptimization(
  html: string
): { html: string; report: PerformanceReport } {
  const report: PerformanceReport = {
    cssMinified: 0,
    jsMinified: 0,
    lazyImagesAdded: 0,
    asyncDecodingAdded: 0,
    preconnectLinksAdded: [],
    viewportAdded: false,
    asyncCssCount: 0,
    originalSize: html.length,
    optimizedSize: 0,
  };

  // 1. Minify inline CSS
  html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, css) => {
    const minified = minifyInlineCss(css);
    if (minified.length < css.length) report.cssMinified++;
    return `<style${attrs}>${minified}</style>`;
  });

  // 2. Minify inline JS (skip external scripts)
  html = html.replace(/<script(?![^>]*\bsrc\b)([^>]*)>([\s\S]*?)<\/script>/gi, (_match, attrs, js) => {
    if (!js.trim()) return `<script${attrs}>${js}</script>`;
    const minified = minifyInlineJs(js);
    if (minified.length < js.length) report.jsMinified++;
    return `<script${attrs}>${minified}</script>`;
  });

  // 3. Add loading='lazy' to images that don't have it
  html = html.replace(/<img\b([^>]*?)(\s*\/?>)/gi, (_match, attrs, close) => {
    let updated = attrs;
    if (!/loading\s*=/i.test(attrs)) {
      updated += ` loading="lazy"`;
      report.lazyImagesAdded++;
    }
    if (!/decoding\s*=/i.test(attrs)) {
      updated += ` decoding="async"`;
      report.asyncDecodingAdded++;
    }
    return `<img${updated}${close}`;
  });

  // 4. Add preconnect links for external domains
  const domains = extractExternalDomains(html);
  const existingPreconnects = html.match(/<link[^>]*rel=["']preconnect["'][^>]*>/gi) || [];
  const existingDomains = new Set(
    existingPreconnects.map((l) => {
      const m = l.match(/href=["']([^"']+)["']/);
      return m ? m[1] : "";
    })
  );

  const newPreconnects: string[] = [];
  for (const domain of domains) {
    if (!existingDomains.has(domain)) {
      newPreconnects.push(`<link rel="preconnect" href="${domain}" crossorigin>`);
      report.preconnectLinksAdded.push(domain);
    }
  }

  if (newPreconnects.length > 0) {
    const preconnectBlock = newPreconnects.join("\n  ");
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>\n  ${preconnectBlock}`);
    }
  }

  // 5. Add viewport meta if missing
  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`
      );
      report.viewportAdded = true;
    }
  }

  // 6. Async CSS loading for render-blocking external stylesheets
  html = html.replace(
    /<link\b([^>]*?)rel=["']stylesheet["']([^>]*?)(\s*\/?>)/gi,
    (_match, before, after, close) => {
      const full = before + after;
      // Skip if already has media=print pattern or is inline
      if (/media\s*=/i.test(full) || /data-no-async/i.test(full)) return _match;
      // Only async-ify external stylesheets (must have href)
      if (!/href\s*=/i.test(full)) return _match;
      report.asyncCssCount++;
      return `<link${before}rel="stylesheet"${after} media="print" onload="this.media='all'"${close}`;
    }
  );

  report.optimizedSize = html.length;
  return { html, report };
}

/**
 * Run performance optimization on a project's index.html.
 * Reads, optimizes, and writes back.
 */
export function optimizeProjectHtml(
  projectPath: string
): PerformanceReport | null {
  const indexPath = join(projectPath, "index.html");
  if (!existsSync(indexPath)) return null;

  const html = readFileSync(indexPath, "utf-8");
  const { html: optimized, report } = applyPerformanceOptimization(html);
  writeFileSync(indexPath, optimized, "utf-8");
  return report;
}
