# Pages Reference — SARGE Platform

All 21 routes with purposes, components, and API dependencies.

---

## 1. Chat (Home)
- **Route:** `/`
- **File:** `app/page.tsx`
- **Emoji:** 💬
- **Purpose:** Primary conversation interface supporting multi-model chat, debate overlay, test mode overlay, forensic logging, and side-by-side model comparison.
- **Key Components:** ChatView, DebateView, TestModeView, ForensicLogView, ParallelChatView, InputArea, MessageList
- **API Routes:** /api/chat, /api/status, /api/voice-key, /api/web-search
- **Stores:** messageStore, conversationStore, parallelChatStore, draftStore, threadGuardianStore, forensicLogStore

---

## 2. Dashboard
- **Route:** `/dashboard`
- **File:** `app/dashboard/page.tsx`
- **Emoji:** 📊
- **Purpose:** Landing page with animated grid background, 20-module grid display (5-col), 7 provider status cards (live model counts), Thread Guardian stats, and platform health metrics.
- **Key Components:** Module grid (MODULES_DATA — 20 modules), Provider status cards (7 providers including LM Studio), Guardian stats card, Dynamic stats
- **API Routes:** /api/status, /api/models/scan, /api/lmstudio/models
- **Stores:** modelStore, providerStore, threadGuardianStore, settingsStore
- **Special Feature:** All stats derived from live store state (API routes: 42, stores: 43). Includes Apps Hub, Multi-Chat, Resume Tailor module cards.

---

## 3. Debate Arena
- **Route:** `/` (overlay on chat)
- **File:** `components/DebateView/`
- **Emoji:** ⚔️
- **Purpose:** Multi-agent debate system. Up to 4 agents (D1/D2/D3 + Judge) debate a user question across configurable rounds. Produces structured verdict with confidence score and executive summary.
- **Key Components:** DebateView, DebateSetup, AgentPanel, VerdictPanel, JuryGuardianCard
- **API Routes:** /api/test/completion, /api/jury-guardian
- **Stores:** debateStore, debateHistoryStore, juryGuardianStore
- **Output:** Debate transcript, verdict, confidence %, executive summary saved to history

---

## 4. Test Mode (Tribunal)
- **Route:** `/` (overlay)
- **File:** `components/TestModeView/`
- **Emoji:** 🧪
- **Purpose:** D1/D2/D3 tribunal with configurable AI slots. Tests model robustness against poison pill injection. Three passes: Unfiltered baseline, Pill injected, Protected with defensive prompts. Outputs CAUGHT/ECHO/MISS verdicts with metrics.
- **Key Components:** TestModeView, ModelSlotSelector, PoisonPillInjector, VerdictPanel, BatchModeView
- **API Routes:** /api/test/completion, /api/test/stream, /api/test/status
- **Stores:** testModeStore, debateHistoryStore
- **Modes:** Single test or batch mode (multiple iterations)

---

## 5. Journal
- **Route:** `/journal`
- **File:** `app/journal/page.tsx`
- **Emoji:** 📓
- **Purpose:** 3-column prompt effectiveness tracker (Chat 30% | Analysis 35% | Notepad 35%). Users chat with AI while analysis panel scores conversation for clarity and effectiveness.
- **Key Components:** JournalChatPanel, AnalysisPanel, JournalNotepad
- **API Routes:** /api/chat, /api/journal/chat, /api/journal/analyze
- **Stores:** journalStore
- **Output:** Conversation transcripts with effectiveness ratings

---

## 6. AI Builder
- **Route:** `/builder`
- **File:** `app/builder/page.tsx` → `components/Builder/BuilderPage.tsx`
- **Emoji:** 🔨
- **Purpose:** Full-screen code generation environment replacing Pinegrow + Claude Code. Three-panel layout: slim sidebar (model selector + file explorer) | chat | artifact panel (code/preview/diff). Auto-streams live preview during code generation.
- **Key Components:**
  - BuilderPage.tsx — 3-panel layout, drag-resize, auto-apply flow
  - BuilderSidebar.tsx — model selector + file tree
  - BuilderChat.tsx — isolated streaming chat, artifact card emission, image context injection
  - ArtifactPanel.tsx — Monaco editor + iframe preview + diff viewer + version navigation
  - BuilderTerminal.tsx — sandboxed shell (30s timeout, OS-aware)
  - FileExplorer.tsx / FileTree.tsx — project navigator
  - ArtifactCard.tsx — compact code card in chat
  - EditProgressPanel.tsx — edit block streaming progress UI
  - StreamingMessageRenderer.tsx — progressive edit application during streaming
  - BuilderDiffEditor.tsx — Monaco diff viewer
  - contentDetector.ts — HTML vs React vs snippet detection
- **API Routes:** /api/builder/* (13 routes including asset proxy + update-log), /api/chat, /api/test/stream
- **Stores:** builderStore, builderChatStore, artifactStore, builderModeStore
- **Features:** Vault/guardian context injection, BUILDER_LOG.md tracking (init/append/scan/summary), live preview, artifact versioning (max 10), auto-apply mode, asset proxy for preview, image context injection, plan/build mode, edit/generate mode, auto-router

---

## 7. Prompt Optimizer
- **Route:** `/optimize`
- **File:** `app/optimize/page.tsx`
- **Emoji:** ⚡
- **Purpose:** Two-tab optimization tool. AI tab analyzes test history and recommends model swaps. Logic tab displays raw batch/test performance data. No randomization — all data from stores.
- **Key Components:** AITab, LogicTab
- **API Routes:** /api/chat
- **Stores:** testModeStore, debateHistoryStore
- **Output:** Model swap recommendations, performance comparisons

---

## 8. Review
- **Route:** `/review`
- **File:** `app/review/page.tsx`
- **Emoji:** 📋
- **Purpose:** Batch results deep-dive. Left sidebar lists all batch runs. Right panels: Verdict (CAUGHT/MISSED rates), Evidence (data-driven proof), Lifecycle (per-test timeline), Conversation Shift (poison spread analysis), Kill Mechanism analysis.
- **Key Components:** BatchSidebar, VerdictPanel, EvidencePanel, LifecyclePanel, ConversationShiftPanel, KillMechanismPanel
- **API Routes:** /api/chat
- **Stores:** testModeStore, debateHistoryStore
- **Output:** Comprehensive batch analysis and visualization

---

## 9. AI Analysis
- **Route:** `/ai-analysis`
- **File:** `app/ai-analysis/page.tsx`
- **Emoji:** 🧠
- **Purpose:** Six-tab meta-analysis hub. Each tab surfaces AI-generated analysis of a specific module: Chat transcripts, Debate verdicts, Test results, Batch comparisons, Forensic chain, Review summaries.
- **Key Components:** Tabs for each analysis type, AI-driven synthesis
- **API Routes:** /api/chat, /api/journal/analyze
- **Stores:** aiAnalysisStore
- **Limits:** 10 debate, 20 batch, 500 forensic entries

---

## 10. Live Checker
- **Route:** `/live-checker`
- **File:** `app/live-checker/page.tsx`
- **Emoji:** 🔍
- **Purpose:** Real-time fact verification. Multi-agent pipeline (search, verify, cross-check, judge) returns VERIFIED/UNVERIFIED/INCONCLUSIVE with confidence % and reasoning.
- **Key Components:** FactInput, SearchPanel, VerificationPanel, JudgePanel
- **API Routes:** /api/search/tavily, /api/web-fetch, /api/chat
- **Output:** Fact verdict with confidence score and supporting evidence

---

## 11. Real World
- **Route:** `/real-world`
- **File:** `app/real-world/page.tsx`
- **Emoji:** 🏢
- **Purpose:** Business document simulation. Generates invoices and expense reports with embedded violations. Staff roster with approval limits and truth anchors.
- **Key Components:** DocumentGenerator, ViolationHighlighter, StaffRoster
- **API Routes:** /api/chat, /api/test/completion
- **Use Case:** Testing model ability to catch business fraud

---

## 12. Research
- **Route:** `/research`
- **File:** `app/research/page.tsx`
- **Emoji:** 🔬
- **Purpose:** Market research dashboard. Enter stock symbol, get news + sentiment + catalysts + BULLISH/BEARISH/NEUTRAL recommendation.
- **Key Components:** StockInput, NewsPanel, SentimentPanel, RecommendationPanel
- **API Routes:** /api/research, /api/web-search, /api/search/tavily
- **Output:** Market analysis with investment recommendation

---

## 13. Prompt Library
- **Route:** `/library`
- **File:** `app/library/page.tsx`
- **Emoji:** 📚
- **Purpose:** Central repository for test questions and poison pills by difficulty tier (easy/hard/batch/cloud). Full CRUD. Feeds Test Mode and Batch Mode.
- **Key Components:** LibraryGrid, QuestionEditor, PoisonPillEditor
- **Stores:** promptLibraryStore, testModeStore
- **Output:** Organized test questions and evaluation prompts

---

## 14. Diagnostics
- **Route:** `/diagnostics`
- **File:** `app/diagnostics/page.tsx`
- **Emoji:** 🔧
- **Purpose:** Self-healing code scanner. Configurable scan depth. Scans for errors/warnings/enhancements/security issues. AI proposes fixes. Apply or reject per-finding. Full rollback via snapshots.
- **Key Components:** ScanConfigPanel, FindingsPanel, DiffViewer, SnapshotManager
- **API Routes:** /api/diagnostics/scan, /api/diagnostics/analyze, /api/diagnostics/fix, /api/diagnostics/rollback, /api/diagnostics/custom-request
- **Stores:** diagnosticsStore
- **Features:** 50 snapshot limit, 10 undo levels, changelog export

---

## 15. Settings
- **Route:** `/settings`
- **File:** `app/settings/page.tsx` (~1255 lines)
- **Emoji:** ⚙️
- **Purpose:** Configuration hub with 14 sections. Lazy-loads heavy sub-sections via next/dynamic. Each sub-component fully self-contained with own store access.
- **Sections:**
  - General (inline) — Theme, default model
  - Models (inline) — Per-provider model list, builder tags, nicknames
  - Model Registry (ModelRegistry.tsx) — Detailed model configs
  - Roll Call (RollCall.tsx) — Live-test all models for connectivity
  - AI Orchestration (SettingsOrchestration.tsx) — AI mode, flow type, agent configs
  - Thread Guardian (inline) — Enable/disable, tier configs, stats
  - Roles (inline) — Custom role definitions
  - Prompts (inline) — Saved prompt templates
  - Knowledge (SettingsKnowledge.tsx) — Vault documents (self-contained, owns hydration)
  - Trading APIs (SettingsTradingAPIs.tsx) — API key info
  - Logic Editor (SettingsLogicEditor.tsx) — Debate templates, analysis prompts
  - Questions (inline) — Test question management
  - Poisons (inline) — Poison pill management
  - Security (inline) — PIN lock setup/removal
  - **Build Docs (NEW)** — Toggle "Inject Build Docs into AI Context"
- **API Routes:** /api/rollcall (Roll Call section)

---

## 16. Vault
- **Route:** `/vault`
- **File:** `app/vault/page.tsx`
- **Emoji:** 📂
- **Purpose:** Full-featured file manager with 50MB localStorage limit. Drag-drop upload, search, filter, sort, grid/list toggle, metadata editor, file preview. Files attachable to chat.
- **Key Components:** FileUploader, FileGrid, FilePreview, MetadataEditor
- **Stores:** vaultStore
- **Features:** 50MB total limit, 10MB per file, full CRUD

---

## 17. Component Library
- **Route:** `/component-library`
- **File:** `app/component-library/page.tsx`
- **Emoji:** 🧩
- **Purpose:** Repository for reusable code components (React, HTML, CSS). Grid/list view, search, categories, favorites, import/export JSON. Components insertable into Builder.
- **Key Components:** ComponentGrid, ComponentEditor, CategoryManager
- **Stores:** componentLibraryStore
- **Features:** Categories, favorites, import/export, Builder integration

---

## 18. Demo
- **Route:** `/demo`
- **File:** `app/demo/page.tsx`
- **Emoji:** 🎬
- **Purpose:** 15-slide interactive product tour. Architecture, modules, providers, features, pipeline visualizations. Auto-advance or manual navigation.
- **Key Components:** SlideCarousel, SlideContent, Navigation
- **Use Case:** Onboarding and feature discovery

---

## 19. Apps Hub
- **Route:** `/apps`
- **File:** `app/apps/page.tsx`
- **Emoji:** 📱
- **Purpose:** Applications hub with app card grid. Active apps: Resume Tailor. Others: Coming Soon placeholders.
- **Sidebar:** Hidden (in `SIDEBAR_HIDDEN_ROUTES`)

---

## 20. Resume Tailor
- **Route:** `/apps/resume-tailor`
- **File:** `components/apps/ResumeTailor.tsx`
- **Emoji:** 📄
- **Purpose:** AI-powered resume and cover letter tailoring. 5-stage pipeline: Input → Analysis (keyword extraction) → Tailor (streaming) → Cover Letter (streaming) → Download (PDF/DOCX).
- **Key Components:** ResumeTailor (orchestrates 5 stages)
- **API Routes:** /api/chat (keyword extraction via Haiku), /api/test/stream (streaming tailoring + cover letter)
- **Stores:** resumeTailorStore
- **Export:** PDF via jsPDF (`lib/export/resumePdf.ts`), DOCX via docx package (`lib/export/resumeDocx.ts`)
- **Sidebar:** Hidden

---

## Page Metadata

| Route | Component | Status | Overlay? | Hidden Sidebar? |
|-------|-----------|--------|----------|-----------------|
| / | Chat | ✅ | — | No |
| /dashboard | Dashboard | ✅ | — | Yes |
| /builder | Builder | ✅ | — | Yes |
| /debate | Debate | ✅ | Yes (on /) | Yes |
| /test | Test Mode | ✅ | Yes (on /) | Yes |
| /journal | Journal | ✅ | — | Yes |
| /optimize | Optimize | ✅ | — | Yes |
| /live-checker | Live Checker | ✅ | — | Yes |
| /real-world | Real World | ✅ | — | Yes |
| /review | Review | ✅ | — | Yes |
| /library | Library | ✅ | — | Yes |
| /research | Research | ✅ | — | Yes |
| /ai-analysis | AI Analysis | ✅ | — | Yes |
| /diagnostics | Diagnostics | ✅ | — | Yes |
| /settings | Settings | ✅ | — | Yes |
| /vault | Vault | ✅ | — | No |
| /component-library | Components | ✅ | — | No |
| /demo | Demo | ✅ | — | No |
| /apps | Apps Hub | ✅ | — | Yes |
| /apps/resume-tailor | Resume Tailor | ✅ | — | Yes |

---

Generated from SARGE_PLATFORM.md
Last updated: 2026-02-25
