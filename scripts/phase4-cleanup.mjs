/**
 * Phase 4 Cleanup — Fix hallucinated data across all 7 PlanFlowAI pages.
 *
 * 1. Replace fake business names → PlanFlowAI
 * 2. Replace fake phones → {{phone}}
 * 3. Replace fake emails → {{email}} (keep info@planflowai.com)
 * 4. Replace fake addresses → {{address}}, {{city}}, {{state}}
 * 5. Fix contact.html nav to match all other pages
 * 6. Remove rickroll YouTube embeds
 * 7. Clean up fake team members and timeline from about.html
 * 8. Fix JSON-LD data across all pages
 * 9. Inject real PII data
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const PROJECT_DIR = "L:/ai_builder/projects/planflowai";

const PAGES = [
  "index.html",
  "showroom.html",
  "pricing.html",
  "services.html",
  "how-it-works.html",
  "about.html",
  "contact.html",
];

// ── Real PII data for PlanFlowAI ────────────────────────────────────────
const PII = {
  BUSINESS_NAME: "PlanFlowAI",
  phone: "+1 (833) 820-0774",
  phone_tel: "+18338200774",
  email: "info@planflowai.com",
  address: "1925 Village Center Circle Suite 150",
  city: "Las Vegas",
  state: "NV",
  zip: "89134",
};

// ── Canonical nav HTML (matches index.html) ─────────────────────────────
const CANONICAL_NAV = `<nav><a href="index.html" class="logo">PlanFlowAI</a><div style="display:flex;gap:1.5rem;align-items:center"><a href="index.html">Home</a><a href="showroom.html">Showroom</a><a href="pricing.html">Pricing</a><a href="services.html">Services</a><a href="how-it-works.html">How-it-works</a><a href="about.html">About</a><a href="contact.html">Contact</a></div></nav>`;

// ── Step 1: Business name replacements ──────────────────────────────────
const FAKE_NAMES = [
  "InnovateWeb Solutions",
  "Acme Corp",
  "WebSolutions Pro",
  "WebDev Solutions",
];

// ── Step 2: Fake phone replacements ─────────────────────────────────────
const FAKE_PHONES = [
  // Formatted variants
  "+1 (555) 123-4567",
  "+1\u00A0(555)\u00A0123\u20114567", // non-breaking spaces and non-breaking hyphen
  "+1&nbsp;(555)&nbsp;123&#8209;4567",
  "(555) 123-4567",
  "555-123-4567",
  "+1-800-555-0123",
  "800-555-0123",
  "+1-800-555-0199",
  "800-555-0199",
  "+1-555-0123",
  "555-0123",
  "+1-123-456-7890",
  "123-456-7890",
  "+15551234567",
  "+18005550123",
  "+18005550199",
  "+15550123",
  "+11234567890",
  "+1 (555) 123\u20114567",
];

// ── Step 3: Fake email replacements ─────────────────────────────────────
const FAKE_EMAILS = [
  "contact@planflow.ai",
  "info@innovateweb.com",
  "info@acmecorp.com",
  "info@websolutionspro.com",
  "info@webdevsolutions.com",
];

// ── Step 4: Fake address replacements ───────────────────────────────────
const FAKE_ADDRESSES = [
  // Full addresses
  { pattern: /123 AI Lane,?\s*Future City,?\s*FC\s*90210/gi, replace: `{{address}}, {{city}}, {{state}}` },
  { pattern: /123 AI Lane,?\s*Innovate City,?\s*CA/gi, replace: `{{address}}, {{city}}, {{state}}` },
  { pattern: /123 Main St,?\s*Anytown,?\s*CA\s*(?:90210)?/gi, replace: `{{address}}, {{city}}, {{state}}` },
  { pattern: /123 Web Dev Street?,?\s*(?:Suite \d+,?\s*)?Innovation City,?\s*CA\s*(?:90210)?/gi, replace: `{{address}}, {{city}}, {{state}}` },
  // Street addresses alone
  { pattern: /123 AI Lane/g, replace: "{{address}}" },
  { pattern: /123 Main St/g, replace: "{{address}}" },
  { pattern: /123 Web Dev St(?:reet)?/g, replace: "{{address}}" },
  // Cities
  { pattern: /Future City/g, replace: "{{city}}" },
  { pattern: /Innovate City/g, replace: "{{city}}" },
  { pattern: /Innovation City/g, replace: "{{city}}" },
  { pattern: /Anytown/g, replace: "{{city}}" },
  // Zip
  { pattern: /"postalCode":\s*"90210"/g, replace: `"postalCode": "{{zip}}"` },
];

// ── Step 5: Rickroll YouTube ID ─────────────────────────────────────────
const RICKROLL_ID = "dQw4w9WgXcQ";

// ── Step 6: JSON-LD fixes ───────────────────────────────────────────────
const JSON_LD_REPLACEMENTS = [
  // Phone in JSON-LD
  { pattern: /"telephone":\s*"\+?\d[\d\s\-()]+"/g, replace: `"telephone": "{{phone_tel}}"` },
  // Email in JSON-LD
  { pattern: /"email":\s*"[^"]+@[^"]+"/g, replace: `"email": "{{email}}"` },
  // Street address in JSON-LD
  { pattern: /"streetAddress":\s*"[^"]+"/g, replace: `"streetAddress": "{{address}}"` },
  // City in JSON-LD
  { pattern: /"addressLocality":\s*"[^"]+"/g, replace: `"addressLocality": "{{city}}"` },
  // Region in JSON-LD
  { pattern: /"addressRegion":\s*"[^"]+"/g, replace: `"addressRegion": "{{state}}"` },
  // Fake social URLs
  { pattern: /https?:\/\/(?:www\.)?(facebook|twitter|linkedin|instagram)\.com\/(acmecorp|websolutionspro|webdevsolutions|innovateweb|example)\/?/gi, replace: `https://www.$1.com/planflowai` },
];

// ── Process each page ───────────────────────────────────────────────────

let totalChanges = 0;

for (const file of PAGES) {
  const filePath = join(PROJECT_DIR, file);
  let html = readFileSync(filePath, "utf-8");
  const originalLength = html.length;
  let changes = 0;

  // 1. Replace fake business names
  for (const name of FAKE_NAMES) {
    const count = html.split(name).length - 1;
    if (count > 0) {
      html = html.split(name).join("PlanFlowAI");
      changes += count;
      console.log(`  [${file}] Replaced "${name}" × ${count}`);
    }
  }

  // 2. Replace fake phones
  for (const phone of FAKE_PHONES) {
    const count = html.split(phone).length - 1;
    if (count > 0) {
      // In tel: hrefs, use {{phone_tel}}
      html = html.split(`tel:${phone}`).join("tel:{{phone_tel}}");
      html = html.split(`tel:+${phone}`).join("tel:{{phone_tel}}");
      // In display text, use {{phone}}
      html = html.split(phone).join("{{phone}}");
      changes += count;
      console.log(`  [${file}] Replaced phone "${phone}" × ${count}`);
    }
  }

  // 3. Replace fake emails (NOT info@planflowai.com)
  for (const email of FAKE_EMAILS) {
    const count = html.split(email).length - 1;
    if (count > 0) {
      html = html.split(`mailto:${email}`).join("mailto:{{email}}");
      html = html.split(email).join("{{email}}");
      changes += count;
      console.log(`  [${file}] Replaced email "${email}" × ${count}`);
    }
  }

  // 4. Replace fake addresses (regex-based)
  for (const { pattern, replace } of FAKE_ADDRESSES) {
    const before = html;
    html = html.replace(pattern, replace);
    if (html !== before) {
      const c = (before.length - html.length + replace.length * (before.split(pattern).length - 1));
      changes++;
      console.log(`  [${file}] Replaced address pattern: ${pattern.source}`);
    }
  }

  // 5. Fix JSON-LD data
  for (const { pattern, replace } of JSON_LD_REPLACEMENTS) {
    const before = html;
    html = html.replace(pattern, replace);
    if (html !== before) {
      changes++;
      console.log(`  [${file}] Fixed JSON-LD: ${pattern.source.slice(0, 40)}`);
    }
  }

  // 6. Remove rickroll YouTube embeds
  if (html.includes(RICKROLL_ID)) {
    // Replace the video wrapper containing the rickroll with a placeholder
    // Replace video-container div containing the rickroll
    html = html.replace(
      new RegExp(`<div class="video-container[^"]*"[\\s\\S]*?${RICKROLL_ID}[\\s\\S]*?<\\/div>`, "g"),
      "<!-- Video placeholder: replace with real demo video -->"
    );
    // Replace video-wrapper div containing the rickroll
    html = html.replace(
      new RegExp(`<div class="video-wrapper">[\\s\\S]*?${RICKROLL_ID}[\\s\\S]*?<\\/div>\\s*<\\/div>`, "g"),
      "<!-- Video placeholder: replace with real demo video -->"
    );
    // Also catch standalone iframes
    html = html.replace(
      new RegExp(`<iframe[^>]*${RICKROLL_ID}[^>]*><\\/iframe>`, "g"),
      "<!-- Video placeholder: replace with real demo video -->"
    );
    changes++;
    console.log(`  [${file}] Removed rickroll embed`);
  }

  // 7. Fix wrong canonical/OG URLs
  html = html.replace(/https:\/\/websolutionspro\.com/g, "https://planflowai.com");
  html = html.replace(/https:\/\/innovateweb\.com/g, "https://planflowai.com");
  html = html.replace(/https:\/\/webdevsolutions\.com/g, "https://planflowai.com");
  html = html.replace(/https:\/\/acmecorp\.com/g, "https://planflowai.com");

  // 8. Fix copyright years to use dynamic JS
  html = html.replace(/&copy;\s*20\d{2}\s+/g, "&copy; <span class='copyright-year'></span> ");
  html = html.replace(/©\s*20\d{2}\s+/g, "© <span class='copyright-year'></span> ");

  // Page-specific fixes
  if (file === "contact.html") {
    // Fix nav — replace path-based nav with file-based nav
    html = html.replace(
      /<header class="main-header">[\s\S]*?<\/header>/,
      `<header class="main-header"><div class="container main-nav"><a href="index.html" class="nav-logo">PlanFlowAI</a><button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">☰</button><ul class="nav-links"><li><a href="index.html">Home</a></li><li><a href="showroom.html">Showroom</a></li><li><a href="pricing.html">Pricing</a></li><li><a href="services.html">Services</a></li><li><a href="how-it-works.html">How-it-works</a></li><li><a href="about.html">About</a></li><li><a href="contact.html" class="active">Contact</a></li></ul><button class="theme-toggle" aria-label="Toggle dark/light mode">💡</button></div></header>`
    );
    // Fix footer links
    html = html.replace(/<li><a href="\/">Home<\/a><\/li>/g, '<li><a href="index.html">Home</a></li>');
    html = html.replace(/<li><a href="\/about">About<\/a><\/li>/g, '<li><a href="about.html">About</a></li>');
    html = html.replace(/<li><a href="\/services">Services<\/a><\/li>/g, '<li><a href="services.html">Services</a></li>');
    html = html.replace(/<li><a href="\/contact">Contact<\/a><\/li>/g, '<li><a href="contact.html">Contact</a></li>');
    html = html.replace(/<li><a href="\/privacy">Privacy Policy<\/a><\/li>/g, '<li><a href="privacy.html">Privacy Policy</a></li>');
    changes++;
    console.log(`  [${file}] Fixed nav + footer links`);
  }

  if (file === "about.html") {
    // Remove fake team members (keep DJ Sarge only)
    // Remove Alex Rivera card
    html = html.replace(
      /<div class="team-member animate-on-scroll">\s*<img[^>]*alt="Alex Rivera[^"]*"[^>]*>[\s\S]*?<h3>Alex Rivera<\/h3>[\s\S]*?<\/div>\s*<\/div>/,
      ""
    );
    // Remove Maria Chen card
    html = html.replace(
      /<div class="team-member animate-on-scroll">\s*<img[^>]*alt="Maria Chen[^"]*"[^>]*>[\s\S]*?<h3>Maria Chen<\/h3>[\s\S]*?<\/div>\s*<\/div>/,
      ""
    );
    // Remove Sam Miller card
    html = html.replace(
      /<div class="team-member animate-on-scroll">\s*<img[^>]*alt="Sam Miller[^"]*"[^>]*>[\s\S]*?<h3>Sam Miller<\/h3>[\s\S]*?<\/div>\s*<\/div>/,
      ""
    );
    console.log(`  [${file}] Removed fake team members (Alex Rivera, Maria Chen, Sam Miller)`);
    changes++;

    // Remove fake timeline section entirely
    html = html.replace(
      /<section class="animate-on-scroll">\s*<div class="container text-center">\s*<h2>Our Journey So Far<\/h2>[\s\S]*?<\/div>\s*<\/section>/,
      ""
    );
    console.log(`  [${file}] Removed fake company timeline`);
    changes++;

    // Change "Meet the Visionaries" to just "Meet the Founder" since only DJ Sarge remains
    html = html.replace("Meet the Visionaries", "Meet the Founder");
    html = html.replace("The dedicated individuals behind PlanFlowAI", "The visionary behind PlanFlowAI");
  }

  // Save
  writeFileSync(filePath, html);
  totalChanges += changes;
  console.log(`[${file}] ${changes} changes, ${originalLength} → ${html.length} bytes\n`);
}

// ── Now inject real PII data ────────────────────────────────────────────
console.log("\n=== PII INJECTION ===\n");

const PLACEHOLDER_MAP = {
  "{{BUSINESS_NAME}}": PII.BUSINESS_NAME,
  "{{business_name}}": PII.BUSINESS_NAME,
  "{{phone}}": PII.phone,
  "{{PHONE}}": PII.phone,
  "{{phone_tel}}": PII.phone_tel,
  "{{email}}": PII.email,
  "{{EMAIL}}": PII.email,
  "{{address}}": PII.address,
  "{{ADDRESS}}": PII.address,
  "{{city}}": PII.city,
  "{{CITY}}": PII.city,
  "{{state}}": PII.state,
  "{{STATE}}": PII.state,
  "{{zip}}": PII.zip,
  "{{client_name}}": PII.BUSINESS_NAME,
  "{{CLIENT_NAME}}": PII.BUSINESS_NAME,
};

for (const file of PAGES) {
  const filePath = join(PROJECT_DIR, file);
  let html = readFileSync(filePath, "utf-8");
  let injected = 0;

  for (const [placeholder, value] of Object.entries(PLACEHOLDER_MAP)) {
    const count = html.split(placeholder).length - 1;
    if (count > 0) {
      html = html.split(placeholder).join(value);
      injected += count;
    }
  }

  writeFileSync(filePath, html);
  console.log(`[${file}] Injected ${injected} PII values`);
}

// ── Verification ────────────────────────────────────────────────────────
console.log("\n=== VERIFICATION ===\n");

let allClean = true;

for (const file of PAGES) {
  const filePath = join(PROJECT_DIR, file);
  const html = readFileSync(filePath, "utf-8");
  const issues = [];

  // Check for remaining placeholders
  const placeholders = html.match(/\{\{[a-zA-Z_]+\}\}/g);
  if (placeholders) {
    issues.push(`Remaining placeholders: ${[...new Set(placeholders)].join(", ")}`);
  }

  // Check for fake business names
  for (const name of FAKE_NAMES) {
    if (html.includes(name)) issues.push(`Still contains: "${name}"`);
  }

  // Check for 555 phone patterns
  if (/555[-.\s]?\d{3}[-.\s]?\d{4}/.test(html)) issues.push("Still contains 555 phone number");
  if (/123[-.\s]456[-.\s]7890/.test(html)) issues.push("Still contains 123-456-7890");
  if (/800[-.\s]555/.test(html)) issues.push("Still contains 800-555 number");

  // Check for fake emails
  for (const email of FAKE_EMAILS) {
    if (html.includes(email)) issues.push(`Still contains: ${email}`);
  }

  // Check nav consistency
  const hasAllNavLinks =
    html.includes('href="index.html"') &&
    html.includes('href="showroom.html"') &&
    html.includes('href="pricing.html"') &&
    html.includes('href="services.html"') &&
    html.includes('href="how-it-works.html"') &&
    html.includes('href="about.html"') &&
    html.includes('href="contact.html"');

  if (!hasAllNavLinks) issues.push("Nav is missing one or more page links");

  // Check rickroll
  if (html.includes(RICKROLL_ID)) issues.push("Still contains rickroll");

  if (issues.length > 0) {
    console.log(`[${file}] ISSUES:`);
    for (const i of issues) console.log(`  - ${i}`);
    allClean = false;
  } else {
    console.log(`[${file}] CLEAN`);
  }
}

console.log(`\nTotal changes across all files: ${totalChanges}`);
console.log(allClean ? "\nAll pages verified clean." : "\nSome issues remain — see above.");
