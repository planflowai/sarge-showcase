/**
 * Pricing packages for the Project Kickoff page.
 * Change this config → the page updates. No hardcoded pricing.
 */

export interface PricingFeature {
  text: string;
  included: boolean;
}

export interface PricingPackage {
  id: string;
  name: string;
  tagline: string;
  priceMin: number;
  priceMax: number;
  features: PricingFeature[];
  buttonColor: string;
  iconSvg: string;
}

export const PACKAGES: PricingPackage[] = [
  {
    id: "essential",
    name: "Essential",
    tagline: "Get online fast with a polished, professional site",
    priceMin: 500,
    priceMax: 900,
    features: [
      { text: "Up to 3 pages", included: true },
      { text: "Mobile responsive", included: true },
      { text: "Contact form", included: true },
      { text: "SEO basics", included: true },
      { text: "1 round of revisions", included: true },
      { text: "Custom animations", included: false },
      { text: "CMS integration", included: false },
      { text: "E-commerce", included: false },
    ],
    buttonColor: "#14B8A6",
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M44 4L20 28"/><path d="M44 4L30 44L20 28L4 18L44 4Z"/></svg>`,
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "Full-featured site with room to grow",
    priceMin: 1200,
    priceMax: 2500,
    features: [
      { text: "Up to 7 pages", included: true },
      { text: "Mobile responsive", included: true },
      { text: "Contact form + booking", included: true },
      { text: "Full SEO optimization", included: true },
      { text: "2 rounds of revisions", included: true },
      { text: "Custom animations", included: true },
      { text: "CMS integration", included: true },
      { text: "E-commerce", included: false },
    ],
    buttonColor: "#8B5CF6",
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 24L24 34L44 24"/><path d="M4 32L24 42L44 32"/><path d="M4 16L24 26L44 16L24 6L4 16Z"/></svg>`,
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Enterprise-grade site — no limits, no compromises",
    priceMin: 3500,
    priceMax: 7000,
    features: [
      { text: "Unlimited pages", included: true },
      { text: "Mobile responsive", included: true },
      { text: "Advanced forms + integrations", included: true },
      { text: "Full SEO + analytics", included: true },
      { text: "3 rounds of revisions", included: true },
      { text: "Custom animations", included: true },
      { text: "CMS integration", included: true },
      { text: "E-commerce ready", included: true },
    ],
    buttonColor: "#EC4899",
    iconSvg: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44L4 18L12 6H36L44 18L24 44Z"/><path d="M4 18H44"/><path d="M24 44L18 18L12 6"/><path d="M24 44L30 18L36 6"/></svg>`,
  },
];

export const TRUST_ITEMS = [
  { icon: "✦", text: "100% Custom Design" },
  { icon: "✦", text: "4-Platform Deploy" },
  { icon: "✦", text: "Coming Soon Page in Minutes" },
  { icon: "✦", text: "Full Source Code Included" },
];
