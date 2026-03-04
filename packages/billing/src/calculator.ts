import { getRate } from "./rates";

/** Calculate cost in USD for a model call. Returns 0 for local models. */
export function calculateCost(
  model: string,
  provider: string,
  tokensIn: number,
  tokensOut: number
): number {
  const rate = getRate(model, provider);
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
