"use client";

import { supabase } from "./client";
import type { ForensicSession, ForensicLogEntry } from "../types";

// Map local IDs to Supabase UUIDs
const sessionIdMap = new Map<string, string>();

// Track which sessions have already logged warnings (avoid spam)
const warnedSessions = new Set<string>();

function generateUUID(): string {
  return crypto.randomUUID();
}

// Resolve mode to a valid non-null string
function resolveMode(config: ForensicSession["config"]): string {
  // Check config.mode first
  if (config.mode && typeof config.mode === 'string' && config.mode.trim()) {
    return config.mode.trim();
  }

  // Try to infer from other config properties
  if (config.poisonAgent && config.poisonRound) {
    return 'pill-prompt'; // Has poison injection configured
  }

  // Check if this looks like a batch config
  if (config.rounds && config.rounds > 1) {
    return 'batch';
  }

  // Default fallback
  return 'local-test';
}

// ─── Session Sync ─────────────────────────────────────────────────

export async function createSupabaseSession(session: ForensicSession): Promise<string | null> {
  try {
    // Generate a proper UUID for Supabase
    const supabaseId = generateUUID();

    // Ensure mode is NEVER null (DB constraint)
    const mode = resolveMode(session.config);

    const { data, error } = await supabase
      .from("llm_sessions")
      .insert({
        id: supabaseId,
        created_at: session.startTime,
        mode: mode,
        user_prompt: mode, // Use resolved mode as placeholder
        poison_pill: session.config.poisonAgent ? "injected" : null,
        num_debaters: 3,
        has_judge: true,
        total_rounds: session.config.rounds || 1,
        poison_injected_at_round: session.config.poisonRound ?? null,
        poison_agent: session.config.poisonAgent ?? null,
        started_at: session.startTime,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Supabase] Failed to create session:", error.message);
      return null;
    }

    // Map the local session ID to the Supabase UUID
    const returnedId = data?.id ?? supabaseId;
    sessionIdMap.set(session.id, returnedId);

    return returnedId;
  } catch (err) {
    console.error("[Supabase] Session creation error:", err);
    return null;
  }
}

export async function completeSupabaseSession(
  sessionId: string,
  verdict?: string,
  echoDetectedAtRound?: number
): Promise<boolean> {
  // Get the Supabase UUID from our map
  const supabaseId = sessionIdMap.get(sessionId);
  if (!supabaseId) {
    // Only warn once per session to avoid spam
    if (!warnedSessions.has(sessionId)) {
      warnedSessions.add(sessionId);
      console.warn("[Supabase] No mapped UUID for session (local-only):", sessionId.slice(0, 12));
    }
    return false;
  }

  try {
    const { error } = await supabase
      .from("llm_sessions")
      .update({
        completed_at: new Date().toISOString(),
        echo_detected_at_round: echoDetectedAtRound ?? null,
      })
      .eq("id", supabaseId);

    if (error) {
      console.error("[Supabase] Failed to complete session:", error.message);
      return false;
    }

    // If there's a verdict, also create a judge verdict record
    if (verdict) {
      const isHallucination = verdict.toLowerCase().includes("hallucination");
      const isEcho = verdict.toLowerCase().includes("echo");
      const isPoisonCaught = verdict.toLowerCase().includes("caught") || verdict.toLowerCase().includes("killed");

      await supabase.from("llm_judge_verdicts").insert({
        session_id: supabaseId,
        verdict_status: verdict,
        hallucination_detected: isHallucination,
        echo_chamber_detected: isEcho,
        poison_flagged: isPoisonCaught,
        judge_summary: verdict,
      });
    }

    // Clean up the mapping after session completes
    sessionIdMap.delete(sessionId);

    return true;
  } catch (err) {
    console.error("[Supabase] Session completion error:", err);
    return false;
  }
}

// ─── Response Sync ────────────────────────────────────────────────

export async function logSupabaseResponse(
  sessionId: string,
  entry: ForensicLogEntry
): Promise<boolean> {
  // Only log response-type entries
  if (entry.category !== "response" && entry.category !== "round") {
    return true;
  }

  // Get the Supabase UUID from our map
  const supabaseSessionId = sessionIdMap.get(sessionId);
  if (!supabaseSessionId) {
    // Only warn once per session to avoid spam
    if (!warnedSessions.has(sessionId)) {
      warnedSessions.add(sessionId);
      console.debug("[Supabase] Session not synced to cloud:", sessionId.slice(0, 12));
    }
    return false;
  }

  try {
    const { error } = await supabase.from("llm_responses").insert({
      session_id: supabaseSessionId,
      role: entry.modelState?.agentRole ?? "unknown",
      round_number: entry.systemState?.roundNumber ?? 1,
      endpoint_label: entry.modelState?.modelId ?? "unknown",
      base_url: "local", // We don't track base URLs in forensic entries
      prompt_sent: entry.input ?? "",
      response_text: entry.output ?? "",
      status: entry.severity === "critical" ? "error" : "success",
      error_message: entry.severity === "critical" ? entry.event : null,
      started_at: entry.timestamp,
      completed_at: entry.timestamp,
      char_count: entry.output?.length ?? 0,
    });

    if (error) {
      console.error("[Supabase] Failed to log response:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Supabase] Response logging error:", err);
    return false;
  }
}

// ─── Endpoint Snapshot ────────────────────────────────────────────

export async function saveEndpointSnapshot(
  supabaseSessionId: string,
  models: Record<string, string>
): Promise<boolean> {
  // Note: This function receives the Supabase UUID directly from createSupabaseSession
  try {
    const snapshots = Object.entries(models).map(([role, modelId], idx) => ({
      session_id: supabaseSessionId,
      role,
      endpoint_label: modelId,
      base_url: "local",
      ordering: idx,
    }));

    const { error } = await supabase.from("llm_endpoints_snapshot").insert(snapshots);

    if (error) {
      console.error("[Supabase] Failed to save endpoint snapshot:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Supabase] Endpoint snapshot error:", err);
    return false;
  }
}

// ─── Batch Sync Helper ────────────────────────────────────────────

export async function syncSessionToSupabase(
  session: ForensicSession,
  entries: ForensicLogEntry[]
): Promise<boolean> {
  // Create the session
  const sessionId = await createSupabaseSession(session);
  if (!sessionId) return false;

  // Save endpoint snapshot
  await saveEndpointSnapshot(sessionId, session.config.models);

  // Log all responses
  for (const entry of entries) {
    await logSupabaseResponse(sessionId, entry);
  }

  // Complete the session
  await completeSupabaseSession(sessionId, session.verdict);

  return true;
}

// ─── Fetch Sessions from Supabase ─────────────────────────────────

export interface SupabaseSession {
  id: string;
  created_at: string;
  mode: string;
  user_prompt: string;
  total_rounds: number;
  echo_detected_at_round: number | null;
  poison_injected_at_round: number | null;
  poison_agent: string | null;
  completed_at: string | null;
}

export async function fetchSupabaseSessions(limit = 50): Promise<SupabaseSession[]> {
  try {
    const { data, error } = await supabase
      .from("llm_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Supabase] Failed to fetch sessions:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("[Supabase] Fetch sessions error:", err);
    return [];
  }
}

export async function fetchSessionResponses(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from("llm_responses")
      .select("*")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true });

    if (error) {
      console.error("[Supabase] Failed to fetch responses:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("[Supabase] Fetch responses error:", err);
    return [];
  }
}

export async function fetchSessionVerdict(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from("llm_judge_verdicts")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine
      console.error("[Supabase] Failed to fetch verdict:", error.message);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.error("[Supabase] Fetch verdict error:", err);
    return null;
  }
}

// ─── Connection Test ──────────────────────────────────────────────

export async function testSupabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("llm_sessions")
      .select("id")
      .limit(1);

    if (error) {
      return { connected: false, error: error.message };
    }

    return { connected: true };
  } catch (err) {
    return { connected: false, error: String(err) };
  }
}
