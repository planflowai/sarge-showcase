/**
 * Hybrid Forge Trials — 10 Additional Scenarios
 * Industry-specific site builds for hybrid chain testing.
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

export const HYBRID_SCENARIOS: BenchmarkScenario[] = [
  // ── R9: Local Service Business (Plumber/Electrician/HVAC) ──────
  {
    id: "cloud-r9-local-service",
    name: "Local Service",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete website for a local plumbing and HVAC company called 'ProFlow Services' in Denver, Colorado. Phone number (303) 555-0187 must be huge and clickable (tel: link) in the hero and header. Include: emergency service banner at top, service area map section with listed neighborhoods, services section (plumbing, HVAC, water heater, drain cleaning) with icons, customer reviews section with star ratings (at least 5 reviews), a contact form with service type dropdown and urgency selector, business hours, license and insurance badges, 'Why Choose Us' section with guarantees. Make the phone number impossible to miss. Fully responsive. Professional blue/gray color scheme. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "select", "button", "footer", "a"],
      requiredKeywords: ["ProFlow", "Denver", "(303) 555-0187", "plumbing", "HVAC", "emergency", "review", "license"],
      cssPatterns: ["@media", "flex", "transition", "color", "font-size"],
      jsPatterns: ["addEventListener", "querySelector", "form"],
      minLength: 5000,
    },
  },

  // ── R10: Medical / Wellness (Dentist/MedSpa) ───────────────────
  {
    id: "cloud-r10-medical",
    name: "Medical/Wellness",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete website for 'Bright Smile Dental & MedSpa' in Scottsdale, Arizona. Booking CTA must be front and center — a 'Book Your Appointment' button should appear in the hero, sticky header, and floating bottom bar. Include: services section with dental and medspa categories (cleanings, whitening, Botox, fillers, facials), doctor/provider bios with credentials and certifications, patient testimonials with before/after placeholders, trust signals (ADA member badge, 5-star Google rating, years in practice), insurance accepted section, new patient special offer banner, contact info with office hours, embedded map placeholder. Clean, medical-professional aesthetic — white/teal/gold. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "button", "footer", "img", "a"],
      requiredKeywords: ["Bright Smile", "Scottsdale", "appointment", "dental", "medspa", "credentials", "insurance", "testimonial"],
      cssPatterns: ["@media", "flex", "position", "transition", "gradient"],
      jsPatterns: ["addEventListener", "querySelector", "scroll"],
      minLength: 5000,
    },
  },

  // ── R11: Restaurant Full (Harder than R1) ──────────────────────
  {
    id: "cloud-r11-restaurant-full",
    name: "Restaurant Full",
    difficulty: "expert",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete upscale restaurant website for 'Ember & Oak' — a farm-to-table restaurant in Portland, Oregon. Include: animated hero with background image overlay and tagline, full multi-course menu organized by sections (Starters, Salads, Mains, Seafood, Desserts, Drinks) with prices, descriptions, and dietary icons (V for vegetarian, GF for gluten-free, S for spicy), reservation form with date picker, time slots, party size, and special requests textarea, restaurant hours for each day of the week displayed in a styled table, location section with address and embedded Google Maps placeholder, photo gallery with lightbox modal, chef's story section, private dining/events section, gift cards CTA, Instagram feed placeholder, footer with social links. Elegant dark theme with warm accent colors. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "select", "textarea", "button", "footer", "table"],
      requiredKeywords: ["Ember & Oak", "Portland", "reservation", "menu", "Starters", "Desserts", "vegetarian", "gluten-free", "gallery"],
      cssPatterns: ["@media", "grid", "flex", "animation", "transition", "@keyframes"],
      jsPatterns: ["addEventListener", "querySelector", "modal", "classList"],
      minLength: 7000,
    },
  },

  // ── R12: Real Estate Agent ─────────────────────────────────────
  {
    id: "cloud-r12-real-estate",
    name: "Real Estate Agent",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete website for real estate agent 'Sarah Mitchell' serving the Charlotte, NC metro area. Include: hero with search-like CTA ('Find Your Dream Home'), featured listings grid (6 property cards with image placeholders, price, beds/baths/sqft, neighborhood), agent bio section with photo placeholder, credentials, and years of experience, neighborhood guides section (4 areas with description and highlights), client testimonials (at least 4), lead capture form (name, email, phone, buying/selling toggle, price range dropdown, message), recently sold section showing success metrics, market stats section with animated counters, footer with contact info and MLS disclaimer. Professional navy/gold color scheme. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "select", "button", "footer", "img"],
      requiredKeywords: ["Sarah Mitchell", "Charlotte", "listing", "bedroom", "neighborhood", "testimonial", "MLS"],
      cssPatterns: ["@media", "grid", "flex", "transition", "hover"],
      jsPatterns: ["addEventListener", "querySelector", "classList"],
      minLength: 6000,
    },
  },

  // ── R13: Law Firm ──────────────────────────────────────────────
  {
    id: "cloud-r13-law-firm",
    name: "Law Firm",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete website for 'Harrison & Cole Attorneys at Law' — a personal injury and family law firm in Atlanta, Georgia. Credibility must come first. Include: hero with strong headline and 'Free Consultation' CTA, practice areas section (Personal Injury, Family Law, Criminal Defense, Estate Planning) with icons and detail modals, attorney bios (3 attorneys with photo placeholders, education, bar admissions, notable cases), case results section with verdict amounts, client testimonials with case type labels, FAQ accordion for common legal questions, consultation request form (name, email, phone, case type dropdown, brief description), awards and memberships bar (Super Lawyers, Avvo, State Bar), footer with disclaimer and office locations. Conservative, trustworthy design — dark navy, white, gold accents. Serif headings. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "select", "textarea", "button", "footer"],
      requiredKeywords: ["Harrison & Cole", "Atlanta", "attorney", "consultation", "personal injury", "family law", "verdict", "disclaimer"],
      cssPatterns: ["@media", "flex", "transition", "font-family"],
      jsPatterns: ["addEventListener", "querySelector", "classList", "toggle"],
      minLength: 6000,
    },
  },

  // ── R14: Event / Wedding ───────────────────────────────────────
  {
    id: "cloud-r14-event-wedding",
    name: "Event/Wedding",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete wedding website for 'Emma & James — June 15, 2026' in Napa Valley, California. Include: hero with couple names and countdown timer (JavaScript counting down to June 15 2026), 'Our Story' section with timeline of relationship milestones, photo gallery section with grid layout and lightbox on click, event schedule section (ceremony time/location, cocktail hour, reception, after-party), venue information with address and map placeholder, travel and accommodation section with hotel recommendations, RSVP form (guest name, email, attending yes/no, number of guests, meal preference dropdown: chicken/fish/vegetarian, song request, dietary notes), wedding party section with photos and roles, gift registry links, FAQ section. Romantic, elegant design — soft pastels, script fonts for headings. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "select", "textarea", "button", "footer"],
      requiredKeywords: ["Emma", "James", "June 15", "RSVP", "ceremony", "reception", "countdown", "gallery", "registry"],
      cssPatterns: ["@media", "flex", "grid", "animation", "font-family"],
      jsPatterns: ["addEventListener", "querySelector", "setInterval", "Date", "classList"],
      minLength: 6000,
    },
  },

  // ── R15: Nonprofit ─────────────────────────────────────────────
  {
    id: "cloud-r15-nonprofit",
    name: "Nonprofit",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete website for 'Green Futures Foundation' — an environmental nonprofit. Include: hero with mission statement and 'Donate Now' CTA button, impact stats section with animated counters (trees planted, communities served, volunteers, funds raised), programs section (4 programs with descriptions and icons), donation section with suggested amounts ($25/$50/$100/$250/custom) that highlight on selection, volunteer signup form (name, email, phone, interests checkboxes, availability), upcoming events calendar section (at least 4 events with dates, descriptions, register buttons), team/leadership section, partners and sponsors logo bar, newsletter signup, success stories section with testimonials, footer with contact info, EIN number, and social links. Inspiring green/earth-tones color scheme. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "button", "footer"],
      requiredKeywords: ["Green Futures", "donate", "volunteer", "mission", "events", "impact", "newsletter"],
      cssPatterns: ["@media", "flex", "grid", "animation", "transition"],
      jsPatterns: ["addEventListener", "querySelector", "classList"],
      minLength: 6000,
    },
  },

  // ── R16: Fitness / Gym ─────────────────────────────────────────
  {
    id: "cloud-r16-fitness",
    name: "Fitness/Gym",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a complete website for 'IronCore Fitness' — a gym and fitness studio. Include: hero with bold imagery overlay and 'Start Free Trial' CTA, class schedule section displayed as a weekly grid/table (Monday-Sunday, classes like HIIT, Yoga, Spin, Boxing, Strength with times), trainer bios section (4 trainers with photo placeholders, specialties, certifications), membership pricing table (3 tiers: Basic $29/mo, Premium $59/mo, Elite $99/mo with feature comparison checkmarks), free trial signup form (name, email, phone, fitness goal dropdown, preferred class), facility features section with icons (pool, sauna, free weights, group classes), transformation stories with before/after placeholders, location and hours section, mobile app download CTA. Bold, energetic design — dark background, neon accent colors. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "select", "button", "table", "footer"],
      requiredKeywords: ["IronCore", "membership", "trainer", "schedule", "HIIT", "Yoga", "trial", "pricing"],
      cssPatterns: ["@media", "grid", "flex", "transition", "gradient"],
      jsPatterns: ["addEventListener", "querySelector", "classList"],
      minLength: 6000,
    },
  },

  // ── R17: Landing Page (Pure Conversion) ────────────────────────
  {
    id: "cloud-r17-landing-page",
    name: "Landing Page",
    difficulty: "hard",
    timeout: 150_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Build a high-conversion landing page for a SaaS product called 'TaskFlow' — an AI-powered project management tool. This is a PURE CONVERSION page — one CTA, no navigation menu, no distractions. Include: hero with headline, subheadline, and single prominent 'Start Free Trial' button, social proof bar (logos of companies using it: 'Trusted by teams at...'), problem/solution section (3 pain points with solutions), feature highlights (3 key features with icons), video placeholder section, testimonials (3 with name, role, company, photo placeholder), pricing (single plan, $49/mo, with feature list), FAQ accordion (5 questions), urgency element (limited-time offer banner or countdown), final CTA section repeating the main button, minimalist footer with just legal links. Sticky CTA button on mobile. Clean, modern SaaS aesthetic — white background, blue accent. Fully responsive. Output a single complete HTML file.",
    validation: {
      requiredElements: ["header", "section", "form", "input", "button", "footer"],
      requiredKeywords: ["TaskFlow", "free trial", "testimonial", "pricing", "FAQ", "trusted"],
      cssPatterns: ["@media", "flex", "position", "transition", "gradient"],
      jsPatterns: ["addEventListener", "querySelector", "classList", "scroll"],
      minLength: 5000,
    },
  },

  // ── R18: Rebuild / Refresh (Modernize Ugly HTML) ───────────────
  {
    id: "cloud-r18-rebuild",
    name: "Rebuild/Refresh",
    difficulty: "expert",
    timeout: 240_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt: `You are given an outdated, ugly website. Completely redesign and modernize it while keeping ALL the original content and business information. Add: modern responsive layout, professional typography, smooth animations, proper color scheme, mobile navigation, hover effects, proper semantic HTML, accessibility attributes, scroll animations using Intersection Observer, a contact form with validation, footer with social links. Make it look like it was built in 2026, not 2006. Output the complete modernized HTML file.

\`\`\`html
<!DOCTYPE html>
<html>
<head><title>Bob's Auto Repair</title>
<style>
body{background:#ffffcc;font-family:Comic Sans MS,cursive;margin:0}
table{width:100%;border-collapse:collapse}td{padding:10px;border:1px solid black}
.blink{animation:blink 1s step-end infinite}@keyframes blink{50%{opacity:0}}
marquee{background:red;color:yellow;font-size:24px;font-weight:bold}
.center{text-align:center}img{border:5px solid blue}
a{color:purple;font-size:18px}a:visited{color:red}
hr{border:3px solid green}.button{background:lime;color:black;padding:10px 20px;font-size:20px;border:3px outset gray;cursor:pointer}
</style></head>
<body>
<marquee>★★★ WELCOME TO BOB'S AUTO REPAIR — BEST PRICES IN TOWN!!! ★★★</marquee>
<table><tr><td class="center" colspan="2">
<h1 style="color:red;font-size:48px">🔧 BOB'S AUTO REPAIR 🔧</h1>
<p class="blink" style="color:blue;font-size:24px">NOW OPEN 7 DAYS A WEEK!</p>
<p>📞 Call us: <b>(555) 789-0123</b> | 📍 742 Mechanic Lane, Springfield</p>
</td></tr>
<tr><td style="width:60%;vertical-align:top;background:#ffeeee">
<h2 style="color:green">Our Services:</h2>
<ul style="font-size:18px">
<li>Oil Changes — $29.99</li><li>Brake Repair — Starting at $99</li>
<li>Tire Rotation — $19.99</li><li>Engine Diagnostics — $49.99</li>
<li>Transmission — Call for Quote</li><li>AC Repair — $149+</li>
<li>State Inspection — $25</li></ul>
<hr><h2 style="color:green">Why Choose Bob?</h2>
<p>✅ 25 years experience<br>✅ ASE Certified<br>✅ Fair honest pricing<br>✅ Free estimates<br>✅ Warranty on all work</p>
<hr><h2 style="color:green">Customer Reviews:</h2>
<p><i>"Bob fixed my car when the dealer wanted $2000. He did it for $400. Honest guy!" — Mike T.</i></p>
<p><i>"Been going to Bob for 10 years. Wouldn't trust anyone else." — Sandra K.</i></p>
<p><i>"Fast, fair, and friendly. Five stars!" — James R.</i></p>
</td><td style="vertical-align:top;background:#eeffee">
<h2 style="color:blue" class="center">Hours of Operation</h2>
<table style="width:100%"><tr><td>Monday-Friday</td><td>7:00 AM - 6:00 PM</td></tr>
<tr><td>Saturday</td><td>8:00 AM - 4:00 PM</td></tr>
<tr><td>Sunday</td><td>9:00 AM - 2:00 PM</td></tr></table>
<hr><h2 style="color:blue" class="center">Coupons!</h2>
<div style="border:3px dashed red;padding:15px;margin:10px;text-align:center;background:yellow">
<h3>$10 OFF Oil Change!</h3><p>Print this coupon. Expires 12/31/2026</p></div>
<div style="border:3px dashed red;padding:15px;margin:10px;text-align:center;background:yellow">
<h3>FREE Brake Inspection!</h3><p>With any service. Expires 12/31/2026</p></div>
<hr><p class="center"><button class="button" onclick="alert('Call us at (555) 789-0123!')">SCHEDULE SERVICE NOW</button></p>
<p class="center"><img src="bobs-shop.jpg" alt="Bob's Shop" width="300"><br><small>Our shop on Mechanic Lane</small></p>
</td></tr></table>
<hr><p class="center" style="font-size:12px">© 2024 Bob's Auto Repair | Built with Notepad</p>
</body></html>
\`\`\``,
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "button", "footer"],
      requiredKeywords: ["Bob", "Auto Repair", "(555) 789-0123", "Oil Change", "Brake", "ASE", "Springfield", "review"],
      cssPatterns: ["@media", "flex", "transition", "var(--", "grid"],
      jsPatterns: ["IntersectionObserver", "addEventListener", "querySelector", "validate"],
      minLength: 5000,
    },
  },

  // ── R19: Level 11 Events (Real Client) ───────────────────────
  {
    id: "level11-events",
    name: "Level 11 Events (real client)",
    difficulty: "expert",
    timeout: 180_000,
    systemPrompt: CLOUD_SYSTEM_PROMPT,
    prompt:
      "Rebuild the Level 11 Events website — a premium entertainment company serving Bar/Bat Mitzvahs, weddings, corporate events, fundraisers, and social events. Offices in Minneapolis and New York. Tagline: 'A Higher Degree of Entertainment.' Services: DJs, Emcees, Musicians, Dancers, Sound & Lighting Technicians, Photobooths. Build a complete single-file HTML site with: animated dark hero section with the tagline, smooth scroll navigation (Home/Services/About/Photobooths/Contact), services grid with icons and descriptions for each event type, testimonials carousel, photobooth highlight section, contact form with event type selector and date picker, footer with social links and copyright. Dark elegant theme — black background, gold/amber accents. Fully responsive. Single HTML file, all CSS in style tag, all JS in script tag. No external dependencies except CDN libraries (Tailwind, Font Awesome, Google Fonts). Professional grade.",
    validation: {
      requiredElements: ["header", "nav", "section", "form", "input", "select", "button", "footer"],
      requiredKeywords: ["Level 11", "Higher Degree", "Entertainment", "DJ", "Emcee", "Photobooth", "Minneapolis", "wedding"],
      cssPatterns: ["@media", "flex", "animation", "@keyframes", "transition", "gradient"],
      jsPatterns: ["addEventListener", "querySelector", "scroll", "classList"],
      minLength: 6000,
    },
  },
];
