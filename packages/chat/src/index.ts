// @sarge/chat — Chat + multi-chat module, snaps onto @sarge/core

// ─── Stores ──────────────────────────────────────────────
export * from './stores/messageStore';
export * from './stores/conversationStore';
export * from './stores/parallelChatStore';
export * from './stores/debateStore';
export * from './stores/debateHistoryStore';

// ─── Components — Chat ──────────────────────────────────
export { ChatView, useBuilderPromptStore } from './components/chat/ChatView';
export { ChatColumn } from './components/chat/ChatColumn';
export { CodeBlock } from './components/chat/CodeBlock';
export { InputArea } from './components/chat/InputArea';
export { MessageBubble } from './components/chat/MessageBubble';
export { ParallelChatView } from './components/chat/ParallelChatView';
export { DebateBanner } from './components/chat/DebateBanner';
export { default as ThreadGuardianIndicator } from './components/chat/ThreadGuardianIndicator';
export { VaultAttachmentModal, getVaultDocumentsForContext } from './components/chat/VaultAttachmentModal';
export { VoiceButton } from './components/chat/VoiceButton';
export { VoiceIndicator } from './components/chat/VoiceIndicator';

// ─── Components — Conversation ──────────────────────────
export { ConversationList } from './components/conversation/ConversationList';

// ─── Components — Debate ────────────────────────────────
export { AgentPanel } from './components/debate/AgentPanel';
export { CollapsibleRow } from './components/debate/CollapsibleRow';
export { DebateHistory } from './components/debate/DebateHistory';
export { DebateView } from './components/debate/DebateView';
export { ExecutiveSummaryModal } from './components/debate/ExecutiveSummaryModal';
export { JudgePanel } from './components/debate/JudgePanel';
export { JudgeSummary } from './components/debate/JudgeSummary';
export { TruthAnchorsPanel } from './components/debate/TruthAnchorsPanel';

// ─── Components — Forensic ─────────────────────────────
export { ForensicLogView } from './components/forensic/ForensicLogView';
export { ForensicSidebar } from './components/forensic/ForensicSidebar';
export { TimelineView } from './components/forensic/TimelineView';
export { InvestigationView } from './components/forensic/InvestigationView';
export { ReplayView } from './components/forensic/ReplayView';
export { ExportView } from './components/forensic/ExportView';

// ─── Components — Test ─────────────────────────────────
export { TestModeView } from './components/test/TestModeView';
export { TestModeLLMSection } from './components/test/TestModeLLMSection';
export { BatchView } from './components/test/BatchView';
export { LiveConsolePanel } from './components/test/LiveConsolePanel';
export { LivePassColumn } from './components/test/LivePassColumn';

// ─── Lib — Debate Engine ────────────────────────────────
export * from './lib/debate/engine';

// ─── Lib — Hooks ────────────────────────────────────────
export * from './lib/hooks/useCapabilities';
export * from './lib/hooks/useNotification';
