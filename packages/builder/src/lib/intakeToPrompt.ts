/**
 * Intake-to-Prompt Template Assembly
 *
 * Takes the intake form JSON and assembles a complete builder prompt.
 * Uses PII placeholders instead of real values — inject real values post-build.
 */

const INDUSTRY_STYLES: Record<string, string> = {
  plumber: "trustworthy, blue-collar professional, clean, bold typography",
  electrician: "modern, safety-focused, yellow/orange accents, industrial",
  hvac: "clean, comfortable, temperature-related imagery, professional blue tones",
  landscaping: "natural greens, earthy tones, outdoor imagery, organic shapes",
  construction: "rugged, bold, strong typography, steel/concrete palette",
  roofing: "reliable, weather-resistant imagery, strong reds/grays",
  painting: "colorful, creative, clean lines, paint-splash accents",
  cleaning: "fresh, bright, white-space heavy, mint/teal accents",
  auto: "mechanical, dark with chrome accents, bold red/black palette",
  restaurant: "warm, inviting, food photography focus, rich earth tones",
  salon: "elegant, feminine or modern-neutral, soft gradients, gold accents",
  fitness: "energetic, high-contrast, bold imagery, neon accents",
  medical: "clean, trustworthy, calming blues/greens, white-space heavy",
  legal: "authoritative, navy/burgundy, serif headings, traditional elegance",
  realestate: "aspirational, large hero images, clean grids, warm neutrals",
  photography: "minimal, gallery-focused, let images speak, dark backgrounds",
  entertainment: "vibrant, dynamic, bold colors, animated elements",
  nonprofit: "compassionate, community-focused, warm colors, storytelling",
  consulting: "professional, corporate-clean, minimal, trust-building",
  retail: "product-focused, grid layouts, shopping-oriented, bright CTA buttons",
  tech: "modern, sleek, gradient accents, dark mode friendly, monospace details",
  bookkeeping: "organized, trustworthy, clean tables/charts, professional greens/blues",
  other: "modern, professional, clean layout, accessible",
};

const PAGE_REQUIREMENTS: Record<string, string> = {
  home: "Hero section with headline + CTA, value propositions, featured services preview, testimonial highlight, contact CTA",
  about: "Company story, mission/values, team section with photos and bios, timeline or milestones",
  services: "Service cards with descriptions and pricing hints, individual service detail expandable sections",
  contact: "Contact form (name, email, phone, message), business hours, address with map placeholder, phone/email links",
  gallery: "Masonry or grid photo gallery with lightbox, category filters",
  testimonials: "Client testimonials in cards with names and photos, star ratings, rotating carousel option",
  faq: "Accordion-style FAQ with expand/collapse, search filter, organized by category",
  blog: "Blog listing with cards (title, excerpt, date, category), individual post template",
  pricing: "Pricing table or tiered cards, feature comparison, CTA per tier",
  booking: "Embedded booking calendar or link to external booking, available services selector",
  shop: "Product grid with cards (image, name, price), add-to-cart buttons, category sidebar",
};

const FEATURE_INSTRUCTIONS: Record<string, string> = {
  seo: "Add proper meta tags (title, description, og:image), semantic HTML5 elements, structured data (JSON-LD for LocalBusiness)",
  accessibility: "WCAG 2.1 AA compliance: proper alt text, ARIA labels, keyboard navigation, color contrast ratios, skip-nav link",
  security: "HTTPS-ready, CSP meta tag, no inline event handlers where possible, sanitized form inputs",
  analytics: "Add Google Analytics 4 placeholder script with {{GA_MEASUREMENT_ID}} tag",
  privacy_policy: "Add a Privacy Policy page link in footer with standard privacy policy template text",
  newsletter: "Add email newsletter signup form in footer or hero section with {{NEWSLETTER_ENDPOINT}} placeholder",
  chat: "Add a floating chat widget placeholder button in bottom-right corner with {{CHAT_WIDGET_SCRIPT}} tag",
  maintenance: "Include a maintenance mode banner template (hidden by default) with toggle via URL param ?maintenance=true",
};

export function intakeToPrompt(formData: any): string {
  // If form_data is nested (from intake/submit), unwrap it
  const fd = formData.form_data && typeof formData.form_data === "object"
    ? formData.form_data
    : formData;

  const lines: string[] = [];

  // Header
  lines.push(`Build a complete, production-ready website for the following business:\n`);

  // Business info with PII placeholders
  lines.push(`## Business Information`);
  lines.push(`- **Business Name**: {{BUSINESS_NAME}}`);
  lines.push(`- **Industry**: ${fd.industry || "General"}`);
  lines.push(`- **Location**: {{address}}, {{city}}, {{state}}`);
  lines.push(`- **Phone**: {{phone}}`);
  lines.push(`- **Email**: {{email}}`);
  if (fd.hours) lines.push(`- **Hours**: ${fd.hours}`);
  if (fd.service_area) lines.push(`- **Service Area**: ${fd.service_area}`);
  if (fd.domain) lines.push(`- **Domain**: ${fd.domain}`);
  lines.push("");

  // Business description
  if (fd.business_description) {
    lines.push(`## About the Business`);
    lines.push(fd.business_description);
    lines.push("");
  }

  // USP
  if (fd.usp) {
    lines.push(`## Unique Selling Proposition`);
    lines.push(fd.usp);
    lines.push("");
  }

  // Target audience
  if (fd.target_audience) {
    lines.push(`## Target Audience`);
    lines.push(fd.target_audience);
    lines.push("");
  }

  // Style direction
  const industryKey = (fd.industry || "other").toLowerCase();
  const styleKeywords = INDUSTRY_STYLES[industryKey] || INDUSTRY_STYLES.other;
  lines.push(`## Design Direction`);
  lines.push(`- **Industry style**: ${styleKeywords}`);

  // Style vibe — accept style_vibe OR style_preference
  const vibe = fd.style_vibe || fd.style_preference;
  if (vibe) {
    const vibes = Array.isArray(vibe) ? vibe.join(", ") : vibe;
    lines.push(`- **Vibe**: ${vibes}`);
  }

  // Colors — accept flat fields OR nested colors object
  const colorPrimary = fd.color_primary || fd.colors?.primary;
  const colorSecondary = fd.color_secondary || fd.colors?.secondary;
  const colorAccent = fd.color_accent || fd.colors?.accent;
  if (colorPrimary) lines.push(`- **Primary color**: ${colorPrimary}`);
  if (colorSecondary) lines.push(`- **Secondary color**: ${colorSecondary}`);
  if (colorAccent) lines.push(`- **Accent color**: ${colorAccent}`);

  if (fd.theme) {
    const theme = Array.isArray(fd.theme) ? fd.theme[0] : fd.theme;
    lines.push(`- **Theme**: ${theme}`);
  }
  if (fd.design_notes) lines.push(`- **Design notes**: ${fd.design_notes}`);
  lines.push("");

  // Primary CTA — accept primary_cta OR cta
  const cta = fd.primary_cta || fd.cta;
  if (cta) {
    const ctas = Array.isArray(cta) ? cta.join(", ") : cta;
    lines.push(`## Primary Call-to-Action: ${ctas}`);
    lines.push("");
  }

  // Pages to build
  const pages: string[] = Array.isArray(fd.pages) ? fd.pages : ["Home"];
  lines.push(`## Pages to Build`);
  lines.push(`Build ALL ${pages.length} pages as sections in a single-page app:\n`);
  for (const page of pages) {
    const pageKey = page.toLowerCase();
    const req = PAGE_REQUIREMENTS[pageKey] || `Standard ${page} page layout`;
    lines.push(`### ${page.charAt(0).toUpperCase() + page.slice(1)}`);
    lines.push(req);
    lines.push("");
  }
  if (fd.custom_pages) {
    lines.push(`### Custom Pages: ${fd.custom_pages}`);
    lines.push("");
  }

  // About text
  if (fd.about_text) {
    lines.push(`## About Page Content`);
    lines.push(fd.about_text);
    lines.push("");
  }

  // Services — accept service_name[] array OR services[] string array
  if (fd.service_name && Array.isArray(fd.service_name)) {
    lines.push(`## Services`);
    for (let i = 0; i < fd.service_name.length; i++) {
      const name = fd.service_name[i];
      const desc = fd.service_desc?.[i] || "";
      if (name) lines.push(`- **${name}**: ${desc}`);
    }
    lines.push("");
  } else if (fd.services && Array.isArray(fd.services)) {
    lines.push(`## Services`);
    for (const svc of fd.services) {
      lines.push(`- **${svc}**`);
    }
    lines.push("");
  }

  // Team
  if (fd.team_name && Array.isArray(fd.team_name)) {
    lines.push(`## Team Members`);
    for (let i = 0; i < fd.team_name.length; i++) {
      const name = fd.team_name[i];
      const role = fd.team_role?.[i] || "";
      const bio = fd.team_bio?.[i] || "";
      if (name) lines.push(`- **${name}** — ${role}. ${bio}`);
    }
    lines.push("");
  }

  // Testimonials
  if (fd.testimonial_quote && Array.isArray(fd.testimonial_quote)) {
    lines.push(`## Testimonials`);
    for (let i = 0; i < fd.testimonial_quote.length; i++) {
      const quote = fd.testimonial_quote[i];
      const tName = fd.testimonial_name?.[i] || "";
      if (quote) lines.push(`- "${quote}" — ${tName}`);
    }
    lines.push("");
  }

  // Social links
  const socials = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "google"]
    .map((s) => ({ platform: s, url: fd[`social_${s}`] }))
    .filter((s) => s.url);
  if (socials.length > 0) {
    lines.push(`## Social Media Links`);
    for (const s of socials) {
      lines.push(`- ${s.platform}: ${s.url}`);
    }
    lines.push("");
  }

  // Booking link
  if (fd.booking_link) {
    lines.push(`## Booking: ${fd.booking_link}`);
    lines.push("");
  }

  // Features / post-build toggles
  const features: string[] = Array.isArray(fd.features) ? fd.features : [];
  if (features.length > 0) {
    lines.push(`## Required Features`);
    for (const f of features) {
      const fKey = f.toLowerCase().replace(/\s+/g, "_");
      const instruction = FEATURE_INSTRUCTIONS[fKey] || `Enable ${f}`;
      lines.push(`- **${f}**: ${instruction}`);
    }
    lines.push("");
  }

  // Reference sites
  if (fd.reference_sites) {
    lines.push(`## Reference Sites for Inspiration: ${fd.reference_sites}`);
    lines.push("");
  }

  // Footer instruction — NON-NEGOTIABLE PII placeholder enforcement
  lines.push(`## CRITICAL — PII Placeholder Rules (NON-NEGOTIABLE)`);
  lines.push(`You MUST use these EXACT placeholder tokens in the HTML wherever client data would appear:`);
  lines.push(`- {{BUSINESS_NAME}} — for the business/company name`);
  lines.push(`- {{phone}} — for phone numbers`);
  lines.push(`- {{email}} — for email addresses`);
  lines.push(`- {{address}} — for street address`);
  lines.push(`- {{city}} — for city name`);
  lines.push(`- {{state}} — for state`);
  lines.push(`- {{client_name}} — for the owner/contact name`);
  lines.push(`NEVER use real client data. NEVER hardcode phone numbers, emails, or addresses.`);
  lines.push(`These placeholders will be replaced with real values after the build.`);
  lines.push(``);
  lines.push(`## Build Requirements`);
  lines.push(`- Build a single self-contained HTML file with all CSS in <style> and all JS in <script>.`);
  lines.push(`- Make it fully responsive. Mobile-first design.`);
  lines.push(`- Use real stock photos from Unsplash or placeholder images.`);
  lines.push(`- All navigation must use JavaScript show/hide sections (SPA pattern), NOT separate files.`);

  return lines.join("\n");
}
