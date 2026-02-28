"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@sarge/core";

/**
 * Component Library Store
 *
 * Stores reusable UI components built in the Builder.
 * Each component includes code, metadata, thumbnail, and the prompt that generated it.
 */

export type ComponentCategory =
  | "Navigation"
  | "Cards"
  | "Forms"
  | "Heroes"
  | "Footers"
  | "Modals"
  | "Tables"
  | "Charts"
  | "Buttons"
  | "Layouts"
  | "Custom";

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  "Navigation",
  "Cards",
  "Forms",
  "Heroes",
  "Footers",
  "Modals",
  "Tables",
  "Charts",
  "Buttons",
  "Layouts",
  "Custom",
];

export interface LibraryComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  tags: string[];
  description: string;
  code: string; // Full HTML/React code
  language: "html" | "react" | "vue" | "svelte" | "other";
  prompt: string; // The prompt that generated it
  thumbnail: string | null; // Base64 screenshot or null
  dateCreated: number;
  dateModified: number;
  timesUsed: number;
  isFavorite: boolean;
}

interface ComponentLibraryState {
  components: LibraryComponent[];
  hydrated: boolean;

  // CRUD operations
  addComponent: (component: Omit<LibraryComponent, "id" | "dateCreated" | "dateModified" | "timesUsed" | "isFavorite">) => string;
  updateComponent: (id: string, updates: Partial<Omit<LibraryComponent, "id" | "dateCreated">>) => void;
  deleteComponent: (id: string) => void;
  duplicateComponent: (id: string) => string | null;

  // Usage tracking
  incrementUsage: (id: string) => void;
  toggleFavorite: (id: string) => void;

  // Queries
  getComponent: (id: string) => LibraryComponent | undefined;
  getComponentsByCategory: (category: ComponentCategory) => LibraryComponent[];
  searchComponents: (query: string) => LibraryComponent[];
  getFavorites: () => LibraryComponent[];
  getMostUsed: (limit?: number) => LibraryComponent[];
  getRecent: (limit?: number) => LibraryComponent[];

  // Import/Export
  exportLibrary: () => string;
  exportComponent: (id: string) => string | null;
  importLibrary: (json: string) => { success: boolean; imported: number; errors: string[] };
  importComponent: (json: string) => { success: boolean; id?: string; error?: string };

  // Hydration
  hydrate: () => void;
}

// ── Built-in component snippets (always available) ──────────────────────────
const BUILT_IN_COMPONENTS: LibraryComponent[] = [
  {
    id: "builtin-hero-gradient",
    name: "Hero — Gradient",
    category: "Heroes",
    tags: ["hero", "landing", "gradient", "cta"],
    description: "Full-width hero section with gradient background, headline, subtitle, and CTA buttons",
    language: "html",
    code: `<section style="min-height:80vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:4rem 2rem;font-family:system-ui,sans-serif">\n  <div style="text-align:center;max-width:800px">\n    <h1 style="font-size:3.5rem;font-weight:800;color:#fff;margin:0 0 1rem">Build Something Amazing</h1>\n    <p style="font-size:1.25rem;color:rgba(255,255,255,.85);margin:0 0 2rem;line-height:1.7">Create beautiful, responsive websites with the power of AI. No coding required.</p>\n    <div style="display:flex;gap:1rem;justify-content:center">\n      <a href="#" style="padding:.875rem 2rem;background:#fff;color:#764ba2;border-radius:.5rem;text-decoration:none;font-weight:600;font-size:1rem">Get Started</a>\n      <a href="#" style="padding:.875rem 2rem;background:transparent;color:#fff;border:2px solid rgba(255,255,255,.5);border-radius:.5rem;text-decoration:none;font-weight:600;font-size:1rem">Learn More</a>\n    </div>\n  </div>\n</section>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-navbar-dark",
    name: "Navbar — Dark",
    category: "Navigation",
    tags: ["navbar", "header", "navigation", "dark"],
    description: "Sleek dark navigation bar with logo, links, and action button",
    language: "html",
    code: `<nav style="display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;background:#18181b;font-family:system-ui,sans-serif">\n  <a href="#" style="font-size:1.5rem;font-weight:700;color:#fff;text-decoration:none">Brand</a>\n  <div style="display:flex;gap:2rem;align-items:center">\n    <a href="#" style="color:#a1a1aa;text-decoration:none;font-size:.9rem;font-weight:500">Home</a>\n    <a href="#" style="color:#a1a1aa;text-decoration:none;font-size:.9rem;font-weight:500">Features</a>\n    <a href="#" style="color:#a1a1aa;text-decoration:none;font-size:.9rem;font-weight:500">Pricing</a>\n    <a href="#" style="color:#a1a1aa;text-decoration:none;font-size:.9rem;font-weight:500">About</a>\n    <a href="#" style="padding:.5rem 1.25rem;background:#6366f1;color:#fff;border-radius:.375rem;text-decoration:none;font-weight:600;font-size:.9rem">Sign Up</a>\n  </div>\n</nav>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-card-product",
    name: "Product Card",
    category: "Cards",
    tags: ["card", "product", "ecommerce", "shop"],
    description: "Product card with image placeholder, title, price, rating, and add-to-cart button",
    language: "html",
    code: `<div style="width:320px;border-radius:1rem;overflow:hidden;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08);font-family:system-ui,sans-serif">\n  <div style="height:200px;background:linear-gradient(135deg,#f0abfc,#818cf8);display:flex;align-items:center;justify-content:center;color:#fff;font-size:3rem">📷</div>\n  <div style="padding:1.5rem">\n    <p style="color:#6b7280;font-size:.8rem;margin:0 0 .25rem">Electronics</p>\n    <h3 style="margin:0 0 .5rem;font-size:1.1rem;font-weight:600;color:#111">Wireless Headphones Pro</h3>\n    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">\n      <span style="color:#f59e0b">★★★★☆</span>\n      <span style="color:#9ca3af;font-size:.8rem">(128)</span>\n    </div>\n    <div style="display:flex;align-items:center;justify-content:space-between">\n      <span style="font-size:1.5rem;font-weight:700;color:#111">$79.99</span>\n      <button style="padding:.625rem 1.5rem;background:#111;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Add to Cart</button>\n    </div>\n  </div>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-contact-form",
    name: "Contact Form",
    category: "Forms",
    tags: ["form", "contact", "input", "email"],
    description: "Clean contact form with name, email, message fields and submit button",
    language: "html",
    code: `<div style="max-width:500px;margin:2rem auto;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 2px 16px rgba(0,0,0,.06);font-family:system-ui,sans-serif">\n  <h2 style="margin:0 0 .5rem;font-size:1.5rem;font-weight:700;color:#111">Get in Touch</h2>\n  <p style="color:#6b7280;margin:0 0 1.5rem;font-size:.9rem">We'd love to hear from you. Send us a message!</p>\n  <form style="display:flex;flex-direction:column;gap:1rem">\n    <div style="display:flex;gap:1rem">\n      <input type="text" placeholder="First Name" style="flex:1;padding:.75rem 1rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;outline:none" />\n      <input type="text" placeholder="Last Name" style="flex:1;padding:.75rem 1rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;outline:none" />\n    </div>\n    <input type="email" placeholder="Email Address" style="padding:.75rem 1rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;outline:none" />\n    <textarea placeholder="Your message..." rows="4" style="padding:.75rem 1rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;outline:none;resize:vertical;font-family:inherit"></textarea>\n    <button type="submit" style="padding:.875rem;background:#6366f1;color:#fff;border:none;border-radius:.5rem;font-weight:600;font-size:1rem;cursor:pointer">Send Message</button>\n  </form>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-footer-columns",
    name: "Footer — 4 Column",
    category: "Footers",
    tags: ["footer", "links", "columns", "bottom"],
    description: "Four-column footer with link groups, brand section, and copyright",
    language: "html",
    code: `<footer style="background:#111827;padding:4rem 2rem 2rem;font-family:system-ui,sans-serif">\n  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:2rem">\n    <div>\n      <h3 style="color:#fff;font-size:1.25rem;font-weight:700;margin:0 0 1rem">Brand</h3>\n      <p style="color:#9ca3af;font-size:.85rem;line-height:1.6">Building the future of web development with AI-powered tools.</p>\n    </div>\n    <div>\n      <h4 style="color:#fff;font-size:.9rem;font-weight:600;margin:0 0 1rem">Product</h4>\n      <div style="display:flex;flex-direction:column;gap:.5rem"><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Features</a><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Pricing</a><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Changelog</a></div>\n    </div>\n    <div>\n      <h4 style="color:#fff;font-size:.9rem;font-weight:600;margin:0 0 1rem">Company</h4>\n      <div style="display:flex;flex-direction:column;gap:.5rem"><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">About</a><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Blog</a><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Careers</a></div>\n    </div>\n    <div>\n      <h4 style="color:#fff;font-size:.9rem;font-weight:600;margin:0 0 1rem">Support</h4>\n      <div style="display:flex;flex-direction:column;gap:.5rem"><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Help Center</a><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Contact</a><a href="#" style="color:#9ca3af;text-decoration:none;font-size:.85rem">Status</a></div>\n    </div>\n  </div>\n  <div style="max-width:1200px;margin:2rem auto 0;padding-top:2rem;border-top:1px solid #1f2937;text-align:center;color:#6b7280;font-size:.8rem">&copy; 2026 Brand. All rights reserved.</div>\n</footer>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-modal-confirm",
    name: "Confirm Modal",
    category: "Modals",
    tags: ["modal", "dialog", "confirm", "popup"],
    description: "Centered confirmation modal with backdrop, title, message, and action buttons",
    language: "html",
    code: `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);font-family:system-ui,sans-serif;z-index:50">\n  <div style="background:#fff;border-radius:1rem;padding:2rem;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.15)">\n    <div style="width:48px;height:48px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.5rem">⚠️</div>\n    <h2 style="text-align:center;margin:0 0 .5rem;font-size:1.25rem;font-weight:700;color:#111">Are you sure?</h2>\n    <p style="text-align:center;color:#6b7280;margin:0 0 1.5rem;font-size:.9rem;line-height:1.5">This action cannot be undone. All associated data will be permanently removed.</p>\n    <div style="display:flex;gap:.75rem">\n      <button style="flex:1;padding:.75rem;background:#f4f4f5;color:#333;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Cancel</button>\n      <button style="flex:1;padding:.75rem;background:#ef4444;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Delete</button>\n    </div>\n  </div>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-table-striped",
    name: "Data Table — Striped",
    category: "Tables",
    tags: ["table", "data", "striped", "list"],
    description: "Clean data table with striped rows, header styling, and status badges",
    language: "html",
    code: `<div style="max-width:800px;margin:2rem auto;border-radius:.75rem;overflow:hidden;border:1px solid #e5e7eb;font-family:system-ui,sans-serif">\n  <table style="width:100%;border-collapse:collapse">\n    <thead><tr style="background:#f9fafb">\n      <th style="text-align:left;padding:.875rem 1rem;font-size:.8rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Name</th>\n      <th style="text-align:left;padding:.875rem 1rem;font-size:.8rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Email</th>\n      <th style="text-align:left;padding:.875rem 1rem;font-size:.8rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Role</th>\n      <th style="text-align:left;padding:.875rem 1rem;font-size:.8rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Status</th>\n    </tr></thead>\n    <tbody>\n      <tr style="background:#fff"><td style="padding:.875rem 1rem;font-size:.9rem;color:#111;font-weight:500">Alice Johnson</td><td style="padding:.875rem 1rem;font-size:.9rem;color:#6b7280">alice@example.com</td><td style="padding:.875rem 1rem;font-size:.9rem;color:#6b7280">Admin</td><td style="padding:.875rem 1rem"><span style="padding:.25rem .75rem;background:#d1fae5;color:#065f46;border-radius:9999px;font-size:.8rem;font-weight:500">Active</span></td></tr>\n      <tr style="background:#f9fafb"><td style="padding:.875rem 1rem;font-size:.9rem;color:#111;font-weight:500">Bob Smith</td><td style="padding:.875rem 1rem;font-size:.9rem;color:#6b7280">bob@example.com</td><td style="padding:.875rem 1rem;font-size:.9rem;color:#6b7280">Editor</td><td style="padding:.875rem 1rem"><span style="padding:.25rem .75rem;background:#d1fae5;color:#065f46;border-radius:9999px;font-size:.8rem;font-weight:500">Active</span></td></tr>\n      <tr style="background:#fff"><td style="padding:.875rem 1rem;font-size:.9rem;color:#111;font-weight:500">Carol White</td><td style="padding:.875rem 1rem;font-size:.9rem;color:#6b7280">carol@example.com</td><td style="padding:.875rem 1rem;font-size:.9rem;color:#6b7280">Viewer</td><td style="padding:.875rem 1rem"><span style="padding:.25rem .75rem;background:#fef3c7;color:#92400e;border-radius:9999px;font-size:.8rem;font-weight:500">Pending</span></td></tr>\n    </tbody>\n  </table>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-pricing-table",
    name: "Pricing Table — 3 Tier",
    category: "Cards",
    tags: ["pricing", "plans", "tiers", "subscription"],
    description: "Three-tier pricing table with features list, popular badge, and CTA buttons",
    language: "html",
    code: `<div style="display:flex;gap:1.5rem;justify-content:center;padding:3rem 2rem;font-family:system-ui,sans-serif;background:#f9fafb">\n  <div style="width:320px;padding:2rem;background:#fff;border-radius:1rem;border:1px solid #e5e7eb">\n    <h3 style="margin:0 0 .25rem;font-size:1.1rem;font-weight:600;color:#111">Starter</h3>\n    <p style="color:#6b7280;font-size:.85rem;margin:0 0 1.5rem">Perfect for individuals</p>\n    <div style="margin-bottom:1.5rem"><span style="font-size:2.5rem;font-weight:800;color:#111">$9</span><span style="color:#6b7280;font-size:.9rem">/month</span></div>\n    <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:2rem;font-size:.9rem;color:#374151"><div>✓ 5 Projects</div><div>✓ Basic Analytics</div><div>✓ Email Support</div><div style="color:#d1d5db">✗ Custom Domains</div></div>\n    <button style="width:100%;padding:.75rem;background:#fff;color:#111;border:1px solid #d1d5db;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Choose Plan</button>\n  </div>\n  <div style="width:320px;padding:2rem;background:#111;border-radius:1rem;position:relative;transform:scale(1.05)">\n    <span style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#6366f1;color:#fff;padding:.25rem 1rem;border-radius:9999px;font-size:.75rem;font-weight:600">Most Popular</span>\n    <h3 style="margin:0 0 .25rem;font-size:1.1rem;font-weight:600;color:#fff">Pro</h3>\n    <p style="color:#9ca3af;font-size:.85rem;margin:0 0 1.5rem">For growing teams</p>\n    <div style="margin-bottom:1.5rem"><span style="font-size:2.5rem;font-weight:800;color:#fff">$29</span><span style="color:#9ca3af;font-size:.9rem">/month</span></div>\n    <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:2rem;font-size:.9rem;color:#d1d5db"><div>✓ Unlimited Projects</div><div>✓ Advanced Analytics</div><div>✓ Priority Support</div><div>✓ Custom Domains</div></div>\n    <button style="width:100%;padding:.75rem;background:#6366f1;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Choose Plan</button>\n  </div>\n  <div style="width:320px;padding:2rem;background:#fff;border-radius:1rem;border:1px solid #e5e7eb">\n    <h3 style="margin:0 0 .25rem;font-size:1.1rem;font-weight:600;color:#111">Enterprise</h3>\n    <p style="color:#6b7280;font-size:.85rem;margin:0 0 1.5rem">For large organizations</p>\n    <div style="margin-bottom:1.5rem"><span style="font-size:2.5rem;font-weight:800;color:#111">$99</span><span style="color:#6b7280;font-size:.9rem">/month</span></div>\n    <div style="display:flex;flex-direction:column;gap:.75rem;margin-bottom:2rem;font-size:.9rem;color:#374151"><div>✓ Everything in Pro</div><div>✓ SSO & SAML</div><div>✓ Dedicated Support</div><div>✓ SLA Guarantee</div></div>\n    <button style="width:100%;padding:.75rem;background:#fff;color:#111;border:1px solid #d1d5db;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Contact Sales</button>\n  </div>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-testimonial-cards",
    name: "Testimonial Cards",
    category: "Cards",
    tags: ["testimonials", "reviews", "quotes", "social-proof"],
    description: "Three testimonial cards with avatar, quote, name, and role",
    language: "html",
    code: `<div style="display:flex;gap:1.5rem;justify-content:center;padding:3rem 2rem;font-family:system-ui,sans-serif">\n  <div style="width:360px;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 2px 16px rgba(0,0,0,.06)">\n    <div style="color:#f59e0b;margin-bottom:1rem;font-size:1.2rem">★★★★★</div>\n    <p style="color:#374151;font-size:.95rem;line-height:1.6;margin:0 0 1.5rem">"This tool completely transformed our workflow. We shipped 3x faster and our code quality improved dramatically."</p>\n    <div style="display:flex;align-items:center;gap:.75rem"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#818cf8,#c084fc);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">SJ</div><div><div style="font-weight:600;color:#111;font-size:.9rem">Sarah Johnson</div><div style="color:#6b7280;font-size:.8rem">CTO, TechCorp</div></div></div>\n  </div>\n  <div style="width:360px;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 2px 16px rgba(0,0,0,.06)">\n    <div style="color:#f59e0b;margin-bottom:1rem;font-size:1.2rem">★★★★★</div>\n    <p style="color:#374151;font-size:.95rem;line-height:1.6;margin:0 0 1.5rem">"The AI-powered features are incredible. It's like having a senior developer pair programming with you 24/7."</p>\n    <div style="display:flex;align-items:center;gap:.75rem"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#34d399,#6ee7b7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">MC</div><div><div style="font-weight:600;color:#111;font-size:.9rem">Mike Chen</div><div style="color:#6b7280;font-size:.8rem">Lead Dev, StartupXYZ</div></div></div>\n  </div>\n  <div style="width:360px;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 2px 16px rgba(0,0,0,.06)">\n    <div style="color:#f59e0b;margin-bottom:1rem;font-size:1.2rem">★★★★☆</div>\n    <p style="color:#374151;font-size:.95rem;line-height:1.6;margin:0 0 1.5rem">"Best investment we made this year. The ROI was visible within the first week of using the platform."</p>\n    <div style="display:flex;align-items:center;gap:.75rem"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#fb923c,#fbbf24);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">LR</div><div><div style="font-weight:600;color:#111;font-size:.9rem">Lisa Rodriguez</div><div style="color:#6b7280;font-size:.8rem">PM, DesignStudio</div></div></div>\n  </div>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-buttons-set",
    name: "Button Collection",
    category: "Buttons",
    tags: ["buttons", "cta", "actions", "ui"],
    description: "A set of styled buttons: primary, secondary, outline, ghost, danger, and icon buttons",
    language: "html",
    code: `<div style="display:flex;flex-wrap:wrap;gap:1rem;padding:2rem;font-family:system-ui,sans-serif;align-items:center">\n  <button style="padding:.75rem 1.5rem;background:#6366f1;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Primary</button>\n  <button style="padding:.75rem 1.5rem;background:#27272a;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Secondary</button>\n  <button style="padding:.75rem 1.5rem;background:transparent;color:#6366f1;border:2px solid #6366f1;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Outline</button>\n  <button style="padding:.75rem 1.5rem;background:transparent;color:#6b7280;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Ghost</button>\n  <button style="padding:.75rem 1.5rem;background:#ef4444;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Danger</button>\n  <button style="padding:.75rem 1.5rem;background:#10b981;color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Success</button>\n  <button style="padding:.625rem;background:#f4f4f5;color:#333;border:none;border-radius:.5rem;cursor:pointer;font-size:1.2rem;line-height:1">❤️</button>\n  <button style="padding:.625rem;background:#f4f4f5;color:#333;border:none;border-radius:.5rem;cursor:pointer;font-size:1.2rem;line-height:1">⚙️</button>\n  <button style="padding:.75rem 1.5rem;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;border:none;border-radius:.5rem;font-weight:600;cursor:pointer;font-size:.9rem">Gradient</button>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-login-form",
    name: "Login Form",
    category: "Forms",
    tags: ["login", "auth", "signin", "form"],
    description: "Centered login form with email, password, remember me, and social login buttons",
    language: "html",
    code: `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;font-family:system-ui,sans-serif">\n  <div style="width:400px;padding:2.5rem;background:#fff;border-radius:1rem;box-shadow:0 4px 24px rgba(0,0,0,.06)">\n    <h2 style="margin:0 0 .25rem;font-size:1.5rem;font-weight:700;color:#111;text-align:center">Welcome back</h2>\n    <p style="color:#6b7280;text-align:center;margin:0 0 2rem;font-size:.9rem">Sign in to your account</p>\n    <form style="display:flex;flex-direction:column;gap:1rem">\n      <div><label style="display:block;font-size:.85rem;font-weight:500;color:#374151;margin-bottom:.25rem">Email</label><input type="email" placeholder="you@example.com" style="width:100%;padding:.75rem 1rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;outline:none;box-sizing:border-box" /></div>\n      <div><label style="display:block;font-size:.85rem;font-weight:500;color:#374151;margin-bottom:.25rem">Password</label><input type="password" placeholder="••••••••" style="width:100%;padding:.75rem 1rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.9rem;outline:none;box-sizing:border-box" /></div>\n      <div style="display:flex;justify-content:space-between;align-items:center"><label style="display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:#374151"><input type="checkbox" /> Remember me</label><a href="#" style="font-size:.85rem;color:#6366f1;text-decoration:none">Forgot password?</a></div>\n      <button type="submit" style="padding:.875rem;background:#6366f1;color:#fff;border:none;border-radius:.5rem;font-weight:600;font-size:1rem;cursor:pointer">Sign In</button>\n    </form>\n    <div style="text-align:center;margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid #e5e7eb"><p style="color:#6b7280;font-size:.85rem;margin:0">Don't have an account? <a href="#" style="color:#6366f1;text-decoration:none;font-weight:500">Sign up</a></p></div>\n  </div>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-features-grid",
    name: "Features Grid",
    category: "Layouts",
    tags: ["features", "grid", "icons", "benefits"],
    description: "3-column features grid with icons, titles, and descriptions",
    language: "html",
    code: `<section style="padding:4rem 2rem;font-family:system-ui,sans-serif;background:#fff">\n  <div style="text-align:center;max-width:600px;margin:0 auto 3rem"><h2 style="font-size:2rem;font-weight:800;color:#111;margin:0 0 .75rem">Everything you need</h2><p style="color:#6b7280;font-size:1rem;margin:0">Powerful features to help you build faster and ship with confidence.</p></div>\n  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;max-width:1000px;margin:0 auto">\n    <div style="padding:1.5rem;border-radius:1rem;background:#f9fafb"><div style="width:48px;height:48px;border-radius:.75rem;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem">⚡</div><h3 style="margin:0 0 .5rem;font-size:1.1rem;font-weight:600;color:#111">Lightning Fast</h3><p style="color:#6b7280;font-size:.9rem;margin:0;line-height:1.5">Optimized for speed. Every interaction feels instant.</p></div>\n    <div style="padding:1.5rem;border-radius:1rem;background:#f9fafb"><div style="width:48px;height:48px;border-radius:.75rem;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem">🔒</div><h3 style="margin:0 0 .5rem;font-size:1.1rem;font-weight:600;color:#111">Secure by Default</h3><p style="color:#6b7280;font-size:.9rem;margin:0;line-height:1.5">Enterprise-grade security built into every layer.</p></div>\n    <div style="padding:1.5rem;border-radius:1rem;background:#f9fafb"><div style="width:48px;height:48px;border-radius:.75rem;background:#d1fae5;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem">🤖</div><h3 style="margin:0 0 .5rem;font-size:1.1rem;font-weight:600;color:#111">AI Powered</h3><p style="color:#6b7280;font-size:.9rem;margin:0;line-height:1.5">Smart suggestions and automations that save hours.</p></div>\n    <div style="padding:1.5rem;border-radius:1rem;background:#f9fafb"><div style="width:48px;height:48px;border-radius:.75rem;background:#fef3c7;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem">📊</div><h3 style="margin:0 0 .5rem;font-size:1.1rem;font-weight:600;color:#111">Analytics</h3><p style="color:#6b7280;font-size:.9rem;margin:0;line-height:1.5">Real-time insights and detailed metrics dashboard.</p></div>\n    <div style="padding:1.5rem;border-radius:1rem;background:#f9fafb"><div style="width:48px;height:48px;border-radius:.75rem;background:#fce7f3;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem">🎨</div><h3 style="margin:0 0 .5rem;font-size:1.1rem;font-weight:600;color:#111">Customizable</h3><p style="color:#6b7280;font-size:.9rem;margin:0;line-height:1.5">Tailor every detail to match your brand perfectly.</p></div>\n    <div style="padding:1.5rem;border-radius:1rem;background:#f9fafb"><div style="width:48px;height:48px;border-radius:.75rem;background:#e0e7ff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem">🔗</div><h3 style="margin:0 0 .5rem;font-size:1.1rem;font-weight:600;color:#111">Integrations</h3><p style="color:#6b7280;font-size:.9rem;margin:0;line-height:1.5">Connect with 100+ tools and services seamlessly.</p></div>\n  </div>\n</section>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-stats-banner",
    name: "Stats Banner",
    category: "Layouts",
    tags: ["stats", "numbers", "metrics", "banner"],
    description: "Horizontal stats banner with four key metrics and labels",
    language: "html",
    code: `<div style="background:#18181b;padding:3rem 2rem;font-family:system-ui,sans-serif">\n  <div style="max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:2rem;text-align:center">\n    <div><div style="font-size:2.5rem;font-weight:800;color:#fff;margin-bottom:.25rem">10K+</div><div style="font-size:.9rem;color:#a1a1aa">Active Users</div></div>\n    <div><div style="font-size:2.5rem;font-weight:800;color:#fff;margin-bottom:.25rem">99.9%</div><div style="font-size:.9rem;color:#a1a1aa">Uptime</div></div>\n    <div><div style="font-size:2.5rem;font-weight:800;color:#fff;margin-bottom:.25rem">50M+</div><div style="font-size:.9rem;color:#a1a1aa">API Calls / Day</div></div>\n    <div><div style="font-size:2.5rem;font-weight:800;color:#fff;margin-bottom:.25rem">4.9/5</div><div style="font-size:.9rem;color:#a1a1aa">Customer Rating</div></div>\n  </div>\n</div>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-cta-split",
    name: "CTA — Split Section",
    category: "Heroes",
    tags: ["cta", "split", "two-column", "call-to-action"],
    description: "Two-column CTA section with text on left and action card on right",
    language: "html",
    code: `<section style="display:flex;align-items:center;gap:4rem;padding:4rem 3rem;max-width:1100px;margin:0 auto;font-family:system-ui,sans-serif">\n  <div style="flex:1">\n    <h2 style="font-size:2.25rem;font-weight:800;color:#111;margin:0 0 1rem;line-height:1.2">Ready to get started?</h2>\n    <p style="font-size:1.1rem;color:#6b7280;margin:0 0 2rem;line-height:1.6">Join thousands of teams already using our platform to build better products, faster.</p>\n    <div style="display:flex;gap:1rem">\n      <a href="#" style="padding:.875rem 2rem;background:#6366f1;color:#fff;border-radius:.5rem;text-decoration:none;font-weight:600">Start Free Trial</a>\n      <a href="#" style="padding:.875rem 2rem;background:#f4f4f5;color:#333;border-radius:.5rem;text-decoration:none;font-weight:600">Talk to Sales</a>\n    </div>\n  </div>\n  <div style="flex:1;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:1.5rem;padding:3rem;text-align:center">\n    <div style="font-size:3rem;margin-bottom:1rem">🚀</div>\n    <h3 style="color:#fff;font-size:1.5rem;font-weight:700;margin:0 0 .5rem">14-day free trial</h3>\n    <p style="color:rgba(255,255,255,.8);font-size:1rem;margin:0">No credit card required</p>\n  </div>\n</section>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
  {
    id: "builtin-faq-accordion",
    name: "FAQ Section",
    category: "Layouts",
    tags: ["faq", "accordion", "questions", "help"],
    description: "FAQ section with expandable questions and answers (uses HTML details/summary)",
    language: "html",
    code: `<section style="max-width:700px;margin:3rem auto;padding:2rem;font-family:system-ui,sans-serif">\n  <h2 style="text-align:center;font-size:2rem;font-weight:800;color:#111;margin:0 0 .5rem">Frequently Asked Questions</h2>\n  <p style="text-align:center;color:#6b7280;margin:0 0 2.5rem">Everything you need to know about the product.</p>\n  <div style="display:flex;flex-direction:column;gap:.75rem">\n    <details style="border:1px solid #e5e7eb;border-radius:.75rem;overflow:hidden"><summary style="padding:1.25rem;font-weight:600;color:#111;cursor:pointer;font-size:1rem;list-style:none">What is AI Builder?</summary><div style="padding:0 1.25rem 1.25rem;color:#6b7280;font-size:.9rem;line-height:1.6">AI Builder is a free, model-agnostic tool that replaces Pinegrow, Claude.ai artifacts, and Claude Code with one unified interface. Build websites with local AI models at zero cost.</div></details>\n    <details style="border:1px solid #e5e7eb;border-radius:.75rem;overflow:hidden"><summary style="padding:1.25rem;font-weight:600;color:#111;cursor:pointer;font-size:1rem;list-style:none">Is it really free?</summary><div style="padding:0 1.25rem 1.25rem;color:#6b7280;font-size:.9rem;line-height:1.6">Yes! When using local models via Ollama, everything runs on your machine at zero cost. You can optionally use cloud models for complex tasks, which have their own API costs.</div></details>\n    <details style="border:1px solid #e5e7eb;border-radius:.75rem;overflow:hidden"><summary style="padding:1.25rem;font-weight:600;color:#111;cursor:pointer;font-size:1rem;list-style:none">What models are supported?</summary><div style="padding:0 1.25rem 1.25rem;color:#6b7280;font-size:.9rem;line-height:1.6">All major providers: Ollama (local), Claude, GPT, Gemini, Grok, DeepSeek, and more. Any OpenAI-compatible API works.</div></details>\n    <details style="border:1px solid #e5e7eb;border-radius:.75rem;overflow:hidden"><summary style="padding:1.25rem;font-weight:600;color:#111;cursor:pointer;font-size:1rem;list-style:none">Can I use it for React and Next.js projects?</summary><div style="padding:0 1.25rem 1.25rem;color:#6b7280;font-size:.9rem;line-height:1.6">Absolutely. AI Builder supports HTML, React, Vue, Svelte, and any web technology. It can edit real project files with your dev server hot-reloading in real time.</div></details>\n  </div>\n</section>`,
    prompt: "",
    thumbnail: null,
    dateCreated: 0,
    dateModified: 0,
    timesUsed: 0,
    isFavorite: false,
  },
];

export const useComponentLibraryStore = create<ComponentLibraryState>()(
  persist(
    (set, get) => ({
      components: [],
      hydrated: false,

      hydrate: () => {
        // Merge built-in components with user's saved components
        const existing = get().components;
        const builtInIds = new Set(BUILT_IN_COMPONENTS.map((c) => c.id));
        const userComponents = existing.filter((c) => !builtInIds.has(c.id));
        set({ components: [...BUILT_IN_COMPONENTS, ...userComponents], hydrated: true });
      },

      addComponent: (componentData) => {
        const id = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        const newComponent: LibraryComponent = {
          ...componentData,
          id,
          dateCreated: now,
          dateModified: now,
          timesUsed: 0,
          isFavorite: false,
        };

        set({ components: [...get().components, newComponent] });
        return id;
      },

      updateComponent: (id, updates) => {
        set({
          components: get().components.map((c) =>
            c.id === id
              ? { ...c, ...updates, dateModified: Date.now() }
              : c
          ),
        });
      },

      deleteComponent: (id) => {
        set({ components: get().components.filter((c) => c.id !== id) });
      },

      duplicateComponent: (id) => {
        const original = get().components.find((c) => c.id === id);
        if (!original) return null;

        const newId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        const duplicate: LibraryComponent = {
          ...original,
          id: newId,
          name: `${original.name} (Copy)`,
          dateCreated: now,
          dateModified: now,
          timesUsed: 0,
          isFavorite: false,
        };

        set({ components: [...get().components, duplicate] });
        return newId;
      },

      incrementUsage: (id) => {
        set({
          components: get().components.map((c) =>
            c.id === id
              ? { ...c, timesUsed: c.timesUsed + 1, dateModified: Date.now() }
              : c
          ),
        });
      },

      toggleFavorite: (id) => {
        set({
          components: get().components.map((c) =>
            c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
          ),
        });
      },

      getComponent: (id) => {
        return get().components.find((c) => c.id === id);
      },

      getComponentsByCategory: (category) => {
        return get().components.filter((c) => c.category === category);
      },

      searchComponents: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().components.filter(
          (c) =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.description.toLowerCase().includes(lowerQuery) ||
            c.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
            c.category.toLowerCase().includes(lowerQuery)
        );
      },

      getFavorites: () => {
        return get().components.filter((c) => c.isFavorite);
      },

      getMostUsed: (limit = 10) => {
        return [...get().components]
          .sort((a, b) => b.timesUsed - a.timesUsed)
          .slice(0, limit);
      },

      getRecent: (limit = 10) => {
        return [...get().components]
          .sort((a, b) => b.dateModified - a.dateModified)
          .slice(0, limit);
      },

      exportLibrary: () => {
        const components = get().components;
        return JSON.stringify(
          {
            version: 1,
            exportDate: new Date().toISOString(),
            componentCount: components.length,
            components,
          },
          null,
          2
        );
      },

      exportComponent: (id) => {
        const component = get().components.find((c) => c.id === id);
        if (!component) return null;

        return JSON.stringify(
          {
            version: 1,
            exportDate: new Date().toISOString(),
            component,
          },
          null,
          2
        );
      },

      importLibrary: (json) => {
        const errors: string[] = [];
        let imported = 0;

        try {
          const data = JSON.parse(json);

          if (!data.components || !Array.isArray(data.components)) {
            return { success: false, imported: 0, errors: ["Invalid library format"] };
          }

          const newComponents: LibraryComponent[] = [];
          const existingIds = new Set(get().components.map((c) => c.id));

          for (const comp of data.components) {
            if (!comp.id || !comp.name || !comp.code) {
              errors.push(`Skipped invalid component: ${comp.name || "unnamed"}`);
              continue;
            }

            // Generate new ID if it already exists
            let newId = comp.id;
            if (existingIds.has(newId)) {
              newId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            }

            newComponents.push({
              ...comp,
              id: newId,
              dateModified: Date.now(),
            });
            imported++;
          }

          set({ components: [...get().components, ...newComponents] });
          return { success: true, imported, errors };
        } catch (e) {
          return { success: false, imported: 0, errors: ["Failed to parse JSON"] };
        }
      },

      importComponent: (json) => {
        try {
          const data = JSON.parse(json);
          const comp = data.component;

          if (!comp || !comp.name || !comp.code) {
            return { success: false, error: "Invalid component format" };
          }

          // Generate new ID
          const newId = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const newComponent: LibraryComponent = {
            ...comp,
            id: newId,
            dateCreated: Date.now(),
            dateModified: Date.now(),
            timesUsed: 0,
            isFavorite: false,
          };

          set({ components: [...get().components, newComponent] });
          return { success: true, id: newId };
        } catch (e) {
          return { success: false, error: "Failed to parse JSON" };
        }
      },
    }),
    {
      name: "component-library",
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        components: state.components,
      }),
    }
  )
);

// Helper to capture thumbnail from iframe
export async function captureIframeThumbnail(
  iframe: HTMLIFrameElement,
  maxWidth = 300,
  maxHeight = 200
): Promise<string | null> {
  try {
    // Use html2canvas if available, otherwise return null
    // This is a placeholder - actual implementation would need html2canvas
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    // For now, create a simple gradient placeholder
    // In production, you'd use html2canvas or similar
    const gradient = ctx.createLinearGradient(0, 0, maxWidth, maxHeight);
    gradient.addColorStop(0, "#6366f1");
    gradient.addColorStop(1, "#8b5cf6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, maxWidth, maxHeight);

    return canvas.toDataURL("image/png", 0.8);
  } catch (e) {
    console.error("Failed to capture thumbnail:", e);
    return null;
  }
}

// Helper to detect language from code
export function detectCodeLanguage(code: string): LibraryComponent["language"] {
  const trimmed = code.trim();

  // Check for React patterns
  if (
    trimmed.includes("import React") ||
    trimmed.includes("from 'react'") ||
    trimmed.includes('from "react"') ||
    trimmed.includes("useState") ||
    trimmed.includes("useEffect") ||
    /export\s+(default\s+)?function\s+\w+/.test(trimmed) ||
    /const\s+\w+\s*=\s*\(\)\s*=>\s*\{/.test(trimmed)
  ) {
    return "react";
  }

  // Check for Vue patterns
  if (
    trimmed.includes("<template>") ||
    trimmed.includes("<script setup>") ||
    trimmed.includes("defineComponent")
  ) {
    return "vue";
  }

  // Check for Svelte patterns
  if (
    trimmed.includes("<script>") &&
    (trimmed.includes("$:") || trimmed.includes("on:click"))
  ) {
    return "svelte";
  }

  // Check for HTML
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    (trimmed.includes("<body") && trimmed.includes("</body>")) ||
    (trimmed.includes("<div") && !trimmed.includes("import"))
  ) {
    return "html";
  }

  return "other";
}
