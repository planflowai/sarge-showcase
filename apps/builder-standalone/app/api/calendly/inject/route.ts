import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { injectCalendlyWidget } from "@/lib/calendly/injector";

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
    const { projectPath: rawPath, calendlyUrl } = await req.json();

    if (!rawPath) {
      return NextResponse.json({ error: "Missing projectPath" }, { status: 400 });
    }
    if (!calendlyUrl) {
      return NextResponse.json({ error: "Missing calendlyUrl" }, { status: 400 });
    }

    const projectPath = resolveProjectPath(rawPath);
    const indexPath = join(projectPath, "index.html");

    if (!existsSync(indexPath)) {
      return NextResponse.json({ error: "index.html not found" }, { status: 404 });
    }

    let html = readFileSync(indexPath, "utf-8");
    const { html: out, report } = injectCalendlyWidget(html, calendlyUrl);
    writeFileSync(indexPath, out, "utf-8");

    const parts: string[] = [];
    if (report.buttonInjected) parts.push("Book a Call button");
    if (report.widgetScriptInjected) parts.push("Calendly popup widget");

    return NextResponse.json({
      success: true,
      report,
      summary: parts.length > 0 ? parts.join(", ") : "Already injected",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Calendly injection failed" },
      { status: 500 }
    );
  }
}
