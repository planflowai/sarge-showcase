import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";

export interface ScannedModel {
  id: string;
  name: string;
  provider: string;
  sizeMB: number;
  modifiedAt: string;
  digest: string;
}

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to connect to Ollama", details: "Is Ollama running?" },
        { status: 503 }
      );
    }

    const data = await response.json();
    const models: ScannedModel[] = (data.models ?? []).map((m: any) => ({
      id: m.name,
      name: m.name,
      provider: "ollama",
      sizeMB: Math.round((m.size || 0) / (1024 * 1024)),  // Convert bytes to MB
      modifiedAt: m.modified_at,
      digest: m.digest,
    }));

    // Sort by size descending (biggest first)
    models.sort((a, b) => b.sizeMB - a.sizeMB);

    return NextResponse.json({
      models,
      count: models.length,
      scannedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Model scan error:", error);
    return NextResponse.json(
      { error: "Failed to scan models", details: error.message },
      { status: 500 }
    );
  }
}
