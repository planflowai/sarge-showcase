import { NextResponse } from "next/server";
import { getAllRates } from "@sarge/billing";
import { getCustomRates } from "@sarge/billing/src/rateOverrides";

export async function GET() {
  const base = getAllRates();
  const custom = getCustomRates();
  const merged = { ...base, ...custom };
  return NextResponse.json({
    rates: merged,
    hasCustom: Object.keys(custom).length > 0,
  });
}
