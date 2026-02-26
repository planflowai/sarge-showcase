// @sarge/core — Foundation plate for all SARGE packages
// Default barrel = client-safe only (no Node.js modules)
// For server-only exports (providers, fallback, security), use:
//   import { ... } from '@sarge/core/index.server'

// ─── Client-safe exports ────────────────────────────────
export * from './index.client';

// ─── Providers config (static data, no Node.js deps) ────
export * from './lib/providers';
export { fetchOllamaModels, fetchLMStudioModels, type LocalModel } from './lib/providers/localModels';
