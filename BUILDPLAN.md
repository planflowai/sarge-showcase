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

### Toggle Selector Checklist (5d4a2a4)
- [x] Combined popup in Push flow — toggles section + deploy targets section
- [x] 7 toggle checkboxes with color dots, labels, descriptions
- [x] Pre-checked from project.json defaults or DEFAULT_TOGGLES
- [x] Check all / Uncheck all toggle
- [x] Smart button label: "Run N toggles & Deploy" vs "Push to N targets"
- [x] API route accepts explicit toggles override from client
- [x] Pipeline skipped entirely when no toggles checked

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

### 1. Fix Cookie Consent on Existing Portfolio
**Status:** Not started
**What:** Run the toggle pipeline on sarah_brockman_v1-site to inject privacy/consent elements. Or create project.json with correct toggles first.
**Files to touch:** No code changes — operational task (run pipeline on project)

### 2. New Project Wizard (Full Commercial Flow)
**Status:** Not started
**UX Flow:**
1. Click New Project
2. Step 1: Project name, client email, domain (optional)
3. Step 2: Toggle selection — checkboxes for which features this client gets
4. Step 3: Confirmation — "You're creating [name] for [client] with [toggles]. Correct?"
5. Click Create → deploys hello/coming soon page to all 4 targets
6. User gets GitHub, Vercel, Netlify, Cloudflare links immediately
7. Now user builds the site in the builder
8. When done, Push → toggle checklist → deploy
**Files to touch:** TBD

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
