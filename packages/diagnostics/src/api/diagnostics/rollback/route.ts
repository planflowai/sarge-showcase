import { NextRequest, NextResponse } from "next/server";
import { writeFileContent } from "../../../lib/scanner";
import * as path from "path";
import * as fs from "fs";

const PROJECT_ROOT = process.cwd();
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, ".sarge-snapshots");

// Load a snapshot from the file system
function loadSnapshot(snapshotId: string): {
  id: string;
  timestamp: string;
  files: { path: string; content: string }[];
} | null {
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`);

  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(snapshotPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Delete a snapshot file
function deleteSnapshotFile(snapshotId: string) {
  const snapshotPath = path.join(SNAPSHOTS_DIR, `${snapshotId}.json`);
  if (fs.existsSync(snapshotPath)) {
    fs.unlinkSync(snapshotPath);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { snapshot } = body as {
      snapshot: {
        id: string;
        files: { path: string; content: string }[];
      };
    };

    // First try to load from file system (more reliable)
    const savedSnapshot = loadSnapshot(snapshot.id);
    const filesToRestore = savedSnapshot?.files || snapshot.files;

    if (!filesToRestore || filesToRestore.length === 0) {
      return NextResponse.json(
        { error: "No files found in snapshot" },
        { status: 400 }
      );
    }

    // Restore each file
    const results: { file: string; success: boolean; error?: string }[] = [];

    for (const file of filesToRestore) {
      const fullPath = path.join(PROJECT_ROOT, file.path);

      try {
        const success = writeFileContent(fullPath, file.content);
        results.push({ file: file.path, success });
      } catch (error) {
        results.push({
          file: file.path,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const allSuccessful = results.every((r) => r.success);

    // Delete snapshot file after successful rollback
    if (allSuccessful) {
      deleteSnapshotFile(snapshot.id);
    }

    return NextResponse.json({
      success: allSuccessful,
      results,
      snapshotId: snapshot.id,
    });
  } catch (error) {
    console.error("[api/diagnostics/rollback] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rollback failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to list available snapshots
export async function GET() {
  try {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      return NextResponse.json({ snapshots: [] });
    }

    const files = fs.readdirSync(SNAPSHOTS_DIR);
    const snapshots = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const content = fs.readFileSync(
            path.join(SNAPSHOTS_DIR, f),
            "utf-8"
          );
          const data = JSON.parse(content);
          return {
            id: data.id,
            timestamp: data.timestamp,
            fileCount: data.files?.length || 0,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("[api/diagnostics/rollback] Error listing snapshots:", error);
    return NextResponse.json({ snapshots: [] });
  }
}
