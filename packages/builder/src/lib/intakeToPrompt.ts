/**
 * Intake-to-Prompt Template Assembly
 *
 * Takes the intake form JSON and assembles a complete builder prompt.
 * Handles both flat intake data AND step-based (step1_about, step2_vision, etc.) structures.
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
  technology: "modern, sleek, gradient accents, dark mode friendly, monospace details",
  bookkeeping: "organized, trustworthy, clean tables/charts, professional greens/blues",
  other: "modern, professional, clean layout, accessible",
};

const PAGE_REQUIREMENTS: Record<string, string> = {
  home: "Hero section with headline + CTA, value propositions, featured services preview, testimonial highlight, contact CTA",
  about: "Company story, mission/values, team section with photos and bios, timeline or milestones",
  services: "Service cards with descriptions and pricing hints, individual service detail expandable sections",
  contact: "Contact form (name, email, phone, message), business hours, address with map placeholder, phone/email links",
  gallery: "Masonry or grid photo gallery with lightbox modal on click, category filter buttons, lazy loading images, keyboard accessible",
  testimonials: "Client testimonials in cards with quotes, names, businesses, optional star ratings, responsive card grid or carousel",
  faq: "Accordion-style FAQ with smooth expand/collapse, one open at a time, aria-expanded attributes, keyboard navigable",
  blog: "Blog listing with cards (title, excerpt, date, category), individual post template",
  pricing: "Interactive pricing page with 3 tier cards, feature comparison table, FAQ accordion below, CTA buttons per tier",
  booking: "Scheduling/booking section with Calendly embed placeholder, intro text, contact info sidebar, responsive",
  shop: "Product grid with cards (image, name, price), add-to-cart buttons, category sidebar",
  showroom: "Project card grid with filter by category, each card has image, title, description, tags, View button, responsive masonry layout",
  "how-it-works": "Step-by-step timeline (vertical mobile, horizontal desktop), numbered steps with icons, title + description per step",
  portfolio: "Project showcase grid with filter buttons, each card has screenshot, title, description, tags, live link",
};

const FEATURE_INSTRUCTIONS: Record<string, string> = {
  seo: "Add proper meta tags (title, description, og:image), semantic HTML5 elements, structured data (JSON-LD for LocalBusiness)",
  accessibility: "WCAG 2.1 AA compliance: proper alt text, ARIA labels, keyboard navigation, color contrast ratios, skip-nav link",
  security: "HTTPS-ready, CSP meta tag, no inline event handlers where possible, sanitized form inputs",
  analytics: "Add Google Analytics 4 placeholder script with {{GA_MEASUREMENT_ID}} tag",
  privacy_policy: "Add a Privacy Policy page link in footer with standard privacy policy template text",
  newsletter: "Add email newsletter signup form in footer or hero section with {{NEWSLETTER_ENDPOINT}} placeholder",
  live_chat: "Add a floating chat widget button in bottom-right corner with {{CHAT_WIDGET_SCRIPT}} placeholder",
  chat: "Add a floating chat widget button in bottom-right corner with {{CHAT_WIDGET_SCRIPT}} placeholder",
  maintenance: "Include a maintenance mode banner template (hidden by default) with toggle via URL param ?maintenance=true",
};

/**
 * Flatten step-based intake data into a single flat object.
 * Handles both flat data (from simple forms) and step-based data
 * (step1_about, step2_vision, step3_content, etc. from multi-step forms).
 */
function flattenIntake(formData: any): any {
  // Unwrap nested form_data if present
  const fd = formData.form_data && typeof formData.form_data === "object"
    ? formData.form_data
    : formData;

  // Check if this is step-based data
  const hasSteps = fd.step1_about || fd.step2_vision || fd.step3_content ||
    fd.step4_structure || fd.step5_design || fd.step6_contact ||
    fd.step7_features || fd.step8_budget;

  if (!hasSteps) return fd; // Already flat

  // Merge all steps into flat object, top-level fd overrides (for any direct fields)
  return {
    ...(fd.step1_about || {}),
    ...(fd.step2_vision || {}),
    ...(fd.step3_content || {}),
    ...(fd.step4_structure || {}),
    ...(fd.step5_design || {}),
    ...(fd.step6_contact || {}),
    ...(fd.step7_features || {}),
    ...(fd.step8_budget || {}),
    ...fd, // top-level overrides (ref_code, etc.)
  };
}

export function intakeToPrompt(formData: any): string {
  const flat = flattenIntake(formData);
  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────
  lines.push(`Build a complete, production-ready website for the following business:\n`);

  // ── Business Info (PII placeholders) ───────────────────────
  lines.push(`## Business Information`);
  lines.push(`- **Business Name**: {{BUSINESS_NAME}}`);
  lines.push(`- **Industry**: ${flat.industry || "General"}`);
  lines.push(`- **Location**: {{address}}, {{city}}, {{state}}`);
  lines.push(`- **Phone**: {{phone}}`);
  lines.push(`- **Email**: {{email}}`);
  if (flat.hours) lines.push(`- **Hours**: ${flat.hours}`);
  if (flat.service_area) lines.push(`- **Service Area**: ${flat.service_area}`);
  if (flat.domain) lines.push(`- **Domain**: ${flat.domain}`);
  lines.push("");

  // ── Business Description ───────────────────────────────────
  const description = flat.description || flat.business_description;
  if (description) {
    lines.push(`## About the Business`);
    lines.push(description);
    lines.push("");
  }

  // ── USP ────────────────────────────────────────────────────
  const usp = flat.unique_selling_point || flat.usp;
  if (usp) {
    lines.push(`## Unique Selling Proposition`);
    lines.push(usp);
    lines.push("");
  }

  // ── Target Audience ────────────────────────────────────────
  if (flat.target_audience) {
    lines.push(`## Target Audience`);
    lines.push(flat.target_audience);
    lines.push("");
  }

  // ── Design Direction ───────────────────────────────────────
  const industryKey = (flat.industry || "other").toLowerCase();
  const styleKeywords = INDUSTRY_STYLES[industryKey] || INDUSTRY_STYLES.other;
  lines.push(`## Design Direction`);
  lines.push(`- **Industry style**: ${styleKeywords}`);

  const vibe = flat.style_vibe || flat.style_preference;
  if (vibe) {
    lines.push(`- **Vibe**: ${Array.isArray(vibe) ? vibe.join(", ") : vibe}`);
  }

  // Colors — flat fields OR nested colors object
  const colorPrimary = flat.color_primary || flat.colors?.primary;
  const colorSecondary = flat.color_secondary || flat.colors?.secondary;
  const colorAccent = flat.color_accent || flat.colors?.accent;
  if (colorPrimary) lines.push(`- **Primary color**: ${colorPrimary}`);
  if (colorSecondary) lines.push(`- **Secondary color**: ${colorSecondary}`);
  if (colorAccent) lines.push(`- **Accent color**: ${colorAccent}`);

  if (flat.theme) {
    const theme = Array.isArray(flat.theme) ? flat.theme[0] : flat.theme;
    lines.push(`- **Theme**: ${theme}`);
  }
  if (flat.design_notes) lines.push(`- **Design notes**: ${flat.design_notes}`);
  lines.push("");

  // ── Primary CTA ────────────────────────────────────────────
  const cta = flat.primary_cta || flat.cta;
  if (cta) {
    lines.push(`## Primary Call-to-Action: ${Array.isArray(cta) ? cta.join(", ") : cta}`);
    lines.push("");
  }

  // ── Pages to Build ─────────────────────────────────────────
  const pages: string[] = Array.isArray(flat.pages) ? flat.pages : ["Home"];
  lines.push(`## Pages to Build`);
  lines.push(`Build ALL ${pages.length} pages as sections in a single-page app:\n`);
  for (const page of pages) {
    const pageKey = page.toLowerCase().replace(/\s+/g, "-");
    const req = PAGE_REQUIREMENTS[pageKey] || `Standard ${page} page layout`;
    lines.push(`### ${page.charAt(0).toUpperCase() + page.slice(1)}`);
    lines.push(req);
    lines.push("");
  }
  if (flat.custom_pages) {
    lines.push(`### Custom Pages: ${flat.custom_pages}`);
    lines.push("");
  }

  // ── About Text ─────────────────────────────────────────────
  if (flat.about_text) {
    lines.push(`## About Page Content`);
    lines.push(flat.about_text);
    lines.push("");
  }

  // ── Services ───────────────────────────────────────────────
  if (flat.service_name && Array.isArray(flat.service_name)) {
    lines.push(`## Services`);
    for (let i = 0; i < flat.service_name.length; i++) {
      const name = flat.service_name[i];
      const desc = flat.service_desc?.[i] || "";
      if (name) lines.push(`- **${name}**: ${desc}`);
    }
    lines.push("");
  } else if (flat.services && Array.isArray(flat.services)) {
    lines.push(`## Services`);
    for (const svc of flat.services) {
      lines.push(`- **${svc}**`);
    }
    lines.push("");
  }

  // ── Team Members ───────────────────────────────────────────
  if (flat.team_name && Array.isArray(flat.team_name)) {
    lines.push(`## Team Members`);
    for (let i = 0; i < flat.team_name.length; i++) {
      const name = flat.team_name[i];
      const role = flat.team_role?.[i] || "";
      const bio = flat.team_bio?.[i] || "";
      if (name) lines.push(`- **${name}** — ${role}. ${bio}`);
    }
    lines.push("");
  } else if (flat.team_members && Array.isArray(flat.team_members)) {
    lines.push(`## Team Members`);
    for (const member of flat.team_members) {
      const name = member.name || "";
      const role = member.role || "";
      const bio = member.bio || "";
      if (name) lines.push(`- **${name}** — ${role}. ${bio}`);
    }
    lines.push("");
  }

  // ── Testimonials ───────────────────────────────────────────
  if (flat.testimonial_quote && Array.isArray(flat.testimonial_quote)) {
    lines.push(`## Testimonials`);
    for (let i = 0; i < flat.testimonial_quote.length; i++) {
      const quote = flat.testimonial_quote[i];
      const tName = flat.testimonial_name?.[i] || "";
      if (quote) lines.push(`- "${quote}" — ${tName}`);
    }
    lines.push("");
  } else if (flat.testimonials && Array.isArray(flat.testimonials)) {
    lines.push(`## Testimonials`);
    for (const t of flat.testimonials) {
      const quote = t.quote || "";
      const name = t.name || "";
      const biz = t.business || "";
      if (quote) lines.push(`- "${quote}" — ${name}${biz ? `, ${biz}` : ""}`);
    }
    lines.push("");
  }

  // ── Social Links ───────────────────────────────────────────
  // Check both flat social_* fields and nested social_media object
  const socialMedia = flat.social_media || {};
  const socials = ["facebook", "instagram", "linkedin", "youtube", "tiktok", "google_business"]
    .map((s) => ({
      platform: s.replace("_business", ""),
      url: flat[`social_${s}`] || socialMedia[s] || "",
    }))
    .filter((s) => s.url);
  if (socials.length > 0) {
    lines.push(`## Social Media Links`);
    for (const s of socials) {
      lines.push(`- ${s.platform}: ${s.url}`);
    }
    lines.push("");
  }

  // ── Scheduling / Booking ───────────────────────────────────
  const bookingLink = flat.booking_link || flat.scheduling_link;
  if (bookingLink) {
    lines.push(`## Booking / Scheduling: ${bookingLink}`);
    lines.push("");
  }

  // ── Features ───────────────────────────────────────────────
  // Accept either string array OR object with boolean values
  let features: string[] = [];
  if (Array.isArray(flat.features)) {
    features = flat.features;
  } else if (typeof flat.seo !== "undefined" || typeof flat.accessibility !== "undefined") {
    // step7_features is an object like { seo: true, accessibility: true, ... }
    for (const [key, val] of Object.entries(flat)) {
      if (val === true && FEATURE_INSTRUCTIONS[key]) {
        features.push(key);
      }
    }
  }
  if (features.length > 0) {
    lines.push(`## Required Features`);
    for (const f of features) {
      const fKey = f.toLowerCase().replace(/\s+/g, "_");
      const instruction = FEATURE_INSTRUCTIONS[fKey] || `Enable ${f}`;
      lines.push(`- **${f}**: ${instruction}`);
    }
    lines.push("");
  }

  // ── Competitors / Reference Sites ──────────────────────────
  const rawRefs = flat.reference_sites;
  const refs = (Array.isArray(rawRefs) && rawRefs.length > 0) ? rawRefs : flat.competitors;
  if (refs) {
    const refList = Array.isArray(refs) ? refs.filter(Boolean).join(", ") : refs;
    if (refList) {
      lines.push(`## Reference Sites for Inspiration: ${refList}`);
      lines.push("");
    }
  }

  // ── Budget & Timeline ──────────────────────────────────────
  if (flat.budget_range || flat.timeline) {
    lines.push(`## Project Scope`);
    if (flat.budget_range) lines.push(`- **Budget tier**: ${flat.budget_range}`);
    if (flat.timeline) lines.push(`- **Timeline**: ${flat.timeline}`);
    lines.push("");
  }

  // ── Additional Notes ───────────────────────────────────────
  if (flat.additional_notes) {
    lines.push(`## Additional Build Notes`);
    lines.push(flat.additional_notes);
    lines.push("");
  }

  // ── PII Placeholder Rules (NON-NEGOTIABLE) ────────────────
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

  // ── Build Requirements ─────────────────────────────────────
  lines.push(`## Build Requirements`);
  lines.push(`- Build a single self-contained HTML file with all CSS in <style> and all JS in <script>.`);
  lines.push(`- Make it fully responsive. Mobile-first design.`);
  lines.push(`- Use real stock photos from Unsplash or placeholder images.`);
  lines.push(`- All navigation must use JavaScript show/hide sections (SPA pattern), NOT separate files.`);

  return lines.join("\n");
}

/** Export the flattener for use in the multi-page build pipeline */
export { flattenIntake };

/** Page difficulty tiers for the auto-router */
export const PAGE_DIFFICULTY: Record<string, "easy" | "medium" | "hard"> = {
  about: "easy",
  contact: "easy",
  faq: "easy",
  testimonials: "easy",
  services: "medium",
  gallery: "medium",
  "how-it-works": "medium",
  blog: "medium",
  booking: "medium",
  home: "hard",
  pricing: "hard",
  showroom: "hard",
  portfolio: "hard",
};

/**
 * Generate a per-page prompt for the multi-page build pipeline.
 * Each page gets only the data it needs, plus shared context.
 */
export function intakeToPagePrompt(
  formData: any,
  pageName: string,
  sharedCss?: string,
  navSnippet?: string,
): string {
  const flat = flattenIntake(formData);
  const pageKey = pageName.toLowerCase().replace(/\s+/g, "-");
  const lines: string[] = [];

  lines.push(`Build the **${pageName}** page for {{BUSINESS_NAME}} (${flat.industry || "General"} industry).`);
  lines.push("");

  // Page-specific requirements
  const req = PAGE_REQUIREMENTS[pageKey] || `Standard ${pageName} page layout`;
  lines.push(`## Page Requirements`);
  lines.push(req);
  lines.push("");

  // Inject page-specific content
  if (pageKey === "home") {
    lines.push(`## Hero Section`);
    const cta = flat.primary_cta || flat.cta || "Get Started";
    lines.push(`- Primary CTA: "${cta}"`);
    if (flat.unique_selling_point || flat.usp) lines.push(`- USP: ${flat.unique_selling_point || flat.usp}`);
    if (flat.target_audience) lines.push(`- Target audience: ${flat.target_audience}`);
    lines.push("");
  }

  if (pageKey === "about" && flat.about_text) {
    lines.push(`## About Content`);
    lines.push(flat.about_text);
    lines.push("");
  }

  if (pageKey === "about" || pageKey === "home") {
    const members = flat.team_members || [];
    if (Array.isArray(members) && members.length > 0) {
      lines.push(`## Team Members`);
      for (const m of members) lines.push(`- **${m.name}** — ${m.role}. ${m.bio || ""}`);
      lines.push("");
    }
  }

  if ((pageKey === "services" || pageKey === "home") && flat.services && Array.isArray(flat.services)) {
    lines.push(`## Services to Feature`);
    for (const svc of flat.services) lines.push(`- **${svc}**`);
    lines.push("");
  }

  if ((pageKey === "testimonials" || pageKey === "home") && flat.testimonials && Array.isArray(flat.testimonials)) {
    lines.push(`## Testimonials`);
    for (const t of flat.testimonials) {
      lines.push(`- "${t.quote}" — ${t.name}${t.business ? `, ${t.business}` : ""}`);
    }
    lines.push("");
  }

  if (pageKey === "contact") {
    lines.push(`## Contact Information`);
    lines.push(`- Phone: {{phone}}`);
    lines.push(`- Email: {{email}}`);
    lines.push(`- Address: {{address}}, {{city}}, {{state}}`);
    if (flat.hours) lines.push(`- Hours: ${flat.hours}`);
    if (flat.service_area) lines.push(`- Service area: ${flat.service_area}`);
    if (flat.scheduling_link) lines.push(`- Calendly embed: ${flat.scheduling_link}`);
    lines.push("");
  }

  // Design context (always included)
  lines.push(`## Design`);
  const colorPrimary = flat.color_primary || flat.colors?.primary;
  const colorSecondary = flat.color_secondary || flat.colors?.secondary;
  const colorAccent = flat.color_accent || flat.colors?.accent;
  if (colorPrimary) lines.push(`- Primary: ${colorPrimary}`);
  if (colorSecondary) lines.push(`- Secondary: ${colorSecondary}`);
  if (colorAccent) lines.push(`- Accent: ${colorAccent}`);
  if (flat.theme) lines.push(`- Theme: ${flat.theme}`);
  const vibe = flat.style_vibe || flat.style_preference;
  if (vibe) lines.push(`- Style: ${vibe}`);
  if (flat.design_notes) lines.push(`- Notes: ${flat.design_notes}`);
  lines.push("");

  // Shared CSS context
  if (sharedCss) {
    lines.push(`## Shared CSS (use these variables)`);
    lines.push("```css");
    lines.push(sharedCss);
    lines.push("```");
    lines.push("");
  }

  // Nav snippet
  if (navSnippet) {
    lines.push(`## Navigation (use this exact nav)`);
    lines.push("```html");
    lines.push(navSnippet);
    lines.push("```");
    lines.push("");
  }

  // PII rules (compact)
  lines.push(`## PII Rules (NON-NEGOTIABLE)`);
  lines.push(`Use: {{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{client_name}}`);
  lines.push(`NEVER hardcode real client data.`);
  lines.push("");

  // Build rules
  lines.push(`## Build Rules`);
  lines.push(`- Single self-contained HTML file with all CSS in <style> and all JS in <script>.`);
  lines.push(`- Fully responsive, mobile-first.`);
  lines.push(`- Use Unsplash stock photos or placeholder images.`);

  return lines.join("\n");
}
