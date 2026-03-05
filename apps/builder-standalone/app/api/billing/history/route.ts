import { NextRequest, NextResponse } from "next/server";
import { readUsageEntries } from "@sarge/billing/src/logger";

/**
 * GET /api/billing/history?days=30&app=trials-cloud
 * Returns per-run usage history with real costs (from usage.jsonl).
 */
export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
  const appFilter = req.nextUrl.searchParams.get("app") || undefined;

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    let entries = await readUsageEntries(since);
    if (appFilter) {
      entries = entries.filter(e => e.app === appFilter);
    }
    // Sort newest first
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return NextResponse.json({ entries, count: entries.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
