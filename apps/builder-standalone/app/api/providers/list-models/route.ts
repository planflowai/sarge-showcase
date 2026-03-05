import { NextResponse } from "next/server";

/**
 * POST /api/providers/list-models
 * Fetches available models from an OpenAI-compatible provider's /models endpoint.
 *
 * Body: { baseUrl: string, envKeyName: string }
 * Returns: { models: { id: string, name: string, created?: number, owned_by?: string }[] }
 */
export async function POST(req: Request) {
  try {
    const { baseUrl, envKeyName } = await req.json();

    if (!baseUrl || !envKeyName) {
      return NextResponse.json(
        { error: "Missing baseUrl or envKeyName" },
        { status: 400 }
      );
    }

    const apiKey = process.env[envKeyName] || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: `API key not found. Add ${envKeyName} to your .env.local file.` },
        { status: 401 }
      );
    }

    // Normalize URL: strip trailing slash, call /models
    const modelsUrl = `${baseUrl.replace(/\/+$/, "")}/models`;

    const res = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `Provider returned ${res.status}: ${errText.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // OpenAI-compatible format: { data: [{ id, object, created, owned_by }] }
    // Some providers return { models: [...] } or just an array
    const rawModels = data.data || data.models || (Array.isArray(data) ? data : []);

    const models = rawModels.map((m: any) => ({
      id: m.id || m.model || "",
      name: m.name || m.id || m.model || "",
      created: m.created || null,
      owned_by: m.owned_by || null,
    })).filter((m: any) => m.id);

    // Sort by name
    models.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ models, total: models.length });
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out after 15 seconds" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
