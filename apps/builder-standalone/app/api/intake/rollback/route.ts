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

    // Fetch project to verify rollback is still valid
    const { data: intake, error: fetchErr } = await supabase
      .from("client_intake")
      .select("deployed_at, project_name, client_name, status")
      .eq("ref_code", ref_code)
      .single();

    if (fetchErr || !intake) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check 60-minute window
    if (intake.deployed_at) {
      const deployedAt = new Date(intake.deployed_at).getTime();
      const now = Date.now();
      const minutesElapsed = (now - deployedAt) / 60000;
      if (minutesElapsed > 60) {
        return NextResponse.json(
          { error: "Rollback window has expired (60 minutes)" },
          { status: 410 },
        );
      }
    }

    // Update status back to preview
    const { error: updateErr } = await supabase
      .from("client_intake")
      .update({
        status: "preview",
        deployed_at: null,
      })
      .eq("ref_code", ref_code);

    if (updateErr) {
      console.error("[intake/rollback] Supabase error:", updateErr.message);
    }

    // Redeploy coming-soon page to all hosts (non-blocking)
    const projectName = (intake.project_name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const BUILDER_PROJECTS_DIR = process.env.BUILDER_PROJECTS_DIR ||
      (process.platform === "win32" ? "L:/AI_MASTER_BUILDS" : "/AI_MASTER_BUILDS");
    const projectPath = `${BUILDER_PROJECTS_DIR}/${projectName}`;

    // Use deploy API to push the coming-soon page back to all hosts
    // The deploy route will commit current state and push to all targets
    fetch(new URL("/api/deploy", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "push",
        projectPath,
        projectName,
        targets: ["github", "vercel", "netlify", "cloudflare"],
        commitMessage: "ROLLBACK — restored coming-soon page",
      }),
    }).catch((err) => console.warn("[intake/rollback] Redeploy failed:", err));

    // Send rollback alert email to owner (non-blocking)
    const emailEndpoint = new URL("/api/email/send", req.url).toString();
    const notifyEmail = process.env.NOTIFICATION_EMAIL;
    if (notifyEmail) {
      fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: notifyEmail,
          template: "rollback_alert",
          data: {
            client_name: intake.client_name || "Unknown",
            project_name: intake.project_name || "Unknown",
            ref_code,
            rollback_time: new Date().toISOString(),
          },
        }),
      }).catch((err) => console.warn("[intake/rollback] Rollback alert email failed:", err));
    }

    console.log(`[intake/rollback] Project ${ref_code} rolled back — redeploying coming-soon`);

    return NextResponse.json({ success: true, status: "rolled_back" });
  } catch (err: any) {
    console.error("[intake/rollback] Error:", err);
    return NextResponse.json({ error: err.message || "Rollback failed" }, { status: 500 });
  }
}
