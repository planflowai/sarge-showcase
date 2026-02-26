import type { Message } from "@sarge/core";
import type { KnowledgeDocument } from "@sarge/core";

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
const SUMMARIZE_MODEL = "llama3.1:8b";

/**
 * Summarize a conversation thread using local Ollama.
 * Returns a 200-400 token summary string.
 */
export async function summarizeThread(messages: Message[]): Promise<string> {
  if (messages.length === 0) return "";

  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const systemPrompt =
    "You are a summarizer. Summarize the following conversation in 200-400 tokens. " +
    "Capture the key topics, questions, decisions, and any important context. Be concise.";

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SUMMARIZE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      console.error("[summarize] Ollama error:", res.status);
      return "";
    }

    const data = await res.json();
    return data.message?.content ?? "";
  } catch (err) {
    console.error("[summarize] Failed to reach Ollama:", err);
    return "";
  }
}

/**
 * Sanitize a user query for cloud providers using local Ollama.
 * Strips proprietary details from the query while preserving the intent.
 * Falls back to original query on error.
 */
export async function sanitizeForCloud(
  userQuery: string,
  threadMessages: Message[],
  knowledgeDocs: KnowledgeDocument[]
): Promise<string> {
  const context = threadMessages
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const docNames = knowledgeDocs.map((d) => d.name).join(", ");

  const systemPrompt =
    "You are a privacy filter. The user wants to ask a cloud AI a question, but must NOT reveal proprietary information. " +
    "Rewrite the user's query so it asks the same conceptual question without revealing specifics from their private documents" +
    (docNames ? ` (${docNames})` : "") +
    ". Strip names, patent numbers, specific claims, proprietary terms, and any identifying details. " +
    "Return ONLY the rewritten query, nothing else.";

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SUMMARIZE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: context
              ? `Recent conversation context:\n${context}\n\nQuery to sanitize:\n${userQuery}`
              : `Query to sanitize:\n${userQuery}`,
          },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      console.error("[sanitize] Ollama error:", res.status);
      return userQuery;
    }

    const data = await res.json();
    return data.message?.content ?? userQuery;
  } catch (err) {
    console.error("[sanitize] Failed to reach Ollama:", err);
    return userQuery;
  }
}
