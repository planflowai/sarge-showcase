import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/images/search
 *
 * Searches Pexels (primary) and Pixabay (secondary) for stock images
 * matching a business description / prompt.
 *
 * Request:  { query: string, count?: number }
 * Response: { images: ImageResult[], source: "pexels" | "pixabay" | "none" }
 */

interface ImageResult {
  url: string;          // Direct image URL (medium/large)
  thumb: string;        // Thumbnail URL
  alt: string;          // Alt text / description
  credit: string;       // Photographer credit
  creditUrl: string;    // Photographer profile URL
  width: number;
  height: number;
  source: "pexels" | "pixabay";
}

// ─── Pexels Search ──────────────────────────────────────────────────────────────

async function searchPexels(query: string, count: number): Promise<ImageResult[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const photos: any[] = data.photos || [];

    return photos.map((p) => ({
      url: p.src?.large || p.src?.medium || p.src?.original,
      thumb: p.src?.small || p.src?.tiny,
      alt: p.alt || query,
      credit: p.photographer || "Unknown",
      creditUrl: p.photographer_url || "",
      width: p.width,
      height: p.height,
      source: "pexels" as const,
    }));
  } catch {
    return [];
  }
}

// ─── Pixabay Search ─────────────────────────────────────────────────────────────

async function searchPixabay(query: string, count: number): Promise<ImageResult[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${count}&image_type=photo&orientation=horizontal&safesearch=true`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const hits: any[] = data.hits || [];

    return hits.map((h) => ({
      url: h.webformatURL || h.largeImageURL,
      thumb: h.previewURL,
      alt: h.tags || query,
      credit: h.user || "Unknown",
      creditUrl: `https://pixabay.com/users/${h.user_id}/`,
      width: h.webformatWidth || h.imageWidth,
      height: h.webformatHeight || h.imageHeight,
      source: "pixabay" as const,
    }));
  } catch {
    return [];
  }
}

// ─── Extract search keywords from a build prompt ────────────────────────────────

function extractSearchQuery(prompt: string): string {
  // Remove common builder instructions, keep business-relevant terms
  const cleaned = prompt
    .replace(/\b(build|create|make|design|generate|code|html|css|javascript|react|website|webpage|page|landing|responsive|dark mode|light mode|mobile|desktop|tailwind)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  // Take first 80 chars of cleaned prompt as search query
  return cleaned.slice(0, 80) || prompt.slice(0, 80);
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { query, count = 8 } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ images: [], source: "none" });
    }

    const searchQuery = extractSearchQuery(query);

    // Try Pexels first (primary — URL embedding)
    let images = await searchPexels(searchQuery, count);
    if (images.length > 0) {
      return NextResponse.json({ images, source: "pexels" });
    }

    // Fall back to Pixabay (secondary)
    images = await searchPixabay(searchQuery, count);
    if (images.length > 0) {
      return NextResponse.json({ images, source: "pixabay" });
    }

    return NextResponse.json({ images: [], source: "none" });
  } catch (err: any) {
    console.error("[ImageSearch] Error:", err);
    return NextResponse.json({ images: [], source: "none" });
  }
}
