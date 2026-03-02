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
| working-2026-03-02-post-hydration-fix | 2026-03-02 | Builder loads, all routes 200, hydration fixed, MetaMask identified |

---

## Entries

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
