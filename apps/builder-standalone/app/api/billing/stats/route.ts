import { NextRequest, NextResponse } from "next/server";
import { readUsageEntries } from "@sarge/billing/src/logger";
import type { PeriodStats, ModelBreakdown, AppBreakdown } from "@sarge/billing";

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") || "day") as "day" | "week" | "month" | "all";

  const now = new Date();
  let since: Date | undefined;
  if (period === "day") since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === "week") since = new Date(now.getTime() - 7 * 86400000);
  else if (period === "month") since = new Date(now.getFullYear(), now.getMonth(), 1);

  const entries = await readUsageEntries(since);

  const stats: PeriodStats = {
    period,
    totalCost: entries.reduce((s, e) => s + e.cost, 0),
    totalTokensIn: entries.reduce((s, e) => s + e.tokensIn, 0),
    totalTokensOut: entries.reduce((s, e) => s + e.tokensOut, 0),
    callCount: entries.length,
    entries,
  };

  // Model breakdown
  const modelMap = new Map<string, ModelBreakdown>();
  for (const e of entries) {
    const key = `${e.provider}/${e.model}`;
    const existing = modelMap.get(key) || {
      model: e.model, provider: e.provider, totalCost: 0, callCount: 0,
      totalTokensIn: 0, totalTokensOut: 0, avgTokensPerSecond: 0,
    };
    existing.totalCost += e.cost;
    existing.callCount += 1;
    existing.totalTokensIn += e.tokensIn;
    existing.totalTokensOut += e.tokensOut;
    modelMap.set(key, existing);
  }
  const modelBreakdown = Array.from(modelMap.values()).map(m => {
    const relevant = entries.filter(e => e.model === m.model && e.provider === m.provider);
    m.avgTokensPerSecond = relevant.length > 0
      ? Math.round(relevant.reduce((s, e) => s + e.tokensPerSecond, 0) / relevant.length * 10) / 10
      : 0;
    return m;
  });

  // App breakdown
  const appMap = new Map<string, AppBreakdown>();
  for (const e of entries) {
    const existing = appMap.get(e.app) || { app: e.app, totalCost: 0, callCount: 0 };
    existing.totalCost += e.cost;
    existing.callCount += 1;
    appMap.set(e.app, existing);
  }

  return NextResponse.json({
    ...stats,
    modelBreakdown,
    appBreakdown: Array.from(appMap.values()),
  });
}
