import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  injectMetaTags,
  fixAltText,
  checkHeadingHierarchy,
} from "./metaTags";
import { minifyHtml } from "./minifier";
import type { ProjectMeta } from "@/lib/types/project";

export interface SeoReport {
  metaTagsAdded: string[];
  altTextFixed: number;
  headingWarnings: string[];
  sitemapCreated: boolean;
  robotsCreated: boolean;
  minified: boolean;
}

/**
 * Run SEO optimization on a project's index.html.
 * Only runs if project.json exists and toggles.seo === true.
 */
export function applySeoOptimization(
  projectPath: string,
  projectMeta: ProjectMeta
): SeoReport {
  const report: SeoReport = {
    metaTagsAdded: [],
    altTextFixed: 0,
    headingWarnings: [],
    sitemapCreated: false,
    robotsCreated: false,
    minified: false,
  };

  const indexPath = join(projectPath, "index.html");
  if (!existsSync(indexPath)) {
    return report;
  }

  let html = readFileSync(indexPath, "utf-8");

  // Determine canonical URL
  const canonicalUrl = projectMeta.domain
    ? `https://${projectMeta.domain}`
    : projectMeta.deployUrls?.github
    ? projectMeta.deployUrls.github
    : "";

  // 1. Inject missing meta tags
  const metaResult = injectMetaTags(html, {
    projectName: projectMeta.name,
    clientName: projectMeta.clientName,
    domain: projectMeta.domain,
    deployUrl: canonicalUrl,
  });
  html = metaResult.html;
  report.metaTagsAdded = metaResult.added;

  // 2. Fix missing alt text on images
  const altResult = fixAltText(html);
  html = altResult.html;
  report.altTextFixed = altResult.fixed;

  // 3. Check heading hierarchy
  report.headingWarnings = checkHeadingHierarchy(html);

  // 4. Minify HTML
  const originalLength = html.length;
  html = minifyHtml(html);
  report.minified = html.length < originalLength;

  // Write optimized HTML back
  writeFileSync(indexPath, html, "utf-8");

  // 5. Generate sitemap.xml
  const sitemapPath = join(projectPath, "sitemap.xml");
  const sitemapUrl = canonicalUrl || `https://${projectMeta.name}.vercel.app`;
  const today = new Date().toISOString().split("T")[0];

  // Scan for HTML files to include in sitemap
  const sitemapEntries: { loc: string; priority: string }[] = [
    { loc: sitemapUrl + "/", priority: "1.0" },
  ];

  // Check for common additional pages
  const additionalPages = [
    "about.html",
    "contact.html",
    "services.html",
    "privacy.html",
    "blog.html",
    "portfolio.html",
  ];
  for (const page of additionalPages) {
    if (existsSync(join(projectPath, page))) {
      sitemapEntries.push({
        loc: `${sitemapUrl}/${page}`,
        priority: page === "privacy.html" ? "0.3" : "0.8",
      });
    }
  }

  const sitemapXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemapEntries
      .map(
        (e) =>
          `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${e.priority}</priority>\n  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  writeFileSync(sitemapPath, sitemapXml, "utf-8");
  report.sitemapCreated = true;

  // 6. Generate robots.txt
  const robotsPath = join(projectPath, "robots.txt");
  const robotsTxt =
    `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}/sitemap.xml\n`;
  writeFileSync(robotsPath, robotsTxt, "utf-8");
  report.robotsCreated = true;

  return report;
}
