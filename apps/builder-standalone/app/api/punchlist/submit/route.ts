import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

interface PunchListItem {
  id: number;
  page: string;
  description: string;
  priority: "low" | "medium" | "high";
  screenshot: string | null;
  status: "open" | "in-progress" | "done";
  round: number;
  timestamp: string;
}

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
    const {
      page,
      description,
      priority = "medium",
      screenshot = null,
      round = 1,
      timestamp,
      projectPath: rawPath,
    } = body;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Missing 'description'" },
        { status: 400 }
      );
    }

    // Determine where to store
    const projectPath = rawPath ? resolveProjectPath(rawPath) : PROJECTS_DIR;
    const punchlistPath = join(projectPath, "punchlist.json");

    // Read existing or start fresh
    let items: PunchListItem[] = [];
    if (existsSync(punchlistPath)) {
      try {
        items = JSON.parse(readFileSync(punchlistPath, "utf-8"));
      } catch {
        items = [];
      }
    } else {
      // Ensure directory exists
      const dir = dirname(punchlistPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Create new item
    const newItem: PunchListItem = {
      id: items.length + 1,
      page: page || "General",
      description: description.trim(),
      priority: ["low", "medium", "high"].includes(priority)
        ? priority
        : "medium",
      screenshot: screenshot || null,
      status: "open",
      round: typeof round === "number" ? round : 1,
      timestamp: timestamp || new Date().toISOString(),
    };

    items.push(newItem);
    writeFileSync(punchlistPath, JSON.stringify(items, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      itemNumber: newItem.id,
      item: newItem,
      totalItems: items.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit revision" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get("projectPath");

    if (!rawPath) {
      return NextResponse.json(
        { error: "Missing 'projectPath' query param" },
        { status: 400 }
      );
    }

    const projectPath = resolveProjectPath(rawPath);
    const punchlistPath = join(projectPath, "punchlist.json");

    if (!existsSync(punchlistPath)) {
      return NextResponse.json({ items: [], totalItems: 0 });
    }

    const items: PunchListItem[] = JSON.parse(
      readFileSync(punchlistPath, "utf-8")
    );

    return NextResponse.json({
      items,
      totalItems: items.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to read punch list" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { projectPath: rawPath, itemId, status } = body;

    if (!rawPath || !itemId || !status) {
      return NextResponse.json(
        { error: "Missing 'projectPath', 'itemId', or 'status'" },
        { status: 400 }
      );
    }

    if (!["open", "in-progress", "done"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: open, in-progress, or done" },
        { status: 400 }
      );
    }

    const projectPath = resolveProjectPath(rawPath);
    const punchlistPath = join(projectPath, "punchlist.json");

    if (!existsSync(punchlistPath)) {
      return NextResponse.json(
        { error: "punchlist.json not found" },
        { status: 404 }
      );
    }

    const items: PunchListItem[] = JSON.parse(
      readFileSync(punchlistPath, "utf-8")
    );

    const item = items.find((i) => i.id === itemId);
    if (!item) {
      return NextResponse.json(
        { error: `Item #${itemId} not found` },
        { status: 404 }
      );
    }

    item.status = status;
    writeFileSync(punchlistPath, JSON.stringify(items, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update item" },
      { status: 500 }
    );
  }
}
