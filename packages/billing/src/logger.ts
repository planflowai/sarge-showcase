import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { UsageEntry, SessionStats, BillingConfig } from "./types";
import { calculateCost } from "./calculator";

const BILLING_DIR = "L:/sarge-data/billing";
const USAGE_FILE = path.join(BILLING_DIR, "usage.jsonl");
const SESSION_FILE = path.join(BILLING_DIR, "session.json");
const CONFIG_FILE = path.join(BILLING_DIR, "config.json");

let sessionId: string | null = null;
let sessionStartedAt: string | null = null;

async function ensureDir(): Promise<void> {
  await fs.mkdir(BILLING_DIR, { recursive: true });
}

/** Log a usage entry. Auto-calculates cost, generates ID, timestamps, writes to disk. */
export async function logUsage(params: {
  model: string;
  provider: string;
  app: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  context?: string;
}): Promise<UsageEntry> {
  await ensureDir();

  const cost = calculateCost(params.model, params.provider, params.tokensIn, params.tokensOut);
  const tokensPerSecond = params.durationMs > 0
    ? Math.round((params.tokensOut / (params.durationMs / 1000)) * 10) / 10
    : 0;

  const entry: UsageEntry = {
    id: crypto.randomUUID(),
    model: params.model,
    provider: params.provider,
    app: params.app,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    cost,
    tokensPerSecond,
    durationMs: params.durationMs,
    timestamp: new Date().toISOString(),
    context: params.context,
  };

  await fs.appendFile(USAGE_FILE, JSON.stringify(entry) + "\n", "utf-8");
  await updateSession(entry);
  return entry;
}

async function updateSession(entry: UsageEntry): Promise<void> {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStartedAt = new Date().toISOString();
  }

  let session: SessionStats;
  try {
    const raw = await fs.readFile(SESSION_FILE, "utf-8");
    session = JSON.parse(raw);
    if (session.sessionId !== sessionId) throw new Error("stale");
  } catch {
    session = {
      sessionId: sessionId!,
      startedAt: sessionStartedAt!,
      totalCost: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      callCount: 0,
      models: {},
    };
  }

  session.totalCost += entry.cost;
  session.totalTokensIn += entry.tokensIn;
  session.totalTokensOut += entry.tokensOut;
  session.callCount += 1;

  if (!session.models[entry.model]) {
    session.models[entry.model] = { cost: 0, calls: 0 };
  }
  session.models[entry.model].cost += entry.cost;
  session.models[entry.model].calls += 1;

  await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
}

/** Read all usage entries, optionally filtered by date. */
export async function readUsageEntries(since?: Date): Promise<UsageEntry[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(USAGE_FILE, "utf-8");
    const entries = raw.trim().split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line) as UsageEntry);
    if (since) {
      const sinceMs = since.getTime();
      return entries.filter(e => new Date(e.timestamp).getTime() >= sinceMs);
    }
    return entries;
  } catch {
    return [];
  }
}

/** Read current session stats. */
export async function readSession(): Promise<SessionStats | null> {
  try {
    const raw = await fs.readFile(SESSION_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Read billing config (balance, caps, alerts). */
export async function readConfig(): Promise<BillingConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { balance: 50.00, alertAt: 10.00, dailyCap: 5.00, weeklyCap: 25.00 };
  }
}

/** Write billing config. */
export async function writeConfig(config: BillingConfig): Promise<void> {
  await ensureDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}
