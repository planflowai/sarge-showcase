import { NextResponse } from "next/server";
import { clearBalanceCache } from "../balanceCache";

/** Force-clear cached balances and return fresh data */
export async function POST() {
  clearBalanceCache();
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3101";
    const res = await fetch(`${baseUrl}/api/billing/balances`, {
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, balances: data.balances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
