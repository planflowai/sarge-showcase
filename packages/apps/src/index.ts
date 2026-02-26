// @sarge/apps — Standalone apps, each snaps onto @sarge/core independently

// ─── Apps Hub ────────────────────────────────────────────
export { default as AppsHub } from './hub/AppsHub';

// ─── Resume Tailor ───────────────────────────────────────
export { default as ResumeTailor } from './resume-tailor/components/ResumeTailor';
export { default as StageIndicator } from './resume-tailor/components/StageIndicator';
export { default as ResumeTailorPage } from './resume-tailor/ResumeTailorPage';
export * from './resume-tailor/resumeTailorStore';

// ─── Resume Tailor — Stages ─────────────────────────────
export { default as StageAnalysis } from './resume-tailor/components/stages/StageAnalysis';
export { default as StageCoverLetter } from './resume-tailor/components/stages/StageCoverLetter';
export { default as StageInput } from './resume-tailor/components/stages/StageInput';
export { default as StageJobSearch } from './resume-tailor/components/stages/StageJobSearch';
export { default as StageTailor } from './resume-tailor/components/stages/StageTailor';

// ─── Resume Tailor — Exporters ──────────────────────────
export * from './resume-tailor/export/resumePdf';
export * from './resume-tailor/export/resumeDocx';
