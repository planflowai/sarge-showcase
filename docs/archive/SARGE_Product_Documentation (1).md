# S.A.R.G.E. — Systematic AI Response Generation Engine

## Complete Product Documentation

**Version:** 3.0 — Master Build List + Client Delivery Pipeline  
**Date:** March 2, 2026  
**Author:** Sarge (R. Gallo)  
**Status:** Active Development — 11 Apps, 90,000+ Lines, Pre-Revenue

---

## 1. Vision & Overview

### What Is S.A.R.G.E.?

S.A.R.G.E. (Systematic AI Response Generation Engine) is a comprehensive AI development platform that orchestrates multiple AI models across a unified interface. It is not a single application — it is an ecosystem of interconnected modules that share a common architecture, allowing components to be mixed, matched, and deployed independently.

The platform addresses a fundamental problem: no single AI model is best at everything. By running multiple models simultaneously — competing, cross-checking, and building together — S.A.R.G.E. produces outputs that are more reliable, more creative, and more thoroughly vetted than any single model could achieve alone.

### Core Philosophy

**Multi-Agent Architecture:** Every task benefits from multiple perspectives. Whether building a website, verifying facts, or analyzing data, S.A.R.G.E. leverages the strengths of different AI models working in parallel.

**Modular "Lego Brick" Design:** Every component is designed to work independently or snap together with other components. A debate engine can be used for fact-checking OR for code review. A builder can run standalone OR inside The Pit command center.

**Trust Through Verification:** Inspired by the legal system — claims require evidence, evidence requires validation, and no single agent can be judge, jury, and executioner. This principle runs through the entire platform, from the AI Tribunal to the Thread Guardian.

### Origin Story

S.A.R.G.E. was conceived and built by a single developer with zero prior coding experience, zero knowledge of LLMs, agents, architecture, or deployment. The concept existed as an idea before the tools to build it were even discovered. Over the course of approximately 60 days, the entire platform was designed, prototyped, built, catastrophically wiped (in a 2-hour incident with Claude Code), and rebuilt from near-scratch in 3 days — emerging stronger with a modular standalone architecture and filed patent.

The entire system runs on a single machine with an 8GB GPU.

---

## 2. Platform Architecture

### Monorepo Structure

S.A.R.G.E. operates as a monorepo with 9 git remotes, enabling redundant backup and multi-platform deployment. The repository uses a modular architecture where shared packages serve multiple applications.

```
ai_builderv2/
├── apps/
│   ├── builder-standalone/     — The Foundry (web builder + The Pit)
│   ├── chat-standalone/        — Chat interface
│   ├── guardian-standalone/    — Thread Guardian
│   ├── jury-standalone/       — Jury Duty
│   ├── debate-standalone/     — Debate Arena (planned)
│   ├── forensic-standalone/   — Forensic Logging (planned)
│   ├── trading-standalone/    — Trading application (planned)
│   ├── war-room/              — War Room (multi-model arena)
│   ├── diagnostics-standalone/ — Diagnostics
│   ├── apps-standalone/       — Apps Hub (Resume Tailor etc.)
│   └── main/                  — Beast shell (skeleton)
├── packages/
│   ├── builder/               — Shared builder components (23,438 lines)
│   ├── core/                  — Cross-app utilities, stores, types (21,593 lines)
│   ├── chat/                  — Chat views, debate, forensic (16,838 lines)
│   ├── diagnostics/           — Diagnostics page component
│   └── apps/                  — Apps hub, Resume Tailor
├── lib/
│   ├── stores/                — Zustand state management (canonical sources)
│   ├── models/                — AI model configurations
│   ├── threadGuardian/        — Guardian engine + context builder
│   ├── juryGuardian/          — Jury engine
│   └── utils/                 — Shared utilities
├── components/
│   ├── chat/                  — Jury UI components (3 files)
│   ├── debate/                — Debate Arena (10 files, 2,336 lines)
│   ├── forensic/              — Forensic Logging (6 files, 1,873 lines)
│   └── Builder/               — Builder components
├── backups/                   — Safety snapshots (pre-wipe copies)
└── public/
    └── assets/                — Shared static assets
```

**Total codebase:** ~90,000+ lines across all standalone apps and shared packages.

### Port Assignments

Each application runs on its own port for simultaneous development and testing:

| Port | Application | Package Name | Status |
|------|------------|-------------|--------|
| 5000 | S.A.R.G.E. (Beast monolith) | root | Running |
| 3100 | Chat Standalone | @sarge/chat-standalone | Running |
| 3101 | The Foundry (Builder) | @sarge/builder-standalone | Running |
| 3102 | Diagnostics Standalone | @sarge/diagnostics-standalone | Running |
| 3103 | Apps Hub (Resume Tailor etc.) | @sarge/apps-standalone | Running |
| 3004 | War Room | @sarge/war-room | Running |
| 3104 | Thread Guardian | @sarge/guardian-standalone | Running |
| 3105 | Jury Duty | @sarge/jury-standalone | Running |
| 3106 | Debate Arena | @sarge/debate-standalone | Planned |
| 3107 | Forensic Logging | @sarge/forensic-standalone | Planned |
| 3108 | Trading App | @sarge/trading-standalone | Planned |
| — | The Pit (Workbench) | Built into builder-standalone | Running (popout windows) |

**Total active ecosystem:** 11 applications + shared packages on a single machine with 8GB GPU.

### Git Remote Configuration

9 git remotes provide redundant backup across multiple platforms. All commits are pushed to all remotes simultaneously.

### Technology Stack

- **Framework:** Next.js 16+ with App Router
- **Language:** TypeScript
- **State Management:** Zustand stores with persistence
- **Styling:** Tailwind CSS with CSS variables for theming
- **Code Editor:** Monaco Editor (VS Code engine)
- **Package Manager:** pnpm with workspace support
- **Deployment:** Vercel, Netlify, Cloudflare Pages, GitHub Pages
- **AI Providers:** Claude, GPT, Gemini, Grok, DeepSeek, Ollama, LM Studio

---

## 3. The Foundry (Builder Application)

### Overview

The Foundry (formerly S.A.R.G.E. Forge) started as an AI-powered website builder. It has evolved into a full freelance web agency operating system — client intake, multi-model building, SEO, compliance, deployment, analytics, and maintenance in one platform. If S.A.R.G.E. is the ecosystem, The Foundry is the revenue engine. It is effectively S.A.R.G.E. v2 — the commercial face of the platform.

### Builder Pipeline

The complete flow from prompt to deployed website:

```
User Prompt → AI Streaming → Code Extraction → File Write → Preview Render → Deploy
```

**Step 1: User Input**
The user types a natural language prompt describing what they want built. The prompt is sent to the selected AI model via the /api/chat route.

**Step 2: AI Streaming**
The selected model generates HTML/CSS/JS code in a streaming response. The progress strip shows forge-themed status updates: "Stoking the forge → Reading the blueprints → Pouring metal → Quenching."

**Step 3: Code Extraction**
The streaming response is parsed to extract code blocks. The `extractCodeFromMarkdown` function identifies HTML, CSS, and JavaScript within the AI's response and separates it from conversational text.

**Step 4: File Write**
Extracted code is written to disk via the `/api/builder/write-file` API route. The status flow is critical:
- `undefined` → `streaming` (during generation)
- `streaming` → `pending` (when generation completes)
- `pending` → auto-apply fires → `applied` (file written to disk)
- If write fails → `error`

**Step 5: Preview Render**
The preview panel renders the generated HTML using `srcdoc` mode (for single-file sites) or `localhost` mode (for multi-file sites). The preview refreshes automatically when files are applied.

**Step 6: Deploy**
One-click deployment to multiple platforms via the Deploy panel:
- GitHub (repository creation and push)
- Vercel (CLI-based deployment)
- Netlify (CLI-based deployment)
- Cloudflare Pages (CLI-based deployment)

### Builder Modes

| Mode | Purpose | Behavior |
|------|---------|----------|
| Plan | Strategy | AI analyzes request, proposes approach without generating code |
| Build | Full Generation | AI generates complete files from scratch |
| Edit | Surgical Changes | AI modifies existing code — CSS tweaks, content changes, bug fixes |
| Regen | Regenerate | Re-runs the last generation with the same or modified prompt |
| Auto | Automated | Sends prompt, auto-applies, auto-refreshes — hands-free building |

### Version Management

Every file write creates a new version. The version system allows:
- Browsing through versions with arrow navigation (v1 of 11, v2 of 11, etc.)
- Restoring any previous version — writes the old code back to disk and refreshes preview
- Restore works even during stuck streaming states (force-clears isStreaming)
- Push after restore sends the restored version

### Live Code Streaming

The Code tab displays code as it's being generated in real-time via Monaco Editor. Features:
- Auto-scrolls to the bottom as new lines appear
- Syntax highlighting for HTML/CSS/JS
- Read-only during streaming to prevent accidental edits
- User can switch between Code and Preview tabs without interrupting generation
- If the user sees something wrong (wrong color, bad structure), they can hit Stop immediately

### Streaming Safeguards

- **120-second inactivity timeout:** If no data chunks arrive for 120 seconds, the request is automatically aborted
- **Error-before-code handling:** If the API errors before producing any code fence, streaming state is properly cleared
- **Empty code guard:** BuilderPage handles empty responses gracefully without crashing
- **Force-clear on restore:** Restoring a version clears any stuck streaming state

### Deploy Pipeline

**Project Initialization:**
When a new project is created, the deploy system:
1. Creates a GitHub repository via GitHub API
2. Initializes git in the project folder
3. Links Vercel, Netlify, and Cloudflare if their CLIs are installed and authenticated

**Push Flow:**
The Push button shows a dropdown with available targets. Each target is detected by the presence of config files:
- GitHub: always available (uses GITHUB_TOKEN)
- Vercel: available if `.vercel/project.json` exists
- Netlify: available if `.netlify/state.json` exists
- Cloudflare: available if `wrangler.toml` exists

**Static Site Configuration:**
For Netlify, a `netlify.toml` is generated with no build command and `publish = "."` — raw static files are deployed directly.

---

## 4. The Pit (Command Center)

### Overview

The Pit (formerly Workbench) is a 5-monitor command center that runs on the user's primary display (Monitor 4). It orchestrates up to 5 AI models working simultaneously on the same project, enabling competitive builds, cross-checking, and collaborative iteration.

### Physical Layout

The Pit maps to a 6-monitor desk configuration:

```
[Mon 5]  [Mon 1]  [Mon 3]
[Mon 6]  [Mon 4]  [Mon 2]
```

- **Monitor 4:** The Pit dashboard (command center) — always the main screen
- **Monitors 1, 2, 3, 5, 6:** AI model workstations that pop out to their respective physical monitors

### Dashboard Components

**Title Bar:** "THE PIT" — 36px, font-weight 800, centered below The Foundry header

**Monitor Cards:** 5 cards in a grid matching the physical desk layout. Each card features:
- Model-colored 2px border (full box, 4 sides, 12px radius)
- Model name centered and bold in the card body (22px, brand color)
- Model dropdown for changing the assigned model
- Status indicator: IDLE / BUILDING / COMPLETE / ERROR
- MON number and slot identifier
- ANCHOR badge on Monitor 1 (gold border)

**Model Color Scheme:**

| Model | Brand Color |
|-------|------------|
| Claude | Orange (#FF6700) |
| GPT | Green (#10a37f) |
| Gemini | Blue/Purple (#4285f4) |
| Grok | Pink (#ff0080) |
| DeepSeek | Teal (#00b4d8) |
| Ollama | Grey (#888) |
| LM Studio | Purple (#8b5cf6) |

**Toolbar:** Three button groups between title and card grid:
- Project: New / Open / Save / Delete / Clear
- Build: Plan / Build / Edit / Regen
- Deploy: Push / Deploy / Export / Download

**Status Bar:** Between card grid and broadcast bar showing project name, file count, and last action.

**Broadcast Bar:** Full-width prompt input with "Broadcast" button and monitor target selection (MON 1 through MON 6 with Deselect All).

**Controls:** Launch All (opens all popout windows), Recall All (closes all popouts), Exit.

### Broadcast System

The broadcast system sends the same prompt to all selected monitors simultaneously:
1. User types prompt in broadcast input
2. Selects target monitors (default: all selected)
3. Clicks Broadcast
4. Each selected monitor receives the prompt and begins building with its assigned model
5. All builds run in parallel — faster models finish first
6. Results appear as preview thumbnails in each card

### Fork Management

**Anchor (Monitor 1):** The primary build. Gold-bordered. Protected from accidental overwrites. Builds into the main project folder.

**Challengers (Monitors 2-6):** Independent forks that build into separate directories:
- `projects/[name]-pit-mon2/`
- `projects/[name]-pit-mon3/`
- `projects/[name]-pit-mon5/`
- `projects/[name]-pit-mon6/`

**Promote to Anchor:** Right-clicking any challenger card and selecting "Promote to anchor" copies that model's output to the anchor's project folder, replacing the current primary build.

### Right-Click Context Menu

Each monitor card supports:
- Recall this monitor (close the popout window)
- Promote to anchor
- View code (opens generated code in new window)
- View preview (opens rendered HTML in new window)
- Reset (sets status back to idle)

### Popout Windows

Each monitor opens as a separate browser window positioned on the corresponding physical monitor. Popout features:
- Full model name centered and bold (24px+)
- "Waiting for prompt from command center..." status
- Header bar with model badge, name, and MON/SLOT info
- Receives prompts via BroadcastChannel API

### Light/Dark Mode

The Pit fully supports light and dark themes:
- Dark: #0a0a0a backgrounds, light text, colored borders
- Light: white/grey backgrounds, dark text, same colored borders
- Toggle via sun/moon icon in top-right header
- CSS variables and Tailwind dark: classes throughout

---

## 5. Forge Animations

### Overview

All generic loading spinners and status indicators have been replaced with forge-themed CSS animations. These are pure CSS with zero external dependencies.

### Animation Catalog

| Animation | Class | Purpose | Status Text |
|-----------|-------|---------|-------------|
| Forge Hammer | `.forge-hammer` | File writing / applying to disk | "Forging..." |
| Molten Pour | `.molten-pour` | Code generation / streaming | "Pouring metal..." |
| Ember Ring | `.ember-ring` | Processing / analyzing | "Tempering..." |
| Bellows Breathe | `.bellows` | Loading context / warming up | "Stoking the forge..." |
| Forged Complete | `.forge-done` | Success / file applied | "Forged ⚒️" |
| Forge Crack | `.forge-failed` | Error / failed operation | "Cracked" |

### Size Variants

Each animation has three size variants:
- **Full size:** Used in standalone displays and demo pages
- **Mini (`.mini`):** Used inline in file cards (28-36px)
- **Micro (`.micro`):** Used in progress strip indicators (20px)

### Progress Strip

The builder's progress strip uses forge terminology:
1. Stoking the forge (loading context)
2. Reading the blueprints (analyzing request)
3. Pouring metal (generating code)
4. Quenching (building preview)

Completed steps show an orange ✓. Active step shows an ember ring animation. Pending steps show grey text.

### Color Scheme

All animations use the forge orange palette:
- Primary: #FF6700
- Accent: #FF4500
- Glow: rgba(255, 103, 0, 0.5)
- Error: #dc2626

---

## 6. AI Model Support

### Cloud Providers

| Provider | Models | API Key Variable |
|----------|--------|-----------------|
| Anthropic (Claude) | Claude Opus 4.5/4.6, Sonnet 4.5, Haiku 4.5 | ANTHROPIC_API_KEY |
| OpenAI (GPT) | GPT-4o, GPT-4 Turbo, GPT-3.5 | OPENAI_API_KEY |
| Google (Gemini) | Gemini 2.5 Pro, Gemini 2.0 Flash | GOOGLE_API_KEY |
| xAI (Grok) | Grok 4, Grok 3 | XAI_API_KEY |
| DeepSeek | DeepSeek V3 (Chat/Code) | DEEPSEEK_API_KEY |

### Local Providers

| Provider | Connection | Models |
|----------|-----------|--------|
| Ollama | http://localhost:11434 | Any model pulled via `ollama pull` |
| LM Studio | http://localhost:1234 | Any model loaded in LM Studio |

### Model Selection

Models can be selected:
- Per-conversation in the builder's model dropdown
- Per-monitor in The Pit's card dropdowns
- All models use the same /api/chat route with provider-specific handling

---

## 7. AI Tribunal / Jury Duty (Debate Arena)

### Overview

The AI Tribunal is a multi-agent debate system for evaluating AI model reliability and detecting hallucination. It features separated LLM functions where one model audits evidence admissibility before another can use it for reasoning — a novel architecture covered by a filed patent.

### Patent

**Title:** Hybrid AI Fact-Verification System with Local Refinement and Judicial Oversight

**Key Innovation:** Pre-emptive evidence audit gate architecture. A dedicated "gatekeeper" model evaluates the admissibility of evidence before it can enter the reasoning chain of the primary model. This separation prevents fabricated claims from contaminating reasoning.

### Architecture

```
User Claim → Evidence Gathering → Audit Gate → Admitted Evidence Only → 
Debate (Pro/Con Agents) → Judge Evaluation → Verdict with Confidence Score
```

**Agents:**
- **Prosecution:** Argues the claim is false, presents counter-evidence
- **Defense:** Argues the claim is true, presents supporting evidence
- **Judge:** Evaluates arguments, weighs evidence, delivers verdict
- **Gatekeeper:** Audits all evidence for admissibility before it enters debate

### Debate Format

- 2-10 configurable rounds
- Each round: prosecution presents, defense responds, judge evaluates
- Real-time hallucination tracking with "poison pill" injection testing
- Complete forensic logging of all agent interactions
- Final verdict with confidence score and reasoning chain

### Testing Results

Controlled experiments with multiple AI providers demonstrated:
- System successfully detects and contains misinformation with statistical significance
- Poison pill injection (deliberately false evidence) is caught by the audit gate
- Multi-agent debate produces more reliable conclusions than single-model analysis
- The separated gatekeeper architecture prevents fabricated claims from entering reasoning chains

### Market Context

- Addresses a $2.95 billion AI trust and security market
- Enterprise costs approximately $14,200 per employee annually for AI error correction
- Applicable to regulated industries requiring air-gapped AI (finance, healthcare, defense)

### Current Status

The Debate Arena was wiped in the code loss incident and needs complete rebuild. The patent has been filed. The architecture and testing methodology are documented. Rebuilding is a high priority due to patent-critical nature.

---

## 8. Thread Guardian

### Overview

Thread Guardian is a conversation safety and quality system that monitors AI interactions for:
- Hallucination propagation across conversation turns
- Echo chamber formation in multi-model discussions
- Evidence quality degradation over long conversations
- Misinformation amplification patterns

### Architecture

Thread Guardian operates as a passive monitoring layer that can be attached to any conversation:
- Monitors all messages between user and AI
- Flags potential hallucinations with confidence scores
- Tracks evidence chains across conversation turns
- Alerts when echo chamber patterns are detected

### Current Status

Thread Guardian needs rebuild after the code wipe. Core concept and architecture are designed. Implementation is planned after the Debate Arena rebuild.

---

## 9. Trading Application

### Overview

A standalone trading application extracted from the main S.A.R.G.E. codebase. Features real-time market data and paper trading capabilities.

### Integrations

- **Polygon.io:** Real-time and historical market data
- **Alpaca:** Paper trading execution (no real money)

### Current Status

Extracted to standalone app. Basic functionality in place. Running on port 3102.

---

## 10. Development History

### Timeline

**Days 1-30: Discovery & Prototype**
- Concept developed independently without knowledge of existing AI agent frameworks
- Multi-agent debate principles discovered through experimentation
- Makeshift prototype built to test core concepts

**Days 30-55: The Beast**
- Discovered Claude Code — accelerated development dramatically
- Built full S.A.R.G.E. platform with all modules:
  - Chat interface with multi-model support
  - Builder with preview and deploy
  - Debate Arena with tribunal system
  - Trading integration
  - Workbench (now The Pit) with multi-monitor support
- Filed patent for Hybrid AI Fact-Verification System
- Conducted extensive testing including hallucination injection experiments

**Day 56: The Wipe**
- Claude Code accidentally wiped substantial portions of the codebase
- Loss included debate arena, guardian system, and portions of builder

**Days 57-60: The Rebuild**
- Rebuilt 95% of functionality in 3 days
- Pivoted to modular standalone architecture
- Created 5 standalone applications with shared packages
- Implemented comprehensive deployment pipeline
- Added forge-themed animations and The Foundry branding
- Built The Pit command center with 5-monitor support

### Key Milestones

| Date | Milestone |
|------|-----------|
| ~Jan 2026 | Concept developed, prototype started |
| ~Feb 2026 | Full platform built ("The Beast") |
| Feb 2026 | Patent filed: Hybrid AI Fact-Verification System |
| Feb 26, 2026 | Code wipe incident |
| Feb 27-28, 2026 | Rebuild begins — standalone architecture |
| Feb 28, 2026 | File write pipeline fixed (1-line bug in status transitions) |
| Feb 28, 2026 | Deploy pipeline working (GitHub, Vercel, Netlify) |
| Feb 28, 2026 | Forge animations implemented (6 animations, pure CSS) |
| Feb 28, 2026 | Restore/revert system fixed |
| Feb 28, 2026 | Live code streaming in Code tab |
| Mar 1, 2026 | The Foundry rebrand + The Pit cosmetic overhaul |
| Mar 1, 2026 | The Pit broadcast system (in progress) |

---

## 11. Technical Deep Dives

### The File Write Bug (Feb 28, 2026)

**Symptom:** File operation cards showed green "Applied" badge but files never wrote to disk.

**Root Cause:** In StreamingMessageRenderer.tsx, line 151:
```typescript
// BUG: Status never transitions from "streaming" to "pending"
if (!prev[edit.filePath]) {
  next[edit.filePath] = "pending";
}
```
The condition checked if the status didn't exist, but by this point it was already set to "streaming". Since "streaming" !== undefined, the condition failed, and the status never transitioned to "pending" — which is what triggers auto-apply.

**Fix:** One line change:
```typescript
if (!prev[edit.filePath] || prev[edit.filePath] === "streaming") {
  next[edit.filePath] = "pending";
}
```

**Lesson:** The "Applied" badge was cosmetic — it rendered based on "streaming ended" logic, not actual write confirmation. The real state machine was broken. Diagnostic logging (🔴 write-file API, 🔵 handleApplyFile) proved the API was never called, redirecting the investigation to the status transition layer.

### The Restore 403 Bug (Mar 1, 2026)

**Symptom:** Clicking Restore returned 403 Forbidden from /api/builder/write-file.

**Root Cause:** The restore function sent `artifactStorePath` (a relative path like "index.html") directly to the write-file API. The API's path validator requires absolute paths and rejects relative paths as a security violation (403).

The Apply function worked because it always constructed an absolute path: `${projectPath}/${cleanRelativePath}`.

**Fix:** Construct the absolute path in handleRestoreVersion the same way Apply does — prepend projectPath if the path doesn't start with a drive letter.

---

## 12. Commercial Client Pipeline

### Overview

The Foundry is not just a personal builder — it is a complete freelance web agency operating system. Every step from project creation to client handover is automated or one-click.

### The Pipeline

```
New Project → Domain Setup → Build → SEO Optimize → Deploy → Analytics → Handover → Maintenance
```

Each step is a revenue point. Each step is automated.

### Project Onboarding Flow

**Loading an Existing Project:**
1. Open project → automatic back-check runs
2. Shows: "Live on GitHub (commit abc123)" with green checkmarks
3. Displays all live URLs: Vercel, Netlify, Cloudflare — clickable, copyable
4. Custom domain status (if configured): green = active, pending = DNS propagating
5. Jump straight into building — zero friction

**Creating a New Project:**
1. Click "New Project" → onboarding modal appears
2. Project name (auto-suggested if blank)
3. "Custom domain?" toggle (yes/no)
   - Yes: enter domain (e.g., clientname.com) + optional client email
   - No: uses random subdomain (project-abc.vercel.app)
4. Click "Start" — everything fires automatically:
   - Git init + GitHub repo creation
   - Push initial welcome page
   - Vercel deploy (Pro key handles auth)
   - Netlify deploy (Pro key handles auth)
   - Cloudflare Pages deploy
5. If domain entered: generates DNS instructions (CNAME/A records) + "Send to Client" button
6. Welcome page live on all three hosts within 60 seconds
7. Builder opens — start forging

### DNS & Failover System

For custom domain projects, the builder creates a triple-redundancy setup:

**Primary:** Cloudflare Pages (fastest edge CDN)
**Backup 1:** Netlify
**Backup 2:** Vercel

Cloudflare acts as DNS middleman with health checks:
- Pings each host every 30 seconds
- If primary 5xx's or times out → auto-failover to next host (under 60 seconds)
- No manual intervention required — client never sees downtime

**DNS Handoff:** The client must add records at their registrar (GoDaddy, Namecheap, etc.). The builder generates:
- Exact CNAME/A records to copy-paste
- Step-by-step instructions with screenshots
- Optional: auto-email to client with the guide

### Post-Deploy Modules (One-Click Toggles)

These are integrated into The Foundry's builder toolbar as toggles that fire after deployment:

#### SEO Optimizer
- Auto-injects: `<title>`, `<meta description>`, `<meta keywords>`, Open Graph tags, Twitter cards
- Generates `sitemap.xml` and `robots.txt` in project root
- Adds descriptive `alt` text to all images
- Minifies HTML/CSS/JS on export
- Runs Lighthouse audit via AI — auto-fixes low scores
- **Trigger:** "Optimize for SEO?" toggle after build completes

#### Client Analytics
- Embeds Plausible.io or Umami script during build (privacy-first, no cookie banners needed)
- Generates a private dashboard URL for the client
- Client sees: page views, unique visitors, bounce rate, top pages, referrers
- No login required for client — read-only link
- **Trigger:** "Enable Analytics?" toggle during project setup

#### Accessibility Compliance (ADA/WCAG 2.1 AA)
- **This protects your client from lawsuits.** As of April 2026, ADA Title II requires WCAG 2.1 Level AA compliance. Only 3% of websites currently meet these standards — most freelancers skip this entirely, leaving their clients exposed.
- Auto-checks and fixes: proper heading hierarchy (H1→H2→H3, no skipping levels)
- Adds descriptive `alt` text to all images (coordinates with SEO toggle)
- Validates minimum 4.5:1 color contrast ratio on all text
- Ensures all elements are keyboard-navigable (Tab, Enter, Space, Arrow keys)
- Adds proper form labels and clear instructions on all inputs
- Injects skip-navigation links for screen reader users
- Validates logical heading structure and ARIA landmarks
- Checks that links are descriptive and meaningful (no "click here")
- Generates accessibility compliance report (pass/fail per WCAG criterion)
- AI-powered audit: scans generated code against WCAG 2.1 AA checklist, auto-fixes what it can, flags what needs manual review
- **Trigger:** "ADA Compliance?" toggle — runs during build AND as post-build audit
- **Client value:** "Your site is ADA-compliant" is a real selling point and legal shield

#### Privacy & Cookie Compliance (GDPR/CCPA)
- **This protects YOU from regulatory issues.** If you embed analytics or any third-party scripts, privacy disclosure is legally required.
- Auto-generates a privacy policy page tailored to the site (what data is collected, how it's used, who to contact)
- Injects cookie consent banner (customizable: colors match site theme)
- Allows users to accept/decline non-essential cookies
- Adds data collection disclosure on all contact forms ("We use your info to respond to your inquiry")
- Discloses third-party tools and tracking scripts (analytics, ReCaptcha, etc.)
- If using Plausible analytics: notes that it's cookie-free and GDPR-compliant by default (advantage)
- If using Google Analytics: full cookie consent flow required (auto-configured)
- Generates a simple Terms of Service page template
- **Trigger:** "Privacy Compliance?" toggle — auto-detects what's embedded and configures accordingly
- **Client value:** "Your site is privacy-compliant" — no demand letters, no regulatory surprises

#### Security Pack
- Adds Google ReCaptcha to all forms
- Enables spam filters on contact forms
- Injects Content Security Policy headers
- Displays "Secure Site" badge (optional)
- **Trigger:** "Security Pack?" toggle during build

#### Performance Boost
- Auto-compresses images (WebP conversion)
- Adds lazy-loading to all images below the fold
- Sets proper caching headers
- AI runs Lighthouse performance check and auto-fixes common issues
- **Trigger:** "Performance Boost?" toggle after build

#### Handover Kit
- Auto-generates a 2-minute video guide (Loom-style) or written PDF
- Google Business Profile setup instructions
- Social share buttons embedded in site
- **Trigger:** "Generate Handover Kit?" after deployment

#### Maintenance Mode
- Auto-weekly git backup (scheduled push)
- Simple update pipeline — client requests change via email, builder applies
- Uptime monitoring with alerts
- **Trigger:** Enabled per-project in the Live Sites Dashboard

#### Punch List (Client Revision Tracker)
- **This prevents scope creep and miscommunication.** Instead of back-and-forth emails, the client gets a clean form to submit exactly what they want changed.
- After site delivery, client receives a unique Punch List URL (e.g., yoursite.com/revisions or a hosted form)
- Client fills out: which page, what to change, priority (nice-to-have / important / critical), optional screenshot upload
- Each submission creates a numbered item on your Punch List dashboard inside The Foundry
- Dashboard shows: all items per project, status (new / in progress / done), revision round counter
- Revision limits enforced: contract says "3 rounds included" — the Punch List tracks which round you're on
- When all items are marked done, client gets a "Revision complete — please review" notification
- If client adds items beyond the included rounds, system shows "Additional revision — $X per round" (configurable)
- Export Punch List as PDF for records
- **Trigger:** "Enable Punch List?" toggle during client handoff — generates the unique URL

### Live Sites Dashboard

A dedicated view in The Foundry showing all deployed projects:

**Grid of Cards** — one per project:
- Project name and custom domain (if any)
- Live URLs: Vercel, Netlify, Cloudflare (clickable)
- Status: green (all hosts up), yellow (one down, failover active), red (all down)
- Last push date and commit hash
- Analytics summary: visits today, total views, bounce rate
- AI "Analyze" button: feeds traffic data + site code to multi-chat → returns actionable insights ("Bounce high on mobile — fix nav speed", "No keywords in meta — add 'local yoga studio'")

**Health Checks:**
- Pings each host every 5 minutes
- Shows response time per host
- Alerts if any host goes down

**Quick Actions per Card:**
- Open in Builder
- Push update
- View analytics
- Send to client
- Archive project

### Master Toggle Reference

All toggles are accessible from The Foundry's builder toolbar. They can be applied individually or stacked.

| # | Toggle | What It Does | Protects | Priority |
|---|--------|-------------|----------|----------|
| 1 | SEO Optimizer | Meta tags, sitemap, robots.txt, alt text, minify, Lighthouse | Client's Google ranking | HIGH |
| 2 | Accessibility (ADA/WCAG) | Heading hierarchy, contrast, keyboard nav, ARIA, screen reader, skip links | Client from ADA lawsuits | HIGH |
| 3 | Privacy/Cookie Compliance | Privacy policy page, cookie consent banner, form disclosures, GDPR/CCPA | YOU from regulatory action | HIGH |
| 4 | Client Analytics | Plausible/Umami embed, private dashboard link, no-login client access | Proves site value to client | HIGH |
| 5 | Punch List | Client-facing revision form — they submit what they want fixed, you see it in a dashboard | Scope creep, miscommunication | HIGH |
| 6 | Security Pack | ReCaptcha, spam filters, CSP headers, secure badge | Client's forms and data | MEDIUM |
| 7 | Performance Boost | Image compression, lazy-load, caching, Lighthouse auto-fix | Site speed and user experience | MEDIUM |
| 8 | Handover Kit | Client guide PDF, Google Business setup, social buttons | Client self-service | LOW |
| 9 | Maintenance Mode | Weekly backups, update pipeline, uptime monitoring | Long-term site health | LOW |

**The "Professional Package" stack:** Toggles 1-7 all on = ADA-compliant, privacy-compliant, SEO-optimized, analytics-tracked, revision-tracked, secure, fast site. That's what separates a $500 build from a $2,000 build.

### Pricing Framework (Reference)

The Foundry supports a tiered pricing model for client work:

| Tier | What's Included | Suggested Range |
|------|----------------|----------------|
| Basic | Build + deploy + temp URL | $500-800 |
| Standard | + Custom domain + SEO + Analytics | $800-1,200 |
| Professional | + ADA Compliance + Privacy Compliance + Security | $1,200-1,800 |
| Premium | + Performance + Handover Kit + everything above | $1,500-2,500 |
| Maintenance | Monthly retainer for updates + monitoring + compliance checks | $50-150/month |

Revenue compounds: 10 clients on maintenance = $500-1,500/month recurring, plus new build revenue.

**Compliance as a differentiator:** Most freelancers deliver a site and walk away. You deliver a site that's ADA-compliant, privacy-compliant, SEO-optimized, and monitored. That's not a $500 site — that's a $1,500-2,500 professional package. The compliance toggles are where the real money is because they solve problems the client doesn't even know they have yet.

---

## 13. Hardware Scaling Path

### Current: 8GB GPU

- Runs 7B-13B local models (Ollama, LM Studio)
- Cloud APIs for heavy lifting (Claude, GPT, Gemini, Grok, DeepSeek)
- Builds small-to-medium sites: 5-15 pages, 2-5 minutes per build
- Handles all current Foundry/Pit operations
- 11 applications running simultaneously

### Planned: 8GB + 48GB Dual GPU

- 48GB runs 70B models locally (DeepSeek-R1, Llama 3.3 70B) at Q6/Q8 quantization
- 20-40 tokens/second locally — approaching cloud API speed
- 8GB handles fast previews, live edits, lightweight helpers
- 48GB handles deep reasoning, complex layouts, smart code generation
- Build time drops to 30 seconds-2 minutes for medium sites
- 32K-128K token context windows — feed entire codebases at once
- Multi-modal: vision + text models for screenshot analysis, chart reading
- The Pit becomes a local AI lab: 55+ models competing, zero cloud cost
- ~90% of Claude Code's capability running entirely on local hardware

### Model Scaling: Hugging Face Integration (Planned)

- Pull 50+ models from Hugging Face hub
- Auto-detect hardware capabilities (VRAM, RAM, CPU)
- Recommend optimal models for available hardware
- One-click download and configure for Ollama/LM Studio
- The Pit tournament mode with 55 models in heats

---

## 14. Master Build List — Ordered by Priority and Effort

### How To Read This List

Every item is ranked by two factors: how much it blocks revenue or protects you legally, and how hard it is to build. Do them in order. Don't skip ahead to the fun stuff.

**Effort Key:** ⚡ = under 30 min | 🔧 = 1-2 hours | 🔨 = 2-4 hours | 🏗️ = 4-8 hours | 🏭 = multi-day

---

### PHASE 0 — Critical Safety (Do Before Anything Else)

These don't generate revenue but prevent catastrophic loss.

| # | Item | Effort | Why | How |
|---|------|--------|-----|-----|
| 0.1 | Verify .env.local is in .gitignore | ⚡ | Your API keys may be on 9 public/private remotes RIGHT NOW | `grep '.env' .gitignore` — if missing, add it and rotate ALL keys |
| 0.2 | Git tag current stable state | ⚡ | If anything breaks, you have a known-good rollback point | `git tag v1.0-stable` + push tags to all remotes |
| 0.3 | Automated daily git push | 🔧 | You got wiped once. Never again. | PM2 cron job or Windows Task Scheduler: `git push --all` to all 9 remotes nightly |
| 0.4 | Fix conversation backup 500 error | 🔧 | Losing chat history means losing build context | Audit /api/chat/backup route, likely a missing directory or broken Supabase call |
| 0.5 | Verify Docker setup is current | 🔧 | If your machine dies, Docker is your fastest recovery | Run the existing Docker setup, see if it builds. Update docker-compose.yml if stale |
| 0.6 | PM2 ecosystem config for all 11 apps | 🔧 | All apps run on boot, no console windows, no npm run dev | Update ecosystem.config.cjs with every app and port. `pm2 startup` + `pm2 save` |

---

### PHASE 1 — Revenue Blockers (Must Have Before First Client)

You cannot take money without these. Period.

| # | Item | Effort | Why | Blocks Revenue? |
|---|------|--------|-----|-----------------|
| 1.1 | Build 5 portfolio demo sites | 🏗️ | Can't sell without showing work. Build one of each: local service, portfolio, restaurant, small shop, consultant | YES — no demos = no clients |
| 1.2 | Test each demo on mobile | ⚡ per site | Pull up each site on your phone. If it looks broken, fix it before anyone sees it | YES — broken mobile = lost client |
| 1.3 | Run PageSpeed Insights on each demo | ⚡ per site | Google's free tool. If score is under 80, fix it. This is what clients google. | YES — slow site = no credibility |
| 1.4 | Simple one-page contract template | 🔧 | What you deliver, revisions included, payment terms, who owns what, what happens if client disappears | YES — no contract = working for free |
| 1.5 | Stripe payment setup | 🔧 | 50% upfront invoice before you touch anything. Non-negotiable. | YES — can't get paid |
| 1.6 | One real test delivery | 🔨 | Build a site for a friend/family/local business. Free or cheap. Full pipeline: intake → build → deploy → their domain. Proves YOUR process works with a real human. | YES — untested pipeline = broken promises |

---

### PHASE 2 — Core Client Pipeline (Build The Machine)

These turn "I can build sites" into "I have a repeatable business."

| # | Item | Effort | Why | Revenue Impact |
|---|------|--------|-----|---------------|
| 2.1 | Project Onboarding Modal | 🔨 | New project → name, domain, email, auto-push to GitHub + all 3 hosts. Welcome page live in 60 seconds. | HIGH — first impression, sets professional tone |
| 2.2 | Deploy auto-init | 🔨 | New projects auto-connect to Vercel/Netlify/Cloudflare without CLI commands. No manual `vercel link`. | HIGH — removes friction from every build |
| 2.3 | SEO Optimizer toggle | 🔨 | One toggle: auto meta tags, sitemap.xml, robots.txt, alt text, minify. Every client wants "show up on Google." | HIGH — biggest upsell, easiest to build |
| 2.4 | Accessibility Compliance toggle (ADA/WCAG) | 🔨 | Auto-check heading hierarchy, contrast, keyboard nav, ARIA labels. Protects client from lawsuits. | HIGH — legal protection = premium pricing |
| 2.5 | Privacy/Cookie Compliance toggle | 🔧 | Auto-generate privacy policy page, cookie consent banner if needed. Protects YOU from regulatory action. | HIGH — legal protection for you |
| 2.6 | Client Analytics embed toggle | 🔧 | Plausible script injection + private dashboard link. Client sees visits without logging into anything. | MEDIUM — proves value, justifies maintenance retainer |
| 2.7 | Calendly embed toggle | ⚡ | You already have Calendly. One toggle injects the booking widget. | MEDIUM — already have it, just wire it |
| 2.8 | Mailchimp embed toggle | ⚡ | You already have Mailchimp. One toggle injects the signup form. | MEDIUM — already have it, just wire it |

---

### PHASE 3 — Client Experience (Make It Professional)

These separate you from "guy who builds websites" to "professional web agency."

| # | Item | Effort | Why | Revenue Impact |
|---|------|--------|-----|---------------|
| 3.1 | Client Intake Form | 🏗️ | Standalone webpage: guided wizard, dummy-proof, client fills out what they want. No Adobe. No downloads. Just a browser link. Form data auto-generates your builder prompt. | HIGH — automates the hardest part (getting client requirements right) |
| 3.2 | Dropbox Asset Pipeline | 🔨 | Auto-create client folder via Dropbox API, send upload link, watch for files, pull into project assets. | HIGH — no more "can you email me the logo?" back-and-forth |
| 3.3 | Prompt Template Engine | 🔧 | Form JSON → builder prompt. String template with variables. Maybe 20 lines of code. "Build a 5-page dark theme site for [business] with colors [colors] and pages [pages]." | HIGH — glue between intake form and builder |
| 3.4 | Client Preview Link | 🔧 | After build, generate a clean preview URL (temp subdomain on your host). Client sees the site before final deploy. No login required. | HIGH — client approval before you're locked in |
| 3.5 | Security Pack toggle | 🔧 | ReCaptcha on forms, spam filters, CSP headers. One toggle. | MEDIUM — differentiator, trust signal |
| 3.6 | Performance Boost toggle | 🔧 | Image compression, lazy-load, caching headers. One toggle. AI runs Lighthouse, auto-fixes. | MEDIUM — faster sites = happier clients |
| 3.7 | More templates (15-20 total) | 🏗️ | More variety = more industries you can serve. Generate these in The Foundry. | MEDIUM — currently 8, need 20+ |

---

### PHASE 4 — Automation & Scale (Build Speed)

These make each site faster and cheaper to produce.

| # | Item | Effort | Why | Revenue Impact |
|---|------|--------|-----|---------------|
| 4.1 | Sequential Model Chain | 🏗️ | One "Build" button: DeepSeek skeleton → Grok detail → Gemini polish. Automated, not manual model switching. | HIGH — cuts build time, cuts cost to $0.70-1.50/site |
| 4.2 | Guardian Build Checker | 🔨 | Thread Guardian adapted to watch builds against client checklist. Wrong color? Flag it. Missing page? Flag it. Auto-reject and re-prompt. | HIGH — catches mistakes before client sees them |
| 4.3 | Email Notification System | 🔧 | Simple SMTP or SendGrid. Sends client: preview link, DNS instructions, analytics link, completion notice. | MEDIUM — professional touch |
| 4.4 | Punch List / Revision Form | 🔨 | Client-facing form: "what do you want changed?" You see it in a dashboard. Prevents scope creep and "can you also add..." phone calls. | MEDIUM — protects your time |
| 4.5 | Live Sites Dashboard | 🏗️ | Grid of all deployed projects. Health pings, analytics summary, AI analysis button. YOUR command center for managing all client sites. | MEDIUM — essential at 5+ clients |
| 4.6 | DNS Failover System | 🔨 | Cloudflare primary, Netlify backup, Vercel backup. Health checks auto-flip traffic. | LOW for now — nice differentiator, not urgent |

---

### PHASE 5 — Remaining Extractions (Finish The Modules)

These complete the S.A.R.G.E. ecosystem but don't directly generate revenue yet.

| # | Item | Effort | Why |
|---|------|--------|-----|
| 5.1 | Debate Arena standalone (port 3106) | 🔨 | All code exists. Same extraction pattern as Guardian/Jury. Patent-critical. |
| 5.2 | Forensic Logging standalone (port 3107) | 🔨 | All code exists. Same extraction pattern. Supports debugging and audit trails. |
| 5.3 | Trading App standalone (port 3108) | 🏗️ | Tavily live search + stock research. Personal tool, not client-facing. |
| 5.4 | The Pit popout window fixes | 🔧 | Positioning, state persistence, launch glitch. Fun tool, not revenue-critical. |
| 5.5 | The Foundry cosmetic pass | 🏗️ | Nav cleanup, buttons, backgrounds. Your tool, not client-facing. |

---

### PHASE 6 — Growth & Long-Term

| # | Item | Effort | Why |
|---|------|--------|-----|
| 6.1 | Contract/Invoice generator | 🔨 | Auto-populate contract from project toggles. Auto-generate invoice. |
| 6.2 | Handover Kit generator | 🔨 | Client guide PDF, Google Business setup, social buttons. Premium upsell. |
| 6.3 | Maintenance Mode | 🔨 | Weekly auto-backups, update pipeline, uptime monitoring. Recurring revenue. |
| 6.4 | 48GB GPU upgrade + config | 🏗️ | Local 70B models, near-Claude speed, zero cloud cost. |
| 6.5 | 55-model Hugging Face integration | 🏭 | Model Scout module. Requires 48GB GPU. |
| 6.6 | White-label client portal | 🏭 | Clients log in, see their site, analytics, request changes. SaaS territory. |

---

### The Critical Path To First Dollar

```
Phase 0 (today, 2-3 hours) → Phase 1 (this week, 8-10 hours) → 
TAKE YOUR FIRST CLIENT → Phase 2 (next week, while working on client 1)
```

You don't need Phase 2 to start. You need Phase 0 + Phase 1. That's it. Everything else makes you faster and more professional, but the builder works TODAY.

---

## 14.1 Capability Matrix — What You Can and Cannot Build (8GB GPU)

### What You CAN Build Right Now

| Site Type | Pages | Complexity | Example |
|-----------|-------|-----------|---------|
| Local service business | 3-8 | Simple | Plumber, electrician, landscaper, cleaner |
| Portfolio / creative | 5-10 | Medium | Photographer, artist, designer, writer |
| Restaurant / cafe | 3-6 | Simple | Menu, hours, location, social links |
| Professional / consultant | 5-8 | Medium | Bio, services, case studies, booking |
| Event / wedding | 3-5 | Simple | Details, RSVP form, gallery, directions |
| Small shop (single product) | 3-5 | Simple | Stripe buy button, testimonials, FAQ |
| Nonprofit / community | 5-8 | Medium | Mission, team, events, donate button |
| Real estate listing | 5-10 | Medium | Property gallery, details, contact agent |

**Included capabilities:** Responsive design, SEO meta tags, contact forms, Calendly booking, Mailchimp signup, Stripe payment buttons, image galleries, Google Maps embed, social media links, custom domain, triple-host deployment.

### What You CANNOT Build Right Now

| Feature | Why Not | Workaround |
|---------|---------|-----------|
| Full e-commerce (cart, inventory, shipping) | Requires backend, database, payment processing logic | Stripe buy buttons for single products work. For full stores, recommend Shopify. |
| User login / member accounts | Requires authentication backend | Not needed for 80% of small business sites |
| Client self-edit (CMS) | Sites are static HTML, no admin panel | Client requests changes → you edit → push in 2 minutes. Fast enough for small clients. |
| Blog with dynamic posts | Static sites don't have a CMS | Can build a static blog (all posts are HTML pages) or recommend WordPress for heavy bloggers |
| Real-time features (chat, notifications) | Requires WebSocket backend | Embed third-party widgets (Tidio, Crisp) if client needs live chat |
| Booking with availability | Requires database for calendar state | Calendly embed handles this perfectly — no custom build needed |
| Dynamic content (auto-updating prices, feeds) | Static sites don't fetch live data | Client sends you updates → you push. Or embed third-party widgets. |

**The honest pitch:** "I build fast, clean, professional static websites. Your site will load in under 2 seconds, work on every device, show up on Google, and be deployed across 3 hosting providers for zero downtime. For features like online stores or member portals, I'll recommend the right tool and help you integrate it."

---

## 14.2 Portfolio Test Builds — Full Pipeline Proof

### Purpose

These 5 sites are your portfolio AND your pipeline test. Each one proves a different capability. Build them in order — each one adds complexity. By site 5, you've tested every feature you'll offer clients.

These are NOT throwaway demos. Deploy them live. Put them on your portfolio page. They're your proof of work.

---

### Site 1: Mike's Plumbing — Local Service Business

**The Brief (pretend a client sent this):**
Mike runs a plumbing business in Denver. Needs a professional site that shows up on Google. Has a logo (find or generate a placeholder). Wants people to call or fill out a form. Doesn't care about fancy — just clean, trustworthy, fast.

**Pages:**
1. Home — hero with tagline ("Denver's Trusted Plumber Since 2015"), services overview, call-to-action button, trust badges
2. Services — 6 service cards (emergency, drain, water heater, remodel, inspection, commercial), each with icon and description
3. Service Areas — Google Maps embed showing Denver metro, list of neighborhoods served
4. About — owner photo (placeholder), story, years in business, licensing info
5. Contact — contact form (Formspree or Netlify Forms), phone number prominent, business hours, address

**Theme:** Light mode, blue and white, clean sans-serif fonts. Professional, not flashy.

**Features to test:**
- [ ] Contact form actually sends (submit a test, check your email)
- [ ] Google Maps embed loads and is interactive
- [ ] Phone number is clickable (tel: link) on mobile
- [ ] SEO: title tag, meta description, Open Graph tags in source
- [ ] Mobile: pull up on your phone, every page looks right
- [ ] PageSpeed: 80+ mobile, 90+ desktop
- [ ] Deploy: live on Vercel, Netlify, AND Cloudflare
- [ ] HTTPS: green padlock on all 3 hosts
- [ ] All internal links work (click every nav item, every button)
- [ ] Images load (no broken images, all under 200KB)
- [ ] Accessibility: heading hierarchy (H1 → H2 → H3), alt text on images
- [ ] Fresh eyes: show someone — "would you call this plumber?"

**What this proves:** You can build a basic local business site, deploy it, and everything works.

**Time target:** Under 30 minutes build time.

---

### Site 2: Sarah Chen Photography — Portfolio / Creative

**The Brief:**
Sarah is a wedding and portrait photographer in Austin. Wants a beautiful, image-heavy site that shows her work. Needs booking capability. Wants it to feel elegant, not corporate.

**Pages:**
1. Home — full-screen hero image, name, tagline ("Capturing your story"), scroll-down gallery preview
2. Portfolio — image gallery grid (at least 12 images), lightbox/modal on click, categories (Wedding, Portrait, Events)
3. About — large photo of Sarah (placeholder), her story, awards, approach to photography
4. Packages — 3 pricing tiers (Basic, Standard, Premium) with what's included, call-to-action on each
5. Testimonials — 4-5 client quotes with names, star ratings, photos if available
6. Contact — Calendly embed for booking, email, Instagram link, contact form as backup

**Theme:** Dark mode, black and white with gold accents. Elegant serif fonts for headings, clean sans-serif for body.

**Features to test:**
- [ ] Image gallery loads without killing page speed (lazy loading working?)
- [ ] Lightbox/modal opens on image click, closes on X or outside click
- [ ] Calendly embed loads and shows available times
- [ ] Gallery images are optimized (WebP or compressed JPEG, not raw 5MB files)
- [ ] Contact form sends
- [ ] Instagram link opens in new tab
- [ ] SEO: title, meta, Open Graph with preview image for social sharing
- [ ] Mobile: gallery stacks to single column, images are swipeable/tappable
- [ ] PageSpeed: this is the hard one — image-heavy site needs 80+ mobile
- [ ] Deploy: all 3 hosts
- [ ] HTTPS: all 3 hosts
- [ ] Fresh eyes: "would you book this photographer?"

**What this proves:** You can handle image-heavy sites, third-party embeds (Calendly), and maintain performance.

**Time target:** Under 45 minutes build time.

---

### Site 3: Bella's Kitchen — Restaurant / Food Service

**The Brief:**
Bella runs an Italian restaurant in Brooklyn. Wants a warm, inviting site. Menu is the star — needs to be easy to read. Customers need to find hours, location, and be able to call or get directions instantly.

**Pages:**
1. Home — hero image of restaurant interior or signature dish, welcome message, hours right on the front page, "View Menu" and "Get Directions" buttons
2. Menu — organized by category (Appetizers, Pasta, Entrées, Desserts, Drinks), prices aligned right, special/featured items highlighted, dietary indicators (V, GF)
3. About — the story of Bella, family history, photo of kitchen/team, "family recipes since 1982" vibe
4. Contact — address with Google Maps embed, phone (clickable), hours table, reservation note ("Call to reserve for parties of 6+")

**Theme:** Dark warm mode — deep burgundy (#4a0e0e), cream text (#f5f0e8), warm gold accents. Serif font for headings (Italian feel), readable sans-serif for menu items.

**Features to test:**
- [ ] Menu is easy to read (proper alignment, prices don't float weirdly)
- [ ] Menu categories are navigable (anchor links or tabs)
- [ ] Hours display correctly (not wrapping/breaking on mobile)
- [ ] Google Maps embed works and shows correct location
- [ ] Phone number is clickable on mobile
- [ ] "Get Directions" button opens Google Maps/Apple Maps
- [ ] Dark theme doesn't have contrast issues (text readable everywhere)
- [ ] SEO: title, meta, structured data for restaurant (schema.org if possible)
- [ ] Mobile: menu is scrollable and readable without zooming
- [ ] PageSpeed: 80+ mobile
- [ ] Deploy: all 3 hosts
- [ ] Fresh eyes: "would you eat here based on this site?"

**What this proves:** You can build themed sites with structured content (menus), warm aesthetics, and location-based features.

**Time target:** Under 30 minutes build time.

---

### Site 4: Craft & Code Workshop — Single Product / Event

**The Brief:**
You're selling a weekend coding workshop for beginners. $299 per seat. Need a landing page that convinces people to buy, takes payment, and collects emails for future workshops.

**Pages:**
1. Home/Landing — hero with workshop name, date, location, price, "Register Now" button above the fold. Below: what you'll learn (4-6 bullet points with icons), who it's for, instructor bio
2. The Workshop — detailed agenda/schedule, what's included (laptop provided? lunch?), what to bring, prerequisites (none — it's for beginners)
3. FAQ — 8-10 common questions with expandable answers (accordion style)
4. Register — Stripe payment button ($299), what happens after payment (confirmation email, calendar invite), refund policy, Mailchimp signup for "notify me about future workshops"

**Theme:** Modern, clean. White background, dark text, electric blue (#2563eb) accents for CTAs. Bold sans-serif headings.

**Features to test:**
- [ ] Stripe button loads and shows correct price ($299)
- [ ] Test payment processes in Stripe test mode (use test card 4242...)
- [ ] You see the test payment in your Stripe dashboard
- [ ] Mailchimp signup form submits and email appears in your audience
- [ ] FAQ accordion opens/closes smoothly
- [ ] "Register Now" button scrolls to or links to register page
- [ ] Urgency elements work (if you add "12 spots left" or countdown)
- [ ] SEO: title, meta, event-specific Open Graph
- [ ] Mobile: CTA button is full-width and easy to tap, FAQ is usable
- [ ] PageSpeed: 90+ (this is a simple site, should be fast)
- [ ] Deploy: all 3 hosts
- [ ] Fresh eyes: "would you pay $299 for this workshop based on this page?"

**What this proves:** You can build conversion-focused pages with payment integration and email capture.

**Time target:** Under 30 minutes build time.

---

### Site 5: Alex Rivera Consulting — Professional Services (The Full Test)

**The Brief:**
Alex is a business strategy consultant. Needs a polished, authoritative site that generates leads. Wants to showcase results (case studies), let people book discovery calls, and build an email list. This is your most complex build — it tests everything.

**Pages:**
1. Home — professional hero (headshot placeholder, tagline "Growing businesses through strategic clarity"), 3 service highlights, social proof strip (logos of companies worked with), testimonial slider, CTA to book a call
2. Services — 3-4 service offerings (Strategy Workshop, Growth Audit, Fractional CMO, Speaking), each with description, what's included, ideal client, pricing range
3. Case Studies — 2-3 case studies with structure: challenge, approach, results (with specific metrics — "Revenue increased 47% in 6 months"), client quote
4. About — professional bio, background, credentials, personal touch ("when I'm not consulting, I'm hiking with my dog")
5. Blog — 3 static blog posts (AI-generated content is fine for demo purposes), proper layout with dates, read time, categories
6. Contact — Calendly embed for "Book a Discovery Call", Mailchimp signup for newsletter, LinkedIn/Twitter links, contact form as backup

**Theme:** Professional clean. White/light grey background, dark charcoal text (#1a1a2e), navy accent (#0a1628), subtle gold for CTAs (#c8a44e). Think "McKinsey meets approachable."

**Features to test:**
- [ ] Calendly embed works (can select time for discovery call)
- [ ] Mailchimp signup works (email appears in audience)
- [ ] Contact form sends
- [ ] Case study layout is compelling (not just a wall of text)
- [ ] Blog posts have proper dates, formatting, and are readable
- [ ] Social links open in new tabs
- [ ] Testimonial slider/carousel works (if used)
- [ ] Logo strip displays correctly (placeholder logos are fine)
- [ ] SEO: title, meta, Open Graph with professional preview image
- [ ] Mobile: every page, every section looks right on phone
- [ ] PageSpeed: 80+ mobile, 90+ desktop
- [ ] Deploy: all 3 hosts
- [ ] HTTPS: all 3 hosts
- [ ] ADA basics: heading hierarchy, alt text, keyboard navigable, contrast passes
- [ ] Privacy: if analytics embed is on, privacy policy page exists
- [ ] Fresh eyes: "would you hire this consultant?"

**What this proves:** You can build a complex, multi-feature professional site with multiple third-party integrations, structured content, and conversion-focused design. This is your hardest test — if this works, you're ready.

**Time target:** Under 60 minutes build time.

---

### Portfolio Build Checklist (Master — Run For Every Site)

Print this out or keep it open. Check every box before a site goes live.

**Pre-Build:**
- [ ] Site brief written (who, what, pages, features, theme)
- [ ] Placeholder images/assets gathered (Unsplash, Pexels — free stock)
- [ ] Color palette decided (2-3 colors max)
- [ ] Font pairing decided (1 heading + 1 body font)

**Build:**
- [ ] Built in The Foundry using sequential model flow
- [ ] All pages generated and complete
- [ ] Code reviewed in Code tab (no obvious errors, no placeholder text left in)
- [ ] Preview renders correctly in builder

**Functional Testing:**
- [ ] Every internal link works (nav, buttons, CTAs)
- [ ] Every external link opens in new tab
- [ ] Contact form submits → you receive email
- [ ] Calendly embed loads (if used)
- [ ] Stripe button works in test mode (if used)
- [ ] Mailchimp signup works (if used)
- [ ] Google Maps embed loads (if used)
- [ ] Phone numbers are tel: links (clickable on mobile)
- [ ] Email addresses are mailto: links

**Mobile Testing:**
- [ ] Test on YOUR actual phone (not just Chrome DevTools)
- [ ] No horizontal scrolling on any page
- [ ] Text is readable without zooming
- [ ] Buttons are tappable (not too small, not too close together)
- [ ] Images scale properly (not overflowing or distorted)
- [ ] Nav menu works on mobile (hamburger menu? does it open/close?)
- [ ] Forms are usable on mobile (inputs aren't tiny)

**Performance:**
- [ ] Google PageSpeed Insights: 80+ mobile, 90+ desktop
- [ ] All images under 200KB (compressed/optimized)
- [ ] No render-blocking resources warning
- [ ] Total page size under 3MB

**SEO:**
- [ ] Unique title tag on every page (under 60 characters)
- [ ] Meta description on every page (under 155 characters)
- [ ] Open Graph tags (og:title, og:description, og:image)
- [ ] Heading hierarchy (one H1 per page, H2s for sections, H3s for subsections)
- [ ] Alt text on every image
- [ ] sitemap.xml in root (if SEO toggle built)
- [ ] robots.txt in root (if SEO toggle built)

**Accessibility (ADA Basics):**
- [ ] Color contrast passes (use WebAIM contrast checker — free)
- [ ] All images have alt text
- [ ] Can navigate entire site with keyboard only (Tab, Enter, Escape)
- [ ] Focus indicator visible when tabbing
- [ ] Heading hierarchy is logical (no skipping H1 to H3)
- [ ] Form inputs have labels

**Deployment:**
- [ ] Pushed to GitHub
- [ ] Live on Vercel (check URL)
- [ ] Live on Netlify (check URL)
- [ ] Live on Cloudflare Pages (check URL — if configured)
- [ ] HTTPS working (green padlock) on all hosts
- [ ] No mixed content warnings

**Final:**
- [ ] Opened on someone else's phone/computer (not just yours)
- [ ] Showed to at least one person who didn't build it
- [ ] Would YOU hire this business based on this site?
- [ ] Screenshot for your portfolio
- [ ] Note build time (how long did it actually take?)

---

### Scoring Your Demo Sites

After all 5 are built and tested, score yourself honestly:

| Site | Build Time | PageSpeed Mobile | PageSpeed Desktop | All Tests Pass? | Fresh Eyes Approved? |
|------|-----------|-----------------|-------------------|----------------|---------------------|
| 1. Mike's Plumbing | ___min | ___/100 | ___/100 | Y/N | Y/N |
| 2. Sarah Photography | ___min | ___/100 | ___/100 | Y/N | Y/N |
| 3. Bella's Kitchen | ___min | ___/100 | ___/100 | Y/N | Y/N |
| 4. Craft Workshop | ___min | ___/100 | ___/100 | Y/N | Y/N |
| 5. Alex Consulting | ___min | ___/100 | ___/100 | Y/N | Y/N |

**Ready to charge money when:** All 5 have PageSpeed 80+ mobile, all tests pass, and at least 3 out of 5 get "fresh eyes approved."

**Not ready yet if:** Any site has broken forms, broken mobile, PageSpeed under 70, or someone says "that looks amateur."

---

## 14.3 Client Delivery Pipeline — The Real Flow

### The Pipeline (Not The Pit)

The Pit is for internal R&D and model testing. Client delivery uses a sequential, controlled pipeline:

```
Client Intake Form → Assets via Dropbox → Auto-Prompt from Form → 
DeepSeek Skeleton → Grok Detail Pass → Gemini Polish → 
Guardian Checks Against Checklist → You Review → 
Client Preview Link → Revisions (max 2-3 rounds) → 
Final Deploy to Client Domain → Handover → Maintenance
```

### Step-by-Step

**1. Client Fills Intake Form**
- Client gets a clean URL (intake.yourdomain.com)
- Guided wizard: one question per screen, big buttons, no jargon
- Collects: business name, what they do, style preference (visual thumbnails), pages needed, colors, content, any special requests
- Also collects: domain (if owned), email, contact preference

**2. Client Uploads Assets**
- Auto-generated Dropbox upload link sent to client
- They drop logos, photos, any content docs
- Your system watches the folder, pulls files into project assets

**3. Prompt Template Engine**
- Form JSON → builder prompt automatically
- Example output: "Build a 5-page dark navy site for Mike's Plumbing in Denver. Pages: Home with hero image of team, Services with 6 service cards, Service Areas with map, About with owner photo, Contact with form. Use uploaded logo. Colors: navy (#1a2744) and gold (#c8a44e). Include SEO meta tags, mobile responsive."

**4. Sequential Model Build**
- DeepSeek V3.2: generates full skeleton (structure, all pages, basic styling) — $0.10-0.30
- Grok 4.1 Fast: adds detail (images from assets, forms, embeds, polish) — $0.40-0.80
- Gemini 3 Flash: final polish (responsive fixes, SEO, accessibility, performance) — $0.20-0.40
- Each model gets explicit instruction: "ONLY modify [specific area]. Do NOT rewrite existing code."

**5. Guardian Build Checker**
- Thread Guardian runs against client checklist (extracted from form)
- Checks: correct colors? All pages present? Forms working? Images loading? SEO tags present?
- If mismatch: auto-flags, you fix before client ever sees it

**6. You Review**
- Open in builder, check every page
- Mobile test on your phone
- PageSpeed check
- Fix anything that looks off
- This is YOUR quality gate — don't skip it

**7. Client Preview**
- Send client a preview link (temp URL on Vercel/Netlify)
- "Here's your site — take a look and let me know what you'd like changed"
- Revision form link included (not an open-ended email)

**8. Revisions (2-3 rounds max, per contract)**
- Client submits revision via form: specific, trackable requests
- You apply changes, push, send updated preview
- Repeat 2-3 times max (contract says this)

**9. Final Deploy**
- Push to all 3 hosts (Cloudflare/Vercel/Netlify)
- If custom domain: send DNS instructions to client
- If analytics toggle on: share private analytics link
- Collect remaining 50% payment

**10. Handover**
- Send client: live URLs, DNS confirmation, analytics link, "how to request changes" doc
- Ask for testimonial (do this immediately — they're happiest right after delivery)

**11. Maintenance (if opted in)**
- $50-150/month retainer
- Weekly backup, uptime monitoring
- Client requests changes via form → you apply within 24-48 hours
- Quarterly compliance check (ADA, privacy, SEO)

### Model Cost Per Client Site

| Model | Role | Cost |
|-------|------|------|
| DeepSeek V3.2 | Skeleton | $0.10-0.30 |
| Grok 4.1 Fast | Detail/features | $0.40-0.80 |
| Gemini 3 Flash | Polish/tweaks | $0.20-0.40 |
| Local 7B models | Guardian QA | $0.00 |
| **Total API cost** | | **$0.70-1.50** |

You charge $500-2,500. Your cost is under $2. Hosting is $40/month total for all clients (Pro plans). That's real margin.

### Timeline Per Client

| Phase | Time |
|-------|------|
| Client fills form + uploads assets | 1-3 days (depends on client speed) |
| You build + Guardian checks + review | 30-60 minutes |
| Client reviews preview | 1-3 days (depends on client speed) |
| Revisions (2-3 rounds) | 30-60 minutes total |
| Final deploy + DNS | 30 minutes |
| **Total your time** | **1.5-3 hours** |
| **Total elapsed** | **3-7 days** (mostly waiting on client) |

The bottleneck is never the build. It's always the client.

---

### Completed ✅

- [x] The Foundry builder — full pipeline (prompt → stream → write → preview → deploy)
- [x] The Pit command center — 5-monitor dashboard, model-colored cards, broadcast bar
- [x] The Pit broadcast logic — parallel model builds, streaming into cards, fork management
- [x] Forge animations — 6 custom CSS animations replacing all spinners
- [x] Version restore system — click any version, restore to disk, preview refreshes
- [x] Live code streaming — Code tab shows HTML building line-by-line during generation
- [x] Streaming safeguards — 120s timeout, error handling, force-clear on restore
- [x] The Foundry rebrand — S.A.R.G.E. Forge → The Foundry (builder-standalone only)
- [x] The Pit rebrand — Workbench → The Pit
- [x] Light/dark mode — full support across builder and Pit
- [x] Thread Guardian standalone extraction — port 3104, 4-panel dashboard
- [x] Jury Duty standalone extraction — port 3105, 4-panel dashboard
- [x] S.A.R.G.E. beast branding restored — Foundry branding reverted from beast root
- [x] Deploy to GitHub/Vercel/Netlify — working with manual setup
- [x] 27-inch monitor optimization — font sizes, button padding, panel widths
- [x] Calendly integration — available for embed
- [x] Mailchimp integration — available for embed

---

## 15. Platform Health & Protection

### Overview

S.A.R.G.E. has already survived one catastrophic wipe. This section documents everything needed to prevent data loss, protect client relationships, secure the platform, and ensure recovery from any failure.

### 15.1 Backup & Recovery

**Current State:** 9 git remotes provide code redundancy. 4 pre-wipe backup directories exist in /backups/. Docker setup exists from ~1 month ago (status unknown).

**What's Needed:**

| Item | Priority | Status | Action |
|------|----------|--------|--------|
| Automated daily git push to all 9 remotes | CRITICAL | Not automated | Create cron job or PM2 scheduled task: `git push --all` to every remote on a timer |
| Zustand store data backup | CRITICAL | Unknown | Identify where persist stores save (localStorage? files?) — back up that data |
| Conversation history backup | HIGH | Broken (500 error) | Fix /api/chat/backup route — chat history is being lost |
| Docker environment snapshot | HIGH | Exists but may be stale | Verify Docker setup, update docker-compose.yml, test full recovery |
| Project files backup | HIGH | Manual only | Script to zip all /projects/ directories nightly and push to cloud storage |
| .env.local backup | CRITICAL | Manual only | Store encrypted copy separately from git (NEVER commit to repo) |
| Database backup (if Supabase used) | MEDIUM | Unknown | Check if Supabase has scheduled backups enabled |
| PM2 process state | LOW | Auto-recovers | PM2 resurrect handles this — verify with `pm2 save` |

**Recovery Plan (If Machine Dies):**
1. New machine: install Node.js, pnpm, git, PM2, Ollama, LM Studio
2. Clone from any of 9 git remotes
3. Copy .env.local from secure backup
4. `pnpm install` in root
5. `pm2 start ecosystem.config.cjs`
6. Restore Zustand persist data from backup
7. All 11 apps should be running

**Recovery Plan (If Code Wiped Again):**
1. `git reflog` — find the commit before the wipe
2. `git reset --hard <commit>` — restore everything
3. If reflog is gone: pull from any of the other 8 remotes
4. If all remotes wiped: restore from Docker snapshot or /backups/ directory

### 15.2 Security

**API Key Protection:**

| Check | Status | Action |
|-------|--------|--------|
| .env.local in .gitignore | VERIFY NOW | If not gitignored, your keys are on 9 public/private remotes. Run: `grep '.env' .gitignore` |
| API keys never logged to console | VERIFY | Search codebase: `grep -r 'API_KEY\|api_key\|apiKey' --include='*.ts' --include='*.tsx' \| grep -i 'console\|log'` |
| Rate limiting on /api/chat | NOT IMPLEMENTED | Anyone who finds your localhost can burn through your API credits. Add rate limiting middleware. |
| Rate limiting on /api/builder/* | NOT IMPLEMENTED | Same risk — unauthorized file writes, project deletion |
| PinLock effectiveness | UNKNOWN | Is PinLock just a UI gate (bypassable) or does it protect API routes too? |
| Client project isolation | UNKNOWN | Can project A's code access project B's files via path traversal? The pathValidator.ts helps but verify. |
| CORS configuration | UNKNOWN | Are API routes accessible from any origin? |

**Recommended Security Additions:**
- API route middleware: check for a session token or API key on every /api/ request
- Rate limiter: max 60 requests/minute per route (use a simple in-memory counter)
- File path sanitization: already exists (pathValidator.ts) — verify it covers all write routes
- Environment variable audit: run quarterly, rotate any exposed keys

### 15.3 Client Protection (Legal)

Before taking the first paying client, have these ready:

**Terms of Service Template:**
- What you deliver: a static website deployed to specified hosting platforms
- What you don't: ongoing hosting (unless maintenance plan), domain registration, email setup, custom backend
- Ownership: client owns all generated HTML/CSS/JS code upon full payment
- Hosting: sites are deployed to Vercel/Netlify/Cloudflare under YOUR accounts unless client provides their own
- Liability: you are not responsible for downtime caused by hosting providers
- AI disclosure: sites are generated with AI assistance (required by some jurisdictions)

**Simple Contract Template (per project):**
- Project name and description
- Deliverables (pages, features, responsive, SEO)
- Timeline (estimated completion date)
- Revisions: X rounds of revisions included (suggest 2-3)
- Payment terms: 50% upfront, 50% on delivery (or milestone-based)
- Late payment terms
- Cancellation policy

**Client Handoff Document:**
- What's deployed and where (URLs, hosting platform)
- Domain DNS instructions (if applicable)
- Analytics dashboard link (if enabled)
- How to request changes (email/form)
- What happens if client wants to leave: full code export, domain transfer instructions
- Maintenance plan options

**Privacy Policy Template (for client sites):**
- Required if analytics are embedded (Plausible, Umami, Google Analytics)
- What data is collected (page views, no personal info for Plausible)
- Cookie policy (Plausible is cookie-free — advantage)
- Contact information for data requests

### 15.4 Monitoring & Alerting

**Current State:** PM2 runs all apps. No crash alerts. No uptime monitoring. Errors go to console only.

**What's Needed:**

| Item | Priority | Action |
|------|----------|--------|
| PM2 crash alerts | HIGH | `pm2 install pm2-slack` or custom webhook — get notified when any app crashes |
| Error logging to file | HIGH | Add Winston or Pino logger — write errors to /logs/ with timestamps, not just console |
| Disk space monitoring | MEDIUM | Alert when disk is 80% full — 11 apps + node_modules + projects + backups adds up |
| Client site uptime pings | MEDIUM | Built into Live Sites Dashboard (planned) — ping every 5 minutes |
| API credit monitoring | MEDIUM | Track spending per provider — alert when approaching billing limits |
| Memory/CPU monitoring | LOW | PM2 has `pm2 monit` built in — check periodically |

### 15.5 Version Control Discipline

**Current State:** All commits go to main branch. No tags. No changelog. No stable branch.

**Recommended Practice:**

| Practice | Why | How |
|----------|-----|-----|
| Tagged releases | Know exactly what version is deployed | `git tag v1.0-foundry-stable` after major milestones |
| Stable branch | Always have a known-working state to fall back to | `git branch stable` after each successful testing session |
| Changelog | Track what changed and when | Append to CHANGELOG.md with each commit group |
| Pre-deploy checklist | Catch issues before they're live | Preview works? Files write? Deploy succeeds? Toast shows? |

**Tagging Strategy:**
```
v1.0 — First stable Foundry + Pit
v1.1 — Thread Guardian + Jury Duty extracted
v1.2 — Debate Arena + Forensic extracted
v2.0 — Commercial pipeline (onboarding, SEO, analytics, dashboard)
```

### 15.6 Data Persistence Audit

**Where does state live?**

| Data | Storage | Backup Status |
|------|---------|--------------|
| Project source files | L:\ai_builder\projects\ | In git (9 remotes) |
| App source code | L:\ai_builder\ai_builderv2\ | In git (9 remotes) |
| Zustand persist stores | localStorage (browser) | NOT BACKED UP — lost if browser cache clears |
| Conversation history | Supabase (if connected) + local backup route (broken) | PARTIALLY BACKED UP |
| PM2 process config | ecosystem.config.cjs (in git) | Backed up |
| Environment variables | .env.local (local file) | NOT IN GIT (correct) — needs separate backup |
| Docker config | Dockerfile / docker-compose.yml | In git (verify current) |
| Client project configs | .vercel/, .netlify/ in each project | In git per project |

**Risk:** If browser localStorage is cleared, all Zustand persist data (settings, preferences, guardian configs, jury configs) is lost. Consider migrating critical persist data to file-based storage.

### 15.7 Testing (Minimal Viable)

Zero test files exist currently. Full test suites aren't needed yet, but a basic smoke test prevents regressions:

**Smoke Test Checklist (manual, run after major changes):**

Builder Pipeline:
- [ ] Select a model, type a prompt, hit Build
- [ ] Code streams in Code tab
- [ ] File card shows "Forged ⚒️"
- [ ] Preview renders correctly
- [ ] Version arrows appear, can browse versions
- [ ] Restore writes to disk, preview updates
- [ ] Push to GitHub succeeds
- [ ] Deploy to Netlify succeeds

The Pit:
- [ ] Dashboard loads with all 5 cards
- [ ] Launch All opens popout windows
- [ ] Broadcast sends prompt, cards show building status
- [ ] Recall All closes windows
- [ ] Light/dark mode toggle works

Standalone Apps:
- [ ] Guardian standalone loads on :3104
- [ ] Jury standalone loads on :3105
- [ ] Chat standalone loads on :3100

API Routes:
- [ ] /api/chat returns streaming response
- [ ] /api/builder/write-file writes successfully
- [ ] /api/builder/list-projects returns projects
- [ ] /api/deploy/github pushes to repo

---

## 16. Known Assets & Features (Easy to Forget)

This section exists because the platform grows faster than memory. Reference this when asking "do I already have that?"

### Infrastructure Already Built

| Asset | Where | Status | Notes |
|-------|-------|--------|-------|
| Docker setup | Root directory | Built ~1 month ago | Verify it's current — may need docker-compose update |
| Supabase integration | Chat standalone | Connected | "Supabase Connected" shows in chat footer |
| Tavily web search | Builder API route | Working | /api/search/tavily — live web search |
| Resume Tailor app | apps-standalone | Shell exists | Inside Apps Hub on port 3103 |
| Cloud privacy toggles | Chat sidebar | Working | "Summarize threads for cloud" + "Sanitize queries for cloud" — routes local Ollama first |
| Air-gap support | Guardian + Jury APIs | Built in | Both API routes support offline/local-only mode |
| PM2 ecosystem config | ecosystem.config.cjs | Active | Manages all app processes — `pm2 restart ecosystem.config.cjs` |
| 4 pre-wipe backups | /backups/ directory | Stale | builder-full-ui-overhaul, builder-original, chat, chat-warroom-complete |
| Image generation API | /api/image | Exists | Check which provider it uses |
| Terminal access | /api/builder/terminal | Exists | Built into builder — can run commands from UI |
| Dev status endpoint | /api/builder/dev-status | Exists | Health check for builder |
| Ollama model scanner | /api/models/scan | Working | Auto-detects locally available models |
| 9 git remotes | Global config | Active | Redundant backup across platforms |
| SargeBuild v1 templates | Prompt Gallery | Built | 8 pre-built website templates |
| Export for Client | Builder footer | Working | Clean export without builder artifacts |

### Features Built Into the Beast (Port 5000) That Standalones May Not Have

| Feature | Beast Location | Standalone Status |
|---------|--------------|-------------------|
| Dashboard overview | app/dashboard/page.tsx | Not extracted |
| Demo page | app/demo/page.tsx | Not extracted |
| Test mode sidebar | components/test/TestModeSidebar.tsx | Not extracted |
| Batch processing | Tab in beast nav bar | Not extracted |
| Journal | Tab in beast nav bar | Not extracted |
| Optimize | Tab in beast nav bar | Not extracted |
| Live view | Tab in beast nav bar | Not extracted |
| Review system | Tab in beast nav bar | Not extracted |
| Research tab | Tab in beast nav bar | Not extracted |
| Library | Tab in beast nav bar | Not extracted |
| Multi-chat mode | Chat standalone | Working |

**Note:** The beast's top nav bar shows ~20 tabs (Dashboard, Chat, Debate, Batch, Test, Journal, Optimize, Live, Real, Review, Forensic, AI, Library, Diag, Builder, Research, Apps, Demo). Many of these are functional in the beast but haven't been extracted to standalones yet. They represent future extraction candidates.

---

## 17. Configuration Reference

### Environment Variables (.env.local)

```
# AI Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AI...
XAI_API_KEY=xai-...
DEEPSEEK_API_KEY=sk-...

# Deployment
GITHUB_TOKEN=ghp_...

# Local Model Endpoints (no keys needed)
# Ollama: http://localhost:11434
# LM Studio: http://localhost:1234
```

### Project Structure (Client Sites)

```
L:\ai_builder\projects\
├── sarahv2/                    — Main project
│   ├── index.html             — Generated site
│   ├── assets/                — Images, logos
│   ├── .vercel/project.json   — Vercel config
│   ├── .netlify/state.json    — Netlify config
│   ├── netlify.toml           — Netlify build config
│   └── .git/                  — Version history
├── sarahv2-pit-mon2/          — Pit fork (Monitor 2)
├── sarahv2-pit-mon3/          — Pit fork (Monitor 3)
├── sarahv2-pit-mon5/          — Pit fork (Monitor 5)
└── sarahv2-pit-mon6/          — Pit fork (Monitor 6)
```

---

## 18. Glossary

| Term | Definition |
|------|-----------|
| **S.A.R.G.E.** | Systematic AI Response Generation Engine — the overall platform |
| **The Foundry** | The web builder application (formerly S.A.R.G.E. Forge) |
| **The Pit** | The 5-monitor command center (formerly Workbench) |
| **Anchor** | Monitor 1's build — the primary/protected version |
| **Challenger** | Monitors 2-6 — independent forks competing with the anchor |
| **Broadcast** | Sending the same prompt to all selected monitors simultaneously |
| **Promote** | Replacing the anchor with a challenger's output |
| **Fork** | A separate project directory for each challenger's build |
| **Forge/Forging** | The process of AI generating and writing code to disk |
| **Forged** | Successfully completed — file written to disk |
| **Cracked** | Failed — write or generation error |
| **Quenching** | The final step — building the preview from generated code |
| **Tribunal** | Multi-agent debate system for fact verification |
| **Jury Duty** | Multi-chat quality guardian — monitors across conversations for contradictions and drift |
| **Thread Guardian** | Single-chat security monitor — tracks facts, detects hallucinations within one conversation |
| **Poison Pill** | Deliberately false evidence injected to test hallucination detection |
| **Audit Gate** | The gatekeeper that validates evidence before it enters reasoning chains |
| **Lego Brick** | Architecture principle — every component works standalone or connected |
| **DNS Failover** | Triple-redundancy hosting: Cloudflare primary, Netlify backup, Vercel backup |
| **SEO Optimizer** | One-toggle module: auto meta tags, sitemap, robots.txt, Lighthouse audit |
| **Live Sites Dashboard** | Command center view showing all deployed projects with health checks and analytics |
| **Handover Kit** | Auto-generated client guide with video, Google Business setup, and social buttons |
| **Maintenance Mode** | Auto-weekly backups, uptime monitoring, and update pipeline for client sites |
| **Model Scout** | Planned module for hardware-aware model discovery from Hugging Face |
| **Recon** | Planned module for screen intelligence — analyzes content from premium AI services |
| **Fight Club** | Planned competitive agent match system |
| **Recipe** | A saved automation chain: build → optimize → deploy → email client |
| **Client Intake Form** | Browser-based guided wizard where clients describe what they want — no Adobe, no downloads |
| **Prompt Template Engine** | Converts intake form JSON into builder prompts automatically |
| **Sequential Model Chain** | Disciplined one-model-at-a-time pipeline: DeepSeek skeleton → Grok detail → Gemini polish |
| **Guardian Build Checker** | Thread Guardian adapted to QA client builds against their checklist instead of monitoring conversations |
| **Punch List** | Client-facing revision form — structured requests instead of open-ended emails |

---

*S.A.R.G.E. — Built from zero to production in 60 days. Wiped in 2 hours. Rebuilt in 3 days. 11 standalone apps. 90,000+ lines of code. One developer. One 8GB GPU. Testing before selling. Still forging.*
