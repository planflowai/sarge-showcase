# AI Capabilities Architecture Plan

## For: Claude.ai / Grok 4.2 Planning Session

**Project:** AI Builder Pro - Unified AI Orchestration System
**Goal:** Make AI orchestration as easy as changing colors or adding text blocks
**Status:** Planning Phase - DO NOT BUILD YET

---

## Executive Summary

AI Builder Pro has **11 distinct AI orchestration systems** scattered across different pages. The goal is to unify them into **composable capability toggles** that any build can use.

**The Vision:**
- Building a chatbot? Toggle on Thread Guardian + Logging
- Building a doctor's page? Toggle on Consensus + Judge + Rollback
- Building a landing page? Just Auto-Router, fast and simple

**The Flex:** Other companies are building agentic AI as the product. We've built it as a **feature toggle**.

---

## Current AI Systems Inventory

### 1. AI Mode Store (Multi-Agent Orchestration)
**Location:** `lib/stores/aiModeStore.ts`

**What It Does:**
- Controls how AI agents work together
- Execution modes: Single, Sequential, Parallel
- Agent roles: Primary, Secondary, Critic, Synthesizer, Judge
- Presets: Single Local, Single Cloud, Hybrid, Dual Debate, Trio + Judge

**Key Types:**
```typescript
ExecutionMode = "local" | "cloud" | "hybrid"
FlowType = "sequential" | "parallel"
AgentConfig = { id, name, role, provider, model, systemPrompt, temperature, enabled }
JudgeConfig = { enabled, provider, model, criteria[], autoSelect }
```

**Presets Available:**
| Preset | Agents | Flow | Judge | Use Case |
|--------|--------|------|-------|----------|
| Single Local | 1 | N/A | No | Fast, free |
| Single Cloud | 1 | N/A | No | High quality |
| Hybrid | 2 | Sequential | No | Local + Cloud fallback |
| Dual Debate | 2 | Parallel | No | User picks best |
| Trio + Judge | 3+1 | Parallel | Yes | Consensus with judge |
| Code Review | 3 | Sequential | No | Generate → Review → Synthesize |

---

### 2. Thread Guardian (Conversation Monitoring)
**Location:** `lib/threadGuardian/`, `lib/stores/threadGuardianStore.ts`

**What It Does:**
- Passively monitors conversations in background
- Tracks facts, detects contradictions, flags hallucinations
- 3-tier system with escalation

**3-Tier Architecture:**
| Tier | Model | Interval | Token Capacity | Purpose |
|------|-------|----------|----------------|---------|
| Tier 1 | Phi-3 Mini | 4 min | 4K | Fast indexing, topic tracking |
| Tier 2 | Phi-4 | 10 min | 16K | Deep analysis, fact verification |
| Tier 3 | Claude Opus | 4 hours | 200K | Save points, comprehensive snapshot |

**Context Ledger Tracks:**
- Active facts (with confidence 0-1)
- Retired facts (superseded/corrected/contradicted)
- Topic index (what was discussed when)
- Contradictions detected
- Hallucinations flagged
- Drift alerts (topic changes)
- Model attribution (who said what)

**Capabilities:**
- Context injection (silently prepends to prompts)
- Health score calculation (0-100)
- Active warnings system
- Save point creation (Tier 3)

---

### 3. Consensus Handler (Fact Verification)
**Location:** `lib/tools/consensusHandler.ts`

**What It Does:**
- Multi-pass fact verification (3-5 passes)
- Web search integration for evidence
- Truth anchor locking (verified facts)
- Contradiction detection against locked facts

**Workflow:**
1. Create consensus state for a claim
2. Run 3-5 passes with different agents
3. Each agent can search web for evidence
4. Judge evaluates all responses
5. If consensus: `JUDGE LOCKED TRUTH: [fact]` → Truth anchor created
6. If no consensus: `UNRESOLVED: [claim] - [reason]`

**Truth Anchors:**
```typescript
TruthAnchor = {
  id, fact, lockedAt, lockedBy: 'judge',
  sourcePass, sources[], confidence
}
```

---

### 4. Builder Auto-Router (Smart Model Selection)
**Location:** `lib/builderAutoRouter.ts`

**What It Does:**
- Analyzes user's build request
- Selects appropriate model tier
- Keyword-based task detection

**3-Tier Model System:**
| Tier | Type | Models | Tasks |
|------|------|--------|-------|
| Tier 1 | Local | Phi-4, Llama, Mistral, Qwen, DeepSeek-Coder | Style changes, typos, minor edits |
| Tier 2 | Medium Cloud | DeepSeek V3, Gemini Flash, GPT-4o Mini | Add components, medium edits |
| Tier 3 | Heavy Cloud | Claude Sonnet 4, GPT-4o, Grok 3 | New builds, complex features |

**Task Detection Keywords:**
- Style: color, font, padding, margin, size, background, border...
- Content: change text, update title, rename, replace word...
- Fix: fix, typo, spelling, wrong, broken, bug, error...
- Add: add section, add form, add button, insert...
- Structural: build, create site, from scratch, redesign...
- Complex: routing, authentication, database, API, real-time...

---

### 5. Fallback System (Reliability)
**Location:** `lib/stores/fallbackStore.ts`

**What It Does:**
- Automatic retry on model failure
- Configurable fallback chains
- Circuit breaker pattern

**Configuration:**
```typescript
FallbackConfig = {
  enabled: boolean,
  maxRetries: 3,
  retryDelayMs: 1000,
  maxFallbackDepth: 3,
  circuitBreaker: { enabled, failureThreshold, resetTimeoutMs }
}
```

---

### 6. Forensic Log (Audit Trail)
**Location:** `lib/stores/forensicLogStore.ts`

**What It Does:**
- Comprehensive logging of all AI decisions
- Cryptographic chain integrity (blockchain-style)
- 7-year retention compliance
- Replay functionality

**Entry Structure:**
```typescript
ForensicLogEntry = {
  id, sequenceNumber, timestamp, sessionId,
  category, severity, event,
  input?, output?,
  aiDecision: { action, confidence, modelVersion, explanation, factors },
  actors: { aiSystem, humanUsers, overrideOccurred },
  dataLineage: { sources, transformations, validationChecks },
  compliance: { regulations, retentionUntil, auditReady },
  hash, previousHash
}
```

---

### 7. Knowledge Vault (RAG Context)
**Location:** `lib/stores/knowledgeStore.ts`

**What It Does:**
- Store documents for AI context
- Support: text, images, ZIP archives
- Inject into prompts as context

---

### 8. Web Search Tool (External Data)
**Location:** `lib/tools/ollamaWebSearch.ts`

**What It Does:**
- Web search capability for local models
- URL fetch capability
- Tool call detection in AI responses

---

### 9. Debate Orchestration (Adversarial AI)
**Location:** `lib/stores/debateStore.ts`

**What It Does:**
- 3-phase debate rounds: Research → Cross-Check → Judge
- Provider diversity enforcement
- Citation tracking (no reuse across rounds)
- Executive summary generation

**Judge Role (IMPORTANT - NOT winner picker):**
- Synthesizes all perspectives
- Identifies consensus points
- Flags unresolved disagreements
- Provides unbiased summary

---

### 10. Air-Gap Security
**Location:** `lib/stores/airGapStore.ts`

**What It Does:**
- Block all cloud API calls
- Force local-only operation
- Input/output sanitization mode

---

### 11. Builder Helpers (NEW - Just Built)
**Location:** `lib/stores/builderHelpersStore.ts`

**What It Does:**
- Add reviewers, judges, debaters during build
- Pre-built helper types: Reviewer, Judge, Designer, Devil's Advocate, Custom
- Trigger modes: After build, On demand, Continuous

---

## The Problem

Each system is **siloed**:
- Thread Guardian only works in Chat/Builder/Architect
- Consensus Handler only works in Debate
- Auto-Router only works in Builder
- Fallback only works when manually configured
- Forensic Log runs but isn't exposed
- Debate is its own separate page

**Users can't easily:**
- Add Thread Guardian to a Builder session
- Use Debate mode while building a page
- Turn on Consensus Handler for a medical site
- Mix and match capabilities

---

## The Solution: Unified AI Capabilities Panel

### Concept

Transform these 11 systems into **toggleable capabilities** accessible from any build context:

```
┌─────────────────────────────────────────┐
│ 🧠 AI Capabilities                      │
│                                         │
│ Orchestration:                          │
│ ○ Single Model (fast)                   │
│ ○ Dual Debate (2 perspectives)          │
│ ● Trio + Judge (consensus)              │
│                                         │
│ Monitoring:                             │
│ [x] Thread Guardian                     │
│ [x] Forensic Logging                    │
│                                         │
│ Verification:                           │
│ [ ] Consensus Lock (fact verification)  │
│ [x] Auto-Router (smart model selection) │
│                                         │
│ Safety:                                 │
│ [x] Fallback Chain                      │
│ [ ] Air-Gap Mode                        │
│ [ ] Rollback Enabled                    │
│                                         │
│ [Import Preset from Settings]           │
└─────────────────────────────────────────┘
```

### Capability Categories

**1. Orchestration (Mutually Exclusive)**
- Single Model
- Sequential Pipeline
- Parallel (Dual Debate)
- Parallel + Judge (Trio)

**2. Monitoring (Additive)**
- Thread Guardian (can combine with any orchestration)
- Forensic Logging (can combine with anything)

**3. Verification (Additive)**
- Consensus Handler (truth anchor locking)
- Auto-Router (smart model selection)
- Web Search (external verification)

**4. Safety (Additive)**
- Fallback Chain (retry on failure)
- Air-Gap Mode (no cloud)
- Rollback (undo bad generations)

### Dependencies

| Capability | Requires | Conflicts With |
|------------|----------|----------------|
| Trio + Judge | 3+ models | Single Model |
| Thread Guardian | Message store | Debate mode (excluded) |
| Consensus Lock | Judge model | - |
| Rollback | Forensic Log | - |
| Air-Gap | Local models available | Cloud orchestration modes |

### Use Case Presets

| Building... | Recommended Capabilities |
|-------------|-------------------------|
| Chatbot | Thread Guardian + Logging + Fallback |
| Doctor's Page | Consensus + Judge + Logging + Rollback |
| Landing Page | Auto-Router only (fast) |
| Complex App | Trio + Judge + Thread Guardian + Logging |
| High-Security | Air-Gap + Local Trio + Logging |

---

## Architecture Design

### New Store: `unifiedCapabilitiesStore.ts`

```typescript
interface UnifiedCapabilities {
  // Orchestration (mutually exclusive)
  orchestrationMode: 'single' | 'sequential' | 'parallel' | 'parallel_judge';

  // From AI Mode Store
  agents: AgentConfig[];
  judgeConfig?: JudgeConfig;
  flowType: FlowType;

  // Monitoring (additive toggles)
  threadGuardianEnabled: boolean;
  forensicLoggingEnabled: boolean;

  // Verification (additive toggles)
  consensusLockEnabled: boolean;
  autoRouterEnabled: boolean;
  webSearchEnabled: boolean;

  // Safety (additive toggles)
  fallbackEnabled: boolean;
  airGapEnabled: boolean;
  rollbackEnabled: boolean;

  // Preset management
  activePresetId: string | null;
  customPresets: CapabilityPreset[];

  // Actions
  setOrchestrationMode(mode): void;
  toggleCapability(capability: string, enabled: boolean): void;
  applyPreset(presetId: string): void;
  saveAsPreset(name: string): void;
  importFromAIModeStore(): void;
}
```

### UI Component: `AICapabilitiesPanel.tsx`

Location: Builder sidebar (collapsible section)

Features:
- Radio buttons for orchestration mode
- Checkboxes for additive capabilities
- Visual dependency indicators
- "Import from Settings" button (pulls AI Mode Store presets)
- Use case quick-select dropdown

### Integration Points

1. **BuilderChat.tsx** - Check capabilities before sending
2. **BuilderPage.tsx** - Display active capabilities
3. **Thread Guardian Engine** - Check if enabled in capabilities
4. **Forensic Log** - Check if enabled in capabilities
5. **Consensus Handler** - Check if enabled in capabilities
6. **API routes** - Respect capability settings

---

## Implementation Plan

### Phase 1: Unified Store (Foundation)
1. Create `unifiedCapabilitiesStore.ts`
2. Map existing stores to unified interface
3. Add import function for AI Mode Store presets
4. Add persistence (localStorage)

### Phase 2: Builder Integration
1. Create `AICapabilitiesPanel.tsx` component
2. Add to Builder sidebar
3. Wire up toggle state to actual systems
4. Add visual feedback for active capabilities

### Phase 3: Capability Enforcement
1. Update Thread Guardian to check unified store
2. Update Forensic Log to check unified store
3. Update Consensus Handler to check unified store
4. Update Fallback system to check unified store
5. Add rollback functionality to Builder

### Phase 4: Use Case Presets
1. Define preset templates for common use cases
2. Add quick-select UI
3. Allow custom preset creation
4. Add preset sharing/export

### Phase 5: Polish
1. Dependency visualization
2. Conflict warnings
3. Performance impact indicators
4. Documentation/tooltips

---

## Questions for Planning Session

1. **Orchestration Granularity:** Should users be able to pick exactly which models fill which roles, or just select a preset?

2. **Thread Guardian Scope:** Currently excluded from Debate mode. Should it be available everywhere?

3. **Rollback Implementation:** How far back should rollback go? Last generation only, or multiple steps?

4. **Preset Sharing:** Should presets be shareable between users (export/import)?

5. **Resource Indicators:** Should we show estimated API cost / token usage for each capability combination?

6. **Mobile/Responsive:** How should this panel behave on smaller screens?

7. **Onboarding:** How do we explain these capabilities to non-technical users?

---

## Success Criteria

1. **User can toggle capabilities in < 3 clicks**
2. **Building a chatbot vs doctor's page uses different AI automatically**
3. **All 11 existing systems accessible from unified panel**
4. **No breaking changes to existing functionality**
5. **Non-technical users understand what each toggle does**
6. **System prevents invalid combinations (conflicts)**

---

## Key Constraints

1. **Don't break existing pages** - Chat, Debate Arena, Settings must still work
2. **Don't remove existing UIs** - Just add unified access
3. **Respect air-gap mode** - Critical for security use cases
4. **Preserve forensic integrity** - Audit trail must remain intact
5. **Performance** - Don't slow down simple builds with unnecessary overhead

---

## Appendix: Existing File Locations

```
AI Orchestration:
├── lib/stores/aiModeStore.ts              # Multi-agent orchestration
├── lib/stores/threadGuardianStore.ts      # Thread Guardian state
├── lib/threadGuardian/engine.ts           # Thread Guardian execution
├── lib/threadGuardian/contextBuilder.ts   # Context injection
├── lib/tools/consensusHandler.ts          # Consensus + truth anchors
├── lib/builderAutoRouter.ts               # Smart model selection
├── lib/stores/fallbackStore.ts            # Fallback chains
├── lib/stores/airGapStore.ts              # Security mode
├── lib/stores/forensicLogStore.ts         # Audit logging
├── lib/stores/debateStore.ts              # Debate orchestration
├── lib/stores/knowledgeStore.ts           # Knowledge vault
├── lib/tools/ollamaWebSearch.ts           # Web search
└── lib/stores/builderHelpersStore.ts      # Builder helpers (NEW)

UI Components:
├── components/Builder/BuilderSidebar.tsx  # Where panel will go
├── components/Builder/BuilderChat.tsx     # Where capabilities are used
├── components/Builder/AIHelpersSection.tsx # Existing helper UI (NEW)
└── app/settings/page.tsx                  # Where presets are configured
```

---

**END OF PLANNING DOCUMENT**

This document should be provided to Claude.ai or Grok 4.2 for a comprehensive planning session before any code is written.
