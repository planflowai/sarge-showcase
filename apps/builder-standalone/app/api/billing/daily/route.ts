import { NextRequest, NextResponse } from "next/server";
import { readUsageEntries } from "@sarge/billing/src/logger";
import { calculateCost } from "@sarge/billing";
import type { DailyTotal } from "@sarge/billing";

/** Recalculate cost if logged cost was zero (rate lookup failed at log time) */
function fixCost(e: { model: string; provider: string; tokensIn: number; tokensOut: number; cost: number }): number {
  if (e.cost > 0) return e.cost;
  const isLocal = e.provider === "ollama" || e.provider === "lmstudio";
  if (isLocal || e.tokensOut === 0) return 0;
  return calculateCost(e.model, e.provider, e.tokensIn, e.tokensOut);
}

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
    const cost = fixCost(e);
    existing.cost += cost;
    existing.callCount += 1;
    if (e.app === "trials-cloud") {
      existing.trialsCost = (existing.trialsCost || 0) + cost;
    } else if (e.app === "builder") {
      existing.builderCost = (existing.builderCost || 0) + cost;
    }
    dailyMap.set(date, existing);
  }

  const dailyTotals = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ dailyTotals });
}
