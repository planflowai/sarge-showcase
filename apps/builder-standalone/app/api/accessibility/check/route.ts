import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { runAccessibilityCheck } from "@/lib/accessibility/checker";

export async function POST(request: NextRequest) {
  try {
    const { projectPath } = await request.json();

    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json({ error: "projectPath is required" }, { status: 400 });
    }

    // Verify project exists
    try {
      await fs.access(projectPath);
    } catch {
      return NextResponse.json({ error: "Project path not found" }, { status: 404 });
    }

    // Check if project has project.json with accessibility toggle
    const metaPath = path.join(projectPath, "project.json");
    try {
      const metaRaw = await fs.readFile(metaPath, "utf-8");
      const meta = JSON.parse(metaRaw);
      if (meta.toggles && meta.toggles.accessibility === false) {
        return NextResponse.json({
          success: false,
          skipped: true,
          reason: "Accessibility toggle is disabled for this project",
        });
      }
    } catch {
      // No project.json — run anyway
    }

    // Run the checker
    const report = await runAccessibilityCheck(projectPath);

    // Build human-readable summary
    const fixCount = report.fixes.headingsFixed + report.fixes.altTextAdded +
      (report.fixes.skipLinkInjected ? 1 : 0) + (report.fixes.langAdded ? 1 : 0);

    const parts: string[] = [];
    if (report.passed > 0) parts.push(`${report.passed} passed`);
    if (report.warnings > 0) parts.push(`${report.warnings} warnings`);
    if (fixCount > 0) parts.push(`${fixCount} auto-fixed`);

    const summary = parts.join(" · ");

    return NextResponse.json({
      success: true,
      report,
      summary,
    });
  } catch (error: any) {
    console.error("[accessibility/check] Error:", error);
    return NextResponse.json(
      { error: error.message || "Accessibility check failed" },
      { status: 500 }
    );
  }
}
