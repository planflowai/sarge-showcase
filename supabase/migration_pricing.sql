-- ============================================================
-- Pricing Admin — pricing_packages + pricing_trust_items
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── pricing_packages ──
CREATE TABLE IF NOT EXISTS pricing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  price_min INTEGER NOT NULL DEFAULT 0,
  price_max INTEGER NOT NULL DEFAULT 0,
  price_label TEXT NOT NULL DEFAULT 'One-time',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  button_label TEXT NOT NULL DEFAULT 'Select',
  color_primary TEXT NOT NULL DEFAULT '#8B5CF6',
  color_bg TEXT NOT NULL DEFAULT '#8B5CF615',
  icon_svg TEXT NOT NULL DEFAULT '',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revision_rounds INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pricing_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_packages_anon_all" ON pricing_packages
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pricing_packages_sort ON pricing_packages(sort_order);

-- ── pricing_trust_items ──
CREATE TABLE IF NOT EXISTS pricing_trust_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  icon_svg TEXT NOT NULL DEFAULT '✦',
  color TEXT NOT NULL DEFAULT '#FF6700',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pricing_trust_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_trust_items_anon_all" ON pricing_trust_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pricing_trust_items_sort ON pricing_trust_items(sort_order);

-- ── Seed: 3 packages ──
INSERT INTO pricing_packages (sort_order, name, tagline, price_min, price_max, price_label, features, button_label, color_primary, color_bg, icon_svg, is_featured, is_active, revision_rounds) VALUES
(0, 'Essential', 'Get online fast with a polished, professional site', 500, 900, 'One-time · 50% deposit',
 '[{"text":"Up to 3 pages","included":true},{"text":"Mobile responsive","included":true},{"text":"Contact form","included":true},{"text":"SEO basics","included":true},{"text":"1 round of revisions","included":true},{"text":"Custom animations","included":false},{"text":"CMS integration","included":false},{"text":"E-commerce","included":false}]'::jsonb,
 'Select Essential', '#14B8A6', '#14B8A615',
 '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M44 4L20 28"/><path d="M44 4L30 44L20 28L4 18L44 4Z"/></svg>',
 false, true, 1),

(1, 'Standard', 'Full-featured site with room to grow', 1200, 2500, 'One-time · 50% deposit',
 '[{"text":"Up to 7 pages","included":true},{"text":"Mobile responsive","included":true},{"text":"Contact form + booking","included":true},{"text":"Full SEO optimization","included":true},{"text":"2 rounds of revisions","included":true},{"text":"Custom animations","included":true},{"text":"CMS integration","included":true},{"text":"E-commerce","included":false}]'::jsonb,
 'Select Standard', '#8B5CF6', '#8B5CF615',
 '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 24L24 34L44 24"/><path d="M4 32L24 42L44 32"/><path d="M4 16L24 26L44 16L24 6L4 16Z"/></svg>',
 true, true, 2),

(2, 'Premium', 'Enterprise-grade site — no limits, no compromises', 3500, 7000, 'One-time · 50% deposit',
 '[{"text":"Unlimited pages","included":true},{"text":"Mobile responsive","included":true},{"text":"Advanced forms + integrations","included":true},{"text":"Full SEO + analytics","included":true},{"text":"3 rounds of revisions","included":true},{"text":"Custom animations","included":true},{"text":"CMS integration","included":true},{"text":"E-commerce ready","included":true}]'::jsonb,
 'Select Premium', '#EC4899', '#EC489915',
 '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 44L4 18L12 6H36L44 18L24 44Z"/><path d="M4 18H44"/><path d="M24 44L18 18L12 6"/><path d="M24 44L30 18L36 6"/></svg>',
 false, true, 3)
ON CONFLICT DO NOTHING;

-- ── Seed: trust items ──
INSERT INTO pricing_trust_items (sort_order, label, icon_svg, color, is_active) VALUES
(0, '100% Custom Design', '✦', '#FF6700', true),
(1, '4-Platform Deploy', '✦', '#FF6700', true),
(2, 'Coming Soon Page in Minutes', '✦', '#FF6700', true),
(3, 'Full Source Code Included', '✦', '#FF6700', true),
(4, 'No Templates — Ever', '✦', '#FF6700', true),
(5, 'Cancel Anytime', '✦', '#FF6700', true)
ON CONFLICT DO NOTHING;
