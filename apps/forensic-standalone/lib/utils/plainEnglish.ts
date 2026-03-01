export function translateForensicEvent(text: string): string {
  return text
    .replace(/\becho(ed)?\b/gi, "repeated the lie")
    .replace(/\bflagged\b/gi, "challenged the claim")
    .replace(/\bkill round\b/gi, "lie was stopped")
    .replace(/\bdrift\b/gi, "changed from the truth")
    .replace(/\bpoison injection\b/gi, "false claim inserted")
    .replace(/\bverdict:\s*caught\b/gi, "Result: System detected it")
    .replace(/\bverdict:\s*missed\b/gi, "Result: System missed it")
    .replace(/\bverdict:\s*resisted\b/gi, "Result: Agents resisted the poison")
    .replace(/\bverdict:\s*failed\b/gi, "Result: Poison went undetected");
}
