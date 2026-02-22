/**
 * SARGE Tools Index
 *
 * Exports all tool utilities for local model web search and consensus handling.
 */

export {
  detectToolCall,
  executeWebSearch,
  formatSearchResults,
  processToolCalls,
  WEB_SEARCH_TOOL_INSTRUCTION,
  JUDGE_CONSENSUS_INSTRUCTION,
} from './ollamaWebSearch';

export type { WebSearchResult, ToolCall } from './ollamaWebSearch';

export {
  loadTruthAnchors,
  saveTruthAnchors,
  addTruthAnchor,
  extractLockedTruths,
  extractUnresolved,
  formatAnchorsForPrompt,
  checkAnchorContradiction,
  processPassWithTools,
  createConsensusState,
  updateConsensusState,
  finalizeConsensus,
} from './consensusHandler';

export type { TruthAnchor, ConsensusState } from './consensusHandler';
