import { NextRequest, NextResponse } from "next/server";

export interface WebFetchResponse {
  title: string;
  url: string;
  content: string;
  wordCount: number;
  error?: string;
}

// Simple token counter (approximate)
function countTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Strip HTML tags and extract clean text
function stripHtml(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|section|article|header|footer|nav|aside)[^>]*>/gi, "\n");

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&mdash;/g, "—");
  text = text.replace(/&ndash;/g, "–");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n\n");

  return text.trim();
}

// Extract title from HTML
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return stripHtml(titleMatch[1]).trim();
  }

  // Try og:title
  const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch) {
    return ogMatch[1].trim();
  }

  // Try h1
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return stripHtml(h1Match[1]).trim();
  }

  return "Untitled";
}

// Truncate text to approximate token limit
function truncateToTokens(text: string, maxTokens: number): string {
  const currentTokens = countTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Approximate character limit
  const maxChars = maxTokens * 4;
  let truncated = text.substring(0, maxChars);

  // Try to truncate at a sentence boundary
  const lastPeriod = truncated.lastIndexOf(".");
  const lastNewline = truncated.lastIndexOf("\n");
  const cutPoint = Math.max(lastPeriod, lastNewline);

  if (cutPoint > maxChars * 0.8) {
    truncated = truncated.substring(0, cutPoint + 1);
  }

  return truncated + "\n\n[Content truncated...]";
}

/**
 * Web Fetch API
 * Fetches a URL and extracts clean text content
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, maxTokens = 4000 } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Check for air-gap mode
    const airGapEnabled = process.env.AIR_GAP_MODE === "true";
    if (airGapEnabled) {
      return NextResponse.json(
        {
          title: "Unavailable",
          url,
          content: "",
          wordCount: 0,
          error: "Web fetch unavailable in air-gap mode"
        },
        { status: 200 }
      );
    }

    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AIBuilder/1.0; +https://github.com/ai-builder)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        }
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return NextResponse.json(
          {
            title: "Error",
            url,
            content: "",
            wordCount: 0,
            error: `Failed to fetch: HTTP ${res.status}`
          },
          { status: 200 }
        );
      }

      const contentType = res.headers.get("content-type") || "";

      // Only process HTML
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return NextResponse.json(
          {
            title: "Non-HTML Content",
            url,
            content: `This URL returns ${contentType} content which cannot be processed as text.`,
            wordCount: 0
          },
          { status: 200 }
        );
      }

      const html = await res.text();
      const title = extractTitle(html);
      let content = stripHtml(html);

      // Truncate to token limit
      content = truncateToTokens(content, maxTokens);

      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

      return NextResponse.json({
        title,
        url,
        content,
        wordCount
      });

    } catch (fetchErr) {
      clearTimeout(timeoutId);

      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        return NextResponse.json(
          {
            title: "Timeout",
            url,
            content: "",
            wordCount: 0,
            error: "Request timed out after 15 seconds"
          },
          { status: 200 }
        );
      }

      throw fetchErr;
    }

  } catch (err) {
    console.error("[WebFetch] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
