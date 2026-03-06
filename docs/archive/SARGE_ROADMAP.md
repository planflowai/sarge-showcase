# S.A.R.G.E. FORGE — Master Roadmap & Feature Spec

**Last updated:** February 28, 2026  
**Owner:** Sarge  
**Architecture:** Monorepo with 9 git remotes, modular "Lego brick" design  
**Primary monitor:** 27" 2560x1440 — ALL UI is desktop-only, no mobile  
**Hardware:** 8GB VRAM (48GB GPU upgrade coming soon)

---

## STATUS LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ | Done and working |
| 🔧 | Built but has bugs / needs polish |
| 🚧 | In progress |
| 📋 | Specced out, not started |
| 💡 | Idea captured, needs full spec |

---

## 1. CORE PLATFORM

### 1.1 Beast (Main App — port 5000)
**Status:** ✅ Running  
The original monolith. Chat, builder, debate arena, batch, all features. Standalones are being extracted from this.

### 1.2 Chat Standalone (port 3100)
**Status:** ✅ Working  
- Single chat ✅
- Multi-chat (3-6 panes simultaneous) ✅
- Cloud providers: Claude, GPT, Gemini, Grok, DeepSeek ✅
- Local providers: Ollama (28 models), LM Studio ✅
- Compare button — cross-model response analysis ✅
- Bottom bar: Cloud/Local provider split, model card panel, no dropdowns ✅
- Light/dark mode ✅
- Standalone API routes (no beast dependency) ✅

### 1.3 Builder Standalone — S.A.R.G.E. Forge (port 3101)
**Status:** 🔧 Working, bugs remain  

**What works:**
- Site generation from prompts ✅
- Live streaming code view (LIVE indicator, code grows line by line) ✅
- Preview panel with live iframe ✅
- Plan / Build / Edit / Regen / Auto modes ✅
- Deploy pipeline: GitHub + Vercel Pro + Netlify Personal + Cloudflare Pages ✅
- Selective push targets (pick which services to deploy to) ✅
- Project management: New / Open / Delete (with GitHub repo cleanup) ✅
- Standalone API routes (18 routes copied from beast, no beast dependency) ✅
- Toolbar: Project, Quick Start, Commands, AI Team, UI Parts, AI Router, Activity ✅
- Resizable splitter between chat and preview ✅
- File versioning (v1, v2, v3 with restore) ✅
- Toast notification system ✅
- Export for Client / Download / Copy / Save to Library / Save to Project ✅
- Push button with toast feedback ✅
- Thread Guardian fully wired ✅

**Known bugs:**
- 🔧 File operation cards stuck on "Writing..." — need Done state when streaming ends
- 🔧 Progress strip stuck on "Reading context..." while code is generating — steps out of sync
- 🔧 "Single Local" badge keeps coming back in top right — needs permanent removal
- 🔧 Activity panel (189 changes) takes full right side — needs to default collapsed
- 🔧 Plan mode can overwrite site files — needs guard to only output to chat
- 🔧 CSS errors in generated sites cause blank deploys — need post-generation validation
- 🔧 UI sizing too conservative for 27" monitor — popovers, cards, spacing all too small
- 🔧 Claude Code keeps building for mobile/iPhone sizes despite 27" monitor instructions

**Missing / needs rebuild:**
- ❌ Jury Duty — completely wiped, zero references in codebase. Patent-critical feature.
- 🔧 UI Parts tab — empty, needs pre-built component library or removal
- 🔧 Cloudflare Pages connection inconsistent

### 1.4 Debate Arena
**Status:** ✅ Rebuilt from stubs  
- 3 agents + judge architecture
- Configurable rounds
- Citation prohibition mode
- Role picker
- Blind mode
- Full forensic logging

### 1.5 Batch Engine
**Status:** ✅ Fixed  
- Nav fixed, null guards applied
- 3-phase execution methodology
- Rebuilt after Claude Code wipe

---

## 2. THE FOUNDRY (formerly Workbench)

**Status:** 🔧 Built, needs logic + polish  
**Concept:** 5-monitor builder command center. Click "The Foundry" from Builder = all 5 monitors launch instantly with different AI models building the same site simultaneously. Pick the winner.

### Monitor Layout (matches physical desk):
```
[Mon 5] [Mon 1] [Mon 3]
[Mon 6]  (4=CC) [Mon 2]
```
Monitor 4 is ALWAYS the Command Center. Never a popout.

### What's built:
- ✅ 5-card monitor grid dashboard on Monitor 4
- ✅ WorkbenchDashboard, WorkbenchCard, WorkbenchPopout components
- ✅ workbenchStore (Zustand) — slots, models, statuses, selected targets
- ✅ workbenchPopoutManager — monitor-aware window.open
- ✅ BroadcastChannel protocol for command center ↔ popout communication
- ✅ Model selector per card
- ✅ Launch All / Recall All buttons
- ✅ Popout windows open to monitors

### Phase 1 — Cosmetic (not started):
- 📋 Rename Workbench → The Foundry everywhere (nav, headers, buttons, tooltips)
- 📋 Monitor 1 visual distinction — gold border or "ANCHOR" badge
- 📋 Promote button styling — appears only after build completes
- 📋 Fork indicator on each monitor showing which version it has
- 📋 Comparison grid view — all 5 previews side by side
- 📋 Foundry theme — match forge orange, consistent with rest of site
- 📋 Bottom broadcast bar styling
- 📋 Center text in cards
- 📋 Cards fill 27" monitor properly

### Phase 2 — Logic (not started):
- 📋 Click Foundry = instant launch, no landing page, no "Launch All" step
- 📋 Current project auto-loads into Monitor 1 as anchor
- 📋 Auto-fork project when broadcasting to Monitors 2-5
- 📋 Each monitor builds into its own forked folder (projectname-foundry-mon2, etc.)
- 📋 Monitor 1 stays untouched during broadcasts
- 📋 Promote button — fork replaces main project, Monitor 1 refreshes
- 📋 Recall always available from any page (not just when launched)
- 📋 Recall restores all monitors to last state
- 📋 Fork cleanup — manual delete or auto after 24 hours
- 📋 Push from Foundry deploys the promoted/anchor version

### Phase 3 — Additional features:
- 📋 Projects as visual cards — see, grab, rename, delete
- 📋 Master Asset Manager — per-project assets folder for logos, images, PDFs. Drag and drop, search, attach to builds.

---

## 3. DEPLOYMENT PIPELINE

**Status:** ✅ Working  

### Deploy targets:
| Platform | Plan | Status | Notes |
|----------|------|--------|-------|
| GitHub | Free (API) | ✅ Connected | Auto-creates private repos, uses GITHUB_TOKEN |
| Vercel | Pro ($20/mo) | ✅ Connected | Commercial use, fast CDN |
| Netlify | Personal ($9/mo) | ✅ Connected | 1000 credits/mo |
| Cloudflare Pages | Free | 🔧 Intermittent | Unlimited bandwidth, .cfignore issues |

### Flow:
1. Builder generates site → files saved to project folder
2. Click Push → select targets (GitHub, Vercel, Netlify, Cloudflare)
3. Git commit + push → auto-deploy on connected platforms
4. Client gets live URLs within minutes

### Needs:
- 🔧 Cloudflare Pages reliability — redirect loop, .cfignore not always created
- 📋 DNS failover — Cloudflare load balancing between Vercel + Netlify endpoints
- 📋 Client management — track which client gets which site/URL

---

## 4. TRADING STANDALONE

**Status:** 📋 Full spec, not started  
**Location:** L:/ai_builder/projects/sarge-trading (separate codebase)

### The 6-Step Build Plan:

**Step 1 — Shell:**
- Dashboard layout
- Left sidebar nav
- Top bar: balance, regime badge, VIX, Kill Switch
- Routes: /market-data, /strategy, /signals, /trade-log, /risk, /settings
- Bottom status bar

**Step 2 — Data Layer:**
- Polygon.io: real-time quotes, historical OHLCV
- Alpaca: paper trading account, positions, orders
- API keys in env vars, error handling, stale cache fallback

**Step 3 — Deterministic Engine (no AI):**
- Regime classifier: ADX(14) > 25 + price > SMA(20) = TRENDING, RSI(14) < 35 + price > SMA(200) = MEAN_REVERTING
- Signal generator: volume > 1.3x 20-day avg triggers, entry/stop/take-profit
- Risk manager: 2% max per trade, 3% daily loss cap, 30% max allocation, PDT counter
- All pure TypeScript math, no external TA libraries

**Step 4 — Jury Pipeline:**
- Signal passes risk manager → sent to 2-3 local Ollama models
- Each votes: APPROVE/REJECT with confidence + reasoning
- Composite score: 40% indicators + 40% model agreement + 10% regime + 10% sentiment
- Score ≥ 75% → escalate to cloud (Claude Haiku or Grok Fast) for macro check
- Cloud returns APPROVE or VETO
- Everything logged to FIFO cache (last 100 entries)
- Silent Jury runs background contradiction checks

**Step 5 — Wire UI:**
- Price tiles from Polygon
- Equity curve from Alpaca history
- Open positions from Alpaca account
- Signal pipeline flow diagram
- Trade log from FIFO ledger
- Risk monitor from riskManager state
- Kill switch cancels all orders + PAUSED flag

**Step 6 — Phase 0 Backtest:**
- Walk-forward: 12 months Polygon data, 6-month in-sample rolling to 3-month out-of-sample
- 0.1% slippage simulation
- Reports: Sharpe, win rate, profit factor, max drawdown, expectancy
- /backtest page with date picker + equity curve chart

### Multi-Monitor Layout:
5+ screens — each its own trading view: options, stocks, futures, crypto, +1 TBD. Same popout architecture as The Foundry.

---

## 5. MODEL SCOUT (Hugging Face Integration)

**Status:** 📋 Full spec, not started  
**Type:** Standalone module / new page  
**Route:** /models in builder-standalone

### Architecture:

**API Routes:**
- `/api/hardware/scan` — runs nvidia-smi for GPU VRAM, os.totalmem() for RAM. Cache result in localStorage.
- `/api/models/huggingface` — proxies search to HuggingFace API. GGUF format filter only. Pure TypeScript fetch, no Python.
- `/api/models/download` — downloads GGUF to L:/ai_models/, registers with Ollama via `ollama create`, returns progress via SSE.
- `/api/models/local` — scans L:/ai_models/ + `ollama list` for already-installed models.

### Page Layout:
1. **Hardware banner** — "Your rig: [GPU] [VRAM]GB — Safe models up to ~13B Q4 / 7B Q5"
2. **Search bar** — debounced 500ms, searches HuggingFace API
3. **Filter chips** — All, Chat, Code, Reasoning, Vision, Trading
4. **Model cards grid** — name, author, size badge, fit badge (green/yellow), use-case tags, quant options, checkbox, download button, "already installed" detection
5. **Bottom sticky bar** — batch selection: "[X] selected | Select All | Download Selected"
6. **Download queue** — slide-out with per-model progress, auto Ollama registration, green toast on complete

### Fit Calculation:
- GGUF file size < VRAM × 0.85 = Green "Fits Perfect"
- GGUF file size < VRAM × 1.1 = Yellow "Tight Fit — try Q3/Q4"
- GGUF file size > VRAM × 1.1 = Hidden (don't show)

### Build Phases:
- **Phase 1:** Page + search + display + hardware scan + local detection (1 session)
- **Phase 2:** Download queue + Ollama registration + model picker integration (1 session)

### Integration:
- Downloaded models appear in existing Ollama model picker
- Future: HuggingFace tab alongside Ollama tab in model selection

---

## 6. RECON (Screen Intelligence Module)

**Status:** 📋 Concept spec, not started  
**Type:** Universal module — works with Trading, Builder, Chat, Debate  
**Concept:** Passive intelligence layer that reads your 6 monitors and makes screen content available to any SARGE app.

### Use Case:
You have Grok, Claude, GPT open in browser tabs on different monitors. Your local LLMs capture screenshots, extract key information, and consolidate it — feeding intelligence into your trading signals, builder feedback, or chat context. No API keys used for the premium services. You interact with them normally as a user; Recon reads what's on screen.

### Architecture:

**Layer 1 — Capture:**
- Persistent Node process (separate from SARGE apps)
- Screenshots any monitor/window on demand
- Uses `screenshot-desktop` npm package or Windows native APIs
- Rolling buffer — last 10 captures per monitor, auto-cleanup
- API: `GET /api/recon/capture?monitor=2`
- Runs on its own port via PM2

**Layer 2 — Extract:**
- Feeds screenshot to local vision model (LLaVA, Qwen2-VL, or larger with 48GB GPU)
- Returns structured text — key data points, numbers, conclusions
- API: `GET /api/recon/extract?monitor=2`
- Alternative fast path: DOM reading for embedded webviews (faster, more accurate, but limited to webviews you control)

**Layer 3 — Consolidate:**
- Takes extracted data from multiple monitors
- Task-specific synthesis prompts:
  - Trading: "Summarize market analysis from these sources into actionable signals"
  - Builder: "Extract design recommendations from these reviews"
  - General: "What's on my screens?"
- API: `POST /api/recon/consolidate` with `{ monitors: [2,3,5], task: 'trading-signals' }`

**Layer 4 — Integrate:**
- Each SARGE app has a hook/button that pulls from Recon
- Trading: "Scan Monitors for Intel"
- Builder: "Gather Feedback"
- Chat: "What's on my screens?"
- Same pipeline, different consolidation prompts

### Build Phases:
- **Phase 1:** Capture service + API (1 session) — screenshot any monitor, store in buffer
- **Phase 2:** Extract with vision model (1 session) — wire Ollama vision model, test accuracy
- **Phase 3:** Consolidation + app integration (1 session) — synthesis layer, hooks in each app

### Hardware Notes:
- 8GB VRAM is tight for vision model + chat model simultaneously
- 48GB GPU solves this — dedicated vision model for Recon while chat models run
- Start with on-demand capture, add continuous monitoring later

---

## 7. FIGHT CLUB (Multi-Model Debate Arena)

**Status:** 📋 Spec drafted, not started  
**Type:** Lego brick module  
**Concept:** Multi-model real-time debate arena with fighters, judge, search orchestrator, personality prompts. Separate from the existing Debate Arena (which is 3 agents + judge for research/analysis).

### Spec:
- Fighters: 2-5 models assigned different positions
- Judge: separate model scores arguments
- Search orchestrator: Tavily/DuckDuckGo for real-time evidence
- Personality prompts: each fighter has a persona (devil's advocate, optimist, skeptic, etc.)
- Real-time streaming of all fighters simultaneously
- Scoring and verdict system

### Notes:
- Grok validated the spec as solid and modular
- Builds on existing debate architecture but with more real-time features

---

## 8. JURY DUTY (Patent-Critical Feature)

**Status:** ❌ Completely wiped — needs full rebuild  
**Priority:** HIGH — patent filed for "Hybrid AI Fact-Verification System with Local Refinement and Judicial Oversight"

### What it was:
- Multi-model cross-check system where models verify each other's output
- Pre-emptive evidence audit gate: one model audits evidence admissibility before another can use it for reasoning
- Separated LLM functions preventing fabricated claims from entering reasoning chains
- Successfully demonstrated in controlled experiments with statistical significance

### What needs rebuilding:
- **Jury Duty store** — panel state, verdicts, model assignments
- **Settings UI** — configure which models serve as jurors, confidence thresholds
- **Builder integration** — after a build, automatically send output to juror models for verification
- **API route** — sends build output to 2-3 other models, collects verdicts
- **Verdict UI** — panel showing pass/fail/concerns from each juror
- **Patent alignment** — ensure implementation matches patent claims

### Notes:
- Thread Guardian survived the wipe and is fully wired
- Jury Duty has zero references in the current codebase
- May have remnants in the beast — needs audit: search for 'jury', 'juryDuty', 'verdict', 'juror'

---

## 9. ADDITIONAL FEATURES & IDEAS

### 9.1 Chat ↔ Builder Context Sharing
**Status:** 📋 Specced  
- "Send to Builder" button on any AI response in chat
- "Send to Multi-Chat" button
- Builder, Chat, and Multi-Chat share context — all working on the same project
- Navigate between modes without losing thread

### 9.2 Connection Status Indicators
**Status:** 📋 Specced  
- Replace "Unsecured/Online" badges with real status:
  - `[● Cloud ✓]` `[● Ollama ✓]` `[● LM Studio ✗]` `[○ HuggingFace]`
- Health check pings on page load
- Green = connected, Red = unreachable, Grey = not configured

### 9.3 Dark/Light Theme — Full Pass
**Status:** 🔧 Partially done  
- 15 of 19 pages still have hardcoded dark colors
- Theme toggle exists and works on some pages
- Needs dedicated session to convert all pages to CSS variables / dark: prefixes

### 9.4 Client Management System
**Status:** 💡 Idea  
- Track clients, their sites, URLs, deploy status
- Per-client asset management
- Invoice tracking? Or just project tracking?

### 9.5 DNS Failover
**Status:** 💡 Idea  
- Cloudflare load balancing between Vercel + Netlify endpoints
- Health checks every 60 seconds
- Automatic failover if one platform goes down

### 9.6 Web Search Integration
**Status:** 🔧 Partially built  
- Tavily search already in API route (app/api/test/stream/route.ts)
- Globe button toggles web search on/off per request
- Requires TAVILY_API_KEY in .env.local
- DuckDuckGo as backup — not implemented yet
- Needs testing across all models

### 9.7 PM2 / Auto-Start Configuration
**Status:** 🔧 Built, needs verification  
- ecosystem.config.cjs created for Windows
- start-sarge.vbs for boot-time launch
- PM2 service was killed during debug session — needs re-registration

---

## 10. INFRASTRUCTURE & TECHNICAL DEBT

### Git Setup:
- 9 remotes: origin, sarge-main, sarge-builder, sarge-chat, sarge-core, sarge-batch, sarge-showcase, sarge-trading, sarge-ui
- Branch: sargebuild-v1
- All commits push to all 9 remotes

### Environment:
- .env.local at monorepo root — shared by all apps
- Keys: GITHUB_TOKEN, ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, GOOGLE_API_KEY, DEEPSEEK_API_KEY, TAVILY_API_KEY
- CLIs installed: wrangler, vercel, netlify, gh (GitHub CLI)

### Known Technical Issues:
- localStorage SSR error on builder startup — warning only, doesn't crash
- `util._extend` deprecation warning from PM2
- Beast proxy — some standalone routes still proxy to beast unnecessarily
- Builder sometimes generates multi-file output (variables.css, navbar.html) instead of single index.html — needs system prompt guidance

### Claude Code Rules (CLAUDE.md):
- Always prefix prompts: "STOP. Read this ENTIRE prompt before writing ANY code."
- YOLO mode is ON — be precise, no room for misinterpretation
- Always specify "DO NOT TOUCH" sections
- Always push to all 9 remotes
- Always specify 27" monitor / 2560x1440 / desktop only
- Auto-accept file writes, but pause before: deleting files, destructive commands, or modifying 5+ files

### Patent:
- Filed: "Hybrid AI Fact-Verification System with Local Refinement and Judicial Oversight"
- Covers: pre-emptive evidence audit gate, separated LLM functions, multi-agent debate with judicial oversight
- Implementation: Thread Guardian (working) + Jury Duty (needs rebuild)

---

## 11. BUILD PRIORITY ORDER

### Immediate (current session focus):
1. Fix builder bugs (Writing... stuck, progress sync, Single Local badge, Activity panel)
2. 27" monitor sizing pass across all components
3. The Foundry — cosmetic rename + styling

### Next sessions:
4. The Foundry — logic (fork, promote, recall)
5. Builder cosmetic polish (popovers, templates, model selection matching chat)
6. Jury Duty rebuild (patent-critical)

### After builder is locked:
7. Trading Standalone — Step 1 (shell) through Step 6 (backtest)
8. Model Scout — Phase 1 (search + display) then Phase 2 (download + Ollama)
9. Recon — Phase 1 (capture) through Phase 3 (consolidation)

### When time allows:
10. Fight Club module
11. Chat ↔ Builder context sharing
12. Client management system
13. DNS failover
14. Full dark/light theme pass
15. Connection status indicators

---

## 12. HARDWARE ROADMAP

### Current:
- 6-monitor setup (27" primary on Monitor 4)
- 8GB VRAM GPU
- 28 Ollama models (up to ~13B Q4)

### Coming:
- 48GB VRAM GPU upgrade
  - Unlocks: 70B+ models locally
  - Unlocks: vision models for Recon (LLaVA, Qwen2-VL at full resolution)
  - Unlocks: simultaneous models (jury pipeline + chat + vision)
  - Unlocks: trading signal models running 24/7
  - Model Scout will rescan and show previously hidden large models

---

*This document lives in the project root. Update it after every major session. When starting a new thread with Claude, paste this file for instant context.*
