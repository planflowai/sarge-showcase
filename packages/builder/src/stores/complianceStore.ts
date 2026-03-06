"use client";

import { create } from "zustand";
import { syncCompilerResult } from "@sarge/core";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AuditViolation {
  rule: string;
  severity: string;
  message: string;
  element?: string;
}

export interface AuditScores {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  violations: AuditViolation[];
  passed: boolean;
}

export interface ComplianceResult {
  before: AuditScores;
  after: AuditScores | null;
  fixedHtml: string | null;
  timestamp: number;
}

interface ComplianceState {
  /** Current compliance result */
  result: ComplianceResult | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Panel collapsed */
  collapsed: boolean;
  /** Auto-check enabled */
  autoCheck: boolean;

  // Actions
  setResult: (result: ComplianceResult) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setAutoCheck: (enabled: boolean) => void;
  clear: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────────

export const useComplianceStore = create<ComplianceState>((set) => ({
  result: null,
  loading: false,
  error: null,
  collapsed: true,
  autoCheck: true,

  setResult: (result) => set({ result, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setCollapsed: (collapsed) => set({ collapsed }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setAutoCheck: (enabled) => set({ autoCheck: enabled }),
  clear: () => set({ result: null, loading: false, error: null }),
}));

// ─── API helper ─────────────────────────────────────────────────────────────────

/**
 * Run the compiler loop against HTML code.
 * Calls POST /api/benchmark/compile, parses response, updates store.
 */
export async function runComplianceCheck(html: string, autoFix = false): Promise<ComplianceResult | null> {
  const store = useComplianceStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    // First: audit only (no fix)
    const auditRes = await fetch("/api/benchmark/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    });

    if (!auditRes.ok) {
      const err = await auditRes.json().catch(() => ({ error: "Compile failed" }));
      throw new Error(err.error || `HTTP ${auditRes.status}`);
    }

    const auditReport = await auditRes.json();

    // Parse scores from report
    const before = parseScores(auditReport);

    // If autoFix and there are violations, run fix pass
    let after: AuditScores | null = null;
    let fixedHtml: string | null = null;

    if (autoFix && before.violations.length > 0) {
      try {
        const fixRes = await fetch("/api/benchmark/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html,
            fix: true,
            violations: before.violations.slice(0, 20),
          }),
        });

        if (fixRes.ok) {
          const fixData = await fixRes.json();
          if (fixData.afterReport) {
            after = parseScores(fixData.afterReport);
          }
          fixedHtml = fixData.fixedHtml || null;
        }
      } catch {
        // Fix failed — that's fine, show before-only results
      }
    }

    const result: ComplianceResult = {
      before,
      after,
      fixedHtml,
      timestamp: Date.now(),
    };

    store.setResult(result);
    store.setLoading(false);
    // Auto-expand when results arrive
    store.setCollapsed(false);

    // Fire-and-forget Supabase logging
    syncCompilerResult({
      source: "builder",
      performance: before.performance,
      accessibility: before.accessibility,
      seo: before.seo,
      best_practices: before.bestPractices,
      violations_count: before.violations.length,
      passed: before.passed,
      ai_fix_applied: after != null,
      after_performance: after?.performance ?? null,
      after_accessibility: after?.accessibility ?? null,
      after_seo: after?.seo ?? null,
      after_best_practices: after?.bestPractices ?? null,
      after_violations_count: after ? after.violations.length : null,
      after_passed: after?.passed ?? null,
    }).catch(() => {});

    return result;
  } catch (err: any) {
    store.setError(err.message || "Compliance check failed");
    store.setLoading(false);
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseScores(report: any): AuditScores {
  const scores = report.scores || {};
  const perf = scores.performance ?? 0;
  const acc = scores.accessibility ?? 0;
  const seo = scores.seo ?? 0;
  const bp = scores.bestPractices ?? 0;

  // Collect violations from all results
  const violations: AuditViolation[] = [];
  if (report.results && Array.isArray(report.results)) {
    for (const r of report.results) {
      if (r.violations && Array.isArray(r.violations)) {
        for (const v of r.violations) {
          violations.push({
            rule: v.rule || "unknown",
            severity: v.severity || "warning",
            message: v.message || "",
            element: v.element,
          });
        }
      }
    }
  }

  return {
    performance: perf,
    accessibility: acc,
    seo: seo,
    bestPractices: bp,
    violations,
    passed: perf >= 80 && acc >= 80 && seo >= 80 && bp >= 80,
  };
}
