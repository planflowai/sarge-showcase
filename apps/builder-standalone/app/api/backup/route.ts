import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BACKUP_ROOT = "L:\\BUILDER_BACKUPS";

function getMonthFolder(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return path.join(BACKUP_ROOT, `${yyyy}-${mm}`);
}

function getTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${min}`;
}

/** POST — Save localStorage/Zustand data to disk */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Ensure root and month folder exist
    const monthDir = getMonthFolder();
    fs.mkdirSync(monthDir, { recursive: true });

    const filename = `sarge-backup-${getTimestamp()}.json`;
    const filepath = path.join(monthDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(body, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      path: filepath,
      size: fs.statSync(filepath).size,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET — List all backups, grouped by month */
export async function GET() {
  try {
    if (!fs.existsSync(BACKUP_ROOT)) {
      return NextResponse.json({ backups: [], total: 0 });
    }

    const months = fs
      .readdirSync(BACKUP_ROOT)
      .filter((d) => fs.statSync(path.join(BACKUP_ROOT, d)).isDirectory())
      .sort()
      .reverse();

    const backups: Array<{
      month: string;
      files: Array<{ name: string; size: number; path: string }>;
    }> = [];

    let total = 0;

    for (const month of months) {
      const monthPath = path.join(BACKUP_ROOT, month);
      const files = fs
        .readdirSync(monthPath)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse()
        .map((f) => {
          const fp = path.join(monthPath, f);
          const stat = fs.statSync(fp);
          total++;
          return { name: f, size: stat.size, path: fp };
        });

      if (files.length > 0) {
        backups.push({ month, files });
      }
    }

    return NextResponse.json({ backups, total });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE — Remove a specific backup file */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filepath = searchParams.get("path");

    if (!filepath || !filepath.startsWith(BACKUP_ROOT)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    fs.unlinkSync(filepath);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
