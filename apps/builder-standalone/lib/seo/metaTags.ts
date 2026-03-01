/**
 * Meta tag detection and injection helpers.
 * Works on raw HTML strings — no DOM parser dependency.
 */

/* ── Detection ── */

/** Check if a meta tag with a given name/property exists */
function hasMetaTag(html: string, attr: string, value: string): boolean {
  // Match name="value" or property="value" (case-insensitive, single or double quotes)
  const re = new RegExp(
    `<meta\\s+[^>]*(?:${attr})\\s*=\\s*["']${value}["'][^>]*>`,
    "i"
  );
  return re.test(html);
}

function hasTag(html: string, tag: string): boolean {
  const re = new RegExp(`<${tag}[\\s>]`, "i");
  return re.test(html);
}

function hasLinkRel(html: string, rel: string): boolean {
  const re = new RegExp(`<link\\s+[^>]*rel\\s*=\\s*["']${rel}["'][^>]*>`, "i");
  return re.test(html);
}

/* ── Extraction ── */

/** Extract visible text content from HTML (strip tags, scripts, styles) */
export function extractVisibleText(html: string): string {
  let text = html;
  // Remove script and style blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove all tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&#\d+;/g, " ");
  text = text.replace(/&\w+;/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/** Extract keywords from visible text (top terms by frequency) */
export function extractKeywords(text: string, max: number = 8): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
    "be", "has", "had", "have", "will", "would", "could", "should", "can",
    "not", "no", "so", "if", "do", "does", "did", "as", "we", "our", "your",
    "you", "he", "she", "they", "them", "their", "its", "my", "me", "us",
    "all", "each", "every", "both", "few", "more", "most", "other", "some",
    "such", "than", "too", "very", "just", "about", "up", "out", "into",
    "over", "after", "before", "between", "under", "again", "then", "here",
    "there", "when", "where", "how", "what", "which", "who", "whom", "why",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}

/** Extract existing <title> content */
export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : "";
}

/* ── Injection ── */

interface InjectOptions {
  projectName: string;
  clientName?: string;
  domain?: string;
  deployUrl?: string;
}

/**
 * Inject missing meta tags into HTML <head>.
 * Returns { html, added } where added is the list of tags injected.
 */
export function injectMetaTags(
  html: string,
  opts: InjectOptions
): { html: string; added: string[] } {
  const added: string[] = [];
  const tags: string[] = [];

  const visibleText = extractVisibleText(html);
  const existingTitle = extractTitle(html);
  const title = existingTitle || opts.projectName || opts.clientName || "Untitled";
  const description = visibleText.slice(0, 160) || `${title} — Built with The Foundry`;
  const keywords = extractKeywords(visibleText);
  const canonicalUrl = opts.domain
    ? `https://${opts.domain}`
    : opts.deployUrl || "";

  // charset
  if (!hasMetaTag(html, "charset", ".*") && !/meta\s+charset/i.test(html)) {
    tags.push(`<meta charset="UTF-8">`);
    added.push("charset");
  }

  // viewport
  if (!hasMetaTag(html, "name", "viewport")) {
    tags.push(
      `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
    );
    added.push("viewport");
  }

  // title
  if (!existingTitle) {
    // Insert <title> tag — we'll add it in the injection block
    tags.push(`<title>${title}</title>`);
    added.push("title");
  }

  // description
  if (!hasMetaTag(html, "name", "description")) {
    tags.push(`<meta name="description" content="${escAttr(description)}">`);
    added.push("description");
  }

  // keywords
  if (!hasMetaTag(html, "name", "keywords") && keywords.length > 0) {
    tags.push(`<meta name="keywords" content="${escAttr(keywords.join(", "))}">`);
    added.push("keywords");
  }

  // Open Graph
  if (!hasMetaTag(html, "property", "og:title")) {
    tags.push(`<meta property="og:title" content="${escAttr(title)}">`);
    added.push("og:title");
  }
  if (!hasMetaTag(html, "property", "og:description")) {
    tags.push(
      `<meta property="og:description" content="${escAttr(description)}">`
    );
    added.push("og:description");
  }
  if (!hasMetaTag(html, "property", "og:type")) {
    tags.push(`<meta property="og:type" content="website">`);
    added.push("og:type");
  }
  if (!hasMetaTag(html, "property", "og:url") && canonicalUrl) {
    tags.push(`<meta property="og:url" content="${escAttr(canonicalUrl)}">`);
    added.push("og:url");
  }

  // Twitter Card
  if (!hasMetaTag(html, "name", "twitter:card")) {
    tags.push(`<meta name="twitter:card" content="summary">`);
    added.push("twitter:card");
  }
  if (!hasMetaTag(html, "name", "twitter:title")) {
    tags.push(`<meta name="twitter:title" content="${escAttr(title)}">`);
    added.push("twitter:title");
  }
  if (!hasMetaTag(html, "name", "twitter:description")) {
    tags.push(
      `<meta name="twitter:description" content="${escAttr(description)}">`
    );
    added.push("twitter:description");
  }

  // Canonical
  if (!hasLinkRel(html, "canonical") && canonicalUrl) {
    tags.push(`<link rel="canonical" href="${escAttr(canonicalUrl)}">`);
    added.push("canonical");
  }

  if (tags.length === 0) {
    return { html, added };
  }

  // Inject after <head> or at the very top if no <head>
  const injection = "\n  <!-- SEO — auto-injected by The Foundry -->\n  " +
    tags.join("\n  ") + "\n";

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/(<head[^>]*>)/i, `$1${injection}`);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/(<html[^>]*>)/i, `$1\n<head>${injection}</head>`);
  } else {
    html = `<head>${injection}</head>\n${html}`;
  }

  return { html, added };
}

/* ── Alt Text ── */

/**
 * Fix images missing alt text. Uses filename as placeholder.
 * Returns { html, fixed } count.
 */
export function fixAltText(html: string): { html: string; fixed: number } {
  let fixed = 0;

  html = html.replace(/<img\s+([^>]*?)>/gi, (match, attrs: string) => {
    // Already has alt attribute
    if (/\balt\s*=/i.test(attrs)) return match;

    // Extract src for filename
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    let altText = "image";
    if (srcMatch) {
      const filename = srcMatch[1].split("/").pop()?.split("?")[0] || "image";
      altText = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    }

    fixed++;
    return `<img ${attrs} alt="${escAttr(altText)}">`;
  });

  return { html, fixed };
}

/* ── Heading Hierarchy ── */

/**
 * Check heading hierarchy for gaps (e.g., H1 → H3 with no H2).
 * Returns array of warning strings.
 */
export function checkHeadingHierarchy(html: string): string[] {
  const warnings: string[] = [];
  const headings: { level: number; text: string }[] = [];

  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    headings.push({
      level: parseInt(m[1]),
      text: m[2].replace(/<[^>]+>/g, "").trim().slice(0, 50),
    });
  }

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      warnings.push(
        `Heading skip: H${prev} → H${curr} (missing H${prev + 1}) near "${headings[i].text}"`
      );
    }
  }

  if (headings.length > 0 && headings[0].level !== 1) {
    warnings.push(
      `First heading is H${headings[0].level}, should be H1`
    );
  }

  return warnings;
}

/* ── Helpers ── */

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
