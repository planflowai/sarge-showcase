/**
 * Retry Logic with Exponential Backoff
 *
 * Implements exponential backoff and retry decision logic.
 */

import { ErrorType, ClassifiedError } from './errorClassification';
import type { FallbackConfig } from './config';

/**
 * Exponential backoff with jitter
 * Prevents thundering herd problem
 */
export async function exponentialBackoff(
  attemptNumber: number,
  baseDelayMs: number,
  multiplier: number,
  maxDelayMs: number = 30000
): Promise<void> {
  const delay = Math.min(
    baseDelayMs * Math.pow(multiplier, attemptNumber - 1),
    maxDelayMs
  );

  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  const actualDelay = delay + jitter;

  await new Promise(resolve => setTimeout(resolve, actualDelay));
}

/**
 * Determine if error should be retried
 */
export function shouldRetry(
  error: ClassifiedError,
  attemptNumber: number,
  config: FallbackConfig
): boolean {
  // Never retry non-retriable errors
  if (!error.retriable) {
    return false;
  }

  // Check error-specific retry limits (only for types that have a strategy defined)
  const strategy = (config.retryStrategy as Record<ErrorType, { maxRetries: number; backoffMultiplier: number } | undefined>)[error.type];
  if (strategy && attemptNumber > strategy.maxRetries) {
    return false;
  }

  // Check global retry limit
  if (attemptNumber > config.maxRetries) {
    return false;
  }

  return true;
}

/**
 * Get retry delay for specific error type
 */
export function getRetryDelay(
  error: ClassifiedError,
  attemptNumber: number,
  config: FallbackConfig
): number {
  const strategy = (config.retryStrategy as Record<ErrorType, { maxRetries: number; backoffMultiplier: number } | undefined>)[error.type];
  const multiplier = strategy?.backoffMultiplier || 2;

  // Respect server-provided retry-after header
  if (error.metadata.retryAfter) {
    return error.metadata.retryAfter * 1000;
  }

  return config.retryDelayMs * Math.pow(multiplier, attemptNumber - 1);
}
