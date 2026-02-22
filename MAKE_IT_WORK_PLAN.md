# Make Builder Actually Work — Action Plan
**Goal**: Full end-to-end workflow: Plan → Build → Edit → Audit
**Timeline**: Systematic verification + fixes
**Status**: Ready for implementation

---

## CURRENT STATE (What Works ✅)

### Infrastructure Present
- ✅ All APIs exist: write-file, read-file, update-log, create-project, check-folder, dev-status, terminal, files, list-directory, preview
- ✅ FileActionCard component with Apply/Reject buttons
- ✅ handleApplyFile function wired (line 166 of BuilderChat.tsx)
- ✅ API calls are correct (line 177: `/api/builder/write-file`)
- ✅ BUILDER_LOG tracking (line 205: `/api/builder/update-log`)
- ✅ File proposals parsing (parseFileEditProposals)
- ✅ Stream rendering (StreamingMessageRenderer)
- ✅ Artifact panel with live preview
- ✅ Chat storage + persistence

### Unclear/Needs Verification
- 🟡 Does AI actually generate file edit proposals? (depends on system prompt triggering)
- 🟡 Does dev server auto-reload when files change?
- 🟡 Does dark mode toggle work across all pages?
- 🟡 Can user switch from chat to build and keep context?
- 🟡 Are all 11 builder APIs fully implemented?

---

## WHAT NEEDS TO BE BUILT/FIXED

### TIER 1: Critical Path (Make Core Workflow Work)

#### 1A. Verify File Operation APIs Are Fully Implemented
**Files to check**:
- `/api/builder/write-file` — Does it actually write to disk? Validate path security?
- `/api/builder/read-file` — Does it read correctly with proper path handling?
- `/api/builder/update-log` — Does it append entries to BUILDER_LOG.md?
- `/api/builder/create-project` — Can user create new project from Builder UI?
- `/api/builder/check-folder` — Validates project folder exists and is accessible?

**Action**: Read all 5 API route files, verify they:
- Validate inputs (path sanitization)
- Use proper file system operations
- Return correct status codes
- Log errors clearly

**Time**: 30-45 min

---

#### 1B. Wire Project Creation in Builder UI
**Current State**: NewProjectModal.tsx exists
**Need**: NewProjectModal → calls createProject API → opens project in sidebar

**Action**:
- Verify NewProjectModal calls `/api/builder/create-project`
- Verify project appears in sidebar FileTree after creation
- Test flow: click "New Project" → choose template → set path → project opens

**Files to check**:
- BuilderSidebar.tsx (where "New Project" button is)
- NewProjectModal.tsx (modal implementation)

**Time**: 15-30 min

---

#### 1C. Ensure AI System Prompt Triggers File Edit Proposals
**Current State**: builderChatStore has BUILDER_SYSTEM_PROMPT
**Problem**: System prompt doesn't explicitly tell AI to use FILE: format for edits

**Action**:
- Update BUILDER_SYSTEM_PROMPT to include:
  ```
  "When editing files in a project, use this format:
  FILE: src/components/Header.tsx
  ```html
  <complete file content>
  ```"
  ```
- Test: Ask AI to "edit src/App.tsx to add dark mode toggle"
- Verify: FileActionCard appears with Apply/Reject buttons

**Files to modify**:
- builderChatStore.ts (line 11-32, BUILDER_SYSTEM_PROMPT)

**Time**: 10-20 min (if API works, just need prompt adjustment)

---

#### 1D. Test Full Apply/Reject Flow End-to-End
**Test Scenario**:
1. Create test project (blank HTML + CSS)
2. Ask AI "Change the button color to blue"
3. AI should respond with FILE: proposal
4. Click [Apply]
5. File should update on disk
6. Preview should show blue button
7. BUILDER_LOG.md should log the change

**Action**: Manual testing in browser with dev server running

**Time**: 20-30 min (will expose any missing pieces)

---

### TIER 2: Developer Experience (Make Workflow Smooth)

#### 2A. Auto-Reload Preview When Files Change
**Current State**: Preview uses srcdoc (file content injected into iframe)
**Problem**: If file is updated via API, preview doesn't know about it

**Action**:
- When API writes file (write-file endpoint), emit event or set flag
- ArtifactPanel should re-fetch file content and update preview
- Alternative: Point preview iframe to dev server (localhost:3000) if available

**Files to modify**:
- ArtifactPanel.tsx (add file change listener)
- Or: Switch preview to dev server when available (already partially done, line 81-95)

**Time**: 30-45 min

---

#### 2B. Add "Dark Mode Toggle" Feature
**Current State**: No dark mode toggle in Builder UI
**Action**:
- Add toggle button in BuilderPage top bar (next to Thread Guardian)
- Toggle: `document.documentElement.classList.toggle('dark')`
- Save to localStorage
- Apply on page load
- Test that artifact preview respects dark mode

**Files to create**:
- None (add to BuilderPage.tsx)

**Time**: 10-15 min

---

#### 2C. Context Persistence: Chat → Build Transition
**Current State**: BuilderChat is isolated with BUILDER_CONVERSATION_ID
**Problem**: User might want to discuss design in main Chat, then switch to Builder
**Action**:
- Allow copying conversation context to Builder chat
- Or: Have Builder chat reference previous conversation
- Or: Simple approach — let user copy/paste planning notes as prompt

**Time**: 20-30 min (low priority, can defer)

---

#### 2D. Surgical Edit Blocks (Fast Edits)
**Current State**: Edit mode system exists in builderModeStore.ts
**Problem**: Not clear if AI uses it or if UI surfaces it

**Action**:
- Verify `getEditModeSystemPrompt()` is used
- Test: Ask AI "just change line 5 from 'foo' to 'bar'"
- Verify: [[start_edit]] / [[end_edit]] blocks appear
- Verify: applyEditBlocks() correctly patches the code

**Files to check**:
- builderModeStore.ts (edit mode logic)
- BuilderChat.tsx (check if edit mode system prompt is sent)

**Time**: 20-30 min (to verify + test)

---

### TIER 3: Quality of Life (Make It Polish)

#### 3A. Compact "Update Card" with Change Summary
**Current State**: Version history exists but no fancy card
**Action**: Create UpdateCard component showing:
```
🔄 Updated: Page Title (v2)
• Changed button color to blue
• Added dark mode toggle
[Open Code] [Preview] [Diff]
```

**Time**: 30-45 min

---

#### 3B. Auto-BUILDER_LOG.md Updates
**Current State**: Logger exists, Apply button calls update-log
**Problem**: Not clear if it's wired correctly
**Action**: Test that BUILDER_LOG.md gets updated after each Apply

**Time**: 15-20 min (testing only)

---

#### 3C. Git Integration (Bonus)
**Current State**: None
**Action**:
- Add "Git Status" in sidebar
- Show unstaged files
- Suggest commits from AI ("Commit: Add dark mode to Header.tsx")
- Allow user to approve commit message

**Time**: 45-60 min (if desired)

---

## IMPLEMENTATION ORDER (What To Do First)

### Phase A: Verify Core Works (45-90 min)
1. ✅ Check all builder APIs are implemented and working
2. ✅ Test project creation flow
3. ✅ Ensure system prompt triggers FILE: proposals
4. ✅ Run full Apply/Reject test

### Phase B: Smooth the Workflow (60-90 min)
5. ✅ Add dark mode toggle
6. ✅ Fix preview auto-reload
7. ✅ Verify BUILDER_LOG updates
8. ✅ Test surgical edits

### Phase C: Polish (30-45 min)
9. ✅ Create UpdateCard component
10. ✅ Add other UX improvements

### Phase D: Bonus (If Time)
11. ✅ Git integration
12. ✅ Chat → Build context bridge

---

## SUCCESS CRITERIA

**Tier 1 Success** (User can use core workflow):
- [ ] New project created and appears in sidebar
- [ ] AI generates file edit proposals (FILE: format)
- [ ] Click [Apply] → file written to disk successfully
- [ ] Preview updates to show new content
- [ ] BUILDER_LOG.md shows applied changes
- [ ] Reject flow works (user clicks Reject, change doesn't apply)

**Tier 2 Success** (Smooth workflow):
- [ ] Dark mode toggle works
- [ ] Preview auto-reloads when files change
- [ ] Surgical edits work (AI patches specific lines)
- [ ] Context flows between chat and builder (optional)

**Tier 3 Success** (Polish):
- [ ] UpdateCard shows nice summary
- [ ] BUILDER_LOG is auto-updated
- [ ] Terminal integration smooth

---

## TESTING CHECKPOINTS

### Test 1: Create New Project
```
1. Click "New Project" in Builder sidebar
2. Enter project name: "test-app"
3. Choose template: "Blank HTML"
4. Verify: index.html appears in sidebar FileTree
5. Verify: File can be opened and content displays in artifact panel
```

### Test 2: AI File Operations
```
1. Ask: "add a blue button to the page"
2. Verify: AI response contains FILE: proposal
3. Verify: FileActionCard appears with Apply button
4. Click Apply
5. Verify: index.html updated on disk
6. Verify: Preview shows blue button
7. Verify: BUILDER_LOG.md has entry
```

### Test 3: Rapid Edits
```
1. Ask: "change button color to red"
2. Verify: Updates instantly
3. Ask: "center the button on the page"
4. Verify: Updates instantly
5. Ask: "audit this page - is it accessible?"
6. Verify: AI audits and gives feedback
```

### Test 4: Dark Mode
```
1. Click dark mode toggle
2. Verify: Entire Builder darkens
3. Verify: Preview shows dark mode styles
4. Refresh page
5. Verify: Dark mode persists
```

---

## RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| APIs not fully implemented | Workflow breaks | Verify all 11 APIs have route files |
| Path traversal security | User can access wrong files | Validate paths in write-file API |
| Preview doesn't update | User thinks change didn't work | Auto-reload preview on file write |
| AI doesn't generate FILE: proposals | No file operations | Update system prompt with clear format |
| Dark mode breaks layout | UI unreadable | Test all components in dark mode |

---

## COMMIT STRATEGY

After each tier:
1. Read/verify all files
2. Make minimal changes
3. Test the specific flow
4. Create clear commit message
5. Take screenshot of success

Example commits:
- "PHASE 1A: Verify builder APIs implemented and working"
- "PHASE 1C: Update AI system prompt to trigger FILE: edits"
- "PHASE 2A: Add dark mode toggle to Builder"
- "PHASE 2B: Auto-reload preview on file changes"

---

## READY TO START?

**Next Step**: I can:
1. **Read all builder API files** to verify they're implemented (30 min)
2. **Run the actual test flow** (create project → ask for edit → apply) (20 min)
3. **Fix whatever breaks during testing** (variable time)

**Or**: You can tell me which tier to focus on first.

**Recommended**: Start with TIER 1 (verify everything works) before adding new features.
