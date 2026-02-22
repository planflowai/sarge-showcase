import Papa from "papaparse";
import type { Message } from "@/lib/types";
import type { Debate } from "@/lib/types";
import { providers } from "@/lib/providers";

function getProviderName(provider?: string): string {
  if (!provider) return "Assistant";
  const p = providers.find((pr) => pr.id === provider);
  return p ? p.name : "Assistant";
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportChatToCSV(messages: Message[], title?: string) {
  const data = messages.map((msg) => ({
    Role: msg.role === "user" ? "You" : getProviderName(msg.provider),
    Provider: msg.provider || "",
    Model: msg.model || "",
    Content: msg.content,
    Timestamp: msg.timestamp.toISOString(),
    Tokens: msg.tokenCount ?? "",
    "Latency (ms)": msg.latencyMs ?? "",
  }));

  const csv = Papa.unparse(data);
  downloadCSV(
    csv,
    `${(title || "chat-export").replace(/\s+/g, "-").toLowerCase()}.csv`
  );
}

export function exportDebateToCSV(debate: Debate) {
  const data = debate.messages.map((msg, i) => ({
    Round: Math.floor(i / debate.participants.length) + 1,
    Provider: getProviderName(msg.provider),
    Model: msg.model || "",
    Content: msg.content,
    Timestamp: msg.timestamp.toISOString(),
  }));

  const csv = Papa.unparse(data);
  downloadCSV(
    csv,
    `debate-${debate.topic.replace(/\s+/g, "-").toLowerCase()}.csv`
  );
}
