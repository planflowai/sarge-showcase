"use client";

import { create } from "zustand";

export type ScanDepth = "quick" | "standard" | "deep";

export interface DiagnosticCheck {
  id: string;
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
}

export interface Finding {
  id: string;
  file: string;
  line: number;
  column?: number;
  type: "error" | "warning" | "enhancement" | "security";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  code: string;
  suggestedFix?: string;
  explanation?: string;
  aiExplanation?: string;
  details?: Record<string, unknown>;
}

export interface SnapshotFile {
  path: string;
  content?: string;
}

export interface Snapshot {
  id: string;
  label: string;
  description?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  files: SnapshotFile[];
}

interface DiagnosticsState {
  // Scan state
  isScanning: boolean;
  scanProgress: number;
  scanPhase: string;
  scanDepth: ScanDepth;
  totalFiles: number;
  filesScanned: number;
  findings: Finding[];
  selectedFindingId: string | null;
  canResume: boolean;
  lastScanTime: Date | null;

  // Analysis state
  analysisProvider: string;
  analysisModel: string;

  // Changelog & snapshots
  changelog: any[];
  snapshots: Snapshot[];
  undoStack: any[];

  // Custom request
  prefilledCustomRequest: { request: string; target: string } | null;

  // Basic state
  checks: DiagnosticCheck[];
  hydrated: boolean;

  // Actions
  hydrate: () => void;
  startScan: (depth: ScanDepth) => Promise<void>;
  stopScan: () => void;
  resumeScan: () => Promise<void>;
  selectFinding: (id: string | null) => void;
  setScanDepth: (depth: ScanDepth) => void;
  setAnalysisProvider: (provider: string) => void;
  setAnalysisModel: (model: string) => void;
  exportChangelog: () => string;
  exportScanReport: () => string;
  clearChangelog: () => void;
  clearFindings: () => void;
  addFindings: (findings: Finding[]) => void;
  completeScan: () => void;
  addChangeEntry: (entry: any) => void;
  setPrefilledCustomRequest: (request: { request: string; target: string } | null) => void;
  updateCheck: (id: string, check: Partial<DiagnosticCheck>) => void;
  addCheck: (check: DiagnosticCheck) => void;
  updateFindingWithAI: (findingId: string, explanation: string, suggestedFix: string) => Promise<void>;
  addPendingFix: (findingId: string, fix: any) => void;
  createSnapshot: (label: string) => void;
  rollbackToSnapshot: (snapshotId: string) => Promise<boolean>;
  deleteSnapshot: (snapshotId: string) => void;
  undoLast: () => Promise<boolean>;
  pushToUndoStack: (state: any) => void;
  clearAll: () => void;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set, get) => ({
  // Scan state
  isScanning: false,
  scanProgress: 0,
  scanPhase: "",
  scanDepth: "standard",
  totalFiles: 0,
  filesScanned: 0,
  findings: [],
  selectedFindingId: null,
  canResume: false,
  lastScanTime: null,

  // Analysis state
  analysisProvider: "",
  analysisModel: "",

  // Changelog & snapshots
  changelog: [],
  snapshots: [],
  undoStack: [],

  // Custom request
  prefilledCustomRequest: null,

  // Basic state
  checks: [],
  hydrated: false,

  // Actions
  hydrate: () => {
    set({ hydrated: true });
  },

  startScan: async (depth) => {
    set({ isScanning: true, scanDepth: depth, scanProgress: 0, findings: [], selectedFindingId: null });
  },

  stopScan: () => {
    set({ isScanning: false });
  },

  resumeScan: async () => {
    set({ isScanning: true });
  },

  selectFinding: (id) => {
    set({ selectedFindingId: id });
  },

  setScanDepth: (depth) => {
    set({ scanDepth: depth });
  },

  setAnalysisProvider: (provider) => {
    set({ analysisProvider: provider });
  },

  setAnalysisModel: (model) => {
    set({ analysisModel: model });
  },

  exportChangelog: () => {
    const state = get();
    const report = {
      exportedAt: new Date().toISOString(),
      scanDepth: state.scanDepth,
      lastScanTime: state.lastScanTime ? new Date(state.lastScanTime).toISOString() : null,
      totalFiles: state.totalFiles,
      filesScanned: state.filesScanned,
      summary: {
        total: state.findings.length,
        errors: state.findings.filter(f => f.type === 'error').length,
        warnings: state.findings.filter(f => f.type === 'warning').length,
        security: state.findings.filter(f => f.type === 'security').length,
        enhancements: state.findings.filter(f => f.type === 'enhancement').length,
        critical: state.findings.filter(f => f.severity === 'critical').length,
        high: state.findings.filter(f => f.severity === 'high').length,
        medium: state.findings.filter(f => f.severity === 'medium').length,
        low: state.findings.filter(f => f.severity === 'low').length,
      },
      findings: state.findings,
      changelog: state.changelog,
    };
    return JSON.stringify(report, null, 2);
  },

  exportScanReport: () => {
    const state = get();
    const report = {
      exportedAt: new Date().toISOString(),
      scanDepth: state.scanDepth,
      lastScanTime: state.lastScanTime ? new Date(state.lastScanTime).toISOString() : null,
      totalFiles: state.totalFiles,
      filesScanned: state.filesScanned,
      summary: {
        total: state.findings.length,
        byType: {
          error: state.findings.filter(f => f.type === 'error').length,
          warning: state.findings.filter(f => f.type === 'warning').length,
          security: state.findings.filter(f => f.type === 'security').length,
          enhancement: state.findings.filter(f => f.type === 'enhancement').length,
        },
        bySeverity: {
          critical: state.findings.filter(f => f.severity === 'critical').length,
          high: state.findings.filter(f => f.severity === 'high').length,
          medium: state.findings.filter(f => f.severity === 'medium').length,
          low: state.findings.filter(f => f.severity === 'low').length,
        },
      },
      findings: state.findings.map(f => ({
        id: f.id,
        file: f.file,
        line: f.line,
        column: f.column,
        type: f.type,
        severity: f.severity,
        message: f.message,
        code: f.code,
        suggestedFix: f.suggestedFix || null,
        aiExplanation: f.aiExplanation || null,
      })),
      changelog: state.changelog,
    };
    return JSON.stringify(report, null, 2);
  },

  clearChangelog: () => {
    set({ changelog: [] });
  },

  clearFindings: () => {
    set({ findings: [], selectedFindingId: null });
  },

  addFindings: (findings) => {
    set((state) => ({
      findings: [...state.findings, ...findings],
    }));
  },

  completeScan: () => {
    set({ isScanning: false, lastScanTime: new Date() });
  },

  addChangeEntry: (entry) => {
    set((state) => ({
      changelog: [...state.changelog, entry],
    }));
  },

  setPrefilledCustomRequest: (request) => {
    set({ prefilledCustomRequest: request });
  },

  updateCheck: (id, updates) => {
    set((state) => ({
      checks: state.checks.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  },

  addCheck: (check) => {
    set((state) => ({
      checks: [...state.checks, check],
    }));
  },

  updateFindingWithAI: async (findingId, explanation, suggestedFix) => {
    // Placeholder implementation - updates finding with AI analysis results
  },

  addPendingFix: (findingId, fix) => {
    // Placeholder implementation
  },

  createSnapshot: (label) => {
    set((state) => ({
      snapshots: [...state.snapshots, { id: `snap_${Date.now()}`, label, timestamp: new Date(), data: {}, files: [] }],
    }));
  },

  rollbackToSnapshot: async (snapshotId) => {
    // Placeholder - rollback to a previous snapshot
    return true;
  },

  deleteSnapshot: (snapshotId) => {
    set((state) => ({
      snapshots: state.snapshots.filter((s: any) => s.id !== snapshotId),
    }));
  },

  undoLast: async () => {
    const state = get();
    if (state.undoStack.length === 0) return false;
    set((prevState) => {
      const newStack = [...prevState.undoStack];
      newStack.pop();
      return { undoStack: newStack };
    });
    return true;
  },

  pushToUndoStack: (state) => {
    set((prevState) => ({
      undoStack: [...prevState.undoStack, state],
    }));
  },

  clearAll: () => {
    set({
      checks: [],
      findings: [],
      isScanning: false,
      scanProgress: 0,
      scanPhase: "",
      scanDepth: "standard",
      totalFiles: 0,
      filesScanned: 0,
      selectedFindingId: null,
      changelog: [],
      snapshots: [],
    });
  },
}));
