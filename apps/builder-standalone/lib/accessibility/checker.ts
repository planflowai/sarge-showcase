import fs from "fs/promises";
import path from "path";
import { resolveColor, getContrastRatio, meetsWCAG_AA } from "./contrast";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AccessibilityIssue {
  rule: string;
  severity: "error" | "warning";
  element: string;
  message: string;
  suggestion: string;
}

export interface AccessibilityReport {
  passed: number;
  failed: number;
  warnings: number;
  fixes: {
    headingsFixed: number;
    altTextAdded: number;
    skipLinkInjected: boolean;
    langAdded: boolean;
  };
  issues: AccessibilityIssue[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract all matches with a global regex */
function allMatches(html: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = global.exec(html)) !== null) results.push(m);
  return results;
}

/** Get attribute value from a tag string */
function getAttr(tag: string, attr: string): string | null {
  // Match attr="value", attr='value', or attr=value
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? "";
}

/** Check if attribute exists (even if empty) */
function hasAttr(tag: string, attr: string): boolean {
  const re = new RegExp(`\\b${attr}\\s*(?:=|\\s|>|/>)`, "i");
  return re.test(tag);
}

/** Extract text content from an HTML element (strip tags) */
function innerText(elementHtml: string): string {
  // Remove the opening/closing tags and strip inner tags
  const withoutOuter = elementHtml.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "");
  return withoutOuter.replace(/<[^>]+>/g, "").trim();
}

/** Generate a descriptive alt from a src/filename */
function altFromSrc(src: string): string {
  const basename = path.basename(src).replace(/\.[^.]+$/, "");
  // Convert kebab/snake/camel to space-separated
  return basename
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() || "image";
}

/** Extract all CSS from inline styles and <style> blocks */
function extractCssRules(html: string): string[] {
  const rules: string[] = [];

  // Style blocks
  const styleBlocks = allMatches(html, /<style[^>]*>([\s\S]*?)<\/style>/gi);
  for (const m of styleBlocks) rules.push(m[1]);

  return rules;
}

/** Non-descriptive link text patterns */
const NON_DESCRIPTIVE_LINK_TEXT = [
  /^click\s*here$/i,
  /^here$/i,
  /^read\s*more$/i,
  /^more$/i,
  /^link$/i,
  /^learn\s*more$/i,
  /^go$/i,
  /^this$/i,
  /^details$/i,
  /^info$/i,
];

// ─── Skip Link CSS ──────────────────────────────────────────────────────────

const SKIP_LINK_CSS = `
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px 16px;
  z-index: 10000;
  font-size: 14px;
  font-weight: bold;
  text-decoration: none;
  transition: top 0.2s;
}
.skip-link:focus {
  top: 0;
}`;

// ─── Main Checker ────────────────────────────────────────────────────────────

export async function runAccessibilityCheck(projectPath: string): Promise<AccessibilityReport> {
  const htmlPath = path.join(projectPath, "index.html");
  let html: string;

  try {
    html = await fs.readFile(htmlPath, "utf-8");
  } catch {
    return {
      passed: 0, failed: 0, warnings: 1,
      fixes: { headingsFixed: 0, altTextAdded: 0, skipLinkInjected: false, langAdded: false },
      issues: [{ rule: "file", severity: "warning", element: "index.html", message: "No index.html found", suggestion: "Create an index.html file" }],
    };
  }

  const issues: AccessibilityIssue[] = [];
  let passed = 0;
  let headingsFixed = 0;
  let altTextAdded = 0;
  let skipLinkInjected = false;
  let langAdded = false;

  // ═══ 1. Lang attribute ═══════════════════════════════════════════════════

  const htmlTagMatch = html.match(/<html([^>]*)>/i);
  if (htmlTagMatch) {
    const langVal = getAttr(htmlTagMatch[0], "lang");
    if (!langVal) {
      html = html.replace(/<html([^>]*)>/i, '<html$1 lang="en">');
      langAdded = true;
      issues.push({
        rule: "html-lang",
        severity: "error",
        element: "<html>",
        message: "Missing lang attribute on <html>",
        suggestion: "Added lang=\"en\" automatically",
      });
    } else {
      passed++;
    }
  }

  // ═══ 2. Heading hierarchy ════════════════════════════════════════════════

  const headingMatches = allMatches(html, /<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi);
  const headingLevels = headingMatches.map((m) => ({
    tag: m[1].toLowerCase(),
    level: parseInt(m[1][1]),
    full: m[0],
    content: m[3].replace(/<[^>]+>/g, "").trim(),
  }));

  // Check for multiple H1s
  const h1s = headingLevels.filter((h) => h.level === 1);
  if (h1s.length > 1) {
    // Convert extra H1s to H2
    let h1Count = 0;
    html = html.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/gi, (match, attrs, content) => {
      h1Count++;
      if (h1Count > 1) {
        headingsFixed++;
        return `<h2${attrs}>${content}</h2>`;
      }
      return match;
    });
    issues.push({
      rule: "heading-single-h1",
      severity: "error",
      element: `<h1> (${h1s.length} found)`,
      message: `Multiple H1 elements found (${h1s.length}). Only one H1 per page.`,
      suggestion: `Converted ${h1s.length - 1} extra H1(s) to H2`,
    });
  } else if (h1s.length === 1) {
    passed++;
  } else if (headingLevels.length > 0) {
    issues.push({
      rule: "heading-single-h1",
      severity: "warning",
      element: "page",
      message: "No H1 element found on the page",
      suggestion: "Add an H1 as the primary page heading",
    });
  }

  // Check for skipped levels (e.g., H1→H3)
  for (let i = 1; i < headingLevels.length; i++) {
    const prev = headingLevels[i - 1].level;
    const curr = headingLevels[i].level;
    if (curr > prev + 1) {
      const expected = prev + 1;
      // Auto-fix: adjust to expected level
      const oldTag = `h${curr}`;
      const newTag = `h${expected}`;
      const escapedContent = headingLevels[i].content.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fixRe = new RegExp(
        `<${oldTag}([^>]*)>(\\s*${escapedContent}\\s*)<\\/${oldTag}>`,
        "i"
      );
      if (fixRe.test(html)) {
        html = html.replace(fixRe, `<${newTag}$1>$2</${newTag}>`);
        headingLevels[i].level = expected;
        headingsFixed++;
        issues.push({
          rule: "heading-order",
          severity: "error",
          element: `<${oldTag}>${headingLevels[i].content}</${oldTag}>`,
          message: `Heading level skipped: H${prev} → H${curr}`,
          suggestion: `Changed to <${newTag}> (level ${expected})`,
        });
      } else {
        issues.push({
          rule: "heading-order",
          severity: "warning",
          element: `<${oldTag}>`,
          message: `Heading level skipped: H${prev} → H${curr}`,
          suggestion: `Change to <${newTag}> for proper hierarchy`,
        });
      }
    }
  }

  if (headingLevels.length > 1 && headingsFixed === 0 && h1s.length <= 1) {
    passed++;
  }

  // ═══ 3. Image alt text ═══════════════════════════════════════════════════

  const imgMatches = allMatches(html, /<img([^>]*)>/gi);
  let decorativeCount = 0;

  for (const m of imgMatches) {
    const tag = m[0];
    const altVal = getAttr(tag, "alt");
    const src = getAttr(tag, "src") || "image";

    if (altVal === null) {
      // No alt at all — add one
      const generatedAlt = altFromSrc(src);
      const fixed = tag.replace(/<img/i, `<img alt="${generatedAlt}"`);
      html = html.replace(tag, fixed);
      altTextAdded++;
      issues.push({
        rule: "img-alt",
        severity: "error",
        element: `<img src="${src.slice(0, 60)}">`,
        message: "Image missing alt attribute",
        suggestion: `Added alt="${generatedAlt}"`,
      });
    } else if (altVal === "") {
      // Decorative — log but leave
      decorativeCount++;
    } else {
      passed++;
    }
  }

  if (decorativeCount > 0) {
    issues.push({
      rule: "img-alt-decorative",
      severity: "warning",
      element: `${decorativeCount} image(s)`,
      message: `${decorativeCount} image(s) marked as decorative (alt="")`,
      suggestion: "Verify these are truly decorative and don't convey information",
    });
  }

  // ═══ 4. Color contrast ═══════════════════════════════════════════════════

  const cssBlocks = extractCssRules(html);
  const allCss = cssBlocks.join("\n");

  // Extract rule blocks from CSS
  const ruleBlocks = allMatches(allCss, /([^{}]+)\{([^}]+)\}/g);
  let contrastChecked = 0;

  for (const rb of ruleBlocks) {
    const selector = rb[1].trim();
    const declarations = rb[2];

    // Skip pseudo-elements, keyframes, media queries
    if (selector.startsWith("@") || selector.includes("::")) continue;

    const colorMatch = declarations.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);
    const bgMatch = declarations.match(/background(?:-color)?\s*:\s*([^;!]+)/i);

    if (colorMatch && bgMatch) {
      const fgStr = colorMatch[1].trim();
      const bgStr = bgMatch[1].trim();
      const fg = resolveColor(fgStr);
      const bg = resolveColor(bgStr);

      if (fg && bg) {
        contrastChecked++;
        const ratio = getContrastRatio(fg, bg);
        // Check for large text heuristic (font-size >= 18px or >= 14px bold)
        const fontSizeMatch = declarations.match(/font-size\s*:\s*([\d.]+)(px|pt|rem|em)/i);
        const fontWeightMatch = declarations.match(/font-weight\s*:\s*(bold|[7-9]\d{2})/i);
        let isLargeText = false;
        if (fontSizeMatch) {
          const size = parseFloat(fontSizeMatch[1]);
          const unit = fontSizeMatch[2].toLowerCase();
          const pxSize = unit === "pt" ? size * 1.333 : unit === "rem" || unit === "em" ? size * 16 : size;
          isLargeText = pxSize >= 24 || (pxSize >= 18.66 && !!fontWeightMatch);
        }

        if (!meetsWCAG_AA(ratio, isLargeText)) {
          issues.push({
            rule: "color-contrast",
            severity: "error",
            element: selector.slice(0, 60),
            message: `Contrast ratio ${ratio.toFixed(2)}:1 is below ${isLargeText ? "3:1" : "4.5:1"} minimum`,
            suggestion: `Increase contrast between ${fgStr} and ${bgStr} for selector "${selector}"`,
          });
        } else {
          passed++;
        }
      }
    }
  }

  // Also check inline styles
  const inlineStyleMatches = allMatches(html, /<[^>]+style\s*=\s*"([^"]*)"[^>]*>/gi);
  for (const m of inlineStyleMatches) {
    const style = m[1];
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);
    const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;!]+)/i);

    if (colorMatch && bgMatch) {
      const fgStr = colorMatch[1].trim();
      const bgStr = bgMatch[1].trim();
      const fg = resolveColor(fgStr);
      const bg = resolveColor(bgStr);

      if (fg && bg) {
        contrastChecked++;
        const ratio = getContrastRatio(fg, bg);
        if (!meetsWCAG_AA(ratio, false)) {
          const elementSnippet = m[0].slice(0, 80);
          issues.push({
            rule: "color-contrast",
            severity: "error",
            element: elementSnippet,
            message: `Inline style contrast ratio ${ratio.toFixed(2)}:1 is below 4.5:1 minimum`,
            suggestion: `Increase contrast between ${fgStr} and ${bgStr}`,
          });
        } else {
          passed++;
        }
      }
    }
  }

  if (contrastChecked === 0) {
    issues.push({
      rule: "color-contrast",
      severity: "warning",
      element: "page",
      message: "No explicit color/background-color pairs found to check",
      suggestion: "Manually verify contrast ratios using browser dev tools",
    });
  }

  // ═══ 5. Keyboard navigation ══════════════════════════════════════════════

  // Links — check href
  const linkMatches = allMatches(html, /<a([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const m of linkMatches) {
    const tag = m[0];
    const href = getAttr(tag, "href");
    if (!href || href === "#") {
      issues.push({
        rule: "link-href",
        severity: "warning",
        element: tag.slice(0, 80),
        message: "Link has empty or '#' href — not keyboard-navigable",
        suggestion: "Provide a valid href or use a <button> instead",
      });
    } else {
      passed++;
    }
  }

  // Buttons — check accessible text
  const buttonMatches = allMatches(html, /<button([^>]*)>([\s\S]*?)<\/button>/gi);
  for (const m of buttonMatches) {
    const tag = m[0];
    const text = innerText(tag);
    const ariaLabel = getAttr(tag, "aria-label");
    const ariaLabelledBy = getAttr(tag, "aria-labelledby");
    const title = getAttr(tag, "title");

    if (!text && !ariaLabel && !ariaLabelledBy && !title) {
      issues.push({
        rule: "button-name",
        severity: "error",
        element: tag.slice(0, 80),
        message: "Button has no accessible text",
        suggestion: "Add visible text, aria-label, or title attribute",
      });
    } else {
      passed++;
    }
  }

  // Inputs — check label association
  const inputMatches = allMatches(html, /<input([^>]*)>/gi);
  for (const m of inputMatches) {
    const tag = m[0];
    const type = (getAttr(tag, "type") || "text").toLowerCase();
    // Skip hidden, submit, button, image, reset — they don't need labels
    if (["hidden", "submit", "button", "image", "reset"].includes(type)) continue;

    const id = getAttr(tag, "id");
    const ariaLabel = getAttr(tag, "aria-label");
    const ariaLabelledBy = getAttr(tag, "aria-labelledby");
    const title = getAttr(tag, "title");
    const placeholder = getAttr(tag, "placeholder");

    // Check if there's a <label for="id">
    const hasLabelFor = id ? new RegExp(`<label[^>]+for\\s*=\\s*["']${id}["']`, "i").test(html) : false;

    if (!ariaLabel && !ariaLabelledBy && !title && !hasLabelFor) {
      issues.push({
        rule: "input-label",
        severity: "error",
        element: tag.slice(0, 80),
        message: `Input (type="${type}") has no associated label`,
        suggestion: placeholder
          ? `Add aria-label="${placeholder}" or a <label for="..."> element`
          : "Add a <label>, aria-label, or title attribute",
      });
    } else {
      passed++;
    }
  }

  // Focus styles check
  const hasFocusStyles = /:focus/.test(allCss) || /outline/.test(allCss);
  if (!hasFocusStyles) {
    issues.push({
      rule: "focus-visible",
      severity: "warning",
      element: "CSS",
      message: "No :focus styles detected in CSS",
      suggestion: "Add :focus or :focus-visible styles for interactive elements (e.g., outline, box-shadow)",
    });
  } else {
    passed++;
  }

  // ═══ 6. Skip navigation link ═════════════════════════════════════════════

  const hasSkipLink = /class\s*=\s*["'][^"']*skip[-_]?link/i.test(html) ||
    /skip\s+to\s+(main\s+)?content/i.test(html);

  if (!hasSkipLink) {
    // Inject skip link
    const skipLinkHtml = '<a href="#main-content" class="skip-link">Skip to main content</a>';

    // Add skip link as first child of <body>
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${skipLinkHtml}`);

    // Add id="main-content" to <main> if it exists, otherwise to first content div
    if (/<main/i.test(html)) {
      if (!hasAttr(html.match(/<main([^>]*)>/i)?.[0] || "", "id")) {
        html = html.replace(/<main([^>]*)>/i, '<main$1 id="main-content">');
      }
    } else {
      // Try first div after body or first article
      const contentTarget = html.match(/<(?:div|article|section)([^>]*)>/i);
      if (contentTarget && !hasAttr(contentTarget[0], "id")) {
        html = html.replace(contentTarget[0], contentTarget[0].replace(/>$/, ' id="main-content">'));
      }
    }

    // Inject skip link CSS into <head> or before </head>
    if (/<style[^>]*>/i.test(html)) {
      // Append to first style block
      html = html.replace(/(<style[^>]*>)/i, `$1\n${SKIP_LINK_CSS}\n`);
    } else if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `<style>${SKIP_LINK_CSS}</style>\n</head>`);
    }

    skipLinkInjected = true;
    issues.push({
      rule: "skip-link",
      severity: "error",
      element: "<body>",
      message: "No skip navigation link found",
      suggestion: "Injected skip-to-main-content link automatically",
    });
  } else {
    passed++;
  }

  // ═══ 7. ARIA landmarks ═══════════════════════════════════════════════════

  const hasMain = /<main/i.test(html) || /role\s*=\s*["']main["']/i.test(html);
  const hasNav = /<nav/i.test(html) || /role\s*=\s*["']navigation["']/i.test(html);
  const hasHeader = /<header/i.test(html) || /role\s*=\s*["']banner["']/i.test(html);

  if (!hasMain) {
    issues.push({
      rule: "landmark-main",
      severity: "warning",
      element: "page",
      message: "No <main> element or role=\"main\" found",
      suggestion: "Wrap primary content in a <main> element",
    });
  } else {
    passed++;
  }

  if (!hasNav) {
    issues.push({
      rule: "landmark-nav",
      severity: "warning",
      element: "page",
      message: "No <nav> element or role=\"navigation\" found",
      suggestion: "Wrap navigation links in a <nav> element",
    });
  } else {
    passed++;
  }

  if (!hasHeader) {
    issues.push({
      rule: "landmark-header",
      severity: "warning",
      element: "page",
      message: "No <header> element or role=\"banner\" found",
      suggestion: "Add a <header> element for the page header area",
    });
  } else {
    passed++;
  }

  // ═══ 8. Link text quality ════════════════════════════════════════════════

  for (const m of linkMatches) {
    const text = innerText(m[0]).toLowerCase();
    if (!text) continue;

    const isNonDescriptive = NON_DESCRIPTIVE_LINK_TEXT.some((re) => re.test(text));
    if (isNonDescriptive) {
      issues.push({
        rule: "link-text",
        severity: "warning",
        element: m[0].slice(0, 80),
        message: `Non-descriptive link text: "${text}"`,
        suggestion: "Use descriptive text that explains the link destination (e.g., \"View pricing plans\" instead of \"click here\")",
      });
    }
  }

  // ═══ Write fixed HTML ════════════════════════════════════════════════════

  await fs.writeFile(htmlPath, html, "utf-8");

  // ═══ Build report ════════════════════════════════════════════════════════

  const failed = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return {
    passed,
    failed,
    warnings,
    fixes: {
      headingsFixed,
      altTextAdded,
      skipLinkInjected,
      langAdded,
    },
    issues,
  };
}
