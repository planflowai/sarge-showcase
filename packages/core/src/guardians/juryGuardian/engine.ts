"use client";

import { useJuryGuardianStore } from "../../stores/juryGuardianStore";
import type {
  PaneResponse,
  Tier1Result,
  Tier2Result,
  Tier3Result,
  JuryApiResponse,
} from "../../lib/types/juryGuardian";

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

// System prompts
const TIER1_SYSTEM_PROMPT = `You are a silent background monitor. Your ONLY job is to scan recent AI responses from multiple models and identify:
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

const TIER2_SYSTEM_PROMPT = `You are a review monitor. You verify findings from a fast scanner (Tier 1).
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

const TIER3_SYSTEM_PROMPT = `You are a deep auditor. You review the full shared context ledger and all findings from Tier 1 and Tier 2 monitors.
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
 * Run Tier 1 analysis
 */
export async function runTier1(sessionId: string): Promise<Tier1Result | null> {
  const store = useJuryGuardianStore.getState();
  if (!store.enabled || !store.tier1.enabled) return null;

  const lastRun = lastRunTimestamps[sessionId]?.tier1 || null;
  const newResponses = getNewResponses(sessionId, lastRun);

  // Skip if no new responses
  if (newResponses.length === 0) {
    console.log("[Jury Engine] Tier 1: No new responses, skipping");
    return null;
  }

  // Acquire mutex for local model
  const release = await acquireLocalModelLock();
  const startTime = Date.now();

  try {
    // Format responses for analysis
    const formattedResponses = newResponses
      .map((r) => `[PANE ${r.pane} - ${r.model}]\n${r.content}`)
      .join("\n\n---\n\n");

    const userContent = `Analyze these recent AI responses:\n\n${formattedResponses}`;

    const response = await callJuryApi(
      1,
      store.tier1.model,
      "ollama",
      userContent,
      TIER1_SYSTEM_PROMPT
    );

    const duration = Date.now() - startTime;

    if (!response.success || !response.result) {
      console.error("[Jury Engine] Tier 1 failed:", response.error);
      store.logTierRun(sessionId, 1, store.tier1.model, 0, false, duration);
      return null;
    }

    const result = response.result as Tier1Result;

    // Update last run timestamp
    if (!lastRunTimestamps[sessionId]) {
      lastRunTimestamps[sessionId] = { tier1: null, tier2: null, tier3: null };
    }
    lastRunTimestamps[sessionId].tier1 = new Date();

    // Process results - add to ledger
    if (!result.noFindings) {
      // Add facts
      result.factsFound?.forEach((f) => {
        store.addFact(sessionId, {
          fact: f.fact,
          sourceModel: f.sourceModel,
          sourcePane: f.sourcePane,
          timestamp: new Date(),
          verified: false,
          verifiedBy: [],
          confidence: f.confidence,
          citations: [],
        });
      });

      // Add contradictions
      result.contradictions?.forEach((c) => {
        store.addContradiction(sessionId, {
          claim: c.claim,
          models: c.models.map((m) => ({ model: m, pane: 0, position: c.description })),
          timestamp: new Date(),
          resolved: false,
        });

        // Toast for contradiction
        store.addToast({
          type: "contradiction",
          title: "Contradiction Detected",
          message: c.claim,
          sessionId,
          actions: [
            { label: "Dismiss", action: "dismiss" },
            { label: "View", action: "view" },
          ],
        });
      });

      // Add echo alert
      if (result.echoRisk?.detected) {
        store.addEchoAlert(sessionId, {
          claim: result.echoRisk.claim,
          agreeingModels: result.echoRisk.agreeingModels,
          confidence: result.echoRisk.confidence,
          timestamp: new Date(),
          dismissed: false,
        });

        // Toast for echo
        store.addToast({
          type: "echo",
          title: "Echo Chamber Risk",
          message: `${result.echoRisk.agreeingModels.length} models agreeing: ${result.echoRisk.claim}`,
          sessionId,
          actions: [
            { label: "Dismiss", action: "dismiss" },
            { label: "View", action: "view" },
          ],
        });
      }

      // Add drift alert
      if (result.driftDetected) {
        store.addDriftAlert(sessionId, {
          description: result.reason || "Topic drift detected",
          pane: 0,
          model: "multiple",
          timestamp: new Date(),
        });

        store.addToast({
          type: "drift",
          title: "Topic Drift",
          message: result.reason || "Conversation drifting from original topic",
          sessionId,
          actions: [{ label: "Dismiss", action: "dismiss" }],
        });
      }
    }

    // Log the run
    const findingsCount =
      (result.factsFound?.length || 0) +
      (result.contradictions?.length || 0) +
      (result.echoRisk?.detected ? 1 : 0) +
      (result.driftDetected ? 1 : 0);

    store.logTierRun(
      sessionId,
      1,
      store.tier1.model,
      findingsCount,
      result.escalateToTier2 || false,
      duration
    );

    // Escalate to Tier 2 if needed
    if (result.escalateToTier2) {
      console.log("[Jury Engine] Tier 1 escalating to Tier 2");
      // Run Tier 2 immediately (will queue behind mutex)
      setTimeout(() => runTier2(sessionId), 100);
    }

    return result;
  } finally {
    release();
  }
}

/**
 * Run Tier 2 analysis
 */
export async function runTier2(sessionId: string): Promise<Tier2Result | null> {
  const store = useJuryGuardianStore.getState();
  if (!store.enabled || !store.tier2.enabled) return null;

  const ledger = store.getLedger(sessionId);
  const lastRun = lastRunTimestamps[sessionId]?.tier2 || null;

  // Get Tier 1 findings since last Tier 2 run
  const recentTier1Logs = ledger.tierLog.filter(
    (l) => l.tier === 1 && (!lastRun || new Date(l.timestamp) > lastRun)
  );

  if (recentTier1Logs.length === 0) {
    console.log("[Jury Engine] Tier 2: No recent Tier 1 runs, skipping");
    return null;
  }

  // Acquire mutex
  const release = await acquireLocalModelLock();
  const startTime = Date.now();

  try {
    // Build context from ledger
    const tier1Summary = {
      contradictions: ledger.contradictions.filter((c) => !c.resolved).slice(-10),
      echoAlerts: ledger.echoAlerts.filter((e) => !e.dismissed).slice(-5),
      recentFacts: ledger.activeFacts.slice(-20),
      driftAlerts: ledger.driftAlerts.slice(-5),
    };

    const newResponses = getNewResponses(sessionId, lastRun);
    const formattedResponses = newResponses
      .map((r) => `[PANE ${r.pane} - ${r.model}]\n${r.content}`)
      .join("\n\n---\n\n");

    const userContent = `
Tier 1 Findings to Review:
${JSON.stringify(tier1Summary, null, 2)}

Recent Responses:
${formattedResponses}
`;

    const response = await callJuryApi(
      2,
      store.tier2.model,
      "ollama",
      userContent,
      TIER2_SYSTEM_PROMPT
    );

    const duration = Date.now() - startTime;

    if (!response.success || !response.result) {
      console.error("[Jury Engine] Tier 2 failed:", response.error);
      // Log raw content if available for debugging JSON parse errors
      if ((response as any).rawContent) {
        console.error("[Jury Engine] Tier 2 raw response:", (response as any).rawContent);
      }
      store.logTierRun(sessionId, 2, store.tier2.model, 0, false, duration);
      return null;
    }

    let result: Tier2Result;
    try {
      result = response.result as Tier2Result;
    } catch (error) {
      console.error("[Jury Engine] Tier 2 result casting failed:", error);
      store.logTierRun(sessionId, 2, store.tier2.model, 0, false, duration);
      return null;
    }

    // Update timestamp
    if (!lastRunTimestamps[sessionId]) {
      lastRunTimestamps[sessionId] = { tier1: null, tier2: null, tier3: null };
    }
    lastRunTimestamps[sessionId].tier2 = new Date();

    // Process corrections
    result.tier1Corrections?.forEach((correction) => {
      if (correction.action === "dismiss") {
        // Find and dismiss the alert
        ledger.echoAlerts.forEach((e) => {
          if (!e.dismissed && e.claim.includes(correction.originalFlag)) {
            store.dismissEchoAlert(sessionId, e.id);
          }
        });
      }
    });

    // Process verified facts
    result.verifiedFacts?.forEach((vf) => {
      // Update existing facts as verified
      ledger.activeFacts.forEach((f) => {
        if (f.fact.toLowerCase().includes(vf.fact.toLowerCase().slice(0, 50))) {
          store.updateLedger(sessionId, {
            activeFacts: ledger.activeFacts.map((af) =>
              af.id === f.id
                ? { ...af, verified: true, verifiedBy: vf.verifiedBy, confidence: vf.confidence }
                : af
            ),
          });
        }
      });
    });

    // Log the run
    const findingsCount =
      (result.tier1Corrections?.length || 0) + (result.verifiedFacts?.length || 0);

    store.logTierRun(
      sessionId,
      2,
      store.tier2.model,
      findingsCount,
      result.escalateToTier3 || false,
      duration
    );

    // Escalate to Tier 3 if needed
    if (result.escalateToTier3) {
      console.log("[Jury Engine] Tier 2 escalating to Tier 3");
      setTimeout(() => runTier3(sessionId), 100);
    }

    return result;
  } finally {
    release();
  }
}

/**
 * Run Tier 3 analysis (cloud model)
 */
export async function runTier3(sessionId: string): Promise<Tier3Result | null> {
  const store = useJuryGuardianStore.getState();
  if (!store.enabled || !store.tier3.enabled) return null;

  const ledger = store.getLedger(sessionId);
  const startTime = Date.now();

  try {
    // Get last save point
    const lastSavePoint = ledger.savePoints[ledger.savePoints.length - 1];
    const messageIdCutoff = lastSavePoint?.messageIdCutoff || "";

    // Build full context
    const context = {
      sessionId,
      activeFacts: ledger.activeFacts,
      contradictions: ledger.contradictions.filter((c) => !c.resolved),
      echoAlerts: ledger.echoAlerts.filter((e) => !e.dismissed),
      driftAlerts: ledger.driftAlerts,
      tierLog: ledger.tierLog.slice(-50),
      previousSavePoint: lastSavePoint?.summary || "No previous save point",
    };

    // Get responses since last save point
    const allResponses = responseQueues[sessionId] || [];
    const relevantResponses = messageIdCutoff
      ? allResponses.filter((r) => r.messageId > messageIdCutoff)
      : allResponses;

    const formattedResponses = relevantResponses
      .slice(-50) // Limit to avoid token overflow
      .map((r) => `[PANE ${r.pane} - ${r.model}]\n${r.content}`)
      .join("\n\n---\n\n");

    const userContent = `
Full Context Ledger:
${JSON.stringify(context, null, 2)}

Recent Responses (since last save point):
${formattedResponses || "No new responses"}
`;

    const response = await callJuryApi(
      3,
      store.tier3.model,
      store.tier3.provider || "anthropic",
      userContent,
      TIER3_SYSTEM_PROMPT
    );

    const duration = Date.now() - startTime;

    if (!response.success || !response.result) {
      console.error("[Jury Engine] Tier 3 failed:", response.error);
      store.logTierRun(sessionId, 3, store.tier3.model, 0, false, duration);
      return null;
    }

    const result = response.result as Tier3Result;

    // Update timestamp
    if (!lastRunTimestamps[sessionId]) {
      lastRunTimestamps[sessionId] = { tier1: null, tier2: null, tier3: null };
    }
    lastRunTimestamps[sessionId].tier3 = new Date();

    // Create save point
    const latestMessageId =
      relevantResponses[relevantResponses.length - 1]?.messageId || messageIdCutoff;

    store.createSavePoint(sessionId, {
      timestamp: new Date(),
      summary: result.summary,
      verifiedFacts: result.verifiedFacts,
      unresolvedItems: result.unresolvedItems,
      messageIdCutoff: latestMessageId,
      tokenCount: result.tokenCount || 0,
    });

    // Retire facts if specified
    result.retiredFacts?.forEach((rf) => {
      const factToRetire = ledger.activeFacts.find((f) =>
        f.fact.toLowerCase().includes(rf.fact.toLowerCase().slice(0, 50))
      );
      if (factToRetire) {
        store.retireFact(sessionId, factToRetire.id, rf.reason);
      }
    });

    // Toast for save point
    store.addToast({
      type: "info",
      title: "Save Point Created",
      message: `${result.verifiedFacts?.length || 0} verified facts, ${result.unresolvedItems?.length || 0} unresolved`,
      sessionId,
      actions: [{ label: "View", action: "view" }],
    });

    // Log the run
    store.logTierRun(sessionId, 3, store.tier3.model, result.verifiedFacts?.length || 0, false, duration);

    return result;
  } catch (error) {
    console.error("[Jury Engine] Tier 3 error:", error);
    return null;
  }
}

/**
 * Start the jury for a session
 */
export function startJury(sessionId: string): void {
  const store = useJuryGuardianStore.getState();
  if (!store.enabled) return;

  console.log(`[Jury Engine] Starting jury for session ${sessionId}`);

  // Initialize timestamps
  lastRunTimestamps[sessionId] = { tier1: null, tier2: null, tier3: null };

  // Initialize response queue
  responseQueues[sessionId] = [];

  // Clear any existing intervals
  stopJury(sessionId);

  // Start Tier 1 interval (180 seconds = 3 minutes)
  const tier1Interval = setInterval(() => {
    runTier1(sessionId);
  }, store.tier1.intervalSeconds * 1000);

  // Start Tier 2 interval (360 seconds = 6 minutes)
  const tier2Interval = setInterval(() => {
    runTier2(sessionId);
  }, store.tier2.intervalSeconds * 1000);

  // Start Tier 3 interval (4 hours)
  const tier3Interval = setInterval(() => {
    runTier3(sessionId);
  }, store.tier3.intervalSeconds * 1000);

  activeIntervals[sessionId] = {
    tier1: tier1Interval,
    tier2: tier2Interval,
    tier3: tier3Interval,
  };
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
 * Manually trigger Tier 3 (Vault Now)
 */
export function vaultNow(sessionId: string): Promise<Tier3Result | null> {
  console.log(`[Jury Engine] Manual vault triggered for session ${sessionId}`);
  return runTier3(sessionId);
}

/**
 * Run intervention check on a response
 * Returns whether response should be blocked (killed) before entering conversation history
 * This is a synchronous check using ledger data — no new AI call needed
 */
export function runInterventionCheck(
  sessionId: string,
  content: string,
  model: string
): { blocked: boolean; reason: string; type: "echo" | "contradiction" | "none" } {
  const store = useJuryGuardianStore.getState();

  // If intervention is disabled, allow response
  if (!store.behavior.interventionEnabled) {
    return { blocked: false, reason: "", type: "none" };
  }

  // Get the ledger for this session
  const ledger = store.getLedger(sessionId);

  // Check 1: Echo chamber detection
  const unresolved = ledger.echoAlerts.filter((alert) => !alert.dismissed);
  for (const alert of unresolved) {
    // Simple keyword matching: if content shares key terms with unresolved echo alert
    const alertKeywords = alert.claim
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    const contentKeywords = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);

    const overlap = alertKeywords.filter((k) => contentKeywords.includes(k));

    // If 2+ keywords overlap with unresolved echo alert, block it
    if (overlap.length >= 2) {
      return {
        blocked: true,
        reason: `Echo chamber detected: ${alert.agreeingModels.length} models (${alert.agreeingModels.join(", ")}) agree on unverified claim at ${Math.round(alert.confidence * 100)}% confidence`,
        type: "echo",
      };
    }
  }

  // Check 2: Contradiction detection with truth anchors
  // Dynamically import to avoid circular dependency issues
  try {
    // Try to load truth anchors from consensusHandler
    // This is a synchronous load from localStorage
    const consensusHandlerPath = "@/lib/tools/consensusHandler";

    // We'll use a direct approach: check if there are any truth anchors in the ledger
    // by checking contradictions that reference anchors
    const unresolvedContradictions = ledger.contradictions.filter((c) => !c.resolved);

    for (const contradiction of unresolvedContradictions) {
      // Simple keyword matching between response and contradiction claim
      const contradictionKeywords = contradiction.claim
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      const contentKeywords = content
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);

      const overlap = contradictionKeywords.filter((k) => contentKeywords.includes(k));

      // If significant overlap with unresolved contradiction, consider blocking
      if (overlap.length >= 2) {
        // Check for negation patterns to detect if content contradicts the anchor
        const negationPatterns = [/\bnot\b/, /\bno\b/, /\bnever\b/, /\bfalse\b/, /\bincorrect\b/, /\bwrong\b/];
        const contentHasNegation = negationPatterns.some((p) => p.test(content.toLowerCase()));
        const contradictionHasNegation = negationPatterns.some((p) => p.test(contradiction.claim.toLowerCase()));

        // If one has negation and the other doesn't (opposite claims), block
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
  } catch (error) {
    console.warn("[Jury Engine] Error during contradiction check:", error);
    // Continue — don't block on error
  }

  // No kill condition met
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
