import { NextResponse } from "next/server";

const LM_STUDIO_URL = process.env.NEXT_PUBLIC_LM_STUDIO_URL || "http://127.0.0.1:1240/v1";
const LM_STUDIO_API_KEY = process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || "";

export async function GET() {
  try {
    const url = `${LM_STUDIO_URL}/models`;
    console.log('[API/LMStudio] Fetching models from:', url);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Authorization header if API key is configured
    if (LM_STUDIO_API_KEY) {
      headers['Authorization'] = `Bearer ${LM_STUDIO_API_KEY}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      console.error('[API/LMStudio] Failed:', res.status, res.statusText);
      return NextResponse.json(
        { error: `LM Studio returned ${res.status}`, models: [] },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log('[API/LMStudio] Response:', data);

    // LM Studio returns { data: [...models] } in OpenAI format
    const models = (data.data ?? []).map((m: { id: string }) => ({
      id: m.id,
      name: m.id,
    }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error('[API/LMStudio] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to LM Studio', models: [] },
      { status: 500 }
    );
  }
}
