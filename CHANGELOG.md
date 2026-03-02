# S.A.R.G.E. Changelog

Every commit gets an entry. No exceptions.

---

## How to Use This File

- Every commit by Claude Code MUST add an entry BEFORE pushing
- Entries are newest-first
- 'Working State' is the most important field — it tells you if the app was verified
- 'Revert To' gives you the exact command to undo this change
- Tags marked with ★ are verified working states — safe to revert to

---

## Tags (Safe Revert Points)

| Tag | Date | Description |
|-----|------|-------------|
| working-2026-03-02-deploy-fix | 2026-03-02 | DeployPanel reads from store, all routes 200, full audit complete |
| working-2026-03-02-post-hydration-fix | 2026-03-02 | Builder loads, all routes 200, hydration fixed, MetaMask identified |

---

## Entries

### [2026-03-02 — Toggle pipeline with visual status in Deploy panel]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/lib/toggles/pipeline.ts (new), apps/builder-standalone/app/api/toggles/run/route.ts (new), apps/builder-standalone/components/deploy/DeployPanel.tsx (modified), CHANGELOG.md
**What changed:** Toggle pipeline runner chains all 7 toggles in order (Accessibility → Privacy → Security → SEO → Performance → Analytics → Punch List) when user clicks Push. Each step only runs if enabled in project.json. HTML output chains between steps. Accessibility and SEO are special-cased (operate on disk). New API endpoint POST /api/toggles/run reads project.json and runs pipeline. DeployPanel modified: when Push is confirmed, toggles run first with real-time visual feedback (green check = success, gray dash = skipped, red X = failed, with detail text and ms timing), then deploy proceeds. Toggle results clear on project switch. Pipeline gracefully degrades — if it fails, deploy still proceeds.
**What was tested:** Full TypeScript compilation passes (0 errors). Pipeline function signatures verified against all 7 toggle processors. SEO special-case handling confirmed (reads/writes disk, needs ProjectMeta). DeployPanel correctly sequences toggle run → deploy.
**Working state:** Yes
**Revert to:** `git reset --hard c68e40d`

### [2026-03-02 — Punch List toggle (client revision tracker)]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/lib/punchlist/injector.ts (new), apps/builder-standalone/app/api/punchlist/inject/route.ts (new), apps/builder-standalone/app/api/punchlist/submit/route.ts (new), apps/builder-standalone/components/punchlist/PunchListPanel.tsx (new), CHANGELOG.md
**What changed:** Punch List toggle — two-part system: (1) Client-facing floating "Request Changes" button + revision form injected into delivered HTML. Form collects page (auto-populated from nav links + section IDs), description, priority (low/medium/high), optional screenshot (base64). Submits to configurable endpoint with mailto fallback. Self-contained inline CSS+JS, revision round tracking via cookie. (2) Foundry-side PunchListPanel component — reads punchlist.json, displays items with priority badges, status dropdowns (open/in-progress/done), screenshot thumbnails, round tracking ("Round 2 of 3"), final-round fee warning, filters by status/priority/round, export button. Three API endpoints: POST inject (runs injector), POST/GET/PATCH submit (create/read/update items in punchlist.json).
**What was tested:** Injector tested with sample HTML containing nav links, section IDs, form, and footer. All 15 checks passed: floating button, form panel, page dropdown with 4 detected pages, description textarea, priority radios, screenshot upload, submit button, round display, endpoint configured, mailto fallback, widget script. Idempotency verified: second run adds nothing.
**Working state:** Yes
**Revert to:** `git reset --hard 8546fe8`

### [2026-03-02 — Client Analytics toggle]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/lib/analytics/injector.ts (new), apps/builder-standalone/app/api/analytics/inject/route.ts (new), CHANGELOG.md
**What changed:** Lightweight self-contained analytics tracker injector. Tracks page views (URL, timestamp, referrer, screen size), time on page, click events (links/buttons with element tag, text, href), scroll depth (25/50/75/100%). Sends via navigator.sendBeacon with fetch fallback, buffers to localStorage if endpoint unreachable. Configurable endpoint (default: `/api/analytics/collect`). Respects privacy consent cookie — only activates if `cc_consent` cookie has `analytics: true`. Tagged `data-cookie-category="analytics"` + `type="text/plain"` so the Privacy toggle blocks it until consent. Adds "Analytics" dashboard link in footer. Snippet is 1920 chars (under 3KB). Two modes: raw HTML or project path.
**What was tested:** API tested with sample HTML — snippet injected, cookie-category tagged, consent check present, sendBeacon/fetch/scroll/click tracking verified, dashboard link in footer. Custom endpoint override verified. Idempotency verified: second run returns "already injected" with zero changes.
**Working state:** Yes
**Revert to:** `git reset --hard 0433e78`

### [2026-03-02 — Privacy/Cookie Compliance toggle (GDPR/CCPA)]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/lib/privacy/compliance.ts (new), apps/builder-standalone/app/api/privacy/apply/route.ts (new), CHANGELOG.md
**What changed:** Privacy/cookie compliance post-processor — injects GDPR/CCPA cookie consent banner (dark overlay bar with Accept All, Reject Non-Essential, Customize buttons), auto-generates Privacy Policy section (data collected, cookie categories, third-party services, GDPR/CCPA rights, contact placeholder), tags analytics/marketing scripts with `data-cookie-category` and blocks them (`type=text/plain`) until consent given, adds form disclosure text ("By submitting this form, you agree to our Privacy Policy"), adds "Manage Cookies" link in footer. Consent stored via cookie (works across subdomains). Banner self-contained (inline CSS + JS, no external deps). Two modes: raw HTML string or project path.
**What was tested:** API tested with sample HTML containing 3 scripts (2 analytics, 1 marketing), 2 forms, and a footer. All 5 features verified: consent banner added, privacy policy added, 3 scripts tagged/blocked, 2 form disclosures, manage cookies link. Idempotency verified: second run returns "already compliant" with zero changes.
**Working state:** Yes
**Revert to:** `git reset --hard 8cafaea`

### [2026-03-02 — Fix Cloudflare deploys going to Preview instead of Production]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/app/api/deploy/route.ts, CHANGELOG.md
**What changed:** All Cloudflare Pages deploys were going to the "Preview" environment instead of "Production" because wrangler infers the branch from git (which is `master`), but the CF project was created with `--production-branch main`. Added `--branch=main` flag to both init and push wrangler deploy commands so CF treats them as Production deployments. Portfolio site manually redeployed with fix.
**What was tested:** `wrangler pages deployment list --project-name=portfolio` confirms latest deploy is "Production" with `branch: main`. Site returns 200 at `portfolio-b15.pages.dev`.
**Working state:** Yes
**Revert to:** `git reset --hard f540144`

### [2026-03-02 — Fix deploy URL detection (Vercel + Cloudflare)]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/app/api/deploy/route.ts, CHANGELOG.md
**What changed:** Five bugs fixed in deploy route: (1) Vercel detect now queries `vercel project ls` for production alias instead of reading stale per-deploy URL from url.txt — self-heals url.txt on each detect. (2) Cloudflare detect queries `wrangler pages project list` for actual domain (e.g. `portfolio-b15.pages.dev` instead of guessing `portfolio.pages.dev`). (3) All CLI output parsing now merges stdout+stderr — Vercel CLI sends table to stderr via PowerShell NativeCommandError, was causing empty stdout. (4) Exact name matching for project lookups — prevents `deploy-test` prefix-matching `deploy-test-project3`. Uses `name + " "` boundary check for Vercel, `│` column parsing for wrangler tables. (5) Fixed 6 instances of `runCommand(cmd, cwd, timeout, undefined, extraEnv)` where `undefined` was filling the `extraEnv` slot and the actual env dict was silently dropped as a 5th arg.
**What was tested:** detect endpoint returns correct production alias for deploy_test (Vercel: `deploytest-vert-delta.vercel.app`, CF: exact `deploy-test-project.pages.dev`). url.txt self-healed from per-deploy URL to production alias.
**Working state:** Yes
**Revert to:** `git reset --hard d18a635`

### [2026-03-02 — Security Pack toggle]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/lib/security/hardener.ts (new), apps/builder-standalone/app/api/security/harden/route.ts (new), CHANGELOG.md
**What changed:** Security post-processor — injects CSP meta tag (restrictive, allows Google Fonts + data URIs), adds X-Content-Type-Options nosniff, adds Referrer-Policy strict-origin-when-cross-origin, adds rel="noopener noreferrer" to all target="_blank" links, injects honeypot hidden input in all forms, adds input sanitization script (escapes HTML entities on submit, silently blocks honeypot-filled submissions), strips HTML comments. Two modes: raw HTML string or project path.
**What was tested:** API tested with sample HTML — all 7 hardenings verified (CSP added, nosniff added, referrer policy added, 2 links hardened, 2 honeypot forms, sanitizer injected, 2 comments stripped). Existing rel attributes preserved when adding noopener.
**Working state:** Yes
**Revert to:** `git reset --hard 55a391d`

### [2026-03-02 — Performance Boost toggle]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/lib/performance/optimizer.ts (new), apps/builder-standalone/app/api/performance/optimize/route.ts (new), CHANGELOG.md
**What changed:** Performance post-processor — minifies inline CSS/JS, adds loading="lazy" + decoding="async" to images, injects preconnect hints for external domains (Google Fonts, CDNs), adds viewport meta if missing, converts render-blocking stylesheets to async CSS loading. Two modes: raw HTML string or project path (reads/writes index.html). Follows same pattern as SEO optimizer.
**What was tested:** API tested with sample HTML — all 7 optimizations verified (CSS minified, JS minified, 2 lazy images, 2 async decoding, 2 preconnects, viewport added, 2 async CSS). Also tested on portfolio project (already optimized, no changes needed).
**Working state:** Yes
**Revert to:** `git reset --hard c348ce5`

### [2026-03-02 — DeployPanel re-link button + stub exports + portfolio fix]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/components/deploy/DeployPanel.tsx, apps/builder-standalone/lib/stubs/empty.ts, CHANGELOG.md
**What changed:** (1) Added "Link missing services" button to Deploy panel — shows when any of Vercel/Netlify/Cloudflare is not connected, re-runs init to link them. (2) Fixed webpack stub empty.ts — added all missing named exports (useForensicLogStore, useDebateStore, useDebateHistoryStore, useTruthAnchorStore, useSyncStatusStore, shouldSync, useJournalStore) to silence import error flood on startup. (3) Manually linked portfolio project to Netlify (sarge-portfolio) and Cloudflare Pages (portfolio).
**What was tested:** Builder starts clean (zero import errors), detect returns all 4 URLs for portfolio, re-link button visible when services missing
**Working state:** Yes
**Revert to:** `git reset --hard 5910d7e`

### [2026-03-02 — Fix Netlify non-interactive + Cloudflare wrangler.toml]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/app/api/deploy/route.ts, CHANGELOG.md
**What changed:** (1) Netlify CLI monorepo crash fixed — replaced `npx --yes netlify` with direct `netlify` CLI calls to avoid monorepo workspace picker. Added `NETLIFY_SITE_ID` env var injection via `netlifyEnv()` helper. Added `runCommand` `extraEnv` parameter. Manually write `.netlify/state.json` after site creation as safety net. (2) Cloudflare `wrangler.toml` now created BEFORE deploy (was only created after successful deploy, meaning failures left no toml).
**What was tested:** Full E2E — created test project, init with GitHub+Vercel+Netlify+Cloudflare all returned success. Push with all 4 targets returned success. Verified `.netlify/state.json`, `wrangler.toml`, `.vercel/url.txt` all created.
**Working state:** Yes — all 4 deploy targets working
**Revert to:** `git reset --hard f04ce40`

### [2026-03-02 — Full System Audit]
**Commit:** (this commit)
**Tag:** working-2026-03-02-deploy-fix ★
**Files touched:** STATUS.md (new), CLAUDE.md (Rule 9 added), CHANGELOG.md
**What changed:** Comprehensive audit of all UI features, API endpoints, stores, and architecture. Created STATUS.md documenting ~80 features, 30 API endpoints, 6 known issues, 11 standalone apps, architecture metrics, and safe revert points. Added Rule 9 (Check STATUS.md Before Changes) to CLAUDE.md.
**What was tested:** All 3 page routes return 200, all 30 API endpoints tested via curl, all UI components audited by source inspection
**Working state:** Yes — builder-standalone verified working at localhost:3101
**Revert to:** `git reset --hard 620c39c`

### [2026-03-02 — Fix DeployPanel projectPath]
**Commit:** (this commit)
**Files touched:** apps/builder-standalone/components/deploy/DeployPanel.tsx, CHANGELOG.md
**What changed:** DeployPanel now reads projectPath/projectName from useBuilderStore as fallback when props are not passed (broken by Suspense wrapper swallowing cloneElement props). Props still accepted for forward-compat.
**What was tested:** All 3 routes return 200, build compiles clean
**Working state:** Yes
**Revert to:** `git reset --hard b67d518`

### [2026-03-02 — Fix PM2 Boot Flood]
**Commit:** (this commit)
**Files touched:** start-foundry.bat (new), start-app.bat (new), CHANGELOG.md
**What changed:** Removed PM2 from Windows startup (deleted start-sarge.vbs from shell:startup), cleared PM2 dump files from both C:\ProgramData\pm2\home\ and ~/.pm2/, ran pm2 delete all + pm2 save --force, created manual start scripts (start-foundry.bat, start-app.bat) in monorepo root
**What was tested:** Verified start-sarge.vbs removed, dump files deleted, PM2 daemon killed with empty process list, start scripts created
**Working state:** Yes — no app code was modified
**Revert to:** `git reset --hard b0eefaa` (Note: must manually re-add start-sarge.vbs to Startup folder to restore PM2 auto-start)

### [2026-03-02 — Safety System]
**Commit:** (this commit)
**Tag:** working-2026-03-02-post-hydration-fix ★
**Files touched:** CHANGELOG.md, CLAUDE.md (rules section), scripts/backup.bat, scripts/backup-exclude.txt
**What changed:** Added safety system — changelog, backup scripts, git tags, development rules
**What was tested:** N/A — documentation only
**Working state:** Yes — builder-standalone loads and responds at localhost:3101
**Revert to:** `git reset --hard working-2026-03-02-post-hydration-fix`

### [2026-03-02 — Hydration Fix Round 2]
**Commit:** 4ef3a4d
**Files touched:** 7 files in packages/builder, packages/chat, packages/core, apps/builder-standalone
**What changed:** Eliminated 6 unused stores via webpack stubs, lazy-loaded 13 components, removed redundant messageStore persist, SSR guards on all stores
**What was tested:** All 3 routes return 200, page loads without freezing, Task Manager shows 39% RAM
**Working state:** Yes
**Revert to:** `git reset --hard 4ef3a4d`

### [2026-03-02 — Hydration Fix Round 1]
**Commit:** 38d9d89
**Files touched:** 7 files — forensicLogStore, ArtifactPanel, conversationStore, debouncedStorage, roleStore, BuilderSidebar, page.tsx
**What changed:** Capped forensic entries at 500, lazy Monaco editor, SSR guards, conversation store scan fix
**What was tested:** Build passes, routes return 200
**Working state:** Partial — page still froze due to remaining store bloat
**Revert to:** `git reset --hard 38d9d89`
