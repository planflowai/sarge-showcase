/**
 * Capability Event Bus
 *
 * Central communication hub for AI capability bricks.
 * Allows capabilities to emit events and subscribe to others.
 *
 * Example flow:
 * 1. Builder sends user message
 * 2. Auto-Router emits "route_decision" event with selected model
 * 3. Orchestration layer listens, dispatches to correct model(s)
 * 4. Thread Guardian listens to "ai_response" events, tracks facts
 * 5. Forensic Log listens to all events, logs everything
 */

import { EVENT_BUS_MAX_HISTORY } from "./constants";

type EventCallback<T = unknown> = (data: T) => void;

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface CapabilityEvents {
  // Routing events
  'route:request': { message: string; context?: string };
  'route:decision': { tier: 1 | 2 | 3; model: string; provider: string; reason: string };

  // Orchestration events
  'orchestration:start': { mode: string; agents: string[] };
  'orchestration:agent_response': { agentId: string; response: string; model: string };
  'orchestration:complete': { finalResponse: string; mode: string };

  // Thread Guardian events
  'guardian:fact_added': { fact: string; confidence: number; source: string };
  'guardian:contradiction': { fact1: string; fact2: string; severity: 'low' | 'medium' | 'high' };
  'guardian:hallucination': { claim: string; reason: string };
  'guardian:health_update': { score: number; warnings: string[] };

  // Consensus events
  'consensus:start': { claim: string; passes: number };
  'consensus:pass_complete': { passNumber: number; result: string; sources: string[] };
  'consensus:locked': { fact: string; confidence: number };
  'consensus:unresolved': { claim: string; reason: string };

  // Forensic logging events
  'forensic:entry': { category: string; event: string; data: unknown };
  'forensic:warning': { message: string; severity: 'low' | 'medium' | 'high' };

  // Safety events
  'safety:fallback_triggered': { failedModel: string; fallbackModel: string; reason: string };
  'safety:rollback_available': { checkpointId: string; timestamp: number };
  'safety:rollback_executed': { checkpointId: string };
  'safety:air_gap_blocked': { blockedAction: string; reason: string };

  // Builder events
  'builder:message_sent': { message: string; timestamp: number };
  'builder:code_generated': { code: string; language: string; timestamp: number };
  'builder:code_applied': { filePath: string; action: 'created' | 'modified' };

  // Helper events
  'helper:triggered': { helperId: string; helperType: string };
  'helper:response': { helperId: string; response: string };

  // ============================================================================
  // ASSET GENERATION EVENTS (NEW)
  // ============================================================================
  'asset:generate_start': {
    type: 'sprite' | 'background' | 'ui' | 'tileset' | 'icon' | 'card';
    prompt: string;
    style?: string;
  };
  'asset:generated': {
    url: string;
    type: 'sprite' | 'background' | 'ui' | 'tileset' | 'icon' | 'card';
    prompt: string;
    width?: number;
    height?: number;
    isMock?: boolean;  // True if using fallback placeholder
  };
  'asset:generation_failed': {
    error: string;
    fallbackUrl?: string;
    type: string;
    prompt: string;
  };
  'asset:batch_complete': {
    assets: Array<{ url: string; type: string }>;
    totalCount: number;
  };

  // ============================================================================
  // STYLE GUIDE EVENTS (NEW)
  // ============================================================================
  'style:locked': {
    palette: string[];
    artStyle: string;
    theme?: string;
  };
  'style:violation': {
    element: string;
    reason: string;
    suggestedFix?: string;
  };
  'style:updated': {
    field: 'palette' | 'artStyle' | 'theme';
    oldValue: unknown;
    newValue: unknown;
  };

  // ============================================================================
  // DOCUMENT GENERATION EVENTS (NEW)
  // ============================================================================
  'document:generate_start': {
    type: 'lore' | 'character' | 'quest' | 'dialogue' | 'item' | 'narrative';
    context?: string;
  };
  'document:generated': {
    type: string;
    content: string;
    title?: string;
    metadata?: Record<string, unknown>;
  };
  'document:saved': {
    id: string;
    type: string;
    title: string;
  };

  // ============================================================================
  // CROSS-CHECKER EVENTS (NEW - formalizing existing)
  // ============================================================================
  'crosscheck:start': {
    models: string[];
    claim: string;
    context?: string;
  };
  'crosscheck:result': {
    model: string;
    agrees: boolean;
    reasoning: string;
  };
  'crosscheck:complete': {
    consensus: boolean;
    agreementCount: number;
    totalModels: number;
    results: Record<string, { agrees: boolean; reasoning: string }>;
  };

  // General
  'capability:enabled': { capabilityId: string };
  'capability:disabled': { capabilityId: string };
  'error': { source: string; message: string; error?: unknown };
}

export type CapabilityEventName = keyof CapabilityEvents;

// ============================================================================
// EVENT BUS IMPLEMENTATION
// ============================================================================

class CapabilityEventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private history: Array<{ event: string; data: unknown; timestamp: number }> = [];
  private maxHistorySize = EVENT_BUS_MAX_HISTORY;

  /**
   * Subscribe to an event
   */
  on<E extends CapabilityEventName>(
    event: E,
    callback: EventCallback<CapabilityEvents[E]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback);
    };
  }

  /**
   * Subscribe to an event, auto-unsubscribe after first trigger
   */
  once<E extends CapabilityEventName>(
    event: E,
    callback: EventCallback<CapabilityEvents[E]>
  ): () => void {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Emit an event
   */
  emit<E extends CapabilityEventName>(event: E, data: CapabilityEvents[E]): void {
    // Log to history
    this.history.push({
      event,
      data,
      timestamp: Date.now(),
    });

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    // Notify listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] Error in listener for ${event}:`, error);
        }
      });
    }

    // Also emit to wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => {
        try {
          callback({ event, data });
        } catch (error) {
          console.error(`[EventBus] Error in wildcard listener:`, error);
        }
      });
    }

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[EventBus] ${event}`, data);
    }
  }

  /**
   * Subscribe to ALL events (wildcard)
   */
  onAny(callback: (payload: { event: string; data: unknown }) => void): () => void {
    if (!this.listeners.has('*')) {
      this.listeners.set('*', new Set());
    }
    this.listeners.get('*')!.add(callback as EventCallback);

    return () => {
      this.listeners.get('*')?.delete(callback as EventCallback);
    };
  }

  /**
   * Get event history
   */
  getHistory(filter?: { event?: string; since?: number }): typeof this.history {
    let result = [...this.history];

    if (filter?.event) {
      result = result.filter((h) => h.event === filter.event);
    }

    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter((h) => h.timestamp >= since);
    }

    return result;
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get listener count for debugging
   */
  getListenerCount(event?: string): number {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }
    let total = 0;
    this.listeners.forEach((set) => {
      total += set.size;
    });
    return total;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

// Create singleton instance
const capabilityEventBus = new CapabilityEventBus();

// Export both the instance and the class for testing
export { capabilityEventBus, CapabilityEventBus };
export default capabilityEventBus;

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useEffect, useState, useCallback } from 'react';

/**
 * Hook to subscribe to capability events
 */
export function useCapabilityEvent<E extends CapabilityEventName>(
  event: E,
  callback: EventCallback<CapabilityEvents[E]>,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const unsubscribe = capabilityEventBus.on(event, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

/**
 * Hook to get the latest value of an event
 */
export function useCapabilityEventValue<E extends CapabilityEventName>(
  event: E,
  initialValue?: CapabilityEvents[E]
): CapabilityEvents[E] | undefined {
  const [value, setValue] = useState<CapabilityEvents[E] | undefined>(initialValue);

  useEffect(() => {
    const unsubscribe = capabilityEventBus.on(event, (data) => {
      setValue(data);
    });
    return unsubscribe;
  }, [event]);

  return value;
}

/**
 * Hook to emit capability events
 */
export function useCapabilityEmit(): <E extends CapabilityEventName>(
  event: E,
  data: CapabilityEvents[E]
) => void {
  return useCallback((event, data) => {
    capabilityEventBus.emit(event, data);
  }, []);
}

/**
 * Hook to get event history
 */
export function useCapabilityHistory(
  filter?: { event?: string; since?: number }
): ReturnType<typeof capabilityEventBus.getHistory> {
  const [history, setHistory] = useState(() => capabilityEventBus.getHistory(filter));

  useEffect(() => {
    // Update history when any event occurs
    const unsubscribe = capabilityEventBus.onAny(() => {
      setHistory(capabilityEventBus.getHistory(filter));
    });
    return unsubscribe;
  }, [filter]);

  return history;
}
