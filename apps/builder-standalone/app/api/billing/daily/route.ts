import { NextRequest, NextResponse } from "next/server";
import { readUsageEntries } from "@sarge/billing/src/logger";
import type { DailyTotal } from "@sarge/billing";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
  const since = new Date(Date.now() - days * 86400000);
  const entries = await readUsageEntries(since);

  const dailyMap = new Map<string, DailyTotal>();
  for (const e of entries) {
    const date = e.timestamp.slice(0, 10);
    const existing = dailyMap.get(date) || {
      date,
      cost: 0,
      callCount: 0,
      trialsCost: 0,
      builderCost: 0,
    };
    existing.cost += e.cost;
    existing.callCount += 1;
    if (e.app === "trials-cloud") {
      existing.trialsCost = (existing.trialsCost || 0) + e.cost;
    } else if (e.app === "builder") {
      existing.builderCost = (existing.builderCost || 0) + e.cost;
    }
    dailyMap.set(date, existing);
  }

  const dailyTotals = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ dailyTotals });
}
