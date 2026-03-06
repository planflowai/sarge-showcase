"use client";

import { useEffect, useState } from "react";
import {
  useSettingsStore,
  useRoleStore,
  usePinStore,
  useModelStore,
  type EffectiveModel,
  usePromptStore,
  useTestModeStore,
  providers,
  fetchOllamaModels,
  fetchLMStudioModels,
  type LocalModel,
  useThreadGuardianStore,
  DEFAULT_TIER1_CONFIG,
  DEFAULT_TIER2_CONFIG,
  DEFAULT_TIER3_CONFIG,
  type ThreadTierConfig as TierConfig,
  useCustomProviderStore,
  KNOWN_PROVIDERS,
  DEFAULT_MODELS,
} from "@sarge/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Trash2, Plus, Pencil, Lock, LockOpen, Shield,
  Settings, Cpu, MessageSquare, ShieldCheck, ChevronDown, ChevronRight, Loader2,
  Database, FileText, RefreshCw, Radio,
  Hammer, Zap, TrendingUp, Activity,
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
const PipelineDiagnostics = dynamic(
  () => import("@/components/settings/PipelineDiagnostics").then((m) => ({ default: m.PipelineDiagnostics })),
  { loading: () => <div className="animate-pulse text-xs text-zinc-400 py-8 text-center">Loading diagnostics…</div> }
);
import { RollCall } from "@/components/settings/RollCall";
import { ModelRoleTags } from "@/components/settings/ModelRoleTags";

type Section = "general" | "models" | "registry" | "rollcall" | "orchestration" | "roles" | "prompts" | "security" | "knowledge" | "logic" | "questions" | "poisons" | "sync" | "guardian" | "trading" | "build-docs" | "diagnostics";

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
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "security", label: "Security", icon: ShieldCheck },
];

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
      <div>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Thread Guardian</h2>
        <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-zinc-300">
          Background conversation maintenance system. Monitors threads for facts, contradictions, hallucinations, and topic drift.
        </p>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-500" />
          Master Control
        </h3>
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-white">Enable Thread Guardian</div>
              <div className="text-xs text-zinc-300 dark:text-zinc-400 mt-0.5">
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

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Database className="h-4 w-4 text-indigo-500" />
          Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cardCls}>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalFacts}</div>
            <div className="text-xs text-zinc-300 dark:text-zinc-400">Facts Indexed</div>
          </div>
          <div className={cardCls}>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.totalContradictions}</div>
            <div className="text-xs text-zinc-300 dark:text-zinc-400">Contradictions</div>
          </div>
          <div className={cardCls}>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.totalHallucinations}</div>
            <div className="text-xs text-zinc-300 dark:text-zinc-400">Hallucinations</div>
          </div>
          <div className={cardCls}>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalSavePoints}</div>
            <div className="text-xs text-zinc-300 dark:text-zinc-400">Save Points</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
          <span>Active on {stats.activeConversations} conversation{stats.activeConversations !== 1 ? "s" : ""}</span>
          <span className="text-zinc-300 dark:text-zinc-400">&bull;</span>
          <span>{stats.totalTier1Runs + stats.totalTier2Runs + stats.totalTier3Runs} total runs across all tiers</span>
        </div>
      </section>

      {/* Tier 1 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-500" />
            Tier 1 — Fast Indexing
          </h3>
          <Button variant="ghost" size="sm" onClick={() => resetTierToDefaults(1)} className="text-xs text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300">
            Reset to Defaults
          </Button>
        </div>
        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Model</label>
              <Input value={tier1Config.model} onChange={(e) => handleTierConfigChange(1, "model", e.target.value)} placeholder="phi3:mini" className={`text-sm ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Provider</label>
              <select value={tier1Config.provider} onChange={(e) => handleTierConfigChange(1, "provider", e.target.value)} className={`w-full rounded border px-2 py-1.5 text-sm ${inputCls}`}>
                <option value="ollama">Ollama (Local)</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Interval (minutes)</label>
              <Input type="number" value={Math.round(tier1Config.intervalMs / 60000)} onChange={(e) => handleTierConfigChange(1, "intervalMs", (parseInt(e.target.value) || 2) * 60000)} min={1} max={30} className={`text-sm ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Token Capacity</label>
              <Input type="number" value={tier1Config.maxTokenCapacity} onChange={(e) => handleTierConfigChange(1, "maxTokenCapacity", parseInt(e.target.value) || 4000)} min={1000} max={32000} step={1000} className={`text-sm ${inputCls}`} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-300 dark:text-zinc-400">
            Fast, cheap model for basic fact extraction. Runs every {Math.round(tier1Config.intervalMs / 60000)} minutes.
          </p>
        </div>
      </section>

      {/* Tier 2 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-500" />
            Tier 2 — Deep Analysis
          </h3>
          <Button variant="ghost" size="sm" onClick={() => resetTierToDefaults(2)} className="text-xs text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300">
            Reset to Defaults
          </Button>
        </div>
        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Model</label>
              <Input value={tier2Config.model} onChange={(e) => handleTierConfigChange(2, "model", e.target.value)} placeholder="phi4:latest" className={`text-sm ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Provider</label>
              <select value={tier2Config.provider} onChange={(e) => handleTierConfigChange(2, "provider", e.target.value)} className={`w-full rounded border px-2 py-1.5 text-sm ${inputCls}`}>
                <option value="ollama">Ollama (Local)</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Interval (minutes)</label>
              <Input type="number" value={Math.round(tier2Config.intervalMs / 60000)} onChange={(e) => handleTierConfigChange(2, "intervalMs", (parseInt(e.target.value) || 10) * 60000)} min={5} max={60} className={`text-sm ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Token Capacity</label>
              <Input type="number" value={tier2Config.maxTokenCapacity} onChange={(e) => handleTierConfigChange(2, "maxTokenCapacity", parseInt(e.target.value) || 8000)} min={2000} max={64000} step={1000} className={`text-sm ${inputCls}`} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-300 dark:text-zinc-400">
            Smarter model for contradiction detection and hallucination flagging. Runs every {Math.round(tier2Config.intervalMs / 60000)} minutes.
          </p>
        </div>
      </section>

      {/* Tier 3 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-500" />
            Tier 3 — Save Points
          </h3>
          <Button variant="ghost" size="sm" onClick={() => resetTierToDefaults(3)} className="text-xs text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300">
            Reset to Defaults
          </Button>
        </div>
        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Model</label>
              <Input value={tier3Config.model} onChange={(e) => handleTierConfigChange(3, "model", e.target.value)} placeholder="claude-sonnet-4-20250514" className={`text-sm ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Provider</label>
              <select value={tier3Config.provider} onChange={(e) => handleTierConfigChange(3, "provider", e.target.value)} className={`w-full rounded border px-2 py-1.5 text-sm ${inputCls}`}>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="deepseek">DeepSeek</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Interval (hours)</label>
              <Input type="number" value={Math.round(tier3Config.intervalMs / 3600000)} onChange={(e) => handleTierConfigChange(3, "intervalMs", (parseFloat(e.target.value) || 4) * 3600000)} min={1} max={24} step={0.5} className={`text-sm ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 dark:text-zinc-400 mb-1">Token Capacity</label>
              <Input type="number" value={tier3Config.maxTokenCapacity} onChange={(e) => handleTierConfigChange(3, "maxTokenCapacity", parseInt(e.target.value) || 32000)} min={8000} max={200000} step={1000} className={`text-sm ${inputCls}`} />
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-300 dark:text-zinc-400">
            Frontier model for comprehensive save points. Creates restoration checkpoints every {Math.round(tier3Config.intervalMs / 3600000)} hours.
          </p>
        </div>
      </section>

      {/* Scope */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Settings className="h-4 w-4 text-indigo-500" />
          Scope
        </h3>
        <div className={cardCls}>
          <p className="text-xs text-zinc-300 dark:text-zinc-400 mb-3">
            Thread Guardian runs ONLY on conversational modes. It never runs on controlled environments like Debate, Test, Batch, Forensic, or Diagnostics.
          </p>
          <div className="flex flex-wrap gap-2">
            {scope.allowedModes.map((mode) => (
              <span key={mode} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {mode}
              </span>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-wrap gap-2">
              {scope.excludedModes.map((mode) => (
                <span key={mode} className="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-300 dark:text-zinc-400">
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
              <ul className="text-xs text-zinc-300 dark:text-zinc-400 list-disc ml-4 space-y-1">
                <li>All indexed facts</li>
                <li>All detected contradictions</li>
                <li>All flagged hallucinations</li>
                <li>All save points</li>
                <li>All model attributions</li>
              </ul>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { clearAllLedgers(); setShowClearConfirm(false); }} className="bg-red-600 hover:bg-red-700 text-white">
                  <Trash2 className="h-3 w-3 mr-1" /> Yes, Delete Everything
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">Clear All Guardian Data</div>
                <div className="text-xs text-zinc-300 dark:text-zinc-400 mt-0.5">
                  Permanently delete all facts, contradictions, hallucinations, and save points
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(true)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
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

  const questions = useTestModeStore((s) => s.questions);
  const poisons = useTestModeStore((s) => s.poisons);
  const removeQuestion = useTestModeStore((s) => s.removeQuestion);
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

  const { hydrated: modelsHydrated, hydrate: hydrateModels, addModel, removeModel, getEffectiveModels, nicknames, setNickname, removeNickname, getDisplayName, voicePersona, setVoicePersona, builderFlags, setBuilderFlag, isBuilderModel, modelRoles, setModelRole, hasModelRole } = useModelStore();
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState("");

  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  const [lmstudioModels, setLmstudioModels] = useState<LocalModel[]>([]);
  const [lmstudioLoading, setLmstudioLoading] = useState(false);
  const [lmstudioError, setLmstudioError] = useState<string | null>(null);

  // Custom provider state
  const { providers: customProviders, addProvider: addCustomProvider, removeProvider: removeCustomProvider, addModelToProvider, removeModelFromProvider } = useCustomProviderStore();
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState("");
  const [newProviderEnvKey, setNewProviderEnvKey] = useState("");
  const [newProviderColor, setNewProviderColor] = useState("#8B5CF6");
  const [selectedKnownProvider, setSelectedKnownProvider] = useState<string>("");
  const [customNewModelId, setCustomNewModelId] = useState("");
  const [customNewModelName, setCustomNewModelName] = useState("");
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "ok" | "fail" | null>>({});
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [modelTestResults, setModelTestResults] = useState<Record<string, { status: "ok" | "fail"; error?: string } | null>>({});
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);
  const [fetchedModels, setFetchedModels] = useState<Record<string, { id: string; name: string; owned_by?: string }[]>>({});
  const [fetchError, setFetchError] = useState<Record<string, string>>({});

  const { prompts, hydrated: promptsHydrated, hydrate: hydratePrompts, addPrompt, updatePrompt, deletePrompt } = usePromptStore();
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptContent, setEditPromptContent] = useState("");

  const [reverseSyncing, setReverseSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncSuccess, setSyncSuccess] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
    if (!rolesHydrated) hydrateRoles();
    if (!pinHydrated) hydratePin();
    if (!modelsHydrated) hydrateModels();
    if (!promptsHydrated) hydratePrompts();
  }, [hydrated, hydrate, rolesHydrated, hydrateRoles, pinHydrated, hydratePin, modelsHydrated, hydrateModels, promptsHydrated, hydratePrompts]);

  useEffect(() => {
    if (expandedProvider !== "ollama") return;
    setOllamaLoading(true);
    setOllamaError(null);
    fetchOllamaModels()
      .then((models) => setOllamaModels(models))
      .catch(() => { setOllamaModels([]); setOllamaError("Cannot reach Ollama. Make sure it's running."); })
      .finally(() => setOllamaLoading(false));
  }, [expandedProvider]);

  useEffect(() => {
    if (expandedProvider !== "lmstudio") return;
    setLmstudioLoading(true);
    setLmstudioError(null);
    fetchLMStudioModels()
      .then((models) => setLmstudioModels(models))
      .catch(() => { setLmstudioModels([]); setLmstudioError("Cannot reach LM Studio. Make sure it's running on port 1240."); })
      .finally(() => setLmstudioLoading(false));
  }, [expandedProvider]);

  const handleTestCustomProvider = async (cp: { id: string; models: { id: string; name: string }[] }) => {
    if (testingProvider === cp.id || cp.models.length === 0) return;
    setTestingProvider(cp.id);
    setTestResults((prev) => ({ ...prev, [cp.id]: null }));
    try {
      const res = await fetch("/api/test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cp.models[0].id,
          provider: cp.id,
          prompt: "Say OK",
          systemPrompt: "Reply with OK",
          source: "cloud",
        }),
      });
      if (!res.ok) {
        setTestResults((prev) => ({ ...prev, [cp.id]: "fail" }));
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) { setTestResults((prev) => ({ ...prev, [cp.id]: "fail" })); return; }
      const { done, value } = await reader.read();
      reader.cancel();
      setTestResults((prev) => ({ ...prev, [cp.id]: !done && value && value.length > 0 ? "ok" : "fail" }));
    } catch {
      setTestResults((prev) => ({ ...prev, [cp.id]: "fail" }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleTestModel = async (modelId: string, providerId: string) => {
    const key = `${providerId}:${modelId}`;
    if (testingModel === key) return;
    setTestingModel(key);
    setModelTestResults((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await fetch("/api/test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          provider: providerId,
          prompt: "Say OK",
          systemPrompt: "Reply with OK",
          source: providerId === "ollama" || providerId === "lmstudio" ? "local" : "cloud",
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let errorMsg = `HTTP ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.error || errorMsg;
        } catch {
          if (errText.length > 0 && errText.length < 200) errorMsg = errText;
        }
        if (errorMsg.toLowerCase().includes("not found") || errorMsg.toLowerCase().includes("does not exist") || errorMsg.includes("404")) {
          setModelTestResults((prev) => ({ ...prev, [key]: { status: "fail", error: `Unknown model ID — check provider docs` } }));
        } else {
          setModelTestResults((prev) => ({ ...prev, [key]: { status: "fail", error: errorMsg } }));
        }
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setModelTestResults((prev) => ({ ...prev, [key]: { status: "fail", error: "No response body" } }));
        return;
      }
      const { done, value } = await reader.read();
      reader.cancel();
      if (!done && value && value.length > 0) {
        setModelTestResults((prev) => ({ ...prev, [key]: { status: "ok" } }));
      } else {
        setModelTestResults((prev) => ({ ...prev, [key]: { status: "fail", error: "Empty response" } }));
      }
    } catch (err: unknown) {
      setModelTestResults((prev) => ({ ...prev, [key]: { status: "fail", error: err instanceof Error ? err.message : "Connection failed" } }));
    } finally {
      setTestingModel(null);
    }
  };

  const handleFetchModels = async (cp: { id: string; baseUrl: string; envKeyName: string }) => {
    if (fetchingModels === cp.id) return;
    setFetchingModels(cp.id);
    setFetchError((prev) => ({ ...prev, [cp.id]: "" }));
    try {
      const res = await fetch("/api/providers/list-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: cp.baseUrl, envKeyName: cp.envKeyName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchError((prev) => ({ ...prev, [cp.id]: data.error || `Error ${res.status}` }));
        return;
      }
      setFetchedModels((prev) => ({ ...prev, [cp.id]: data.models || [] }));
    } catch (err: any) {
      setFetchError((prev) => ({ ...prev, [cp.id]: err.message || "Fetch failed" }));
    } finally {
      setFetchingModels(null);
    }
  };

  const apiKeyLabels: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_API_KEY",
    xai: "XAI_API_KEY",
  };

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
      const response = await fetch("/api/sync/reverse", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setSyncMessage("Reverse sync completed successfully. Sandbox is now up-to-date.");
        setSyncSuccess(true);
      } else {
        setSyncMessage(`Sync failed: ${data.error || data.message}`);
        setSyncSuccess(false);
      }
    } catch (error: any) {
      setSyncMessage(`Error: ${error.message}`);
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
          <Link
            href="/"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
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
                  : "text-zinc-300 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Right content */}
      <div className="flex-1 px-8 py-6 min-w-0 overflow-y-auto">
        {section === "general" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Theme</h2>
              <div className="flex gap-2">
                {(["dark", "light"] as const).map((t) => (
                  <Button key={t} variant={theme === t ? "secondary" : "ghost"} onClick={() => setTheme(t)} className="capitalize">{t}</Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Default Provider</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {providers.map((p) => (
                  <Button key={p.id} variant={defaultProvider === p.id ? "secondary" : "ghost"} onClick={() => { setDefaultProvider(p.id); setDefaultModel(p.models[0]?.id ?? ""); }} className="justify-start gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Default Model</h2>
              <div className="flex flex-wrap gap-2">
                {getEffectiveModels(defaultProvider).map((m) => (
                  <Button key={m.id} variant={defaultModel === m.id ? "secondary" : "ghost"} onClick={() => setDefaultModel(m.id)} size="sm">
                    {getDisplayName(m.id, m.name)}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Voice Persona</h2>
              <p className="mb-3 text-xs font-medium text-zinc-300 dark:text-zinc-300">Choose a voice persona for Ollama voice chat. Requires XTTS-v2 server running.</p>
              <div className="flex gap-2">
                {(["none", "jarvis", "friday"] as const).map((p) => (
                  <Button key={p} variant={voicePersona === p ? "secondary" : "ghost"} onClick={() => setVoicePersona(p)} className="capitalize">
                    {p === "none" ? "Default (Browser)" : p}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">API Keys (server-side .env)</h2>
              <p className="mb-3 text-xs font-medium text-zinc-300 dark:text-zinc-300">API keys are configured in .env on the server and never exposed to the browser.</p>
              <div className="space-y-2">
                {Object.entries(apiKeyLabels).map(([id, envVar]) => (
                  <div key={id} className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: providers.find((p) => p.id === id)?.color }} />
                    <span className="w-40 text-xs font-medium text-zinc-300 dark:text-zinc-400">{envVar}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-300">{"•".repeat(16)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Local AI Endpoint</h2>
              <Input value={localEndpoint} onChange={(e) => setLocalEndpoint(e.target.value)} placeholder="http://localhost:11434" className={`max-w-sm ${inputCls}`} />
            </section>
          </div>
        )}

        {section === "models" && (
          <div className="space-y-4">
            <div>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Models</h2>
              <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-zinc-300">
                Add or remove models per provider. Click <Hammer className="inline h-3 w-3 text-indigo-500" /> to tag a model for the Builder. Click <Pencil className="inline h-3 w-3" /> to set a nickname. Role tags: <span className="text-xs font-bold text-indigo-400">B</span>uilder <span className="text-xs font-bold text-amber-400">T</span>rials <span className="text-xs font-bold text-sky-400">C</span>hat <span className="text-xs font-bold text-pink-400">I</span>mage <span className="text-xs font-bold text-emerald-400">G</span>uardian <span className="text-xs font-bold text-violet-400">X</span>=Code
              </p>
            </div>

            {/* ── Add Provider Button + Form ── */}
            {!showAddProvider ? (
              <button
                onClick={() => setShowAddProvider(true)}
                className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-zinc-600 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-300 hover:text-[#FF6700] hover:border-[#FF6700]/50 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Provider
              </button>
            ) : (
              <div className="rounded-lg border border-[#FF6700]/30 bg-zinc-800/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Add Custom Provider</h3>
                  <button onClick={() => { setShowAddProvider(false); setSelectedKnownProvider(""); setNewProviderName(""); setNewProviderBaseUrl(""); setNewProviderEnvKey(""); }} className="text-zinc-300 hover:text-zinc-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Quick-pick known providers */}
                <div className="flex flex-wrap gap-2">
                  {KNOWN_PROVIDERS.filter((kp) => !customProviders.some((cp) => cp.id === kp.id) && !providers.some((bp) => bp.id === kp.id)).map((kp) => (
                    <button
                      key={kp.id}
                      onClick={() => {
                        setSelectedKnownProvider(kp.id);
                        setNewProviderName(kp.name);
                        setNewProviderBaseUrl(kp.baseUrl);
                        setNewProviderEnvKey(kp.envKeyName);
                        setNewProviderColor(kp.color);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        selectedKnownProvider === kp.id
                          ? "bg-[#FF6700]/15 border-[#FF6700]/40 text-[#FFD700]"
                          : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: kp.color }} />
                      {kp.name}
                    </button>
                  ))}
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Provider name" value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} className={`text-xs h-8 ${inputCls}`} />
                  <Input placeholder="API Key env var (e.g. MISTRAL_API_KEY)" value={newProviderEnvKey} onChange={(e) => setNewProviderEnvKey(e.target.value)} className={`text-xs h-8 ${inputCls}`} />
                </div>
                <Input placeholder="Base URL (e.g. https://api.mistral.ai/v1)" value={newProviderBaseUrl} onChange={(e) => setNewProviderBaseUrl(e.target.value)} className={`text-xs h-8 ${inputCls}`} />

                <Button
                  size="sm"
                  disabled={!newProviderName.trim() || !newProviderBaseUrl.trim() || !newProviderEnvKey.trim()}
                  className="w-full bg-[#FF6700] hover:bg-[#FF6700]/80 disabled:opacity-40 text-sm font-bold"
                  onClick={() => {
                    const id = newProviderName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
                    const defaultModels = DEFAULT_MODELS[id] || [];
                    addCustomProvider({
                      id,
                      name: newProviderName.trim(),
                      baseUrl: newProviderBaseUrl.trim(),
                      envKeyName: newProviderEnvKey.trim(),
                      color: newProviderColor,
                      models: defaultModels,
                    });
                    setShowAddProvider(false);
                    setSelectedKnownProvider("");
                    setNewProviderName("");
                    setNewProviderBaseUrl("");
                    setNewProviderEnvKey("");
                    setNewProviderColor("#8B5CF6");
                    setExpandedProvider(id);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add {newProviderName || "Provider"}
                </Button>
              </div>
            )}

            {/* ── Custom Providers ── */}
            {customProviders.map((cp) => {
              const isExpanded = expandedProvider === cp.id;
              const cpModels = getEffectiveModels(cp.id);
              return (
                <div key={cp.id} className={`rounded-lg border border-zinc-300 dark:border-zinc-700 ${isExpanded ? "bg-zinc-50 dark:bg-zinc-800/50" : ""}`}>
                  <button
                    onClick={() => { setExpandedProvider(isExpanded ? null : cp.id); setCustomNewModelId(""); setCustomNewModelName(""); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cp.color }} />
                    <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-white">{cp.name}</span>
                    <span className="text-xs text-emerald-500 uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 mr-2">custom</span>
                    <span className="text-xs font-medium text-zinc-300 dark:text-zinc-300">{cpModels.length} model{cpModels.length !== 1 ? "s" : ""}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-300" /> : <ChevronRight className="h-4 w-4 text-zinc-300" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-zinc-300 dark:border-zinc-700 px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-zinc-300 space-y-0.5">
                          <div>Base URL: <span className="text-zinc-400 font-mono">{cp.baseUrl}</span></div>
                          <div>API Key: <span className="text-zinc-400 font-mono">{cp.envKeyName}</span></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleFetchModels(cp)}
                            disabled={fetchingModels === cp.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 ${
                              fetchedModels[cp.id]?.length
                                ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400"
                                : "bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-indigo-500/50 hover:text-indigo-400"
                            }`}
                          >
                            {fetchingModels === cp.id ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Fetching...</>
                            ) : fetchedModels[cp.id]?.length ? (
                              <><Database className="h-3 w-3" /> {fetchedModels[cp.id].length} Available</>
                            ) : (
                              <><Database className="h-3 w-3" /> Fetch Models</>
                            )}
                          </button>
                          <button
                            onClick={() => handleTestCustomProvider(cp)}
                            disabled={testingProvider === cp.id || cp.models.length === 0}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 ${
                              testResults[cp.id] === "ok"
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                : testResults[cp.id] === "fail"
                                ? "bg-red-500/15 border-red-500/40 text-red-400"
                                : "bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-[#FF6700]/50 hover:text-[#FFD700]"
                            }`}
                          >
                            {testingProvider === cp.id ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Testing...</>
                            ) : testResults[cp.id] === "ok" ? (
                              <><Zap className="h-3 w-3" /> Connected</>
                            ) : testResults[cp.id] === "fail" ? (
                              <><Zap className="h-3 w-3" /> Failed</>
                            ) : (
                              <><Zap className="h-3 w-3" /> Test Connection</>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {cpModels.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-2 text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600" style={{ minHeight: '44px' }}>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              {nicknames[m.id] ? (
                                <div className="flex flex-col">
                                  <span className="font-medium text-zinc-900 dark:text-white truncate text-xs">{nicknames[m.id]}</span>
                                  <span className="text-xs text-zinc-400 dark:text-zinc-300 truncate">{m.name}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-800 dark:text-zinc-200 truncate block">{m.name}</span>
                              )}
                              <ModelRoleTags modelId={m.id} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button onClick={() => setBuilderFlag(m.id, !isBuilderModel(m.id, cp.id))} className={`transition-colors ${isBuilderModel(m.id, cp.id) ? 'text-indigo-500' : 'text-zinc-400 hover:text-indigo-400'}`} title={isBuilderModel(m.id, cp.id) ? "Remove from Builder" : "Add to Builder"}>
                                <Hammer className="h-3 w-3" />
                              </button>
                              <button onClick={() => { removeModel(cp.id, m.id); removeModelFromProvider(cp.id, m.id); }} className="text-zinc-300 hover:text-red-400">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Fetch error */}
                      {fetchError[cp.id] && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                          {fetchError[cp.id]}
                        </div>
                      )}
                      {/* Fetched models from API */}
                      {fetchedModels[cp.id]?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white uppercase tracking-wider">Available from API ({fetchedModels[cp.id].length})</span>
                            <button
                              onClick={() => {
                                let added = 0;
                                for (const m of fetchedModels[cp.id]) {
                                  if (!cpModels.some((existing) => existing.id === m.id)) {
                                    addModelToProvider(cp.id, { id: m.id, name: m.name });
                                    addModel(cp.id, m.id, m.name);
                                    added++;
                                  }
                                }
                                if (added > 0) setFetchedModels((prev) => ({ ...prev, [cp.id]: [] }));
                              }}
                              className="text-sm font-bold text-white hover:text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 hover:border-indigo-500/50 transition-colors"
                            >
                              Add All New
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                            {fetchedModels[cp.id].map((m) => {
                              const alreadyAdded = cpModels.some((existing) => existing.id === m.id);
                              return (
                                <div
                                  key={m.id}
                                  className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
                                    alreadyAdded
                                      ? "border-emerald-500/30 bg-emerald-500/5 text-zinc-400"
                                      : "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/40 cursor-pointer text-white"
                                  }`}
                                  onClick={() => {
                                    if (alreadyAdded) return;
                                    addModelToProvider(cp.id, { id: m.id, name: m.name });
                                    addModel(cp.id, m.id, m.name);
                                  }}
                                >
                                  <span className="flex-1 truncate font-mono text-sm font-bold">{m.id}</span>
                                  {m.owned_by && <span className="text-xs text-zinc-400 flex-shrink-0">{m.owned_by}</span>}
                                  {alreadyAdded ? (
                                    <span className="text-xs text-emerald-500 font-bold flex-shrink-0">added</span>
                                  ) : (
                                    <Plus className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Add model + delete provider row */}
                      <div className="flex items-center gap-2 pt-3 border-t border-zinc-300/50 dark:border-zinc-700/50">
                        <Input placeholder="Model ID" value={customNewModelId} onChange={(e) => setCustomNewModelId(e.target.value)} className={`flex-1 text-xs h-8 max-w-[200px] ${inputCls}`} />
                        <Input placeholder="Display name" value={customNewModelName} onChange={(e) => setCustomNewModelName(e.target.value)} className={`flex-1 text-xs h-8 max-w-[200px] ${inputCls}`} />
                        <Button size="sm" onClick={() => {
                          if (customNewModelId.trim() && customNewModelName.trim()) {
                            addModelToProvider(cp.id, { id: customNewModelId.trim(), name: customNewModelName.trim() });
                            addModel(cp.id, customNewModelId.trim(), customNewModelName.trim());
                            setCustomNewModelId(""); setCustomNewModelName("");
                          }
                        }} disabled={!customNewModelId.trim() || !customNewModelName.trim()} className="h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40">
                          <Plus className="h-3 w-3" />
                        </Button>
                        <div className="flex-1" />
                        <Button size="sm" variant="ghost" onClick={() => {
                          cpModels.forEach((m) => removeModel(cp.id, m.id));
                          removeCustomProvider(cp.id);
                          setExpandedProvider(null);
                        }} className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs">
                          <Trash2 className="h-3 w-3 mr-1" /> Remove Provider
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Built-in Providers ── */}
            {providers.map((p) => {
              const isExpanded = expandedProvider === p.id;
              const isOllama = p.id === "ollama";
              const isLMStudio = p.id === "lmstudio";
              const isLocalProvider = isOllama || isLMStudio;
              const models = isLocalProvider ? [] : getEffectiveModels(p.id);
              const displayModels = isLocalProvider ? getModelsForDisplay(p.id) : models;
              const modelCount = isLocalProvider && !isExpanded ? "live" : `${displayModels.length} model${displayModels.length !== 1 ? "s" : ""}`;

              return (
                <div key={p.id} className={`rounded-lg border border-zinc-300 dark:border-zinc-700 ${isExpanded ? "bg-zinc-50 dark:bg-zinc-800/50" : ""}`}>
                  <button
                    onClick={() => { setExpandedProvider(isExpanded ? null : p.id); setNewModelId(""); setNewModelName(""); setEditingNickname(null); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-white">{p.name}</span>
                    <span className="text-xs font-medium text-zinc-300 dark:text-zinc-300">{modelCount}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-300" /> : <ChevronRight className="h-4 w-4 text-zinc-300" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-300 dark:border-zinc-700 px-4 py-3 space-y-3">
                      {isOllama && ollamaLoading && (
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-300 dark:text-zinc-300 py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching models from Ollama...
                        </div>
                      )}
                      {isOllama && ollamaError && <p className="text-xs text-red-400 py-1">{ollamaError}</p>}
                      {isLMStudio && lmstudioLoading && (
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-300 dark:text-zinc-300 py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching models from LM Studio...
                        </div>
                      )}
                      {isLMStudio && lmstudioError && <p className="text-xs text-red-400 py-1">{lmstudioError}</p>}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {displayModels.map((m) => (
                          <div
                            key={m.id}
                            className={`flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-2 text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 ${editingNickname === m.id ? 'col-span-full' : ''}`}
                            style={{ minHeight: '44px' }}
                          >
                            {editingNickname === m.id ? (
                              <div className="flex flex-1 items-center gap-2">
                                <Input value={nicknameValue} onChange={(e) => setNicknameValue(e.target.value)} placeholder="Nickname (leave blank to clear)" className={`flex-1 text-xs h-7 ${inputCls}`} autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { if (nicknameValue.trim()) setNickname(m.id, nicknameValue.trim()); else removeNickname(m.id); setEditingNickname(null); }
                                    else if (e.key === "Escape") { setEditingNickname(null); }
                                  }}
                                />
                                <Button size="sm" className="h-7 bg-indigo-600 hover:bg-indigo-700 text-xs px-2" onClick={() => { if (nicknameValue.trim()) setNickname(m.id, nicknameValue.trim()); else removeNickname(m.id); setEditingNickname(null); }}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingNickname(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  {nicknames[m.id] ? (
                                    <div className="flex flex-col">
                                      <span className="font-medium text-zinc-900 dark:text-white truncate text-xs">{nicknames[m.id]}</span>
                                      <span className="text-xs text-zinc-400 dark:text-zinc-300 truncate">{m.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-800 dark:text-zinc-200 truncate block">{m.name}</span>
                                  )}
                                  <ModelRoleTags modelId={m.id} />
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {(() => {
                                    const testKey = `${p.id}:${m.id}`;
                                    const isTesting = testingModel === testKey;
                                    const result = modelTestResults[testKey];
                                    return (
                                      <button
                                        onClick={() => handleTestModel(m.id, p.id)}
                                        disabled={isTesting}
                                        className={`transition-colors text-xs font-bold px-1.5 py-0.5 rounded border ${
                                          result?.status === "ok"
                                            ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                                            : result?.status === "fail"
                                            ? "text-red-400 border-red-500/40 bg-red-500/10"
                                            : "text-zinc-400 border-zinc-600 hover:text-sky-400 hover:border-sky-500/40"
                                        }`}
                                        title={result?.error || (result?.status === "ok" ? "Connected" : "Test model connection")}
                                      >
                                        {isTesting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : result?.status === "ok" ? "OK" : result?.status === "fail" ? "FAIL" : "Test"}
                                      </button>
                                    );
                                  })()}
                                  <button onClick={() => setBuilderFlag(m.id, !isBuilderModel(m.id, p.id))} className={`transition-colors ${isBuilderModel(m.id, p.id) ? 'text-indigo-500' : 'text-zinc-400 hover:text-indigo-400'}`} title={isBuilderModel(m.id, p.id) ? "Remove from Builder" : "Add to Builder"}>
                                    <Hammer className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => { setEditingNickname(m.id); setNicknameValue(nicknames[m.id] || ""); }} className="text-zinc-400 hover:text-indigo-400" title="Set nickname">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {m.isBuiltIn ? (
                                    <span className="text-xs text-zinc-400 dark:text-zinc-300 uppercase px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700/50">built-in</span>
                                  ) : isLocalProvider ? (
                                    <span className="text-xs text-emerald-500 uppercase px-1 py-0.5 rounded bg-emerald-500/10">local</span>
                                  ) : (
                                    <button onClick={() => removeModel(p.id, m.id)} className="text-zinc-300 hover:text-red-400">
                                      <Trash2 className="h-3 w-3" />
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
                          <Input placeholder="Model ID" value={newModelId} onChange={(e) => setNewModelId(e.target.value)} className={`flex-1 text-xs h-8 max-w-[200px] ${inputCls}`} />
                          <Input placeholder="Display name" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} className={`flex-1 text-xs h-8 max-w-[200px] ${inputCls}`} />
                          <Button size="sm" onClick={() => { if (newModelId.trim() && newModelName.trim()) { addModel(p.id, newModelId.trim(), newModelName.trim()); setNewModelId(""); setNewModelName(""); } }} disabled={!newModelId.trim() || !newModelName.trim()} className="h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40">
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

        {section === "registry" && <ModelRegistry />}
        {section === "rollcall" && <RollCall />}
        {section === "orchestration" && <SettingsOrchestration />}

        {section === "roles" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Custom Roles</h2>
              <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-zinc-300">Create roles with custom system prompts. Assign them to any LLM slot in debates.</p>
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
                          <Button variant="ghost" size="sm" onClick={() => { setEditingRoleId(role.id); setEditRoleName(role.name); setEditRolePrompt(role.systemPrompt); }} className="h-6 w-6 p-0 text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300"><Pencil className="h-3 w-3" /></Button>
                          {!role.isDefault && (
                            <Button variant="ghost" size="sm" onClick={() => deleteRole(role.id)} className="h-6 w-6 p-0 text-zinc-300 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-zinc-300 dark:text-zinc-400 whitespace-pre-wrap line-clamp-3">{role.systemPrompt}</p>
                      {role.isDefault && <span className="mt-1 inline-block text-xs text-zinc-400 dark:text-zinc-300 uppercase">Default — cannot delete</span>}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={dashedCardCls}>
              <h3 className="mb-3 text-sm font-medium text-zinc-400 dark:text-zinc-300">New Role</h3>
              <Input placeholder="Role name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className={`mb-2 ${inputCls}`} />
              <textarea placeholder="System prompt" value={newRolePrompt} onChange={(e) => setNewRolePrompt(e.target.value)} rows={6} className={textareaCls} />
              <Button onClick={() => { if (newRoleName.trim() && newRolePrompt.trim()) { addRole(newRoleName.trim(), newRolePrompt.trim()); setNewRoleName(""); setNewRolePrompt(""); } }} disabled={!newRoleName.trim() || !newRolePrompt.trim()} size="sm" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"><Plus className="h-3 w-3 mr-1" /> Add Role</Button>
            </div>
          </div>
        )}

        {section === "prompts" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Saved Prompts</h2>
              <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-zinc-300">Create reusable prompt templates.</p>
            </div>
            {prompts.length === 0 && <p className="text-sm text-zinc-400 dark:text-zinc-300">No saved prompts yet.</p>}
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
                          <Button variant="ghost" size="sm" onClick={() => { setEditingPromptId(prompt.id); setEditPromptName(prompt.name); setEditPromptContent(prompt.content); }} className="h-6 w-6 p-0 text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300"><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deletePrompt(prompt.id)} className="h-6 w-6 p-0 text-zinc-300 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-zinc-300 dark:text-zinc-400 whitespace-pre-wrap line-clamp-3">{prompt.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={dashedCardCls}>
              <h3 className="mb-3 text-sm font-medium text-zinc-400 dark:text-zinc-300">New Prompt</h3>
              <Input placeholder="Prompt name" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} className={`mb-2 ${inputCls}`} />
              <textarea placeholder="Prompt template content..." value={newPromptContent} onChange={(e) => setNewPromptContent(e.target.value)} rows={6} className={textareaCls} />
              <Button onClick={() => { if (newPromptName.trim() && newPromptContent.trim()) { addPrompt(newPromptName.trim(), newPromptContent.trim()); setNewPromptName(""); setNewPromptContent(""); } }} disabled={!newPromptName.trim() || !newPromptContent.trim()} size="sm" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"><Plus className="h-3 w-3 mr-1" /> Add Prompt</Button>
            </div>
          </div>
        )}

        {section === "knowledge" && <SettingsKnowledge />}
        {section === "trading" && <SettingsTradingAPIs />}
        {section === "logic" && <SettingsLogicEditor />}

        {section === "questions" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Test Questions</h2>
              <p className="text-xs text-zinc-300 dark:text-zinc-400 mb-4">Questions used in poison pill tests.</p>
              <div className="space-y-3">
                {questions.map((q) => (
                  <div key={q.id} className={cardCls}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">{q.question}</div>
                        <div className="flex items-center gap-2 text-xs text-zinc-300 dark:text-zinc-400">
                          {q.poisonId && (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400">
                              Poison: {poisons.find(p => p.id === q.poisonId)?.name || q.poisonId}
                            </span>
                          )}
                          {q.tier && <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">{q.tier}</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="text-center py-8 text-sm text-zinc-300 dark:text-zinc-400">No questions yet.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {section === "poisons" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Poison Pills</h2>
              <p className="text-xs text-zinc-300 dark:text-zinc-400 mb-4">False claims injected into debates to test if AI agents can detect them.</p>
              <div className="space-y-3">
                {poisons.map((p) => (
                  <div key={p.id} className={cardCls}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-zinc-300 dark:text-zinc-400 mb-1">{p.name}</div>
                        <div className="text-sm text-zinc-900 dark:text-zinc-100 mb-2">&quot;{p.content}&quot;</div>
                        {p.markers && p.markers.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs text-zinc-300 dark:text-zinc-400">Markers:</span>
                            {p.markers.map((marker, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">{marker}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePoison(p.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {poisons.length === 0 && (
                  <div className="text-center py-8 text-sm text-zinc-300 dark:text-zinc-400">No poison pills yet.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {section === "build-docs" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Build Documentation</h2>
              <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-zinc-300">
                Automatically inject SARGE build documentation into AI context.
              </p>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
                <button
                  onClick={() => setBuildDocsAutoInject(!buildDocsAutoInject)}
                  className={`flex-shrink-0 h-6 w-10 rounded-full transition-colors ${buildDocsAutoInject ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`h-5 w-5 rounded-full bg-white transition-transform ${buildDocsAutoInject ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">Auto-Inject Build Docs</div>
                  <div className="text-xs text-zinc-300 dark:text-zinc-400 mt-1">
                    {buildDocsAutoInject ? 'Enabled — Docs injected invisibly into AI context per mode' : 'Disabled — No documentation injected'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {section === "diagnostics" && <PipelineDiagnostics />}

        {section === "security" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">PIN Lock</h2>
              {pinEnabled ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-300 dark:border-emerald-700/30 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <Lock className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">PIN protection is enabled</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-300 dark:text-zinc-300">App locks after 30 minutes of inactivity.</p>
                  <Button variant="ghost" onClick={removePin} className="text-red-400 hover:text-red-300 hover:bg-red-950/20">
                    <LockOpen className="h-3.5 w-3.5 mr-1.5" /> Remove PIN
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-zinc-300 dark:text-zinc-300">Set a 4-6 digit PIN to lock The Foundry.</p>
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

        {section === "guardian" && <ThreadGuardianSettings />}

        {section === "sync" && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-300">Sync Settings</h2>
              <div className="space-y-3">
                <div className={cardCls}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">Reverse Sync</div>
                      <div className="text-xs text-zinc-300 dark:text-zinc-300 mt-0.5">Copy recent changes from main app to sandbox</div>
                    </div>
                    <Button onClick={handleReverseSync} disabled={reverseSyncing} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40" size="sm">
                      {reverseSyncing ? (<><Loader2 className="h-3 w-3 mr-1 animate-spin" />Syncing...</>) : (<><RefreshCw className="h-3 w-3 mr-1" />Reverse Sync</>)}
                    </Button>
                  </div>
                  {syncMessage && (
                    <div className={`mt-3 p-3 rounded text-sm ${syncSuccess ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"}`}>
                      {syncMessage}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
