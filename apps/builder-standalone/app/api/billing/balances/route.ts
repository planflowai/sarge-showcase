import { NextResponse } from "next/server";
import { PROVIDER_CONSOLE_URLS } from "@sarge/billing";

interface ProviderBalanceResult {
  provider: string;
  status: "ok" | "error" | "no-key" | "no-api";
  balance?: number;
  currency?: string;
  message?: string;
  consoleUrl?: string;
  lastUpdated: string;
}

// 5-minute cache
let cache: { data: ProviderBalanceResult[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/** Clear cached balances (called by /api/billing/refresh) */
export function clearBalanceCache() { cache = null; }

function getApiKey(provider: string): string {
  switch (provider) {
    case "anthropic": return process.env.ANTHROPIC_API_KEY || "";
    case "openai":    return process.env.OPENAI_API_KEY || "";
    case "google":    return process.env.GOOGLE_API_KEY || "";
    case "xai":       return process.env.XAI_API_KEY || "";
    case "deepseek":  return process.env.DEEPSEEK_API_KEY || "";
    case "mistral":   return process.env.MISTRAL_API_KEY || "";
    case "huggingface": return process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "";
    default: return "";
  }
}

async function queryOpenAI(apiKey: string): Promise<ProviderBalanceResult> {
  try {
    const res = await fetch("https://api.openai.com/dashboard/billing/credit_grants", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        provider: "openai",
        status: "ok",
        balance: data.total_available ?? data.total_remaining ?? undefined,
        currency: "USD",
        message: data.total_granted ? `Granted: $${data.total_granted}, Used: $${data.total_used}` : undefined,
        consoleUrl: PROVIDER_CONSOLE_URLS.openai,
        lastUpdated: new Date().toISOString(),
      };
    }
    // Billing endpoint may be restricted — fall back to console link
    return {
      provider: "openai",
      status: "no-api",
      message: "Balance API restricted — check console",
      consoleUrl: PROVIDER_CONSOLE_URLS.openai,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return { provider: "openai", status: "error", message: "Failed to query", consoleUrl: PROVIDER_CONSOLE_URLS.openai, lastUpdated: new Date().toISOString() };
  }
}

async function queryDeepSeek(apiKey: string): Promise<ProviderBalanceResult> {
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const info = data.balance_infos?.[0];
      return {
        provider: "deepseek",
        status: "ok",
        balance: info ? parseFloat(info.total_balance) : undefined,
        currency: info?.currency || "USD",
        consoleUrl: PROVIDER_CONSOLE_URLS.deepseek,
        lastUpdated: new Date().toISOString(),
      };
    }
    return { provider: "deepseek", status: "error", message: `HTTP ${res.status}`, consoleUrl: PROVIDER_CONSOLE_URLS.deepseek, lastUpdated: new Date().toISOString() };
  } catch {
    return { provider: "deepseek", status: "error", message: "Failed to query", consoleUrl: PROVIDER_CONSOLE_URLS.deepseek, lastUpdated: new Date().toISOString() };
  }
}

async function queryAnthropic(apiKey: string): Promise<ProviderBalanceResult> {
  // Anthropic doesn't have a public balance API
  return {
    provider: "anthropic",
    status: apiKey ? "no-api" : "no-key",
    message: apiKey ? "No balance API — check console" : "No API key configured",
    consoleUrl: PROVIDER_CONSOLE_URLS.anthropic,
    lastUpdated: new Date().toISOString(),
  };
}

async function queryGoogle(apiKey: string): Promise<ProviderBalanceResult> {
  return {
    provider: "google",
    status: apiKey ? "no-api" : "no-key",
    message: apiKey ? "Free tier active" : "No API key configured",
    consoleUrl: PROVIDER_CONSOLE_URLS.google,
    lastUpdated: new Date().toISOString(),
  };
}

async function queryXAI(apiKey: string): Promise<ProviderBalanceResult> {
  return {
    provider: "xai",
    status: apiKey ? "no-api" : "no-key",
    message: apiKey ? "No balance API — check console" : "No API key configured",
    consoleUrl: PROVIDER_CONSOLE_URLS.xai,
    lastUpdated: new Date().toISOString(),
  };
}

async function queryMistral(apiKey: string): Promise<ProviderBalanceResult> {
  return {
    provider: "mistral",
    status: apiKey ? "no-api" : "no-key",
    message: apiKey ? "No balance API — check console" : "No API key configured",
    consoleUrl: PROVIDER_CONSOLE_URLS.mistral,
    lastUpdated: new Date().toISOString(),
  };
}

async function queryHuggingFace(apiKey: string): Promise<ProviderBalanceResult> {
  if (!apiKey) {
    return { provider: "huggingface", status: "no-key", message: "No API key", consoleUrl: PROVIDER_CONSOLE_URLS.huggingface, lastUpdated: new Date().toISOString() };
  }
  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        provider: "huggingface",
        status: "ok",
        message: `Account: ${data.name || data.fullname || "connected"}`,
        consoleUrl: PROVIDER_CONSOLE_URLS.huggingface,
        lastUpdated: new Date().toISOString(),
      };
    }
    return { provider: "huggingface", status: "error", message: `HTTP ${res.status}`, consoleUrl: PROVIDER_CONSOLE_URLS.huggingface, lastUpdated: new Date().toISOString() };
  } catch {
    return { provider: "huggingface", status: "error", message: "Failed to query", consoleUrl: PROVIDER_CONSOLE_URLS.huggingface, lastUpdated: new Date().toISOString() };
  }
}

async function queryAllProviders(): Promise<ProviderBalanceResult[]> {
  const providers = ["anthropic", "openai", "google", "xai", "deepseek", "mistral", "huggingface"];
  const queries = providers.map(async (p) => {
    const key = getApiKey(p);
    if (!key && p !== "google") {
      return { provider: p, status: "no-key" as const, message: "No API key configured", consoleUrl: PROVIDER_CONSOLE_URLS[p], lastUpdated: new Date().toISOString() };
    }
    switch (p) {
      case "anthropic":   return queryAnthropic(key);
      case "openai":      return queryOpenAI(key);
      case "google":      return queryGoogle(key);
      case "xai":         return queryXAI(key);
      case "deepseek":    return queryDeepSeek(key);
      case "mistral":     return queryMistral(key);
      case "huggingface": return queryHuggingFace(key);
      default:            return { provider: p, status: "error" as const, message: "Unknown provider", lastUpdated: new Date().toISOString() };
    }
  });
  return Promise.all(queries);
}

export async function GET() {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json({ balances: cache.data, cached: true });
  }

  const results = await queryAllProviders();
  cache = { data: results, timestamp: Date.now() };
  return NextResponse.json({ balances: results, cached: false });
}
