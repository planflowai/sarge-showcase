/**
 * Multi-Pass Consensus Handler
 *
 * Manages iterative fact-checking with consensus building and truth anchor locking.
 * Supports 3-5 passes per claim before determining consensus or marking as unresolved.
 */

import {
  detectToolCall,
  executeWebSearch,
  formatSearchResults,
  WEB_SEARCH_TOOL_INSTRUCTION,
  JUDGE_CONSENSUS_INSTRUCTION,
} from './ollamaWebSearch';

export interface TruthAnchor {
  id: string;
  fact: string;
  lockedAt: string;
  lockedBy: 'judge';
  sourcePass: number;
  sources: string[];
  confidence: number;
}

export interface ConsensusState {
  claimId: string;
  claim: string;
  currentPass: number;
  maxPasses: number;
  agentResponses: Map<string, string[]>; // agent -> responses per pass
  searchResults: string[];
  consensus: 'pending' | 'locked' | 'unresolved';
  lockedFact?: string;
  unresolvedReason?: string;
}

// Storage key for truth anchors
const TRUTH_ANCHORS_KEY = 'sarge_truth_anchors';

/**
 * Load truth anchors from localStorage
 */
export function loadTruthAnchors(): TruthAnchor[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(TRUTH_ANCHORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save truth anchors to localStorage
 */
export function saveTruthAnchors(anchors: TruthAnchor[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRUTH_ANCHORS_KEY, JSON.stringify(anchors));
  } catch (error) {
    console.error('[TruthAnchors] Failed to save:', error);
  }
}

/**
 * Add a new locked truth anchor
 */
export function addTruthAnchor(
  fact: string,
  sourcePass: number,
  sources: string[] = [],
  confidence: number = 100
): TruthAnchor {
  const anchors = loadTruthAnchors();

  const newAnchor: TruthAnchor = {
    id: crypto.randomUUID(),
    fact: fact.trim(),
    lockedAt: new Date().toISOString(),
    lockedBy: 'judge',
    sourcePass,
    sources,
    confidence,
  };

  // Avoid duplicates
  const exists = anchors.some(
    (a) => a.fact.toLowerCase() === fact.toLowerCase()
  );
  if (!exists) {
    anchors.push(newAnchor);
    saveTruthAnchors(anchors);
  }

  return newAnchor;
}

/**
 * Extract locked truth statements from judge output
 * Looks for: JUDGE LOCKED TRUTH: [fact]
 */
export function extractLockedTruths(judgeOutput: string): string[] {
  const pattern = /JUDGE LOCKED TRUTH:\s*\[?([^\]\n]+)\]?/gi;
  const matches: string[] = [];
  let match;

  while ((match = pattern.exec(judgeOutput)) !== null) {
    if (match[1]) {
      matches.push(match[1].trim());
    }
  }

  return matches;
}

/**
 * Extract unresolved claims from judge output
 * Looks for: UNRESOLVED: [claim] - [reason]
 */
export function extractUnresolved(
  judgeOutput: string
): { claim: string; reason: string }[] {
  const pattern = /UNRESOLVED:\s*\[?([^\]\-\n]+)\]?\s*-\s*(.+)/gi;
  const matches: { claim: string; reason: string }[] = [];
  let match;

  while ((match = pattern.exec(judgeOutput)) !== null) {
    if (match[1] && match[2]) {
      matches.push({
        claim: match[1].trim(),
        reason: match[2].trim(),
      });
    }
  }

  return matches;
}

/**
 * Format truth anchors as context for prompts
 */
export function formatAnchorsForPrompt(anchors: TruthAnchor[]): string {
  if (anchors.length === 0) {
    return '';
  }

  const formatted = anchors
    .map((a, i) => `${i + 1}. ${a.fact}`)
    .join('\n');

  return `
LOCKED TRUTH ANCHORS (verified facts - do NOT contradict):
${formatted}
`;
}

/**
 * Check if a claim contradicts existing anchors
 */
export function checkAnchorContradiction(
  claim: string,
  anchors: TruthAnchor[]
): { contradicts: boolean; conflictingAnchor?: TruthAnchor } {
  const claimLower = claim.toLowerCase();

  for (const anchor of anchors) {
    const anchorLower = anchor.fact.toLowerCase();

    // Simple keyword overlap check - could be enhanced with semantic similarity
    const anchorKeywords = anchorLower.split(/\s+/).filter((w) => w.length > 4);
    const claimKeywords = claimLower.split(/\s+/).filter((w) => w.length > 4);

    const overlap = anchorKeywords.filter((k) => claimKeywords.includes(k));

    // If significant overlap but different content, might be contradiction
    if (overlap.length >= 2) {
      // Check for negation patterns
      const negationPatterns = [
        /\bnot\b/,
        /\bno\b/,
        /\bnever\b/,
        /\bfalse\b/,
        /\bincorrect\b/,
        /\bwrong\b/,
      ];

      const claimHasNegation = negationPatterns.some((p) => p.test(claimLower));
      const anchorHasNegation = negationPatterns.some((p) =>
        p.test(anchorLower)
      );

      if (claimHasNegation !== anchorHasNegation) {
        return { contradicts: true, conflictingAnchor: anchor };
      }
    }
  }

  return { contradicts: false };
}

/**
 * Process a single pass with tool call support
 */
export async function processPassWithTools(
  agentResponse: string,
  passNumber: number
): Promise<{
  response: string;
  toolUsed: boolean;
  searchResults: string[];
}> {
  const searchResults: string[] = [];

  // Check for tool calls
  const query = detectToolCall(agentResponse);

  if (query) {
    const result = await executeWebSearch(query);
    const formatted = formatSearchResults(result);
    searchResults.push(formatted);

    // Return augmented response
    return {
      response: `${agentResponse}\n\n${formatted}`,
      toolUsed: true,
      searchResults,
    };
  }

  return {
    response: agentResponse,
    toolUsed: false,
    searchResults,
  };
}

/**
 * Create consensus state for a new claim evaluation
 */
export function createConsensusState(
  claim: string,
  maxPasses: number = 5
): ConsensusState {
  return {
    claimId: crypto.randomUUID(),
    claim,
    currentPass: 0,
    maxPasses,
    agentResponses: new Map(),
    searchResults: [],
    consensus: 'pending',
  };
}

/**
 * Update consensus state after a pass
 */
export function updateConsensusState(
  state: ConsensusState,
  agentId: string,
  response: string,
  searchResults: string[] = []
): ConsensusState {
  const responses = state.agentResponses.get(agentId) || [];
  responses.push(response);

  const newState = {
    ...state,
    currentPass: state.currentPass + 1,
    agentResponses: new Map(state.agentResponses),
    searchResults: [...state.searchResults, ...searchResults],
  };

  newState.agentResponses.set(agentId, responses);

  return newState;
}

/**
 * Finalize consensus - called after judge evaluation
 */
export function finalizeConsensus(
  state: ConsensusState,
  judgeOutput: string,
  anchors: TruthAnchor[]
): ConsensusState {
  const lockedTruths = extractLockedTruths(judgeOutput);
  const unresolved = extractUnresolved(judgeOutput);

  if (lockedTruths.length > 0) {
    // Check for contradictions before locking
    for (const fact of lockedTruths) {
      const { contradicts, conflictingAnchor } = checkAnchorContradiction(
        fact,
        anchors
      );

      if (contradicts) {
        return {
          ...state,
          consensus: 'unresolved',
          unresolvedReason: `Contradicts existing anchor: "${conflictingAnchor?.fact}"`,
        };
      }

      // Lock the truth
      addTruthAnchor(fact, state.currentPass, [], 100);
    }

    return {
      ...state,
      consensus: 'locked',
      lockedFact: lockedTruths[0],
    };
  }

  if (unresolved.length > 0) {
    return {
      ...state,
      consensus: 'unresolved',
      unresolvedReason: unresolved[0].reason,
    };
  }

  // If max passes reached without consensus
  if (state.currentPass >= state.maxPasses) {
    return {
      ...state,
      consensus: 'unresolved',
      unresolvedReason: 'Maximum passes reached without consensus',
    };
  }

  return state;
}

// Re-export for convenience
export { WEB_SEARCH_TOOL_INSTRUCTION, JUDGE_CONSENSUS_INSTRUCTION };
