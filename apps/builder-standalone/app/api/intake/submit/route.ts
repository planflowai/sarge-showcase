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

    // Send email notification (non-blocking)
    sendNotificationEmail(formData, refCode).catch((err) =>
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

async function sendNotificationEmail(
  formData: any,
  refCode: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFICATION_EMAIL;

  const businessName = formData.business_name || "Unknown";
  const industry = formData.industry || "Not specified";

  if (!resendKey || !notifyEmail) {
    console.log(
      `[intake/submit] New intake: ${businessName} — ${industry} — Ref: ${refCode} (no Resend key or notification email configured)`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "SARGE Web Studio <onboarding@resend.dev>",
      to: [notifyEmail],
      subject: `New Project Intake — ${businessName} — Ref: ${refCode}`,
      text: `New project intake submitted.\n\nBusiness: ${businessName}\nIndustry: ${industry}\nEmail: ${formData.email || "N/A"}\nRef: ${refCode}\n\nReview in Supabase.`,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("[intake/submit] Resend error:", res.status, err);
  }
}
