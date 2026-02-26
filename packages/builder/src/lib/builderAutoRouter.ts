/**
 * Builder Auto-Router
 *
 * Intelligently routes Builder tasks to the appropriate model tier based on:
 * - Task complexity
 * - Current code state
 * - Available models
 * - User preferences (cost vs quality)
 *
 * Tier 1: Local models for simple edits (style, typos, minor content)
 * Tier 2: Medium cloud models for component additions (DeepSeek V3, Gemini Flash)
 * Tier 3: Heavy cloud models for complex builds (Claude, Grok, GPT-4o)
 */

import { fetchOllamaModels, type LocalModel } from '@sarge/core';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaskTier = 1 | 2 | 3;

export type TaskType =
  | 'new_build'
  | 'minor_edit'
  | 'major_edit'
  | 'add_component'
  | 'restructure'
  | 'style_change'
  | 'content_change'
  | 'fix_bug';

export interface TaskAnalysis {
  tier: TaskTier;
  reason: string;
  suggestedModel: string;
  suggestedProvider: string;
  estimatedTokens: number;
  taskType: TaskType;
}

export interface RoutingDecision extends TaskAnalysis {
  timestamp: number;
  userMessage: string;
  codeLength: number;
  wasOverridden: boolean;
  overrideModel?: string;
  overrideProvider?: string;
  actualTokensUsed?: number;
}

export type ModelPreference = 'cost' | 'quality';

// ─── Keyword Detection ───────────────────────────────────────────────────────

// Tier 1: Simple style/content changes
const STYLE_KEYWORDS = [
  'color', 'font', 'padding', 'margin', 'size', 'background', 'border',
  'opacity', 'shadow', 'radius', 'width', 'height', 'spacing', 'align',
  'center', 'left', 'right', 'bold', 'italic', 'underline', 'weight',
  'darker', 'lighter', 'bigger', 'smaller', 'thicker', 'thinner',
  'gradient', 'rounded', 'square', 'circular', 'transparent'
];

const CONTENT_SWAP_KEYWORDS = [
  'change text', 'update title', 'rename', 'replace word', 'change word',
  'update text', 'edit text', 'modify text', 'change the text',
  'update the title', 'change title', 'new title', 'different text',
  'swap', 'substitute'
];

const FIX_KEYWORDS = [
  'fix', 'typo', 'spelling', 'wrong', 'broken', 'bug', 'error',
  'mistake', 'correct', 'not working', 'doesn\'t work', 'issue'
];

// Tier 2: Component additions
const ADD_KEYWORDS = [
  'add section', 'add form', 'add carousel', 'add toggle', 'add animation',
  'add button', 'add input', 'add field', 'add image', 'add icon',
  'add link', 'add menu', 'add list', 'add card', 'add grid',
  'insert', 'include', 'put a', 'place a', 'add a', 'add an',
  'new section', 'another section', 'more sections'
];

const COMPONENT_KEYWORDS = [
  'navbar', 'navigation', 'footer', 'modal', 'dropdown', 'slider',
  'gallery', 'carousel', 'sidebar', 'header', 'hero', 'banner',
  'testimonial', 'pricing', 'contact form', 'newsletter', 'cta',
  'accordion', 'tabs', 'tooltip', 'popup', 'overlay', 'drawer'
];

// Tier 3: Complex/structural changes
const STRUCTURAL_KEYWORDS = [
  'build', 'create site', 'from scratch', 'complete', 'full page',
  'multi-page', 'restructure', 'redesign', 'rebuild', 'overhaul',
  'new website', 'new site', 'new page', 'entire', 'whole',
  'completely', 'totally', 'start over', 'brand new'
];

const COMPLEX_FEATURE_KEYWORDS = [
  'routing', 'authentication', 'database', 'api integration', 'real-time',
  'login', 'signup', 'payment', 'checkout', 'shopping cart', 'search',
  'filter', 'sort', 'pagination', 'infinite scroll', 'lazy load',
  'websocket', 'socket', 'notification', 'push', 'upload', 'download'
];

// ─── Model Definitions ───────────────────────────────────────────────────────

// Tier 1 local model preferences (in order)
const TIER1_LOCAL_MODELS = [
  'phi4:latest',
  'phi4:mini-latest',
  'phi3:mini',
  'phi3:latest',
  'llama3.2:latest',
  'llama3.2:3b',
  'mistral:latest',
  'qwen2.5-coder:latest',
  'qwen2.5-coder:7b',
  'deepseek-coder:latest',
  'codellama:latest'
];

// Tier 2 cloud models (cost-optimized)
const TIER2_MODELS = [
  { provider: 'deepseek', model: 'deepseek-chat', name: 'DeepSeek V3' },
  { provider: 'google', model: 'gemini-2.0-flash-exp', name: 'Gemini Flash' },
  { provider: 'google', model: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { provider: 'openai', model: 'gpt-4o-mini', name: 'GPT-4o Mini' },
];

// Tier 3 cloud models (quality-focused)
const TIER3_QUALITY_MODELS = [
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { provider: 'xai', model: 'grok-3', name: 'Grok 3' },
  { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o' },
  { provider: 'google', model: 'gemini-2.0-pro-exp', name: 'Gemini 2 Pro' },
];

// Tier 3 cloud models (cost-focused)
const TIER3_COST_MODELS = [
  { provider: 'deepseek', model: 'deepseek-chat', name: 'DeepSeek V3' },
  { provider: 'xai', model: 'grok-3', name: 'Grok 3' },
  { provider: 'google', model: 'gemini-2.0-pro-exp', name: 'Gemini 2 Pro' },
  { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o' },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
];

// ─── Analysis Functions ──────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

function containsOnlyStyleKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  // Check if message is primarily about style
  const hasStyle = STYLE_KEYWORDS.some(k => lower.includes(k));
  const hasStructural = STRUCTURAL_KEYWORDS.some(k => lower.includes(k));
  const hasComplex = COMPLEX_FEATURE_KEYWORDS.some(k => lower.includes(k));
  const hasAdd = ADD_KEYWORDS.some(k => lower.includes(k));

  return hasStyle && !hasStructural && !hasComplex && !hasAdd;
}

function detectTaskType(message: string, hasCode: boolean): TaskType {
  const lower = message.toLowerCase();

  if (!hasCode) {
    return 'new_build';
  }

  if (containsAny(lower, FIX_KEYWORDS)) {
    return 'fix_bug';
  }

  if (containsOnlyStyleKeywords(message)) {
    return 'style_change';
  }

  if (containsAny(lower, CONTENT_SWAP_KEYWORDS)) {
    return 'content_change';
  }

  if (containsAny(lower, STRUCTURAL_KEYWORDS)) {
    return 'restructure';
  }

  if (containsAny(lower, COMPONENT_KEYWORDS)) {
    return 'add_component';
  }

  if (containsAny(lower, ADD_KEYWORDS)) {
    return 'add_component';
  }

  // Default based on message length
  const wordCount = countWords(message);
  if (wordCount < 20) {
    return 'minor_edit';
  }

  return 'major_edit';
}

function estimateTokens(message: string, currentCode: string | null): number {
  // Rough estimation: ~4 chars per token for English
  const messageTokens = Math.ceil(message.length / 4);
  const codeTokens = currentCode ? Math.ceil(currentCode.length / 4) : 0;

  // System prompt is roughly 500-1000 tokens
  const systemPromptTokens = 750;

  // Response will likely be similar size to current code or larger
  const estimatedResponseTokens = currentCode
    ? Math.ceil(codeTokens * 1.2)
    : 2000; // New builds average ~2000 tokens

  return messageTokens + codeTokens + systemPromptTokens + estimatedResponseTokens;
}

// ─── Tier Detection ──────────────────────────────────────────────────────────

function detectTier(message: string, currentCode: string | null): { tier: TaskTier; reason: string } {
  const wordCount = countWords(message);
  const hasCode = currentCode !== null && currentCode.trim().length > 0;
  const codeLength = currentCode?.length || 0;
  const lower = message.toLowerCase();

  // ─── TIER 1 CHECKS ─────────────────────────────────────────────────────────

  // Short message + existing code + style/content only
  if (hasCode && wordCount < 50) {
    // Style-only changes
    if (containsOnlyStyleKeywords(message)) {
      return { tier: 1, reason: 'Style change on existing code' };
    }

    // Content swaps
    if (containsAny(lower, CONTENT_SWAP_KEYWORDS) &&
        !containsAny(lower, STRUCTURAL_KEYWORDS) &&
        !containsAny(lower, ADD_KEYWORDS)) {
      return { tier: 1, reason: 'Content update on existing code' };
    }

    // Bug fixes / typos
    if (containsAny(lower, FIX_KEYWORDS) &&
        !containsAny(lower, STRUCTURAL_KEYWORDS)) {
      return { tier: 1, reason: 'Bug fix or typo correction' };
    }
  }

  // ─── TIER 3 CHECKS (check before Tier 2) ───────────────────────────────────

  // No existing code = new build from scratch
  if (!hasCode) {
    return { tier: 3, reason: 'New build from scratch' };
  }

  // Large codebase + structural changes
  if (codeLength > 15000 && containsAny(lower, STRUCTURAL_KEYWORDS)) {
    return { tier: 3, reason: 'Structural changes to large codebase' };
  }

  // Complex features requested
  if (containsAny(lower, COMPLEX_FEATURE_KEYWORDS)) {
    return { tier: 3, reason: 'Complex feature implementation' };
  }

  // Explicit rebuild keywords
  if (containsAny(lower, ['from scratch', 'completely new', 'redesign everything',
                          'start over', 'rebuild', 'overhaul'])) {
    return { tier: 3, reason: 'Full rebuild requested' };
  }

  // ─── TIER 2 CHECKS ─────────────────────────────────────────────────────────

  // Adding components to existing code
  if (hasCode && codeLength < 15000) {
    if (containsAny(lower, ADD_KEYWORDS)) {
      return { tier: 2, reason: 'Adding element to existing code' };
    }

    if (containsAny(lower, COMPONENT_KEYWORDS)) {
      return { tier: 2, reason: 'Adding component to existing code' };
    }
  }

  // Medium complexity edits
  if (hasCode && wordCount >= 50 && !containsAny(lower, STRUCTURAL_KEYWORDS)) {
    return { tier: 2, reason: 'Medium complexity edit' };
  }

  // ─── DEFAULT ───────────────────────────────────────────────────────────────

  // Default to Tier 2 for existing code, Tier 3 for new builds
  if (hasCode) {
    return { tier: 2, reason: 'General edit on existing code' };
  }

  return { tier: 3, reason: 'Complex task detected' };
}

// ─── Model Selection ─────────────────────────────────────────────────────────

let cachedOllamaModels: LocalModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

async function getAvailableLocalModels(): Promise<LocalModel[]> {
  const now = Date.now();
  if (cachedOllamaModels && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedOllamaModels;
  }

  try {
    cachedOllamaModels = await fetchOllamaModels();
    cacheTimestamp = now;
    return cachedOllamaModels;
  } catch {
    return cachedOllamaModels || [];
  }
}

async function selectTier1Model(): Promise<{ model: string; provider: string } | null> {
  const available = await getAvailableLocalModels();
  const availableIds = available.map(m => m.id.toLowerCase());

  // Find first preferred model that's available
  for (const preferred of TIER1_LOCAL_MODELS) {
    const match = availableIds.find(id =>
      id === preferred.toLowerCase() ||
      id.startsWith(preferred.split(':')[0].toLowerCase())
    );
    if (match) {
      const model = available.find(m => m.id.toLowerCase() === match);
      if (model) {
        return { model: model.id, provider: 'ollama' };
      }
    }
  }

  // Fall back to any available local model
  if (available.length > 0) {
    return { model: available[0].id, provider: 'ollama' };
  }

  return null;
}

function selectTier2Model(
  availableModels: { provider: string; models: string[] }[]
): { model: string; provider: string } | null {
  for (const tier2 of TIER2_MODELS) {
    const providerModels = availableModels.find(p => p.provider === tier2.provider);
    if (providerModels?.models.includes(tier2.model)) {
      return { model: tier2.model, provider: tier2.provider };
    }
  }
  return null;
}

function selectTier3Model(
  availableModels: { provider: string; models: string[] }[],
  preference: ModelPreference
): { model: string; provider: string } | null {
  const modelList = preference === 'quality' ? TIER3_QUALITY_MODELS : TIER3_COST_MODELS;

  for (const tier3 of modelList) {
    const providerModels = availableModels.find(p => p.provider === tier3.provider);
    if (providerModels?.models.includes(tier3.model)) {
      return { model: tier3.model, provider: tier3.provider };
    }
  }
  return null;
}

// ─── Main Analysis Function ──────────────────────────────────────────────────

export interface AnalyzeTaskOptions {
  preference?: ModelPreference;
  airGapMode?: boolean;
  availableCloudModels?: { provider: string; models: string[] }[];
}

export async function analyzeTask(
  userMessage: string,
  currentCode: string | null,
  options: AnalyzeTaskOptions = {}
): Promise<TaskAnalysis> {
  const {
    preference = 'cost',
    airGapMode = false,
    availableCloudModels = []
  } = options;

  const hasCode = currentCode !== null && currentCode.trim().length > 0;

  // Detect tier and task type
  const { tier, reason } = detectTier(userMessage, currentCode);
  const taskType = detectTaskType(userMessage, hasCode);
  const estimatedTokens = estimateTokens(userMessage, currentCode);

  // Select model based on tier
  let suggestedModel = '';
  let suggestedProvider = '';

  if (airGapMode) {
    // Air-gap: always use local
    const localModel = await selectTier1Model();
    if (localModel) {
      suggestedModel = localModel.model;
      suggestedProvider = localModel.provider;
    } else {
      // No local models available
      suggestedModel = 'none';
      suggestedProvider = 'none';
    }
  } else {
    switch (tier) {
      case 1: {
        const localModel = await selectTier1Model();
        if (localModel) {
          suggestedModel = localModel.model;
          suggestedProvider = localModel.provider;
        } else {
          // Fall back to Tier 2 if no local models
          const tier2Model = selectTier2Model(availableCloudModels);
          if (tier2Model) {
            suggestedModel = tier2Model.model;
            suggestedProvider = tier2Model.provider;
          }
        }
        break;
      }

      case 2: {
        const tier2Model = selectTier2Model(availableCloudModels);
        if (tier2Model) {
          suggestedModel = tier2Model.model;
          suggestedProvider = tier2Model.provider;
        } else {
          // Fall back to Tier 3
          const tier3Model = selectTier3Model(availableCloudModels, preference);
          if (tier3Model) {
            suggestedModel = tier3Model.model;
            suggestedProvider = tier3Model.provider;
          } else {
            // Fall back to local
            const localModel = await selectTier1Model();
            if (localModel) {
              suggestedModel = localModel.model;
              suggestedProvider = localModel.provider;
            }
          }
        }
        break;
      }

      case 3: {
        const tier3Model = selectTier3Model(availableCloudModels, preference);
        if (tier3Model) {
          suggestedModel = tier3Model.model;
          suggestedProvider = tier3Model.provider;
        } else {
          // Fall back to Tier 2
          const tier2Model = selectTier2Model(availableCloudModels);
          if (tier2Model) {
            suggestedModel = tier2Model.model;
            suggestedProvider = tier2Model.provider;
          } else {
            // Fall back to local
            const localModel = await selectTier1Model();
            if (localModel) {
              suggestedModel = localModel.model;
              suggestedProvider = localModel.provider;
            }
          }
        }
        break;
      }
    }
  }

  return {
    tier,
    reason,
    suggestedModel,
    suggestedProvider,
    estimatedTokens,
    taskType,
  };
}

// ─── Routing Decision Logging ────────────────────────────────────────────────

const ROUTING_LOG_KEY = 'builder-routing-log';
const MAX_LOG_ENTRIES = 100;

export function logRoutingDecision(decision: RoutingDecision): void {
  try {
    const existing = localStorage.getItem(ROUTING_LOG_KEY);
    const log: RoutingDecision[] = existing ? JSON.parse(existing) : [];

    // Add new entry
    log.unshift(decision);

    // Trim to max entries
    if (log.length > MAX_LOG_ENTRIES) {
      log.length = MAX_LOG_ENTRIES;
    }

    localStorage.setItem(ROUTING_LOG_KEY, JSON.stringify(log));
  } catch (err) {
    console.warn('[AutoRouter] Failed to log routing decision:', err);
  }
}

export function getRoutingLog(): RoutingDecision[] {
  try {
    const existing = localStorage.getItem(ROUTING_LOG_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

export function clearRoutingLog(): void {
  localStorage.removeItem(ROUTING_LOG_KEY);
}

// ─── Helper to get friendly model name ───────────────────────────────────────

export function getModelDisplayName(provider: string, model: string): string {
  // Check cloud models
  const allCloudModels = [...TIER2_MODELS, ...TIER3_QUALITY_MODELS];
  const cloudMatch = allCloudModels.find(m => m.provider === provider && m.model === model);
  if (cloudMatch) {
    return cloudMatch.name;
  }

  // For local models, clean up the name
  if (provider === 'ollama') {
    return model.split(':')[0].charAt(0).toUpperCase() + model.split(':')[0].slice(1);
  }

  return model;
}

// ─── Task Type Display Names ─────────────────────────────────────────────────

export function getTaskTypeDisplayName(taskType: TaskType): string {
  const names: Record<TaskType, string> = {
    'new_build': 'New Build',
    'minor_edit': 'Minor Edit',
    'major_edit': 'Major Edit',
    'add_component': 'Add Component',
    'restructure': 'Restructure',
    'style_change': 'Style Change',
    'content_change': 'Content Update',
    'fix_bug': 'Bug Fix',
  };
  return names[taskType] || taskType;
}
