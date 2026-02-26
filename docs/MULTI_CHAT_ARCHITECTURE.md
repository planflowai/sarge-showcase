# Multi-Chat Workspace Architecture
> Written: 2026-02-25 | Pre-build documentation | DO NOT DELETE

## Baseline Commit
- **Commit**: `5fcebe5` — "baseline: pre-multi-chat. All current features stable."
- **Branch**: `sargebuild-v1`
- **Pushed to**: origin, sarge-main, sarge-builder, sarge-chat, sarge-batch

---

## Guardian System Split (CONFIRMED)

### Thread Guardian — Single Chat ONLY
- **Purpose**: Security. Detects prompt injection and manipulation in a single conversation.
- **Scope**: One AI, one watcher monitoring the same thread.
- **Location**: `lib/threadGuardian/`, `lib/stores/threadGuardianStore.ts`
- **UI**: `components/chat/ThreadGuardianIndicator.tsx`
- **Does NOT run** in multi-chat or builder.

### Jury Duty — Multi-Chat AND Builder
- **Purpose**: Quality/accuracy. Multiple AI models cross-check each other's work.
- **Scope**: Multiple models in separate lanes, verifying consistency across them.
- **Location**: `lib/juryGuardian/`, `lib/stores/juryGuardianStore.ts`
- **UI**: `components/chat/JuryGuardianIndicator.tsx`, `JuryMonitorPanel.tsx`, `JuryToast.tsx`
- **Runs in**: Multi-chat (parallel panels) and Builder (multiple AI segments).
- **Builder use case**: Models work on different segments (CSS, logic, layout) without overloading a single context window. Jury Duty verifies consistency across segments.

### Why Two Systems
- Thread Guardian is a **security guard** — watches for attacks on a single conversation.
- Jury Duty is a **quality control team** — multiple models keeping each other honest.
- Different threat models, different architectures, never mixed.

---

## Multi-Chat Spec (CONFIRMED REQUIREMENTS)

### 1. Each Panel Is a Full Citizen
Every multi-chat panel gets the COMPLETE single-chat feature set:
- Image generation button (if provider supports it: OpenAI, xAI, Google)
- Image attachments (paste, drop, file picker)
- Knowledge Vault attachment
- Context toggle (attach code)
- Plan/Build mode toggle
- Stop/abort button
- Full streaming with token stats, model badge, latency
- Copy, clear, all toolbar buttons

No stripped-down mini-boxes. Each panel = full breathing UI.

### 2. Context Survives Layout Switching
- Single chat (5 messages deep) → switch to multi-chat → conversation STAYS in its panel
- Multi-chat → switch back to single → conversation is still there
- Per-panel conversation state persists independently
- Each panel has its own message history, model selection, role assignment
- Switching layouts never destroys context

### 3. Jury Duty in Multi-Chat
- Jury Duty monitors each active panel independently
- Cross-verifies answers across panels
- Carries over when switching between single and multi-chat layouts

### 4. Roles Must Actually Work
**Current bug**: `roleId` is stored in column state but the `/api/chat` route ignores it entirely.
- When a role IS selected, it must be injected as a system prompt
- When no role is selected, no system prompt is added (model uses its default personality)
- The API route (`app/api/chat/route.ts` line 48) does not destructure `roleId` — this needs fixing

### 5. Image Generation Per Panel
- Each panel checks its provider for image gen support
- Button hidden for providers that don't support it (same as current single chat)
- Supported: OpenAI, xAI, Google

---

## Future: Multi-Window Workspace (5 Monitors)

### Vision
```
Monitor 1          Monitor 2          Monitor 3          Monitor 4          Monitor 5
+----------+    +--------------+    +----------+    +----------+    +----------+
| Model A   |    |   MASTER     |    | Model B   |    | Model C   |    | Model D   |
| (Claude)  |    |  DASHBOARD   |    | (GPT-4)   |    | (DeepSeek)|    | (Gemini)  |
|           |    |              |    |           |    |           |    |           |
| Full chat |    | All 4 feeds  |    | Full chat |    | Full chat |    | Full chat |
| + preview |    | Send to all  |    | + preview |    | + preview |    | + preview |
|           |    | Compare      |    |           |    |           |    |           |
+----------+    +--------------+    +----------+    +----------+    +----------+
```

### Technical Approach
- Pop-out windows via `window.open()` with screen position params (`left=`, `top=`)
- Multi-Screen Window Placement API (`getScreenDetails()`) for monitor detection
- Chrome permission prompt for multi-screen access (one-time)
- `BroadcastChannel` API for real-time inter-window communication
- Shared state across windows — all panels talk to each other

### Master Dashboard Features
- Send same prompt to all 4 models simultaneously
- See all responses streaming in real-time (compact view)
- Click any panel to focus that monitor's window
- Drag-and-drop to reassign models to monitors
- "Monitor Setup" wizard: detect all screens, drag-assign model to each

### Builder Integration
- Same multi-window architecture reused for Builder workspace
- Models work on different build segments across monitors
- Jury Duty cross-verifies consistency

---

## Current File Locations (Reference)

### Multi-Chat (Parallel)
- `components/chat/ParallelChatView.tsx` — current multi-chat UI
- `lib/stores/parallelChatStore.ts` — column state, messages, model assignment

### Jury Duty
- `lib/juryGuardian/engine.ts` — jury engine
- `lib/stores/juryGuardianStore.ts` — jury state
- `lib/types/juryGuardian.ts` — type definitions
- `app/api/jury-guardian/route.ts` — jury API
- `components/chat/JuryGuardianIndicator.tsx` — UI indicator
- `components/chat/JuryMonitorPanel.tsx` — monitor panel
- `components/chat/JuryToast.tsx` — toast notifications

### Thread Guardian
- `lib/threadGuardian/engine.ts` — guardian engine
- `lib/stores/threadGuardianStore.ts` — guardian state
- `components/chat/ThreadGuardianIndicator.tsx` — UI indicator

### Chat API
- `app/api/chat/route.ts` — main chat endpoint (NOTE: does not use roleId currently)

---

## Decisions Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Thread Guardian scope | Single chat only | Security monitoring for one conversation |
| Jury Duty scope | Multi-chat + Builder | Quality cross-verification across models |
| Panel UI | Full feature parity with single chat | User explicitly requested "fully breathing UI" |
| Context on layout switch | Preserved per-panel | "single to multi without losing context" |
| Multi-window tech | window.open + BroadcastChannel | Native browser APIs, Chrome multi-screen support |
| Monitor assignment | Multi-Screen Window Placement API | User has 5 monitors, wants auto-placement |
