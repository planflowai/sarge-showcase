import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { ProjectMeta } from "@/lib/types/project";

const PROJECTS_DIR =
  process.env.BUILDER_PROJECTS_DIR ||
  (process.platform === "win32" ? "L:/AI_MASTER_BUILDS" : "/AI_MASTER_BUILDS");

function resolveProjectPath(projectPath: string): string {
  // If it's a relative name, resolve from PROJECTS_DIR
  if (!projectPath.includes("/") && !projectPath.includes("\\")) {
    return join(PROJECTS_DIR, projectPath, "project.json").replace(/\\/g, "/");
  }
  return join(projectPath, "project.json").replace(/\\/g, "/");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectPath = searchParams.get("path");

    if (!projectPath) {
      return NextResponse.json({ error: "Missing path param" }, { status: 400 });
    }

    const metaPath = resolveProjectPath(projectPath);

    if (!existsSync(metaPath)) {
      return NextResponse.json({ exists: false, meta: null });
    }

    const content = await readFile(metaPath, "utf-8");
    const meta: ProjectMeta = JSON.parse(content);

    return NextResponse.json({ exists: true, meta });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to read project meta" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { projectPath, updates } = await req.json();

    if (!projectPath) {
      return NextResponse.json({ error: "Missing projectPath" }, { status: 400 });
    }

    const metaPath = resolveProjectPath(projectPath);

    if (!existsSync(metaPath)) {
      return NextResponse.json(
        { error: "project.json not found" },
        { status: 404 }
      );
    }

    const content = await readFile(metaPath, "utf-8");
    const meta: ProjectMeta = JSON.parse(content);

    // Merge updates
    const updated: ProjectMeta = {
      ...meta,
      ...updates,
      toggles: updates?.toggles
        ? { ...meta.toggles, ...updates.toggles }
        : meta.toggles,
      deployUrls: updates?.deployUrls
        ? { ...meta.deployUrls, ...updates.deployUrls }
        : meta.deployUrls,
      revisions: updates?.revisions
        ? { ...meta.revisions, ...updates.revisions }
        : meta.revisions,
    };

    await writeFile(metaPath, JSON.stringify(updated, null, 2), "utf-8");

    return NextResponse.json({ success: true, meta: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update project meta" },
      { status: 500 }
    );
  }
}
