import { NextResponse } from "next/server";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import {
  injectPunchList,
  injectProjectPunchList,
} from "@/lib/punchlist/injector";

const PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === "win32" ? "L:/AI_MASTER_BUILDS" : "/AI_MASTER_BUILDS");

function resolveProjectPath(projectPath: string): string {
  if (!projectPath.includes("/") && !projectPath.includes("\\")) {
    return join(PROJECTS_DIR, projectPath).replace(/\\/g, "/");
  }
  return projectPath.replace(/\\/g, "/");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html, projectPath: rawPath, developerEmail } = body;

    // Mode 1: Raw HTML string — inject and return
    if (html && typeof html === "string") {
      const { html: enhanced, report } = injectPunchList(html, {
        submitEndpoint: rawPath
          ? `/api/punchlist/submit`
          : "/api/punchlist/submit",
        developerEmail: developerEmail || "",
      });

      // If projectPath provided, write enhanced HTML to disk
      if (rawPath) {
        const projectPath = resolveProjectPath(rawPath);
        const indexPath = join(projectPath, "index.html");
        writeFileSync(indexPath, enhanced, "utf-8");
      }

      const parts = buildSummary(report);
      return NextResponse.json({
        success: true,
        html: enhanced,
        report,
        summary:
          parts.length > 0
            ? `Punch list injected: ${parts.join(", ")}`
            : "Punch list: already injected",
      });
    }

    // Mode 2: Project path only — read index.html from disk, inject, write back
    if (!rawPath) {
      return NextResponse.json(
        { error: "Missing 'html' or 'projectPath'" },
        { status: 400 }
      );
    }

    const projectPath = resolveProjectPath(rawPath);
    const indexPath = join(projectPath, "index.html");
    if (!existsSync(indexPath)) {
      return NextResponse.json(
        { error: "index.html not found in project folder" },
        { status: 404 }
      );
    }

    const report = injectProjectPunchList(projectPath, {
      developerEmail: developerEmail || "",
    });
    if (!report) {
      return NextResponse.json(
        { error: "Failed to inject — index.html not found" },
        { status: 404 }
      );
    }

    const parts = buildSummary(report);
    return NextResponse.json({
      success: true,
      report,
      summary:
        parts.length > 0
          ? `Punch list injected: ${parts.join(", ")}`
          : "Punch list: already injected",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Punch list injection failed" },
      { status: 500 }
    );
  }
}

function buildSummary(report: any): string[] {
  const parts: string[] = [];
  if (report.floatingButtonAdded) parts.push("floating button added");
  if (report.formInjected) parts.push("revision form injected");
  if (report.navPagesDetected > 0)
    parts.push(`${report.navPagesDetected} page(s) detected`);
  if (report.mailtoFallbackEmail)
    parts.push("mailto fallback configured");
  return parts;
}
