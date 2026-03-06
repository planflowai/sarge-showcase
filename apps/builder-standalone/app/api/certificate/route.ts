import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PageScores {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
}

interface PageEntry {
  name: string;
  url?: string;
  scores: PageScores;
}

interface CertificateRequest {
  tier: "platinum" | "gold" | "silver";
  clientName: string;
  siteUrl: string;
  scores: PageScores;
  /** Multi-page: array of per-page scores. If provided, scores field is ignored and averages are computed. */
  pages?: PageEntry[];
  model: string;
  provider: string;
  buildTimeMs: number;
  cost: number;
}

function computeAverageScores(pages: PageEntry[]): PageScores {
  const n = pages.length;
  return {
    performance: Math.round(pages.reduce((s, p) => s + p.scores.performance, 0) / n),
    accessibility: Math.round(pages.reduce((s, p) => s + p.scores.accessibility, 0) / n),
    seo: Math.round(pages.reduce((s, p) => s + p.scores.seo, 0) / n),
    bestPractices: Math.round(pages.reduce((s, p) => s + p.scores.bestPractices, 0) / n),
  };
}

function getMinScore(pages: PageEntry[]): number {
  let min = 100;
  for (const p of pages) {
    min = Math.min(min, p.scores.performance, p.scores.accessibility, p.scores.seo, p.scores.bestPractices);
  }
  return min;
}

// ─── Logo Base64 (embedded for PDF rendering) ──────────────────────────────────

const CERT_LOGO_B64 = "data:image/png;base64,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";

// ─── Certificate HTML Template ──────────────────────────────────────────────────

function buildPerPageSection(pages: PageEntry[], accentColor: string): string {
  if (!pages || pages.length <= 1) return "";

  const rows = pages.map(p => `
    <tr>
      <td style="padding:6px 12px;font-size:12px;color:#CBD5E1;font-weight:500;border-bottom:1px solid #1E293B;">${escapeHtml(p.name)}</td>
      <td style="padding:6px 8px;font-size:12px;color:${p.scores.performance >= 90 ? '#10B981' : p.scores.performance >= 70 ? '#F59E0B' : '#EF4444'};font-weight:700;text-align:center;border-bottom:1px solid #1E293B;">${p.scores.performance}</td>
      <td style="padding:6px 8px;font-size:12px;color:${p.scores.accessibility >= 90 ? '#10B981' : p.scores.accessibility >= 70 ? '#F59E0B' : '#EF4444'};font-weight:700;text-align:center;border-bottom:1px solid #1E293B;">${p.scores.accessibility}</td>
      <td style="padding:6px 8px;font-size:12px;color:${p.scores.seo >= 90 ? '#10B981' : p.scores.seo >= 70 ? '#F59E0B' : '#EF4444'};font-weight:700;text-align:center;border-bottom:1px solid #1E293B;">${p.scores.seo}</td>
      <td style="padding:6px 8px;font-size:12px;color:${p.scores.bestPractices >= 90 ? '#10B981' : p.scores.bestPractices >= 70 ? '#F59E0B' : '#EF4444'};font-weight:700;text-align:center;border-bottom:1px solid #1E293B;">${p.scores.bestPractices}</td>
    </tr>`).join("");

  return `
  <div style="background:#0F172A;border:1px solid #334155;border-radius:12px;padding:20px 24px;margin-bottom:16px;">
    <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;font-weight:600;">
      Per-Page Scores (${pages.length} pages)
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:6px 12px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:1px solid #334155;">Page</th>
          <th style="padding:6px 8px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;text-align:center;border-bottom:1px solid #334155;">Perf</th>
          <th style="padding:6px 8px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;text-align:center;border-bottom:1px solid #334155;">A11y</th>
          <th style="padding:6px 8px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;text-align:center;border-bottom:1px solid #334155;">SEO</th>
          <th style="padding:6px 8px;font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;text-align:center;border-bottom:1px solid #334155;">BP</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

function buildCertificateHtml(data: CertificateRequest): string {
  const isPlatinum = data.tier === "platinum";
  const isGold = data.tier === "gold";
  const tierLabel = isPlatinum ? "PLATINUM" : isGold ? "GOLD" : "SILVER";
  const accentColor = isPlatinum ? "#14B8A6" : isGold ? "#F59E0B" : "#94A3B8";
  const accentGlow = isPlatinum ? "rgba(20, 184, 166, 0.18)" : isGold ? "rgba(245, 158, 11, 0.15)" : "rgba(148, 163, 184, 0.10)";
  const borderAccent = isPlatinum ? "#14B8A6" : isGold ? "#F59E0B" : "#64748B";
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const wcagNote =
    data.scores.accessibility >= 90
      ? `<div style="margin-top:18px;padding:10px 16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:8px;display:inline-flex;align-items:center;gap:8px;">
           <span style="font-size:16px;">♿</span>
           <span style="font-size:12px;color:#10B981;font-weight:600;">WCAG 2.1 AA Compliant</span>
         </div>`
      : "";

  function scoreBar(label: string, score: number): string {
    const pct = Math.min(score, 100);
    let barColor = "#EF4444";
    if (score >= 90) barColor = "#10B981";
    else if (score >= 70) barColor = "#F59E0B";
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:13px;color:#CBD5E1;font-weight:500;">${label}</span>
          <span style="font-size:15px;color:${barColor};font-weight:800;">${score}</span>
        </div>
        <div style="height:8px;background:#1E293B;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.6s;"></div>
        </div>
      </div>`;
  }

  const buildTimeSec = (data.buildTimeMs / 1000).toFixed(1);
  const costStr = data.cost > 0 ? `$${data.cost.toFixed(4)}` : "Free (Local)";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #0F172A;
    color: #E2E8F0;
    width: 800px;
    min-height: 1100px;
    padding: 0;
  }
</style>
</head>
<body>
<div style="
  margin: 40px;
  border: 2px solid ${borderAccent};
  border-radius: 16px;
  background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
  padding: 48px 56px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 60px ${accentGlow};
">
  <!-- Decorative corner marks -->
  <div style="position:absolute;top:16px;left:16px;width:32px;height:32px;border-top:3px solid ${accentColor};border-left:3px solid ${accentColor};border-radius:4px 0 0 0;opacity:0.5;"></div>
  <div style="position:absolute;top:16px;right:16px;width:32px;height:32px;border-top:3px solid ${accentColor};border-right:3px solid ${accentColor};border-radius:0 4px 0 0;opacity:0.5;"></div>
  <div style="position:absolute;bottom:16px;left:16px;width:32px;height:32px;border-bottom:3px solid ${accentColor};border-left:3px solid ${accentColor};border-radius:0 0 0 4px;opacity:0.5;"></div>
  <div style="position:absolute;bottom:16px;right:16px;width:32px;height:32px;border-bottom:3px solid ${accentColor};border-right:3px solid ${accentColor};border-radius:0 0 4px 0;opacity:0.5;"></div>

  <!-- Header -->
  <div style="text-align:center;margin-bottom:36px;">
    <img src="${CERT_LOGO_B64}" alt="PlanFlowAI" height="48" style="display:block;margin:0 auto 12px;border-radius:10px;">
    <div style="font-size:14px;letter-spacing:6px;color:${accentColor};font-weight:700;text-transform:uppercase;margin-bottom:8px;">
      PlanFlowAI
    </div>
    <div style="font-size:36px;font-weight:900;letter-spacing:2px;color:#F8FAFC;margin-bottom:4px;">
      CERTIFICATE OF COMPLIANCE
    </div>
    <div style="font-size:16px;color:${accentColor};font-weight:800;letter-spacing:4px;">
      ${tierLabel} TIER
    </div>
  </div>

  <!-- Divider -->
  <div style="height:1px;background:linear-gradient(90deg,transparent,${accentColor},transparent);margin:0 40px 32px;"></div>

  <!-- Issued to -->
  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">
      Issued to
    </div>
    <div style="font-size:28px;font-weight:800;color:#F8FAFC;">
      ${escapeHtml(data.clientName)}
    </div>
    <div style="font-size:14px;color:#94A3B8;margin-top:4px;">
      ${escapeHtml(data.siteUrl)}
    </div>
  </div>

  <!-- Scores -->
  <div style="background:#0F172A;border:1px solid #334155;border-radius:12px;padding:24px 28px;margin-bottom:24px;">
    <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;font-weight:600;">
      Lighthouse Audit Scores
    </div>
    ${scoreBar("Performance", data.scores.performance)}
    ${scoreBar("Accessibility", data.scores.accessibility)}
    ${scoreBar("SEO", data.scores.seo)}
    ${scoreBar("Best Practices", data.scores.bestPractices)}
  </div>

  ${data.pages && data.pages.length > 1 ? buildPerPageSection(data.pages, accentColor) : ""}

  ${wcagNote}

  <!-- Build Details -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;margin-bottom:32px;">
    <div style="background:#0F172A;border:1px solid #334155;border-radius:8px;padding:14px 16px;text-align:center;">
      <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Model</div>
      <div style="font-size:13px;color:#E2E8F0;font-weight:600;">${escapeHtml(data.model)}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px;">${escapeHtml(data.provider)}</div>
    </div>
    <div style="background:#0F172A;border:1px solid #334155;border-radius:8px;padding:14px 16px;text-align:center;">
      <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Build Time</div>
      <div style="font-size:13px;color:#E2E8F0;font-weight:600;">${buildTimeSec}s</div>
    </div>
    <div style="background:#0F172A;border:1px solid #334155;border-radius:8px;padding:14px 16px;text-align:center;">
      <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Cost</div>
      <div style="font-size:13px;color:#E2E8F0;font-weight:600;">${costStr}</div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height:1px;background:linear-gradient(90deg,transparent,${accentColor},transparent);margin:0 40px 24px;"></div>

  <!-- Footer -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Date Issued</div>
      <div style="font-size:13px;color:#CBD5E1;font-weight:500;">${dateStr}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Verified by</div>
      <div style="font-size:13px;color:#CBD5E1;font-weight:600;">PlanFlowAI Compiler</div>
      <div style="font-size:10px;color:#475569;">html-validate &bull; axe-core &bull; Lighthouse</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CertificateRequest;

    // If multi-page, compute averaged scores and use weakest-link tier
    if (body.pages && body.pages.length > 0) {
      body.scores = computeAverageScores(body.pages);
      // Tier by weakest individual score across all pages
      const minScore = getMinScore(body.pages);
      if (minScore >= 95) body.tier = "platinum";
      else if (minScore >= 90) body.tier = "gold";
      else if (minScore >= 80) body.tier = "silver";
    }

    // Validate tier matches scores
    const { performance, accessibility, seo, bestPractices } = body.scores;
    const allAbove95 =
      performance >= 95 && accessibility >= 95 && seo >= 95 && bestPractices >= 95;
    const allAbove90 =
      performance >= 90 && accessibility >= 90 && seo >= 90 && bestPractices >= 90;
    const allAbove80 =
      performance >= 80 && accessibility >= 80 && seo >= 80 && bestPractices >= 80;

    if (body.tier === "platinum" && !allAbove95) {
      return NextResponse.json(
        { error: "Platinum tier requires all scores >= 95" },
        { status: 400 }
      );
    }
    if (body.tier === "gold" && !allAbove90) {
      return NextResponse.json(
        { error: "Gold tier requires all scores >= 90" },
        { status: 400 }
      );
    }
    if (!allAbove80) {
      return NextResponse.json(
        { error: "Certificate requires all scores >= 80" },
        { status: 400 }
      );
    }

    const html = buildCertificateHtml(body);

    // Launch Puppeteer and render PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1100 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfUint8 = await page.pdf({
      width: "800px",
      height: "1100px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    const pdfBuffer = Buffer.from(pdfUint8);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="planflowai-certificate-${body.tier}-${Date.now()}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[Certificate] Error:", err);
    return NextResponse.json(
      { error: err.message || "Certificate generation failed" },
      { status: 500 }
    );
  }
}
