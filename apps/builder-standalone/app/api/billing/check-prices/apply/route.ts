import { NextRequest, NextResponse } from "next/server";
import { writeCustomRates } from "@sarge/billing/src/rateOverrides";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { overrides, checkedWith } = body as {
      overrides: Array<{ model: string; input: number; output: number }>;
      checkedWith?: string;
    };

    if (!overrides || !Array.isArray(overrides) || overrides.length === 0) {
      return NextResponse.json({ error: "overrides array is required" }, { status: 400 });
    }

    const rateMap: Record<string, { input: number; output: number }> = {};
    for (const o of overrides) {
      if (typeof o.model === "string" && typeof o.input === "number" && typeof o.output === "number") {
        rateMap[o.model] = { input: o.input, output: o.output };
      }
    }

    writeCustomRates(rateMap, {
      lastChecked: new Date().toISOString(),
      checkedWith: checkedWith || "unknown",
    });

    return NextResponse.json({ ok: true, applied: Object.keys(rateMap).length });
  } catch (err) {
    console.error("[check-prices/apply] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
