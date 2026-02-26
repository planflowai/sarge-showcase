# Zustand Stores Reference — SARGE Platform

All 43 stores, state fields, and persistence methods.

---

## Chat & Conversation (4 stores)

### messageStore
- **File:** `lib/stores/messageStore.ts`
- **Persistence:** localStorage (persist middleware)
- **Key Fields:**
  - `messages: Message[]`
  - `currentConversationId: string`
  - `addMessage(msg: Message)`
  - `updateMessage(id, content)`
  - `deleteMessage(id)`
- **Used By:** ChatView, MessageList, Journal
- **Max Size:** Trim at 1000 messages per conversation

### conversationStore
- **File:** `lib/stores/conversationStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `conversations: Conversation[]`
  - `currentConversationId: string | null`
  - `createConversation()`
  - `deleteConversation(id)`
  - `renameConversation(id, name)`
  - `switchConversation(id)`
- **Used By:** ChatView, Header
- **Auto-create:** One conversation created on first visit

### draftStore
- **File:** `lib/stores/draftStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `draft: string`
  - `setDraft(text)`
  - `clearDraft()`
- **Used By:** InputArea
- **Purpose:** Auto-save user typing before submission

### parallelChatStore
- **File:** `lib/stores/parallelChatStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `parallelModeEnabled: boolean`
  - `columns: Column[]` (up to 4, each with model selection)
  - `results: ChatResult[]`
  - `toggleParallelMode()`
  - `addColumn(model)`
  - `removeColumn(index)`
- **Used By:** ParallelChatView
- **Purpose:** Side-by-side multi-model comparison

---

## Model & Provider (8 stores)

### modelStore
- **File:** `lib/stores/modelStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `currentModel: string` (model ID)
  - `customModels: CustomModel[]`
  - `modelNicknames: Map<string, string>`
  - `builderTags: Map<string, boolean>`
  - `voicePersona: Map<string, string>`
  - `setCurrentModel(id)`
  - `addCustomModel(config)`
  - `setBuilderTag(modelId, enabled)`
- **Used By:** Header model selector, settings
- **Builder Models:** All cloud + local code models (qwen2.5-coder, deepseek-coder, etc.)

### modelRegistryStore
- **File:** `lib/stores/modelRegistryStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `registry: ModelConfig[]`
  - `maxTokens: Map<string, number>`
  - `contextWindow: Map<string, number>`
  - `temperature: Map<string, number>`
  - `setModelConfig(modelId, config)`
- **Used By:** Settings → Model Registry
- **Purpose:** Detailed per-model configuration

### providerStore
- **File:** `lib/stores/providerStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `providers: Provider[]`
  - `apiKeys: Map<string, string>`
  - `enabled: Map<string, boolean>`
  - `setApiKey(provider, key)`
  - `toggleProvider(provider)`
- **Used By:** Settings, chat routing
- **Providers:** anthropic, openai, google, xai, deepseek, ollama, lmstudio

### settingsStore
- **File:** `lib/stores/settingsStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `theme: 'light' | 'dark'`
  - `defaultProvider: string`
  - `defaultModel: string`
  - `localEndpoint: string` (Ollama URL override)
  - `setTheme(theme)`
  - `setDefaultModel(modelId)`
- **Used By:** Header (theme toggle), chat routing
- **Defaults:** dark theme, Anthropic provider

### aiModeStore
- **File:** `lib/stores/aiModeStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `mode: 'standard' | 'expert' | 'creative'`
  - `flowType: 'direct' | 'chain-of-thought' | 'debate'`
  - `agentConfigs: AgentConfig[]`
  - `presets: Preset[]`
  - `setMode(mode)`
  - `setFlowType(type)`
- **Used By:** Settings → AI Orchestration
- **Purpose:** AI behavior configuration

### saasStore
- **File:** `lib/stores/saasStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `providers: SaaSProvider[]`
  - `keyConfigs: Map<string, KeyConfig>`
  - `setKeyConfig(provider, config)`
- **Used By:** Settings → Trading APIs, Research
- **Providers:** Tavily, Finnhub, Alpaca, Brave, Google Search

### unifiedCapabilitiesStore
- **File:** `lib/stores/unifiedCapabilitiesStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `capabilities: Map<string, Capability>`
  - `modelCapabilities: Map<string, string[]>` (e.g., 'builder', 'judge', 'analyzer')
  - `queryCapability(modelId, capability)`
- **Used By:** Model selector, capability routing
- **Purpose:** Fast lookup of model capabilities

### fallbackStore
- **File:** `lib/stores/fallbackStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `fallbackChain: string[]` (ordered provider IDs)
  - `retryHistory: Map<string, number>` (failures per provider)
  - `setFallbackChain(chain)`
  - `logFailure(provider)`
- **Used By:** /api/chat routing
- **Purpose:** Failure tracking and chain management

---

## Builder (6 stores)

### builderStore
- **File:** `lib/stores/builderStore.ts`
- **Persistence:** localStorage (debounced)
- **Key Fields:**
  - `projectPath: string | null`
  - `projectName: string | null`
  - `fileTree: FileNode[]`
  - `currentFilePath: string | null`
  - `currentFileContent: string`
  - `currentFileLanguage: string`
  - `isDirty: boolean`
  - `expandedFolders: string[]`
  - `autoApply: boolean` (auto-apply file changes without confirmation)
  - `hydrated: boolean`
  - `setProject(path, name, tree)`
  - `clearProject()`
  - `setFileTree(tree)`
  - `setCurrentFile(path, content, language)`
  - `updateCurrentContent(content)`
  - `setAutoApply(enabled)`
  - `toggleAutoApply()`
- **Used By:** BuilderPage, FileExplorer, BuilderChat
- **Purpose:** Project state, file navigation, auto-apply toggle

### builderChatStore
- **File:** `lib/stores/builderChatStore.ts`
- **Persistence:** localStorage (debounced)
- **Key Fields:**
  - `messages: BuilderMessage[]` (isolated from main chat)
  - `isStreaming: boolean`
  - `streamingMessageId: string | null`
  - `addMessage(msg)`
  - `updateMessage(id, content)`
  - `updateStreamingMessage(id, content)`
  - `sendMessage(content, model, provider, options)`
- **Used By:** BuilderChat component
- **Purpose:** Isolated chat for builder mode (separate from main chat), with streaming support and Thread Guardian integration

### artifactStore
- **File:** `lib/stores/artifactStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `artifacts: Artifact[]`
  - `currentArtifact: Artifact | null`
  - `versions: ArtifactVersion[]` (max 10 per artifact)
  - `createArtifact(code, language, title)`
  - `updateArtifact(id, code)`
  - `addVersion(artifactId, code)`
  - `getVersion(artifactId, versionNum)`
- **Used By:** ArtifactPanel, BuilderChat
- **Max Versions:** 10 per artifact (from lib/constants.ts)

### builderModeStore
- **File:** `lib/stores/builderModeStore.ts`
- **Persistence:** localStorage (version 3, with migration)
- **Key Fields:**
  - `mode: 'plan' | 'build'` (plan = discussion only, build = code generation)
  - `editMode: 'edit' | 'generate'` (edit = surgical EDIT blocks, generate = full file)
  - `autoRouterEnabled: boolean` (auto-route to optimal model)
  - `modelPreference: 'cost' | 'quality'` (auto-router optimization target)
  - `hydrated: boolean`
  - `setMode(mode)`, `toggleMode()`
  - `setEditMode(editMode)`, `toggleEditMode()`
  - `setAutoRouterEnabled(enabled)`
  - `setModelPreference(pref)`, `toggleModelPreference()`
- **Exports:**
  - `BUILDER_SYSTEM_PROMPTS` — plan/build mode system prompts
  - `EDIT_MODE_SYSTEM_PROMPT` — surgical edit format instructions
  - `getBuilderSystemPrompt(mode, isProjectMode)` — returns appropriate prompt
  - `buildEditModePrompt(currentCode, userMessage)` — wraps code with line numbers for edit mode
  - `getEditModeSystemPrompt()` — returns edit mode prompt
- **Used By:** BuilderPage, BuilderChat (mode selection + prompt generation)
- **Purpose:** Builder mode state (plan/build), edit mode (edit/generate), auto-router preferences

### builderDocumentStore
- **File:** `lib/stores/builderDocumentStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `openDocuments: DocumentTab[]`
  - `activeTabId: string`
  - `addDocument(file)`
  - `closeDocument(tabId)`
  - `switchTab(tabId)`
- **Status:** Placeholder (Phase 5 multi-tab editor)
- **Purpose:** Future multi-tab editor support

### componentLibraryStore
- **File:** `lib/stores/componentLibraryStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `components: Component[]`
  - `categories: Category[]`
  - `favorites: string[]` (component IDs)
  - `addComponent(comp)`
  - `toggleFavorite(compId)`
  - `importComponents(json)`
  - `exportComponents()`
- **Used By:** Component Library page, Builder insertable components
- **Purpose:** Reusable code component repository

---

## Testing & Debate (5 stores)

### testModeStore
- **File:** `lib/stores/testModeStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `testCases: TestCase[]`
  - `questions: SavedQuestion[]`
  - `poisons: SavedPoison[]`
  - `isRunning: boolean`
  - `showingTestMode: boolean` / `testModeHidden: boolean`
  - `batchModeActive: boolean` / `batchRunning: boolean` / `batchPaused: boolean`
  - `batchCurrentPass: number` / `batchCurrentTest: number`
  - `batchProgress: number` / `batchTotalTests: number`
  - `batchId: string`
  - `batchPassLogs: BatchPassLog[]`
  - `batchEvents: EnhancedForensicEvent[]`
  - `batchActivity: string`
  - `batchHistory: BatchHistoryEntry[]` (persisted batch archives)
  - `sessionStats: SessionStats`
  - `debateLogic: DebateLogicTemplates` (D1/D2/D3/Judge prompts, poison injection, keyword detection)
- **Types:** `TestCase`, `BatchHistoryEntry`, `DebateLogicTemplates`
- **Used By:** Test Mode UI, Library, Batch Mode, Review
- **Purpose:** Full test mode state including batch execution, history, forensic events, and debate logic templates

### debateStore
- **File:** `lib/stores/debateStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `debate: Debate | null`
  - `showingSetup: boolean`
  - `debateHidden: boolean`
  - `agents: Agent[]` (D1, D2, D3, Judge)
  - `transcript: Message[]`
  - `verdict: Verdict | null`
  - `currentRound: number`
  - `openDebate()`
  - `hideDebate()`
  - `showDebate()`
  - `addMessage(msg, agent)`
  - `setVerdict(verdict)`
- **Used By:** Debate Arena, Header
- **Purpose:** Multi-agent debate state and management

### debateHistoryStore
- **File:** `lib/stores/debateHistoryStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `debates: DebateRecord[]`
  - `verdicts: Verdict[]`
  - `summaries: DabateSummary[]`
  - `exportData: string` (JSON/CSV)
  - `addDebate(debate)`
  - `addVerdict(verdict)`
  - `exportAsJSON()`
  - `exportAsCSV()`
- **Used By:** Review, AI Analysis, History pages
- **Purpose:** Persistent debate transcript archive

### journalStore
- **File:** `lib/stores/journalStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `entries: JournalEntry[]`
  - `notes: string`
  - `effectiveness: Map<string, number>` (ratings per entry)
  - `aiAnalysis: string`
  - `addEntry(entry)`
  - `updateNotes(text)`
  - `rateEntry(entryId, score)`
- **Used By:** Journal page, AI Analysis
- **Purpose:** Prompt effectiveness tracking and analysis

### aiAnalysisStore
- **File:** `lib/stores/aiAnalysisStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `analyses: Analysis[]`
  - `debateAnalysis: string[]` (max 10)
  - `batchAnalysis: string[]` (max 20)
  - `forensicAnalysis: string[]` (max 500)
  - `addAnalysis(type, content)`
- **Used By:** AI Analysis page
- **Limits:** 10 debate, 20 batch, 500 forensic entries

---

## Security & Monitoring (5 stores)

### threadGuardianStore
- **File:** `lib/stores/threadGuardianStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `ledger: FactEntry[]` (per-conversation facts + contradictions)
  - `facts: Fact[]` (max 500)
  - `contradictions: Contradiction[]`
  - `hallucinations: Hallucination[]`
  - `savePoints: SavePoint[]` (max 10)
  - `tierConfigs: TierConfig[]` (Tier 1/2/3 settings)
  - `addFact(fact)`
  - `flagContradiction(fact1, fact2)`
  - `createSavePoint(snapshot)`
- **Used By:** Background Guardian process, chat UI
- **Max Facts:** 500
- **Max Save Points:** 10

### juryGuardianStore
- **File:** `lib/stores/juryGuardianStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `juryResults: JuryResult[]`
  - `activeFacts: Fact[]` (max 50)
  - `savePoints: SavePoint[]` (max 10)
  - `echoAlerts: Alert[]` (max 20)
  - `addJuryResult(result)`
  - `logEchoAlert(alert)`
- **Used By:** Jury Guardian, Debate Arena
- **Limits:** 50 facts, 10 save points, 20 alerts

### forensicLogStore
- **File:** `lib/stores/forensicLogStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `showingForensicLog: boolean`
  - `events: ForensicEvent[]` (blockchain-style hash chain)
  - `timeline: TimelineEvent[]`
  - `replayState: ReplayState`
  - `openForensicLog()`
  - `closeForensicLog()`
  - `logEvent(event)`
  - `exportTimeline()`
- **Used By:** Forensic Log view, Builder (write ops)
- **Purpose:** Immutable audit trail of all operations

### pinStore
- **File:** `lib/stores/pinStore.ts`
- **Persistence:** localStorage (hashed)
- **Key Fields:**
  - `pinHash: string` (SHA-256)
  - `unlocked: boolean`
  - `lastActivityTime: number`
  - `autoLockTimeout: number` (30 min default)
  - `setPIN(pin)`
  - `verifyPIN(pin)`
  - `lock()`
  - `unlock()`
- **Used By:** PinLock component
- **Security:** 30-minute auto-lock

### airGapStore
- **File:** `lib/stores/airGapStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `airGapEnabled: boolean`
  - `secureMode: boolean`
  - `networkStatus: 'online' | 'offline'`
  - `toggleAirGap()`
  - `toggleSecureMode()`
  - `checkNetwork()`
- **Used By:** Header (toggle buttons), routing
- **Purpose:** Network isolation and security mode management

---

## Content & Knowledge (5 stores)

### vaultStore
- **File:** `lib/stores/vaultStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `files: File[]`
  - `totalSize: number`
  - `maxSize: number` (50MB)
  - `addFile(file)`
  - `deleteFile(id)`
  - `updateMetadata(id, metadata)`
  - `uploadFile(file)`
- **Used By:** Vault page
- **Limits:** 50MB total, 10MB per file

### knowledgeStore
- **File:** `lib/stores/knowledgeStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `documents: Document[]`
  - `addDocument(doc)`
  - `deleteDocument(id)`
  - `hydrate()` (manual hydration pattern)
- **Used By:** Settings → Knowledge, chat context injection
- **Purpose:** Knowledge vault documents for AI context

### promptStore
- **File:** `lib/stores/promptStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `prompts: SavedPrompt[]`
  - `savePrompt(name, content)`
  - `deletePrompt(id)`
  - `usePrompt(id)` (insert into input)
- **Used By:** Settings, InputArea
- **Purpose:** User-saved prompt templates

### promptLibraryStore
- **File:** `lib/stores/promptLibraryStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `library: LibraryItem[]`
  - `tiers: { easy, hard, batch, cloud }`
  - `addItem(tier, item)`
  - `deleteItem(id)`
  - `getTierItems(tier)`
- **Used By:** Prompt Library page, Test Mode
- **Purpose:** Organized test questions and poison pills

### roleStore
- **File:** `lib/stores/roleStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `roles: Role[]`
  - `addRole(name, systemPrompt)`
  - `deleteRole(id)`
  - `updateRole(id, config)`
- **Used By:** Settings → Roles, Debate Arena
- **Purpose:** Custom role definitions with system prompts

---

## UI & Infrastructure (5 stores)

### uiStore
- **File:** `lib/stores/uiStore.ts`
- **Persistence:** In-memory (not persisted)
- **Key Fields:**
  - `toasts: Toast[]`
  - `modals: Modal[]`
  - `loading: boolean`
  - `addToast(message, type)` (5s default)
  - `openModal(content)`
  - `closeModal(id)`
  - `setLoading(loading)`
- **Used By:** GlobalToast, GlobalToast components
- **Purpose:** Global UI notifications

### syncStatusStore
- **File:** `lib/stores/syncStatusStore.ts`
- **Persistence:** In-memory
- **Key Fields:**
  - `syncing: boolean`
  - `lastSyncTime: number | null`
  - `syncError: string | null`
  - `setSyncing(syncing)`
  - `setSyncTime(time)`
  - `setSyncError(error)`
- **Used By:** Header (status indicator)
- **Purpose:** Supabase sync status tracking

### diagnosticsStore
- **File:** `lib/stores/diagnosticsStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `findings: Finding[]`
  - `snapshots: Snapshot[]` (max 50)
  - `changelog: ChangeLog[]`
  - `undoStack: UndoState[]` (max 10)
  - `scanCodebase()`
  - `createSnapshot()`
  - `rollback(snapshotId)`
  - `exportChangelog()`
- **Used By:** Diagnostics page
- **Limits:** 50 snapshots, 10 undo levels

### workspaceStore
- **File:** `lib/stores/workspaceStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `projects: Project[]`
  - `currentProject: Project | null`
  - `layout: LayoutConfig`
  - `addProject(project)`
  - `switchProject(id)`
- **Status:** Placeholder (Phase 5)
- **Purpose:** Multi-project workspace management

### feedbackStore
- **File:** `lib/stores/feedbackStore.ts`
- **Persistence:** localStorage
- **Key Fields:**
  - `feedbacks: Feedback[]`
  - `ratings: Map<string, number>`
  - `submitFeedback(message, rating)`
- **Status:** Optional feedback collection
- **Purpose:** User feedback and telemetry (privacy-respecting)

---

## Store Usage Summary

| Store | Owner Component | Read By |
|-------|-----------------|---------|
| messageStore | ChatView | MessageList, ParallelChatView |
| conversationStore | ChatView | Header, Sidebar |
| modelStore | Header | Chat routing, Settings |
| testModeStore | TestModeView | Test UI, Library, Batch Mode |
| debateStore | Header/Chat | Debate UI, Chat overlay |
| builderStore | BuilderPage | FileExplorer, BuilderChat |
| artifactStore | ArtifactPanel | BuilderChat, Preview |
| threadGuardianStore | Background Guardian | Chat UI, Analysis |
| vaultStore | VaultPage | Vault UI, Chat attachments |

---

Generated from codebase analysis
Last updated: 2026-02-25
