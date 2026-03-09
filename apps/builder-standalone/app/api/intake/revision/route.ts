import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const { ref_code, page, description, priority, attachment_url } = await request.json();

    if (!ref_code || !page || !description) {
      return NextResponse.json(
        { error: "Missing required fields: ref_code, page, description" },
        { status: 400 }
      );
    }

    let revisionNumber = 1;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Determine revision_number by counting existing revisions for this ref_code
      const { count, error: countErr } = await supabase
        .from("client_revisions")
        .select("*", { count: "exact", head: true })
        .eq("ref_code", ref_code);
      if (!countErr) {
        revisionNumber = (count || 0) + 1;
      }

      const { error } = await supabase.from("client_revisions").insert({
        ref_code,
        page,
        description,
        priority: priority || "medium",
        status: "new",
        revision_number: revisionNumber,
        attachment_url: attachment_url || null,
      });
      if (error) {
        // Log but don't block — table may not exist yet (run migration.sql)
        console.warn("[intake/revision] Supabase error:", error.message);
      }
    } else {
      console.warn("[intake/revision] Supabase not configured — logging revision");
      console.log("[intake/revision]", { ref_code, page, description, priority });
    }

    // Send revision notification emails (non-blocking)
    sendRevisionEmails(request.url, ref_code, page, description, priority || "medium", revisionNumber).catch(
      (err) => console.warn("[intake/revision] Email notification failed:", err),
    );

    return NextResponse.json({ success: true, revision_number: revisionNumber });
  } catch (error: any) {
    console.error("[intake/revision] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Submission failed" },
      { status: 500 }
    );
  }
}

async function sendRevisionEmails(
  requestUrl: string,
  refCode: string,
  page: string,
  description: string,
  priority: string,
  revisionNumber: number,
): Promise<void> {
  const emailEndpoint = new URL("/api/email/send", requestUrl).toString();
  const notifyEmail = process.env.NOTIFICATION_EMAIL;

  // Fetch intake data for client name/email
  let clientName = "Client";
  let clientEmail = "";
  let projectName = "Your Project";

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("client_intake")
      .select("client_name, client_email, project_name")
      .eq("ref_code", refCode)
      .single();
    if (data) {
      clientName = data.client_name || clientName;
      clientEmail = data.client_email || "";
      projectName = data.project_name || projectName;
    }
  }

  const promises: Promise<void>[] = [];

  // (a) Confirmation to client
  if (clientEmail) {
    promises.push(
      fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          template: "revision_received",
          data: {
            client_name: clientName,
            project_name: projectName,
            page,
            description,
            priority,
            revision_number: String(revisionNumber),
            ref_code: refCode,
            timeline: "2-3",
          },
        }),
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => { if (!r.ok) console.warn("[intake/revision] Client email failed:", r.status); })
        .catch((err) => console.warn("[intake/revision] Client email error:", err)),
    );
  }

  // (b) Notification to you
  if (notifyEmail) {
    promises.push(
      fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: notifyEmail,
          subject: `Revision Request — ${projectName} — Rev ${revisionNumber}`,
          template: "revision_received",
          data: {
            client_name: clientName,
            project_name: projectName,
            page,
            description,
            priority,
            revision_number: String(revisionNumber),
            ref_code: refCode,
            timeline: "2-3",
          },
        }),
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => { if (!r.ok) console.warn("[intake/revision] Notification failed:", r.status); })
        .catch((err) => console.warn("[intake/revision] Notification error:", err)),
    );
  }

  await Promise.allSettled(promises);
}
