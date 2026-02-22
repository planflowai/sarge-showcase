# SARGE Platform — Master Reference Document
> **Last updated:** 2026-02-20 | **Build status:** ✅ Clean | **TypeScript:** ✅ 0 app errors

S.A.R.G.E. (Self-Adaptive Reasoning & Generation Engine) is a local-first, model-agnostic AI workbench that replaces paid tools (Claude.ai, Pinegrow, Claude Code) with a single free application supporting any model provider.

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Pages & Tabs](#pages--tabs)
3. [API Routes](#api-routes)
4. [Zustand Stores](#zustand-stores)
5. [AI Providers & Models](#ai-providers--models)
6. [Environment Variables](#environment-variables)
7. [Key Constants](#key-constants)
8. [Architecture Notes](#architecture-notes)
9. [Known Bugs & Incomplete Features](#known-bugs--incomplete-features)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (target ES2020, strict mode) |
| React | React 19.2.3 |
| State | Zustand 5.0.10 (43 stores, localStorage persist) |
| Styling | Tailwind CSS 4 |
| UI Primitives | Radix UI (accordion, dialog, dropdown, tabs, tooltip, separator, scroll-area, resizable) |
| Icons | Lucide React |
| Code Editor | Monaco Editor (@monaco-editor/react) |
| Layout | React Resizable Panels |
| Markdown | React Markdown + React Syntax Highlighter |
| AI SDKs | @anthropic-ai/sdk, openai, @google/generative-ai |
| Backend Sync | Supabase JS |
| Export | jsPDF, jszip, PapaParse |
| Dev Server | Port 5000 (app), 11434 (Ollama), 1234 (LM Studio) |

## Pages & Tabs

### 1. Chat (Home)
- **Route:** /
- **File:** app/page.tsx
- **Status:** Working
- **Description:** Primary conversation interface. Supports multi-model streaming chat, voice I/O, parallel side-by-side model comparison, debate overlay, test mode overlay, and forensic logging. Auto-creates a new conversation on first visit.
- **Key Components:** ChatView, DebateView, TestModeView, ForensicLogView, ParallelChatView, InputArea, MessageList
- **API Routes:** /api/chat, /api/status, /api/voice-key, /api/web-search

---

### 2. Dashboard
- **Route:** /dashboard
- **File:** app/dashboard/page.tsx
- **Status:** Working
- **Description:** Landing page with animated grid background. Displays the 16-module grid (from MODULES_DATA array), dynamic provider status cards (API key detected + model count from live store), Thread Guardian stats, and platform stats. All stats derived from live store state.
- **Key Components:** Module grid, Provider status cards, Guardian stats card
- **API Routes:** /api/status, /api/models/scan

---

### 3. Debate Arena
- **Route:** / (overlay on chat)
- **File:** components/DebateView/
- **Status:** Working
- **Description:** Multi-agent debate system. Up to 4 agents (D1/D2/D3 + Judge) debate a user question across configurable rounds. Produces a structured verdict with confidence score and executive summary. Full transcript saved to debate history.
- **Key Components:** DebateView, DebateSetup, AgentPanel, VerdictPanel, JuryGuardianCard
- **API Routes:** /api/test/completion, /api/jury-guardian
- **Stores:** debateStore, debateHistoryStore, juryGuardianStore

---

### 4. Test Mode
- **Route:** / (overlay)
- **File:** components/TestModeView/
- **Status:** Working
- **Description:** D1/D2/D3 tribunal with configurable AI slots. Tests model robustness against poison pill injection. Three passes: Unfiltered baseline, Pill injected, Protected with defensive prompts. Outputs catch/echo/miss verdicts with metrics.
- **API Routes:** /api/test/completion, /api/test/stream, /api/test/status
- **Store:** testModeStore

---

### 5. Journal
- **Route:** /journal
- **File:** app/journal/page.tsx
- **Status:** Working
- **Description:** 3-column prompt effectiveness tracker (Chat 30% | Analysis 35% | Notepad 35%). Users chat with AI while analysis panel scores the conversation for clarity and effectiveness.
- **Key Components:** JournalChatPanel, AnalysisPanel, JournalNotepad
- **API Routes:** /api/chat, /api/journal/chat, /api/journal/analyze
- **Store:** journalStore

---

### 6. AI Builder
- **Route:** /builder
- **File:** app/builder/page.tsx -> components/Builder/BuilderPage.tsx
- **Status:** PARTIAL (Phase 2 in progress)
- **Description:** Full-screen code generation environment replacing Pinegrow + Claude Code. Three-panel layout: slim sidebar (model selector + file explorer) | chat | artifact panel (code/preview/diff). Vault/guardian context injected into system prompt invisibly.
- **Key Components:**
  - BuilderPage.tsx - 3-panel layout, drag-resize
  - BuilderSidebar.tsx - model selector + file tree (tooltip Y-tracked via getBoundingClientRect)
  - BuilderChat.tsx - isolated streaming chat, artifact card emission
  - ArtifactPanel.tsx - Monaco editor + iframe preview + diff viewer
  - BuilderTerminal.tsx - sandboxed shell (OS detection via navigator.userAgent, 30s timeout, Kill button)
  - FileTree.tsx / FileExplorer.tsx - project file navigator
  - ArtifactCard.tsx - compact code card in chat
  - BuilderDiffEditor.tsx - Monaco diff view
  - contentDetector.ts - HTML vs React vs snippet detection
- **API Routes:** /api/builder/* (11 routes), /api/chat
- **Stores:** builderStore, builderChatStore, artifactStore, builderModeStore
- **Phase 2 remaining:** Live streaming preview, artifact versioning diff, zero-code-in-chat enforcement
- **Phase 3 pending:** AI file operations apply/reject, dev server iframe integration

---

### 7. Prompt Optimizer
- **Route:** /optimize
- **File:** app/optimize/page.tsx
- **Status:** Working
- **Description:** Two-tab optimization tool. AI tab analyzes test history and recommends model swaps. Logic tab displays raw batch/test performance data. No Math.random() - all data from stores.
- **API Routes:** /api/chat
- **Stores:** testModeStore, debateHistoryStore

---

### 8. Review
- **Route:** /review
- **File:** app/review/page.tsx
- **Status:** Working
- **Description:** Batch results deep-dive. Left sidebar lists all batch runs. Right panels: Verdict (CAUGHT/MISSED rates), Evidence (data-driven proof), Lifecycle (per-test timeline), Conversation Shift (poison spread analysis), Kill Mechanism analysis.
- **API Routes:** /api/chat
- **Stores:** testModeStore, debateHistoryStore

---

### 9. AI Analysis
- **Route:** /ai-analysis
- **File:** app/ai-analysis/page.tsx
- **Status:** Working
- **Description:** Six-tab meta-analysis hub. Each tab surfaces AI-generated analysis of a specific module: Chat transcripts, Debate verdicts, Test results, Batch comparisons, Forensic chain, Review summaries.
- **API Routes:** /api/chat, /api/journal/analyze
- **Store:** aiAnalysisStore

---

### 10. Live Checker
- **Route:** /live-checker
- **File:** app/live-checker/page.tsx
- **Status:** Working
- **Description:** Real-time fact verification. Multi-agent pipeline (search, verify, cross-check, judge) returns VERIFIED/UNVERIFIED/INCONCLUSIVE with confidence % and reasoning. Uses numbered capture groups in regex for TS compatibility.
- **API Routes:** /api/search/tavily, /api/web-fetch, /api/chat

---

### 11. Real World
- **Route:** /real-world
- **File:** app/real-world/page.tsx
- **Status:** Working
- **Description:** Business document simulation. Generates invoices and expense reports with embedded violations. Staff roster with approval limits and truth anchors.
- **API Routes:** /api/chat, /api/test/completion

---

### 12. Research
- **Route:** /research
- **File:** app/research/page.tsx
- **Status:** Working
- **Description:** Market research dashboard. Enter stock symbol, get news + sentiment + catalysts + BULLISH/BEARISH/NEUTRAL recommendation.
- **API Routes:** /api/research, /api/web-search, /api/search/tavily

---

### 13. Prompt Library
- **Route:** /library
- **File:** app/library/page.tsx
- **Status:** Working
- **Description:** Central repository for test questions and poison pills by difficulty tier (easy/hard/batch/cloud). Full CRUD. Feeds Test Mode and Batch Mode.
- **Stores:** testModeStore, promptLibraryStore

---

### 14. Diagnostics
- **Route:** /diagnostics
- **File:** app/diagnostics/page.tsx
- **Status:** Working
- **Description:** Self-healing code scanner. Configurable depth. Scans for errors/warnings/enhancements/security issues. AI proposes fixes. Apply or reject per-finding. Full rollback via snapshots. Changelog exported to markdown.
- **API Routes:** /api/diagnostics/scan, /api/diagnostics/analyze, /api/diagnostics/fix, /api/diagnostics/rollback, /api/diagnostics/custom-request
- **Store:** diagnosticsStore

---

### 15. Settings
- **Route:** /settings
- **File:** app/settings/page.tsx (~1255 lines, down from 2317)
- **Status:** Working
- **Description:** Configuration hub with 14 sections. Lazy-loads heavy sub-sections via next/dynamic. Each sub-component is fully self-contained with its own store access.

Sections:
- General (inline) - Theme, default model
- Models (inline) - Per-provider model list, builder tags, nicknames
- Model Registry (ModelRegistry.tsx) - Detailed model configs
- Roll Call (RollCall.tsx) - Live-test all models for connectivity
- AI Orchestration (SettingsOrchestration.tsx) - AI mode, flow type, agent configs
- Thread Guardian (inline ThreadGuardianSettings) - Enable/disable, tier configs, stats
- Roles (inline) - Custom role definitions
- Prompts (inline) - Saved prompt templates
- Knowledge (SettingsKnowledge.tsx) - Vault documents (self-contained, owns hydration)
- Trading APIs (SettingsTradingAPIs.tsx) - API key info for Alpaca, Finnhub, Tavily
- Logic Editor (SettingsLogicEditor.tsx) - Debate prompt templates, review analysis prompts
- Questions (inline) - Test question management
- Poisons (inline) - Poison pill management
- Security (inline) - PIN lock setup/removal

- **API Routes:** /api/rollcall (Roll Call section)

---

### 16. Vault
- **Route:** /vault
- **File:** app/vault/page.tsx
- **Status:** Working
- **Description:** Full-featured file manager with 50MB localStorage limit. Drag-drop upload, search, filter, sort, grid/list toggle, metadata editor, file preview. Files attachable to chat.
- **Store:** vaultStore

---

### 17. Component Library
- **Route:** /component-library
- **File:** app/component-library/page.tsx
- **Status:** Working
- **Description:** Repository for reusable code components (React, HTML, CSS). Grid/list view, search, categories, favorites, import/export JSON. Components insertable into Builder.
- **Store:** componentLibraryStore

---

### 18. Demo
- **Route:** /demo
- **File:** app/demo/page.tsx
- **Status:** Working
- **Description:** 15-slide interactive product tour. Architecture, modules, providers, features, pipeline visualizations. Auto-advance or manual navigation.

---

### 19. Workspace (Future)
- **Route:** /workspace/studio, /workspace/preview
- **Status:** PLACEHOLDER - Phase 5 planned

---

## API Routes (39 total)

### Chat & Core
- GET  /api/status       - Platform health, truth lock, kill stats, air-gap (DNS to dns.google), uptime
- POST /api/chat         - Main streaming chat, routes by provider, SSE streaming
- POST /api/rollcall     - Direct model ping, no fallback, returns self-ID + latency
- GET  /api/health       - Service health check
- GET  /api/voice-key    - XTTS voice key retrieval

### Builder File Operations
- POST   /api/builder/check-folder    - Validate project directory
- POST   /api/builder/list-directory  - Recursive file tree (respects .gitignore)
- POST   /api/builder/read-file       - Read file content (.env* blocked)
- POST   /api/builder/write-file      - Write file (5MB limit, logs forensic event)
- POST   /api/builder/files           - Multi-file create/delete/rename
- DELETE /api/builder/files           - Delete files
- POST   /api/builder/create-project  - Scaffold new project
- GET    /api/builder/dev-status      - Check if dev server alive (port 5000)
- POST   /api/builder/preview         - Generate srcdoc preview with inlined CSS/JS
- POST   /api/builder/terminal        - Shell command (30s timeout, command blocklist)
- POST   /api/builder/update-log      - Append to BUILDER_LOG.md (truncate at newline)

### Diagnostics
- POST /api/diagnostics/scan           - Full codebase scan by severity
- POST /api/diagnostics/analyze        - AI analysis of findings
- POST /api/diagnostics/fix            - AI fix suggestion for user approval
- POST /api/diagnostics/rollback       - Restore file from snapshot
- POST /api/diagnostics/custom-request - Custom AI query against codebase

### Test & Evaluation
- POST /api/test/completion  - Single completion for D1/D2/D3/Judge slots
- POST /api/test/stream      - SSE streaming for live test mode
- GET  /api/test/status      - Test mode health
- GET  /api/test/batch-logs  - Batch history retrieval
- GET  /api/test/models      - Available models for test slots

### Guardian & Verification
- POST /api/thread-guardian  - Background conversation analysis (3-tier)
- POST /api/jury-guardian    - Debate jury coordination + verdict
- GET  /api/airgap           - Air-gap enabled/disabled + reason

### Content Generation & Search
- POST /api/image           - Image gen (DALL-E 3, Grok-2, Imagen 3.0)
- POST /api/web-search      - Search: Brave -> Google Custom -> SearXNG -> mock
- POST /api/search/tavily   - Tavily search (fact verification, research)
- POST /api/web-fetch       - Fetch URL, return markdown
- POST /api/research        - Market research: news + sentiment + recommendation

### Journal & Infrastructure
- POST /api/journal/chat         - Journal-specific chat context
- POST /api/journal/analyze      - AI effectiveness scoring
- POST /api/sync/reverse         - Push local state to Supabase
- GET  /api/models/scan          - Query Ollama localhost:11434
- POST /api/models/classify      - Classify model capability
- GET  /api/lmstudio/models      - Query LM Studio localhost:1234

---

## Zustand Stores (43 stores)

All use Zustand persist() to localStorage unless noted.

### Chat & Conversation
- messageStore       - Messages[], currentConversationId, thread state
- conversationStore  - Conversations[], current selection, CRUD
- draftStore         - Draft message, auto-save
- parallelChatStore  - Parallel mode enable, up to 4 column configs with model per column

### Model & Provider
- modelStore               - Custom models, nicknames, builder flags, voice persona
- modelRegistryStore       - Detailed model configs (maxTokens, temperature, contextWindow)
- providerStore            - Provider API keys, enabled flags
- settingsStore            - Theme, default provider/model, local endpoint
- aiModeStore              - AI mode, flow type, agent configs, presets
- saasStore                - SaaS provider key configs
- unifiedCapabilitiesStore - Model capability flags (builder, judge, analyzer)
- fallbackStore            - Fallback provider chain, retry history

### Builder
- builderStore          - Project path, file tree, current file, dirty flag
- builderChatStore      - Builder messages (isolated from main chat)
- artifactStore         - Code, language, title, version history (max 10)
- builderModeStore      - Sidebar visible, panel widths, active tab
- builderDocumentStore  - Open documents/tabs (Phase 5 multi-tab)
- builderHelpersStore   - AI helper suggestions, router decision display
- componentLibraryStore - Components, categories, favorites, import/export

### Testing & Debate
- testModeStore      - Test slots, questions, poisons, batch/test history (trim at 50), debate logic templates
- debateStore        - Debate setup, agents, running state, transcript, verdict
- debateHistoryStore - Debate transcripts, verdicts, summaries, export data
- journalStore       - Journal entries, notes, effectiveness ratings, AI analysis
- aiAnalysisStore    - Multi-tool analysis state (debate: 10, batch: 20, forensic: 500 limits)

### Security & Monitoring
- threadGuardianStore - Per-conversation ledger: facts, contradictions, hallucinations, save points, tier configs
- juryGuardianStore   - Jury results. MAX_ACTIVE_FACTS=50, MAX_SAVE_POINTS=10, MAX_ECHO_ALERTS=20
- forensicLogStore    - Forensic chain, blockchain hashes, timeline events, replay state
- pinStore            - PIN (SHA-256), unlock state, 30-min auto-lock
- airGapStore         - Air-gap enabled flag, network status

### Content & Knowledge
- vaultStore         - Files (name, size, type, content, metadata). 50MB total, 10MB per file
- knowledgeStore     - Knowledge documents, manual hydration pattern
- promptStore        - Saved prompt templates
- promptLibraryStore - Library organized by tier
- roleStore          - Custom roles with system prompts

### UI & Infrastructure
- uiStore           - Toast notifications (5s default), modals, loading state
- syncStatusStore   - Supabase sync status, last sync time
- diagnosticsStore  - Scan findings, changelog, snapshots (50 max), undo (10 levels)
- workspaceStore    - Workspace state, multi-project (Phase 5)
- feedbackStore     - User feedback, ratings

---

## AI Providers & Models

### Cloud Providers
| Provider  | ID         | Models                                                              | Image Gen         |
|-----------|------------|---------------------------------------------------------------------|-------------------|
| Anthropic | anthropic  | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5, claude-3-5-* | No                |
| OpenAI    | openai     | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1, o1-mini      | Yes (DALL-E 3)    |
| Google    | google     | gemini-2.0-flash, gemini-1.5-pro/flash, gemini-2.0-flash-thinking  | Yes (Imagen 3.0)  |
| xAI       | xai        | grok-2, grok-2-mini, grok-beta                                      | Yes (grok-2-image)|
| DeepSeek  | deepseek   | deepseek-chat, deepseek-coder, deepseek-reasoner                    | No                |

### Local Providers
| Provider  | ID         | Discovery            | Default Port |
|-----------|------------|----------------------|-------------|
| Ollama    | ollama     | Live /api/tags query | 11434       |
| LM Studio | lmstudio   | Live /v1/models      | 1234        |

### Builder-Eligible (auto-tagged)
All cloud models + local code models: qwen2.5-coder, deepseek-coder, codellama, starcoder, llama3.2:*
User can untag/retag any model.

### Air-Gap Compatibility
- Cloud providers (Anthropic/OpenAI/Google/xAI/DeepSeek): BLOCKED in air-gap mode
- Tavily/Brave/Google Search: BLOCKED in air-gap mode
- Supabase: Falls back to localStorage only
- Ollama / LM Studio / SearXNG: WORK in air-gap mode

---

## Environment Variables

### Cloud Provider Keys
ANTHROPIC_API_KEY       Claude models (sk-ant-...)
OPENAI_API_KEY          GPT models + DALL-E (sk-...)
GOOGLE_API_KEY          Gemini + Imagen (AIza...)
XAI_API_KEY             Grok models (xai-...)
DEEPSEEK_API_KEY        DeepSeek models

### Search & Data
TAVILY_API_KEY          Fact verification + live checker (tvly-...)
BRAVE_SEARCH_API_KEY    Web search (preferred)
GOOGLE_SEARCH_API_KEY   Google Custom Search (fallback)
GOOGLE_SEARCH_CX        Google Search Engine ID
FINNHUB_API_KEY         Market data (research tab)

### Trading
ALPACA_API_KEY          Stock trading (PK...)
ALPACA_SECRET_KEY       Alpaca secret
ALPACA_PAPER=true       Use paper trading (recommended)

### Local Infrastructure
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_LM_STUDIO_URL=http://localhost:1234
NEXT_PUBLIC_XTTS_URL    Voice synthesis endpoint
SEARXNG_URL             Local SearXNG instance (optional)

### Backend Sync (optional)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY

### Runtime Flags
SARGE_AIR_GAP=1         Force air-gap mode (blocks all cloud APIs)
BUILDER_PROJECTS_DIR    Root dir for Builder project picker
NODE_ENV=development

---

## Key Constants (lib/constants.ts)

ARTIFACT_MAX_VERSIONS = 10              Max version history per artifact
EVENT_BUS_MAX_HISTORY = 100             Max capability event bus entries
STREAMING_MIN_UPDATE_INTERVAL_MS = 300  Preview debounce interval (ms)
STREAMING_MIN_CONTENT_DELTA = 150       Min chars before preview update
SIDEBAR_HIDDEN_ROUTES = [/dashboard, /library, /review, /ai-analysis, /optimize, /diagnostics, /builder, /research]
AIR_GAP_CHECK_HOST = dns.google         DNS lookup for network detection

Other limits:
- vaultStore: 50MB total, 10MB per file
- pinStore: 30-minute auto-lock
- diagnosticsStore: 50 snapshots, 10 undo levels
- aiAnalysisStore: 10 debate, 20 batch, 500 forensic entries
- juryGuardianStore: MAX_ACTIVE_FACTS=50, MAX_SAVE_POINTS=10, MAX_ECHO_ALERTS=20
- Terminal route: 30s command timeout
- Builder write-file route: 5MB max

---

## Architecture Notes

### Security Model
- Builder sandbox: All file ops require projectPath validated per-request. .env* blocked globally.
- Terminal blocklist: rm, mv, sudo, git push, chmod, dd, mkfs blocked by regex.
- Air-gap mode: SARGE_AIR_GAP=1 or manual toggle blocks all cloud providers (503).
- PIN lock: SHA-256 hashed, 30-minute auto-lock.
- Forensic logging: All Builder write ops emit forensic events (blockchain-style hash chain).

### Context Injection
- Vault docs + Thread Guardian context prepended to SYSTEM PROMPT (invisible in chat UI).
- BuilderChat.tsx calls buildPromptWithContext() with plain userMessage only.
- lib/contextInjector.ts: Reads BUILDER_LOG.md, truncates at newline boundary (not mid-line).
- lib/capabilityOrchestrator.ts: Exports guardianAvailable boolean flag (false if Guardian init fails).

### Streaming
- Anthropic: SDK streaming stream.on(text, ...)
- OpenAI/xAI/DeepSeek: text/event-stream SSE
- Ollama: HTTP chunked streaming
- Preview debounce: 300ms interval, 150 char delta minimum (from lib/constants.ts)

### Thread Guardian Tiers
- Tier 1 (~Phi-3): Fast fact indexing every 2 min
- Tier 2 (~Phi-4): Deep analysis every 10 min (contradictions, hallucinations)
- Tier 3 (~Claude Opus): Save points every 4 hours

### Settings Page Split
- SettingsOrchestration.tsx: owns all useAIModeStore state
- SettingsTradingAPIs.tsx: purely static, no state
- SettingsLogicEditor.tsx: owns useTestModeStore debateLogic slice
- SettingsKnowledge.tsx: owns all useKnowledgeStore state + handles own hydration
- settingsStyles.ts: shared Tailwind class strings

### Storage Hierarchy
1. Browser localStorage - primary for all UI state (Zustand persist)
2. Supabase - optional backend sync with RLS
3. Disk - project files via Builder API routes only

---

## Known Bugs & Incomplete Features

### Critical: NONE
### High: NONE

### Phase 2 Builder (in progress)
- Artifact cards: zero-code-in-chat enforcement needs final audit in BuilderChat.tsx
- Live streaming preview: iframe srcdoc update loop not yet active during token streaming
- Artifact versioning diff: [Diff] button in update cards not wired to Monaco diff editor

### Phase 3 (pending)
- AI file operations (Apply/Reject flow for multi-file changes) not implemented
- Dev server iframe (switching from srcdoc to localhost:3000) not wired
- Multi-tab editor (builderDocumentStore exists but multi-tab UI not built)

### Phase 4/5 (backlog)
- Auto-changelog: BUILDER_LOG.md generation partially done, not triggered automatically
- Project templates: New Project picker not implemented
- Git integration: builderStore has dirty flag, no git UI
- Storage manager UI: lib/utils/storageManager.ts created, not wired into Settings
- Workspace studio/preview routes: placeholder pages only

### Pre-existing Non-blocking Issues
- __tests__/templateSelection.test.ts: 4 TypeScript errors (vitest not installed, stale mocks). Build unaffected.
- app/api/rollcall/route.ts: .substring(0, 100) used to truncate HTTP error body for error messages (low severity, not content logging).

### Hardcoded Defaults (Expected Behavior, Not Bugs)
- llama3.2:3b used as fallback default in parallelChatStore, debateStore, api/research/route.ts when Ollama unreachable.

---

## Changes vs Previous Version

| Area | Change |
|------|--------|
| ArtifactPanel.tsx | Fixed duplicate projectName identifier (prop vs store -> now storeProjectName) |
| tsconfig.json | Bumped target ES2017 -> ES2020 (enables modern JS features) |
| live-checker/page.tsx | Rewrote named capture group regex to numbered groups for TS compatibility |
| lib/constants.ts | NEW - centralized constants (artifact versions, event bus, streaming debounce, sidebar routes, DNS) |
| lib/utils/storageManager.ts | NEW - localStorage usage stats, clear/export/import utilities |
| SettingsOrchestration.tsx | NEW - extracted from settings page (owns useAIModeStore) |
| SettingsTradingAPIs.tsx | NEW - extracted from settings page (static, no state) |
| SettingsLogicEditor.tsx | NEW - extracted from settings page (owns useTestModeStore debateLogic) |
| SettingsKnowledge.tsx | NEW - extracted from settings page (owns useKnowledgeStore + hydration) |
| settingsStyles.ts | NEW - shared Tailwind class strings |
| app/settings/page.tsx | Reduced 2317 -> 1255 lines (46% reduction) |
| app/dashboard/page.tsx | Stats now dynamic: module count from MODULES_DATA.length, providers from live store |
| BuilderTerminal.tsx | OS detection via navigator.userAgent, Kill button, 30s timeout with elapsed counter |
| lib/contextInjector.ts | Truncates BUILDER_LOG.md at newline boundary |
| lib/capabilityOrchestrator.ts | Exports guardianAvailable boolean flag |
| BuilderChat.tsx | Vault/guardian context moved from user message to system prompt |
| BuilderSidebar.tsx | Tooltip Y tracked via getBoundingClientRect() (no hardcoded top: 50%) |
| Sidebar.tsx | Hidden routes from SIDEBAR_HIDDEN_ROUTES constant |
| app/api/status/route.ts | DNS check uses dns.google (not api.openai.com) |
| artifactStore.ts | Consumes ARTIFACT_MAX_VERSIONS from constants |
| capabilityEventBus.ts | Consumes EVENT_BUS_MAX_HISTORY from constants |
| ArtifactPanel.tsx | Consumes streaming constants from lib/constants.ts |

---

Generated by full codebase scan. Regenerate after significant changes.
