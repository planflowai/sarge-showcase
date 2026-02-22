# SARGE Project Context

> This file is read by the Diagnostics AI before analyzing any code issues.
> It helps the AI understand what's intentional vs. what's a bug.

## Project Overview

**SARGE** = Synthetic Adversarial Reasoning & Guarding Engine

A multi-model AI workbench that supports:
- Chat with multiple AI providers (Claude, GPT, Gemini, Grok, Ollama)
- Debate Arena - multi-agent adversarial discussions
- Batch testing of prompts across models
- Real-world fact-checking with web search
- Air-gap mode for fully local operation
- Secure mode for input/output sanitization

---

## Intentional Patterns (DO NOT FLAG AS ERRORS)

### Empty Catch Blocks
Many stores use empty catch blocks for localStorage operations. This is **intentional**:
```typescript
try {
  localStorage.setItem(key, data);
} catch {
  // Intentional: localStorage may be full or unavailable, continue gracefully
}
```
**Reason:** User experience should not break if storage fails.

### TypeScript `any` Types
Some `any` types are intentional in:
- API response handling (external data)
- Dynamic provider switching
- Third-party library interfaces

### `@ts-ignore` / `@ts-expect-error`
Used when:
- Working around library type issues
- Zustand store patterns that TypeScript doesn't understand
- Dynamic imports

### Console Statements
- `console.error` in stores/API routes = **legitimate error logging**
- `console.log` with `[tag]` prefix = **debug logging, intentional**
- Random `console.log` without prefix = **likely leftover, can flag**

---

## Architecture

### PROJECT ROOT: L:\super_ai\SARGE_v1

**CRITICAL: All file paths are relative to L:\super_ai\SARGE_v1**

### Pages (`/app/*`)
| Route | File Location | Purpose |
|-------|---------------|---------|
| `/` | `app/page.tsx` | Main chat interface |
| `/settings` | `app/settings/page.tsx` | Configuration, API keys, models, roles |
| `/journal` | `app/journal/page.tsx` | Project documentation and notes |
| `/library` | `app/library/page.tsx` | Saved conversations and exports |
| `/review` | `app/review/page.tsx` | Conversation analysis |
| `/optimize` | `app/optimize/page.tsx` | Prompt optimization tools |
| `/live-checker` | `app/live-checker/page.tsx` | Real-time web search verification |
| `/real-world` | `app/real-world/page.tsx` | Real-world testing scenarios |
| `/diagnostics` | `app/diagnostics/page.tsx` | This self-healing AI system |
| `/debate` | `app/debate/page.tsx` | Debate arena |

### Key UI Components
| Component | File Location | Purpose |
|-----------|---------------|---------|
| Header/Navigation | `components/layout/Header.tsx` | Top navigation bar |
| Sidebar | `components/layout/Sidebar.tsx` | Left sidebar |
| Chat Input | `components/chat/ChatInput.tsx` | Message input area |
| Chat Messages | `components/chat/ChatMessages.tsx` | Message display |
| Model Selector | `components/ModelSelector.tsx` | Model dropdown |

### Stores (`/lib/stores/*`)
All Zustand stores follow the pattern:
- `hydrate()` - Load from localStorage on mount
- `hydrated` boolean - Prevent rendering before data loads
- Silent error handling for storage operations

### Providers (`/lib/providers/*`)
Each AI provider has:
- `chat()` function - Main API call
- Air-gap checks - Block when air-gap mode enabled
- Fallback support - Auto-switch on errors

---

## Security Patterns

### Air-Gap Mode
When enabled, ALL cloud API calls are blocked. Checks are in:
- Each provider file
- The fallback wrapper

### Secure Mode
Input/output sanitization for sensitive operations. Uses:
- `dangerouslySetInnerHTML` only where absolutely necessary (markdown rendering)
- Input validation on all user inputs

### Intentional Security Patterns
- `dangerouslySetInnerHTML` in markdown renderer = **required for rendering**
- `innerHTML` in specific UI components = **reviewed and safe**

---

## What To Flag

### Definitely Problems
- Unhandled promise rejections (missing `.catch()` or try/catch)
- Hardcoded API keys or secrets
- SQL injection patterns
- Unused imports/variables
- Dead code paths
- Memory leaks (missing cleanup in useEffect)

### Maybe Problems (Ask User)
- `any` types in new code
- Missing error boundaries
- Large components that should be split
- Duplicated code

### Not Problems (Ignore)
- Empty catches in localStorage operations
- `console.error` with `[tag]` prefix
- `@ts-ignore` with comment explaining why
- `dangerouslySetInnerHTML` in markdown components

---

## File-Specific Notes

### `debateStore.ts`
- Complex state machine for debate flow
- Multiple async operations are intentional
- Circular updates between agents is the design

### `fallbackService.ts`
- Intentionally catches and classifies all errors
- Empty catches are for circuit breaker logic

### `messageStore.ts`
- localStorage errors are intentionally swallowed
- Messages auto-save, failure is non-critical

---

## How To Use This Context

When analyzing a finding:
1. Check if the pattern is listed as "Intentional" above
2. Check the file-specific notes
3. If flagging something in stores, verify it's not the standard localStorage pattern
4. For security issues, check if it's in the "Intentional Security Patterns" section

If unsure, suggest the fix but note: "This may be intentional - verify with the developer."
