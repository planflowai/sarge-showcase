import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import {
  applyPerformanceOptimization,
  optimizeProjectHtml,
} from "@/lib/performance/optimizer";
import { readFileSync, writeFileSync } from "fs";

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
    const { html, projectPath: rawPath } = body;

    // Mode 1: Raw HTML string — optimize and return (no disk write)
    if (html && typeof html === "string") {
      const { html: optimized, report } = applyPerformanceOptimization(html);

      // If projectPath provided, write optimized HTML to disk
      if (rawPath) {
        const projectPath = resolveProjectPath(rawPath);
        const indexPath = join(projectPath, "index.html");
        writeFileSync(indexPath, optimized, "utf-8");
      }

      const parts = buildSummary(report);
      return NextResponse.json({
        success: true,
        html: optimized,
        report,
        summary:
          parts.length > 0
            ? `Performance optimized: ${parts.join(", ")}`
            : "Performance: already optimized",
      });
    }

    // Mode 2: Project path only — read index.html from disk, optimize, write back
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

    const report = optimizeProjectHtml(projectPath);
    if (!report) {
      return NextResponse.json(
        { error: "Failed to optimize — index.html not found" },
        { status: 404 }
      );
    }

    const parts = buildSummary(report);
    return NextResponse.json({
      success: true,
      report,
      summary:
        parts.length > 0
          ? `Performance optimized: ${parts.join(", ")}`
          : "Performance: already optimized",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Performance optimization failed" },
      { status: 500 }
    );
  }
}

function buildSummary(report: any): string[] {
  const parts: string[] = [];
  if (report.cssMinified > 0) parts.push(`${report.cssMinified} CSS blocks minified`);
  if (report.jsMinified > 0) parts.push(`${report.jsMinified} JS blocks minified`);
  if (report.lazyImagesAdded > 0) parts.push(`${report.lazyImagesAdded} lazy images`);
  if (report.asyncDecodingAdded > 0) parts.push(`${report.asyncDecodingAdded} async decoding`);
  if (report.preconnectLinksAdded.length > 0)
    parts.push(`${report.preconnectLinksAdded.length} preconnect hints`);
  if (report.viewportAdded) parts.push("viewport added");
  if (report.asyncCssCount > 0) parts.push(`${report.asyncCssCount} async CSS`);
  const saved = report.originalSize - report.optimizedSize;
  if (saved > 0) parts.push(`${saved} bytes saved`);
  return parts;
}
