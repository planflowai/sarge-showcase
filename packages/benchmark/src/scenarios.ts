/**
 * Forge Trials — Benchmark Scenarios
 * 8 rounds of escalating difficulty for HTML/CSS/JS builder capability testing.
 * Each model gets the IDENTICAL prompt. Zero per-model tuning.
 */

import type { BenchmarkScenario } from "./runner";

const SYSTEM_PROMPT = `You are a code builder assistant.

RULES:
- ALWAYS generate single, self-contained HTML files.
- HTML must include ALL CSS in <style> tags and ALL JavaScript in <script> tags.
- NEVER reference external files like ./main.js or ./style.css.
- When modifying existing code, output the COMPLETE updated file.
- Start with a brief explanation (1-3 sentences) of what you built or changed.
- Then provide the code in a single code block.
- Be concise. No lengthy explanations unless asked.`;

export const BUILDER_SCENARIOS: BenchmarkScenario[] = [
  // ── Round 1: HTML Basics (Easy) ──────────────────────────────────
  {
    id: "r1-html-basics",
    name: "HTML Basics",
    difficulty: "easy",
    timeout: 90_000,
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      'Create a single HTML page with a button that says "Click Me". The button should have a blue background (#3B82F6), white text, rounded corners, padding, and a hover effect that darkens the color.',
    validation: {
      requiredElements: ["button"],
      requiredKeywords: ["Click Me", "background", "hover"],
      cssPatterns: ["#3B82F6", "border-radius", "padding"],
      jsPatterns: [],
      minLength: 200,
    },
  },

  // ── Round 2: Layout (Easy) ───────────────────────────────────────
  {
    id: "r2-layout",
    name: "Layout",
    difficulty: "easy",
    timeout: 120_000,
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      'Create a navigation bar with: a logo/brand name "Acme Corp" on the left, three centered links (Home, About, Contact), and a "Login" button on the right. Use flexbox for layout. Dark background, white text.',
    validation: {
      requiredElements: ["nav", "a", "button"],
      requiredKeywords: ["Acme Corp", "Home", "About", "Contact", "Login"],
      cssPatterns: ["flex", "justify"],
      jsPatterns: [],
      minLength: 400,
    },
  },

  // ── Round 3: Modify Existing (Medium) — CHAIN GATE ───────────────
  {
    id: "r3-modify",
    name: "Modify Existing",
    difficulty: "medium",
    timeout: 120_000,
    chainGate: true,
    dependsOn: "r2-layout",
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      'Here is an existing navbar. Modify it to add: 1) A dropdown menu under "About" with three sub-items (Team, History, Careers), and 2) A dark mode toggle button in the top-right that switches between light and dark themes. Output the COMPLETE updated file.\n\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Acme Corp</title>\n<style>\n* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: Arial, sans-serif; }\nnav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; background: #1a1a2e; color: white; }\n.brand { font-size: 1.5rem; font-weight: bold; }\n.nav-links { display: flex; gap: 2rem; list-style: none; }\n.nav-links a { color: white; text-decoration: none; }\n.nav-links a:hover { color: #e94560; }\n.login-btn { padding: 0.5rem 1.5rem; background: #e94560; color: white; border: none; border-radius: 4px; cursor: pointer; }\n.login-btn:hover { background: #c73e54; }\n</style>\n</head>\n<body>\n<nav>\n<div class="brand">Acme Corp</div>\n<ul class="nav-links">\n<li><a href="#">Home</a></li>\n<li><a href="#">About</a></li>\n<li><a href="#">Contact</a></li>\n</ul>\n<button class="login-btn">Login</button>\n</nav>\n</body>\n</html>\n```',
    validation: {
      requiredElements: ["nav", "a", "button"],
      requiredKeywords: [
        "Team",
        "History",
        "Careers",
        "dark",
        "toggle",
        "Acme Corp",
      ],
      cssPatterns: ["dropdown", "position"],
      jsPatterns: ["addEventListener", "classList"],
      minLength: 800,
    },
  },

  // ── Round 4: Interactive (Medium) ────────────────────────────────
  {
    id: "r4-interactive",
    name: "Interactive",
    difficulty: "medium",
    timeout: 150_000,
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      "Create a todo list application with: 1) An input field and Add button to create new todos, 2) Each todo has a checkbox to mark complete (strikethrough when checked), 3) A delete button (X) on each todo to remove it, 4) A counter showing total and completed todos. Style it cleanly with a card-like container.",
    validation: {
      requiredElements: ["input", "button"],
      requiredKeywords: ["todo", "Add", "delete"],
      cssPatterns: ["line-through", "border-radius"],
      jsPatterns: ["addEventListener", "createElement", "remove"],
      minLength: 1000,
    },
  },

  // ── Round 5: Responsive (Medium) ─────────────────────────────────
  {
    id: "r5-responsive",
    name: "Responsive",
    difficulty: "medium",
    timeout: 150_000,
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      'Create a pricing table with three tiers: "Starter" ($9/mo), "Pro" ($29/mo), and "Enterprise" ($99/mo). Each tier should have a title, price, 4-5 feature bullet points, and a CTA button. The Pro tier should be visually highlighted as "Most Popular". Use CSS Grid. On screens below 768px, the three columns should stack vertically.',
    validation: {
      requiredElements: ["button"],
      requiredKeywords: [
        "Starter",
        "Pro",
        "Enterprise",
        "$9",
        "$29",
        "$99",
        "Popular",
      ],
      cssPatterns: ["grid", "@media"],
      jsPatterns: [],
      minLength: 1200,
    },
  },

  // ── Round 6: Multi-component (Hard) ──────────────────────────────
  {
    id: "r6-multi-component",
    name: "Multi-component",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      "Create a dashboard layout with: 1) A fixed sidebar (240px wide) with navigation links (Dashboard, Analytics, Users, Settings) with icons (use emoji), 2) A top header bar with a page title and user avatar placeholder, 3) A main content area with 4 stats cards (Total Users: 2,847, Revenue: $12,340, Orders: 643, Conversion: 3.2%), 4) Below the cards, a placeholder area for a chart (gray box with text 'Chart Area'). Dark theme, modern look.",
    validation: {
      requiredElements: ["nav", "header", "main"],
      requiredKeywords: [
        "Dashboard",
        "Analytics",
        "Users",
        "Settings",
        "2,847",
        "$12,340",
        "643",
        "3.2%",
      ],
      cssPatterns: ["fixed", "grid", "240px"],
      jsPatterns: [],
      minLength: 1500,
    },
  },

  // ── Round 7: Complex Logic (Hard) ────────────────────────────────
  {
    id: "r7-complex-logic",
    name: "Complex Logic",
    difficulty: "hard",
    timeout: 180_000,
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      "Create a calculator with: 1) A display showing current input and previous expression, 2) Number buttons 0-9, 3) Operation buttons (+, -, ×, ÷), 4) Equals, Clear, and Backspace buttons, 5) Working calculation logic that handles chained operations (e.g. 5 + 3 × 2 = 16, left-to-right), 6) Decimal point support, 7) A history panel on the right showing last 5 calculations. Style it with a modern, dark theme and grid layout for buttons.",
    validation: {
      requiredElements: ["button"],
      requiredKeywords: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      cssPatterns: ["grid", "gap"],
      jsPatterns: ["addEventListener", "function", "eval"],
      minLength: 2000,
    },
  },

  // ── Round 8: Full Page (Expert) ──────────────────────────────────
  {
    id: "r8-full-page",
    name: "Full Page",
    difficulty: "expert",
    timeout: 240_000,
    systemPrompt: SYSTEM_PROMPT,
    prompt:
      'Create a complete SaaS landing page with these sections: 1) HERO — Large headline "Ship Faster with CloudForge", subtitle, and two CTA buttons (Get Started, Watch Demo), 2) FEATURES — 3-column grid with 6 feature cards (icon emoji, title, description), 3) TESTIMONIALS — 3 customer quotes with name and role, 4) PRICING — 3 pricing tiers (Free, Pro $19/mo, Team $49/mo) with feature lists and CTA buttons, 5) FOOTER — 4-column layout with Company, Product, Resources, Legal links. Use a cohesive color scheme, smooth scroll navigation, and modern typography. Fully responsive.',
    validation: {
      requiredElements: ["header", "section", "footer", "button", "a"],
      requiredKeywords: [
        "CloudForge",
        "Get Started",
        "Watch Demo",
        "Free",
        "Pro",
        "Team",
        "$19",
        "$49",
        "Company",
        "Product",
        "Resources",
      ],
      cssPatterns: ["grid", "@media", "gap", "max-width"],
      jsPatterns: ["scroll"],
      minLength: 3000,
    },
  },
];

/** Get a scenario by ID */
export function getScenario(id: string): BenchmarkScenario | undefined {
  return BUILDER_SCENARIOS.find((s) => s.id === id);
}

/** Get the chain gate scenario */
export function getChainGateScenario(): BenchmarkScenario | undefined {
  return BUILDER_SCENARIOS.find((s) => s.chainGate);
}
