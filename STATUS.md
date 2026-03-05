# S.A.R.G.E. — System Status Report

Generated: 2026-03-05
Commit: 640c699
Branch: sargebuild-v1
Tag: working-2026-03-02-deploy-fix (last tagged)

---

## Builder-Standalone (The Foundry) — Port 3101

### Page Routes

| Route | Status |
|-------|--------|
| `/` (Builder) | 200 Works |
| `/chat` | 200 Works |
| `/settings` | 200 Works |

---

### Feature Status

#### Header & Navigation

| Feature | Status | Notes |
|---------|--------|-------|
| Chat nav link | Works | href="/chat" |
| Builder nav link | Works | href="/" |
| Settings gear icon | Works | href="/settings" |
| Secure Mode toggle | Works | useAirGapStore.toggleSecureMode() |
| Air-Gap Mode toggle | Works | useAirGapStore.toggleAirGap() |
| Theme toggle (Sun/Moon) | Works | useSettingsStore.toggleTheme() |

#### Left Sidebar (BuilderSidebar — horizontal toolbar)

| Feature | Status | Notes |
|---------|--------|-------|
| Files popover | Works | File tree, open/close/refresh/browse |
| Templates popover | Works | Template cards + create project form |
| Quick Start / AI Templates | Works | Prompt injection into chat |
| Prompts popover | Works | Cards + hover tooltips + Gallery modal |
| Helpers popover | Works | AIHelpersSection (Reviewer/Judge/Debater) |
| Components popover | Works | ComponentLibrarySection (lazy, 404-safe) |
| Router popover | Works | RouterStatus (lazy) |
| Changes popover | Works | Change list + scroll-to-message + clear |
| Open existing project | Works | Path input + browse + recent projects |
| Drag-drop folder | Works | handleDrop on file explorer |
| New file button | Works | Creates untitled file |

#### Provider & Model Selection (BuilderModelBar)

| Feature | Status | Notes |
|---------|--------|-------|
| Claude tab | Works | Filters builder-tagged Claude models |
| GPT tab | Works | Filters builder-tagged GPT models |
| Gemini tab | Works | Filters builder-tagged Gemini models |
| Grok tab | Works | Filters builder-tagged Grok models |
| DeepSeek tab | Works | Filters builder-tagged DeepSeek models |
| Mistral tab | Works | Custom provider — OpenAI-compatible, 3 default models |
| HuggingFace tab | Works | Custom provider — router.huggingface.co/v1, 3 default models (Llama 3.3 70B, Qwen 3 235B, DeepSeek V3) |
| Ollama tab | Works | Fetches local models from 127.0.0.1:11434 |
| LM Studio tab | Works | Fetches local models from LM Studio |
| Model dropdown | Works | Shows builder-tagged models for selected provider |
| Web Search toggle | Works | Sky-blue indicator when active |

#### Chat Column (Above Chat)

| Feature | Status | Notes |
|---------|--------|-------|
| New button | Works | Opens ProjectCommandCenter "new" view |
| Projects button | Works | Opens ProjectCommandCenter "grid" view |
| Assets button | Works | Opens AssetLibrary overlay |
| Project name display | Works | Shows when project open, orange Foundry styling |
| Project Status Bar | Works | Client name, domain, toggles, deploy status indicators |

#### Builder Chat

| Feature | Status | Notes |
|---------|--------|-------|
| Send message | Works | Full context injection, streaming, abort |
| Plan/Build toggle | Works | Switches build mode |
| Edit/Regen toggle | Works | Switches edit mode (when code exists) |
| Auto Apply toggle | Works | Only visible when project open |
| Stop button | Works | Aborts streaming |
| File attachment | Works | File picker, paste images, drag-drop |
| Attach Code toggle | Works | Injects current code into context |
| Vault button | Works | Opens VaultAttachmentModal |
| Image Gen button | Works | Opens image generation dialog |
| New button | Works | Clears chat + artifact + project |
| Save button | Works | POST /api/builder/update-log |
| Push button | Works | Pushes to GitHub via pushProject() |
| Terminal toggle | Works | Opens/closes BuilderTerminal |
| Clear button | Works | Clears all chat messages |
| Copy button | Works | Copies last AI response to clipboard |
| Save as Prompt | Works | Right-click Send, saves to promptLibraryStore |

#### Artifact Panel

| Feature | Status | Notes |
|---------|--------|-------|
| Code tab | Works | Monaco editor, lazy-loaded, read-only during streaming |
| Preview tab | Works | srcdoc + asset proxy + dev server toggle |
| Diff tab | Works | Appears when diffView is set (file action proposals) |
| Deploy tab | Works | Fixed in commit 620c39c — reads from store |
| Live streaming preview | Works | 300ms debounce, smart update mode |
| Version navigation (v1, v2) | Works | Prev/Next/Restore, artifactStore versions |
| Export for Client button | Works | exportToZip + downloadZip |
| Download button | Works | Auto-detects extension |
| Copy button | Works | clipboard.writeText |
| Save to Library button | Works | Opens SaveToLibraryDialog |
| Save to Project button | Works | Prompts filename, writes via API |
| Fullscreen toggle | Works | Escape to exit |
| Resize handle | Works | Drag between chat and artifact panel |
| Line count display | Works | Shows in bottom-right of code tab |
| Dev server detection | Works | Auto-detects, shows "Switch" badge |

#### Project Command Center (Overlay)

| Feature | Status | Notes |
|---------|--------|-------|
| Opens from Projects button | Works | Store-driven open("grid") |
| My Projects tab | Works | Lists from /api/builder/list-projects |
| Search + Sort | Works | By name, date, file count |
| Project cards | Works | Rename, delete, open, platforms grid |
| Deploy status (GH/VR/NF/CF) | Works | Green check or gray circle per platform |
| Push button on cards | Works | Calls projectCommandStore.pushProject() |
| Client Hub expand | Works | Shows toggles, client info, "Run Now" buttons |
| New Project tab | Works | Name + template + client features |
| Create button | Works | POST /api/builder/create-project |

#### Asset Library (Overlay)

| Feature | Status | Notes |
|---------|--------|-------|
| Opens from Assets button | Works | Store-driven open() |
| Upload (drag-drop + click) | Works | Supports recursive directories |
| Filter tabs | Works | All, Images, Docs, Fonts, Other |
| Copy to project | Works | POST /api/builder/assets/copy-to-project |
| Delete asset | Works | Removes from list |
| Escape to close | Works | Keyboard handler |

#### Session Activity

| Feature | Status | Notes |
|---------|--------|-------|
| Change count badge | Works | Collapsed view |
| Stats grid | Works | Messages, changes, applied/rejected counts |
| Recent changes list | Works | Click to scroll, clear button |

---

### API Endpoint Status

#### Page Routes

| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `/` | GET | 200 | Builder page |
| `/chat` | GET | 200 | Chat page |
| `/settings` | GET | 200 | Settings page |

#### Core APIs

| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `/api/status` | GET | 200 | Health + air-gap check |
| `/api/models/scan` | GET | 200 | Ollama model discovery |
| `/api/chat` | POST | 400 (empty) | Needs provider + model + messages |
| `/api/test/stream` | POST | 500 (empty) | Needs provider + model |
| `/api/deploy` | POST | 400 (empty) | Needs action + projectPath |
| `/api/image` | POST | 400 (empty) | Needs provider + prompt |
| `/api/thread-guardian` | POST | 200 | Returns analysis |
| `/api/jury-guardian` | POST | 400 (empty) | Needs model + messages |
| `/api/search/tavily` | POST | 400 (empty) | Needs query |
| `/api/accessibility/check` | POST | 400 (empty) | Needs html content |
| `/api/seo/optimize` | POST | 400 (empty) | Needs html content |
| `/api/project/create` | POST | 400 (empty) | Needs projectName |
| `/api/project/meta` | POST | 400 (empty) | Needs path |

#### Builder APIs

| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `/api/builder/files` | POST | 400 (empty) | Needs projectPath |
| `/api/builder/read-file` | POST | 400 (empty) | Needs path |
| `/api/builder/write-file` | POST | 400 (empty) | Needs path + content |
| `/api/builder/browse-folder` | POST | 200 | Opens native OS folder picker |
| `/api/builder/check-folder` | POST | 400 (empty) | Needs path |
| `/api/builder/list-directory` | POST | 400 (empty) | Needs path |
| `/api/builder/create-project` | POST | 400 (empty) | Needs templateId + projectPath |
| `/api/builder/delete-project` | POST | 400 (empty) | Needs projectPath |
| `/api/builder/rename-project` | POST | 400 (empty) | Needs old + new path |
| `/api/builder/list-projects` | GET | 200 | Lists all projects |
| `/api/builder/terminal` | POST | 400 (empty) | Needs command |
| `/api/builder/dev-status` | POST | 200 | Returns dev server status |
| `/api/builder/asset` | GET | 404 (test) | Needs valid projectPath + file |
| `/api/builder/assets` | GET | 200 | Lists project assets |
| `/api/builder/assets/copy-to-project` | POST | 400 (empty) | Needs source + dest |
| `/api/builder/preview` | GET | 400 (test) | Needs projectPath |
| `/api/builder/update-log` | POST | 400 (empty) | Needs projectPath + action |

#### Missing Endpoints

| Endpoint | Called By | Status |
|----------|----------|--------|
| `/api/chat/backup` | conversationStore.ts:51 | **500 — DOES NOT EXIST** |

---

### Cloud Forge Trials

| Feature | Status | Notes |
|---------|--------|-------|
| Cloud trial runner | Works | Direct API calls (no self-fetch), NDJSON progress streaming |
| 8 benchmark scenarios (R1-R8) | Works | Per-round timeouts: R1-R2 120s, R3-R5 150s, R6 180s, R7 240s, R8 300s |
| DeepSeek V3 trials | **Partially benchmarked** | R1: 82/100 "Strong". Timeout fix applied (commit c848430) |
| extractCode HTML detection | Works | Searches for `<!doctype html`/`<html` in raw response (commit 1dc1f1a) |
| Timeout content preservation | Works | Accumulated content kept on timeout instead of discarded |
| Results persistence | Works | localStorage via Zustand persist (`forge-trials-store`) |
| Warmup splash | Works | Preview iframe shows splash during first API call |
| Parallel cloud execution | Works | Toggle in toolbar — providers run simultaneously, rounds sequential within each |
| Hybrid chain system | **Rebuilt** | Full rebuild: 2-panel layout (30/70 split), 18 scenarios, single chain editor with 1-5 steps, LOCAL/CLOUD model selection, cost estimates, AI assessment (Gemini 2.5 Flash), compiler loop (@sarge/audit), Supabase sync |
| Hybrid API route | Works | `/api/benchmark/run-hybrid` — chain execution with step-by-step output feeding |
| Hybrid compile API | **New** | `/api/benchmark/compile` — writes HTML to temp, runs runAudit(), AI fix loop via Gemini |
| Hybrid assess API | **New** | `/api/benchmark/assess` — Gemini 2.5 Flash plain-English assessment |
| HybridDetailPanel | **New** | Right panel: Preview/Code/Breakdown tabs, AI Assessment (collapsible), Compiler with before/after scores, violation list, PASSED/NEEDS REVIEW badge |
| 18 hybrid scenarios | **New** | R1-R8 (existing cloud) + R9-R18 (new: Local Service, Medical, Restaurant Full, Real Estate, Law Firm, Event/Wedding, Nonprofit, Fitness, Landing Page, Rebuild) |
| Round explainers | Works | One-sentence description per scenario (local R1-R8, cloud R1-R8) — `explainers.ts` |
| Criterion explainers | Works | What each scoring bar measures + dynamic score explanation sentences |
| Model summary card | Works | Grade (A+ to F), top 3/bottom 2 rounds, strengths/weaknesses, use case |
| Token limits equalized | Works | All cloud providers now 8192 tokens (was 4096 for OpenAI/xAI/custom) |
| max_completion_tokens | Works | GPT-5, o1, o3, o4, nano, reasoning models use max_completion_tokens |
| Case-insensitive keywords | Works | Scoring no longer penalizes "faq" vs "FAQ" — all keyword matching is case-insensitive |
| Anthropic API version | Reverted | 2024-06-01 is invalid — reverted to 2023-06-01 (the only valid version) |
| Model ping tester | Works | "Test" button on every model in Settings — shows OK/FAIL with error message |
| Hybrid pastRuns persistence | Works | hybridPastRuns[] in store, persisted via partialize, auto-saved on run complete |
| Hybrid Saved Trial Data viewer | Works | Collapsible panel in Hybrid tab — grade, scores, date, step progression, JSON export |
| Stream error handling | **Fixed** | Silent `catch {}` replaced with `console.warn` on client + server emit(); `finally` blocks ensure `running` state cleanup |
| Heartbeat keepalive (all 3 runners) | **Fixed** | All runners emit events every 10s during API calls — prevents browser closing connection at ~60s silence |
| Billing timeout (cloud + hybrid) | **Fixed** | `AbortSignal.timeout(5000)` on logBilling — dead billing endpoint cannot stall runner |
| Stopped flag on emit failure (all 3) | **Fixed** | `emit()` returns false + sets `stopped=true` on enqueue failure — runner stops immediately instead of burning API credits on dead stream |
| Abort signal propagation (local) | **Fixed** | `req.signal` abort → AbortController → Ollama fetch — client disconnect stops model generation |
| Live event ticker | Works | Progress strip shows event count, seconds since last event, stall warnings (10s amber, 30s red) |
| Live activity panel | Works | Collapsible panel below progress strip — scrolling event log with type badges, model/round/score, timestamps, max 100 entries |
| Remaining cloud models | **Not started** | Gemini, Grok, GPT, Claude — next step |
| Local trials (Ollama) | **Fixed** | Heartbeat + abort propagation added. cogito:8b runs take 3-11min per scenario (legitimate for complex HTML). |
| Routing summary layer | **Not started** | Depends on complete score matrix |

### Recent Changes (Since Last Status)

| Date | Commit | Change |
|------|--------|--------|
| Mar 5 | 640c699 | Fix HybridDetailPanel hooks-after-early-return (useMemo/useRef/useEffect above conditional returns) |
| Mar 5 | 78048c6 | Full app readability sweep — zero dim grey across 37 files, all text zinc-300+, $ billing button orange, text-[9px]/[10px] → text-xs |
| Mar 5 | aeab3fd | Billing — provider balance in provider color, bigger model/history text, runs grouped by day |
| Mar 5 | 7bfc2e3 | Billing cards — restore full width grid, add editable balance per provider (localStorage) |
| Mar 5 | e4f4b77 | Billing — readable fonts, centered cards, collapsible history with day/week/month filter |
| Mar 5 | 317e26a | Billing — live provider balances (DeepSeek live $, HuggingFace account, console links for rest), real 2026 model pricing (rates.ts), dashboard overhaul (provider cards, pie chart, history table, CSV export), 3 new API routes (/balances /history /refresh). |
| Mar 5 | e50167b | Guardian wiring, build log, changelog, model roles, Mistral scanner — full transparency pass. |
| Mar 5 | 29f0f5d | Fix hydration error (nested button → span in ForgeTrialsHybrid Past Runs), fix iframe nav links permanently (hash links scroll normally, non-hash → window.open new tab, allow-popups sandbox). |
| Mar 5 | 2e1481f | Hybrid — preserve local Step 1 base during Step 2 stream (2000+body gate), fix iframe nav links (anchor scroll within iframe, external → new tab, never navigate parent app). |
| Mar 5 | 11069ae | Hybrid — per-step targeted prompts (step 2+ gets role-specific instruction instead of full scenario prompt), body tag validation gate, iframe fade transition on step handoff (0.3s opacity). Models no longer rebuild from scratch each step. |
| Mar 5 | b646001 | Hybrid — output validation gate (HTML check, 2000 char min, chat response detection) + local model prompt enforcement (strict HTML-only prefix for Ollama/LM Studio). Invalid step output falls back to last known good HTML. |
| Mar 5 | be79b1f | Hybrid — streaming live preview. Model tokens pipe into iframe in real time via `hybrid:step-streaming` events (throttled 500ms/200chars). User sees HTML build visually as model generates. All 5 providers emit onChunk callbacks. |
| Mar 5 | 9a8fd0a | Hybrid — live preview updates after each step completes. iframe shows HTML as soon as step-complete event arrives, not after full chain. LIVE badge during run. |
| Mar 5 | c27e96b+8333246 | Hybrid — remove trial gate, LOCAL/CLOUD tabs per step, model scan API fix (flatten results for modelStore hydration). |
| Mar 5 | 0e52e4c | Cloud runner — heartbeat keepalive (10s), billing timeout (5s), stopped flag on emit failure. All 3 runners now have identical stream-death protection. |
| Mar 5 | 13701a0 | Local runner — heartbeat keepalive + abort signal propagation. |
| Mar 5 | 464f68a | Hybrid runner — heartbeat keepalive + billing timeout. |
| Mar 5 | b535a33 | Fix local trials stalling — hybridRunning never reset after run (stuck RUN button), finally block cleanup, lmstudio provider, font bumps across all benchmark components. |
| Mar 4 | 67e7138 | Hybrid — font fixes (all content text-sm/zinc-200 minimum), progress bar 8px tall, Level 11 Events scenario (19th scenario, expert). |
| Mar 4 | 5d5f420 | Hybrid readability — prompt preview white/bold/readable, all labels bumped from 9-10px zinc-500/600 to 12px zinc-300/400. Every text element readable, not decorative. |
| Mar 4 | d8cce9a | Hybrid fixes — local models in dropdowns (all Ollama/LM Studio models shown without builder flag), scenario prompt preview (shows what AI receives, updates when custom prompt filled). |
| Mar 4 | 65951d8 | Hybrid page — full rebuild with compiler loop, AI assessment, 18 scenarios, Supabase logging. New files: hybridScenarios.ts, HybridDetailPanel.tsx, compile/route.ts, assess/route.ts, analytics/collect/route.ts. Rewrote ForgeTrialsHybrid.tsx (left panel). Dashboard wired for 30/70 split layout. |
| Mar 4 | 4564c37 | Supabase migration — 11 tables DDL (`supabase/migration.sql`), forgeSync module (`packages/core/src/lib/supabase/forgeSync.ts`), dual-write for trials+billing in benchmarkStore, conversation sync re-enabled in syncQueue.ts, migration API route. |
| Mar 4 | 03eaef7 | Hybrid — remove hardcoded fallbacks, recommendations from trial data only. Custom chains start empty with "Select a model" prompt. Recommended mode requires completed local+cloud trials. |
| Mar 4 | 5f3f4d5 | HuggingFace provider wired — Llama 3.3 70B, Qwen 3 235B, DeepSeek V3. Base URL updated to router.huggingface.co. All 3 models ping-tested OK. Also fixed @sarge/billing + @sarge/benchmark missing workspace deps. |
| Mar 4 | 5cc2cc7 | Live event ticker + activity panel — real time stream visibility in Forge Trials |
| Mar 4 | 3ac6684 | Cloud trials audit — silent catch blocks fixed, finally blocks for state cleanup, emit() error logging |
| Mar 4 | bb62a8a | Hybrid pastRuns persistence + Saved Trial Data viewer + hooks fix + fetch models API |
| Mar 4 | db898ca | Token limits equalized, case-insensitive keywords, Anthropic API revert, model ping tester |
| Mar 4 | 0a96600 | Forge Trials — round explainers, criterion explainers, score context, model summary card |
| Mar 4 | c848430 | Fix cloud trials DeepSeek — timeout content preservation, 180s timeout, diagnostics |
| Mar 3 | 1dc1f1a | Fix cloud trials — extractCode HTML detection, reasoning token separation, direct API calls |
| Mar 3 | 5f84e08 | Add warmup call to cloud trials — splash page renders in preview within seconds |
| Mar 3 | 2d42911 | Live forge splash in detail panel during cloud trials + 120s timeout |
| Mar 3 | a9adf7f | Add live elapsed timer to cloud trials progress + disable Vercel auto-deploy |

### Documentation

| File | Status | Notes |
|------|--------|-------|
| SARGE_Product_Documentation.md | **Current** | Living document — single truth anchor, updated Mar 4 |
| CLAUDE.md | **Current** | Claude Code instructions — workflow rules |
| STATUS.md | **Current** | This file — quick-glance state |
| Old docs (v1, v4, PLATFORM, etc.) | **Archived** | Moved to `docs/archive/` — not authoritative |

---

---

## Transparency Audit — 2026-03-05

### System 1: Thread Guardian — WORKING (was DECORATIVE)
- `validateStepOutput()` in run-hybrid makes REAL validation decisions (HTML check, body tag, chat pattern detection)
- Now emits `hybrid:guardian` events (PASSED/REJECTED) after every step — visible in Build Log tab
- Guardian decisions color-coded: green (PASSED) / red (REJECTED)
- Guardian model selector in hybrid panel (optional — algorithmic validation always runs)
- `guardianModelId` + `guardianProvider` passed through API config

### System 2: Build Log — WORKING (was MISSING)
- Runner emits `hybrid:build-log` events with timestamps throughout chain execution
- Events: chain start, step start (model + role), step complete (char count), chain complete (final score)
- New "Build Log" tab in HybridDetailPanel — font-mono, auto-scrolling, Shield icon header
- LIVE badge during execution, real-time entries as they stream in

### System 3: Changelog per Step — WORKING (was DECORATIVE)
- `generateChangelog()` in run-hybrid: HTML section diffing, CSS rule counting, JS function counting
- `StepChangelog` interface in `@sarge/benchmark`: sectionsAdded/Removed, cssRules, jsFunctions, regressionCheck
- Breakdown tab shows per-step changelog with section names, CSS/JS counts, regression badge
- Regression detection: sections removed between steps → FAILED + details

### System 4: Model Role Tags — WORKING (was PARTIAL)
- `ModelRole` type: Builder, Trials, Chat, Image, Guardian, Code
- `modelRoles` state in modelStore (persisted), auto-tagged on hydrate
- Settings page: clickable role tag pills (B/T/C/I/G/X) per model — `ModelRoleTags.tsx` component
- Forge Trials dropdowns filter by "Trials" role (backward-compat fallback)
- `setModelRole("Builder", ...)` keeps `builderFlags` in sync

### System 5: Mistral in Forge Trials — WORKING (was DECORATIVE)
- Added as built-in provider in `packages/core/src/lib/providers/index.ts`
- 3 models: Devstral 2, Devstral Small 2, Mistral Medium 3 (131K context)
- `"mistral"` in `Provider` type union, Flame icon in ProviderBadge
- Appears automatically in all provider dropdowns — no manual setup

### System 6: Guardian Model Assignment — WORKING (was MISSING)
- Guardian selector dropdown in ForgeTrialsHybrid.tsx (above chain steps)
- Any cloud model can be assigned as guardian
- `guardianModelId` + `guardianProvider` passed to API, logged in build log
- Guardian is optional — algorithmic validation always runs

---

### Known Issues

| # | Severity | Component | Description |
|---|----------|-----------|-------------|
| 1 | Medium | `/api/chat/backup` | Endpoint does not exist. Called by conversationStore on save. Returns 500. |
| 2 | Low | Netlify CLI | Crashes in monorepo context — interactive workspace picker hangs in non-interactive spawn. Deploy to Netlify fails. |
| 3 | Low | Cloudflare Wrangler | Token may lack `pages` scope — deploy worked in test but may fail for some projects. |
| 4 | Info | Deploy init time | Init action takes ~45 seconds with all 4 targets — no progress feedback beyond spinner. |
| 5 | Info | Turbopack | Not usable on Windows — resolveAlias doesn't support backslash paths. Using --webpack flag. |
| 6 | Info | 19 persisted stores | Still active in builder-standalone after stubbing 6. Could be reduced further. |

---

### Standalone Apps

| App | Port | Status |
|-----|------|--------|
| builder-standalone | 3101 | **Verified working** — full audit complete |
| chat-standalone | 3100 | Exists, untested this session |
| debate-standalone | — | Exists, untested |
| apps-standalone | — | Exists, untested |
| diagnostics-standalone | — | Exists, untested |
| env-manager-standalone | — | Exists, untested |
| forensic-standalone | — | Exists, untested |
| guardian-standalone | — | Exists, untested |
| jury-standalone | — | Exists, untested |
| launchpad-standalone | — | Exists, untested |
| trading-standalone | — | Exists, untested |

---

### Supabase Integration

| Table | Status | Dual-Write | Notes |
|-------|--------|------------|-------|
| conversations | **Active** (RLS) | syncQueue.ts | Upsert on create/update, fetch with proper schema |
| messages | **Active** (RLS) | forgeSync.ts | Per-message insert |
| forge_trial_results | **Active** (RLS) | benchmarkStore.ts | Fire-and-forget on each round complete (local + cloud) |
| forge_billing | **Active** (RLS) | benchmarkStore.ts | Piggybacks on trial results when cost > 0 |
| forge_hybrid_runs | **Active** (RLS) | forgeSync.ts (not yet wired) | Manual sync available |
| forge_build_history | **Active** (RLS) | Not wired | Future: builder session tracking |
| forge_compiler_results | **Active** (RLS) | Not wired | Future: compiler output tracking |
| forge_model_registry | **Active** (RLS) | Not wired | Future: model metadata sync |
| forge_certificates | **Active** (RLS) | Not wired | Future: trial certificates |
| builder_logs | **Active** (RLS) | syncQueue.ts | Upsert by project_name |
| user_settings | **Active** (RLS) | Not wired | Future: settings backup |
| llm_sessions | Exists (289 rows) | sync.ts | Forensic session tracking |
| llm_responses | Exists (5,586 rows) | sync.ts | Forensic log entries |
| llm_judge_verdicts | Exists (232 rows) | sync.ts | Judge verdicts |
| llm_endpoints_snapshot | Exists (874 rows) | sync.ts | Endpoint snapshots |

**Migration complete** — all 11 tables created with RLS policies on 2026-03-04.

---

### Architecture

| Metric | Count |
|--------|-------|
| Components (packages/builder) | 38 .tsx |
| Components (apps/builder-standalone) | 31 .tsx |
| Stores (packages/builder) | 12 (9 persisted) |
| Stores (packages/core) | 25 (16 persisted, 4 stubbed) |
| Stores (packages/chat) | 5 (2 persisted, 2 stubbed) |
| Stores (apps/builder-standalone) | 3 (0 persisted) |
| **Total stores** | **45 (6 stubbed)** |
| API routes | 30 |
| Lib files (packages/builder) | 10 |
| Lib files (apps/builder-standalone) | 19 |

---

### Safe Revert Points

| Tag | Date | Commit | Description |
|-----|------|--------|-------------|
| working-2026-03-02-deploy-fix | 2026-03-02 | 620c39c | DeployPanel reads from store, all routes 200 |
| working-2026-03-02-post-hydration-fix | 2026-03-02 | 4ef3a4d | Hydration fixed, 6 stores stubbed, lazy-loading |
| stable-builder-v1 | Earlier | — | Pre-hydration-fix baseline |
| monolith-baseline | Earlier | — | Original monolith before standalone extraction |

---

## Full Codebase Audit — 2026-03-05 (Commit 640c699)

### STEP 1: TypeScript Compile Check

**builder-standalone (tsconfig.json — strict mode): CLEAN ✅**
- Zero errors, zero warnings.

**Monorepo root (tsconfig.json — includes ALL apps): ~8815 errors**
- These are ALL pre-existing. No errors introduced by recent commits.
- Breakdown by category:

| Category | Count | Examples |
|----------|-------|---------|
| Missing module declarations (`@sarge/chat/index.client`, `@sarge/builder/index.client`) | ~80 | Root tsconfig doesn't resolve workspace package client exports |
| Implicit `any` types (missing TS7006 annotations) | ~200 | ForgeTrialsDashboard, ForgeTrialsHybrid, TogglePanel, chat/page.tsx |
| Missing lib modules (`@/lib/types/project`, `@/lib/toggles/pipeline`, etc.) | ~40 | Toggle system, SEO, accessibility, mailchimp/calendly injectors |
| Backup app errors (`builder-standalone-backup`, `chat-standalone-backup`) | ~100 | Stale backup copies not maintained |
| Other standalone apps (chat, trading, guardian, jury, etc.) | ~8000+ | Not actively maintained, many missing imports |
| Test file (`vitest` module) | 3 | `__tests__/templateSelection.test.ts` |

**Key insight**: builder-standalone compiles clean in its own tsconfig (strict mode). The root tsconfig includes everything including backup apps, unmaintained standalones, and test files that pull in different dependencies.

### STEP 2: Hardcoded Model/Provider/API Audit

**API URLs (56+ occurrences) — ACCEPTABLE**
- All provider API endpoints are static URLs. These should be hardcoded.
- Examples: `https://api.anthropic.com/v1/messages`, `https://api.openai.com/v1/chat/completions`

**Provider Routing Strings (85+ occurrences) — ACCEPTABLE**
- Provider names ("anthropic", "openai", etc.) used as routing keys in switch statements.
- These are system-level identifiers. Correct as-is.

**Hardcoded Default Models — SHOULD BE CONFIGURABLE**

| File | Line | Hardcoded Value | Impact |
|------|------|----------------|--------|
| `packages/core/src/stores/aiModeStore.ts` | 88 | `claude-sonnet-4-20250514` | Default bootstrap model |
| `packages/core/src/stores/aiModeStore.ts` | 116 | `["anthropic:claude-sonnet-4-20250514", "openai:gpt-4o"]` | Fallback chain |
| `apps/builder-standalone/lib/stores/workbenchStore.ts` | 28-32 | 5 models (claude, gpt-4o, gemini, grok, deepseek) | Workbench slots |
| `apps/builder-standalone/lib/stores/warRoomStore.ts` | 32-36 | 5 models (same set) | War Room monitors |
| `apps/builder-standalone/app/api/thread-guardian/route.ts` | 341 | `deepseek-chat` | Guardian fallback |
| `apps/builder-standalone/components/settings/ModelRegistry.tsx` | 31 | `deepseek-r1:8b` | Classifier model |
| `apps/builder-standalone/app/api/benchmark/assess/route.ts` | 68 | `gemini-2.5-flash` | Assessment model |
| `apps/builder-standalone/app/api/benchmark/compile/route.ts` | 55 | `gemini-2.5-flash` | Compiler fix model |
| `apps/builder-standalone/app/api/image/route.ts` | 48 | `grok-2-image` | xAI image model |

**API Key Format Validation (2 occurrences) — SAFE**
- `sk-ant-` prefix check (Anthropic) and `sk-` check (OpenAI) — validation only, no credentials stored.

### STEP 3: Hybrid System Model Audit

**Models are ALWAYS user-selected** — no auto-selection from scorecard data.

| Finding | Status |
|---------|--------|
| Scenario defaults to R1 Restaurant if no ID provided | FORCED DEFAULT (should require selection) |
| System prompt (`STEP_SYSTEM`) hardcoded globally | BY DESIGN (local/cloud variants) |
| Guardian is validation logic, not an AI model call | ACCEPTABLE |
| Scorecard data is informational only — never used for auto-selection | NOT IMPLEMENTED |
| `FALLBACK_LOCAL_MODELS` array for Ollama scan failure | ACCEPTABLE fallback |

**Key finding**: Trial scorecard results (scores, grades) are displayed as badges in the UI but NEVER used to recommend or auto-fill models in hybrid chains. Every step model is manually picked.

### STEP 4: Local Trial Runner Cloud Dependencies

**LOCAL RUNNER (`run/route.ts`): ZERO CLOUD DEPENDENCIES ✅**
- Talks only to Ollama at `127.0.0.1:11434`
- Scoring is pure local code (`scoreResponse()` from `@sarge/benchmark`)
- Can run 100% offline with just Ollama

**CLOUD RUNNER (`run-cloud/route.ts`): All cloud (expected)**

**HYBRID RUNNER (`run-hybrid/route.ts`): Mixed (expected)**
- Supports both Ollama and cloud providers per step
- Can run fully offline if all steps use local models

**Optional cloud dependencies (NOT in runners):**
- `/api/benchmark/assess` — requires Gemini API key (post-processing only)
- `/api/benchmark/compile` — requires Gemini API key (on-demand fix only)

### STEP 5: PM2 Process State

| PM2 ID | Name | Port | Status | Restarts | Notes |
|--------|------|------|--------|----------|-------|
| 0 | beast | 5000 | **STOPPED** | 0 | Monolith — not needed for builder-standalone |
| 4 | builder-standalone | 3101 | **ONLINE** | 18 | Running 56m, responds 200 on `/`, `/settings`, `/chat` |

Only 2 PM2 processes configured. All other standalone apps (chat, debate, trading, etc.) are NOT running and have no PM2 entries.
