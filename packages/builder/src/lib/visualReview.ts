/**
 * Visual Review Pipeline
 *
 * 1. Screenshots each page at desktop (1920px) and mobile (375px) via Puppeteer
 * 2. Runs free automated checks (page height, overflow, broken images)
 * 3. Sends desktop screenshot to vision model (Ollama qwen3-vl or Gemini fallback)
 * 4. Returns structured findings for BUILD_LOG
 */

export interface VisualCheckResult {
  page: string;
  filename: string;
  desktopScreenshot: string;
  mobileScreenshot: string;
  pageHeight: number;
  viewportHeights: number; // pageHeight / 1080
  issues: VisualIssue[];
}

export interface VisualIssue {
  type: "HEIGHT" | "OVERFLOW" | "BROKEN_IMAGE" | "VISION_MODEL";
  severity: "critical" | "warning" | "info";
  message: string;
}

export interface VisionReviewResult {
  model: string;
  provider: "ollama" | "gemini";
  findings: string;
  issues: VisualIssue[];
}

/** Vision model preference order for Ollama */
export const OLLAMA_VISION_MODELS = [
  "qwen3-vl:latest",
  "minicpm-v:latest",
  "llava-phi3:latest",
];

/** The vision review prompt */
export const VISION_REVIEW_PROMPT = `You are a professional web designer reviewing a website screenshot. List every visual issue you see: broken layouts, overlapping text, text showing one word per line, broken columns, missing images, inconsistent spacing, elements that look wrong, excessive whitespace, unreadable text, broken alignment. Be specific — describe where on the page each issue is and what needs to change. Do not say it looks good unless it's perfect.`;

/** Max page height before flagging */
export const MAX_PAGE_HEIGHT = 4000;

/** Max viewport multiplier before flagging */
export const MAX_VIEWPORT_MULTIPLIER = 5;

/**
 * Format visual review findings into BUILD_LOG section
 */
export function formatVisualReview(
  results: VisualCheckResult[],
  visionResults?: Array<{ page: string; review: VisionReviewResult }>,
): string {
  const lines: string[] = [];

  for (const r of results) {
    lines.push(`## Visual Review — ${r.filename}`);
    lines.push(`Page height: ${r.pageHeight}px (${r.viewportHeights.toFixed(1)}x viewport)`);

    if (r.issues.length === 0) {
      lines.push(`- No automated issues found`);
    } else {
      for (const issue of r.issues) {
        const icon = issue.severity === "critical" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
        lines.push(`- ${icon} ${issue.type}: ${issue.message}`);
      }
    }

    // Vision model review
    const vision = visionResults?.find((v) => v.page === r.page);
    if (vision) {
      lines.push(`\n### AI Visual Review (${vision.review.model})`);
      lines.push(vision.review.findings);
    }

    lines.push("");
  }

  return lines.join("\n");
}
