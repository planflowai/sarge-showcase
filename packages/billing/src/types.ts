export interface UsageEntry {
  id: string;
  model: string;
  provider: string;
  app: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  tokensPerSecond: number;
  durationMs: number;
  timestamp: string;
  context?: string;
}

export interface SessionStats {
  sessionId: string;
  startedAt: string;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  callCount: number;
  models: Record<string, { cost: number; calls: number }>;
}

export interface PeriodStats {
  period: "day" | "week" | "month" | "all";
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  callCount: number;
  entries: UsageEntry[];
}

export interface ModelBreakdown {
  model: string;
  provider: string;
  totalCost: number;
  callCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  avgTokensPerSecond: number;
}

export interface AppBreakdown {
  app: string;
  totalCost: number;
  callCount: number;
}

export interface DailyTotal {
  date: string;
  cost: number;
  callCount: number;
}

export interface BillingConfig {
  balance: number;
  alertAt: number;
  dailyCap: number | null;
  weeklyCap: number | null;
}
