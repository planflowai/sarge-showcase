/**
 * Server-only rate overrides — reads/writes L:/sarge-data/billing/rates-custom.json
 * DO NOT import this from client-side code (it uses fs).
 */
import fs from "fs";
import path from "path";
import type { ModelRate } from "./rates";

const BILLING_DIR = "L:/sarge-data/billing";
const CUSTOM_RATES_FILE = path.join(BILLING_DIR, "rates-custom.json");

let cache: Record<string, ModelRate> = {};
let cacheMtime = 0;

/** Read custom rate overrides from JSON file. Cached with mtime check. */
export function getCustomRates(): Record<string, ModelRate> {
  try {
    const stat = fs.statSync(CUSTOM_RATES_FILE);
    if (stat.mtimeMs !== cacheMtime) {
      const raw = fs.readFileSync(CUSTOM_RATES_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      cache = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (key.startsWith("_")) continue;
        const v = val as Record<string, unknown>;
        if (v && typeof v.input === "number" && typeof v.output === "number") {
          cache[key] = { input: v.input, output: v.output };
        }
      }
      cacheMtime = stat.mtimeMs;
    }
  } catch {
    // File doesn't exist yet — that's normal
    if (Object.keys(cache).length > 0) cache = {};
  }
  return cache;
}

/** Write rate overrides. Merges with existing overrides. */
export function writeCustomRates(
  overrides: Record<string, ModelRate>,
  meta?: { lastChecked: string; checkedWith: string }
): void {
  if (!fs.existsSync(BILLING_DIR)) {
    fs.mkdirSync(BILLING_DIR, { recursive: true });
  }

  let existing: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(CUSTOM_RATES_FILE, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // Starting fresh
  }

  if (meta) {
    existing._meta = meta;
  }

  for (const [key, rate] of Object.entries(overrides)) {
    existing[key] = rate;
  }

  fs.writeFileSync(CUSTOM_RATES_FILE, JSON.stringify(existing, null, 2), "utf-8");
  cacheMtime = 0; // Invalidate cache
}
