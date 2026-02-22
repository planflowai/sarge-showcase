// Provider interface - all providers implement this
export interface Provider {
  name: string;
  fetchModels(): Promise<string[]>;
  complete(model: string, prompt: string, systemPrompt?: string): Promise<CompletionResult>;
  checkConnection(): Promise<ConnectionStatus>;
}

export interface CompletionResult {
  content: string;
  tokens: number;
  timeMs: number;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  masked_key?: string; // last 4 chars
  error?: string;
}

export interface ProviderConfig {
  ollama_url: string;
  anthropic_key?: string;
  openai_key?: string;
  google_key?: string;
  xai_key?: string;
  supabase_url?: string;
  supabase_key?: string;
}

// Mask a key to show only last 4 chars
export function maskKey(key: string | undefined): string | undefined {
  if (!key || key.length < 8) return undefined;
  return '●'.repeat(12) + key.slice(-4);
}
