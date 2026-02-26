/**
 * Capability Orchestrator
 *
 * Coordinates all enabled AI capabilities into a unified workflow.
 * This is the "brain" that connects the capability bricks.
 *
 * When a user sends a message:
 * 1. Check which capabilities are enabled
 * 2. Apply them in the correct order
 * 3. Route through the appropriate pipeline
 */

import { useUnifiedCapabilitiesStore, type CapabilityId } from '../stores/unifiedCapabilitiesStore';
import capabilityEventBus from './capabilityEventBus';

// ============================================================================
// TYPES
// ============================================================================

export interface OrchestratorInput {
  message: string;
  context?: string;
  projectPath?: string;
  currentFile?: string;
}

export interface OrchestratorOutput {
  response: string;
  model: string;
  provider: string;
  metadata: {
    orchestrationMode: string;
    capabilitiesUsed: CapabilityId[];
    routerDecision?: {
      tier: number;
      reason: string;
    };
    guardianHealth?: number;
    consensusLocked?: boolean;
    forensicEntryId?: string;
  };
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Whether the Thread Guardian store was successfully imported.
 * Set to false on first import failure; consumers can check before using guardian features.
 */
export let guardianAvailable = true;

/**
 * Get the currently enabled capabilities from the store
 */
export function getEnabledCapabilities(): CapabilityId[] {
  const state = useUnifiedCapabilitiesStore.getState();
  return Object.entries(state.capabilities)
    .filter(([_, capState]) => capState.enabled)
    .map(([id]) => id as CapabilityId);
}

/**
 * Check if a specific capability is enabled
 */
export function isCapabilityEnabled(id: CapabilityId): boolean {
  const state = useUnifiedCapabilitiesStore.getState();
  return state.capabilities[id]?.enabled ?? false;
}

/**
 * Get the current orchestration mode
 */
export function getOrchestrationMode(): string {
  return useUnifiedCapabilitiesStore.getState().orchestrationMode;
}

/**
 * Build the system prompt based on enabled capabilities
 */
export function buildEnhancedSystemPrompt(basePrompt: string): string {
  const enabled = getEnabledCapabilities();
  let enhancedPrompt = basePrompt;

  // Add Thread Guardian context injection point
  if (enabled.includes('thread_guardian')) {
    enhancedPrompt = `[GUARDIAN CONTEXT WILL BE INJECTED HERE]\n\n${enhancedPrompt}`;
  }

  // Add Consensus Lock instructions
  if (enabled.includes('consensus_lock')) {
    enhancedPrompt += `\n\n[CONSENSUS MODE ACTIVE]
When stating facts, especially in medical, legal, or financial contexts:
- Clearly distinguish between verified facts and opinions
- Note confidence levels for claims
- If uncertain, recommend verification`;
  }

  // Add rollback awareness
  if (enabled.includes('rollback')) {
    enhancedPrompt += `\n\n[ROLLBACK ENABLED]
All code changes are versioned. User can undo any change.`;
  }

  return enhancedPrompt;
}

/**
 * Determine the execution pipeline based on orchestration mode
 */
export function getExecutionPipeline(): {
  type: 'single' | 'sequential' | 'parallel' | 'parallel_judge';
  steps: string[];
} {
  const mode = getOrchestrationMode();

  switch (mode) {
    case 'single':
      return {
        type: 'single',
        steps: ['route', 'execute', 'respond'],
      };

    case 'sequential':
      return {
        type: 'sequential',
        steps: ['route', 'generate', 'review', 'synthesize', 'respond'],
      };

    case 'parallel':
      return {
        type: 'parallel',
        steps: ['route', 'execute_parallel', 'present_options', 'user_select'],
      };

    case 'parallel_judge':
      return {
        type: 'parallel_judge',
        steps: ['route', 'execute_parallel', 'judge_synthesize', 'respond'],
      };

    default:
      return {
        type: 'single',
        steps: ['route', 'execute', 'respond'],
      };
  }
}

/**
 * Pre-process a message through enabled capabilities
 * Called BEFORE sending to the AI
 */
export async function preprocessMessage(input: OrchestratorInput): Promise<{
  processedMessage: string;
  processedContext: string;
  selectedModel?: string;
  selectedProvider?: string;
}> {
  const enabled = getEnabledCapabilities();
  let processedMessage = input.message;
  let processedContext = input.context || '';

  // Emit event for tracking
  capabilityEventBus.emit('builder:message_sent', {
    message: input.message,
    timestamp: Date.now(),
  });

  // Auto-Router: Determine best model
  let selectedModel: string | undefined;
  let selectedProvider: string | undefined;

  if (enabled.includes('auto_router')) {
    // Import and use the existing auto-router
    const { analyzeTask } = await import('@sarge/builder');
    // Pass the message and null for currentCode (context not available here)
    const decision = await analyzeTask(input.message, null);

    selectedModel = decision.suggestedModel;
    selectedProvider = decision.suggestedProvider;

    capabilityEventBus.emit('route:decision', {
      tier: decision.tier,
      model: decision.suggestedModel,
      provider: decision.suggestedProvider,
      reason: decision.reason,
    });
  }

  // Knowledge Vault: Inject relevant documents
  if (enabled.includes('knowledge_vault')) {
    // TODO: Integrate with knowledgeStore
    // For now, this is a placeholder for RAG context injection
    const { useKnowledgeStore } = await import('../stores/knowledgeStore');
    const knowledgeState = useKnowledgeStore.getState();

    if (knowledgeState.documents.length > 0) {
      // Add document context (all documents are included)
      const docContext = knowledgeState.documents
        .slice(0, 5) // Limit to 5 documents to avoid context overflow
        .map(d => `[Document: ${d.name}]\n${d.content.slice(0, 500)}...`)
        .join('\n\n');

      if (docContext) {
        processedContext = `[KNOWLEDGE VAULT CONTEXT]\n${docContext}\n\n${processedContext}`;
      }
    }
  }

  // Thread Guardian: Get current context ledger state
  if (enabled.includes('thread_guardian')) {
    try {
      const { useThreadGuardianStore } = await import('../stores/threadGuardianStore');
      const guardianState = useThreadGuardianStore.getState();
      const activeConvoId = guardianState.activeConversationId;
      const currentLedger = activeConvoId ? guardianState.ledgers[activeConvoId] : null;

      if (currentLedger) {
        const activeFacts = currentLedger.activeFacts
          .filter(f => f.confidence > 0.7)
          .map(f => f.fact)
          .slice(0, 10);

        if (activeFacts.length > 0) {
          processedContext = `[THREAD GUARDIAN - Active Facts]\n${activeFacts.join('\n')}\n\n${processedContext}`;
        }

        // Emit health update with current facts count as a simple score
        capabilityEventBus.emit('guardian:health_update', {
          score: Math.min(100, activeFacts.length * 10),
          warnings: [],
        });
      }
    } catch (e) {
      guardianAvailable = false;
      console.warn('[Orchestrator] Thread Guardian not available:', e);
    }
  }

  return {
    processedMessage,
    processedContext,
    selectedModel,
    selectedProvider,
  };
}

/**
 * Post-process an AI response through enabled capabilities
 * Called AFTER receiving from the AI
 */
export async function postprocessResponse(
  response: string,
  input: OrchestratorInput
): Promise<{
  processedResponse: string;
  actions: Array<{ type: string; data: unknown }>;
}> {
  const enabled = getEnabledCapabilities();
  let processedResponse = response;
  const actions: Array<{ type: string; data: unknown }> = [];

  // Emit code generation event if response contains code
  if (response.includes('```')) {
    const codeMatch = response.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      capabilityEventBus.emit('builder:code_generated', {
        code: codeMatch[2],
        language: codeMatch[1] || 'plaintext',
        timestamp: Date.now(),
      });
    }
  }

  // Consensus Lock: Check for facts that need verification
  if (enabled.includes('consensus_lock')) {
    // Look for statements that might need consensus
    const factPatterns = [
      /(?:according to|studies show|research indicates|it is known that)\s+(.+?)[.!?]/gi,
      /(?:the fact is|in fact|actually)\s+(.+?)[.!?]/gi,
    ];

    for (const pattern of factPatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        actions.push({
          type: 'consensus_check',
          data: { claim: match[1] },
        });
      }
    }
  }

  // Forensic Logging: Log the interaction
  if (enabled.includes('forensic_log')) {
    capabilityEventBus.emit('forensic:entry', {
      category: 'ai_interaction',
      event: 'response_generated',
      data: {
        inputLength: input.message.length,
        outputLength: response.length,
        timestamp: Date.now(),
        capabilitiesActive: enabled,
      },
    });
  }

  // Rollback: Create checkpoint
  if (enabled.includes('rollback')) {
    const checkpointId = `cp_${Date.now()}`;
    capabilityEventBus.emit('safety:rollback_available', {
      checkpointId,
      timestamp: Date.now(),
    });
    actions.push({
      type: 'checkpoint_created',
      data: { checkpointId },
    });
  }

  return {
    processedResponse,
    actions,
  };
}

/**
 * Handle errors with fallback if enabled
 */
export async function handleErrorWithFallback(
  error: Error,
  input: OrchestratorInput,
  failedModel: string,
  failedProvider: string
): Promise<{
  shouldRetry: boolean;
  fallbackModel?: string;
  fallbackProvider?: string;
}> {
  const enabled = getEnabledCapabilities();

  if (!enabled.includes('fallback_chain')) {
    return { shouldRetry: false };
  }

  // Import fallback store
  try {
    const { useFallbackStore } = await import('../stores/fallbackStore');
    const fallbackState = useFallbackStore.getState();

    if (!fallbackState.enabled) {
      return { shouldRetry: false };
    }

    // Get fallback chain from modelChains config
    const modelKey = `${failedProvider}:${failedModel}`;
    const fallbackChain = fallbackState.config.modelChains?.[modelKey]?.fallbacks || [];
    const currentIndex = fallbackChain.findIndex(
      (f) => f.model === failedModel && f.provider === failedProvider
    );

    if (currentIndex < fallbackChain.length - 1) {
      const nextFallback = fallbackChain[currentIndex + 1];

      capabilityEventBus.emit('safety:fallback_triggered', {
        failedModel,
        fallbackModel: nextFallback.model,
        reason: error.message,
      });

      return {
        shouldRetry: true,
        fallbackModel: nextFallback.model,
        fallbackProvider: nextFallback.provider,
      };
    }
  } catch (e) {
    console.warn('[Orchestrator] Fallback store not available:', e);
  }

  return { shouldRetry: false };
}

/**
 * Check if an action should be blocked by air-gap mode
 */
export function checkAirGapBlocking(action: string): {
  blocked: boolean;
  reason?: string;
} {
  if (!isCapabilityEnabled('air_gap')) {
    return { blocked: false };
  }

  const blockedActions = [
    'cloud_api_call',
    'web_search',
    'external_fetch',
    'telemetry',
  ];

  if (blockedActions.includes(action)) {
    capabilityEventBus.emit('safety:air_gap_blocked', {
      blockedAction: action,
      reason: 'Air-gap mode is active. No external calls allowed.',
    });

    return {
      blocked: true,
      reason: 'Air-gap mode is active. No external calls allowed.',
    };
  }

  return { blocked: false };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const capabilityOrchestrator = {
  getEnabledCapabilities,
  isCapabilityEnabled,
  getOrchestrationMode,
  buildEnhancedSystemPrompt,
  getExecutionPipeline,
  preprocessMessage,
  postprocessResponse,
  handleErrorWithFallback,
  checkAirGapBlocking,
};

export default capabilityOrchestrator;
