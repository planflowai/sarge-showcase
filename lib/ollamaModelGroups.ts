// Ollama Model Groups - Friendly names and grouping for UI display
// Real model IDs are preserved for API calls

export interface OllamaModelEntry {
  id: string;       // Real Ollama tag (e.g. "deepseek-r1:14b") - used for API
  name: string;     // Friendly display name (e.g. "DeepSeek-R1 14B")
  hint: string;     // Short role/use description
}

export interface OllamaModelGroup {
  label: string;
  models: OllamaModelEntry[];
}

export const OLLAMA_MODEL_GROUPS: Record<string, OllamaModelGroup> = {
  reasoning: {
    label: 'Reasoning / Strong Logic (14B+)',
    models: [
      { id: 'deepseek-r1:14b', name: 'DeepSeek-R1 14B', hint: 'strong reasoning' },
      { id: 'phi3:medium', name: 'Phi-3 Medium', hint: 'solid logic' },
    ],
  },
  balanced: {
    label: 'Balanced / General (7–9B)',
    models: [
      { id: 'deepseek-r1:8b', name: 'DeepSeek-R1 8B', hint: 'good reasoning' },
      { id: 'deepseek-r1:7b', name: 'DeepSeek-R1 7B', hint: 'reasoning variant' },
      { id: 'qwen3:8b', name: 'Qwen3 8B', hint: 'balanced' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', hint: 'strong all-rounder' },
      { id: 'mistral:7b', name: 'Mistral 7B', hint: 'classic generalist' },
      { id: 'gemma2:9b', name: 'Gemma 2 9B', hint: 'recent general' },
      { id: 'cogito:8b', name: 'Cogito 8B', hint: 'reasoning focused' },
      { id: 'rnj-1:8b', name: 'RNJ-1 8B', hint: 'experimental' },
      { id: 'qwen2:7b', name: 'Qwen2 7B', hint: 'capable general' },
    ],
  },
  fast: {
    label: 'Fast / Lightweight (1–4B)',
    models: [
      { id: 'llama3.2:1b', name: 'Llama 3.2 1B', hint: 'very fast' },
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B', hint: 'quick' },
      { id: 'gemma2:2b', name: 'Gemma 2 2B', hint: 'tiny & fast' },
      { id: 'ministral-3:3b', name: 'Ministral 3B', hint: 'compact' },
      { id: 'gemma3:4b', name: 'Gemma 3 4B', hint: 'small & capable' },
      { id: 'phi3:mini', name: 'Phi-3 Mini', hint: 'lightweight logic' },
      { id: 'phi4-mini:latest', name: 'Phi-4 Mini', hint: 'newest small' },
    ],
  },
};

// Flat lookup: model ID -> friendly info
export const OLLAMA_MODEL_INFO: Record<string, { name: string; hint: string; group: string }> = {};

// Build the flat lookup from groups
for (const [groupKey, group] of Object.entries(OLLAMA_MODEL_GROUPS)) {
  for (const model of group.models) {
    OLLAMA_MODEL_INFO[model.id] = {
      name: model.name,
      hint: model.hint,
      group: group.label,
    };
  }
}

// Helper: Get friendly display name for a model ID (falls back to shortened ID if unknown)
export function getOllamaFriendlyName(modelId: string): string {
  const info = OLLAMA_MODEL_INFO[modelId];
  if (info) return info.name;

  // Smart shortening for unknown models
  // e.g. "minicpm-v:8b-2.6-q5_K_M" -> "minicpm-v:8b"
  // e.g. "deepseek-r1:1.5b-qwen-distill-q8_0" -> "deepseek-r1:1.5b"
  const [baseName, tag] = modelId.split(':');
  if (!tag) return modelId;

  // Extract just the size part (e.g. "8b", "14b", "1.5b", "latest")
  const sizeMatch = tag.match(/^(\d+\.?\d*b|latest)/i);
  if (sizeMatch) {
    return `${baseName}:${sizeMatch[1]}`;
  }

  // If no size found, just return base:first-part
  const firstPart = tag.split('-')[0].split('_')[0];
  return `${baseName}:${firstPart}`;
}

// Helper: Get hint for a model ID
export function getOllamaHint(modelId: string): string {
  const info = OLLAMA_MODEL_INFO[modelId];
  return info ? info.hint : '';
}

// Helper: Get group label for a model ID
export function getOllamaGroup(modelId: string): string {
  const info = OLLAMA_MODEL_INFO[modelId];
  return info ? info.group : 'Other';
}

// Helper: Group an array of model IDs into the standard groups
export function groupOllamaModels(modelIds: string[]): { label: string; models: { id: string; name: string; hint: string }[] }[] {
  const grouped: Record<string, { id: string; name: string; hint: string }[]> = {
    'Reasoning / Strong Logic (14B+)': [],
    'Balanced / General (7–9B)': [],
    'Fast / Lightweight (1–4B)': [],
    'Other / Specialized': [],
  };

  for (const id of modelIds) {
    const info = OLLAMA_MODEL_INFO[id];
    if (info) {
      grouped[info.group].push({ id, name: info.name, hint: info.hint });
    } else {
      // Unknown model goes to Other
      grouped['Other / Specialized'].push({ id, name: id, hint: '' });
    }
  }

  // Return only non-empty groups
  return Object.entries(grouped)
    .filter(([, models]) => models.length > 0)
    .map(([label, models]) => ({ label, models }));
}
