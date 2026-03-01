import type { ForensicLogEntry } from "@/lib/types";

export async function computeForensicHash(
  entry: Omit<ForensicLogEntry, "hash">
): Promise<string> {
  const sorted = JSON.stringify(entry, Object.keys(entry).sort());
  const encoded = new TextEncoder().encode(sorted);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function verifyChain(
  entries: ForensicLogEntry[]
): { valid: boolean; brokenAt?: number } {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].previousHash !== entries[i - 1].hash) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true };
}
