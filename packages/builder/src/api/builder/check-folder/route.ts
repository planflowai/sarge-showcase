import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import nodePath from "path";
import { validatePathWithinProject, logForensicEvent } from "@sarge/core";

/**
 * POST /api/builder/check-folder
 *
 * Check if a folder already exists.
 * Used by NewProjectModal to prevent overwriting.
 */
export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  try {
    const { path: inputPath } = await req.json();

    if (!inputPath) {
      logForensicEvent({
        event: 'Check folder rejected: missing path',
        severity: 'warning',
        category: 'file_operation',
        details: { operation: 'check', error: 'Path is required', clientIp },
      });
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    // Validate path - allow absolute paths for check-folder since it's for new projects
    const normalizedPath = nodePath.normalize(nodePath.resolve(inputPath));

    // Check if exists
    const exists = fs.existsSync(normalizedPath);

    return NextResponse.json({ exists, path: normalizedPath });
  } catch (err: any) {
    console.error("[check-folder] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to check folder" },
      { status: 500 }
    );
  }
}
