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
