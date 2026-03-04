import { NextResponse } from "next/server";
import { getAllRates } from "@sarge/billing";

export async function GET() {
  return NextResponse.json({ rates: getAllRates() });
}
