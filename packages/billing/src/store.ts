import type { PeriodStats, SessionStats, ModelBreakdown, AppBreakdown, DailyTotal, BillingConfig } from "./types";

/** Fetch aggregated stats for a period. */
export async function getStats(period: "day" | "week" | "month" | "all"): Promise<PeriodStats & { modelBreakdown: ModelBreakdown[]; appBreakdown: AppBreakdown[] }> {
  const res = await fetch(`/api/billing/stats?period=${period}`);
  return res.json();
}

/** Fetch current session totals. */
export async function getSession(): Promise<SessionStats | null> {
  const res = await fetch("/api/billing/session");
  const data = await res.json();
  return data.session ?? null;
}

/** Fetch daily cost totals for charting. */
export async function getDailyTotals(days: number = 30): Promise<DailyTotal[]> {
  const res = await fetch(`/api/billing/daily?days=${days}`);
  const data = await res.json();
  return data.dailyTotals ?? [];
}

/** Fetch billing config (balance, caps). */
export async function getConfig(): Promise<BillingConfig> {
  const res = await fetch("/api/billing/balance");
  return res.json();
}

/** Update billing config. */
export async function updateConfig(config: Partial<BillingConfig>): Promise<BillingConfig> {
  const res = await fetch("/api/billing/balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

/** Client-side function to log usage via POST. Fire-and-forget. */
export async function logUsageClient(params: {
  model: string;
  provider: string;
  app: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  context?: string;
}): Promise<void> {
  fetch("/api/billing/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch(() => {});
}
