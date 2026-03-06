import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Generate ref code if not provided
    const refCode =
      formData.ref || "SARGE-" + Date.now().toString(36).toUpperCase();
    const email = formData.email || null;

    // Write to Supabase — columns aligned with SARGE_Client_Pipeline_Spec
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from("client_intake").insert({
        form_data: formData,
        status: "new",
        ref_code: refCode,
        email,
        project_name: formData.business_name || null,
        client_name: formData.contact_name || formData.business_name || null,
        client_email: formData.email || null,
        intake_submitted_at: new Date().toISOString(),
      });
      if (error) {
        console.error("[intake/submit] Supabase error:", error.message);
      }
    } else {
      console.warn("[intake/submit] Supabase not configured — skipping DB write");
    }

    // Send emails (non-blocking — never block pipeline on email failure)
    sendIntakeEmails(request.url, formData, refCode).catch((err) =>
      console.warn("[intake/submit] Email notification failed:", err)
    );

    return NextResponse.json({ success: true, ref_code: refCode });
  } catch (error: any) {
    console.error("[intake/submit] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Submission failed" },
      { status: 500 }
    );
  }
}

async function sendIntakeEmails(
  requestUrl: string,
  formData: any,
  refCode: string
): Promise<void> {
  const emailEndpoint = new URL("/api/email/send", requestUrl).toString();
  const businessName = formData.business_name || "Unknown";
  const industry = formData.industry || "Not specified";
  const clientEmail = formData.email;
  const contactName = formData.contact_name || businessName;
  const notifyEmail = process.env.NOTIFICATION_EMAIL;

  // Build form summary rows for the client confirmation email
  const summaryRows: string[] = [];
  if (businessName !== "Unknown") summaryRows.push(`<tr><td style="padding:8px 12px;font-size:12px;color:#94A3B8;font-weight:600;border-bottom:1px solid #1E2128;">Business</td><td style="padding:8px 12px;font-size:13px;color:#E2E8F0;border-bottom:1px solid #1E2128;">${businessName}</td></tr>`);
  if (industry !== "Not specified") summaryRows.push(`<tr><td style="padding:8px 12px;font-size:12px;color:#94A3B8;font-weight:600;border-bottom:1px solid #1E2128;">Industry</td><td style="padding:8px 12px;font-size:13px;color:#E2E8F0;border-bottom:1px solid #1E2128;">${industry}</td></tr>`);
  if (formData.pages) summaryRows.push(`<tr><td style="padding:8px 12px;font-size:12px;color:#94A3B8;font-weight:600;border-bottom:1px solid #1E2128;">Pages</td><td style="padding:8px 12px;font-size:13px;color:#E2E8F0;border-bottom:1px solid #1E2128;">${Array.isArray(formData.pages) ? formData.pages.join(", ") : formData.pages}</td></tr>`);
  if (formData.features) summaryRows.push(`<tr><td style="padding:8px 12px;font-size:12px;color:#94A3B8;font-weight:600;border-bottom:1px solid #1E2128;">Features</td><td style="padding:8px 12px;font-size:13px;color:#E2E8F0;border-bottom:1px solid #1E2128;">${Array.isArray(formData.features) ? formData.features.join(", ") : formData.features}</td></tr>`);
  if (formData.style_preference) summaryRows.push(`<tr><td style="padding:8px 12px;font-size:12px;color:#94A3B8;font-weight:600;border-bottom:1px solid #1E2128;">Style</td><td style="padding:8px 12px;font-size:13px;color:#E2E8F0;border-bottom:1px solid #1E2128;">${formData.style_preference}</td></tr>`);

  const promises: Promise<void>[] = [];

  // (a) Confirmation email to client
  if (clientEmail) {
    promises.push(
      fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          template: "intake_received",
          data: {
            client_name: contactName,
            project_name: businessName,
            form_summary: summaryRows.join(""),
            timeline: "5-7",
            ref_code: refCode,
          },
        }),
      })
        .then((r) => {
          if (!r.ok) console.warn("[intake/submit] Client confirmation email failed:", r.status);
          else console.log(`[intake/submit] Intake confirmation sent to ${clientEmail}`);
        })
        .catch((err) => console.warn("[intake/submit] Client email error:", err)),
    );
  }

  // (b) Notification email to you (NOTIFICATION_EMAIL)
  if (notifyEmail) {
    promises.push(
      fetch(emailEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: notifyEmail,
          subject: `New Project Intake — ${businessName} — Ref: ${refCode}`,
          template: "intake_received",
          data: {
            client_name: `[NOTIFICATION] ${contactName}`,
            project_name: businessName,
            form_summary: summaryRows.join("") +
              `<tr><td style="padding:8px 12px;font-size:12px;color:#94A3B8;font-weight:600;border-bottom:1px solid #1E2128;">Client Email</td><td style="padding:8px 12px;font-size:13px;color:#E2E8F0;border-bottom:1px solid #1E2128;">${clientEmail || "N/A"}</td></tr>`,
            timeline: "5-7",
            ref_code: refCode,
          },
        }),
      })
        .then((r) => {
          if (!r.ok) console.warn("[intake/submit] Notification email failed:", r.status);
          else console.log(`[intake/submit] Notification sent to ${notifyEmail}`);
        })
        .catch((err) => console.warn("[intake/submit] Notification email error:", err)),
    );
  }

  // If neither email configured, just log
  if (!clientEmail && !notifyEmail) {
    console.log(
      `[intake/submit] New intake: ${businessName} — ${industry} — Ref: ${refCode} (no emails configured)`,
    );
  }

  await Promise.allSettled(promises);
}
