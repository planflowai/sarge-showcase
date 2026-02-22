/**
 * Error Classification System
 *
 * Detects and classifies API errors into retriable vs non-retriable categories.
 * Handles provider-specific error formats from Anthropic, OpenAI, Google, xAI, and Ollama.
 */

export enum ErrorType {
  // Retriable errors - should attempt fallback
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',           // 404
  RATE_LIMIT = 'RATE_LIMIT',                     // 429
  OUT_OF_TOKENS = 'OUT_OF_TOKENS',               // 429 with quota message
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',   // 503
  TIMEOUT = 'TIMEOUT',                           // Request timeout
  CONNECTION_ERROR = 'CONNECTION_ERROR',         // Network failure
  OVERLOADED = 'OVERLOADED',                     // 529 (Anthropic-specific)

  // Non-retriable errors - should NOT fallback
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED', // 401
  INVALID_REQUEST = 'INVALID_REQUEST',           // 400
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED', // Context too long
  CONTENT_POLICY_VIOLATION = 'CONTENT_POLICY_VIOLATION', // Blocked by safety

  // Unknown - should log and decide based on config
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ClassifiedError {
  type: ErrorType;
  originalError: any;
  statusCode?: number;
  message: string;
  provider: string;
  model: string;
  retriable: boolean;
  suggestedAction: 'retry_same' | 'fallback' | 'fail';
  metadata: {
    quotaResetAt?: string;
    retryAfter?: number; // seconds
    errorCode?: string;
  };
}

/**
 * Classify error from provider response
 * Handles provider-specific error formats
 */
export function classifyError(
  error: any,
  provider: string,
  model: string
): ClassifiedError {
  // Extract status code and message
  const statusCode = extractStatusCode(error);
  const message = extractErrorMessage(error);
  const errorCode = extractErrorCode(error, provider);

  let type: ErrorType;
  let retriable = false;
  let suggestedAction: ClassifiedError['suggestedAction'] = 'fail';
  const metadata: ClassifiedError['metadata'] = { errorCode };

  // Classify by status code first
  if (statusCode === 404) {
    type = ErrorType.MODEL_NOT_FOUND;
    retriable = true;
    suggestedAction = 'fallback';
  } else if (statusCode === 429) {
    // Distinguish rate limit vs out of tokens
    if (message.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('insufficient') ||
        message.toLowerCase().includes('credits') ||
        message.toLowerCase().includes('resource_exhausted')) {
      type = ErrorType.OUT_OF_TOKENS;
      retriable = true;
      suggestedAction = 'fallback'; // Don't retry, switch provider
    } else {
      type = ErrorType.RATE_LIMIT;
      retriable = true;
      suggestedAction = 'retry_same'; // Can retry after backoff
      metadata.retryAfter = extractRetryAfter(error);
    }
  } else if (statusCode === 503 || statusCode === 529) {
    type = ErrorType.SERVICE_UNAVAILABLE;
    retriable = true;
    suggestedAction = 'fallback';
  } else if (statusCode === 401 || statusCode === 403) {
    type = ErrorType.AUTHENTICATION_FAILED;
    retriable = false;
    suggestedAction = 'fail';
  } else if (statusCode === 400) {
    // Check if it's context length
    if (message.toLowerCase().includes('context') ||
        message.toLowerCase().includes('max_tokens') ||
        message.toLowerCase().includes('too long') ||
        message.toLowerCase().includes('maximum context')) {
      type = ErrorType.CONTEXT_LENGTH_EXCEEDED;
      retriable = true;
      suggestedAction = 'fallback'; // Switch to model with larger context
    } else if (message.toLowerCase().includes('content_policy') ||
               message.toLowerCase().includes('safety') ||
               message.toLowerCase().includes('blocked')) {
      type = ErrorType.CONTENT_POLICY_VIOLATION;
      retriable = false;
      suggestedAction = 'fail';
    } else {
      type = ErrorType.INVALID_REQUEST;
      retriable = false;
      suggestedAction = 'fail';
    }
  } else if (isTimeoutError(error)) {
    type = ErrorType.TIMEOUT;
    retriable = true;
    suggestedAction = 'retry_same';
  } else if (isConnectionError(error)) {
    type = ErrorType.CONNECTION_ERROR;
    retriable = true;
    suggestedAction = 'fallback';
  } else {
    type = ErrorType.UNKNOWN_ERROR;
    retriable = true; // Conservative: allow fallback for unknown errors
    suggestedAction = 'fallback';
  }

  return {
    type,
    originalError: error,
    statusCode,
    message,
    provider,
    model,
    retriable,
    suggestedAction,
    metadata
  };
}

// Helper functions

function extractStatusCode(error: any): number | undefined {
  return error?.status ||
         error?.statusCode ||
         error?.response?.status ||
         error?.response?.statusCode ||
         error?.code; // For fetch errors
}

function extractErrorMessage(error: any): string {
  return error?.message ||
         error?.error?.message ||
         error?.response?.data?.error?.message ||
         error?.response?.error?.message ||
         error?.body?.error?.message ||
         String(error);
}

function extractErrorCode(error: any, provider: string): string | undefined {
  // Provider-specific error codes
  if (provider === 'anthropic') {
    return error?.error?.type || error?.type;
  } else if (provider === 'openai') {
    return error?.error?.code || error?.code;
  } else if (provider === 'google') {
    return error?.error?.status || error?.status;
  } else if (provider === 'xai') {
    return error?.error?.code || error?.code;
  }
  return undefined;
}

function extractRetryAfter(error: any): number | undefined {
  const retryAfter = error?.headers?.['retry-after'] ||
                     error?.response?.headers?.['retry-after'] ||
                     error?.response?.headers?.get?.('retry-after');
  return retryAfter ? parseInt(String(retryAfter), 10) : undefined;
}

function isTimeoutError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('timeout') ||
         msg.includes('timed out') ||
         error?.code === 'ETIMEDOUT' ||
         error?.code === 'ECONNABORTED' ||
         error?.name === 'TimeoutError';
}

function isConnectionError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('econnrefused') ||
         msg.includes('enotfound') ||
         msg.includes('network') ||
         msg.includes('fetch failed') ||
         msg.includes('connection refused') ||
         error?.code === 'ECONNREFUSED' ||
         error?.code === 'ENOTFOUND' ||
         error?.code === 'ENETUNREACH';
}
