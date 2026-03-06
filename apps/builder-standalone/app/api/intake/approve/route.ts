import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ref_code, action } = body;

    if (!ref_code) {
      return NextResponse.json({ error: "Missing ref_code" }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const emailEndpoint = new URL("/api/email/send", req.url).toString();

    // ── Action: start_build ── Set status to 'building'
    if (action === "start_build") {
      const { error } = await supabase
        .from("client_intake")
        .update({
          status: "building",
          build_started_at: new Date().toISOString(),
        })
        .eq("ref_code", ref_code);

      if (error) {
        console.error("[intake/approve] start_build error:", error.message);
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
      }

      console.log(`[intake/approve] Project ${ref_code} → building`);
      return NextResponse.json({ success: true, status: "building" });
    }

    // ── Action: send_preview ── Set status to 'preview'
    if (action === "send_preview") {
      const { error } = await supabase
        .from("client_intake")
        .update({
          status: "preview",
          preview_sent_at: new Date().toISOString(),
        })
        .eq("ref_code", ref_code);

      if (error) {
        console.error("[intake/approve] send_preview error:", error.message);
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
      }

      console.log(`[intake/approve] Project ${ref_code} → preview`);
      return NextResponse.json({ success: true, status: "preview" });
    }

    // ── Default action: approve ── Full approval → deploy → email
    // Fetch intake data for email
    const { data: intake, error: fetchErr } = await supabase
      .from("client_intake")
      .select("*")
      .eq("ref_code", ref_code)
      .single();

    if (fetchErr || !intake) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Update status to deployed
    const { error: updateErr } = await supabase
      .from("client_intake")
      .update({
        status: "deployed",
        approved_at: now,
        deployed_at: now,
      })
      .eq("ref_code", ref_code);

    if (updateErr) {
      console.error("[intake/approve] Supabase error:", updateErr.message);
      return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
    }

    // Trigger deploy to all 3 hosts (non-blocking)
    const projectName = (intake.project_name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const BUILDER_PROJECTS_DIR = process.env.BUILDER_PROJECTS_DIR ||
      (process.platform === "win32" ? "L:/AI_MASTER_BUILDS" : "/AI_MASTER_BUILDS");
    const projectPath = `${BUILDER_PROJECTS_DIR}/${projectName}`;

    // Push to all deploy targets (non-blocking)
    fetch(new URL("/api/deploy", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "push",
        projectPath,
        projectName,
        targets: ["github", "vercel", "netlify", "cloudflare"],
      }),
    }).catch((err) => console.warn("[intake/approve] Deploy push failed:", err));

    // Build live URLs
    const liveUrls = [
      `https://${projectName}.vercel.app`,
      `https://${projectName}.netlify.app`,
      `https://${projectName}.pages.dev`,
    ].join(",");

    const rollbackUrl = `${new URL(req.url).origin}/rollback/${encodeURIComponent(ref_code)}`;

    // Send site_live email to client (non-blocking)
    const clientEmail = intake.client_email || intake.form_data?.email;
    if (clientEmail) {
      fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          template: "site_live",
          data: {
            client_name: intake.client_name || intake.form_data?.contact_name || "Client",
            project_name: intake.project_name || intake.form_data?.business_name || "Your Project",
            live_urls: liveUrls,
            rollback_url: rollbackUrl,
            remaining_balance: "",
            payment_link: "",
          },
        }),
      }).catch((err) => console.warn("[intake/approve] Site live email failed:", err));
    }

    console.log(`[intake/approve] Project ${ref_code} approved + deployed`);

    return NextResponse.json({
      success: true,
      status: "deployed",
      live_urls: liveUrls,
      rollback_url: rollbackUrl,
    });
  } catch (err: any) {
    console.error("[intake/approve] Error:", err);
    return NextResponse.json({ error: err.message || "Approval failed" }, { status: 500 });
  }
}
