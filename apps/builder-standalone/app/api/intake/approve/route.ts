import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { ref_code } = await req.json();

    if (!ref_code) {
      return NextResponse.json({ error: "Missing ref_code" }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to approved
    const { error } = await supabase
      .from("client_intake")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("ref_code", ref_code);

    if (error) {
      console.error("[intake/approve] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
    }

    // TODO (Phase D): Trigger deploy to all 3 hosts, send site_live email, start rollback timer

    console.log(`[intake/approve] Project ${ref_code} approved`);

    return NextResponse.json({ success: true, status: "approved" });
  } catch (err: any) {
    console.error("[intake/approve] Error:", err);
    return NextResponse.json({ error: err.message || "Approval failed" }, { status: 500 });
  }
}
