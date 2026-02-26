// @sarge/apps — Standalone apps, each snaps onto @sarge/core independently

// ─── Apps Hub ────────────────────────────────────────────
export { default as AppsHub } from './hub/AppsHub';

// ─── Resume Tailor ───────────────────────────────────────
export { ResumeTailor } from './resume-tailor/components/ResumeTailor';
export { StageIndicator } from './resume-tailor/components/StageIndicator';
export { default as ResumeTailorPage } from './resume-tailor/ResumeTailorPage';
export * from './resume-tailor/resumeTailorStore';

// ─── Resume Tailor — Stages ─────────────────────────────
export { StageAnalysis } from './resume-tailor/components/stages/StageAnalysis';
export { StageCoverLetter } from './resume-tailor/components/stages/StageCoverLetter';
export { StageInput } from './resume-tailor/components/stages/StageInput';
export { StageJobSearch } from './resume-tailor/components/stages/StageJobSearch';
export { StageTailor } from './resume-tailor/components/stages/StageTailor';

// ─── Resume Tailor — Exporters ──────────────────────────
export * from './resume-tailor/export/resumePdf';
export * from './resume-tailor/export/resumeDocx';
