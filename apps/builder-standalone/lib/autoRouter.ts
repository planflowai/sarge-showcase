/**
 * Auto Model Router — assigns best models to chain steps based on
 * difficulty tier, step role, and Forge Trials scorecard data.
 *
 * Three routing modes:
 *   score  — highest scoring model per step role + difficulty
 *   cost   — cheapest model scoring 80+ on relevant rounds
 *   quality — highest scoring model regardless of cost
 *
 * Difficulty tiers define which models are acceptable:
 *   easy   — local models OK
 *   medium — mixed local + cheap cloud
 *   hard   — cloud required (local only for Build step 1)
 *   expert — premium cloud only
 */

import type { ModelScorecard, RoundResult } from "@sarge/benchmark";

export type RoutingMode = "score" | "cost" | "quality" | "manual";

export interface ModelCandidate {
  id: string;
  provider: string;
  name: string;
}

export interface RouterResult {
  modelId: string;
  provider: string;
  modelName: string;
  score: number | null;
  costEstimate: number;
  reason: string;
}

// ── Step Role → Trial Round mapping ──

const ROLE_ROUND_MAP: Record<string, string[]> = {
  build:   ["cloud-r1-restaurant", "cloud-r8-autonomy"],
  improve: ["cloud-r3-saas", "cloud-r2-portfolio"],
  refine:  ["cloud-r5-dashboard", "cloud-r7-refactor"],
  polish:  ["cloud-r6-multipage", "cloud-r4-ecommerce"],
  check:   ["cloud-r7-refactor", "cloud-r8-autonomy"],
};

function getRoundsForRole(role: string): string[] {
  return ROLE_ROUND_MAP[role.toLowerCase()] || ROLE_ROUND_MAP["build"];
}

// ── Difficulty tier pools ──

/** Provider-tier fallback scores when no trial data exists */
const PROVIDER_TIER_SCORE: Record<string, number> = {
  // Expert tier — assumed 85+
  "anthropic:claude-sonnet-4-6-20250514": 90,
  "anthropic:claude-opus-4-6-20250514": 92,
  // Hard tier — assumed 75+
  "openai:gpt-4.1": 80,
  "google:gemini-2.5-pro": 82,
  "xai:grok-3": 78,
  // Medium tier — assumed 65+
  "deepseek:deepseek-chat": 72,
  "google:gemini-2.5-flash": 70,
  "openai:gpt-4.1-mini": 68,
  // Easy tier — assumed 50+
  "ollama:qwen2.5-coder:7b": 55,
  "ollama:deepseek-coder:6.7b": 52,
  "ollama:cogito:8b": 50,
  "ollama:mistral:7b": 48,
  "lmstudio:": 50,
};

function getFallbackScore(provider: string, modelId: string): number {
  // Exact match
  const exact = PROVIDER_TIER_SCORE[`${provider}:${modelId}`];
  if (exact != null) return exact;

  // Provider-level defaults
  if (provider === "anthropic") return 85;
  if (provider === "openai") return 75;
  if (provider === "google") return 72;
  if (provider === "xai") return 70;
  if (provider === "deepseek") return 70;
  if (provider === "mistral") return 65;
  if (provider === "groq") return 65;
  if (provider === "together") return 60;
  if (provider === "huggingface") return 60;
  if (provider === "ollama" || provider === "lmstudio") return 50;
  return 50;
}

function isLocal(provider: string): boolean {
  return provider === "ollama" || provider === "lmstudio";
}

/** Rough cost estimate per call by provider */
function estimateCost(provider: string): number {
  if (isLocal(provider)) return 0;
  if (provider === "deepseek") return 0.005;
  if (provider === "google") return 0.01;
  if (provider === "huggingface") return 0.005;
  if (provider === "groq") return 0.005;
  if (provider === "mistral") return 0.01;
  if (provider === "openai") return 0.04;
  if (provider === "anthropic") return 0.06;
  if (provider === "xai") return 0.03;
  return 0.02;
}

// ── Pool filter by difficulty ──

function isModelAllowedForDifficulty(
  provider: string,
  difficulty: string,
  stepRole: string,
  stepIndex: number,
): boolean {
  switch (difficulty) {
    case "easy":
      return true; // everything allowed
    case "medium":
      // Cloud required for Polish and Check
      if ((stepRole.toLowerCase() === "polish" || stepRole.toLowerCase() === "check") && isLocal(provider)) {
        return false;
      }
      return true;
    case "hard":
      // Local ONLY acceptable for Build step 1
      if (isLocal(provider) && !(stepRole.toLowerCase() === "build" && stepIndex === 0)) {
        return false;
      }
      return true;
    case "expert":
      // No local models on any step
      return !isLocal(provider);
    default:
      return true;
  }
}

// ── Score lookup ──

function getModelRoleScore(
  modelId: string,
  provider: string,
  role: string,
  localScorecards: ModelScorecard[],
  cloudScorecards: ModelScorecard[],
  localResults: RoundResult[],
  cloudResults: RoundResult[],
): number {
  const rounds = getRoundsForRole(role);
  const results = isLocal(provider) ? localResults : cloudResults;

  // Look up actual trial scores for this model on the mapped rounds
  const scores: number[] = [];
  for (const roundId of rounds) {
    const result = results.find(
      (r) => r.modelId === modelId && r.scenarioId === roundId && !r.timedOut && !r.error,
    );
    if (result) scores.push(result.score.total);
  }

  if (scores.length > 0) {
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // Fallback: overall scorecard score
  const scorecards = isLocal(provider) ? localScorecards : cloudScorecards;
  const sc = scorecards.find((s) => s.modelId === modelId);
  if (sc) return sc.overallScore;

  // Fallback: provider tier
  return getFallbackScore(provider, modelId);
}

// ── Main router ──

export function autoSelectModels(
  difficulty: string,
  steps: { role: string }[],
  routingMode: RoutingMode,
  availableModels: ModelCandidate[],
  localScorecards: ModelScorecard[],
  cloudScorecards: ModelScorecard[],
  localResults: RoundResult[],
  cloudResults: RoundResult[],
): RouterResult[] {
  const used = new Set<string>();
  const results: RouterResult[] = [];

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si];

    // Filter to allowed pool for this difficulty + step
    const pool = availableModels.filter((m) =>
      isModelAllowedForDifficulty(m.provider, difficulty, step.role, si),
    );

    if (pool.length === 0) {
      results.push({
        modelId: "",
        provider: "",
        modelName: "",
        score: null,
        costEstimate: 0,
        reason: "No models available for this difficulty",
      });
      continue;
    }

    // Score each candidate
    const scored = pool.map((m) => {
      const score = getModelRoleScore(
        m.id, m.provider, step.role,
        localScorecards, cloudScorecards, localResults, cloudResults,
      );
      const cost = estimateCost(m.provider);
      return { ...m, score, cost };
    });

    // Sort based on routing mode
    let sorted: typeof scored;
    switch (routingMode) {
      case "cost":
        // Cheapest model scoring 80+ (or best score if none hit 80)
        sorted = scored
          .filter((m) => m.score >= 80)
          .sort((a, b) => a.cost - b.cost || b.score - a.score);
        if (sorted.length === 0) {
          // No 80+ models — fall back to best score anyway
          sorted = scored.sort((a, b) => b.score - a.score);
        }
        break;
      case "quality":
        // Highest score regardless of cost
        sorted = scored.sort((a, b) => b.score - a.score);
        break;
      case "score":
      default:
        // Best score, prefer lower cost as tiebreaker
        sorted = scored.sort((a, b) => b.score - a.score || a.cost - b.cost);
        break;
    }

    // Pick best model not already used (if alternatives exist)
    let pick = sorted[0];
    for (const candidate of sorted) {
      const key = `${candidate.provider}:${candidate.id}`;
      if (!used.has(key)) {
        pick = candidate;
        break;
      }
    }

    const key = `${pick.provider}:${pick.id}`;
    used.add(key);

    results.push({
      modelId: pick.id,
      provider: pick.provider,
      modelName: pick.name,
      score: pick.score,
      costEstimate: pick.cost,
      reason: routingMode === "cost"
        ? `Cheapest ${pick.score >= 80 ? "80+" : "available"} for ${step.role}`
        : routingMode === "quality"
        ? `Highest quality for ${step.role}`
        : `Best score for ${step.role}`,
    });
  }

  return results;
}

// ── Difficulty-aware escalation ──

export function findEscalationModelFromPool(
  failedModelKey: string,
  stepRole: string,
  difficulty: string,
  stepIndex: number,
  usedModels: Set<string>,
  availableModels: ModelCandidate[],
  localScorecards: ModelScorecard[],
  cloudScorecards: ModelScorecard[],
  localResults: RoundResult[],
  cloudResults: RoundResult[],
): { modelId: string; provider: string; modelName: string } | null {
  // Get pool for current difficulty
  let pool = availableModels.filter((m) => {
    const key = `${m.provider}:${m.id}`;
    if (key === failedModelKey || usedModels.has(key)) return false;
    return isModelAllowedForDifficulty(m.provider, difficulty, stepRole, stepIndex);
  });

  // If current tier exhausted, try next tier up
  if (pool.length === 0 && difficulty !== "expert") {
    const nextTier = difficulty === "easy" ? "medium" : difficulty === "medium" ? "hard" : "expert";
    pool = availableModels.filter((m) => {
      const key = `${m.provider}:${m.id}`;
      if (key === failedModelKey || usedModels.has(key)) return false;
      return isModelAllowedForDifficulty(m.provider, nextTier, stepRole, stepIndex);
    });
  }

  // Last resort — any cloud model not yet used
  if (pool.length === 0) {
    pool = availableModels.filter((m) => {
      const key = `${m.provider}:${m.id}`;
      return key !== failedModelKey && !usedModels.has(key) && !isLocal(m.provider);
    });
  }

  if (pool.length === 0) return null;

  // Sort by trial score for this role
  const scored = pool.map((m) => ({
    ...m,
    score: getModelRoleScore(
      m.id, m.provider, stepRole,
      localScorecards, cloudScorecards, localResults, cloudResults,
    ),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  return { modelId: best.id, provider: best.provider, modelName: best.name };
}

/** Human-readable routing mode label for build log */
export function getRoutingLabel(mode: RoutingMode, difficulty: string): string {
  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  switch (mode) {
    case "score":
      return `\u26a1 Score Routed \u00b7 ${diffLabel}`;
    case "cost":
      return `\ud83d\udcb0 Cost Optimized \u00b7 ${diffLabel}`;
    case "quality":
      return `\ud83c\udfc6 Quality First \u00b7 ${diffLabel}`;
    case "manual":
      return `\u270b Manual \u00b7 Models selected by user`;
  }
}

/** Max cost target for difficulty tier */
export function getDifficultyCostTarget(difficulty: string): number {
  switch (difficulty) {
    case "easy": return 0.02;
    case "medium": return 0.08;
    case "hard": return 0.20;
    case "expert": return 0.50;
    default: return 0.20;
  }
}

/** Difficulty description */
export function getDifficultyDescription(difficulty: string): string {
  switch (difficulty) {
    case "easy": return "Local models acceptable";
    case "medium": return "Mixed local + cloud";
    case "hard": return "Cloud models required";
    case "expert": return "Premium cloud only";
    default: return "";
  }
}
