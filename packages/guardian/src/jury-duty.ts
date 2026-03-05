/**
 * Jury Duty Engine — Multi-Model Quality Monitoring
 * Copied from packages/core/src/guardians/juryGuardian/engine.ts
 *
 * 3-tier analysis system:
 * - Tier 1: Fast scan (contradiction, echo chamber, fact extraction, drift detection)
 * - Tier 2: Review and verify Tier 1 findings
 * - Tier 3: Deep audit, create save points
 *
 * NOTE: This engine was originally client-side ("use client") and depends on
 * useJuryGuardianStore (Zustand). When used server-side (e.g. hybrid runner),
 * use the exported system prompts and types directly with your own model calls.
 */

import type {
  PaneResponse,
  Tier1Result,
  Tier2Result,
  Tier3Result,
  JuryApiResponse,
} from "./types";

// Mutex for local model execution - only ONE local model at a time
let localModelBusy = false;
const localModelQueue: Array<() => Promise<void>> = [];

// Active intervals per session
const activeIntervals: Record<
  string,
  {
    tier1: NodeJS.Timeout | null;
    tier2: NodeJS.Timeout | null;
    tier3: NodeJS.Timeout | null;
  }
> = {};

// Last run timestamps per session
const lastRunTimestamps: Record<
  string,
  {
    tier1: Date | null;
    tier2: Date | null;
    tier3: Date | null;
  }
> = {};

// Response queue per session - messages to analyze
const responseQueues: Record<string, PaneResponse[]> = {};

// System prompts — exported for server-side use
export const TIER1_SYSTEM_PROMPT = `You are a silent background monitor. Your ONLY job is to scan recent AI responses from multiple models and identify:
1. Contradictions between models (Model A says X, Model B says not-X)
2. Echo chamber risk (3+ models agree on the same unverified claim)
3. Key facts with source attribution
4. Topic drift from the user's original question

You are reading responses from multiple AI models in a parallel chat session.
Each response is labeled with [PANE X - MODEL_NAME].

Output ONLY a JSON object. No explanations. No natural language. No commentary.
Never add rules. Never interpret user intent. Never fix anything.
If nothing notable is found, output: {"noFindings": true, "tier": 1}

JSON schema:
{
  "timestamp": "ISO8601",
  "tier": 1,
  "factsFound": [{ "fact": "string", "sourceModel": "string", "sourcePane": number, "confidence": number }],
  "contradictions": [{ "claim": "string", "models": ["string"], "description": "string" }],
  "echoRisk": { "detected": boolean, "agreeingModels": ["string"], "claim": "string", "confidence": number },
  "driftDetected": boolean,
  "escalateToTier2": boolean,
  "reason": "string"
}`;

export const TIER2_SYSTEM_PROMPT = `You are a review monitor. You verify findings from a fast scanner (Tier 1).
You receive: Tier 1's JSON findings + recent responses from multiple AI models.
Your job:
1. Confirm or dismiss Tier 1's flags (was the contradiction real? was the echo genuine?)
2. Check fact accuracy more carefully
3. Identify anything Tier 1 missed

Output ONLY a JSON object. No explanations. No natural language.
If Tier 1 was correct, confirm. If Tier 1 was wrong, dismiss with reason.
Never add rules. Never interpret. Never override the user.

JSON schema:
{
  "timestamp": "ISO8601",
  "tier": 2,
  "tier1Corrections": [{ "originalFlag": "string", "correction": "string", "action": "dismiss|confirm|escalate" }],
  "verifiedFacts": [{ "fact": "string", "verifiedBy": ["string"], "confidence": number }],
  "escalateToTier3": boolean,
  "reason": "string"
}`;

export const TIER3_SYSTEM_PROMPT = `You are a deep auditor. You review the full shared context ledger and all findings from Tier 1 and Tier 2 monitors.
Create a clean save point summarizing:
1. All verified facts (with which models confirmed them)
2. All unresolved contradictions
3. Any retired facts (with reason)
4. Overall thread health assessment

You may override Tier 1 and Tier 2 ONLY if there is a clear factual error.
Max 2000 tokens for the save point.
Output ONLY a JSON object.

JSON schema:
{
  "timestamp": "ISO8601",
  "tier": 3,
  "summary": "string",
  "verifiedFacts": ["string"],
  "unresolvedItems": [{ "description": "string", "models": ["string"] }],
  "retiredFacts": [{ "fact": "string", "reason": "string" }],
  "overrides": [{ "originalTier": 1|2, "originalClaim": "string", "correction": "string" }],
  "healthAssessment": "string",
  "tokenCount": number
}`;

/**
 * Acquire the local model mutex
 * Returns a release function
 */
async function acquireLocalModelLock(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (!localModelBusy) {
        localModelBusy = true;
        resolve(() => {
          localModelBusy = false;
          // Process next in queue if any
          const next = localModelQueue.shift();
          if (next) next();
        });
      } else {
        // Queue this request
        localModelQueue.push(async () => {
          localModelBusy = true;
          resolve(() => {
            localModelBusy = false;
            const next = localModelQueue.shift();
            if (next) next();
          });
        });
      }
    };
    tryAcquire();
  });
}

/**
 * Add a response to the queue for analysis
 */
export function queueResponse(sessionId: string, response: PaneResponse): void {
  if (!responseQueues[sessionId]) {
    responseQueues[sessionId] = [];
  }
  responseQueues[sessionId].push(response);
}

/**
 * Get new responses since a given timestamp
 */
export function getNewResponses(sessionId: string, since: Date | null): PaneResponse[] {
  const queue = responseQueues[sessionId] || [];
  if (!since) return queue;
  return queue.filter((r) => new Date(r.timestamp) > since);
}

/**
 * Clear processed responses up to a timestamp
 */
export function clearResponsesUpTo(sessionId: string, upTo: Date): void {
  if (!responseQueues[sessionId]) return;
  responseQueues[sessionId] = responseQueues[sessionId].filter(
    (r) => new Date(r.timestamp) > upTo
  );
}

/**
 * Call the jury API
 * NOTE: This uses fetch("/api/jury-guardian") which requires a browser/server base URL.
 * For server-side use in the hybrid runner, call models directly instead.
 */
async function callJuryApi(
  tier: 1 | 2 | 3,
  model: string,
  provider: string,
  userContent: string,
  systemPrompt: string
): Promise<JuryApiResponse> {
  try {
    const res = await fetch("/api/jury-guardian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier,
        model,
        provider,
        messages: [{ role: "user", content: userContent }],
        systemPrompt,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`[Jury Engine] Tier ${tier} API error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "API call failed",
    };
  }
}

/**
 * Stop the jury for a session
 */
export function stopJury(sessionId: string): void {
  console.log(`[Jury Engine] Stopping jury for session ${sessionId}`);

  const intervals = activeIntervals[sessionId];
  if (intervals) {
    if (intervals.tier1) clearInterval(intervals.tier1);
    if (intervals.tier2) clearInterval(intervals.tier2);
    if (intervals.tier3) clearInterval(intervals.tier3);
    delete activeIntervals[sessionId];
  }
}

/**
 * Run intervention check on a response
 * Returns whether response should be blocked (killed) before entering conversation history
 * This is a synchronous check using keyword matching — no AI call needed
 */
export function runInterventionCheck(
  content: string,
  echoAlerts: Array<{ claim: string; agreeingModels: string[]; confidence: number; dismissed: boolean }>,
  contradictions: Array<{ claim: string; models: Array<{ model: string }>; resolved: boolean }>
): { blocked: boolean; reason: string; type: "echo" | "contradiction" | "none" } {
  // Check 1: Echo chamber detection
  const unresolved = echoAlerts.filter((alert) => !alert.dismissed);
  for (const alert of unresolved) {
    const alertKeywords = alert.claim
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    const contentKeywords = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);

    const overlap = alertKeywords.filter((k) => contentKeywords.includes(k));

    if (overlap.length >= 2) {
      return {
        blocked: true,
        reason: `Echo chamber detected: ${alert.agreeingModels.length} models (${alert.agreeingModels.join(", ")}) agree on unverified claim at ${Math.round(alert.confidence * 100)}% confidence`,
        type: "echo",
      };
    }
  }

  // Check 2: Contradiction detection
  const unresolvedContradictions = contradictions.filter((c) => !c.resolved);

  for (const contradiction of unresolvedContradictions) {
    const contradictionKeywords = contradiction.claim
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    const contentKeywords = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);

    const overlap = contradictionKeywords.filter((k) => contentKeywords.includes(k));

    if (overlap.length >= 2) {
      const negationPatterns = [/\bnot\b/, /\bno\b/, /\bnever\b/, /\bfalse\b/, /\bincorrect\b/, /\bwrong\b/];
      const contentHasNegation = negationPatterns.some((p) => p.test(content.toLowerCase()));
      const contradictionHasNegation = negationPatterns.some((p) => p.test(contradiction.claim.toLowerCase()));

      if (contentHasNegation !== contradictionHasNegation) {
        const models = contradiction.models.map((m) => m.model);
        return {
          blocked: true,
          reason: `Contradiction detected: response contradicts unresolved claim involving ${models.join(", ")}`,
          type: "contradiction",
        };
      }
    }
  }

  return { blocked: false, reason: "", type: "none" };
}

/**
 * Check if jury is active for a session
 */
export function isJuryActive(sessionId: string): boolean {
  return !!activeIntervals[sessionId];
}

/**
 * Get jury status for a session
 */
export function getJuryStatus(sessionId: string): {
  active: boolean;
  lastTier1: Date | null;
  lastTier2: Date | null;
  lastTier3: Date | null;
  queuedResponses: number;
} {
  const timestamps = lastRunTimestamps[sessionId] || { tier1: null, tier2: null, tier3: null };
  return {
    active: isJuryActive(sessionId),
    lastTier1: timestamps.tier1,
    lastTier2: timestamps.tier2,
    lastTier3: timestamps.tier3,
    queuedResponses: responseQueues[sessionId]?.length || 0,
  };
}

/**
 * Parse JSON from an AI model response, handling markdown code blocks
 */
export function parseJsonResponse(content: string): Tier1Result | Tier2Result | Tier3Result | null {
  try {
    return JSON.parse(content);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through
      }
    }

    // Try finding JSON object in content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Fall through
      }
    }

    return null;
  }
}
