import { NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  applyPrivacyCompliance,
  applyProjectPrivacy,
} from "@/lib/privacy/compliance";

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

    // Mode 1: Raw HTML string — apply compliance and return
    if (html && typeof html === "string") {
      const { html: compliant, report } = applyPrivacyCompliance(html);

      // If projectPath provided, write compliant HTML to disk
      if (rawPath) {
        const projectPath = resolveProjectPath(rawPath);
        const indexPath = join(projectPath, "index.html");
        writeFileSync(indexPath, compliant, "utf-8");
      }

      const parts = buildSummary(report);
      return NextResponse.json({
        success: true,
        html: compliant,
        report,
        summary:
          parts.length > 0
            ? `Privacy compliance applied: ${parts.join(", ")}`
            : "Privacy: already compliant",
      });
    }

    // Mode 2: Project path only — read index.html from disk, apply, write back
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

    const report = applyProjectPrivacy(projectPath);
    if (!report) {
      return NextResponse.json(
        { error: "Failed to apply privacy — index.html not found" },
        { status: 404 }
      );
    }

    const parts = buildSummary(report);
    return NextResponse.json({
      success: true,
      report,
      summary:
        parts.length > 0
          ? `Privacy compliance applied: ${parts.join(", ")}`
          : "Privacy: already compliant",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Privacy compliance failed" },
      { status: 500 }
    );
  }
}

function buildSummary(report: any): string[] {
  const parts: string[] = [];
  if (report.consentBannerAdded) parts.push("consent banner added");
  if (report.privacyPolicyAdded) parts.push("privacy policy added");
  if (report.formDisclosuresAdded > 0)
    parts.push(`${report.formDisclosuresAdded} form disclosure(s)`);
  if (report.scriptsTagged > 0)
    parts.push(`${report.scriptsTagged} script(s) tagged for consent`);
  if (report.manageCookiesLinkAdded) parts.push("manage cookies link in footer");
  return parts;
}
