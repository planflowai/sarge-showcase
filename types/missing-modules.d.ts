/**
 * Type stubs for modules that exist in sub-apps but can't be resolved
 * by the root tsconfig. Eliminates TS2307 errors in monorepo-wide tsc.
 *
 * - No-body declarations: modules with value-only imports (any named import = any)
 * - Bodied declarations: modules with type imports (types must be explicitly declared)
 *
 * Generated: 2026-03-05
 */

// ═══════════════════════════════════════════════════════════════════
// NO-BODY STUBS — @/ components (default exports, no type imports)
// ═══════════════════════════════════════════════════════════════════

declare module "@/components/Builder/TogglePanel";
declare module "@/components/JuryToast";
declare module "@/components/Trading/TradingDashboard";
declare module "@/components/benchmark/ForgeTrialsDashboard";
declare module "@/components/billing/BillingBar";
declare module "@/components/billing/ForgeBillingDashboard";
declare module "@/components/chat/WarRoomDashboard";
declare module "@/components/chat/WarRoomPopout" {
  export const WarRoomPopout: any;
}
declare module "@/components/deploy/DeployPanel";
declare module "@/components/env/EnvManager";
declare module "@/components/launcher/LauncherDashboard";
declare module "@/components/project/NewProjectWizard";
declare module "@/components/settings/ModelRoleTags";
declare module "@/components/workbench/WorkbenchDashboard";
declare module "@/components/workbench/WorkbenchPopout" {
  export const WorkbenchPopout: any;
}

// ═══════════════════════════════════════════════════════════════════
// NO-BODY STUBS — @/ lib modules (value exports only, no type imports)
// ═══════════════════════════════════════════════════════════════════

declare module "@/lib/accessibility/checker";
declare module "@/lib/analytics/injector";
declare module "@/lib/billingPopoutManager";
declare module "@/lib/calendly/injector";
declare module "@/lib/engine/engine";
declare module "@/lib/mailchimp/injector";
declare module "@/lib/performance/optimizer";
declare module "@/lib/pitBroadcastEngine";
declare module "@/lib/popoutManager";
declare module "@/lib/privacy/compliance";
declare module "@/lib/punchlist/injector";
declare module "@/lib/security/hardener";
declare module "@/lib/seo/optimizer";
declare module "@/lib/stores/benchmarkStore";
declare module "@/lib/stores/tradingStore";
declare module "@/lib/templates/helloPage";
declare module "@/lib/workbenchPopoutManager";

// ═══════════════════════════════════════════════════════════════════
// BODIED STUBS — modules with type imports (must declare types)
// ═══════════════════════════════════════════════════════════════════

declare module "@/lib/types/project" {
  export type ProjectMeta = any;
  export type ProjectToggles = any;
  export type ToggleConfig = any;
  export const DEFAULT_TOGGLES: any;
  export const TOGGLE_INFO: any;
}

declare module "@/lib/stores/deployStore" {
  export const useDeployStore: any;
  export type DeployTarget = any;
}

declare module "@/lib/stores/warRoomStore" {
  export const useWarRoomStore: any;
  export const MODE_SLOT_IDS: any;
  export type WarRoomMode = any;
  export type MonitorSlot = any;
  export type SlotStatus = any;
}

declare module "@/lib/stores/workbenchStore" {
  export const useWorkbenchStore: any;
  export type WorkbenchSlot = any;
  export type WorkbenchStatus = any;
}

declare module "@/lib/toggles/pipeline" {
  export const runTogglePipeline: any;
  export type ToggleResult = any;
  export type ToggleCheck = any;
  export type VerificationData = any;
  export type VerificationItem = any;
  export type WarningItem = any;
  export type ManualItem = any;
}

// ═══════════════════════════════════════════════════════════════════
// NO-BODY STUBS — @sarge/ sub-path modules (files exist, no sub-path exports)
// ═══════════════════════════════════════════════════════════════════

declare module "@sarge/builder/components/BuilderPage";
declare module "@sarge/builder/index.client";
declare module "@sarge/chat/components/forensic/ForensicLogView";
declare module "@sarge/chat/components/test/TestModeView";
declare module "@sarge/core/index.server" {
  export function validatePathWithinProject(projectRoot: string, filePath: string): any;
  export function validateTerminalCommand(command: string, projectPath?: string): any;
  export function logForensicEvent(entry: any): void;
  export function chatWithFallback(...args: any[]): Promise<any>;
  export const circuitBreaker: any;
  export const fallbackService: any;
  export function fetchOllamaModels(): Promise<any>;
  export function fetchLMStudioModels(): Promise<any>;
  export function groupOllamaModels(models: any): any;
  export function processQueuedItem(item: any): Promise<any>;
  export function fetchSupabaseBuilderLog(): Promise<any>;
}
declare module "@sarge/core/lib/utils/debouncedStorage";
declare module "@sarge/core/stores/airGapStore";
declare module "@sarge/diagnostics/components/DiagnosticsPage";

// @sarge/chat/index.client needs body for Attachment type
declare module "@sarge/chat/index.client" {
  export const ChatView: any;
  export const useConversationStore: any;
  export const useMessageStore: any;
  export const useDebateStore: any;
  export const useParallelChatStore: any;
  export const useBuilderPromptStore: any;
  export const ParallelChatView: any;
  export const ForensicLogView: any;
  export const TestModeView: any;
  export const ConversationList: any;
  export const DebateView: any;
  export const InputArea: any;
  export type Attachment = any;
}

// vitest — test framework (not installed in monorepo root)
declare module "vitest" {
  export const describe: any;
  export const it: any;
  export const expect: any;
  export const beforeEach: any;
  export const vi: any;
  export const test: any;
}

// ═══════════════════════════════════════════════════════════════════
// @sarge/core/providers/* — individual provider modules (used by diagnostics)
// ═══════════════════════════════════════════════════════════════════
declare module "@sarge/core/providers/anthropic";
declare module "@sarge/core/providers/deepseek";
declare module "@sarge/core/providers/google";
declare module "@sarge/core/providers/ollama";
declare module "@sarge/core/providers/openai";
declare module "@sarge/core/providers/xai";
