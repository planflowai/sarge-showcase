import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Missing ref parameter" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch intake record
  const { data: intake, error: intakeErr } = await supabase
    .from("client_intake")
    .select("*")
    .eq("ref_code", ref)
    .single();

  if (intakeErr || !intake) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch revision count
  const { count: revisionCount } = await supabase
    .from("client_revisions")
    .select("*", { count: "exact", head: true })
    .eq("ref_code", ref);

  return NextResponse.json({
    ref_code: intake.ref_code,
    project_name: intake.project_name || intake.form_data?.business_name || "Untitled Project",
    client_name: intake.client_name || intake.form_data?.contact_name || "",
    client_email: intake.client_email || intake.form_data?.email || "",
    status: intake.status,
    intake_submitted_at: intake.intake_submitted_at,
    build_started_at: intake.build_started_at,
    preview_sent_at: intake.preview_sent_at,
    approved_at: intake.approved_at,
    deployed_at: intake.deployed_at,
    revision_count: revisionCount || 0,
    max_revisions: 3,
    form_data: intake.form_data,
  });
}
