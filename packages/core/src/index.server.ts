// @sarge/core/index.server — Server-only exports
// These use Node.js modules (fs, crypto, path, ollama npm package)
// Do NOT import this file in client/browser bundles

// ─── Providers (ollama uses node:fs) ─────────────────────
export * from './lib/providers';
export { fetchOllamaModels, fetchLMStudioModels, type LocalModel } from './lib/providers/localModels';
export { groupOllamaModels } from './lib/ollamaModelGroups';

// ─── Supabase ───────────────────────────────────────────
export { processQueuedItem, fetchSupabaseBuilderLog } from './lib/supabase/syncQueue';

// ─── Fallback (providerWrapper imports ollama) ──────────
export * from './lib/fallback/circuitBreaker';
export * from './lib/fallback/config';
export * from './lib/fallback/errorClassification';
export * from './lib/fallback/fallbackService';
export * from './lib/fallback/providerWrapper';
export * from './lib/fallback/retry';

// ─── Security (uses Node crypto, fs, path) ──────────────
export * from './lib/security/cyberSecure';
export * from './lib/security/pathValidator';
