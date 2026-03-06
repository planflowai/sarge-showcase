import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Auto-approval cron: finds projects with status='preview' where preview_sent_at
 * is older than 14 days. For each one, triggers the approve flow.
 *
 * Call via: GET /api/cron/auto-approve
 * Can be triggered by Vercel Cron, external cron, or manually.
 */
export async function GET(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Find projects pending preview for > 14 days
  const { data: pending, error: queryErr } = await supabase
    .from("client_intake")
    .select("ref_code, project_name, client_name, client_email, preview_sent_at")
    .eq("status", "preview")
    .lt("preview_sent_at", cutoff);

  if (queryErr) {
    console.error("[auto-approve] Query error:", queryErr.message);
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ message: "No projects pending auto-approval", count: 0 });
  }

  const approveEndpoint = new URL("/api/intake/approve", req.url).toString();
  const results: { ref_code: string; success: boolean; error?: string }[] = [];

  for (const project of pending) {
    try {
      const res = await fetch(approveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref_code: project.ref_code }),
      });
      const data = await res.json();
      results.push({ ref_code: project.ref_code, success: !!data.success, error: data.error });
      console.log(
        `[auto-approve] ${project.ref_code} (${project.project_name}) — auto-approved after 14 days`,
      );
    } catch (err: any) {
      results.push({ ref_code: project.ref_code, success: false, error: err.message });
      console.error(`[auto-approve] Failed for ${project.ref_code}:`, err.message);
    }
  }

  return NextResponse.json({
    message: `Auto-approved ${results.filter((r) => r.success).length} of ${pending.length} projects`,
    count: pending.length,
    results,
  });
}
