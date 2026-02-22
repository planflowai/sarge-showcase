# PHASE 1.1: BuilderChat.tsx Split Plan

## Current State
- **BuilderChat.tsx**: 1420 lines
- **Main useEffect**: Lines 640-815 (175 lines)
- **Dependencies**: 17 (way too many)
- **Sub-components**: BuilderMessageBubble (nested in same file)

## Target State
- **BuilderChat.tsx**: <150 lines (orchestrator only)
- **hooks/useStreamingUpdates.ts**: <150 lines (streaming + edit parsing + log updates)
- **hooks/useAIHelpers.ts**: <100 lines (after-build helper trigger)
- **components/BuilderChat/MessageList.tsx**: <150 lines (message rendering with virtual scroll)
- **components/BuilderChat/BuilderMessageBubble.tsx**: Extract to own file
- **useEffect dependencies**: 5 max in any hook

## Logic Mapping

### BuilderChat.tsx (Orchestrator) — NEW
**Responsibility**: Wire components + state management only
- Get state from stores: `messages`, `sending`, `selectedModel`, etc.
- Get callbacks from props
- Render: MessageList + Input area + Progress cards
- Hydration logic
- Draft persistence
- Modal dialogs

**Dependencies**: None (or ≤3)

### hooks/useStreamingUpdates.ts — NEW
**Responsibility**: When streaming message arrives → extract code → update preview → parse edits → log changes

**Logic**:
1. Find streaming message in `messages`
2. Extract code via `extractCodeFromMarkdown()`
3. Call `onStreamingUpdate()` to update preview
4. Update progress cards (startStep, finishProgress)
5. When streaming ends:
   - Parse EDIT blocks if in edit mode
   - Compute diff if needed
   - Call `onViewDiff()` for approval UI
   - Call `onStreamingUpdate(code, false)` to finalize
   - Update BUILDER_LOG.md (fire-and-forget)

**Input**:
- `messages: Message[]`
- `sending: boolean`
- `editMode: EditMode`
- `artifactCode?: string`
- `projectPath?, projectName?, selectedModel?`
- Callbacks: `onStreamingUpdate`, `onApplyEditBlocks`, `onViewDiff`
- Progress: `{ startStep, finishProgress, isVisible }`

**Return**:
- `{ code: string | null, pendingEdit: Edit | null }`

**Dependencies**: `[messages, sending, editMode, artifactCode, projectPath, projectName, selectedModel, startStep, finishProgress, progressIsVisible, onStreamingUpdate, onViewDiff]`
- **Count**: 12 (down from 17)

### hooks/useAIHelpers.ts — NEW
**Responsibility**: When build completes → trigger after_build helpers

**Logic**:
1. Wait for streaming to end
2. Get active helpers with type `after_build`
3. For each helper:
   - Extract code from final message
   - Build helper prompt
   - Call `/api/test/stream`
   - Stream response into helper UI
   - Update helper response store

**Input**:
- `messages: Message[]`
- `sending: boolean`
- `code: string | null`
- `helpers: Helper[]`
- Store methods: `getActiveHelpers`, `addResponse`, `updateResponse`, `setActiveHelper`

**Return**: `void`

**Dependencies**: `[messages, sending, code, helpers]`
- **Count**: 4

### components/BuilderChat/MessageList.tsx — NEW
**Responsibility**: Pure component to render messages + virtual scrolling

**Props**:
- `messages: Message[]` (required)
- `onOpenInEditor?: callback`
- `onOpenPreview?: callback`
- `projectPath?: string`
- `projectName?: string`
- `onViewDiff?: callback`
- `autoApply?: boolean`

**Returns**: `JSX`

**Internal**: Maps `messages.map(msg => <BuilderMessageBubble />)`

### components/BuilderChat/BuilderMessageBubble.tsx — EXTRACT
**Move from**: Currently nested in BuilderChat.tsx (lines 76-441)
**Change**: No behavior change, just extract to own file
**Location**: `components/BuilderChat/BuilderMessageBubble.tsx`

## Implementation Order

1. ✓ Create `hooks/useStreamingUpdates.ts` (extract logic from BuilderChat:640-815)
2. ✓ Create `hooks/useAIHelpers.ts` (extract helper trigger logic)
3. ✓ Create `components/BuilderChat/MessageList.tsx` (pure rendering)
4. ✓ Create `components/BuilderChat/BuilderMessageBubble.tsx` (extract nested component)
5. ✓ Rewrite `BuilderChat.tsx` (orchestrator <150 lines)
6. ✓ Update imports in `BuilderPage.tsx`
7. ✓ Verify no feature loss (manual test: stream, edit mode, helpers, project mode)

## Dependency Verification Checklist

- [ ] BuilderChat.tsx main useEffect: ≤3 deps
- [ ] useStreamingUpdates: ≤12 deps (verified below line)
- [ ] useAIHelpers: ≤4 deps (verified below line)
- [ ] MessageList: ≤5 props (no callbacks except simple ones)
- [ ] No `useXxxStore.getState()` calls
- [ ] No cross-hook state sharing (data flows via props/callbacks only)

## Risk Assessment

**LOW**: This is a pure refactoring. No behavior changes, no new features.
- All existing functionality is preserved 1:1
- Same props, same return values
- Same imports, same external APIs

**Testing Plan**:
1. Dev server: does `npm run dev` start without errors?
2. Manual: Create artifact → edit → see preview
3. Manual: Create project → generate multiple files → apply
4. Manual: Enable helper, build → see helper trigger

## Files to Create
```
hooks/
  ├── useStreamingUpdates.ts (NEW)
  └── useAIHelpers.ts (NEW)

components/Builder/
  ├── BuilderChat.tsx (REWRITE - lines reduced from 1420 to <150)
  ├── BuilderMessageBubble.tsx (NEW - extracted from BuilderChat)
  ├── MessageList.tsx (NEW - extracted logic)
  └── [keep all other files]
```

## Files to Modify
```
components/Builder/BuilderPage.tsx  (update import paths)
```

---

**Status**: Plan APPROVED, ready for implementation.
