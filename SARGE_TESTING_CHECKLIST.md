# S.A.R.G.E. — Testing Checklist
> Everything we built/fixed in this session. Test each item, mark ✅ or ❌.

---

## Phase 3 — AI File Operations
- [ ] Open a project in Builder (click Open Project in sidebar)
- [ ] Ask AI to modify a file → FileActionCard appears (not artifact card)
- [ ] Click **View Diff** → Monaco shows before/after side by side
- [ ] Click **Apply** → File writes to disk (check the actual file)
- [ ] Click **Reject** → Card dismisses, file unchanged
- [ ] Verify path security: AI cannot write outside project folder

## Phase 4 — Auto-Changelog
- [ ] Open project, apply a file change → check project root for `BUILDER_LOG.md`
- [ ] Verify log entry has: timestamp, file path, summary, model used
- [ ] Click **Save Progress** in sidebar → session summary appended to log
- [ ] Close and reopen project → AI knows project history (mentions past changes)

## Phase 5 — Prompts & Templates
- [ ] Builder sidebar shows **Prompts** section with categories
- [ ] Click a prompt → populates chat input
- [ ] Save a custom prompt → appears in "My Prompts"
- [ ] Click **New Project** → template dropdown appears
- [ ] Select a template → files generated in chosen folder

## Builder Core (Phase 2 verified)
- [ ] Generate code → live preview renders in real-time (no white flash)
- [ ] Ask to modify existing code → changes in place (brand names preserved)
- [ ] Artifact cards show: title, language badge, Open Code/Preview buttons (no code visible)
- [ ] Preview iframe: clicking links does NOT navigate (no nested app)
- [ ] Progress cards show step-by-step while AI generates

---

## Bug Fixes

### Fix 1 — Dashboard Overlay Navigation
- [ ] Dashboard → click Debate Arena card → debate overlay opens
- [ ] Dashboard → click Batch Processing card → batch overlay opens
- [ ] Dashboard → click Test Mode card → test overlay opens
- [ ] Dashboard → click Forensic Log card → forensic overlay opens

### Fix 2 — Chat Scrolling
- [ ] Main Chat: send 10+ messages → can scroll full history
- [ ] Builder Chat: generate long response → auto-scrolls to bottom
- [ ] Can scroll back up to see earlier messages

### Fix 3 — API Key Handling
- [ ] Remove an API key from .env → send message with that provider
- [ ] Should see styled error card: "No API key configured for [provider]"
- [ ] Error card has "Open Settings" button → navigates to settings
- [ ] No "undefined" or blank messages anywhere

### Fix 5 — Diagnostics Self-Repair
- [ ] Open Diagnostics → click Scan Now (Quick)
- [ ] Findings appear grouped by type (errors, warnings, enhancements)
- [ ] Select a model from sidebar dropdown (not undefined)
- [ ] Click Analyze with AI → explanation + fix proposal appears
- [ ] Click Apply → snapshot created FIRST, then file modified
- [ ] Click Rollback → file reverted to snapshot
- [ ] Custom Request → describe issue → AI proposes fix

### Fix 6 — Vault Context Injection
- [ ] Upload a document to Vault
- [ ] In Chat, click paperclip/attach icon
- [ ] Modal shows vault files with checkboxes
- [ ] Select file → pill appears above input
- [ ] Send message → AI references the attached document content
- [ ] Message shows file attachment indicator

### Fix 7 — AI Analysis Tab
- [ ] AI Analysis tab visible in header nav
- [ ] Click it → tabbed interface with 6 sub-tabs
- [ ] Dashboard shows AI Analysis card → clicking navigates correctly

---

## Cross-Module Pipelines (Tier 3)

### Fix 9 — Debate → Builder
- [ ] Run a debate → wait for executive summary
- [ ] Click "Implement in Builder" → opens Builder with recommendation pre-filled
- [ ] Individual debate responses have "Send to Builder" button

### Fix 10 — Forensic → Diagnostics
- [ ] Open Forensic Log → find an error/warning entry
- [ ] Expand it → click "Diagnose this issue"
- [ ] Navigates to Diagnostics → Custom Request auto-opens with context

### Fix 11 — Test → Review
- [ ] Run a batch test → wait for completion
- [ ] Toast notification appears: "Test complete — View Results"
- [ ] Click toast or "View in Review" button → Review page opens
- [ ] Most recent batch auto-selected

---

## Polish (Tier 4)

### Fix 12 — Error Boundaries
- [ ] If a component crashes → friendly error card (not white screen)
- [ ] Error card has "Retry" button

### Fix 13 — Loading States
- [ ] Dashboard shows skeleton while model counts load
- [ ] Builder file tree shows skeleton while loading
- [ ] Review shows loading spinner while hydrating

### Fix 14 — Confirm Dialogs
- [ ] Clear chat → confirmation dialog appears
- [ ] Delete vault file → confirmation dialog
- [ ] Apply diagnostics fix → confirmation dialog
- [ ] Clear forensic logs → confirmation dialog

### Fix 15 — Export Consistency
- [ ] Chat → export as markdown/PDF → toast "Exported successfully"
- [ ] Debate → export transcript → toast
- [ ] Forensic → export JSON → toast
- [ ] Journal → export markdown → toast

---

## New Features

### Architect Mode
- [ ] Chat tab → toggle to "Architect" mode
- [ ] Indigo border appears, placeholder changes
- [ ] Ask: "I want to build a customer feedback dashboard"
- [ ] AI responds with plan + `BUILDER_PROMPT` block
- [ ] Click "Send to Builder" → Builder opens with prompt pre-filled
- [ ] Switch back to Chat mode → separate conversation history

### Security Hardening
- [ ] Builder write-file rejects paths outside project (try ../ path)
- [ ] Builder terminal blocks dangerous commands (rm -rf, format, etc.)
- [ ] All file operations logged to forensic log

### DeepSeek Integration
- [ ] Chat sidebar shows DeepSeek as provider option
- [ ] Select DeepSeek → send message → response streams
- [ ] Debate Arena → can select DeepSeek models for debaters
- [ ] Builder → DeepSeek models available

### Global Toast System
- [ ] Toasts appear top-right on relevant actions
- [ ] Auto-dismiss after a few seconds
- [ ] Action buttons on toasts work (e.g., "View in Review")

---

## Dashboard
- [ ] Dark theme always (even in light mode)
- [ ] S.A.R.G.E. title correct: "Synthetic Adversarial Reasoning & Guarding Engine"
- [ ] All 14 feature cards visible and clickable
- [ ] Quick actions (New Chat, Start Debate, Run Scan) work
- [ ] Model roster shows ALL cloud models (no truncation)
- [ ] Model roster shows ALL local Ollama models
- [ ] Provider status dots (green/red) accurate
- [ ] Stat counters show correct numbers
- [ ] Status bar shows all provider connections

---

## Quick Smoke Test (5 minutes)
If you only have 5 minutes, test this flow:

1. **Dashboard** → verify it loads, click "AI Builder" card
2. **Builder** → type "build a landing page with blue navbar" → watch live preview
3. **Builder** → type "change navbar to red" → verify in-place update, no rename
4. **Chat** → toggle to Architect → ask "plan a todo app with AI features"
5. **Chat** → click "Send to Builder" on the response
6. **Builder** → verify prompt pre-filled, send it, watch it build
7. **Debate Arena** → start a debate with 2 models → verify responses stream
8. **Diagnostics** → run quick scan → verify findings appear
9. **Dashboard** → verify model counts, all cards clickable

---

*Generated: February 16, 2026*
*Session: Phase 2-6 builds + 15 bug fixes + Architect Mode*
