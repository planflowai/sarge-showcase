// @sarge/chat — Chat + multi-chat module, snaps onto @sarge/core

// ─── Stores ──────────────────────────────────────────────
export * from './stores/messageStore';
export * from './stores/conversationStore';
export * from './stores/parallelChatStore';
export * from './stores/debateStore';
export * from './stores/debateHistoryStore';

// ─── Components — Chat ──────────────────────────────────
export { default as ChatView } from './components/chat/ChatView';
export { default as ChatColumn } from './components/chat/ChatColumn';
export { default as CodeBlock } from './components/chat/CodeBlock';
export { default as InputArea } from './components/chat/InputArea';
export { default as MessageBubble } from './components/chat/MessageBubble';
export { default as ParallelChatView } from './components/chat/ParallelChatView';
export { default as DebateBanner } from './components/chat/DebateBanner';
export { default as ThreadGuardianIndicator } from './components/chat/ThreadGuardianIndicator';
export { default as VaultAttachmentModal } from './components/chat/VaultAttachmentModal';
export { default as VoiceButton } from './components/chat/VoiceButton';
export { default as VoiceIndicator } from './components/chat/VoiceIndicator';

// ─── Components — Conversation ──────────────────────────
export { default as ConversationList } from './components/conversation/ConversationList';

// ─── Components — Debate ────────────────────────────────
export { default as AgentPanel } from './components/debate/AgentPanel';
export { default as CollapsibleRow } from './components/debate/CollapsibleRow';
export { default as DebateHistory } from './components/debate/DebateHistory';
export { default as DebateView } from './components/debate/DebateView';
export { default as ExecutiveSummaryModal } from './components/debate/ExecutiveSummaryModal';
export { default as JudgePanel } from './components/debate/JudgePanel';
export { default as JudgeSummary } from './components/debate/JudgeSummary';
export { default as TruthAnchorsPanel } from './components/debate/TruthAnchorsPanel';

// ─── Lib — Debate Engine ────────────────────────────────
export * from './lib/debate/engine';

// ─── Lib — Hooks ────────────────────────────────────────
export * from './lib/hooks/useCapabilities';
export * from './lib/hooks/useNotification';
