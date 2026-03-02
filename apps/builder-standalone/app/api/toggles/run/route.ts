import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { runTogglePipeline } from "@/lib/toggles/pipeline";
import type { ProjectMeta } from "@/lib/types/project";
import { DEFAULT_TOGGLES } from "@/lib/types/project";

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
    const { projectPath: rawPath } = body;

    if (!rawPath) {
      return NextResponse.json(
        { error: "Missing 'projectPath'" },
        { status: 400 }
      );
    }

    const projectPath = resolveProjectPath(rawPath);

    if (!existsSync(projectPath)) {
      return NextResponse.json(
        { error: "Project path not found" },
        { status: 404 }
      );
    }

    // Read project.json to get enabled toggles
    const metaPath = join(projectPath, "project.json");
    let toggles = { ...DEFAULT_TOGGLES };
    let developerEmail = "";

    if (existsSync(metaPath)) {
      try {
        const meta: ProjectMeta = JSON.parse(
          readFileSync(metaPath, "utf-8")
        );
        if (meta.toggles) {
          toggles = { ...DEFAULT_TOGGLES, ...meta.toggles };
        }
        developerEmail = meta.clientEmail || "";
      } catch {
        // Use defaults
      }
    }

    // Run the pipeline
    const results = await runTogglePipeline(projectPath, toggles, {
      developerEmail,
    });

    const successCount = results.filter((r) => r.status === "success").length;
    const skipCount = results.filter((r) => r.status === "skipped").length;
    const failCount = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      success: true,
      results,
      summary: `${successCount} applied, ${skipCount} skipped${failCount > 0 ? `, ${failCount} failed` : ""}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Toggle pipeline failed" },
      { status: 500 }
    );
  }
}
