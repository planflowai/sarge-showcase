/**
 * THING 3 — Polish all PlanFlowAI pages
 *
 * Fixes:
 * 1. How It Works: timeline card width CSS (too narrow → one word per line)
 * 2. Services: via.placeholder.com gradient bars → inline SVG placeholders
 * 3. All pages: height reduction — remove duplicate sections, tighten spacing
 * 4. All pages: verify nav + footer consistency
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const PROJECT_DIR = "L:/ai_builder/projects/planflowai";

const PAGES = [
  "index.html", "showroom.html", "pricing.html", "services.html",
  "how-it-works.html", "about.html", "contact.html",
];

// ── Standard nav HTML (7 links, .html format) ──────────────────────

const STANDARD_NAV = `<nav style="display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;background:var(--card);border-bottom:1px solid var(--border)">
  <a href="index.html" style="font-size:1.25rem;font-weight:800;color:var(--text);text-decoration:none">PlanFlowAI</a>
  <div style="display:flex;gap:1.5rem;align-items:center">
    <a href="index.html" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">Home</a>
    <a href="showroom.html" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">Showroom</a>
    <a href="pricing.html" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">Pricing</a>
    <a href="services.html" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">Services</a>
    <a href="how-it-works.html" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">How-it-works</a>
    <a href="about.html" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">About</a>
    <a href="contact.html" style="color:var(--text-muted);text-decoration:none;font-weight:600;font-size:.9rem;transition:color .2s">Contact</a>
  </div>
</nav>`;

// ── Standard footer HTML ────────────────────────────────────────────

const STANDARD_FOOTER = `<footer style="background:var(--card);color:var(--text-muted);padding:3rem 1.5rem;border-top:1px solid var(--border);text-align:center">
  <div style="max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:2rem;text-align:left;margin-bottom:2rem">
    <div>
      <h3 style="color:var(--text);margin-bottom:1rem;font-size:1.1rem;font-weight:700">PlanFlowAI</h3>
      <p style="font-size:.9rem">AI-powered, agency-quality websites for small businesses.</p>
    </div>
    <div>
      <h3 style="color:var(--text);margin-bottom:1rem;font-size:1.1rem;font-weight:700">Quick Links</h3>
      <ul style="list-style:none;padding:0"><li style="margin-bottom:.5rem"><a href="index.html" style="color:var(--text-muted);font-size:.9rem">Home</a></li><li style="margin-bottom:.5rem"><a href="showroom.html" style="color:var(--text-muted);font-size:.9rem">Showroom</a></li><li style="margin-bottom:.5rem"><a href="pricing.html" style="color:var(--text-muted);font-size:.9rem">Pricing</a></li><li style="margin-bottom:.5rem"><a href="services.html" style="color:var(--text-muted);font-size:.9rem">Services</a></li><li style="margin-bottom:.5rem"><a href="about.html" style="color:var(--text-muted);font-size:.9rem">About</a></li><li style="margin-bottom:.5rem"><a href="contact.html" style="color:var(--text-muted);font-size:.9rem">Contact</a></li></ul>
    </div>
    <div>
      <h3 style="color:var(--text);margin-bottom:1rem;font-size:1.1rem;font-weight:700">Contact</h3>
      <p style="font-size:.9rem">Email: <a href="mailto:info@planflowai.com" style="color:var(--primary)">info@planflowai.com</a></p>
      <p style="font-size:.9rem">Phone: <a href="tel:+18338200774" style="color:var(--primary)">+1 (833) 820-0774</a></p>
      <p style="font-size:.9rem">1925 Village Center Circle Suite 150, Las Vegas, NV 89134</p>
    </div>
  </div>
  <p style="font-size:.85rem;border-top:1px solid var(--border);padding-top:1.5rem">&copy; 2024 PlanFlowAI. All rights reserved.</p>
</footer>`;

// ── SVG icon data URIs (replace via.placeholder.com gradient bars) ──

const SVG_ICONS = {
  "E-commerce+Solution": `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#14B8A6" width="600" height="400" rx="12"/><g fill="#fff" transform="translate(230,120)"><rect x="0" y="0" width="140" height="160" rx="8" fill="rgba(255,255,255,0.2)"/><circle cx="70" cy="50" r="30" fill="rgba(255,255,255,0.3)"/><rect x="20" y="100" width="100" height="12" rx="4"/><rect x="35" y="120" width="70" height="12" rx="4"/><rect x="30" y="142" width="80" height="24" rx="12" fill="rgba(255,255,255,0.4)"/></g><text x="300" y="320" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="700">E-commerce Solution</text></svg>')}`,
  "Modern+Portfolio": `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#8B5CF6" width="600" height="400" rx="12"/><g fill="rgba(255,255,255,0.2)" transform="translate(150,80)"><rect x="0" y="0" width="130" height="100" rx="6"/><rect x="140" y="0" width="130" height="100" rx="6"/><rect x="0" y="110" width="130" height="100" rx="6"/><rect x="140" y="110" width="130" height="100" rx="6"/></g><text x="300" y="330" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="700">Modern Portfolio</text></svg>')}`,
  "Blog+Platform": `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#EC4899" width="600" height="400" rx="12"/><g transform="translate(180,80)"><rect x="0" y="0" width="240" height="30" rx="4" fill="rgba(255,255,255,0.3)"/><rect x="0" y="45" width="240" height="120" rx="6" fill="rgba(255,255,255,0.15)"/><rect x="10" y="55" width="220" height="10" rx="3" fill="rgba(255,255,255,0.3)"/><rect x="10" y="75" width="180" height="8" rx="3" fill="rgba(255,255,255,0.2)"/><rect x="10" y="93" width="200" height="8" rx="3" fill="rgba(255,255,255,0.2)"/><rect x="10" y="111" width="160" height="8" rx="3" fill="rgba(255,255,255,0.2)"/><rect x="10" y="129" width="190" height="8" rx="3" fill="rgba(255,255,255,0.2)"/></g><text x="300" y="330" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="700">Blog Platform</text></svg>')}`,
  "Corporate+Website": `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#14B8A6" width="600" height="400" rx="12"/><g transform="translate(220,90)"><rect x="0" y="0" width="160" height="180" rx="8" fill="rgba(255,255,255,0.15)"/><rect x="10" y="10" width="140" height="8" rx="3" fill="rgba(255,255,255,0.3)"/><rect x="10" y="30" width="140" height="60" rx="4" fill="rgba(255,255,255,0.2)"/><rect x="10" y="100" width="100" height="8" rx="3" fill="rgba(255,255,255,0.25)"/><rect x="10" y="118" width="120" height="8" rx="3" fill="rgba(255,255,255,0.2)"/><rect x="10" y="136" width="80" height="8" rx="3" fill="rgba(255,255,255,0.2)"/><rect x="10" y="155" width="60" height="20" rx="10" fill="rgba(255,255,255,0.3)"/></g><text x="300" y="320" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="700">Corporate Website</text></svg>')}`,
  "Photography+Portfolio": `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#8B5CF6" width="600" height="400" rx="12"/><g transform="translate(200,80)"><rect x="0" y="0" width="200" height="140" rx="8" fill="rgba(255,255,255,0.2)"/><circle cx="60" cy="50" r="25" fill="rgba(255,255,255,0.25)"/><polygon points="30,120 100,60 200,120" fill="rgba(255,255,255,0.2)"/><polygon points="120,120 160,80 200,120" fill="rgba(255,255,255,0.15)"/></g><text x="300" y="330" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="700">Photography Showcase</text></svg>')}`,
  "Online+Magazine": `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="#EC4899" width="600" height="400" rx="12"/><g transform="translate(170,80)"><rect x="0" y="0" width="120" height="160" rx="6" fill="rgba(255,255,255,0.15)"/><rect x="130" y="0" width="120" height="75" rx="6" fill="rgba(255,255,255,0.15)"/><rect x="130" y="85" width="120" height="75" rx="6" fill="rgba(255,255,255,0.15)"/><rect x="10" y="10" width="100" height="8" rx="3" fill="rgba(255,255,255,0.3)"/><rect x="10" y="28" width="80" height="6" rx="2" fill="rgba(255,255,255,0.2)"/><rect x="10" y="44" width="100" height="50" rx="4" fill="rgba(255,255,255,0.2)"/></g><text x="300" y="330" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="700">Digital Magazine</text></svg>')}`,
};

let totalFixes = 0;

function fix(file, html) {
  let h = html;
  let fixes = 0;

  // ═══ FIX: How It Works — timeline card width too narrow ═══
  if (file === "how-it-works.html") {
    // The bug: .timeline-content has width:45%;max-width:500px on desktop,
    // but the parent .timeline-item has padding-right: calc(50% + 4rem).
    // This makes cards ~237px wide → one word per line.
    // Fix: width:100% so it fills the available space after padding.
    if (h.includes("width: 45%") || h.includes("width:45%")) {
      h = h.replace(
        /\.timeline-content\s*\{[^}]*width:\s*45%[^}]*max-width:\s*500px[^}]*\}/,
        (match) => match.replace(/width:\s*45%/, "width:100%").replace(/max-width:\s*500px/, "max-width:none")
      );
      fixes++;
      console.log(`  [${file}] Fixed timeline-content width: 45% → 100%`);
    }

    // Also remove the showroom/gallery section (duplicates showroom.html) to reduce height
    const galleryRe = /<section[^>]*class="[^"]*gallery[^"]*"[^>]*>[\s\S]*?<\/section>/i;
    if (galleryRe.test(h)) {
      h = h.replace(galleryRe, "<!-- Gallery section removed — see showroom.html -->");
      fixes++;
      console.log(`  [${file}] Removed gallery section (duplicates showroom.html)`);
    }

    // Remove interactive calculator section to reduce height
    const calcRe = /<section[^>]*(?:class="[^"]*calculator[^"]*"|id="calculator")[^>]*>[\s\S]*?<\/section>/i;
    if (calcRe.test(h)) {
      h = h.replace(calcRe, "<!-- Calculator section removed — see pricing.html -->");
      fixes++;
      console.log(`  [${file}] Removed calculator section (duplicates pricing.html)`);
    }
  }

  // ═══ FIX: Services — replace via.placeholder.com gradient bars ═══
  if (file === "services.html") {
    for (const [text, svgUri] of Object.entries(SVG_ICONS)) {
      const placeholder = `https://via.placeholder.com/600x400/[A-Fa-f0-9]{6}/FFFFFF\\?text=${text.replace("+", "\\+")}`;
      const re = new RegExp(placeholder, "g");
      if (re.test(h)) {
        h = h.replace(new RegExp(placeholder, "g"), svgUri);
        fixes++;
        console.log(`  [${file}] Replaced placeholder: ${text}`);
      }
    }

    // Remove the showroom section entirely (duplicates showroom.html) to reduce height
    const showroomRe = /<section[^>]*class="[^"]*showroom[^"]*"[^>]*>[\s\S]*?<\/section>/i;
    if (showroomRe.test(h)) {
      h = h.replace(showroomRe, "<!-- Showroom section removed — see showroom.html -->");
      fixes++;
      console.log(`  [${file}] Removed showroom section (duplicates showroom.html)`);
    }
  }

  // ═══ FIX: Home — remove duplicate sections to reduce height ═══
  if (file === "index.html") {
    // Remove Showroom section (duplicates showroom.html) — saves ~1400px
    const showroomRe = /<section[^>]*(?:id="showroom"|class="[^"]*showroom[^"]*")[^>]*>[\s\S]*?<\/section>/i;
    if (showroomRe.test(h)) {
      h = h.replace(showroomRe, "<!-- Showroom section removed — see showroom.html -->");
      fixes++;
      console.log(`  [${file}] Removed showroom section (saves ~1400px)`);
    }

    // Remove "Meet the Team" section (duplicates about.html) — saves ~250px
    const teamRe = /<section[^>]*(?:id="team"|class="[^"]*team[^"]*")[^>]*>[\s\S]*?<\/section>/i;
    if (teamRe.test(h)) {
      h = h.replace(teamRe, "<!-- Team section removed — see about.html -->");
      fixes++;
      console.log(`  [${file}] Removed team section (saves ~250px)`);
    }
  }

  // ═══ FIX: Pricing — remove showcase duplicate to reduce height ═══
  if (file === "pricing.html") {
    // Remove the "See What You Can Build" showcase section — duplicates showroom.html
    const showcaseRe = /<section[^>]*>[\s\S]*?See What You Can Build[\s\S]*?<\/section>/i;
    if (showcaseRe.test(h)) {
      h = h.replace(showcaseRe, "<!-- Showcase section removed — see showroom.html -->");
      fixes++;
      console.log(`  [${file}] Removed showcase section (saves ~800px)`);
    }
  }

  // ═══ FIX: All pages — reduce section padding for height ═══
  // Reduce section padding from 4rem to 2.5rem
  if (h.includes("section{padding:4rem 0") || h.includes("section { padding: 4rem 0")) {
    h = h.replace(/section\s*\{\s*padding:\s*4rem\s+0/g, "section{padding:2.5rem 0");
    fixes++;
    console.log(`  [${file}] Reduced section padding: 4rem → 2.5rem`);
  }

  // ═══ FIX: All pages — reduce hero min-height ═══
  if (h.includes("min-height:70vh")) {
    h = h.replace(/min-height:\s*70vh/g, "min-height:50vh");
    fixes++;
    console.log(`  [${file}] Reduced hero min-height: 70vh → 50vh`);
  }

  // ═══ All pages — add .animate-on-scroll fallback for when JS is slow ═══
  // Add a CSS rule: after 3s, make all animate-on-scroll visible via animation
  if (h.includes("animate-on-scroll") && !h.includes("animation:forceVisible")) {
    const fallbackCSS = `@keyframes forceVisible{to{opacity:1;transform:translateY(0)}}
.animate-on-scroll{animation:forceVisible .001s 3s forwards}`;
    // Insert before closing </style>
    const lastStyleIdx = h.lastIndexOf("</style>");
    if (lastStyleIdx > 0) {
      h = h.slice(0, lastStyleIdx) + "\n" + fallbackCSS + "\n" + h.slice(lastStyleIdx);
      fixes++;
      console.log(`  [${file}] Added animate-on-scroll visibility fallback`);
    }
  }

  totalFixes += fixes;
  return h;
}

// ── Main ─────────────────────────────────────────────────────────

console.log("=".repeat(70));
console.log("POLISH PASS — PlanFlowAI (7 Pages)");
console.log("=".repeat(70));

for (const file of PAGES) {
  const filePath = join(PROJECT_DIR, file);
  if (!existsSync(filePath)) {
    console.log(`[SKIP] ${file} not found`);
    continue;
  }

  const original = readFileSync(filePath, "utf-8");
  const fixed = fix(file, original);

  if (fixed !== original) {
    writeFileSync(filePath, fixed);
    console.log(`[${file}] ${original.length} → ${fixed.length} bytes\n`);
  } else {
    console.log(`[${file}] No changes needed\n`);
  }
}

// ── Nav + footer consistency check ─────────────────────────────

console.log("=".repeat(70));
console.log("NAV + FOOTER CONSISTENCY CHECK");
console.log("=".repeat(70));

const expectedNavLinks = [
  "index.html", "showroom.html", "pricing.html", "services.html",
  "how-it-works.html", "about.html", "contact.html",
];

for (const file of PAGES) {
  const filePath = join(PROJECT_DIR, file);
  if (!existsSync(filePath)) continue;
  const html = readFileSync(filePath, "utf-8");

  // Check nav links
  const navMatch = html.match(/<nav[\s\S]*?<\/nav>/i);
  const navIssues = [];
  if (!navMatch) {
    navIssues.push("NO <nav> FOUND");
  } else {
    for (const link of expectedNavLinks) {
      if (!navMatch[0].includes(`href="${link}"`)) {
        navIssues.push(`Missing: ${link}`);
      }
    }
    // Check for path-style links
    const pathLinks = navMatch[0].match(/href="\/[a-z]/g);
    if (pathLinks) navIssues.push(`Path-style links found: ${pathLinks.join(", ")}`);
  }

  // Check footer has PlanFlowAI branding
  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
  const footerIssues = [];
  if (!footerMatch) {
    footerIssues.push("NO <footer> FOUND");
  } else {
    if (!footerMatch[0].includes("PlanFlowAI")) footerIssues.push("Missing PlanFlowAI branding");
    if (!footerMatch[0].includes("info@planflowai.com")) footerIssues.push("Missing email");
  }

  const status = navIssues.length === 0 && footerIssues.length === 0 ? "✅" : "⚠️";
  console.log(`${status} ${file}`);
  if (navIssues.length > 0) console.log(`  Nav: ${navIssues.join(", ")}`);
  if (footerIssues.length > 0) console.log(`  Footer: ${footerIssues.join(", ")}`);
}

console.log(`\nTotal fixes applied: ${totalFixes}`);
