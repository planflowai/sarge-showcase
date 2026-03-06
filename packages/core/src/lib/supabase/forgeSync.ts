"use client";

import { supabase } from "./client";

// ─── Trial Results Sync ──────────────────────────────────────────

export interface TrialResultRow {
  model_id: string;
  model_name: string;
  provider: string;
  run_type: "local" | "cloud";
  round_number: number;
  scenario: string;
  score: number;
  grade: string;
  status: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  time_seconds: number;
  breakdown: Record<string, unknown>;
  run_session_id: string;
}

/**
 * Async-write a completed trial round to Supabase.
 * Non-blocking — localStorage is the primary store.
 */
export async function syncTrialResult(row: TrialResultRow): Promise<boolean> {
  try {
    const { error } = await supabase.from("forge_trial_results").insert(row);
    if (error) {
      console.warn("[ForgeSync] Trial result write failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ForgeSync] Trial result error:", err);
    return false;
  }
}

/**
 * Batch-write multiple trial results (e.g., after a full run).
 */
export async function syncTrialResultsBatch(rows: TrialResultRow[]): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    const { error } = await supabase.from("forge_trial_results").insert(rows);
    if (error) {
      console.warn("[ForgeSync] Trial batch write failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ForgeSync] Trial batch error:", err);
    return false;
  }
}

/**
 * Fetch trial results from Supabase (for hydration on fresh browser).
 */
export async function fetchTrialResults(runType?: "local" | "cloud", limit = 500) {
  try {
    let query = supabase
      .from("forge_trial_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (runType) {
      query = query.eq("run_type", runType);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[ForgeSync] Fetch trial results failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("[ForgeSync] Fetch trial results error:", err);
    return [];
  }
}

// ─── Billing Sync ────────────────────────────────────────────────

export interface BillingRow {
  provider: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  run_type: string; // trial, build, hybrid, chat, compiler
  run_ref_id?: string;
}

/**
 * Async-write a billing entry to Supabase.
 * Non-blocking — if it fails, the local billing dashboard still works.
 */
export async function syncBillingEntry(row: BillingRow): Promise<boolean> {
  try {
    const { error } = await supabase.from("forge_billing").insert({
      ...row,
      date: new Date().toISOString().split("T")[0],
    });
    if (error) {
      console.warn("[ForgeSync] Billing write failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ForgeSync] Billing error:", err);
    return false;
  }
}

/**
 * Fetch billing entries for a date range.
 */
export async function fetchBillingEntries(fromDate?: string, toDate?: string) {
  try {
    let query = supabase
      .from("forge_billing")
      .select("*")
      .order("created_at", { ascending: false });

    if (fromDate) query = query.gte("date", fromDate);
    if (toDate) query = query.lte("date", toDate);

    const { data, error } = await query.limit(1000);
    if (error) {
      console.warn("[ForgeSync] Fetch billing failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("[ForgeSync] Fetch billing error:", err);
    return [];
  }
}

// ─── Hybrid Runs Sync ────────────────────────────────────────────

export interface HybridRunRow {
  scenario: string;
  custom_prompt?: string;
  chain: unknown;
  step_results: unknown;
  final_score: number;
  final_grade: string;
  total_cost_usd: number;
  total_time_seconds: number;
  status: string;
}

export async function syncHybridRun(row: HybridRunRow): Promise<boolean> {
  try {
    const { error } = await supabase.from("forge_hybrid_runs").insert(row);
    if (error) {
      console.warn("[ForgeSync] Hybrid run write failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ForgeSync] Hybrid run error:", err);
    return false;
  }
}

// ─── Conversation Sync ───────────────────────────────────────────

export interface ConversationRow {
  id: string;
  title?: string;
  model?: string;
  provider?: string;
  mode?: string;
  message_count?: number;
  last_message_at?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageRow {
  conversation_id: string;
  role: string;
  content: string;
  model?: string;
  provider?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Upsert a conversation to Supabase.
 */
export async function syncConversation(conv: ConversationRow): Promise<boolean> {
  try {
    const { error } = await supabase.from("conversations").upsert({
      id: conv.id,
      title: conv.title || "Untitled",
      model: conv.model,
      provider: conv.provider,
      mode: conv.mode || "chat",
      message_count: conv.message_count || 0,
      last_message_at: conv.last_message_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: conv.metadata,
    }, { onConflict: "id" });

    if (error) {
      console.warn("[ForgeSync] Conversation sync failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ForgeSync] Conversation error:", err);
    return false;
  }
}

/**
 * Write a message to Supabase.
 */
export async function syncMessage(msg: MessageRow): Promise<boolean> {
  try {
    const { error } = await supabase.from("messages").insert(msg);
    if (error) {
      console.warn("[ForgeSync] Message sync failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ForgeSync] Message error:", err);
    return false;
  }
}

/**
 * Fetch conversations from Supabase.
 */
export async function fetchConversations(limit = 100) {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[ForgeSync] Fetch conversations failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("[ForgeSync] Fetch conversations error:", err);
    return [];
  }
}

/**
 * Fetch messages for a conversation.
 */
export async function fetchMessages(conversationId: string) {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[ForgeSync] Fetch messages failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("[ForgeSync] Fetch messages error:", err);
    return [];
  }
}

// ─── Connection Test (uses new tables) ───────────────────────────

export async function testForgeConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("forge_trial_results")
      .select("id")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

// ─── Compiler/Compliance Results Sync ───────────────────────────

export interface CompilerResultRow {
  source: "builder" | "hybrid" | "trials";
  performance: number;
  accessibility: number;
  seo: number;
  best_practices: number;
  violations_count: number;
  passed: boolean;
  ai_fix_applied: boolean;
  after_performance: number | null;
  after_accessibility: number | null;
  after_seo: number | null;
  after_best_practices: number | null;
  after_violations_count: number | null;
  after_passed: boolean | null;
}

/**
 * Log a compliance/compiler result to Supabase.
 * Non-blocking — fire and forget.
 */
export async function syncCompilerResult(row: CompilerResultRow): Promise<boolean> {
  try {
    const { error } = await supabase.from("forge_compiler_results").insert(row);
    if (error) {
      console.warn("[ForgeSync] Compiler result write failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ForgeSync] Compiler result error:", err);
    return false;
  }
}
