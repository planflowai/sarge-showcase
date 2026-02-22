/**
 * Fallback Service - Core Orchestration
 *
 * Main orchestration logic that coordinates error classification, retry, fallback, and logging.
 */

import { classifyError, ClassifiedError, ErrorType } from './errorClassification';
import { CircuitBreaker } from './circuitBreaker';
import { exponentialBackoff, shouldRetry, getRetryDelay } from './retry';
import { getFallbackChain, DEFAULT_FALLBACK_CONFIG } from './config';
import type { Provider } from '@/lib/types';

export interface FallbackAttempt {
  attemptNumber: number;
  provider: Provider;
  model: string;
  error?: ClassifiedError;
  success: boolean;
  timeMs: number;
  usedFallback: boolean;
}

export interface FallbackResult<T> {
  data: T | null;
  success: boolean;
  attempts: FallbackAttempt[];
  finalError?: ClassifiedError;
  usedFallback: boolean;
  fallbackModel?: { provider: Provider; model: string };
}

export class FallbackService {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    // Initialize circuit breaker from config
    // In production, would load from fallbackStore
    const config = DEFAULT_FALLBACK_CONFIG;
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.resetTimeoutMs,
      config.circuitBreaker.halfOpenMaxAttempts
    );
  }

  /**
   * Execute function with automatic fallback and retry
   *
   * @param primaryProvider - Initial provider to try
   * @param primaryModel - Initial model to try
   * @param executeFn - Function that executes the API call
   * @param sessionId - Optional forensic session ID for logging
   */
  async executeWithFallback<T>(
    primaryProvider: Provider,
    primaryModel: string,
    executeFn: (provider: Provider, model: string) => Promise<T>,
    sessionId?: string
  ): Promise<FallbackResult<T>> {
    // Load config (in production, from fallbackStore)
    const config = DEFAULT_FALLBACK_CONFIG;

    const attempts: FallbackAttempt[] = [];
    let currentProvider = primaryProvider;
    let currentModel = primaryModel;
    let usedFallback = false;

    // Get fallback chain
    const fallbackChain = getFallbackChain(primaryModel, primaryProvider);
    const fallbackModels = fallbackChain?.fallbacks || [];
    let fallbackIndex = -1;

    // Log start (if logging enabled)
    if (sessionId) {
      this.logFallbackEvent(sessionId, 'fallback_start', 'info', {
        primaryProvider,
        primaryModel,
        fallbacksAvailable: fallbackModels.length
      });
    }

    // Main retry/fallback loop
    while (true) {
      const circuitKey = `${currentProvider}:${currentModel}`;

      // Check circuit breaker
      if (config.circuitBreaker.enabled && !this.circuitBreaker.canAttempt(circuitKey)) {
        if (sessionId) {
          this.logFallbackEvent(sessionId, 'circuit_breaker_open', 'warning', {
            provider: currentProvider,
            model: currentModel
          });
        }

        // Circuit is open, try fallback immediately
        if (fallbackIndex < fallbackModels.length - 1) {
          fallbackIndex++;
          currentProvider = fallbackModels[fallbackIndex].provider;
          currentModel = fallbackModels[fallbackIndex].model;
          usedFallback = true;
          continue;
        } else {
          // No more fallbacks
          break;
        }
      }

      // Attempt execution
      const startTime = Date.now();
      const attemptNumber = attempts.filter(
        a => a.provider === currentProvider && a.model === currentModel
      ).length + 1;

      try {
        const result = await executeFn(currentProvider, currentModel);
        const timeMs = Date.now() - startTime;

        // Success!
        this.circuitBreaker.recordSuccess(circuitKey);

        attempts.push({
          attemptNumber,
          provider: currentProvider,
          model: currentModel,
          success: true,
          timeMs,
          usedFallback
        });

        if (sessionId) {
          this.logFallbackEvent(sessionId, 'fallback_success', 'success', {
            provider: currentProvider,
            model: currentModel,
            attemptNumber,
            timeMs,
            usedFallback
          });
        }

        return {
          data: result,
          success: true,
          attempts,
          usedFallback,
          fallbackModel: usedFallback ? { provider: currentProvider, model: currentModel } : undefined
        };

      } catch (error: any) {
        const timeMs = Date.now() - startTime;
        const classified = classifyError(error, currentProvider, currentModel);

        this.circuitBreaker.recordFailure(circuitKey);

        attempts.push({
          attemptNumber,
          provider: currentProvider,
          model: currentModel,
          error: classified,
          success: false,
          timeMs,
          usedFallback
        });

        if (sessionId) {
          this.logFallbackEvent(sessionId, 'fallback_attempt_failed', 'warning', {
            provider: currentProvider,
            model: currentModel,
            attemptNumber,
            errorType: classified.type,
            errorMessage: classified.message,
            retriable: classified.retriable
          });
        }

        // Decide: retry same model or try fallback?
        if (classified.suggestedAction === 'retry_same' &&
            shouldRetry(classified, attemptNumber, config)) {
          // Retry same model with backoff
          const delay = getRetryDelay(classified, attemptNumber, config);
          await exponentialBackoff(attemptNumber, delay, 1.5);
          continue;

        } else if (classified.suggestedAction === 'fallback' &&
                   fallbackIndex < fallbackModels.length - 1 &&
                   fallbackIndex < config.maxFallbackDepth - 1) {
          // Try next fallback model
          fallbackIndex++;
          currentProvider = fallbackModels[fallbackIndex].provider;
          currentModel = fallbackModels[fallbackIndex].model;
          usedFallback = true;

          if (sessionId) {
            this.logFallbackEvent(sessionId, 'switching_to_fallback', 'info', {
              fromProvider: attempts[attempts.length - 1].provider,
              fromModel: attempts[attempts.length - 1].model,
              toProvider: currentProvider,
              toModel: currentModel,
              reason: classified.type
            });
          }

          continue;

        } else {
          // No more retries or fallbacks, fail
          if (sessionId) {
            this.logFallbackEvent(sessionId, 'all_fallbacks_exhausted', 'critical', {
              totalAttempts: attempts.length,
              finalError: classified.type
            });
          }

          return {
            data: null,
            success: false,
            attempts,
            finalError: classified,
            usedFallback
          };
        }
      }
    }

    // Should never reach here, but handle gracefully
    return {
      data: null,
      success: false,
      attempts,
      finalError: attempts[attempts.length - 1]?.error,
      usedFallback
    };
  }

  private logFallbackEvent(
    sessionId: string,
    event: string,
    severity: 'info' | 'warning' | 'critical' | 'success',
    metadata: Record<string, any>
  ): void {
    // In production, log to forensicLogStore
    // For now, just console.log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Fallback] ${event}:`, metadata);
    }

    // TODO: Integrate with forensicLogStore when ready
    // const forensic = useForensicLogStore.getState();
    // forensic.captureEntry({
    //   sessionId,
    //   category: 'system',
    //   event: `Fallback: ${event}`,
    //   severity,
    //   input: JSON.stringify(metadata, null, 2),
    //   systemState: metadata
    // });
  }
}

// Singleton instance
export const fallbackService = new FallbackService();
