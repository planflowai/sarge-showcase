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
