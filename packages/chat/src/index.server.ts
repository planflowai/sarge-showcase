// @sarge/chat/index.server — Heavy exports with transitive deps
// These pull in @sarge/diagnostics, @sarge/builder, or Node modules
// Do NOT import this file in lightweight client bundles

// ─── Components — Debate (needs @sarge/builder) ─────────
export { ExecutiveSummaryModal } from './components/debate/ExecutiveSummaryModal';

// ─── Components — Forensic (needs @sarge/diagnostics) ───
export { ForensicLogView } from './components/forensic/ForensicLogView';
export { ForensicSidebar } from './components/forensic/ForensicSidebar';
export { TimelineView } from './components/forensic/TimelineView';
export { InvestigationView } from './components/forensic/InvestigationView';
export { ReplayView } from './components/forensic/ReplayView';
export { ExportView } from './components/forensic/ExportView';

// ─── Components — Test ──────────────────────────────────
export { TestModeView } from './components/test/TestModeView';
export { TestModeLLMSection } from './components/test/TestModeLLMSection';
export { BatchView } from './components/test/BatchView';
export { LiveConsolePanel } from './components/test/LiveConsolePanel';
export { LivePassColumn } from './components/test/LivePassColumn';
