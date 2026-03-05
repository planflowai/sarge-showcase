/**
 * Cloud Forge Trials — 8 Production-Grade Scenarios
 * Full-site builds testing cloud models at their ceiling.
 * Each round produces a SINGLE complete HTML file with inline CSS and JS.
 */

import type { BenchmarkScenario } from "./runner";

const CLOUD_SYSTEM_PROMPT = `You are a code builder assistant.

RULES:
- Output a single complete HTML file with all CSS in a <style> tag and all JS in a <script> tag.
- No external dependencies except CDN libraries (Tailwind, Font Awesome, Google Fonts are fine).
- The file must be fully functional when opened in a browser.
- When modifying existing code, output the COMPLETE updated file.
- Start with a brief explanation (1-3 sentences) of what you built or changed.
- Then provide the code in a single code block.
- Be concise. No lengthy explanations unless asked.`;

export const CLOUD_SCENARIOS: BenchmarkScenario[] = [
  // ── R1: Restaurant Site (Layout + Interactivity + Embeds) ──────────
  {
    id: "cloud-r1-restaurant",
    name: "Restaurant",
    difficulty: "hard",
    timeout: 120_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete restaurant website: animated hero with parallax background image effect, navigation bar with smooth scroll to sections, food menu organized by category (appetizers/mains/desserts) with prices and descriptions, image gallery section, reservation form with date picker and party size selector using vanilla JS, customer testimonials carousel that auto-rotates, Google Maps embed placeholder div, footer with hours/address/social links. Professional color scheme. Fully responsive. Output a single complete HTML file with all CSS in a style tag and all JS in a script tag. No external dependencies except CDN libraries (Tailwind, Font Awesome, Google Fonts are fine). The file must be fully functional when opened in a browser.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "footer", "button", "input", "select", "a"],
      requiredKeywords: ["parallax", "reservation", "testimonial", "menu", "appetizer", "dessert", "gallery", "hours"],
      cssPatterns: ["@media", "flex", "animation", "transition", "position"],
      jsPatterns: ["addEventListener", "querySelector", "scroll", "carousel"],
      minLength: 5000,
    },
  },

  // ── R2: Portfolio + Animations (CSS Animations + DOM + Visual Polish) ─
  {
    id: "cloud-r2-portfolio",
    name: "Portfolio",
    difficulty: "hard",
    timeout: 120_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a creative portfolio site: hero section with animated text typing effect using JS, filterable project gallery (categories: Web, Mobile, Branding — clicking a category filters the grid with fade transitions), lightbox modal that opens when clicking a project, scroll-triggered reveal animations on sections using Intersection Observer, skills section with animated progress bars that fill on scroll, contact form with real-time validation, smooth page transitions. Dark theme with accent color. Output a single complete HTML file with all CSS in a style tag and all JS in a script tag. No external dependencies except CDN libraries. The file must be fully functional when opened in a browser.",
    validation: {
      requiredElements: ["header", "nav", "section", "button", "form", "input"],
      requiredKeywords: ["portfolio", "filter", "lightbox", "modal", "skills", "Web", "Mobile", "Branding"],
      cssPatterns: ["@media", "animation", "@keyframes", "transition", "transform"],
      jsPatterns: ["IntersectionObserver", "addEventListener", "classList", "filter"],
      minLength: 5000,
    },
  },

  // ── R3: SaaS Landing Page (State + Responsive + Complex Layout) ────
  {
    id: "cloud-r3-saas",
    name: "SaaS",
    difficulty: "hard",
    timeout: 150_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a SaaS product landing page: sticky navigation with scroll-aware active states, hero with animated gradient background, feature grid with hover effects and icons, pricing section with monthly/annual toggle that updates all prices dynamically using JS, feature comparison table (3 tiers), FAQ accordion with smooth expand/collapse, testimonial slider, newsletter signup with email validation, mobile hamburger menu with slide-in animation. Professional SaaS aesthetic. Output a single complete HTML file with all CSS in a style tag and all JS in a script tag. No external dependencies except CDN libraries. The file must be fully functional when opened in a browser.",
    validation: {
      requiredElements: ["header", "nav", "section", "button", "form", "input", "table"],
      requiredKeywords: ["pricing", "feature", "FAQ", "toggle", "monthly", "annual", "newsletter"],
      cssPatterns: ["@media", "gradient", "animation", "position", "transition"],
      jsPatterns: ["addEventListener", "classList", "toggle", "querySelector", "validate"],
      minLength: 6000,
    },
  },

  // ── R4: E-Commerce Product Page (JS Logic + Events + Dynamic State) ─
  {
    id: "cloud-r4-ecommerce",
    name: "E-Commerce",
    difficulty: "hard",
    timeout: 150_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a product detail page: image gallery with thumbnail carousel and main image swap on click, product variant selectors (size dropdown, color swatches that change main image border), quantity stepper (plus/minus buttons with min 1 max 10), Add to Cart button that shows a slide-in cart drawer with item count and total, related products grid (4 items) with hover zoom effect, product tabs (Description/Specs/Reviews) switching content, star rating display, breadcrumb navigation. Fully responsive grid layout. Output a single complete HTML file with all CSS in a style tag and all JS in a script tag. No external dependencies except CDN libraries. The file must be fully functional when opened in a browser.",
    validation: {
      requiredElements: ["img", "button", "select", "input", "div", "span"],
      requiredKeywords: ["cart", "quantity", "size", "color", "product", "review", "Add to Cart", "breadcrumb"],
      cssPatterns: ["@media", "grid", "transition", "transform", "hover"],
      jsPatterns: ["addEventListener", "querySelector", "classList", "innerHTML"],
      minLength: 5000,
    },
  },

  // ── R5: Admin Dashboard (Complex Layout + Data + Interactivity) ────
  {
    id: "cloud-r5-dashboard",
    name: "Dashboard",
    difficulty: "expert",
    timeout: 150_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build an admin dashboard: sidebar navigation with collapsible sections and active states, top bar with search input and notification bell with count badge, main area with 4 stat cards (animated count-up numbers on load), line chart placeholder with labeled axes and grid (draw with CSS/SVG, no chart library required), data table with 10 rows of sample data — sortable by clicking column headers and filterable by a search input above the table, dark mode toggle that switches entire dashboard theme using CSS variables, responsive — sidebar collapses to icons on smaller screens. Output a single complete HTML file with all CSS in a style tag and all JS in a script tag. No external dependencies except CDN libraries. The file must be fully functional when opened in a browser.",
    validation: {
      requiredElements: ["nav", "header", "table", "input", "button", "th", "td", "svg"],
      requiredKeywords: ["dashboard", "search", "notification", "sort", "filter", "dark mode", "sidebar"],
      cssPatterns: ["@media", "grid", "var(--", "transition", "flex"],
      jsPatterns: ["addEventListener", "querySelector", "sort", "classList", "toggle"],
      minLength: 7000,
    },
  },

  // ── R6: Multi-Page Wired Site (Navigation + Consistency + Validation) ─
  {
    id: "cloud-r6-multipage",
    name: "Multi-Page",
    difficulty: "expert",
    timeout: 180_000,  // Multi-page builds need more generation time
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a 4-page business website ALL IN ONE HTML FILE using JS-powered page routing. Pages: Home (hero, services overview, CTA), About (team cards with photos placeholder, company story, stats counter), Services (6 service cards with modal detail popups), Contact (validated form — name, email, phone, message — with inline error messages, success state). ALL pages share the same header and footer. Navigation highlights the active page. Page transitions are smooth. URL hash changes on navigation. Back button works. Consistent styling across all pages. Output a single complete HTML file with all CSS in a style tag and all JS in a script tag. No external dependencies except CDN libraries. The file must be fully functional when opened in a browser.",
    validation: {
      requiredElements: ["header", "nav", "footer", "form", "input", "button", "section", "a"],
      requiredKeywords: ["Home", "About", "Services", "Contact", "team", "modal"],
      cssPatterns: ["@media", "transition", "flex", "animation"],
      jsPatterns: ["addEventListener", "hash", "querySelector", "classList", "history"],
      minLength: 6000,
    },
  },

  // ── R7: Refactor and Enhance (Edit Existing Code) ──────────────────
  {
    id: "cloud-r7-refactor",
    name: "Refactor",
    difficulty: "expert",
    timeout: 240_000,  // Refactor requires understanding existing code first
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt: `Take this existing site and improve it significantly without changing the business or content. Add: responsive design with mobile menu, scroll animations using Intersection Observer, hero background image placeholder with overlay, service cards with hover effects and icons, a testimonials section with 3 reviews, a contact form with validation, schema.org JSON-LD for LocalBusiness, meta description and Open Graph tags, smooth scroll navigation, footer with business hours and social links. Keep the existing color scheme but make it modern. Output the complete improved HTML file.

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Basic Site</title>
<style>body{font-family:Arial;margin:0;padding:0}header{background:#333;color:white;padding:20px;text-align:center}
nav a{color:white;margin:0 10px;text-decoration:none}.hero{padding:60px 20px;text-align:center;background:#f5f5f5}
.services{display:flex;gap:20px;padding:20px;flex-wrap:wrap}.card{border:1px solid #ddd;padding:20px;flex:1;min-width:200px}
footer{background:#333;color:white;padding:20px;text-align:center}</style></head>
<body><header><h1>Johnson's Landscaping</h1><nav><a href="#">Home</a><a href="#">Services</a><a href="#">Contact</a></nav></header>
<div class="hero"><h2>Professional Lawn Care</h2><p>Serving the community for 15 years</p><button>Get a Quote</button></div>
<div class="services"><div class="card"><h3>Mowing</h3><p>Weekly lawn mowing service</p></div>
<div class="card"><h3>Trimming</h3><p>Bush and hedge trimming</p></div>
<div class="card"><h3>Planting</h3><p>Seasonal flower planting</p></div></div>
<footer><p>Contact: (555) 123-4567</p></footer></body></html>
\`\`\``,
    validation: {
      requiredElements: ["header", "nav", "footer", "form", "input", "button", "section", "script"],
      requiredKeywords: ["Landscaping", "Mowing", "Trimming", "testimonial", "contact", "responsive"],
      cssPatterns: ["@media", "transition", "hover", "flex"],
      jsPatterns: ["IntersectionObserver", "addEventListener", "querySelector", "validate"],
      minLength: 4000,
    },
  },

  // ── R8: Vague Brief / Full Autonomy ────────────────────────────────
  {
    id: "cloud-r8-autonomy",
    name: "Autonomy",
    difficulty: "expert",
    timeout: 300_000,  // Self-directed builds need the most time
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "I run a dog grooming business called Pawfect Cuts in Austin, Texas. I need a website that makes me look professional and trustworthy. I offer grooming for all breeds, nail trimming, flea treatments, and puppy packages. I have been in business for 8 years. My phone number is (512) 555-0199. I want people to be able to book online. Make it look great. I trust your judgment on colors, layout, and design. Output a single complete HTML file with all CSS in a style tag and all JS in a script tag.",
    validation: {
      requiredElements: ["header", "nav", "footer", "section", "form", "input", "button", "a"],
      requiredKeywords: ["Pawfect Cuts", "Austin", "grooming", "booking", "breed", "(512) 555-0199"],
      cssPatterns: ["@media", "flex", "transition", "color"],
      jsPatterns: ["addEventListener", "querySelector", "form"],
      minLength: 4000,
    },
  },
];

/** Get a cloud scenario by ID */
export function getCloudScenario(id: string): BenchmarkScenario | undefined {
  return CLOUD_SCENARIOS.find((s) => s.id === id);
}

// ── Combined set for Hybrid tab ──
import { HYBRID_SCENARIOS } from "./hybridScenarios";
export { HYBRID_SCENARIOS };
export const ALL_HYBRID_SCENARIOS: BenchmarkScenario[] = [...CLOUD_SCENARIOS, ...HYBRID_SCENARIOS];
