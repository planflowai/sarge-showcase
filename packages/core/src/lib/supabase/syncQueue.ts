"use client";

import { supabase } from "./client";
import type { QueuedSync } from "../../stores/syncStatusStore";
import type { ForensicSession, ForensicLogEntry, Conversation } from "../types";

// Process a single queued item
export async function processQueuedItem(item: QueuedSync): Promise<boolean> {
  try {
    switch (item.type) {
      case "session":
        return await processSessionSync(item);
      case "response":
        return await processResponseSync(item);
      case "conversation":
        return await processConversationSync(item);
      case "builderLog":
        return await processBuilderLogSync(item);
      default:
        console.warn(`[SyncQueue] Unknown sync type: ${item.type}`);
        return false;
    }
  } catch (error) {
    console.error(`[SyncQueue] Error processing ${item.type}:`, error);
    throw error;
  }
}

// Session sync
async function processSessionSync(item: QueuedSync): Promise<boolean> {
  const data = item.data as { session: ForensicSession; supabaseId?: string };

  if (item.operation === "create") {
    const { error } = await supabase.from("llm_sessions").insert({
      id: data.supabaseId,
      created_at: data.session.startTime,
      mode: data.session.config.mode || "local-test",
      user_prompt: data.session.config.mode || "local-test",
      total_rounds: data.session.config.rounds || 1,
      poison_injected_at_round: data.session.config.poisonRound ?? null,
      poison_agent: data.session.config.poisonAgent ?? null,
      started_at: data.session.startTime,
    });

    if (error) {
      throw new Error(error.message);
    }
    return true;
  }

  if (item.operation === "update") {
    const { error } = await supabase
      .from("llm_sessions")
      .update({
        completed_at: data.session.endTime,
      })
      .eq("id", data.supabaseId);

    if (error) {
      throw new Error(error.message);
    }
    return true;
  }

  return false;
}

// Response sync
async function processResponseSync(item: QueuedSync): Promise<boolean> {
  const data = item.data as { sessionId: string; entry: ForensicLogEntry };

  const { error } = await supabase.from("llm_responses").insert({
    session_id: data.sessionId,
    role: data.entry.modelState?.agentRole ?? "unknown",
    round_number: data.entry.systemState?.roundNumber ?? 1,
    endpoint_label: data.entry.modelState?.modelId ?? "unknown",
    base_url: "local",
    prompt_sent: data.entry.input ?? "",
    response_text: data.entry.output ?? "",
    status: data.entry.severity === "critical" ? "error" : "success",
    started_at: data.entry.timestamp,
    completed_at: data.entry.timestamp,
    char_count: data.entry.output?.length ?? 0,
  });

  if (error) {
    throw new Error(error.message);
  }
  return true;
}

// Conversation sync — uses new conversations table schema
async function processConversationSync(item: QueuedSync): Promise<boolean> {
  const data = item.data as { conversation: Conversation };
  const conv = data.conversation;

  if (item.operation === "create" || item.operation === "update") {
    const { error } = await supabase.from("conversations").upsert({
      id: conv.id,
      title: conv.title || "Untitled",
      model: conv.model,
      provider: conv.provider,
      mode: conv.mode || "chat",
      message_count: conv.messages?.length ?? 0,
      last_message_at: conv.updatedAt ? new Date(conv.updatedAt).toISOString() : new Date().toISOString(),
      updated_at: conv.updatedAt ? new Date(conv.updatedAt).toISOString() : new Date().toISOString(),
    }, { onConflict: "id" });

    if (error) {
      throw new Error(error.message);
    }
    return true;
  }

  return false;
}

// Builder log sync
async function processBuilderLogSync(item: QueuedSync): Promise<boolean> {
  const data = item.data as { projectName: string; content: string };

  const { error } = await supabase.from("builder_logs").upsert({
    project_name: data.projectName,
    log_content: data.content,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "project_name",
  });

  if (error) {
    throw new Error(error.message);
  }
  return true;
}

// Fetch conversations from Supabase
export async function fetchSupabaseConversations(): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("[SyncQueue] Fetch conversations failed:", error.message);
      return [];
    }

    // Map Supabase rows back to Conversation shape
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      title: (row.title as string) || "Untitled",
      messages: [],
      contextFiles: [],
      provider: (row.provider as string) || "ollama",
      model: (row.model as string) || "",
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      mode: row.mode as string | undefined,
    }));
  } catch (error) {
    console.warn("[SyncQueue] Fetch conversations error:", error);
    return [];
  }
}

// Fetch builder log from Supabase
export async function fetchSupabaseBuilderLog(projectName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("builder_logs")
      .select("log_content, updated_at")
      .eq("project_name", projectName)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[SyncQueue] Failed to fetch builder log:", error.message);
      return null;
    }

    return data?.log_content ?? null;
  } catch (error) {
    console.error("[SyncQueue] Error fetching builder log:", error);
    return null;
  }
}
