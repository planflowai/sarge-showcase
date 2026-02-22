# Architecture Reference — SARGE Platform

Tech stack, design patterns, security model, and infrastructure.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js | 16 (App Router, Turbopack) |
| **Language** | TypeScript | Strict mode, target ES2020 |
| **React** | React | 19.2.3 |
| **State** | Zustand | 5.0.10 (43 stores, localStorage persist) |
| **Styling** | Tailwind CSS | 4 |
| **UI Primitives** | Radix UI | (accordion, dialog, dropdown, tabs, tooltip, separator, scroll-area, resizable) |
| **Icons** | Lucide React | |
| **Code Editor** | Monaco Editor | @monaco-editor/react |
| **Layout** | React Resizable Panels | For split-pane UX |
| **Markdown** | React Markdown + Syntax Highlighter | |
| **AI SDKs** | Anthropic SDK, OpenAI, Google Generative AI | @anthropic-ai/sdk, openai, @google/generative-ai |
| **Backend Sync** | Supabase | Optional, RLS-secured |
| **Export** | jsPDF, jszip, PapaParse | Batch export, CSV handling |
| **Dev Server** | Ports: 5000 (app), 11434 (Ollama), 1234 (LM Studio) | |

---

## File Structure

```
L:\ai_builder\ai_builderv2\
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Chat (home)
│   ├── dashboard/                # /dashboard
│   ├── builder/                  # /builder
│   ├── journal/                  # /journal
│   ├── settings/                 # /settings
│   ├── vault/                    # /vault
│   ├── diagnostics/              # /diagnostics
│   ├── [other routes]/           # research, debate, test, library, etc.
│   └── api/                      # API routes (39 total)
│       ├── chat/                 # /api/chat (streaming)
│       ├── builder/              # /api/builder/* (11 routes)
│       ├── test/                 # /api/test/* (5 routes)
│       ├── diagnostics/          # /api/diagnostics/* (5 routes)
│       ├── search/               # /api/search/tavily
│       └── [other routes]/
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx            # Nav header (19 routes)
│   │   ├── Sidebar.tsx           # Left sidebar (hidden on certain routes)
│   │   └── MobileNav.tsx
│   │
│   ├── Builder/
│   │   ├── BuilderPage.tsx       # Main 3-panel layout
│   │   ├── BuilderSidebar.tsx    # Model selector + file explorer
│   │   ├── BuilderChat.tsx       # Isolated builder chat
│   │   ├── ArtifactPanel.tsx     # Code/Preview/Diff tabs
│   │   ├── ArtifactCard.tsx      # Compact card in chat
│   │   ├── BuilderCodeEditor.tsx # Monaco wrapper
│   │   ├── BuilderPreview.tsx    # iframe sandbox
│   │   ├── BuilderDiffEditor.tsx # Monaco diff viewer
│   │   ├── BuilderTerminal.tsx   # Sandboxed shell
│   │   ├── FileExplorer.tsx      # File tree root
│   │   ├── FileTree.tsx          # Recursive tree nodes
│   │   └── contentDetector.ts    # HTML/React/snippet detection
│   │
│   ├── DebateView/               # Debate overlay components
│   │   ├── DebateView.tsx
│   │   ├── DebateSetup.tsx
│   │   ├── AgentPanel.tsx
│   │   └── VerdictPanel.tsx
│   │
│   ├── TestModeView/             # Test mode overlay components
│   │   ├── TestModeView.tsx
│   │   ├── ModelSlotSelector.tsx
│   │   ├── VerdictPanel.tsx
│   │   └── BatchModeView.tsx
│   │
│   ├── settings/                 # Settings sub-components (lazy-loaded)
│   │   ├── ModelRegistry.tsx
│   │   ├── RollCall.tsx
│   │   ├── SettingsOrchestration.tsx
│   │   ├── SettingsTradingAPIs.tsx
│   │   ├── SettingsLogicEditor.tsx
│   │   ├── SettingsKnowledge.tsx
│   │   └── settingsStyles.ts
│   │
│   └── ui/                       # Radix UI & custom components
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── tabs.tsx
│       └── [other primitives]/
│
├── lib/
│   ├── stores/                   # 43 Zustand stores
│   │   ├── messageStore.ts
│   │   ├── conversationStore.ts
│   │   ├── modelStore.ts
│   │   ├── providerStore.ts
│   │   ├── builderStore.ts
│   │   ├── testModeStore.ts
│   │   ├── debateStore.ts
│   │   ├── threadGuardianStore.ts
│   │   ├── vaultStore.ts
│   │   └── [others]/
│   │
│   ├── utils/
│   │   ├── cn.ts                 # Tailwind classname merge
│   │   ├── formatNumber.ts
│   │   ├── storageManager.ts     # localStorage utility
│   │   └── [other utilities]/
│   │
│   ├── contextInjector.ts        # BUILDER_LOG + vault doc injection
│   ├── capabilityOrchestrator.ts # guardianAvailable flag
│   ├── constants.ts              # Global constants
│   ├── supabase/                 # Supabase client (optional backend)
│   └── [other helpers]/
│
├── docs/                         # Documentation vault (NEW)
│   ├── index.md                  # Master navigation
│   ├── pages.md                  # All 19 routes
│   ├── ai-logic.md               # System prompts, orchestration flows
│   ├── architecture.md           # Tech stack, design patterns
│   ├── stores.md                 # All 43 Zustand stores
│   ├── api-routes.md             # All 39 API endpoints
│   ├── models.md                 # Providers and models
│   └── changelog.md              # Version history
│
├── CLAUDE.md                     # Project instructions (checked in)
├── SARGE_PLATFORM.md             # Master reference (this file's source)
├── BUILDER_LOG.md                # Auto-generated builder history (per project)
├── package.json
└── tsconfig.json
```

---

## State Management Strategy (Zustand)

### Architecture
- **43 stores** (listed in [docs/stores.md](stores.md))
- **All persist to localStorage** via Zustand persist() middleware
- **Organized by domain:**
  - Chat & Conversation (4 stores)
  - Model & Provider (8 stores)
  - Builder (6 stores)
  - Testing & Debate (5 stores)
  - Security & Monitoring (5 stores)
  - Content & Knowledge (5 stores)
  - UI & Infrastructure (5 stores)

### Persistence Pattern
```typescript
// Example store
export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      messages: [],
      addMessage: (msg) => set((state) => ({
        messages: [...state.messages, msg]
      })),
    }),
    { name: 'message-store' } // localStorage key
  )
);
```

### Hydration
- **Client-side only:** Stores hydrate on component mount
- **Explicit hydration:** Some stores (e.g., knowledgeStore) use manual hydration pattern
- **No server-side rendering of state:** Prevents SSR mismatches

---

## Provider Routing Flow

```
User submits message
    ↓
modelStore.currentModel check
    ↓
Routing priority chain:
  1. User-selected model (if available + enabled)
  2. Provider fallback chain:
     Anthropic → OpenAI → Google → xAI → DeepSeek → Ollama → LM Studio
  3. Air-gap override:
     If SARGE_AIR_GAP=1, skip cloud, route to Ollama only
  4. Last resort:
     llama3.2:3b (Ollama)
    ↓
API route (/api/chat, /api/test/completion, etc.)
    ↓
Streaming response → store → UI
```

### Streaming Implementations
- **Anthropic SDK:** `stream.on('text', handler)`
- **OpenAI/xAI/DeepSeek:** Server-sent events (SSE) text/event-stream
- **Ollama:** HTTP chunked transfer encoding
- **LM Studio:** OpenAI-compatible SSE

---

## Air-Gap Mode Behavior

### Activation
- Environment: `SARGE_AIR_GAP=1`
- Manual toggle: Settings → "ISOLATED" button

### Effects
| Component | Behavior |
|-----------|----------|
| Cloud APIs | 503 Service Unavailable (blocked) |
| Supabase | Falls back to localStorage only |
| Ollama / LM Studio | ✅ Full access |
| SearXNG | ✅ Works (if local instance running) |
| Tavily / Brave / Google Search | ❌ Blocked |
| Builder file ops | ✅ Full access |
| Web preview iframe | ✅ Local files only |

### UI Indicator
- Orange pulsing banner: "AIR-GAP MODE"
- "ISOLATED" button in header (active state)

---

## Security Model

### Builder Sandbox
- **File access:** All ops validate projectPath per-request
- **Blocklist:** .env*, .aws/*, .ssh/* blocked globally
- **Terminal blocklist:** rm, mv, sudo, git push, chmod, dd, mkfs blocked by regex
- **Write limit:** 5MB per file
- **Forensic logging:** All Builder write ops emit blockchain-style hash events

### PIN Lock
- **Storage:** SHA-256 hash in pinStore
- **Auto-lock:** 30-minute inactivity timeout
- **Bypass:** No bypass option (security-first)

### Thread Guardian Monitoring
- **Fact indexing:** Tier 1 (every 2 min) extracts claims
- **Contradiction detection:** Tier 2 (every 10 min) flags hallucinations
- **Save points:** Tier 3 (every 4 hours) creates conversation snapshots
- **Escalation:** Human review if contradiction threshold exceeded

### Forensic Logging
- **Chain:** Blockchain-style hash chain (each log links to previous)
- **Coverage:** All Builder write ops, model swaps, test executions
- **Storage:** forensicLogStore (up to 500 entries)
- **Export:** Markdown timeline with event hashes

---

## Context Injection Architecture

### System Prompt Prepending
```
[VAULT DOCS - invisible to user]
[THREAD GUARDIAN CONTEXT - facts, contradictions, save points]
[BUILDER_LOG - project history (Builder mode only)]
---
User message
```

### Implementation
- **lib/contextInjector.ts:**
  - `readBuilderLog()` reads BUILDER_LOG.md (5000 token limit, truncates at newline)
  - `getRelevantDocs(mode)` returns selective docs (3000 token limit)
  - `buildPromptWithContext()` combines all context + user message

### Max Injection
- **Per-request:** 3000 tokens
- **Truncation:** Headers + first paragraph if over limit
- **User visibility:** Zero (context prepended invisibly)

---

## API Route Categories

### Streaming Routes (Server-Sent Events)
- `/api/chat` — Main streaming chat
- `/api/test/stream` — Test mode live stream
- `/api/builder/terminal` — Terminal output stream

### File Operations (Builder)
- `/api/builder/check-folder`
- `/api/builder/list-directory`
- `/api/builder/read-file`
- `/api/builder/write-file`
- `/api/builder/files` (CRUD)
- `/api/builder/create-project`

### Completion Routes (non-streaming)
- `/api/test/completion` — Single D1/D2/D3/Judge pass
- `/api/rollcall` — Direct model ping
- `/api/diagnostics/*` — Static analysis + fixes

---

## Key Design Patterns

### 1. Component Composition
- **Page components** (`app/*/page.tsx`) are thin shells
- **Logic in sub-components** (`components/*/`) with own state/stores
- **Lazy loading:** Heavy sections use `next/dynamic`

### 2. Store Ownership
- **Each store has one "owner" component**
- **Owner component hydrates and writes to store**
- **Other components read via hooks (e.g., `useStore(s => s.field))`)**

### 3. Streaming Pattern
```typescript
// 1. Start SSE connection
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify(message)
});

// 2. Read stream line-by-line
const reader = response.body?.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = new TextDecoder().decode(value);
  // 3. Parse and update store
  updateMessageStore(text);
}
```

### 4. Forensic Logging
- **Hash chain:** Each log entry includes hash of previous
- **Timeline:** Timestamp + event type + affected files
- **Reversibility:** Snapshots (50 max) allow rollback

### 5. Content Detection
```typescript
// In contentDetector.ts
export function detectType(code: string): 'html' | 'react' | 'snippet' {
  if (code.includes('<html') || code.includes('<!DOCTYPE')) return 'html';
  if (code.includes('import React') || code.includes('export default')) return 'react';
  return 'snippet';
}
```

---

## Scaling Considerations

### localStorage Limits
- **Total limit:** ~5-10MB per browser
- **Vault:** 50MB "pool" (enforced via UI, not stored monolithically)
- **Strategy:** Chunk large files, truncate history (aiAnalysisStore: 10/20/500 limits)

### API Rate Limits
- **Anthropic:** 50,000 tokens/min
- **OpenAI:** Varies by model
- **Ollama:** No rate limit (local)
- **Strategy:** Fallback chain handles provider limits transparently

### Real-time Considerations
- **Thread Guardian:** Runs in background without blocking UI
- **Streaming:** Debounced preview updates (300ms intervals)
- **Storage sync:** Optional Supabase (async, non-blocking)

---

## Development Workflow

### Local Dev Server
```bash
npm run dev
# Next.js: http://localhost:5000
# Ollama: http://localhost:11434 (auto-discovered)
# LM Studio: http://localhost:1234 (optional)
```

### Environment Setup
1. Create `.env.local` with provider keys (optional, works with locals)
2. Optionally start Ollama: `ollama serve`
3. Run `npm run dev`
4. Open http://localhost:5000

### Builder Project Folder
- Set `BUILDER_PROJECTS_DIR` to root folder for project picker
- Builder reads/writes files with full path validation
- BUILDER_LOG.md auto-created in project root

---

## Performance Optimizations

### Code Splitting
- **next/dynamic** for Settings sub-components
- **Bundle analysis:** Use `npm run analyze`

### Streaming Debounce
- **Preview updates:** Min 300ms interval, min 150 char delta (from lib/constants.ts)
- **Prevents thrashing** of Monaco and iframe renders

### Memoization
- **React.memo** for expensive render paths (Message list, Agent panels)
- **useMemo** for derived state (total stats, aggregated results)

### localStorage Cleanup
- **Trim history:** debateHistoryStore max 50, aiAnalysisStore limits enforce caps
- **Snapshots:** diagnosticsStore max 50
- **Manual export/clear:** storageManager.ts utilities available

---

Generated from SARGE_PLATFORM.md and codebase analysis
