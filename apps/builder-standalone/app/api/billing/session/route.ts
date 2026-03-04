import { NextResponse } from "next/server";
import { readSession } from "@sarge/billing";

export async function GET() {
  const session = await readSession();
  return NextResponse.json({ session });
}
