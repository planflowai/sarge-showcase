# S.A.R.G.E. Build Plan

Single source of truth. Every prompt must reference a step here.

---

## COMPLETED

### Toggles — Post-Build Processors
All 7 toggle APIs built and tested:
- [x] SEO Optimizer (baabb0b)
- [x] Accessibility/ADA (bbf963d)
- [x] Performance Boost (55a391d)
- [x] Security Pack (d18a635)
- [x] Privacy/Cookie Compliance (0433e78)
- [x] Client Analytics (8546fe8)
- [x] Punch List (c68e40d)

### Toggle Pipeline
- [x] Pipeline runner chains toggles in order (40d75fc)
- [x] Visual status display in Deploy panel (40d75fc)
- [x] Toggle verification cards — rich checks with human-readable labels, Foundry dark theme, export reports
- [x] Verification cards redesign — bigger fonts, expanded by default, scoreboard summary, Export All, staggered animations

### Toggle Selector Checklist (5d4a2a4)
- [x] Combined popup in Push flow — toggles section + deploy targets section
- [x] 7 toggle checkboxes with color dots, labels, descriptions
- [x] Pre-checked from project.json defaults or DEFAULT_TOGGLES
- [x] Check all / Uncheck all toggle
- [x] Smart button label: "Run N toggles & Deploy" vs "Push to N targets"
- [x] API route accepts explicit toggles override from client
- [x] Pipeline skipped entirely when no toggles checked

### New Project Wizard (Full Commercial Flow)
- [x] 4-step wizard modal: Client Info → Package & Toggles → Confirmation → Creating
- [x] 3 package presets (Starter $500, Professional $750, Premium $1,000+) with pre-configured toggles
- [x] Individual toggle fine-tuning after selecting a package
- [x] Professional coming soon page generator (gradient, animated orbs, responsive)
- [x] Streaming API: folder → hello page → project.json → hosting configs → deploy to all 4 targets
- [x] Real-time progress display with status indicators per step
- [x] Deploy URL cards with direct links on completion
- [x] "New Client Project" button in Files popover + "Open in Builder" after creation

### Infrastructure
- [x] Safety system — CHANGELOG, backups, tags, rules (b0eefaa)
- [x] PM2 boot flood fixed (b67d518)
- [x] Deploy panel fixed — reads from store (620c39c)
- [x] Netlify + Cloudflare deploy fixed (c348ce5)
- [x] Full system audit + STATUS.md (f04ce40)
- [x] Launch Pad standalone verified (port 3109)
- [x] ENV Manager standalone verified (port 3110)

### Investigation: Missing Cookie Consent Banner
- [x] Portfolio site (sarah_brockman_v1-site) investigated
- [x] Root cause: No project.json exists — pipeline was never triggered
- [x] HTML is complete (768 lines, not truncated) but has zero privacy elements
- [x] Fix: Run toggle pipeline on the project, or create project.json first

---

## TODO (In Order)

### ~~1. Fix Cookie Consent on Existing Portfolio~~ DONE
**Status:** Complete
**Root cause:** No project.json existed — pipeline was never triggered
**Fix:** Created project.json with privacy toggle enabled, ran pipeline via API, verified 30 privacy strings injected (consent banner, privacy policy, form disclosure, manage cookies link). Pushed to GitHub (d122796).

### ~~2. New Project Wizard (Full Commercial Flow)~~ DONE
**Status:** Complete
**Files:**
- `components/project/NewProjectWizard.tsx` — 4-step wizard modal (Client Info → Package & Toggles → Confirm → Creating)
- `lib/templates/helloPage.ts` — Professional coming soon page generator
- `app/api/project/create-wizard/route.ts` — Streaming API (folder → hello page → project.json → hosting configs → git → GitHub → Vercel → Netlify → Cloudflare)
- `packages/builder/src/components/BuilderSidebar.tsx` — "New Client Project" button in Files popover
- `app/page.tsx` — Wizard wired via `project:new-wizard` custom event
**Features:** 3 package presets ($500/$750/$1000+), individual toggle fine-tuning, streaming deploy progress, deploy URL cards, auto-open in builder

### 3. Live Projects Dashboard
**Status:** Not started
**What:** View ALL deployed client sites with status, links, analytics, toggle status. Business command center.
**UX Flow:**
1. Accessible from header nav or Project button
2. Shows grid/list of all projects with: name, client, domain, deploy status (4 targets), toggle status (7 toggles), last push date, analytics summary
3. Click a project → opens it in the builder with all context loaded
4. Quick actions per project: Push, View Live, Analytics, Punch List
**Files to touch:** TBD

### 4. Client Brief Builder (Checklist → Prompt)
**Status:** Not started
**What:** Pre-build checklist that generates the AI prompt. Click checkboxes for pages, colors, content blocks, style — generates a structured prompt automatically.
**UX Flow:**
1. After creating project (or on existing project), click "Build Brief"
2. Checklist form:
   - Site type: Landing, Multi-page, Portfolio, E-commerce
   - Pages: Home, About, Services, Contact, Pricing, Blog, FAQ, Testimonials
   - Color scheme: Pick or preset
   - Content blocks per page: Hero, Feature grid, CTA, Gallery, Team, Pricing table, Contact form, Newsletter
   - Style: Modern minimal, Corporate, Creative, Medical, Restaurant
3. Click "Generate Prompt"
4. Structured prompt auto-fills the chat input
5. User reviews, edits if needed, clicks Build
**Files to touch:** TBD

### 5. Client Notifications (Email)
**Status:** Not started
**What:** After deploy, client gets email with live link. After upgrade, client gets notification.
**Files to touch:** TBD

### 6. Client Analytics Page
**Status:** Not started
**What:** Standalone page per client showing their site stats. Hosted or linked.
**Files to touch:** TBD

### 7. PM2 Replacement (Launch Pad with child_process.spawn)
**Status:** Not started
**What:** Replace PM2 calls in Launch Pad with child_process.spawn + windowsHide: true
**Files to touch:** apps/launchpad-standalone/ ONLY
