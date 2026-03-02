import { NextResponse } from "next/server";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import {
  applySecurityHardening,
  hardenProjectHtml,
} from "@/lib/security/hardener";

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

    // Mode 1: Raw HTML string — harden and return
    if (html && typeof html === "string") {
      const { html: hardened, report } = applySecurityHardening(html);

      // If projectPath provided, write hardened HTML to disk
      if (rawPath) {
        const projectPath = resolveProjectPath(rawPath);
        const indexPath = join(projectPath, "index.html");
        writeFileSync(indexPath, hardened, "utf-8");
      }

      const parts = buildSummary(report);
      return NextResponse.json({
        success: true,
        html: hardened,
        report,
        summary:
          parts.length > 0
            ? `Security hardened: ${parts.join(", ")}`
            : "Security: already hardened",
      });
    }

    // Mode 2: Project path only — read index.html from disk, harden, write back
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

    const report = hardenProjectHtml(projectPath);
    if (!report) {
      return NextResponse.json(
        { error: "Failed to harden — index.html not found" },
        { status: 404 }
      );
    }

    const parts = buildSummary(report);
    return NextResponse.json({
      success: true,
      report,
      summary:
        parts.length > 0
          ? `Security hardened: ${parts.join(", ")}`
          : "Security: already hardened",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Security hardening failed" },
      { status: 500 }
    );
  }
}

function buildSummary(report: any): string[] {
  const parts: string[] = [];
  if (report.cspAdded) parts.push("CSP policy added");
  if (report.nosniffAdded) parts.push("X-Content-Type-Options added");
  if (report.referrerPolicyAdded) parts.push("Referrer-Policy added");
  if (report.noopenerFixed > 0) parts.push(`${report.noopenerFixed} links hardened`);
  if (report.honeypotFormsAdded > 0) parts.push(`${report.honeypotFormsAdded} honeypot forms`);
  if (report.sanitizationScriptAdded) parts.push("input sanitizer added");
  if (report.commentsStripped > 0) parts.push(`${report.commentsStripped} comments stripped`);
  return parts;
}
