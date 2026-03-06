-- ============================================================
-- Phase A — Schema Alignment with SARGE_Client_Pipeline_Spec
-- Run this in Supabase SQL Editor if tables already exist
-- ============================================================

-- client_intake: Add spec columns if table exists but columns don't
DO $$ BEGIN
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS project_name TEXT;
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS client_email TEXT;
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS intake_submitted_at TIMESTAMPTZ;
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS build_started_at TIMESTAMPTZ;
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS preview_sent_at TIMESTAMPTZ;
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
  ALTER TABLE client_intake ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ;
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist yet — run full migration.sql instead
  RAISE NOTICE 'client_intake table does not exist — run migration.sql first';
END $$;

-- client_revisions: Add spec columns if table exists but columns don't
DO $$ BEGIN
  ALTER TABLE client_revisions ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1;
  ALTER TABLE client_revisions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'client_revisions table does not exist — run migration.sql first';
END $$;
