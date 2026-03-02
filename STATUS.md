# S.A.R.G.E. — System Status Report

Generated: 2026-03-02
Commit: 620c39c
Branch: sargebuild-v1
Tag: working-2026-03-02-deploy-fix

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
