import { NextResponse } from "next/server";
import { runAudit } from "@sarge/audit";
import type { RunAuditOptions } from "@sarge/audit";
import { join } from "path";

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
 * POST — Run independent audit (html-validate, axe-core, Lighthouse).
 * Body: { projectPath, tools?: string[], skipLighthouse?: boolean }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectPath: rawPath, tools, skipLighthouse } = body;

    if (!rawPath) {
      return NextResponse.json(
        { error: "Missing 'projectPath'" },
        { status: 400 }
      );
    }

    const projectPath = resolveProjectPath(rawPath);

    const options: RunAuditOptions = {};
    if (tools && Array.isArray(tools)) {
      options.tools = tools;
    }
    if (skipLighthouse) {
      options.skipLighthouse = true;
    }

    const report = await runAudit(projectPath, options);

    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Audit failed" },
      { status: 500 }
    );
  }
}
