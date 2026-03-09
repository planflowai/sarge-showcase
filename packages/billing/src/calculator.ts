import { getRate } from "./rates";

let _customRates: Record<string, { input: number; output: number }> | null = null;

/** Inject custom rate overrides (called from server-side billing routes). */
export function setCustomRates(rates: Record<string, { input: number; output: number }>): void {
  _customRates = rates;
}

/** Calculate cost in USD for a model call. Checks custom overrides first. */
export function calculateCost(
  model: string,
  provider: string,
  tokensIn: number,
  tokensOut: number
): number {
  const custom = _customRates?.[model];
  const rate = custom || getRate(model, provider);
  const inputCost = (tokensIn / 1_000_000) * rate.input;
  const outputCost = (tokensOut / 1_000_000) * rate.output;
  return Math.round((inputCost + outputCost) * 1e6) / 1e6;
}

/** Format cost for display. */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.005) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}
