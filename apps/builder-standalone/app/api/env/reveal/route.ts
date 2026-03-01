import { NextResponse } from "next/server";
import { MASTER_ENV_PATH, parseEnvFile } from "../helpers";

export async function POST(req: Request) {
  try {
    const { key } = await req.json();
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const entries = parseEnvFile(MASTER_ENV_PATH);
    const entry = entries.find((e) => e.key === key);

    if (!entry) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ key: entry.key, value: entry.value });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reveal key" },
      { status: 500 }
    );
  }
}
