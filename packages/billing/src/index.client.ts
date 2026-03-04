// @sarge/billing/index.client — Client-safe exports only (no fs/path)

export type {
  UsageEntry,
  SessionStats,
  PeriodStats,
  ModelBreakdown,
  AppBreakdown,
  DailyTotal,
  BillingConfig,
} from "./types";

export type { ModelRate } from "./rates";
export { MODEL_RATES, getRate, getAllRates } from "./rates";
export { calculateCost, formatCost } from "./calculator";

// Client-side store functions (fetch-based, no fs)
export { getStats, getSession, getDailyTotals, getConfig, updateConfig, logUsageClient } from "./store";
