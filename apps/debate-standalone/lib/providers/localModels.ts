const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
const LM_STUDIO_URL = process.env.NEXT_PUBLIC_LM_STUDIO_URL || "http://127.0.0.1:1240/v1";

export interface LocalModel {
  id: string;
  name: string;
}

export async function fetchOllamaModels(): Promise<LocalModel[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!res.ok) throw new Error("Failed to fetch Ollama models");
  const data = await res.json();
  return (data.models ?? []).map((m: { name: string }) => ({
    id: m.name,
    name: m.name,
  }));
}

export async function fetchLMStudioModels(): Promise<LocalModel[]> {
  try {
    const res = await fetch('/api/lmstudio/models');
    if (!res.ok) return [];
    const data = await res.json();
    return data.models ?? [];
  } catch {
    return [];
  }
}
