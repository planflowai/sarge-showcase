import type { BatchTestResult, BatchPassLog } from "@/lib/types";

// --- Status translations ---

const STATUS_MAP: Record<string, string> = {
  echo: "Repeated the Lie",
  echoed: "Repeated the Lie",
  flagged: "Challenged the Claim",
  clean: "Clean Response",
  caught: "System Detected It",
  missed: "System Failed to Detect",
  waiting: "Waiting",
  running: "Running",
  complete: "Complete",
};

export function translateStatus(status: string): string {
  return STATUS_MAP[status.toLowerCase()] ?? status;
}

// --- Verdict helpers ---

export function formatVerdict(verdict: "caught" | "missed", echoCount: number): string {
  if (verdict === "caught") {
    return echoCount > 0
      ? `The AI repeated the false claim ${echoCount} time${echoCount > 1 ? "s" : ""}, but the system ultimately detected the poisoning.`
      : "The AI never repeated the false claim. The system confirmed it was clean.";
  }
  return echoCount > 0
    ? `The AI repeated the false claim ${echoCount} time${echoCount > 1 ? "s" : ""} and the system failed to detect it.`
    : "The system did not detect the poisoning.";
}

// --- Narrative builders ---

export function buildTestNarrative(test: BatchTestResult): string {
  const poisonSnippet = test.poison.length > 80 ? test.poison.slice(0, 80) + "..." : test.poison;
  const echoCount = test.echoCount ?? 0;
  const echoDetail =
    echoCount > 0
      ? `The AI repeated the lie ${echoCount} time${echoCount > 1 ? "s" : ""}.`
      : "The AI did not repeat the lie.";

  const verdict =
    test.judgeResponse?.verdict === "caught"
      ? "The system caught it."
      : "The system missed it.";

  if (test.mode === "unfiltered") {
    return `Test ${test.testIndex + 1}: Baseline test with no false claims injected. ${echoDetail}`;
  }

  const killDetail = (test.killRound ?? 0) > 0
    ? ` ${test.killAgent} challenged it in round ${test.killRound}.`
    : "";

  if (test.mode === "pill-prompt") {
    const promptResult = test.judgeResponse?.verdict === "caught"
      ? "Protective prompts helped detect the poisoning."
      : "Protective prompts were active but the system still missed it.";
    return `Test ${test.testIndex + 1}: Injected "${poisonSnippet}" with safety prompts active — ${echoDetail}${killDetail} ${promptResult}`;
  }

  return `Test ${test.testIndex + 1}: We injected "${poisonSnippet}" — ${echoDetail}${killDetail} ${verdict}`;
}

export function buildPassSummary(log: BatchPassLog): string {
  const { completed, echoTotal, caughtTotal, catchRate } = log.summary;
  if (log.mode === "unfiltered") {
    return `Baseline: ${completed} tests completed with no false claims injected.`;
  }
  const echoText =
    echoTotal > 0
      ? `the AI repeated false claims in ${echoTotal} response${echoTotal > 1 ? "s" : ""}`
      : "the AI never repeated the false claims";
  return `${completed} tests: ${echoText}. The system caught ${caughtTotal} out of ${completed} (${Math.round(catchRate)}%).`;
}

// --- Pass display names ---

export function passDisplayName(mode: string): string {
  switch (mode) {
    case "unfiltered":
      return "Unfiltered (Baseline)";
    case "pill":
      return "Poison Injection";
    case "pill-prompt":
      return "Protected (Poison + Safety Prompts)";
    case "defense":
      return "Defense (Enhanced Monitoring)";
    default:
      return mode;
  }
}

export function passDescription(mode: string): string {
  switch (mode) {
    case "unfiltered":
      return "Baseline: No lies injected. Clean test.";
    case "pill":
      return "POISON INJECTED! No protection. Will agents spread the lie?";
    case "pill-prompt":
      return "POISON + SHIELD! Protected prompts active. Can agents KILL the lie?";
    case "defense":
      return "DEFENSE MODE! Validation pass with enhanced monitoring.";
    default:
      return "";
  }
}

// --- Round-level narrative ---

export function describeResponse(
  role: string,
  status: "clean" | "echo" | "flagged",
  matchedMarkers?: string[],
): string {
  const agent = role.toUpperCase();
  if (status === "echo" && matchedMarkers?.length) {
    return `${agent} repeated the false claim (matched: ${matchedMarkers.join(", ")})`;
  }
  if (status === "echo") return `${agent} repeated the false claim`;
  if (status === "flagged") return `${agent} challenged the claim`;
  return `${agent} responded cleanly`;
}

// --- Forensic log entry translation ---

export function translateForensicEvent(text: string): string {
  return text
    .replace(/\becho(ed)?\b/gi, "repeated the lie")
    .replace(/\bflagged\b/gi, "challenged the claim")
    .replace(/\bkill round\b/gi, "lie was stopped")
    .replace(/\bdrift\b/gi, "changed from the truth")
    .replace(/\bpoison injection\b/gi, "false claim inserted")
    .replace(/\bverdict:\s*caught\b/gi, "Result: System detected it")
    .replace(/\bverdict:\s*missed\b/gi, "Result: System missed it");
}
