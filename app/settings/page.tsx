"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useRoleStore } from "@/lib/stores/roleStore";
import { usePinStore } from "@/lib/stores/pinStore";
import { useModelStore, type EffectiveModel } from "@/lib/stores/modelStore";
import { usePromptStore } from "@/lib/stores/promptStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { providers } from "@/lib/providers";
import { fetchOllamaModels, fetchLMStudioModels, type LocalModel } from "@/lib/providers/localModels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Trash2, Plus, Pencil, Lock, LockOpen, Shield,
  Settings, Cpu, MessageSquare, ShieldCheck, ChevronDown, ChevronRight, Loader2,
  Database, FileText, RefreshCw, Radio,
  Hammer, Zap, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ModelRegistry } from "@/components/settings/ModelRegistry";
import { inputCls, textareaCls, cardCls, dashedCardCls } from "@/components/settings/settingsStyles";
const SettingsOrchestration = dynamic(
  () => import("@/components/settings/SettingsOrchestration"),
  { loading: () => <div className="animate-pulse text-xs text-zinc-400 py-8 text-center">Loading orchestration settings…</div> }
);
const SettingsTradingAPIs = dynamic(
  () => import("@/components/settings/SettingsTradingAPIs").then((m) => ({ default: m.SettingsTradingAPIs })),
  { loading: () => <div className="animate-pulse text-xs text-zinc-400 py-8 text-center">Loading trading settings…</div> }
);
const SettingsLogicEditor = dynamic(
  () => import("@/components/settings/SettingsLogicEditor").then((m) => ({ default: m.SettingsLogicEditor })),
  { loading: () => <div className="animate-pulse text-xs text-zinc-400 py-8 text-center">Loading logic editor…</div> }
);
const SettingsKnowledge = dynamic(
  () => import("@/components/settings/SettingsKnowledge").then((m) => ({ default: m.SettingsKnowledge })),
  { loading: () => <div className="animate-pulse text-xs text-zinc-400 py-8 text-center">Loading knowledge vault…</div> }
);
import { RollCall } from "@/components/settings/RollCall";
import { useThreadGuardianStore } from "@/lib/stores/threadGuardianStore";
import {
  DEFAULT_TIER1_CONFIG,
  DEFAULT_TIER2_CONFIG,
  DEFAULT_TIER3_CONFIG,
  type TierConfig,
} from "@/lib/types/threadGuardian";

type Section = "general" | "models" | "registry" | "rollcall" | "orchestration" | "roles" | "prompts" | "security" | "knowledge" | "logic" | "questions" | "poisons" | "sync" | "guardian" | "trading" | "build-docs";

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "models", label: "Models", icon: Cpu },
  { id: "registry", label: "Model Registry", icon: Database },
  { id: "rollcall", label: "Roll Call", icon: Radio },
  { id: "orchestration", label: "AI Orchestration", icon: Zap },
  { id: "guardian", label: "Thread Guardian", icon: Shield },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "prompts", label: "Prompts", icon: MessageSquare },
  { id: "knowledge", label: "Knowledge", icon: Database },
  { id: "trading", label: "Trading APIs", icon: TrendingUp },
  { id: "logic", label: "Logic Editor", icon: FileText },
  { id: "questions", label: "Questions", icon: MessageSquare },
  { id: "poisons", label: "Poisons", icon: Shield },
  { id: "build-docs", label: "Build Docs", icon: FileText },
  { id: "security", label: "Security", icon: ShieldCheck },
];

// Shared style constants are imported from @/components/settings/settingsStyles

// Thread Guardian Settings Component
function ThreadGuardianSettings() {
  const {
    enabled,
    scope,
    tier1Config,
    tier2Config,
    tier3Config,
    setEnabled,
    updateTierConfig,
    getStats,
    clearAllLedgers,
    activeConversationId,
  } = useThreadGuardianStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const rawStats = activeConversationId ? getStats(activeConversationId) : null;

  // Map the per-conversation stats to the UI expected format
  const stats = {
    totalFacts: rawStats?.factCount || 0,
    totalContradictions: rawStats?.contradictionCount || 0,
    totalHallucinations: rawStats?.hallucinationCount || 0,
    totalSavePoints: rawStats?.hasSavePoint ? 1 : 0,
    activeConversations: activeConversationId ? 1 : 0,
    totalTier1Runs: rawStats?.lastTier1Run ? 1 : 0,
    totalTier2Runs: rawStats?.lastTier2Run ? 1 : 0,
    totalTier3Runs: rawStats?.lastTier3Run ? 1 : 0,
  };

  const handleTierConfigChange = (
    tier: 1 | 2 | 3,
    field: keyof TierConfig,
    value: string | number | boolean
  ) => {
    updateTierConfig(tier, { [field]: value });
  };

  const resetTierToDefaults = (tier: 1 | 2 | 3) => {
    const defaults = tier === 1 ? DEFAULT_TIER1_CONFIG : tier === 2 ? DEFAULT_TIER2_CONFIG : DEFAULT_TIER3_CONFIG;
    updateTierConfig(tier, defaults);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Thread Guardian</h2>
        <p className="mb-4 text-xs font-medium text-zinc-600 dark:text-zinc-500">
          Background conversation maintenance system. Monitors threads for facts, contradictions, hallucinations, and topic drift.
        </p>
      </div>

      {/* Master Toggle */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-500" />
          Master Control
        </h3>
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">Enable Thread Guardian</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Runs background analysis on Chat, Builder, and Architect conversations
              </div>
            </div>
            <Button
              variant={enabled ? "secondary" : "ghost"}
              onClick={() => setEnabled(!enabled)}
              className={enabled ? "bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/30" : ""}
            >
              {enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-500" />
          Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cardCls}>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalFacts}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Facts Indexed</div>
          </div>
          <div className={cardCls}>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.totalContradictions}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Contradictions</div>
          </div>
          <div className={cardCls}>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.totalHallucinations}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Hallucinations</div>
          </div>
          <div className={cardCls}>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalSavePoints}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Save Points</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Active on {stats.activeConversations} conversation{stats.activeConversations !== 1 ? "s" : ""}</span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span>{stats.totalTier1Runs + stats.totalTier2Runs + stats.totalTier3Runs} total runs across all tiers</span>
        </div>
      </section>

      {/* Tier 1 Configuration */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-500" />
            Tier 1 — Fast Indexing
          </h3>
          <Button variant="ghost" size="sm" onClick={() => resetTierToDefaults(1)} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Reset to Defaults
          </Button>
        </div>
        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Model</label>
              <Input
                value={tier1Config.model}
                onChange={(e) => handleTierConfigChange(1, "model", e.target.value)}
                placeholder="phi3:mini"
                className={`text-sm ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Provider</label>
              <select
                value={tier1Config.provider}
                onChange={(e) => handleTierConfigChange(1, "provider", e.target.value)}
                className={`w-full rounded border px-2 py-1.5 text-sm ${inputCls}`}
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Interval (minutes)</label>
              <Input
                type="number"
                value={Math.round(tier1Config.intervalMs / 60000)}
                onChange={(e) => handleTierConfigChange(1, "intervalMs", (parseInt(e.target.value) || 2) * 60000)}
                min={1}
                max={30}
                className={`text-sm ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Token Capacity</label>
              <Input
                type="number"
                value={tier1Config.maxTokenCapacity}
                onChange={(e) => handleTierConfigChange(1, "maxTokenCapacity", parseInt(e.target.value) || 4000)}
                min={1000}
                max={32000}
                step={1000}
                className={`text-sm ${inputCls}`}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Fast, cheap model for basic fact extraction. Runs every {Math.round(tier1Config.intervalMs / 60000)} minutes.
          </p>
        </div>
      </section>

      {/* Tier 2 Configuration */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-500" />
            Tier 2 — Deep Analysis
          </h3>
          <Button variant="ghost" size="sm" onClick={() => resetTierToDefaults(2)} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Reset to Defaults
          </Button>
        </div>
        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Model</label>
              <Input
                value={tier2Config.model}
                onChange={(e) => handleTierConfigChange(2, "model", e.target.value)}
                placeholder="phi4:latest"
                className={`text-sm ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Provider</label>
              <select
                value={tier2Config.provider}
                onChange={(e) => handleTierConfigChange(2, "provider", e.target.value)}
                className={`w-full rounded border px-2 py-1.5 text-sm ${inputCls}`}
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Interval (minutes)</label>
              <Input
                type="number"
                value={Math.round(tier2Config.intervalMs / 60000)}
                onChange={(e) => handleTierConfigChange(2, "intervalMs", (parseInt(e.target.value) || 10) * 60000)}
                min={5}
                max={60}
                className={`text-sm ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Token Capacity</label>
              <Input
                type="number"
                value={tier2Config.maxTokenCapacity}
                onChange={(e) => handleTierConfigChange(2, "maxTokenCapacity", parseInt(e.target.value) || 8000)}
                min={2000}
                max={64000}
                step={1000}
                className={`text-sm ${inputCls}`}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Smarter model for contradiction detection and hallucination flagging. Runs every {Math.round(tier2Config.intervalMs / 60000)} minutes.
          </p>
        </div>
      </section>

      {/* Tier 3 Configuration */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-500" />
            Tier 3 — Save Points
          </h3>
          <Button variant="ghost" size="sm" onClick={() => resetTierToDefaults(3)} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Reset to Defaults
          </Button>
        </div>
        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Model</label>
              <Input
                value={tier3Config.model}
                onChange={(e) => handleTierConfigChange(3, "model", e.target.value)}
                placeholder="claude-sonnet-4-20250514"
                className={`text-sm ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Provider</label>
              <select
                value={tier3Config.provider}
                onChange={(e) => handleTierConfigChange(3, "provider", e.target.value)}
                className={`w-full rounded border px-2 py-1.5 text-sm ${inputCls}`}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Interval (hours)</label>
              <Input
                type="number"
                value={Math.round(tier3Config.intervalMs / 3600000)}
                onChange={(e) => handleTierConfigChange(3, "intervalMs", (parseFloat(e.target.value) || 4) * 3600000)}
                min={1}
                max={24}
                step={0.5}
                className={`text-sm ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Token Capacity</label>
              <Input
                type="number"
                value={tier3Config.maxTokenCapacity}
                onChange={(e) => handleTierConfigChange(3, "maxTokenCapacity", parseInt(e.target.value) || 32000)}
                min={8000}
                max={200000}
                step={1000}
                className={`text-sm ${inputCls}`}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Frontier model for comprehensive save points. Creates restoration checkpoints every {Math.round(tier3Config.intervalMs / 3600000)} hours.
          </p>
        </div>
      </section>

      {/* Scope Settings */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Settings className="h-4 w-4 text-indigo-500" />
          Scope
        </h3>
        <div className={cardCls}>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Thread Guardian runs ONLY on conversational modes. It never runs on controlled environments like Debate, Test, Batch, Forensic, or Diagnostics.
          </p>
          <div className="flex flex-wrap gap-2">
            {scope.allowedModes.map((mode) => (
              <span
                key={mode}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              >
                {mode}
              </span>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-wrap gap-2">
              {scope.excludedModes.map((mode) => (
                <span
                  key={mode}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                >
                  {mode} (excluded)
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Danger Zone
        </h3>
        <div className={`${cardCls} border-red-300 dark:border-red-700/30`}>
          {showClearConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                Are you sure? This will delete ALL guardian data across all conversations:
              </p>
              <ul className="text-xs text-zinc-500 dark:text-zinc-400 list-disc ml-4 space-y-1">
                <li>All indexed facts</li>
                <li>All detected contradictions</li>
                <li>All flagged hallucinations</li>
                <li>All save points</li>
                <li>All model attributions</li>
              </ul>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    clearAllLedgers();
                    setShowClearConfirm(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Yes, Delete Everything
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">Clear All Guardian Data</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Permanently delete all facts, contradictions, hallucinations, and save points
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("general");

  // Test Mode Store (for questions, poisons)
  const questions = useTestModeStore((s) => s.questions);
  const poisons = useTestModeStore((s) => s.poisons);
  const addQuestion = useTestModeStore((s) => s.addQuestion);
  const updateQuestion = useTestModeStore((s) => s.updateQuestion);
  const removeQuestion = useTestModeStore((s) => s.removeQuestion);
  const addPoison = useTestModeStore((s) => s.addPoison);
  const updatePoison = useTestModeStore((s) => s.updatePoison);
  const removePoison = useTestModeStore((s) => s.removePoison);

  const {
    theme, defaultProvider, defaultModel, localEndpoint, buildDocsAutoInject,
    hydrated, hydrate, setTheme, setDefaultProvider, setDefaultModel, setLocalEndpoint, setBuildDocsAutoInject,
  } = useSettingsStore();

  const { roles, hydrated: rolesHydrated, hydrate: hydrateRoles, addRole, updateRole, deleteRole } = useRoleStore();
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePrompt, setNewRolePrompt] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRolePrompt, setEditRolePrompt] = useState("");

  const { pinEnabled, hydrated: pinHydrated, hydrate: hydratePin, setPin: storePinSet, removePin } = usePinStore();
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");

  const { hydrated: modelsHydrated, hydrate: hydrateModels, addModel, removeModel, getEffectiveModels, nicknames, setNickname, removeNickname, getDisplayName, voicePersona, setVoicePersona, builderFlags, setBuilderFlag, isBuilderModel } = useModelStore();
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState("");

  // Ollama live models
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  // LM Studio live models
  const [lmstudioModels, setLmstudioModels] = useState<LocalModel[]>([]);
  const [lmstudioLoading, setLmstudioLoading] = useState(false);
  const [lmstudioError, setLmstudioError] = useState<string | null>(null);

  const { prompts, hydrated: promptsHydrated, hydrate: hydratePrompts, addPrompt, updatePrompt, deletePrompt } = usePromptStore();
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptContent, setEditPromptContent] = useState("");

  // Reverse sync state
  const [reverseSyncing, setReverseSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncSuccess, setSyncSuccess] = useState(false);

  // AI Mode Orchestration state has been moved into SettingsOrchestration.tsx

  useEffect(() => {
    if (!hydrated) hydrate();
    if (!rolesHydrated) hydrateRoles();
    if (!pinHydrated) hydratePin();
    if (!modelsHydrated) hydrateModels();
    if (!promptsHydrated) hydratePrompts();
  }, [hydrated, hydrate, rolesHydrated, hydrateRoles, pinHydrated, hydratePin, modelsHydrated, hydrateModels, promptsHydrated, hydratePrompts]);

  // Fetch live Ollama models when the Ollama card is expanded
  useEffect(() => {
    if (expandedProvider !== "ollama") return;
    setOllamaLoading(true);
    setOllamaError(null);
    fetchOllamaModels()
      .then((models) => setOllamaModels(models))
      .catch(() => { setOllamaModels([]); setOllamaError("Cannot reach Ollama. Make sure it's running."); })
      .finally(() => setOllamaLoading(false));
  }, [expandedProvider]);

  // Fetch live LM Studio models when the LM Studio card is expanded
  useEffect(() => {
    if (expandedProvider !== "lmstudio") return;
    setLmstudioLoading(true);
    setLmstudioError(null);
    fetchLMStudioModels()
      .then((models) => setLmstudioModels(models))
      .catch(() => { setLmstudioModels([]); setLmstudioError("Cannot reach LM Studio. Make sure it's running on port 1240."); })
      .finally(() => setLmstudioLoading(false));
  }, [expandedProvider]);

  const apiKeyLabels: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_API_KEY",
    xai: "XAI_API_KEY",
  };

  // For Ollama/LM Studio, show live models; for cloud, show effective (built-in + custom)
  const getModelsForDisplay = (providerId: string): (EffectiveModel | { id: string; name: string; isBuiltIn: boolean; provider: string })[] => {
    if (providerId === "ollama") {
      return ollamaModels.map((m) => ({ id: m.id, name: m.name, provider: "ollama", isBuiltIn: false }));
    }
    if (providerId === "lmstudio") {
      return lmstudioModels.map((m) => ({ id: m.id, name: m.name, provider: "lmstudio", isBuiltIn: false }));
    }
    return getEffectiveModels(providerId);
  };

  const handleReverseSync = async () => {
    setReverseSyncing(true);
    setSyncMessage("");

    try {
      const response = await fetch("/api/sync/reverse", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        setSyncMessage("✓ Reverse sync completed successfully. Sandbox is now up-to-date.");
        setSyncSuccess(true);
      } else {
        setSyncMessage(`✗ Sync failed: ${data.error || data.message}`);
        setSyncSuccess(false);
      }
    } catch (error: any) {
      setSyncMessage(`✗ Error: ${error.message}`);
      setSyncSuccess(false);
    } finally {
      setReverseSyncing(false);
    }
  };

  return (
    <div className="flex h-full gap-0">
      {/* Left nav */}
      <nav className="w-64 flex-shrink-0 px-6 py-6 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Settings</h1>
        </div>
        <div className="space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                section === id
                  ? "bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Right content - Full width */}
      <div className="flex-1 px-8 py-6 min-w-0 overflow-y-auto">
        {/* ===== GENERAL ===== */}
        {section === "general" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Theme</h2>
              <div className="flex gap-2">
                {(["dark", "light"] as const).map((t) => (
                  <Button key={t} variant={theme === t ? "secondary" : "ghost"} onClick={() => setTheme(t)} className="capitalize">
                    {t}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Default Provider</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {providers.map((p) => (
                  <Button
                    key={p.id}
                    variant={defaultProvider === p.id ? "secondary" : "ghost"}
                    onClick={() => { setDefaultProvider(p.id); setDefaultModel(p.models[0]?.id ?? ""); }}
                    className="justify-start gap-2"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Default Model</h2>
              <div className="flex flex-wrap gap-2">
                {getEffectiveModels(defaultProvider).map((m) => (
                  <Button key={m.id} variant={defaultModel === m.id ? "secondary" : "ghost"} onClick={() => setDefaultModel(m.id)} size="sm">
                    {getDisplayName(m.id, m.name)}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Voice Persona</h2>
              <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-500">Choose a voice persona for Ollama voice chat. Requires XTTS-v2 server running. Say &quot;switch to jarvis&quot; or &quot;switch to friday&quot; to change on the fly.</p>
              <div className="flex gap-2">
                {(["none", "jarvis", "friday"] as const).map((p) => (
                  <Button
                    key={p}
                    variant={voicePersona === p ? "secondary" : "ghost"}
                    onClick={() => setVoicePersona(p)}
                    className="capitalize"
                  >
                    {p === "none" ? "Default (Browser)" : p}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">API Keys (server-side .env)</h2>
              <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-500">API keys are configured in .env on the server and never exposed to the browser.</p>
              <div className="space-y-2">
                {Object.entries(apiKeyLabels).map(([id, envVar]) => (
                  <div key={id} className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: providers.find((p) => p.id === id)?.color }} />
                    <span className="w-40 text-xs font-medium text-zinc-600 dark:text-zinc-500 dark:text-zinc-400">{envVar}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-600">{"•".repeat(16)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Local AI Endpoint</h2>
              <Input
                value={localEndpoint}
                onChange={(e) => setLocalEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className={`max-w-sm ${inputCls}`}
              />
            </section>
          </div>
        )}

        {/* ===== MODELS ===== */}
        {section === "models" && (
          <div className="space-y-4">
            <div>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Models</h2>
              <p className="mb-4 text-xs font-medium text-zinc-600 dark:text-zinc-500">
                Add or remove models per provider. Click <Hammer className="inline h-3 w-3 text-indigo-500" /> to tag a model for the Builder. Click <Pencil className="inline h-3 w-3" /> to set a nickname.
              </p>
            </div>

            {providers.map((p) => {
              const isExpanded = expandedProvider === p.id;
              const isOllama = p.id === "ollama";
              const isLMStudio = p.id === "lmstudio";
              const isLocalProvider = isOllama || isLMStudio;
              const models = isLocalProvider ? [] : getEffectiveModels(p.id);
              const displayModels = (isLocalProvider ? getModelsForDisplay(p.id) : models).slice().sort((a, b) => a.name.localeCompare(b.name));
              const modelCount = isLocalProvider && !isExpanded ? "live" : `${displayModels.length} model${displayModels.length !== 1 ? "s" : ""}`;

              return (
                <div key={p.id} className={`rounded-lg border border-zinc-300 dark:border-zinc-700 ${isExpanded ? "bg-zinc-50 dark:bg-zinc-800/50" : ""}`}>
                  <button
                    onClick={() => { setExpandedProvider(isExpanded ? null : p.id); setNewModelId(""); setNewModelName(""); setEditingNickname(null); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-white">{p.name}</span>
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-500">{modelCount}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-300 dark:border-zinc-700 px-4 py-3 space-y-3">
                      {isOllama && ollamaLoading && (
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-500 py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching models from Ollama...
                        </div>
                      )}
                      {isOllama && ollamaError && (
                        <p className="text-xs text-red-400 py-1">{ollamaError}</p>
                      )}
                      {isLMStudio && lmstudioLoading && (
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-500 py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching models from LM Studio...
                        </div>
                      )}
                      {isLMStudio && lmstudioError && (
                        <p className="text-xs text-red-400 py-1">{lmstudioError}</p>
                      )}

                      {/* Compact grid layout for models - 2-4 columns responsive */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                        {displayModels.map((m) => (
                          <div
                            key={m.id}
                            className={`flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 ${
                              editingNickname === m.id ? 'col-span-full' : ''
                            }`}
                            style={{ minHeight: '56px' }}
                          >
                            {editingNickname === m.id ? (
                              <div className="flex flex-1 items-center gap-2">
                                <Input
                                  value={nicknameValue}
                                  onChange={(e) => setNicknameValue(e.target.value)}
                                  placeholder="Nickname (leave blank to clear)"
                                  className={`flex-1 text-xs h-7 ${inputCls}`}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (nicknameValue.trim()) setNickname(m.id, nicknameValue.trim());
                                      else removeNickname(m.id);
                                      setEditingNickname(null);
                                    } else if (e.key === "Escape") {
                                      setEditingNickname(null);
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  className="h-7 bg-indigo-600 hover:bg-indigo-700 text-xs px-2"
                                  onClick={() => {
                                    if (nicknameValue.trim()) setNickname(m.id, nicknameValue.trim());
                                    else removeNickname(m.id);
                                    setEditingNickname(null);
                                  }}
                                >
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingNickname(null)}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  {nicknames[m.id] ? (
                                    <div className="flex flex-col">
                                      <span className="font-medium text-zinc-900 dark:text-white truncate text-base">{nicknames[m.id]}</span>
                                      <span className="text-sm text-zinc-400 dark:text-zinc-500 truncate">{m.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-800 dark:text-zinc-200 truncate block text-base font-medium">{m.name}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button onClick={() => setBuilderFlag(m.id, !isBuilderModel(m.id, p.id))} className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${isBuilderModel(m.id, p.id) ? 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10' : 'text-zinc-500 border-zinc-600 hover:text-indigo-400 hover:border-indigo-500/40'}`}>
                                    <Hammer className="h-4 w-4" />
                                    <span>Builder</span>
                                  </button>
                                  <button onClick={() => { setEditingNickname(m.id); setNicknameValue(nicknames[m.id] || ""); }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-600 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/40 transition-colors">
                                    <Pencil className="h-4 w-4" />
                                    <span>Rename</span>
                                  </button>
                                  {m.isBuiltIn ? (
                                    <span className="text-sm text-zinc-400 dark:text-zinc-300 uppercase px-3 py-1.5 rounded-md bg-zinc-200 dark:bg-zinc-700/50 font-semibold">built-in</span>
                                  ) : isLocalProvider ? (
                                    <span className="text-sm text-emerald-500 uppercase px-3 py-1.5 rounded-md bg-emerald-500/10 font-semibold">local</span>
                                  ) : (
                                    <button onClick={() => removeModel(p.id, m.id)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-600 text-zinc-500 hover:text-red-400 hover:border-red-500/40 transition-colors">
                                      <Trash2 className="h-4 w-4" />
                                      <span>Delete</span>
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {!isLocalProvider && (
                        <div className="flex items-center gap-2 pt-3 border-t border-zinc-300/50 dark:border-zinc-700/50">
                          <Input
                            placeholder="Model ID"
                            value={newModelId}
                            onChange={(e) => setNewModelId(e.target.value)}
                            className={`flex-1 text-xs h-8 max-w-[200px] ${inputCls}`}
                          />
                          <Input
                            placeholder="Display name"
                            value={newModelName}
                            onChange={(e) => setNewModelName(e.target.value)}
                            className={`flex-1 text-xs h-8 max-w-[200px] ${inputCls}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (newModelId.trim() && newModelName.trim()) {
                                addModel(p.id, newModelId.trim(), newModelName.trim());
                                setNewModelId("");
                                setNewModelName("");
                              }
                            }}
                            disabled={!newModelId.trim() || !newModelName.trim()}
                            className="h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== MODEL REGISTRY ===== */}
        {section === "registry" && (
          <ModelRegistry />
        )}

        {/* ===== ROLL CALL ===== */}
        {section === "rollcall" && (
          <RollCall />
        )}

        {/* ===== AI ORCHESTRATION ===== */}
        {section === "orchestration" && (
          <SettingsOrchestration />
        )}


        {/* ===== ROLES ===== */}
        {section === "roles" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Custom Roles</h2>
              <p className="mb-4 text-xs font-medium text-zinc-600 dark:text-zinc-500">
                Create roles with custom system prompts. Assign them to any LLM slot in debates.
              </p>
            </div>

            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role.id} className={cardCls}>
                  {editingRoleId === role.id ? (
                    <div className="space-y-2">
                      <Input value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} className={`text-sm ${inputCls}`} />
                      <textarea value={editRolePrompt} onChange={(e) => setEditRolePrompt(e.target.value)} className={`${textareaCls} h-32`} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { if (editRoleName && editRolePrompt) { updateRole(role.id, editRoleName, editRolePrompt); setEditingRoleId(null); } }} className="bg-indigo-600 hover:bg-indigo-700">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingRoleId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="text-sm font-semibold text-zinc-900 dark:text-white">{role.name}</span>
                        </div>
                        <div className="flex gap-1">
                          {/* Edit Button - Always shown */}
                          <Button variant="ghost" size="sm" onClick={() => { setEditingRoleId(role.id); setEditRoleName(role.name); setEditRolePrompt(role.systemPrompt); }} className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><Pencil className="h-3 w-3" /></Button>

                          {/* Delete Button - Only shown for non-default roles */}
                          {!role.isDefault && (
                            <Button variant="ghost" size="sm" onClick={() => deleteRole(role.id)} className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap line-clamp-3">{role.systemPrompt}</p>
                      {role.isDefault && <span className="mt-1 inline-block text-[10px] text-zinc-400 dark:text-zinc-600 uppercase">Default — cannot delete</span>}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className={dashedCardCls}>
              <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">New Role</h3>
              <Input placeholder="Role name (e.g., Researcher, Coder, Logic Analyst)" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className={`mb-2 ${inputCls}`} />
              <textarea placeholder="System prompt — define how this role should behave, its expertise, constraints..." value={newRolePrompt} onChange={(e) => setNewRolePrompt(e.target.value)} rows={6} className={textareaCls} />
              <Button onClick={() => { if (newRoleName.trim() && newRolePrompt.trim()) { addRole(newRoleName.trim(), newRolePrompt.trim()); setNewRoleName(""); setNewRolePrompt(""); } }} disabled={!newRoleName.trim() || !newRolePrompt.trim()} size="sm" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"><Plus className="h-3 w-3 mr-1" /> Add Role</Button>
            </div>
          </div>
        )}

        {/* ===== PROMPTS ===== */}
        {section === "prompts" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Saved Prompts</h2>
              <p className="mb-4 text-xs font-medium text-zinc-600 dark:text-zinc-500">Create reusable prompt templates you can quickly use in conversations.</p>
            </div>

            {prompts.length === 0 && <p className="text-sm text-zinc-400 dark:text-zinc-600">No saved prompts yet.</p>}

            <div className="space-y-2">
              {prompts.map((prompt) => (
                <div key={prompt.id} className={cardCls}>
                  {editingPromptId === prompt.id ? (
                    <div className="space-y-2">
                      <Input value={editPromptName} onChange={(e) => setEditPromptName(e.target.value)} className={`text-sm ${inputCls}`} />
                      <textarea value={editPromptContent} onChange={(e) => setEditPromptContent(e.target.value)} className={`${textareaCls} h-32`} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { if (editPromptName && editPromptContent) { updatePrompt(prompt.id, editPromptName, editPromptContent); setEditingPromptId(null); } }} className="bg-indigo-600 hover:bg-indigo-700">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPromptId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">{prompt.name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingPromptId(prompt.id); setEditPromptName(prompt.name); setEditPromptContent(prompt.content); }} className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deletePrompt(prompt.id)} className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap line-clamp-3">{prompt.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className={dashedCardCls}>
              <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">New Prompt</h3>
              <Input placeholder="Prompt name (e.g., Code Review, Research Query)" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} className={`mb-2 ${inputCls}`} />
              <textarea placeholder="Prompt template content..." value={newPromptContent} onChange={(e) => setNewPromptContent(e.target.value)} rows={6} className={textareaCls} />
              <Button onClick={() => { if (newPromptName.trim() && newPromptContent.trim()) { addPrompt(newPromptName.trim(), newPromptContent.trim()); setNewPromptName(""); setNewPromptContent(""); } }} disabled={!newPromptName.trim() || !newPromptContent.trim()} size="sm" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"><Plus className="h-3 w-3 mr-1" /> Add Prompt</Button>
            </div>
          </div>
        )}

        {/* ===== KNOWLEDGE VAULT ===== */}
        {section === "knowledge" && <SettingsKnowledge />}

        {/* ===== TRADING APIs ===== */}
        {section === "trading" && <SettingsTradingAPIs />}

        {/* ===== SECURITY ===== */}
        {section === "logic" && <SettingsLogicEditor />}

        {/* QUESTIONS SECTION */}
        {section === "questions" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">
                Test Questions
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                Questions used in poison pill tests. Each question can be paired with a poison.
              </p>

              <div className="space-y-3">
                {questions.map((q) => (
                  <div key={q.id} className={cardCls}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                          {q.question}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {q.poisonId && (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400">
                              Poison: {poisons.find(p => p.id === q.poisonId)?.name || q.poisonId}
                            </span>
                          )}
                          {q.tier && (
                            <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">
                              {q.tier}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(q.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {questions.length === 0 && (
                  <div className="text-center py-8 text-sm text-zinc-500 dark:text-zinc-400">
                    No questions yet. Questions are managed in the Test/Batch screens.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* POISONS SECTION */}
        {section === "poisons" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">
                Poison Pills
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                False claims injected into debates to test if AI agents can detect them.
              </p>

              <div className="space-y-3">
                {poisons.map((p) => (
                  <div key={p.id} className={cardCls}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                          {p.name}
                        </div>
                        <div className="text-sm text-zinc-900 dark:text-zinc-100 mb-2">
                          "{p.content}"
                        </div>
                        {p.markers && p.markers.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Markers:</span>
                            {p.markers.map((marker, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              >
                                {marker}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePoison(p.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {poisons.length === 0 && (
                  <div className="text-center py-8 text-sm text-zinc-500 dark:text-zinc-400">
                    No poison pills yet. Poisons are managed in the Test/Batch screens.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {section === "build-docs" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Builder Output Tokens</h2>
              <p className="mb-4 text-xs font-medium text-zinc-600 dark:text-zinc-500">
                Maximum output tokens per AI response in Builder chat. Higher values allow longer code generation. Applies to all models.
              </p>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
                <label className="text-sm font-medium text-zinc-900 dark:text-white whitespace-nowrap">Max Output Tokens</label>
                <select
                  value={typeof window !== 'undefined' ? (localStorage.getItem('builder-max-output-tokens') || '8192') : '8192'}
                  onChange={(e) => { localStorage.setItem('builder-max-output-tokens', e.target.value); e.target.dispatchEvent(new Event('change')); }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm"
                >
                  <option value="4096">4,096</option>
                  <option value="8192">8,192 (Default)</option>
                  <option value="16384">16,384</option>
                  <option value="32768">32,768</option>
                </select>
              </div>
            </section>
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">Build Documentation</h2>
              <p className="mb-4 text-xs font-medium text-zinc-600 dark:text-zinc-500">
                Automatically inject SARGE build documentation into AI context. When enabled, the system will include relevant docs (pages, AI logic, architecture, stores, API routes, models) invisibly in system prompts. This helps AI understand your build structure and provide better context-aware responses.
              </p>

              <div className="flex items-center gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
                <button
                  onClick={() => setBuildDocsAutoInject(!buildDocsAutoInject)}
                  className={`flex-shrink-0 h-6 w-10 rounded-full transition-colors ${
                    buildDocsAutoInject
                      ? 'bg-indigo-600'
                      : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <div className={`h-5 w-5 rounded-full bg-white transition-transform ${
                    buildDocsAutoInject
                      ? 'translate-x-4.5'
                      : 'translate-x-0.5'
                  }`} />
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">Auto-Inject Build Docs</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    {buildDocsAutoInject
                      ? '✅ Enabled — Docs injected invisibly into AI context per mode'
                      : '⊘ Disabled — No documentation injected'}
                  </div>
                </div>
              </div>

              <div className={`mt-4 p-4 rounded-lg border ${
                buildDocsAutoInject
                  ? 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/20'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30'
              }`}>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">How It Works</h3>
                <ul className="text-xs text-zinc-700 dark:text-zinc-400 space-y-1">
                  <li>• <strong>Chat mode:</strong> Chat AI logic + model reference</li>
                  <li>• <strong>Builder mode:</strong> Builder AI logic + architecture + builder API routes</li>
                  <li>• <strong>Debate mode:</strong> Debate AI logic + model reference</li>
                  <li>• <strong>Test mode:</strong> Test mode AI logic + model reference</li>
                  <li>• <strong>Diagnostics:</strong> Architecture + diagnostics API routes</li>
                  <li>• <strong>Settings:</strong> Stores reference + model reference</li>
                </ul>
                <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-3">
                  Max injection: 3000 tokens per request. Documentation is prepended invisibly to system prompts and never shown in chat UI.
                </p>
              </div>

              <div className={`mt-4 p-4 rounded-lg border border-dashed ${
                buildDocsAutoInject
                  ? 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/10'
                  : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/20'
              }`}>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">📚 Documentation Location</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-500 mb-2">
                  Build documentation is stored in <code className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 px-1.5 py-0.5 rounded text-xs">/docs/</code>
                </p>
                <ul className="text-xs text-zinc-600 dark:text-zinc-500 space-y-1 ml-2">
                  <li>→ docs/index.md — Master navigation</li>
                  <li>→ docs/pages.md — All 19 routes</li>
                  <li>→ docs/ai-logic.md — System prompts and flows</li>
                  <li>→ docs/architecture.md — Tech stack and design</li>
                  <li>→ docs/stores.md — All 43 Zustand stores</li>
                  <li>→ docs/api-routes.md — All 39 API endpoints</li>
                  <li>→ docs/models.md — Providers and models</li>
                  <li>→ docs/changelog.md — Version history</li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {section === "security" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">PIN Lock</h2>
              {pinEnabled ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-300 dark:border-emerald-700/30 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <Lock className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">PIN protection is enabled</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-500">App locks after 30 minutes of inactivity.</p>
                  <Button variant="ghost" onClick={removePin} className="text-red-400 hover:text-red-300 hover:bg-red-950/20">
                    <LockOpen className="h-3.5 w-3.5 mr-1.5" /> Remove PIN
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-500">Set a 4-6 digit PIN to lock the workbench on load and after inactivity.</p>
                  <div className="flex gap-2">
                    <Input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN" className={`w-24 text-center ${inputCls}`} />
                    <Input type="password" inputMode="numeric" maxLength={6} value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirm" className={`w-24 text-center ${inputCls}`} />
                    <Button onClick={() => { if (newPin.length >= 4 && newPin === confirmNewPin) { storePinSet(newPin); setNewPin(""); setConfirmNewPin(""); } }} disabled={newPin.length < 4 || newPin !== confirmNewPin} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40">
                      <Lock className="h-3.5 w-3.5 mr-1.5" /> Set PIN
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===== THREAD GUARDIAN ===== */}
        {section === "guardian" && (
          <ThreadGuardianSettings />
        )}

        {/* ===== SYNC ===== */}
        {section === "sync" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">🔄 Sync Settings</h2>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-500 mb-4">
                Synchronize code changes between SARGE_v1 and Sandbox.
              </p>

              <div className="space-y-3">
                {/* Reverse Sync Button */}
                <div className={cardCls}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        Reverse Sync (SARGE_v1 → Sandbox)
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-500 mt-0.5">
                        Copy recent changes from main app to sandbox
                      </div>
                    </div>
                    <Button
                      onClick={handleReverseSync}
                      disabled={reverseSyncing}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
                      size="sm"
                    >
                      {reverseSyncing ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reverse Sync
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Sync Status Message */}
                  {syncMessage && (
                    <div className={`mt-3 p-3 rounded text-sm ${
                      syncSuccess
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                    }`}>
                      {syncMessage}
                    </div>
                  )}
                </div>

                {/* Info box */}
                <div className={dashedCardCls}>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">About Reverse Sync</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-500 mb-2">
                    This copies 9 modified files from SARGE_v1 to the sandbox:
                  </p>
                  <ul className="text-xs text-zinc-600 dark:text-zinc-500 space-y-1 ml-4 list-disc">
                    <li>lib/stores/testModeStore.ts</li>
                    <li>lib/types.ts</li>
                    <li>lib/utils/plainEnglish.ts</li>
                    <li>components/test/BatchView.tsx</li>
                    <li>components/test/LivePassColumn.tsx</li>
                    <li>components/test/LiveConsolePanel.tsx</li>
                    <li>lib/providers/ollama.ts</li>
                    <li>lib/test-providers/ollama.ts</li>
                    <li>README_SANDBOX_WORKFLOW.md</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
