// @sarge/billing — Cost tracking, usage logging, rate tables

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

// Server-side logger is NOT re-exported here — it uses fs/path which crash client webpack.
// API routes must import directly: import { logUsage } from "@sarge/billing/src/logger";

// Client-side store functions (fetch-based)
export { getStats, getSession, getDailyTotals, getConfig, updateConfig, logUsageClient } from "./store";
