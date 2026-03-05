import { NextResponse } from "next/server";
import { existsSync, readFileSync, copyFileSync, unlinkSync } from "fs";
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

/**
 * DELETE — Revert to pre-optimize snapshot.
 * Body: { projectPath }
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { projectPath: rawPath } = body;

    if (!rawPath) {
      return NextResponse.json({ error: "Missing 'projectPath'" }, { status: 400 });
    }

    const projectPath = resolveProjectPath(rawPath);
    const indexPath = join(projectPath, "index.html");
    const snapshotPath = join(projectPath, "index.pre-optimize.html");

    if (!existsSync(snapshotPath)) {
      return NextResponse.json({ error: "No pre-optimize snapshot found" }, { status: 404 });
    }

    copyFileSync(snapshotPath, indexPath);
    unlinkSync(snapshotPath);

    return NextResponse.json({ success: true, message: "Reverted to pre-optimize snapshot" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Revert failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectPath: rawPath, toggles: clientToggles, toggleConfig } = body;

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

    // If client sent explicit toggles, use those; otherwise read from project.json
    let toggles = { ...DEFAULT_TOGGLES };
    let developerEmail = "";

    const metaPath = join(projectPath, "project.json");
    if (existsSync(metaPath)) {
      try {
        const meta: ProjectMeta = JSON.parse(
          readFileSync(metaPath, "utf-8")
        );
        developerEmail = meta.clientEmail || "";
        if (!clientToggles && meta.toggles) {
          toggles = { ...DEFAULT_TOGGLES, ...meta.toggles };
        }
      } catch {
        // Use defaults
      }
    }

    // Client-selected toggles take priority
    if (clientToggles) {
      toggles = { ...DEFAULT_TOGGLES, ...clientToggles };
    }

    // Run the pipeline
    const results = await runTogglePipeline(projectPath, toggles, {
      developerEmail,
      calendlyUrl: toggleConfig?.calendly?.url || "",
      mailchimpActionUrl: toggleConfig?.mailchimp?.actionUrl || "",
    });

    const successCount = results.filter((r: any) => r.status === "success").length;
    const skipCount = results.filter((r: any) => r.status === "skipped").length;
    const failCount = results.filter((r: any) => r.status === "failed").length;

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
