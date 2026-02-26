# Changelog — SARGE Platform & AI Builder

Version history and feature tracking.

---

## Session: 2026-02-25

### Changes Made

**Dashboard Updates (a2348b4)**
- Dashboard module grid expanded from 4-col to 5-col layout
- Added 4 new module cards: Apps Hub, Multi-Chat, Resume Tailor, Vault (moved from modules to security section)
- Provider grid expanded from 6-col to 7-col, added **LM Studio** provider card
- LM Studio live status check via `/api/lmstudio/models`
- Security grid expanded from 5-col to 7-col with Vault and Thread Guardian cards
- Updated stat counters: API routes 28→42, stores "20+"→43
- Settings module tags updated to include "Docs"

**Multi-Chat Architecture Spec (c66061b)**
- Created `docs/MULTI_CHAT_ARCHITECTURE.md` — full spec for multi-chat workspace + Jury Duty system
- Clarified Thread Guardian (single-chat security) vs Jury Duty (multi-chat quality) split

**Builder Auto-Apply, Auto-Load, Asset Proxy (00b7f36)**
- **Auto-apply toggle** in `builderStore` — when enabled, file changes write to disk without confirmation
- **Asset proxy** — new `GET /api/builder/asset` route serves binary files (images, fonts, media) from project folders for preview iframe
- **Image context injection** — builder chat detects images in project tree, injects paths into AI context
- **BUILDER_LOG.md system** — new `POST /api/builder/update-log` route with 4 actions: `init`, `append`, `scan`, `summary`
- **builderLogger.ts** — new module for generating/appending BUILDER_LOG.md content
- **attachments.ts** — shared attachment utilities extracted from InputArea (used by both main chat and builder chat)
- **builderModeStore.ts** — new store for plan/build mode, edit/generate mode, auto-router settings
- **Edit mode system prompts** — surgical EDIT block format for small changes, full regeneration for large changes
- **EditProgressPanel** — new component showing EDIT block progress during streaming
- **read-file route** expanded with additional metadata
- **list-directory route** — minor fixes
- **test/stream route** — major expansion (~150 lines changed): batch/chat fixes, improved streaming

**Batch & Chat Fixes (00b7f36)**
- `testModeStore.ts` reworked: new batch history, forensic event types, session stats
- `builderChatStore.ts` updated: debounced storage, improved message handling
- `InputArea.tsx` refactored: attachment logic extracted to shared `lib/utils/attachments.ts`
- `BatchView.tsx` minor fixes

**On-Topic Poisons + Forensic Logging (94dc153)**
- On-topic poison pill injection (3 passes: baseline, poisoned, protected)
- Before/after forensic logging with full infected/recovered response text
- Kill chain tracking with complete response capture

### Files Created
- `app/api/builder/asset/route.ts` — Asset proxy for preview iframe
- `app/api/builder/update-log/route.ts` — BUILDER_LOG.md management (4 actions)
- `lib/builderLogger.ts` — Changelog generation utilities
- `lib/stores/builderModeStore.ts` — Builder mode + edit mode + auto-router state
- `lib/utils/attachments.ts` — Shared attachment handling
- `components/Builder/EditProgressPanel.tsx` — Edit block streaming progress UI
- `docs/MULTI_CHAT_ARCHITECTURE.md` — Multi-chat architecture specification

### Files Modified
- `app/dashboard/page.tsx` — New modules, LM Studio provider, grid layout updates
- `components/Builder/BuilderPage.tsx` — Auto-apply flow, layout improvements
- `components/Builder/BuilderChat.tsx` — Image context injection, attachment support
- `components/Builder/ArtifactPanel.tsx` — Version navigation, expanded toolbar
- `components/Builder/BuilderMessageBubble.tsx` — Edit mode interception
- `components/Builder/StreamingMessageRenderer.tsx` — Progressive edit application
- `components/Builder/MessageList.tsx` — Minor updates
- `components/chat/InputArea.tsx` — Attachment logic extracted to shared utility
- `components/test/BatchView.tsx` — Minor fixes
- `app/api/test/stream/route.ts` — Major streaming expansion
- `app/api/builder/read-file/route.ts` — Additional metadata
- `app/api/builder/list-directory/route.ts` — Fixes
- `lib/stores/builderStore.ts` — Auto-apply toggle, expanded state
- `lib/stores/builderChatStore.ts` — Debounced storage
- `lib/stores/testModeStore.ts` — Batch history, forensic events, session stats
- `lib/contextInjector.ts` — Image context support
- `lib/types.ts` — New type definitions

---

## Session: 2026-02-21

### Changes Made
- **NEW:** Created comprehensive documentation vault in `/docs/`
  - `docs/index.md` — Master navigation and overview
  - `docs/pages.md` — All 19 routes with purposes and components
  - `docs/ai-logic.md` — System prompts and orchestration flows
  - `docs/architecture.md` — Tech stack and design patterns
  - `docs/stores.md` — All 43 Zustand stores with state fields
  - `docs/api-routes.md` — All 39 API endpoints
  - `docs/models.md` — All cloud and local providers with models
  - `docs/changelog.md` — This file (version history)

- **NEW:** Added "Apps" nav link
  - Route: `/apps`
  - Position: Between Research and Demo
  - Emoji: 📱
  - Color: Violet

- **NEW:** Resume Tailor app (`/apps/resume-tailor`)
  - 5-stage pipeline: Input → Analysis → Tailor → Cover Letter → Download
  - PDF export via jsPDF, DOCX export via docx package
  - Streaming AI processing for tailoring and cover letter stages

- **COMPLETED:** Context injection setup
  - Selective doc injection via `getRelevantDocs(mode)` in contextInjector.ts
  - Settings toggle `buildDocsAutoInject` (defaults to false)
  - Max 3000 tokens per injection, truncates at newline boundary

### Files Created
- `docs/` — 8 documentation files (see above)
- `app/apps/page.tsx` — Apps hub with card grid
- `app/apps/resume-tailor/` — Resume Tailor route
- `components/apps/ResumeTailor.tsx` — 5-stage resume pipeline
- `lib/stores/resumeTailorStore.ts` — Resume tailor state with persistence
- `lib/export/resumePdf.ts` — PDF export via jsPDF
- `lib/export/resumeDocx.ts` — DOCX export via docx package

---

## Session: 2026-02-20

### Status
- ✅ Platform build complete (19 pages, 39 API routes, 43 Zustand stores)
- ✅ All core features operational (Chat, Debate, Test Mode, Builder, etc.)
- ✅ Security model implemented (PIN lock, air-gap mode, forensic logging)
- ✅ Thread Guardian active (3-tier fact checking)
- ✅ Streaming and hot-reload working

### Known Issues
**Phase 2 Builder (in progress):**
- Artifact cards: zero-code-in-chat enforcement needs final audit
- Live streaming preview: iframe srcdoc update loop not yet active during token streaming
- Artifact versioning diff: [Diff] button in update cards not wired to Monaco diff editor

**Phase 3 (pending):**
- AI file operations (Apply/Reject flow) not implemented
- Dev server iframe (switching from srcdoc to localhost:3000) not wired
- Multi-tab editor (builderDocumentStore exists but UI not built)

**Phase 4/5 (backlog):**
- Auto-changelog: BUILDER_LOG.md generation partially done, not triggered automatically
- Project templates: New Project picker not implemented
- Git integration: builderStore has dirty flag, no git UI
- Storage manager UI: lib/utils/storageManager.ts created, not wired into Settings
- Workspace studio/preview routes: placeholder pages only

---

## Architecture Decisions (Frozen)

### State Management
- **Zustand 5.0.10** with localStorage persist for all state
- **43 stores** organized by domain (Chat, Model, Builder, Test, Security, Content, UI)
- **No Supabase required** (optional backend, works offline)

### Streaming Architecture
- **Anthropic SDK:** stream.on('text', handler)
- **OpenAI/xAI/DeepSeek:** SSE text/event-stream
- **Ollama:** HTTP chunked encoding
- **Debounce:** 300ms intervals, 150 char delta minimum

### Security Model
- **Builder sandbox:** Path validation per-request, .env* blocked, 5MB file limit
- **Terminal blocklist:** rm, mv, sudo, git push, chmod, dd, mkfs blocked by regex
- **PIN lock:** SHA-256 hashed, 30-min auto-lock
- **Forensic logging:** Blockchain-style hash chain for all write ops
- **Air-gap mode:** Can block all cloud APIs with single toggle

### Context Injection
- **Vault docs + Thread Guardian context** prepended to system prompt (invisible to user)
- **Newline-boundary truncation** (prevents mid-token cutoff)
- **Max 3000 tokens per request** (selective injection per mode)

---

## Completed Features Summary

### Core (Stable ✅)
- Multi-model chat with streaming
- Model switching with fallback chain
- Provider management (Anthropic, OpenAI, Google, xAI, DeepSeek, Ollama, LM Studio)
- Air-gap mode (blocks all cloud APIs)
- Secure mode (input/output sanitization)
- PIN lock with 30-min auto-lock

### Debate Arena (Stable ✅)
- Up to 4 agents (D1/D2/D3 + Judge)
- Configurable rounds
- Structured verdict with confidence score
- Full transcript archive

### Test Mode / Tribunal (Stable ✅)
- D1/D2/D3 slots with model selection
- Poison pill injection (3 passes: baseline, poisoned, protected)
- CAUGHT/ECHO/MISS verdicts
- Batch mode with configurable iterations

### AI Builder (Phase 2-3 In Progress)
- 3-panel layout (sidebar | chat | artifact panel)
- File explorer with project navigation
- Code generation with live preview (streaming)
- Monaco editor with syntax highlighting
- Artifact versioning (max 10 per artifact)
- Sandboxed terminal (30s timeout, blocklist protected)
- BUILDER_LOG.md auto-generation (init, append, scan, summary actions)
- Vault/Guardian context injection
- Auto-apply mode (writes to disk without confirmation)
- Asset proxy for preview iframe (images, fonts, media)
- Image context injection (detects images in project tree)
- Edit mode with surgical EDIT blocks + EditProgressPanel
- Plan/Build mode toggle
- Edit/Generate mode toggle
- Auto-router with cost/quality preference

### Analysis & Monitoring (Stable ✅)
- 6-tab AI Analysis hub (chat, debate, test, batch, forensic, review)
- Thread Guardian (3-tier fact checking)
- Forensic logging (blockchain-style hash chain)
- Diagnostics (code scanner with rollback snapshots)

### Specialized Modules (Stable ✅)
- Journal (prompt effectiveness tracking)
- Live Checker (fact verification pipeline)
- Real World (fraud detection simulation)
- Research (market analysis with sentiment)
- Prompt Library (test question repository)
- Component Library (reusable code storage)
- Vault (file manager, 50MB localStorage pool)
- Settings (14 configuration sections)

---

## Model Coverage

### Cloud Providers
- ✅ Anthropic: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5
- ✅ OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini
- ✅ Google: gemini-2.0-flash, gemini-1.5-pro, gemini-2.0-flash-thinking
- ✅ xAI: grok-2, grok-2-mini, grok-beta
- ✅ DeepSeek: deepseek-chat, deepseek-coder, deepseek-reasoner

### Local Providers
- ✅ Ollama: llama3.2 (all variants), qwen2.5-coder, deepseek-coder, mistral, neural-chat, codellama, starcoder, phi-2
- ✅ LM Studio: OpenAI-compatible API on port 1234

---

## Performance Baselines

| Module | Status | Latency (p95) | Memory |
|--------|--------|---------------|--------|
| Chat streaming | ✅ | 1-3s | <100MB |
| Builder preview | ✅ | 100ms (debounced) | <50MB |
| Test mode batch | ✅ | 5-10s (10 iterations) | <100MB |
| Debate 3-round | ✅ | 8-12s | <150MB |
| Diagnostics scan | ✅ | 2-5s | <80MB |
| AI Analysis tabs | ✅ | 3-8s | <120MB |

---

## Breaking Changes (None)

This is the first documented version. No breaking changes to track.

---

## Deprecations (None)

No deprecated features at this time.

---

## Known Limitations

1. **localStorage cap:** ~5-10MB per browser. Vault enforces 50MB "soft" limit with UI warnings.
2. **Streaming debounce:** Preview updates max every 300ms (prevents thrashing).
3. **History trim:** debateHistoryStore max 50, aiAnalysisStore per-tab limits (10/20/500).
4. **Terminal timeout:** 30s hard limit (kills long-running commands).
5. **Air-gap fallback:** No real-time fact checking when air-gap enabled (depends on Tavily API).

---

## Future Roadmap

### Phase 3: Claude Code Features
- AI file operations with apply/reject flow
- Dev server integration (localhost preview)
- Multi-tab editor

### Phase 4: Auto-Changelog
- BUILDER_LOG.md auto-triggered per batch
- Conversation snapshots per session
- Git integration for project tracking

### Phase 5: Polish & Power Features
- Project templates (Blank, React, Next.js, Tailwind)
- Workspace studio (multi-project management)
- Advanced git workflows
- Storage usage dashboard

---

## Testing Checklist

### Manual Testing (per release)
- [ ] Chat with each provider (Anthropic, OpenAI, Google, Ollama)
- [ ] Debate Arena (setup, verdict, transcript save)
- [ ] Test Mode (single test, batch mode, poison verdicts)
- [ ] Builder (file create, code preview, terminal)
- [ ] Air-gap toggle (blocks cloud, allows local)
- [ ] PIN lock (set, lock, unlock, 30-min timeout)
- [ ] Settings (all 14 sections, lazy-load components)

### Automated Testing (if CI/CD configured)
- [ ] TypeScript strict mode (0 errors)
- [ ] Unit tests for stores (Zustand)
- [ ] API route health checks
- [ ] Streaming response integrity

---

## Contributors & Credits

**Built with:**
- Next.js 16 (App Router, Turbopack)
- React 19.2.3
- Zustand 5.0.10
- Tailwind CSS 4
- Monaco Editor
- Radix UI

---

Generated by Build Documentation System
Last regenerated: 2026-02-25
