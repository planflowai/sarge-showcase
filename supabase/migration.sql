-- ============================================================
-- SARGE / Forge Platform — Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Or hit /api/supabase/migrate with SUPABASE_SERVICE_ROLE_KEY set
-- ============================================================

-- TABLE 1: conversations (DROP old wrong schema, recreate)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  title TEXT,
  model TEXT,
  provider TEXT,
  mode TEXT, -- chat, debate, parallel, builder
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB
);

-- TABLE 2: messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT, -- user, assistant, system
  content TEXT,
  model TEXT,
  provider TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd NUMERIC(10,6),
  metadata JSONB
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- TABLE 3: forge_trial_results
CREATE TABLE forge_trial_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  model_id TEXT,
  model_name TEXT,
  provider TEXT,
  run_type TEXT, -- local, cloud
  round_number INTEGER,
  scenario TEXT,
  score INTEGER,
  grade TEXT,
  status TEXT, -- pass, partial, failed, timeout
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd NUMERIC(10,6),
  time_seconds NUMERIC(8,2),
  breakdown JSONB,
  run_session_id TEXT
);

CREATE INDEX idx_trial_results_model ON forge_trial_results(model_id);
CREATE INDEX idx_trial_results_session ON forge_trial_results(run_session_id);

-- TABLE 4: forge_hybrid_runs
CREATE TABLE forge_hybrid_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  scenario TEXT,
  custom_prompt TEXT,
  chain JSONB,
  step_results JSONB,
  final_score INTEGER,
  final_grade TEXT,
  total_cost_usd NUMERIC(10,6),
  total_time_seconds NUMERIC(8,2),
  status TEXT
);

-- TABLE 5: forge_build_history
CREATE TABLE forge_build_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  client_name TEXT,
  site_type TEXT,
  prompt TEXT,
  model_id TEXT,
  provider TEXT,
  output_html TEXT,
  deploy_url TEXT,
  cost_usd NUMERIC(10,6),
  time_seconds NUMERIC(8,2),
  compiler_run_id UUID,
  metadata JSONB
);

-- TABLE 6: forge_compiler_results
CREATE TABLE forge_compiler_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  build_id UUID REFERENCES forge_build_history(id),
  lighthouse_performance INTEGER,
  lighthouse_accessibility INTEGER,
  lighthouse_seo INTEGER,
  lighthouse_best_practices INTEGER,
  axe_violations INTEGER,
  axe_passes INTEGER,
  seo_score INTEGER,
  security_score INTEGER,
  fixes_applied INTEGER,
  fixes_manual INTEGER,
  certificate_generated BOOLEAN DEFAULT false,
  before_scores JSONB,
  after_scores JSONB,
  fix_log JSONB
);

-- TABLE 7: forge_billing
CREATE TABLE forge_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  provider TEXT,
  model_id TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd NUMERIC(10,6),
  run_type TEXT, -- trial, build, hybrid, chat, compiler
  run_ref_id TEXT,
  date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_billing_date ON forge_billing(date);
CREATE INDEX idx_billing_provider ON forge_billing(provider);

-- TABLE 8: forge_model_registry
CREATE TABLE forge_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  model_id TEXT UNIQUE,
  model_name TEXT,
  provider TEXT,
  is_local BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[],
  best_scores JSONB,
  last_benchmarked_at TIMESTAMPTZ,
  config JSONB
);

-- TABLE 9: forge_certificates
CREATE TABLE forge_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  build_id UUID REFERENCES forge_build_history(id),
  compiler_run_id UUID REFERENCES forge_compiler_results(id),
  client_name TEXT,
  site_url TEXT,
  performance_score INTEGER,
  accessibility_score INTEGER,
  seo_score INTEGER,
  security_score INTEGER,
  certificate_html TEXT,
  issued_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ
);

-- TABLE 10: builder_logs (was in code but never created)
CREATE TABLE builder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  project_name TEXT UNIQUE,
  project_path TEXT,
  log_content TEXT,
  metadata JSONB
);

-- TABLE 11: user_settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  key TEXT UNIQUE,
  value JSONB
);

-- ============================================================
-- RLS Policies — allow anon key full access (single-user app)
-- ============================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_trial_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_hybrid_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_build_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_compiler_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Allow anon full CRUD on all tables (single-user local app)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'conversations', 'messages', 'forge_trial_results', 'forge_hybrid_runs',
    'forge_build_history', 'forge_compiler_results', 'forge_billing',
    'forge_model_registry', 'forge_certificates', 'builder_logs', 'user_settings'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "%s_anon_all" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
