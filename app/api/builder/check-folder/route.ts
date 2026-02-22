import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import nodePath from "path";

/**
 * POST /api/builder/check-folder
 *
 * Check if a folder already exists.
 * Used by NewProjectModal to prevent overwriting.
 */
export async function POST(req: NextRequest) {
  try {
    const { path: inputPath } = await req.json();

    if (!inputPath) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    // Normalize cross-platform: resolve handles both forward and back slashes
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
