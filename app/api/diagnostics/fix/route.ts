import { NextRequest, NextResponse } from "next/server";
import { readFileContent, writeFileContent } from "@/lib/diagnostics/scanner";
import * as path from "path";
import * as fs from "fs";

const PROJECT_ROOT = process.cwd();
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, ".sarge-snapshots");

// Ensure snapshots directory exists
function ensureSnapshotsDir() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

// Save a snapshot to the file system
function saveSnapshot(
  snapshotId: string,
  files: { path: string; content: string }[]
) {
  ensureSnapshotsDir();
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`);
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify({
      id: snapshotId,
      timestamp: new Date().toISOString(),
      files,
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fix } = body as {
      fix: {
        id: string;
        findingId: string;
        file: string;
        line: number;
        originalCode: string;
        newCode: string;
        aiReasoning: string;
        model: string;
        provider: string;
      };
    };

    const fullPath = path.join(PROJECT_ROOT, fix.file);

    // Read current file content
    const currentContent = readFileContent(fullPath);
    if (currentContent === null) {
      return NextResponse.json(
        { error: "Could not read file" },
        { status: 400 }
      );
    }

    // Create snapshot before modifying
    const snapshotId = crypto.randomUUID();
    saveSnapshot(snapshotId, [
      { path: fix.file, content: currentContent },
    ]);

    // Apply the fix by replacing the original code with the new code
    const lines = currentContent.split("\n");

    // Find the line to replace
    if (fix.line > 0 && fix.line <= lines.length) {
      // Simple replacement - replace the entire line
      // For more complex fixes, we'd need to do smarter matching
      const lineIndex = fix.line - 1;
      const currentLine = lines[lineIndex];

      // Check if the original code matches (trimmed comparison)
      if (currentLine.trim() === fix.originalCode.trim()) {
        // Preserve indentation
        const indent = currentLine.match(/^(\s*)/)?.[1] || "";
        lines[lineIndex] = indent + fix.newCode.trim();

        const newContent = lines.join("\n");
        const success = writeFileContent(fullPath, newContent);

        if (!success) {
          return NextResponse.json(
            { error: "Failed to write file" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          snapshotId,
          file: fix.file,
          line: fix.line,
        });
      } else {
        // Try to find the line with the original code
        const foundIndex = lines.findIndex(
          (l) => l.trim() === fix.originalCode.trim()
        );

        if (foundIndex !== -1) {
          const indent = lines[foundIndex].match(/^(\s*)/)?.[1] || "";
          lines[foundIndex] = indent + fix.newCode.trim();

          const newContent = lines.join("\n");
          const success = writeFileContent(fullPath, newContent);

          if (!success) {
            return NextResponse.json(
              { error: "Failed to write file" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            snapshotId,
            file: fix.file,
            line: foundIndex + 1,
            note: "Line number adjusted - original code found at different location",
          });
        }

        return NextResponse.json(
          {
            error: "Could not find original code to replace",
            expected: fix.originalCode.trim(),
            found: currentLine.trim(),
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid line number" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[api/diagnostics/fix] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fix failed" },
      { status: 500 }
    );
  }
}
