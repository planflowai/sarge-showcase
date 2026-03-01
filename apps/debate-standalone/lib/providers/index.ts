import type { ProviderConfig } from "@/lib/types";

export const providers: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Claude",
    type: "cloud",
    color: "#d97706",
    isEnabled: true,
    supportsVoice: false,
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic", maxTokens: 8192, temperature: 0.7, topP: 1, contextWindow: 200000, isEnabled: true },
      { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", provider: "anthropic", maxTokens: 8192, temperature: 0.7, topP: 1, contextWindow: 200000, isEnabled: true },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", provider: "anthropic", maxTokens: 8192, temperature: 0.7, topP: 1, contextWindow: 200000, isEnabled: true },
    ],
  },
  {
    id: "openai",
    name: "GPT",
    type: "cloud",
    color: "#10b981",
    isEnabled: true,
    supportsVoice: true,
    models: [
      { id: "gpt-4o", name: "GPT-4o", provider: "openai", maxTokens: 4096, temperature: 0.7, topP: 1, contextWindow: 128000, isEnabled: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", maxTokens: 4096, temperature: 0.7, topP: 1, contextWindow: 128000, isEnabled: true },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", maxTokens: 4096, temperature: 0.7, topP: 1, contextWindow: 128000, isEnabled: true },
    ],
  },
  {
    id: "google",
    name: "Gemini",
    type: "cloud",
    color: "#3b82f6",
    isEnabled: true,
    supportsVoice: true,
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", maxTokens: 8192, temperature: 0.7, topP: 1, contextWindow: 1000000, isEnabled: true },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", maxTokens: 8192, temperature: 0.7, topP: 1, contextWindow: 1000000, isEnabled: true },
    ],
  },
  {
    id: "xai",
    name: "Grok",
    type: "cloud",
    color: "#ec4899",
    isEnabled: true,
    supportsVoice: true,
    models: [
      { id: "grok-3", name: "Grok 3", provider: "xai", maxTokens: 4096, temperature: 0.7, topP: 1, contextWindow: 131072, isEnabled: true },
      { id: "grok-3-mini", name: "Grok 3 Mini", provider: "xai", maxTokens: 4096, temperature: 0.7, topP: 1, contextWindow: 131072, isEnabled: true },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    type: "cloud",
    color: "#6366f1",
    isEnabled: true,
    supportsVoice: false,
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", provider: "deepseek", maxTokens: 8192, temperature: 0.7, topP: 1, contextWindow: 64000, isEnabled: true },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner", provider: "deepseek", maxTokens: 8192, temperature: 0.7, topP: 1, contextWindow: 64000, isEnabled: true },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    type: "local",
    color: "#fbbf24",
    isEnabled: true,
    supportsVoice: true,
    models: [],
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    type: "local",
    color: "#22c55e",
    isEnabled: true,
    supportsVoice: false,
    models: [],
  },
];

export function getProvider(id: string): ProviderConfig | undefined {
  return providers.find((p) => p.id === id);
}

export function getCloudProviders(): ProviderConfig[] {
  return providers.filter((p) => p.type === "cloud");
}

export function getLocalProviders(): ProviderConfig[] {
  return providers.filter((p) => p.type === "local");
}
