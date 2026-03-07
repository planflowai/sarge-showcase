import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ intakes: [] });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("client_intake")
      .select("id, ref_code, project_name, client_name, client_email, form_data, status, intake_submitted_at, created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[intake/pending] Supabase error:", error.message);
      return NextResponse.json({ intakes: [] });
    }

    return NextResponse.json({ intakes: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[intake/pending] Error:", msg);
    return NextResponse.json({ intakes: [] });
  }
}
