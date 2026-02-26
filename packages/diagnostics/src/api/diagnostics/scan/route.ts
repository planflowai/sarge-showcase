import { NextRequest, NextResponse } from "next/server";
import { scanCodebase, collectFiles } from "../../../lib/scanner";
import type { ScanDepth } from "../../../stores/diagnosticsStore";
import * as path from "path";

// Project root - adjust if needed
const PROJECT_ROOT = process.cwd();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { depth = "standard" } = body as { depth?: ScanDepth };

    console.log(`[api/diagnostics/scan] Starting ${depth} scan of ${PROJECT_ROOT}`);

    // Collect files first
    const files = collectFiles(PROJECT_ROOT, depth);

    // Perform full scan
    const result = scanCodebase(PROJECT_ROOT, depth);

    // Convert absolute paths to relative for cleaner display
    const relativeFindingsData = result.findings.map((f) => ({
      ...f,
      file: path.relative(PROJECT_ROOT, f.file).replace(/\\/g, "/"),
    }));

    return NextResponse.json({
      success: true,
      totalFiles: result.totalFiles,
      scannedFiles: result.scannedFiles,
      findingsCount: result.findings.length,
      findings: relativeFindingsData,
      summary: {
        errors: relativeFindingsData.filter((f) => f.type === "error").length,
        warnings: relativeFindingsData.filter((f) => f.type === "warning").length,
        enhancements: relativeFindingsData.filter((f) => f.type === "enhancement").length,
        security: relativeFindingsData.filter((f) => f.type === "security").length,
        critical: relativeFindingsData.filter((f) => f.severity === "critical").length,
        high: relativeFindingsData.filter((f) => f.severity === "high").length,
        medium: relativeFindingsData.filter((f) => f.severity === "medium").length,
        low: relativeFindingsData.filter((f) => f.severity === "low").length,
      },
    });
  } catch (error) {
    console.error("[api/diagnostics/scan] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return scan status or last results
  return NextResponse.json({
    status: "ready",
    projectRoot: PROJECT_ROOT,
  });
}
