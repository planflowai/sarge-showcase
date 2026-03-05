/** Shared balance cache — separated from route to avoid Next.js export restrictions */

interface ProviderBalanceResult {
  provider: string;
  status: "ok" | "error" | "no-key" | "no-api";
  balance?: number;
  currency?: string;
  message?: string;
  consoleUrl?: string;
  lastUpdated: string;
}

let cache: { data: ProviderBalanceResult[]; timestamp: number } | null = null;
export const CACHE_TTL = 5 * 60 * 1000;

export function getBalanceCache() { return cache; }
export function setBalanceCache(data: ProviderBalanceResult[]) {
  cache = { data, timestamp: Date.now() };
}
export function clearBalanceCache() { cache = null; }
export function isCacheValid() {
  return cache && Date.now() - cache.timestamp < CACHE_TTL;
}
