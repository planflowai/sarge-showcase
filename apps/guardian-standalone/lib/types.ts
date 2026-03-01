// Minimal types needed by the Thread Guardian API route

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  provider?: string;
  timestamp: Date;
}

export type Provider =
  | "ollama"
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek"
  | "lmstudio";
