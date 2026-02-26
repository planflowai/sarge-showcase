// @sarge/diagnostics — Diagnostics module, snaps onto @sarge/core
// Scanner, AI analysis, forensic logging

// ─── Stores ──────────────────────────────────────────────
export * from './stores/diagnosticsStore';
export * from './stores/aiAnalysisStore';

// ─── Components ──────────────────────────────────────────
export { default as DiagnosticsPage } from './components/DiagnosticsPage';

// ─── Lib ─────────────────────────────────────────────────
export * from './lib/scanner';
