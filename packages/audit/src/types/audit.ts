export interface AuditViolation {
  rule: string;
  severity: "error" | "warning" | "notice";
  message: string;
  element?: string;
  fix?: string;
  wcag?: string;
  line?: number;
}

export interface AuditResult {
  tool: string;
  category:
    | "html"
    | "accessibility"
    | "seo"
    | "performance"
    | "security"
    | "css";
  score: number | null;
  passed: boolean;
  violations: AuditViolation[];
  summary: string;
  timestamp: string;
  duration: number;
}

export interface AuditReport {
  projectPath: string;
  timestamp: string;
  totalDuration: number;
  results: AuditResult[];
  overallPassed: boolean;
  scores: {
    html: number | null;
    accessibility: number | null;
    seo: number | null;
    performance: number | null;
    bestPractices: number | null;
  };
}
