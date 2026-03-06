import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * POST /api/supabase/migrate
 *
 * Runs the migration SQL against Supabase.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage: fetch('/api/supabase/migrate', { method: 'POST' })
 * Or just open the browser to the URL.
 */
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({
      error: "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local. Add it and restart.",
      hint: "Find it in Supabase Dashboard → Settings → API → service_role key",
    }, { status: 400 });
  }

  // Create admin client with service role key
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Split migration into individual statements
  const statements = getMigrationStatements();

  const results: { statement: string; ok: boolean; error?: string }[] = [];
  let success = 0;
  let failed = 0;

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;

    const { error } = await admin.rpc("exec_sql", { sql: trimmed }).single();

    if (error) {
      // Try direct approach — some statements may fail due to already existing
      results.push({ statement: trimmed.substring(0, 80) + "...", ok: false, error: error.message });
      failed++;
    } else {
      results.push({ statement: trimmed.substring(0, 80) + "...", ok: true });
      success++;
    }
  }

  return NextResponse.json({
    message: `Migration complete: ${success} succeeded, ${failed} failed`,
    results,
  });
}

// Also support GET for easy browser access
export async function GET() {
  return NextResponse.json({
    message: "Supabase Migration Endpoint",
    instructions: [
      "1. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local",
      "2. POST to this endpoint to run migrations",
      "3. Or run the SQL manually: supabase/migration.sql",
    ],
  });
}

function getMigrationStatements(): string[] {
  // Inline the core table creation for reliability
  return [
    // Drop old tables
    `DROP TABLE IF EXISTS messages CASCADE`,
    `DROP TABLE IF EXISTS conversations CASCADE`,

    // TABLE 1: conversations
    `CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      title TEXT,
      model TEXT,
      provider TEXT,
      mode TEXT,
      message_count INTEGER DEFAULT 0,
      last_message_at TIMESTAMPTZ,
      metadata JSONB
    )`,

    // TABLE 2: messages
    `CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT,
      content TEXT,
      model TEXT,
      provider TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      cost_usd NUMERIC(10,6),
      metadata JSONB
    )`,

    // TABLE 3: forge_trial_results
    `CREATE TABLE IF NOT EXISTS forge_trial_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      model_id TEXT,
      model_name TEXT,
      provider TEXT,
      run_type TEXT,
      round_number INTEGER,
      scenario TEXT,
      score INTEGER,
      grade TEXT,
      status TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      cost_usd NUMERIC(10,6),
      time_seconds NUMERIC(8,2),
      breakdown JSONB,
      run_session_id TEXT
    )`,

    // TABLE 4: forge_hybrid_runs
    `CREATE TABLE IF NOT EXISTS forge_hybrid_runs (
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
    )`,

    // TABLE 5: forge_build_history
    `CREATE TABLE IF NOT EXISTS forge_build_history (
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
    )`,

    // TABLE 6: forge_compiler_results
    `CREATE TABLE IF NOT EXISTS forge_compiler_results (
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
    )`,

    // TABLE 7: forge_billing
    `CREATE TABLE IF NOT EXISTS forge_billing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      provider TEXT,
      model_id TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      cost_usd NUMERIC(10,6),
      run_type TEXT,
      run_ref_id TEXT,
      date DATE DEFAULT CURRENT_DATE
    )`,

    // TABLE 8: forge_model_registry
    `CREATE TABLE IF NOT EXISTS forge_model_registry (
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
    )`,

    // TABLE 9: forge_certificates
    `CREATE TABLE IF NOT EXISTS forge_certificates (
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
    )`,

    // TABLE 10: builder_logs
    `CREATE TABLE IF NOT EXISTS builder_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      project_name TEXT UNIQUE,
      project_path TEXT,
      log_content TEXT,
      metadata JSONB
    )`,

    // TABLE 11: user_settings
    `CREATE TABLE IF NOT EXISTS user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      key TEXT UNIQUE,
      value JSONB
    )`,

    // TABLE 12: client_intake (SARGE_Client_Pipeline_Spec)
    `CREATE TABLE IF NOT EXISTS client_intake (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      ref_code TEXT UNIQUE,
      form_data JSONB,
      status TEXT DEFAULT 'new',
      email TEXT,
      project_name TEXT,
      client_name TEXT,
      client_email TEXT,
      intake_submitted_at TIMESTAMPTZ,
      build_started_at TIMESTAMPTZ,
      preview_sent_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      deployed_at TIMESTAMPTZ
    )`,

    // TABLE 13: client_revisions (SARGE_Client_Pipeline_Spec)
    `CREATE TABLE IF NOT EXISTS client_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      ref_code TEXT,
      page TEXT,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'new',
      revision_number INTEGER DEFAULT 1,
      attachment_url TEXT
    )`,

    // RLS + Policies for client tables
    `ALTER TABLE client_intake ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE client_revisions ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY "client_intake_anon_all" ON client_intake FOR ALL TO anon USING (true) WITH CHECK (true)`,
    `CREATE POLICY "client_revisions_anon_all" ON client_revisions FOR ALL TO anon USING (true) WITH CHECK (true)`,
  ];
}
