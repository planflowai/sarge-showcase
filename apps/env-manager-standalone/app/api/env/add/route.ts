import { NextResponse } from "next/server";
import { MASTER_ENV_PATH, parseEnvFile, appendEnvKey, syncToApps } from "../helpers";

export async function POST(req: Request) {
  try {
    const { key, value } = await req.json();
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // Validate key format
    if (!/^[A-Z][A-Z0-9_]*$/i.test(key)) {
      return NextResponse.json(
        { error: "Invalid key format. Use UPPER_SNAKE_CASE." },
        { status: 400 }
      );
    }

    // Check for duplicates
    const existing = parseEnvFile(MASTER_ENV_PATH);
    if (existing.some((e) => e.key === key)) {
      return NextResponse.json(
        { error: `Key "${key}" already exists. Use save to update it.` },
        { status: 409 }
      );
    }

    appendEnvKey(MASTER_ENV_PATH, key, value || "");

    // Sync to all standalone apps
    const { synced } = syncToApps();

    return NextResponse.json({ success: true, key, synced: synced.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to add key" },
      { status: 500 }
    );
  }
}
