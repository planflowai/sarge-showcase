import { NextResponse } from "next/server";

/** Standalone model scanner — calls Ollama and LMStudio directly. */
export async function GET() {
  const results: { provider: string; models: { id: string; name: string }[] }[] = [];

  // Scan Ollama
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).map((m: { name: string }) => ({
        id: m.name,
        name: m.name,
      }));
      results.push({ provider: "ollama", models });
    }
  } catch {
    // Ollama not running — skip
  }

  // Scan LM Studio
  try {
    const lmsUrl = process.env.LMSTUDIO_URL || "http://localhost:1234";
    const res = await fetch(`${lmsUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = (data.data || []).map((m: { id: string }) => ({
        id: m.id,
        name: m.id,
      }));
      results.push({ provider: "lmstudio", models });
    }
  } catch {
    // LM Studio not running — skip
  }

  return NextResponse.json({ results });
}
