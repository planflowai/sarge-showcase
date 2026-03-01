import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { applySeoOptimization } from "@/lib/seo/optimizer";
import type { ProjectMeta } from "@/lib/types/project";

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
    const { projectPath: rawPath } = await req.json();

    if (!rawPath) {
      return NextResponse.json(
        { error: "Missing projectPath" },
        { status: 400 }
      );
    }

    const projectPath = resolveProjectPath(rawPath);

    // Read project.json
    const metaPath = join(projectPath, "project.json");
    if (!existsSync(metaPath)) {
      return NextResponse.json(
        { error: "project.json not found — SEO optimization requires project metadata" },
        { status: 404 }
      );
    }

    const projectMeta: ProjectMeta = JSON.parse(
      readFileSync(metaPath, "utf-8")
    );

    // Check if SEO toggle is enabled
    if (!projectMeta.toggles?.seo) {
      return NextResponse.json({
        skipped: true,
        reason: "SEO toggle is disabled in project.json",
      });
    }

    // Check index.html exists
    const indexPath = join(projectPath, "index.html");
    if (!existsSync(indexPath)) {
      return NextResponse.json(
        { error: "index.html not found in project folder" },
        { status: 404 }
      );
    }

    // Run optimization
    const report = applySeoOptimization(projectPath, projectMeta);

    // Build summary message
    const parts: string[] = [];
    if (report.metaTagsAdded.length > 0) {
      parts.push(`${report.metaTagsAdded.length} meta tags added`);
    }
    if (report.altTextFixed > 0) {
      parts.push(`${report.altTextFixed} alt texts fixed`);
    }
    if (report.sitemapCreated) parts.push("sitemap created");
    if (report.robotsCreated) parts.push("robots.txt created");
    if (report.minified) parts.push("HTML minified");
    if (report.headingWarnings.length > 0) {
      parts.push(`${report.headingWarnings.length} heading warnings`);
    }

    return NextResponse.json({
      success: true,
      report,
      summary: parts.length > 0 ? `SEO optimized: ${parts.join(", ")}` : "SEO: already optimized",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "SEO optimization failed" },
      { status: 500 }
    );
  }
}
