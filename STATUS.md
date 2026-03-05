# S.A.R.G.E. — System Status Report

Generated: 2026-03-04
Commit: 0a96600
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
| Live event ticker | Works | Progress strip shows event count, seconds since last event, stall warnings (10s amber, 30s red) |
| Live activity panel | Works | Collapsible panel below progress strip — scrolling event log with type badges, model/round/score, timestamps, max 100 entries |
| Remaining cloud models | **Not started** | Gemini, Grok, GPT, Claude — next step |
| Local trials (Ollama) | **Not tested this session** | 15 scenarios, Ollama backend |
| Routing summary layer | **Not started** | Depends on complete score matrix |

### Recent Changes (Since Last Status)

| Date | Commit | Change |
|------|--------|--------|
| Mar 4 | (latest) | Hybrid — font fixes (all content text-sm/zinc-200 minimum), progress bar 8px tall, Level 11 Events scenario (19th scenario, expert). |
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
