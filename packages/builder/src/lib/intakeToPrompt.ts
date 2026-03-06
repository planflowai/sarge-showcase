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
  const lines: string[] = [];

  // Header
  lines.push(`Build a complete, production-ready website for the following business:\n`);

  // Business info with PII placeholders
  lines.push(`## Business Information`);
  lines.push(`- **Business Name**: ${formData.business_name || "{{BUSINESS_NAME}}"}`);
  lines.push(`- **Industry**: ${formData.industry || "General"}`);
  lines.push(`- **Location**: {{address}}`);
  lines.push(`- **Phone**: {{phone}}`);
  lines.push(`- **Email**: {{email}}`);
  if (formData.hours) lines.push(`- **Hours**: ${formData.hours}`);
  if (formData.service_area) lines.push(`- **Service Area**: ${formData.service_area}`);
  lines.push("");

  // Business description
  if (formData.business_description) {
    lines.push(`## About the Business`);
    lines.push(formData.business_description);
    lines.push("");
  }

  // USP
  if (formData.usp) {
    lines.push(`## Unique Selling Proposition`);
    lines.push(formData.usp);
    lines.push("");
  }

  // Target audience
  if (formData.target_audience) {
    lines.push(`## Target Audience`);
    lines.push(formData.target_audience);
    lines.push("");
  }

  // Style direction
  const industry = formData.industry || "other";
  const styleKeywords = INDUSTRY_STYLES[industry] || INDUSTRY_STYLES.other;
  lines.push(`## Design Direction`);
  lines.push(`- **Industry style**: ${styleKeywords}`);
  if (formData.style_vibe) {
    const vibes = Array.isArray(formData.style_vibe)
      ? formData.style_vibe.join(", ")
      : formData.style_vibe;
    lines.push(`- **Vibe**: ${vibes}`);
  }
  if (formData.color_primary) lines.push(`- **Primary color**: ${formData.color_primary}`);
  if (formData.color_secondary) lines.push(`- **Secondary color**: ${formData.color_secondary}`);
  if (formData.color_accent) lines.push(`- **Accent color**: ${formData.color_accent}`);
  if (formData.theme) {
    const theme = Array.isArray(formData.theme) ? formData.theme[0] : formData.theme;
    lines.push(`- **Theme**: ${theme}`);
  }
  if (formData.design_notes) lines.push(`- **Design notes**: ${formData.design_notes}`);
  lines.push("");

  // Primary CTA
  if (formData.primary_cta) {
    const ctas = Array.isArray(formData.primary_cta)
      ? formData.primary_cta.join(", ")
      : formData.primary_cta;
    lines.push(`## Primary Call-to-Action: ${ctas}`);
    lines.push("");
  }

  // Pages to build
  const pages: string[] = Array.isArray(formData.pages) ? formData.pages : ["home"];
  lines.push(`## Pages to Build`);
  for (const page of pages) {
    const req = PAGE_REQUIREMENTS[page] || "Standard page layout";
    lines.push(`### ${page.charAt(0).toUpperCase() + page.slice(1)}`);
    lines.push(req);
    lines.push("");
  }
  if (formData.custom_pages) {
    lines.push(`### Custom Pages: ${formData.custom_pages}`);
    lines.push("");
  }

  // About text / services / team / testimonials
  if (formData.about_text) {
    lines.push(`## About Page Content`);
    lines.push(formData.about_text);
    lines.push("");
  }

  // Services
  if (formData.service_name && Array.isArray(formData.service_name)) {
    lines.push(`## Services`);
    for (let i = 0; i < formData.service_name.length; i++) {
      const name = formData.service_name[i];
      const desc = formData.service_desc?.[i] || "";
      if (name) lines.push(`- **${name}**: ${desc}`);
    }
    lines.push("");
  }

  // Team
  if (formData.team_name && Array.isArray(formData.team_name)) {
    lines.push(`## Team Members`);
    for (let i = 0; i < formData.team_name.length; i++) {
      const name = formData.team_name[i];
      const role = formData.team_role?.[i] || "";
      const bio = formData.team_bio?.[i] || "";
      if (name) lines.push(`- **${name}** — ${role}. ${bio}`);
    }
    lines.push("");
  }

  // Testimonials
  if (formData.testimonial_quote && Array.isArray(formData.testimonial_quote)) {
    lines.push(`## Testimonials`);
    for (let i = 0; i < formData.testimonial_quote.length; i++) {
      const quote = formData.testimonial_quote[i];
      const tName = formData.testimonial_name?.[i] || "";
      if (quote) lines.push(`- "${quote}" — ${tName}`);
    }
    lines.push("");
  }

  // Social links
  const socials = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "google"]
    .map((s) => ({ platform: s, url: formData[`social_${s}`] }))
    .filter((s) => s.url);
  if (socials.length > 0) {
    lines.push(`## Social Media Links`);
    for (const s of socials) {
      lines.push(`- ${s.platform}: ${s.url}`);
    }
    lines.push("");
  }

  // Booking link
  if (formData.booking_link) {
    lines.push(`## Booking: ${formData.booking_link}`);
    lines.push("");
  }

  // Features / post-build toggles
  const features: string[] = Array.isArray(formData.features) ? formData.features : [];
  if (features.length > 0) {
    lines.push(`## Required Features`);
    for (const f of features) {
      const instruction = FEATURE_INSTRUCTIONS[f] || `Enable ${f}`;
      lines.push(`- **${f}**: ${instruction}`);
    }
    lines.push("");
  }

  // Reference sites
  if (formData.reference_sites) {
    lines.push(`## Reference Sites for Inspiration: ${formData.reference_sites}`);
    lines.push("");
  }

  // Footer instruction
  lines.push(`## Important`);
  lines.push(`- Use PII placeholders: {{phone}}, {{email}}, {{address}}, {{name}} — real values will be injected after build.`);
  lines.push(`- Build a single self-contained HTML file with all CSS in <style> and all JS in <script>.`);
  lines.push(`- Make it fully responsive. Mobile-first design.`);
  lines.push(`- Use real stock photos from the image URLs provided in the system prompt.`);

  return lines.join("\n");
}
