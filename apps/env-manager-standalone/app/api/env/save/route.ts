import { NextResponse } from "next/server";
import {
  MASTER_ENV_PATH,
  updateEnvKey,
  updateRotationLog,
  syncToApps,
} from "../helpers";

export async function POST(req: Request) {
  try {
    const { key, value } = await req.json();
    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Missing key or value" },
        { status: 400 }
      );
    }

    const updated = updateEnvKey(MASTER_ENV_PATH, key, value);
    if (!updated) {
      return NextResponse.json(
        { error: `Key "${key}" not found in .env.local` },
        { status: 404 }
      );
    }

    // Update rotation log
    updateRotationLog(key);

    // Sync to all standalone apps
    const { synced } = syncToApps();

    return NextResponse.json({ success: true, key, synced: synced.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save key" },
      { status: 500 }
    );
  }
}
