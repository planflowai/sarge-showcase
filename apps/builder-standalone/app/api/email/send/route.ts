import { NextRequest, NextResponse } from "next/server";

// ─── Types ──────────────────────────────────────────────────────────────────────

type TemplateName =
  | "welcome"
  | "intake_received"
  | "preview_ready"
  | "site_live"
  | "revision_received"
  | "rollback_alert";

interface EmailRequest {
  to: string;
  subject: string;
  template: TemplateName;
  data: Record<string, string>;
}

// ─── Template Variables Replacement ─────────────────────────────────────────────

function replaceVars(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "");
}

// ─── Logo Base64 (for email compatibility) ──────────────────────────────────────

const LOGO_B64 = "data:image/png;base64,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";

// ─── Shared Layout Wrapper ──────────────────────────────────────────────────────

function wrapLayout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PlanFlowAI</title>
</head>
<body style="margin:0;padding:0;background:#0B0E11;font-family:'DM Sans',system-ui,-apple-system,sans-serif;color:#E2E8F0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E11;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#13161B;border:1px solid #1E2128;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #1E2128;">
  <img src="${LOGO_B64}" alt="PlanFlowAI" height="60" style="display:block;margin:0 auto;max-height:60px;">
</td></tr>

<!-- Body -->
<tr><td style="padding:32px 40px;">
${bodyContent}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px 32px;border-top:1px solid #1E2128;text-align:center;">
  <div style="font-size:11px;color:#64748B;line-height:1.6;">
    PlanFlowAI &bull; AI-Powered Website Development<br>
    This is an automated message. Reply to this email if you have questions.
  </div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Button Helper ──────────────────────────────────────────────────────────────

function button(text: string, url: string, color = "#FF6700"): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
<tr><td style="background:${color};border-radius:8px;">
  <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.5px;">${text}</a>
</td></tr>
</table>`;
}

function buttonRow(buttons: { text: string; url: string; color?: string }[]): string {
  const cells = buttons
    .map(
      (b) =>
        `<td style="padding:0 8px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${b.color || "#FF6700"};border-radius:8px;">
  <a href="${b.url}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">${b.text}</a>
</td></tr></table></td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr>${cells}</tr></table>`;
}

// ─── Info Row Helper ────────────────────────────────────────────────────────────

function infoRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:8px 12px;font-size:12px;color:#94A3B8;font-weight:600;border-bottom:1px solid #1E2128;white-space:nowrap;">${label}</td>
  <td style="padding:8px 12px;font-size:13px;color:#E2E8F0;border-bottom:1px solid #1E2128;">${value}</td>
</tr>`;
}

// ─── 6 Email Templates ──────────────────────────────────────────────────────────

const TEMPLATES: Record<TemplateName, (data: Record<string, string>) => { subject: string; html: string }> = {
  // ── 1. Welcome ──────────────────────────────────────────────────────────────
  welcome: (data) => ({
    subject: `Welcome to PlanFlowAI — Your Project Has Started`,
    html: wrapLayout(`
  <div style="font-size:15px;color:#E2E8F0;line-height:1.7;">
    <p style="margin:0 0 16px;">Hi <strong>${data.client_name || "there"}</strong>,</p>
    <p style="margin:0 0 16px;">Welcome! Your project <strong style="color:#FF6700;">${data.project_name || "your website"}</strong> has been created and a temporary coming soon page is already live at:</p>
    <p style="margin:0 0 24px;"><a href="${data.coming_soon_url || "#"}" style="color:#FF6700;font-weight:600;">${data.coming_soon_url || "your coming soon URL"}</a></p>
    <p style="margin:0 0 8px;font-weight:700;color:#F8FAFC;">Next Step:</p>
    <p style="margin:0 0 16px;">Please fill out your <strong>Project Intake Form</strong> so we can start building your site. This form collects everything we need — your business info, services, design preferences, and content.</p>
    ${button("Complete Your Intake Form", data.intake_form_url || "#")}
    <div style="margin:24px 0;padding:16px 20px;background:#1A1D23;border:1px solid #FF6700;border-left:4px solid #FF6700;border-radius:8px;">
      <div style="font-size:12px;font-weight:700;color:#FF6700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Important Deadline</div>
      <div style="font-size:13px;color:#CBD5E1;line-height:1.6;">Please complete the form within <strong style="color:#F8FAFC;">7 business days</strong>. If we do not receive your completed form within 14 days, your project will be paused and your deposit will be held as credit for 90 days.</div>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#94A3B8;">Questions? Reply to this email or call us at ${data.your_phone || "our office"}.</p>
  </div>`),
  }),

  // ── 2. Intake Received ──────────────────────────────────────────────────────
  intake_received: (data) => ({
    subject: `We Got Everything — Building Starts Now`,
    html: wrapLayout(`
  <div style="font-size:15px;color:#E2E8F0;line-height:1.7;">
    <p style="margin:0 0 16px;">Hi <strong>${data.client_name || "there"}</strong>,</p>
    <p style="margin:0 0 16px;">We received your completed intake form for <strong style="color:#FF6700;">${data.project_name || "your project"}</strong>.</p>

    ${data.form_summary ? `
    <div style="margin:0 0 20px;">
      <div style="font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">What You Submitted</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1A1D23;border:1px solid #1E2128;border-radius:8px;overflow:hidden;">
        ${data.form_summary}
      </table>
    </div>` : ""}

    <p style="margin:0 0 8px;font-weight:700;color:#F8FAFC;">What happens next:</p>
    <p style="margin:0 0 16px;">Our team will review your submission and begin building your site. You will receive a preview link within <strong style="color:#FF6700;">${data.timeline || "5-7"}</strong> business days.</p>

    <div style="margin:24px 0;padding:16px 20px;background:#1A1D23;border:1px solid #F59E0B;border-left:4px solid #F59E0B;border-radius:8px;">
      <div style="font-size:12px;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Scope Lock Notice</div>
      <div style="font-size:13px;color:#CBD5E1;line-height:1.6;">The scope of your project is now locked based on your intake form answers. Changes to the scope (additional pages, features, or functionality not included in your package) may incur additional charges per our Terms of Service.</div>
    </div>

    <p style="margin:16px 0 0;font-size:12px;color:#64748B;">Ref: ${data.ref_code || "N/A"}</p>
  </div>`),
  }),

  // ── 3. Preview Ready ────────────────────────────────────────────────────────
  preview_ready: (data) => ({
    subject: `Your Site Preview Is Ready — Please Review`,
    html: wrapLayout(`
  <div style="font-size:15px;color:#E2E8F0;line-height:1.7;">
    <p style="margin:0 0 16px;">Hi <strong>${data.client_name || "there"}</strong>,</p>
    <p style="margin:0 0 16px;">Your website is ready for review! Here is your private preview link:</p>
    <p style="margin:0 0 24px;text-align:center;"><a href="${data.preview_url || "#"}" style="font-size:16px;color:#FF6700;font-weight:700;">${data.preview_url || "Preview Link"}</a></p>
    <p style="margin:0 0 16px;">Please review every page carefully. Check that all information is correct — phone numbers, addresses, service descriptions, hours, and spelling.</p>

    ${buttonRow([
      { text: "Approve My Site", url: data.preview_url || "#", color: "#10B981" },
      { text: "Request Changes", url: data.revision_url || "#", color: "#F59E0B" },
    ])}

    <p style="margin:0 0 16px;font-size:13px;color:#94A3B8;">Your package includes <strong style="color:#F8FAFC;">${data.revision_count || "3"}</strong> rounds of revisions.</p>

    <div style="margin:24px 0;padding:16px 20px;background:#1A1D23;border:1px solid #F59E0B;border-left:4px solid #F59E0B;border-radius:8px;">
      <div style="font-size:12px;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Response Deadline</div>
      <div style="font-size:13px;color:#CBD5E1;line-height:1.6;">Please respond within <strong style="color:#F8FAFC;">7 business days</strong>. Per our Terms of Service, if no response is received within 14 days, the site will be considered approved and deployed automatically.</div>
    </div>
  </div>`),
  }),

  // ── 4. Site Live ────────────────────────────────────────────────────────────
  site_live: (data) => ({
    subject: `Your Website Is Live!`,
    html: wrapLayout(`
  <div style="font-size:15px;color:#E2E8F0;line-height:1.7;">
    <p style="margin:0 0 16px;">Hi <strong>${data.client_name || "there"}</strong>,</p>
    <p style="margin:0 0 16px;">Your website is now <strong style="color:#10B981;">live</strong>! Here are your URLs:</p>

    <div style="margin:0 0 20px;padding:16px 20px;background:#1A1D23;border:1px solid #1E2128;border-radius:8px;">
      <div style="font-size:13px;color:#E2E8F0;line-height:2;">${(data.live_urls || "").split(",").map((u: string) => `<a href="${u.trim()}" style="color:#FF6700;font-weight:600;display:block;">${u.trim()}</a>`).join("")}</div>
    </div>

    <p style="margin:0 0 16px;font-size:13px;color:#94A3B8;">Your compliance certificate is attached — it verifies that your site has been tested for performance, accessibility (WCAG AA), SEO, and security.</p>

    <div style="margin:24px 0;padding:16px 20px;background:#1A1D23;border:1px solid #EF4444;border-left:4px solid #EF4444;border-radius:8px;">
      <div style="font-size:12px;font-weight:700;color:#EF4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Emergency Rollback</div>
      <div style="font-size:13px;color:#CBD5E1;line-height:1.6;">If you discover a critical error within <strong style="color:#F8FAFC;">60 minutes</strong> of deployment, click the link below to temporarily take your site offline while we fix the issue.</div>
      ${data.rollback_url ? `<p style="margin:10px 0 0;"><a href="${data.rollback_url}" style="color:#EF4444;font-weight:600;font-size:13px;">Emergency Rollback Link</a></p>` : ""}
    </div>

    ${data.remaining_balance ? `
    <div style="margin:0 0 20px;padding:16px 20px;background:#1A1D23;border:1px solid #1E2128;border-radius:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Remaining Balance", data.remaining_balance)}
        ${data.payment_link ? infoRow("Payment Link", `<a href="${data.payment_link}" style="color:#FF6700;font-weight:600;">Pay Now</a>`) : ""}
      </table>
    </div>` : ""}

    <p style="margin:16px 0 0;font-size:13px;color:#94A3B8;">After 60 minutes, changes require a revision request through the normal process.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#94A3B8;">Thank you for choosing PlanFlowAI. We'd love a testimonial if you're happy with your site — reply to this email with a few words about your experience.</p>
  </div>`),
  }),

  // ── 5. Revision Received ────────────────────────────────────────────────────
  revision_received: (data) => ({
    subject: `Revision Request Received — ${data.project_name || "Your Project"}`,
    html: wrapLayout(`
  <div style="font-size:15px;color:#E2E8F0;line-height:1.7;">
    <p style="margin:0 0 16px;">Hi <strong>${data.client_name || "there"}</strong>,</p>
    <p style="margin:0 0 16px;">We received your revision request for <strong style="color:#FF6700;">${data.project_name || "your project"}</strong>.</p>

    <div style="margin:0 0 20px;padding:16px 20px;background:#1A1D23;border:1px solid #1E2128;border-radius:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Page", data.page || "N/A")}
        ${infoRow("Revision #", data.revision_number || "1")}
        ${infoRow("Priority", data.priority || "Medium")}
        ${infoRow("Description", data.description || "N/A")}
      </table>
    </div>

    <p style="margin:0 0 16px;">We'll review your changes and update your preview within <strong style="color:#FF6700;">${data.timeline || "2-3"}</strong> business days.</p>
    <p style="margin:16px 0 0;font-size:12px;color:#64748B;">Ref: ${data.ref_code || "N/A"}</p>
  </div>`),
  }),

  // ── 6. Rollback Alert (sent to YOU, not the client) ─────────────────────────
  rollback_alert: (data) => ({
    subject: `ROLLBACK ALERT — ${data.client_name || "Client"} rolled back ${data.project_name || "a project"}`,
    html: wrapLayout(`
  <div style="font-size:15px;color:#E2E8F0;line-height:1.7;">
    <div style="margin:0 0 20px;padding:16px 20px;background:#1A1D23;border:1px solid #EF4444;border-left:4px solid #EF4444;border-radius:8px;">
      <div style="font-size:14px;font-weight:700;color:#EF4444;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Client Rollback Triggered</div>
      <div style="font-size:13px;color:#CBD5E1;line-height:1.6;">
        <strong>${data.client_name || "A client"}</strong> has rolled back <strong style="color:#FF6700;">${data.project_name || "their project"}</strong>.<br>
        The live site has been replaced with the coming soon page on all hosts.
      </div>
    </div>

    <div style="margin:0 0 20px;padding:16px 20px;background:#1A1D23;border:1px solid #1E2128;border-radius:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Client", data.client_name || "N/A")}
        ${infoRow("Project", data.project_name || "N/A")}
        ${infoRow("Ref Code", data.ref_code || "N/A")}
        ${infoRow("Rolled Back At", data.rollback_time || new Date().toISOString())}
      </table>
    </div>

    <p style="margin:0;font-size:14px;font-weight:700;color:#EF4444;">Review this immediately.</p>
  </div>`),
  }),
};

// ─── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EmailRequest;

    if (!body.to || !body.template) {
      return NextResponse.json(
        { error: "Missing required fields: to, template" },
        { status: 400 },
      );
    }

    const templateFn = TEMPLATES[body.template];
    if (!templateFn) {
      return NextResponse.json(
        { error: `Unknown template: ${body.template}. Valid: ${Object.keys(TEMPLATES).join(", ")}` },
        { status: 400 },
      );
    }

    const rendered = templateFn(body.data || {});
    const subject = body.subject || rendered.subject;
    const html = replaceVars(rendered.html, body.data || {});

    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      // No Resend key — log to console, never block pipeline
      console.log(`[email/send] RESEND_API_KEY not set — logging email instead`);
      console.log(`[email/send] To: ${body.to} | Subject: ${subject} | Template: ${body.template}`);
      console.log(`[email/send] Data: ${JSON.stringify(body.data)}`);
      return NextResponse.json({
        success: true,
        sent: false,
        message: "Email logged to console (RESEND_API_KEY not configured)",
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "PlanFlowAI <noreply@planflowai.com>",
        to: [body.to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[email/send] Resend error ${res.status}:`, errText);
      return NextResponse.json(
        { error: `Resend API error: ${res.status}`, detail: errText },
        { status: 502 },
      );
    }

    const resData = await res.json();
    console.log(`[email/send] Sent ${body.template} to ${body.to} — id: ${resData.id}`);

    return NextResponse.json({ success: true, sent: true, id: resData.id });
  } catch (err: any) {
    console.error("[email/send] Error:", err);
    return NextResponse.json(
      { error: err.message || "Email send failed" },
      { status: 500 },
    );
  }
}
