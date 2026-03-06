import { NextResponse } from "next/server";
import { MASTER_ENV_PATH, deleteEnvKey, syncToApps } from "../helpers";

export async function POST(req: Request) {
  try {
    const { key } = await req.json();
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const deleted = deleteEnvKey(MASTER_ENV_PATH, key);
    if (!deleted) {
      return NextResponse.json(
        { error: `Key "${key}" not found` },
        { status: 404 }
      );
    }

    // Sync to all standalone apps
    const { synced } = syncToApps();

    return NextResponse.json({ success: true, key, synced: synced.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete key" },
      { status: 500 }
    );
  }
}
