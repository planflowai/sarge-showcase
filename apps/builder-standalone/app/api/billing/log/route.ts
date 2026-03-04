import { NextRequest, NextResponse } from "next/server";
import { logUsage } from "@sarge/billing/src/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await logUsage({
      model: body.model || "unknown",
      provider: body.provider || "unknown",
      app: body.app || "builder",
      tokensIn: body.tokensIn || 0,
      tokensOut: body.tokensOut || 0,
      durationMs: body.durationMs || 0,
      context: body.context,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
