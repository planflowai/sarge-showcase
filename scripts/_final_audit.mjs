/**
 * Final audit-only pass on all 7 PlanFlowAI pages.
 * No fix loop — just score and generate certificate.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3101";
const PROJECT_DIR = "L:/ai_builder/projects/planflowai";

const PAGES = [
  { name: "Home",        file: "index.html" },
  { name: "Showroom",    file: "showroom.html" },
  { name: "Pricing",     file: "pricing.html" },
  { name: "Services",    file: "services.html" },
  { name: "How It Works",file: "how-it-works.html" },
  { name: "About",       file: "about.html" },
  { name: "Contact",     file: "contact.html" },
];

function inlineExternalRefs(html, dir) {
  let r = html;
  r = r.replace(/<link\s+rel="stylesheet"\s+href="(styles\.css)"[^>]*>/gi, (m, f) => {
    const p = join(dir, f); return existsSync(p) ? `<style>\n${readFileSync(p, "utf-8")}\n</style>` : m;
  });
  r = r.replace(/<script\s+src="(main\.js)"[^>]*><\/script>/gi, (m, f) => {
    const p = join(dir, f); return existsSync(p) ? `<script>\n${readFileSync(p, "utf-8")}\n</script>` : m;
  });
  return r;
}

const results = [];

for (const page of PAGES) {
  const filePath = join(PROJECT_DIR, page.file);
  const raw = readFileSync(filePath, "utf-8");
  const html = inlineExternalRefs(raw, PROJECT_DIR);

  console.log(`[AUDIT] ${page.name} (${raw.length} bytes, ${html.length} inlined)...`);

  const res = await fetch(`${BASE}/api/benchmark/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, fix: false }),
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    console.log(`  ERROR: HTTP ${res.status}`);
    continue;
  }

  const data = await res.json();
  const s = data.scores || {};
  console.log(`  Perf: ${s.performance ?? "?"} | A11y: ${s.accessibility ?? "?"} | SEO: ${s.seo ?? "?"} | BP: ${s.bestPractices ?? "?"}`);

  results.push({
    name: page.name,
    file: page.file,
    scores: {
      performance: s.performance ?? 0,
      accessibility: s.accessibility ?? 0,
      seo: s.seo ?? 0,
      bestPractices: s.bestPractices ?? 0,
    },
  });
}

// Summary
function tier(scores) {
  const min = Math.min(scores.performance, scores.accessibility, scores.seo, scores.bestPractices);
  if (min >= 95) return "PLATINUM";
  if (min >= 90) return "GOLD";
  if (min >= 80) return "SILVER";
  return "NONE";
}

console.log(`\n${"=".repeat(70)}`);
console.log("FINAL SCORES — PlanFlowAI (7 Pages)");
console.log("=".repeat(70));
console.log("Page            | Perf | A11y | SEO  | BP   | Tier");
console.log("-".repeat(70));

for (const r of results) {
  const s = r.scores;
  console.log(`${r.name.padEnd(16)}| ${String(s.performance).padStart(4)} | ${String(s.accessibility).padStart(4)} | ${String(s.seo).padStart(4)} | ${String(s.bestPractices).padStart(4)} | ${tier(s)}`);
}

if (results.length > 0) {
  const avg = {
    performance: Math.round(results.reduce((s, r) => s + r.scores.performance, 0) / results.length),
    accessibility: Math.round(results.reduce((s, r) => s + r.scores.accessibility, 0) / results.length),
    seo: Math.round(results.reduce((s, r) => s + r.scores.seo, 0) / results.length),
    bestPractices: Math.round(results.reduce((s, r) => s + r.scores.bestPractices, 0) / results.length),
  };
  console.log("-".repeat(70));
  console.log(`${"AVERAGE".padEnd(16)}| ${String(avg.performance).padStart(4)} | ${String(avg.accessibility).padStart(4)} | ${String(avg.seo).padStart(4)} | ${String(avg.bestPractices).padStart(4)} | ${tier(avg)}`);

  const overallTier = tier({
    performance: Math.min(...results.map(r => r.scores.performance)),
    accessibility: Math.min(...results.map(r => r.scores.accessibility)),
    seo: Math.min(...results.map(r => r.scores.seo)),
    bestPractices: Math.min(...results.map(r => r.scores.bestPractices)),
  });
  console.log(`\nOverall Tier (weakest page): ${overallTier}`);

  // Generate certificate
  if (overallTier !== "NONE") {
    console.log(`\n[CERT] Generating ${overallTier} certificate...`);
    try {
      const certRes = await fetch(`${BASE}/api/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: overallTier.toLowerCase(),
          clientName: "PlanFlowAI",
          siteUrl: "https://planflowai.com",
          scores: avg,
          pages: results.map(r => ({ name: r.name, scores: r.scores })),
          model: "gpt-4.1 + gemini-2.5-flash",
          provider: "openai + google",
          buildTimeMs: 0,
          cost: 0,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (certRes.ok) {
        const buf = await certRes.arrayBuffer();
        const certPath = join(PROJECT_DIR, `certificate-${overallTier.toLowerCase()}.pdf`);
        writeFileSync(certPath, Buffer.from(buf));
        console.log(`[CERT] Saved: ${certPath} (${buf.byteLength} bytes)`);
      } else {
        console.log(`[CERT ERROR] HTTP ${certRes.status}: ${(await certRes.text()).slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`[CERT ERROR] ${err.message}`);
    }
  }
}
