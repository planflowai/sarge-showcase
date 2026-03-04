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

// Server-side logger (fs-dependent) — only import in API routes
export { logUsage, readUsageEntries, readSession, readConfig, writeConfig } from "./logger";

// Client-side store functions (fetch-based)
export { getStats, getSession, getDailyTotals, getConfig, updateConfig, logUsageClient } from "./store";
