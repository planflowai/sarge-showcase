/**
 * Fallback Chain Configuration
 *
 * Defines fallback chains (primary model → fallback models) and retry strategies.
 * Each primary model has 3-4 fallback models from different providers.
 */

import type { Provider } from '@/lib/types';
import { ErrorType } from './errorClassification';

export interface FallbackModel {
  provider: Provider;
  model: string;
  priority: number; // Lower = higher priority (0 = primary)
  contextWindow: number;
  maxTokens: number;
  requiresAuth: boolean;
}

export interface FallbackChain {
  primary: FallbackModel;
  fallbacks: FallbackModel[];
}

export interface FallbackConfig {
  // Per-model fallback chains
  modelChains: Record<string, FallbackChain>;

  // Global settings
  maxRetries: number;
  maxFallbackDepth: number; // Max number of fallbacks to try
  retryDelayMs: number; // Base delay for exponential backoff
  timeoutMs: number; // Request timeout

  // Circuit breaker
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number; // Failures before circuit opens
    resetTimeoutMs: number; // Time before attempting reset
    halfOpenMaxAttempts: number; // Attempts in half-open state
  };

  // Error-specific retry strategies
  retryStrategy: {
    [ErrorType.RATE_LIMIT]: { maxRetries: number; backoffMultiplier: number };
    [ErrorType.TIMEOUT]: { maxRetries: number; backoffMultiplier: number };
    [ErrorType.SERVICE_UNAVAILABLE]: { maxRetries: number; backoffMultiplier: number };
    [ErrorType.CONNECTION_ERROR]: { maxRetries: number; backoffMultiplier: number };
  };
}

// Default fallback chains for each primary model
export const DEFAULT_FALLBACK_CHAINS: Record<string, FallbackChain> = {
  // Claude Opus 4.6 fallback chain (newest, most intelligent)
  'claude-opus-4-6': {
    primary: {
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      priority: 0,
      contextWindow: 200000,
      maxTokens: 8192,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        priority: 1,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        priority: 2,
        contextWindow: 128000,
        maxTokens: 4096,
        requiresAuth: true
      },
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 3,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      }
    ]
  },

  // Claude Sonnet 4.5 fallback chain (fast + intelligent)
  'claude-sonnet-4-5-20250929': {
    primary: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      priority: 0,
      contextWindow: 200000,
      maxTokens: 8192,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        priority: 1,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        priority: 2,
        contextWindow: 128000,
        maxTokens: 4096,
        requiresAuth: true
      },
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 3,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      }
    ]
  },

  // Claude Haiku 4.5 fallback chain (fastest)
  'claude-haiku-4-5-20251001': {
    primary: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      priority: 0,
      contextWindow: 200000,
      maxTokens: 8192,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 1,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        priority: 2,
        contextWindow: 128000,
        maxTokens: 4096,
        requiresAuth: true
      }
    ]
  },

  // Claude Sonnet 4 fallback chain (legacy)
  'claude-sonnet-4-20250514': {
    primary: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      priority: 0,
      contextWindow: 200000,
      maxTokens: 8192,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        priority: 1,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        priority: 2,
        contextWindow: 128000,
        maxTokens: 4096,
        requiresAuth: true
      },
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 3,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      }
    ]
  },

  // Claude Opus 4 fallback chain (legacy)
  'claude-opus-4-20250514': {
    primary: {
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      priority: 0,
      contextWindow: 200000,
      maxTokens: 8192,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        priority: 1,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        priority: 2,
        contextWindow: 128000,
        maxTokens: 4096,
        requiresAuth: true
      },
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 3,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      }
    ]
  },

  // GPT-4o fallback chain
  'gpt-4o': {
    primary: {
      provider: 'openai',
      model: 'gpt-4o',
      priority: 0,
      contextWindow: 128000,
      maxTokens: 4096,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        priority: 1,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 2,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'xai',
        model: 'grok-4',
        priority: 3,
        contextWindow: 131072,
        maxTokens: 4096,
        requiresAuth: true
      }
    ]
  },

  // GPT-4o-mini fallback chain
  'gpt-4o-mini': {
    primary: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      priority: 0,
      contextWindow: 128000,
      maxTokens: 4096,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 1,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        priority: 2,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      }
    ]
  },

  // Gemini fallback chain
  'gemini-2.0-flash': {
    primary: {
      provider: 'google',
      model: 'gemini-2.0-flash',
      priority: 0,
      contextWindow: 1000000,
      maxTokens: 8192,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        priority: 1,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        priority: 2,
        contextWindow: 128000,
        maxTokens: 4096,
        requiresAuth: true
      },
      {
        provider: 'xai',
        model: 'grok-4',
        priority: 3,
        contextWindow: 131072,
        maxTokens: 4096,
        requiresAuth: true
      }
    ]
  },

  // Grok fallback chain
  'grok-4': {
    primary: {
      provider: 'xai',
      model: 'grok-4',
      priority: 0,
      contextWindow: 131072,
      maxTokens: 4096,
      requiresAuth: true
    },
    fallbacks: [
      {
        provider: 'openai',
        model: 'gpt-4o',
        priority: 1,
        contextWindow: 128000,
        maxTokens: 4096,
        requiresAuth: true
      },
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        priority: 2,
        contextWindow: 200000,
        maxTokens: 8192,
        requiresAuth: true
      },
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        priority: 3,
        contextWindow: 1000000,
        maxTokens: 8192,
        requiresAuth: true
      }
    ]
  },

  // Ollama models - NO fallback by default (keep local isolated)
  'ollama:*': {
    primary: {
      provider: 'ollama',
      model: '*', // Any ollama model
      priority: 0,
      contextWindow: 8192,
      maxTokens: 2048,
      requiresAuth: false
    },
    fallbacks: [] // No fallback for local - keep isolated unless explicitly configured
  }
};

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  modelChains: DEFAULT_FALLBACK_CHAINS,
  maxRetries: 3,
  maxFallbackDepth: 3, // Try up to 3 fallback models
  retryDelayMs: 1000, // Start with 1 second
  timeoutMs: 60000, // 60 second timeout

  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    halfOpenMaxAttempts: 2
  },

  retryStrategy: {
    [ErrorType.RATE_LIMIT]: {
      maxRetries: 2,
      backoffMultiplier: 2
    },
    [ErrorType.TIMEOUT]: {
      maxRetries: 3,
      backoffMultiplier: 1.5
    },
    [ErrorType.SERVICE_UNAVAILABLE]: {
      maxRetries: 2,
      backoffMultiplier: 2
    },
    [ErrorType.CONNECTION_ERROR]: {
      maxRetries: 3,
      backoffMultiplier: 1.5
    }
  }
};

/**
 * Get fallback chain for a given model
 * Handles wildcard matching for Ollama
 */
export function getFallbackChain(model: string, provider: Provider): FallbackChain | null {
  // Exact match first
  if (DEFAULT_FALLBACK_CHAINS[model]) {
    return DEFAULT_FALLBACK_CHAINS[model];
  }

  // Ollama wildcard match
  if (provider === 'ollama' && DEFAULT_FALLBACK_CHAINS['ollama:*']) {
    const chain = DEFAULT_FALLBACK_CHAINS['ollama:*'];
    return {
      ...chain,
      primary: { ...chain.primary, model }
    };
  }

  return null;
}
