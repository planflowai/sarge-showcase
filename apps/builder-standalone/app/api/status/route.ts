import { NextResponse } from "next/server";

/** Standalone status endpoint — always returns ok (no beast dependency). */
export async function GET() {
  return NextResponse.json({ status: "ok", standalone: true, timestamp: Date.now() });
}
