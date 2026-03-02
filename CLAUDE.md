# AI BUILDER v2 — Claude Code Project Context

⚠️ WORKING DIRECTORY: L:\ai_builder\ai_builderv2
IF YOU ARE NOT IN THIS FOLDER, STOP IMMEDIATELY AND TELL THE USER.

## CRITICAL RULES

1. ONLY modify files in `L:\ai_builder\ai_builderv2`
2. Do NOT break existing SARGE features (Chat, Debate Arena, Settings, etc.)
3. Ask before modifying more than 3 existing files. New Builder files don't count.
4. Port 5000 for dev server. Ollama at 127.0.0.1:11434.

---

## What This App Is

AI Builder replaces three paid tools with one free, model-agnostic app:

| Replaces | With | How |
|----------|------|-----|
| Pinegrow ($) | Builder tab + local models | Design pages with AI for free |
| Claude.ai artifacts ($) | Live preview + artifact cards | See code render in real-time |
| Claude Code extension ($) | AI file operations + terminal | AI edits real project files, you approve |

### The User's Workflow (This Is The Gold Standard)

1. **Design** — Open a project folder. Use local models (free) to generate pages, components, layouts. See live preview in the artifact panel as code streams in.
2. **Wire** — Use the terminal to `npm install`, `npm run dev`. The preview iframe (or external browser) shows the running app.
3. **Iterate** — Tell the AI "move the button", "change the navbar color", "add a login form". The AI edits the actual file. The dev server hot-reloads. You see changes live. No code dumps in chat — just compact cards showing what changed.
4. **Escalate** — Switch to a cloud model for complex multi-file refactors or hard debugging. Same interface, just a different model in the dropdown.
5. **Log** — After each session, the system auto-generates/updates a `BUILDER_LOG.md` in the project root with changes made, current plan, and next steps. Context is always preserved.

---

## What Exists Already (DONE)

- ✅ Builder tab in nav (end, after Diagnostics)
- ✅ Own layout (no SARGE sidebar)
- ✅ Slim sidebar with builder model dropdown + file explorer
- ✅ Isolated builder chat with streaming + token metrics
- ✅ Artifact panel with Code (Monaco) + Preview (iframe) tabs
- ✅ Content detection (HTML/React/snippet)
- ✅ Context injection (auto for local, attach toggle for cloud)
- ✅ Builder model tagging in Settings
- ✅ Terminal toggle
- ✅ Download/Copy/Expand toolbar
- ✅ DeepSeek cloud provider added
- ✅ Artifact cards (compact, with Open Code / Preview buttons)

---

## PHASE 2: Claude.ai Artifact UX (CURRENT — FIX THESE NOW)

### 2A. Artifact Cards — ZERO Code in Chat

When AI generates code, show ONLY a compact card in chat:
```
┌──────────────────────────────────────┐
│  ✨ Dark Mode Toggle          HTML   │
│  [Open Code]  [Preview]             │
└──────────────────────────────────────┘
```
- NO code thumbnail. NO code lines. Zero code visible in chat.
- Title auto-generated from content
- Language badge (HTML/React/CSS/JS)
- Clicking opens artifact panel
- Full code ONLY visible in artifact panel's Code tab
- If user explicitly says "show me the code" or "print the code", then show inline

### 2B. Context Injection — INVISIBLE

The `[CONTEXT — AUTO-INJECTED]` block must NEVER appear in the chat UI. It is:
- Prepended to the API request silently
- The user message in chat shows ONLY what the user typed
- The context is a hidden system-level addition, not a visible message

### 2C. Layout — Preview Is Primary

```
[Sidebar 200px] [Chat ~400px] [│resize│] [Artifact Panel — rest of screen]
```

- Artifact panel is ALWAYS visible (not hidden, not slide-in)
- Artifact panel takes the MAJORITY of screen width
- Chat is the narrow input panel on the left
- Drag-resize handle between chat and artifact panel
- Fullscreen button: hides sidebar + chat, preview takes entire screen. Escape to exit.
- Panel width saved to localStorage

### 2D. Live Streaming Preview

As the AI streams code tokens:
1. Detect code fence opening in stream
2. Buffer code tokens
3. Every 100ms, inject current buffer into preview iframe srcdoc
4. User watches the page build itself in real-time
5. Show "● Live" indicator with pulsing dot during streaming
6. Auto-switch to Preview tab when streaming starts

### 2E. Artifact Versioning

When user asks to modify existing code:
- AI updates the EXISTING artifact (not a new one)
- Chat shows compact update card:
```
┌──────────────────────────────────────┐
│  🔄 Updated: Dark Mode Toggle   v2  │
│  • Moved button to upper-right       │
│  [Open Code]  [Preview]  [Diff]     │
└──────────────────────────────────────┘
```
- Version number increments (v1, v2, v3...)
- Change summary from AI's response
- Diff button opens Monaco diff editor
- Previous versions accessible via dropdown in artifact panel

### 2F. Builder System Prompt

```
You are a code builder assistant inside AI Builder Pro.

RULES:
- ALWAYS generate single, self-contained files. HTML must include ALL CSS in <style> tags and ALL JavaScript in <script> tags. NEVER reference external files like ./main.js or ./style.css.
- When modifying existing code, output the COMPLETE updated file.
- Start with a brief explanation (1-3 sentences) of what you built or changed.
- Then provide the code in a single code block.
- Be concise. No lengthy explanations unless asked.
```

---

## PHASE 3: Claude Code Features (AFTER PHASE 2)

These give the AI the ability to work with REAL project files — like Claude Code does.

### 3A. AI File Operations

When a project is open, the AI can propose:
- **Edit** existing files — shown as a diff card
- **Create** new files — shown as a new file card
- **Delete** files — shown with confirmation

The AI NEVER writes directly to disk. All changes go through approval.

### 3B. Apply / Reject Flow

File change proposals appear as action cards in chat:
```
┌──────────────────────────────────────┐
│  ✏️  Edit: src/components/Header.tsx  │
│  +3 lines  -1 line                   │
│  [Apply] [Reject] [View Diff]       │
└──────────────────────────────────────┘
```
- **Apply** → writes to disk, updates file explorer
- **Reject** → discards, AI is notified
- **View Diff** → Monaco diff editor in artifact panel
- Multiple file changes → card per file + "Apply All" button

### 3C. Dev Server Integration

When a project has a dev server running (`npm run dev`):
- The preview iframe can point to the dev server URL (e.g., `localhost:3000`) instead of srcdoc
- File edits trigger hot-reload automatically
- User sees changes in real-time without manually refreshing
- Toggle between "srcdoc preview" and "dev server preview" modes

### 3D. Diff Tab

Add `[Code] [Preview] [Diff]` tabs to artifact panel:
- Uses Monaco's built-in diff editor
- Side-by-side: original left, modified right
- Inline view toggle
- Shows diff between current file and AI's proposed changes

---

## PHASE 4: Auto-Changelog (BUILDER_LOG.md)

### Purpose
Every AI session should leave a trail. When the user comes back tomorrow, or switches to a different model, the context is preserved automatically.

### How It Works

After each batch of AI changes (or when the user types "update log" or "save progress"):

1. Auto-create/update `BUILDER_LOG.md` in the project root
2. Format:

```markdown
# Builder Log — [Project Name]
Last updated: [timestamp]

## Current State
[Auto-generated summary of what exists, what works, what's broken]

## Session: [date + time]
### Changes Made
- Created index.html with navbar, hero section, dark mode toggle
- Modified styles: moved button to upper-right, added transition

### Current Plan
[What the user is working toward]

### Next Steps
- [ ] Add contact form
- [ ] Wire up API calls
- [ ] Test responsive layout

## Session: [previous date]
### Changes Made
- Initial project setup
- Created base HTML structure
...
```

3. The AI reads this log at the start of each session (via context injection) to understand project state
4. The log is cumulative — new sessions append, old sessions stay
5. User can also manually add notes: "log: switching to React for this component"

---

## PHASE 5: Polish & Power Features

### 5A. All Cloud Models as Builders
Auto-tag ALL cloud models as builder-eligible:
- All Claude variants, GPT variants, Gemini variants, Grok variants, DeepSeek variants
- User can untag any

### 5B. Project Templates
"New Project" → Blank HTML, React App, Next.js, Tailwind Starter

### 5C. Multi-Tab Editor
Open multiple files as tabs in Monaco. Switch between them.

### 5D. Git Integration
Git status in file explorer. Basic commit/push from terminal or sidebar.

---

## Builder Model Tagging

In Settings → Models:
- Each model has a "Builder" toggle (hammer icon)
- ALL cloud models auto-tagged by default
- Local code models (qwen2.5-coder, deepseek-coder, codellama, starcoder) auto-tagged
- User can untag/retag any model

---

## File Structure (Builder Components)

```
components/Builder/
  BuilderPage.tsx              ← Main container (3-panel layout)
  BuilderSidebar.tsx           ← Slim sidebar (models + file explorer)
  BuilderChat.tsx              ← Isolated chat
  ArtifactCard.tsx             ← Collapsed artifact card in chat
  ArtifactUpdateCard.tsx       ← Update card with version + diff
  FileActionCard.tsx           ← Apply/Reject for file operations
  ArtifactPanel.tsx            ← Right panel (Code/Preview/Diff)
  BuilderCodeEditor.tsx        ← Monaco editor
  BuilderPreview.tsx           ← Sandboxed iframe
  BuilderDiffEditor.tsx        ← Monaco diff editor
  BuilderTerminal.tsx          ← Terminal
  FileExplorer.tsx             ← File tree
  FileTree.tsx                 ← Recursive tree
  contentDetector.ts           ← HTML vs React detection

lib/stores/
  builderStore.ts              ← Project + file state
  builderChatStore.ts          ← Isolated chat messages
  artifactStore.ts             ← Artifact versions + history

lib/
  contextInjector.ts           ← Context injection
  builderLogger.ts             ← BUILDER_LOG.md generation
```

---

## Current Priority Order

### NOW — Fix Phase 2 bugs:
1. **Context injection invisible** — [CONTEXT] must NEVER show in chat UI
2. **Layout flipped** — artifact panel right, always visible, majority width
3. **Preview working** — iframe renders HTML visually, not blank
4. **Live streaming preview** — code streams into preview in real-time
5. **Artifact cards clean** — zero code lines in chat

### NEXT — Complete Phase 2:
6. Artifact versioning (update in place, diff button)
7. All cloud models as builders
8. Fullscreen preview mode

### THEN — Phase 3:
9. AI file operations with apply/reject
10. Dev server integration
11. Diff tab in artifact panel

### FINALLY — Phase 4+5:
12. Auto-changelog (BUILDER_LOG.md)
13. Project templates
14. Multi-tab editor

---

## Reminders for Claude Code

1. ⚠️ CHECK YOUR WORKING DIRECTORY. Must be `L:\ai_builder\ai_builderv2`. If not, STOP.
2. This is an EXISTING app. ADD features, don't rebuild.
3. Builder chat is ISOLATED from main Chat.
4. **ZERO code in chat.** Artifact cards only. Code lives in artifact panel.
5. **Context injection is INVISIBLE.** User never sees [CONTEXT] text.
6. **Preview is PRIMARY.** It takes most of the screen. Chat is the input sidebar.
7. **Live preview during streaming.** User watches the page build itself.
8. Test after every change. One task at a time.
9. The goal is to replace Pinegrow + Claude Code with local models. Every feature serves that workflow.
10. When making changes to project files, ALWAYS update BUILDER_LOG.md (once Phase 4 is built).

---

## Development Safety Rules — MANDATORY

These rules exist because we've had two catastrophic failures. They are not optional.

### Rule 1: Pre-Flight Backup
Before ANY commit that modifies existing files (not just adding new files), run:
```
scripts\backup.bat [app-name]
```
This creates a timestamped copy in backups/. Do this BEFORE making changes, not after.

### Rule 2: One App Per Commit
Never modify more than one standalone app in a single commit. If a change requires modifying core packages AND an app, that's two separate commits:
1. Commit the package change, verify it compiles
2. Commit the app change, verify it loads

### Rule 3: Changelog Entry Required
Every commit MUST add an entry to CHANGELOG.md before pushing. The entry MUST include:
- Files touched
- What changed (plain English)
- What was tested
- Working state (Yes / Partial / No / Not tested)
- Revert command

### Rule 4: Test Every 3 Commits
After every 3 consecutive commits, STOP. Verify:
- Does the app start? (`npx next dev -p [port] --webpack`)
- Does the page load in the browser?
- Do buttons respond to clicks?
- Are there console errors?
If any answer is NO, fix before continuing. Do NOT stack more commits on top of broken code.

### Rule 5: Never Add Unrelated Features to Existing Apps
Each standalone app does ONE thing:
- builder-standalone = building websites
- launchpad-standalone = starting/stopping apps
- env-manager-standalone = managing API keys
Never add management, admin, or utility features to an app that has a different primary purpose. If it's a different function, it's a different app.

### Rule 6: Tag Working States
After any session where the app is verified working, create a git tag:
```
git tag working-YYYY-MM-DD-short-description
git push --tags --all
```

### Rule 7: No Chain Prompting Without Verification
If executing multiple prompts in sequence, each prompt's changes must be verified working before proceeding to the next prompt. The only exception is purely additive changes (new files only, no modifications to existing files).

### Rule 8: Revert Fast, Don't Patch
If a commit breaks something and the fix isn't obvious within 10 minutes, revert to the last working tag instead of trying to patch. It's faster to revert and redo than to debug cascading failures.

### Rule 9: Check STATUS.md Before Changes
Before modifying any component, store, or API route, check `STATUS.md` for:
- Current working state of the feature you're touching
- Known issues that might be related
- Architecture metrics (store count, component count) to avoid bloat
- Safe revert points in case your change breaks something
If `STATUS.md` doesn't exist or is outdated, do NOT create/update it without user permission.

### Rule 10: Follow the Build Plan
Before executing any prompt, check `BUILDPLAN.md` for the relevant feature. If the prompt contradicts the build plan, STOP and report the conflict. Do not execute prompts that skip steps or change the agreed UX flow. If a feature isn't in `BUILDPLAN.md`, add it first and get confirmation before building.
