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
  <div style="font-size:22px;font-weight:800;color:#F8FAFC;letter-spacing:0.5px;">PlanFlow<span style="color:#FF6700;">AI</span></div>
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
