// @sarge/builder — Builder module, snaps onto @sarge/core
// Has its own isolated chat, artifact system, file ops, AI helpers

// ─── Stores ──────────────────────────────────────────────
export * from './stores/builderStore';
export * from './stores/builderDocumentStore';
export * from './stores/builderChatStore';
export * from './stores/artifactStore';
export * from './stores/builderModeStore';
export * from './stores/builderHelpersStore';
export * from './stores/changesStore';
export * from './stores/workspaceStore';
export * from './stores/previewStore';
export * from './stores/componentLibraryStore';
export * from './stores/complianceStore';

// ─── Components ──────────────────────────────────────────
export { default as AddHelperModal } from './components/AddHelperModal';
export { default as AICapabilitiesPanel } from './components/AICapabilitiesPanel';
export { default as AIHelpersSection } from './components/AIHelpersSection';
export { default as ArtifactCard } from './components/ArtifactCard';
export { default as ArtifactPanel } from './components/ArtifactPanel';
export { default as BuilderChat } from './components/BuilderChat';
export { BuilderCodeBlock } from './components/BuilderCodeBlock';
export { default as BuilderDiffEditor } from './components/BuilderDiffEditor';
export { BuilderErrorBoundary } from './components/BuilderErrorBoundary';
export { default as BuilderFileTree } from './components/BuilderFileTree';
export { default as BuilderMessageBubble } from './components/BuilderMessageBubble';
export { default as BuilderPage } from './components/BuilderPage';
export { default as BuilderProgress } from './components/BuilderProgress';
export { default as BuilderSidebar } from './components/BuilderSidebar';
export { default as BuilderTerminal } from './components/BuilderTerminal';
export { default as CapabilityStatusBar } from './components/CapabilityStatusBar';
export { default as ComponentLibrarySection } from './components/ComponentLibrarySection';
export { default as DependencyGraph } from './components/DependencyGraph';
export { default as EditCard } from './components/EditCard';
export { default as EditProgressPanel } from './components/EditProgressPanel';
export { default as FileActionCard } from './components/FileActionCard';
export { default as FileTree } from './components/FileTree';
export { default as HelperBubble } from './components/HelperBubble';
export { default as HelperCard } from './components/HelperCard';
export { default as MessageList } from './components/MessageList';
export { default as NewProjectModal } from './components/NewProjectModal';
export { default as ProgressCards } from './components/ProgressCards';
export { default as PromptGallery } from './components/PromptGallery';
export { default as RouterStatus } from './components/RouterStatus';
export { default as SaveToLibraryDialog } from './components/SaveToLibraryDialog';
export { default as SessionActivity } from './components/SessionActivity';
export { default as StreamingMessageRenderer } from './components/StreamingMessageRenderer';
export { default as TemplateCard } from './components/TemplateCard';
export { default as TemplatePickerPanel } from './components/TemplatePickerPanel';
export { default as CompliancePanel } from './components/CompliancePanel';

// ─── Hooks ───────────────────────────────────────────────
export * from './hooks/useStreamingUpdates';
export * from './hooks/useAIHelpers';
export * from './hooks/useAssetGenerator';

// ─── Lib ─────────────────────────────────────────────────
export * from './lib/editBlockParser';
export * from './lib/builderLogger';
export * from './lib/contentDetector';
export * from './lib/builderAutoRouter';
export * from './lib/helperPrompts';
export * from './lib/projectTemplates';
