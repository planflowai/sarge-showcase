import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@sarge/billing";

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  try {
    const updates = await req.json();
    const current = await readConfig();
    const merged = { ...current, ...updates };
    await writeConfig(merged);
    return NextResponse.json(merged);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
