// @sarge/diagnostics — Diagnostics module, snaps onto @sarge/core
// Scanner, AI analysis, forensic logging

// ─── Stores ──────────────────────────────────────────────
export * from './stores/diagnosticsStore';
export * from './stores/aiAnalysisStore';

// ─── Components ──────────────────────────────────────────
export { default as DiagnosticsPage } from './components/DiagnosticsPage';

// ─── Lib ─────────────────────────────────────────────────
// scanner.ts uses Node.js fs/path — only import it directly in server-side code
// e.g. import { scanCodebase } from '@sarge/diagnostics/lib/scanner'
export type { ScanResult, ScanProgress } from './lib/scanner';
