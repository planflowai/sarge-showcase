export type Provider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek"
  | "ollama"
  | "lmstudio";

export type ProviderType = "cloud" | "local";

export interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  endpoint?: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  contextWindow: number;
  isEnabled: boolean;
}

export interface ProviderConfig {
  id: Provider;
  name: string;
  type: ProviderType;
  models: ModelConfig[];
  color: string;
  isEnabled: boolean;
  supportsVoice: boolean;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
}

export interface ChatResponse {
  content: string;
  tokens: number;
}

export interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: Date;
  isDefault?: boolean;
}
