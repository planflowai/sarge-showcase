/**
 * Provider Wrapper - Drop-in Replacement for Direct Provider Calls
 *
 * Adds automatic fallback to all provider calls transparently.
 * Minimal integration - just replace direct provider calls with these wrappers.
 */

import { fallbackService } from './fallbackService';
import type { Provider } from "../types";
import type { Message } from "../types";
import { useAirGapStore, isCloudProvider } from "../../stores/airGapStore";

/**
 * Check if air-gap mode blocks this provider
 * Returns true if blocked, false if allowed
 */
function checkAirGapBlocking(provider: Provider, operation: string): boolean {
  const store = useAirGapStore.getState();
  if (store.airGapEnabled && isCloudProvider(provider)) {
    store.blockCloudAttempt(provider, operation);
    return true;
  }
  return false;
}

/**
 * Air-Gap Error - thrown when cloud access is blocked
 */
export class AirGapBlockedError extends Error {
  constructor(provider: Provider, operation: string) {
    super(`Air-Gap Mode: Cloud access to ${provider} blocked for ${operation}`);
    this.name = 'AirGapBlockedError';
  }
}

// Import provider implementations
import { chat as anthropicChat } from "../providers/anthropic";
import { chat as openaiChat } from "../providers/openai";
import { chat as googleChat } from "../providers/google";
import { chat as xaiChat } from "../providers/xai";
import { chat as deepseekChat } from "../providers/deepseek";
import { chat as ollamaChat } from "../providers/ollama";
import { chat as lmstudioChat } from "../providers/lmstudio";

// Import test provider implementations
import { OllamaProvider } from "../test-providers/ollama";
import { AnthropicProvider } from "../test-providers/anthropic";
import { OpenAIProvider } from "../test-providers/openai";
import { GoogleProvider } from "../test-providers/google";
import { XAIProvider } from "../test-providers/xai";

/**
 * Get API key for current provider
 * Handles switching API keys during fallback
 */
function getApiKey(provider: Provider, originalApiKey: string): string {
  // In production, would load from settings store
  // For now, assume API keys are configured globally
  if (typeof window !== 'undefined') {
    // Client-side: Load from localStorage
    const keys = JSON.parse(localStorage.getItem('sarge-api-keys') || '{}');
    return keys[provider] || originalApiKey;
  } else {
    // Server-side: Load from environment
    switch (provider) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || originalApiKey;
      case 'openai':
        return process.env.OPENAI_API_KEY || originalApiKey;
      case 'google':
        return process.env.GOOGLE_API_KEY || originalApiKey;
      case 'xai':
        return process.env.XAI_API_KEY || originalApiKey;
      case 'deepseek':
        return process.env.DEEPSEEK_API_KEY || originalApiKey;
      case 'ollama':
        return ''; // Ollama doesn't need API key
      case 'lmstudio':
        return process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || '';
      default:
        return originalApiKey;
    }
  }
}

/**
 * Chat with automatic fallback
 * Drop-in replacement for direct provider chat calls
 *
 * Usage:
 *   // BEFORE: const response = await anthropicChat(messages, model, apiKey);
 *   // AFTER:  const response = await chatWithFallback(messages, 'anthropic', model, apiKey);
 */
export async function chatWithFallback(
  messages: Message[],
  provider: Provider,
  model: string,
  apiKey: string,
  sessionId?: string
): Promise<any> {
  // Air-Gap check: Block cloud providers when air-gap is enabled
  if (checkAirGapBlocking(provider, 'chat')) {
    throw new AirGapBlockedError(provider, 'chat');
  }

  const result = await fallbackService.executeWithFallback(
    provider,
    model,
    async (currentProvider, currentModel) => {
      const currentApiKey = getApiKey(currentProvider, apiKey);

      switch (currentProvider) {
        case 'anthropic':
          return await anthropicChat(messages, currentModel, currentApiKey);
        case 'openai':
          return await openaiChat(messages, currentModel, currentApiKey);
        case 'google':
          return await googleChat(messages, currentModel, currentApiKey);
        case 'xai':
          return await xaiChat(messages, currentModel, currentApiKey);
        case 'deepseek':
          return await deepseekChat(messages, currentModel, currentApiKey);
        case 'ollama':
          return await ollamaChat(messages, currentModel);
        case 'lmstudio':
          return await lmstudioChat(messages, currentModel, currentApiKey);
        default:
          throw new Error(`Unsupported provider: ${currentProvider}`);
      }
    },
    sessionId
  );

  if (result.success && result.data) {
    // Add fallback metadata to response
    return {
      ...result.data,
      _fallback: result.usedFallback ? {
        originalModel: model,
        originalProvider: provider,
        fallbackModel: result.fallbackModel?.model,
        fallbackProvider: result.fallbackModel?.provider,
        attempts: result.attempts.length,
        timeMs: result.attempts.reduce((sum, a) => sum + a.timeMs, 0)
      } : undefined
    };
  } else {
    // All fallbacks exhausted
    const attemptedModels = result.attempts.map(a => `${a.provider}:${a.model}`).join(', ');
    const finalError = result.finalError?.originalError || new Error('All fallbacks exhausted');

    // Augment error with fallback information
    (finalError as any).fallbackAttempts = result.attempts;
    (finalError as any).attemptedModels = attemptedModels;

    throw finalError;
  }
}

/**
 * Completion with automatic fallback (for batch tests)
 * Drop-in replacement for test provider complete() calls
 *
 * Usage:
 *   // BEFORE: const result = await provider.complete(model, prompt, systemPrompt);
 *   // AFTER:  const result = await completionWithFallback(model, prompt, systemPrompt, source, cloudProvider);
 */
export async function completionWithFallback(
  model: string,
  prompt: string,
  systemPrompt: string | undefined,
  source: 'local' | 'cloud',
  cloudProvider?: Provider,
  sessionId?: string
): Promise<any> {
  // Determine primary provider
  const provider: Provider = source === 'local' ? 'ollama' : (cloudProvider || 'anthropic');

  // Air-Gap check: Block cloud providers when air-gap is enabled
  if (checkAirGapBlocking(provider, 'completion')) {
    throw new AirGapBlockedError(provider, 'completion');
  }

  const result = await fallbackService.executeWithFallback(
    provider,
    model,
    async (currentProvider, currentModel) => {
      const currentApiKey = getApiKey(currentProvider, '');

      // Create provider instance
      let providerInstance;
      switch (currentProvider) {
        case 'anthropic':
          providerInstance = new AnthropicProvider(currentApiKey);
          break;
        case 'openai':
          providerInstance = new OpenAIProvider(currentApiKey);
          break;
        case 'google':
          providerInstance = new GoogleProvider(currentApiKey);
          break;
        case 'xai':
          providerInstance = new XAIProvider(currentApiKey);
          break;
        case 'ollama':
          providerInstance = new OllamaProvider('http://localhost:11434');
          break;
        default:
          throw new Error(`Unsupported provider: ${currentProvider}`);
      }

      // Call complete
      return await providerInstance.complete(currentModel, prompt, systemPrompt);
    },
    sessionId
  );

  if (result.success && result.data) {
    // Add fallback metadata to response
    return {
      ...result.data,
      _fallback: result.usedFallback ? {
        originalModel: model,
        originalProvider: provider,
        fallbackModel: result.fallbackModel?.model,
        fallbackProvider: result.fallbackModel?.provider,
        attempts: result.attempts.length,
        totalTimeMs: result.attempts.reduce((sum, a) => sum + a.timeMs, 0)
      } : undefined
    };
  } else {
    // All fallbacks exhausted
    const attemptedModels = result.attempts.map(a => `${a.provider}:${a.model}`).join(', ');
    const finalError = result.finalError?.originalError || new Error('All fallbacks exhausted');

    // Augment error with fallback information
    (finalError as any).fallbackAttempts = result.attempts;
    (finalError as any).attemptedModels = attemptedModels;

    throw finalError;
  }
}

/**
 * Streaming completion with automatic fallback (for batch tests with streaming)
 * Returns async generator for streaming responses
 */
export async function* streamCompletionWithFallback(
  model: string,
  prompt: string,
  systemPrompt: string | undefined,
  source: 'local' | 'cloud',
  cloudProvider?: Provider,
  sessionId?: string
): AsyncGenerator<string, void, unknown> {
  // Determine primary provider
  const provider: Provider = source === 'local' ? 'ollama' : (cloudProvider || 'anthropic');

  // Air-Gap check: Block cloud providers when air-gap is enabled
  if (checkAirGapBlocking(provider, 'stream')) {
    throw new AirGapBlockedError(provider, 'stream');
  }

  const result = await fallbackService.executeWithFallback(
    provider,
    model,
    async (currentProvider, currentModel) => {
      const currentApiKey = getApiKey(currentProvider, '');

      // Create provider instance - only OllamaProvider supports streamComplete
      // For streaming, we currently only support Ollama
      if (currentProvider !== 'ollama') {
        throw new Error(`Streaming not supported for provider: ${currentProvider}. Only Ollama supports streaming via this API.`);
      }

      const providerInstance = new OllamaProvider('http://localhost:11434');

      // Collect streaming response
      const chunks: string[] = [];
      for await (const chunk of providerInstance.streamComplete(currentModel, prompt, systemPrompt)) {
        chunks.push(chunk);
      }

      return {
        content: chunks.join(''),
        chunks
      };
    },
    sessionId
  );

  if (result.success && result.data) {
    // Yield chunks
    for (const chunk of result.data.chunks) {
      yield chunk;
    }
  } else {
    // All fallbacks exhausted
    const attemptedModels = result.attempts.map(a => `${a.provider}:${a.model}`).join(', ');
    throw new Error(`All fallbacks exhausted. Attempted: ${attemptedModels}`);
  }
}
