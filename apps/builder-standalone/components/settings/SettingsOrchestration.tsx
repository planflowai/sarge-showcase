"use client";

import { useState } from "react";
import {
  Layers, Cpu, Zap, GitBranch, Users, Settings, Scale, RefreshCw,
  Save, Plus, Trash2, Pencil, X, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAIModeStore, type ExecutionMode, type FlowType, type AgentConfig, providers } from "@sarge/core";
import { inputCls, textareaCls, cardCls, dashedCardCls } from "./settingsStyles";

export default function SettingsOrchestration() {
  const executionMode = useAIModeStore((s) => s.executionMode);
  const agentCount = useAIModeStore((s) => s.agentCount);
  const agents = useAIModeStore((s) => s.agents);
  const flowType = useAIModeStore((s) => s.flowType);
  const hasJudge = useAIModeStore((s) => s.hasJudge);
  const judgeConfig = useAIModeStore((s) => s.judgeConfig);
  const fallbackEnabled = useAIModeStore((s) => s.fallbackEnabled);
  const fallbackChain = useAIModeStore((s) => s.fallbackChain);
  const presets = useAIModeStore((s) => s.presets);
  const activePresetId = useAIModeStore((s) => s.activePresetId);
  const setExecutionMode = useAIModeStore((s) => s.setExecutionMode);
  const setAgentCount = useAIModeStore((s) => s.setAgentCount);
  const setFlowType = useAIModeStore((s) => s.setFlowType);
  const setHasJudge = useAIModeStore((s) => s.setHasJudge);
  const setFallbackEnabled = useAIModeStore((s) => s.setFallbackEnabled);
  const setFallbackChain = useAIModeStore((s) => s.setFallbackChain);
  const updateAgent = useAIModeStore((s) => s.updateAgent);
  const applyPreset = useAIModeStore((s) => s.applyPreset);
  const saveAsPreset = useAIModeStore((s) => s.saveAsPreset);
  const deletePreset = useAIModeStore((s) => s.deletePreset);
  const getDisplayName_ai = useAIModeStore((s) => s.getDisplayName);

  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-100 dark:text-white">AI Orchestration</h2>
        <p className="mb-4 text-xs font-medium text-zinc-300 dark:text-white">
          Configure how AI agents work together. Single agent, multi-agent debates, judge mode, or custom pipelines.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300">Current:</span>
          <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
            {getDisplayName_ai()}
          </span>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-500" />
          Quick Presets
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                activePresetId === preset.id
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-900 dark:text-white">{preset.name}</span>
                {preset.id.startsWith("custom-") && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                    className="text-zinc-100 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-300 dark:text-zinc-100">{preset.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  preset.executionMode === "local" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                  preset.executionMode === "cloud" ? "bg-violet-500/20 text-violet-600 dark:text-violet-400" :
                  "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}>
                  {preset.executionMode}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-300 dark:text-zinc-100">
                  {preset.agentCount} agent{preset.agentCount > 1 ? "s" : ""}
                </span>
                {preset.hasJudge && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                    +judge
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-indigo-500" />
          Execution Mode
        </h3>
        <div className="flex gap-2">
          {(["local", "cloud", "hybrid"] as ExecutionMode[]).map((mode) => (
            <Button
              key={mode}
              variant={executionMode === mode ? "secondary" : "ghost"}
              onClick={() => setExecutionMode(mode)}
              className="capitalize"
            >
              {mode === "local" && <Cpu className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />}
              {mode === "cloud" && <Zap className="h-3.5 w-3.5 mr-1.5 text-violet-500" />}
              {mode === "hybrid" && <GitBranch className="h-3.5 w-3.5 mr-1.5 text-amber-500" />}
              {mode}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-300 dark:text-zinc-100">
          {executionMode === "local" && "Use local models only (Ollama). Fast and free."}
          {executionMode === "cloud" && "Use cloud models (Claude, GPT, etc.). More capable."}
          {executionMode === "hybrid" && "Try local first, fall back to cloud on failure."}
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          Agent Count
        </h3>
        <div className="flex gap-2">
          {([1, 2, 3, 4] as const).map((count) => (
            <Button
              key={count}
              variant={agentCount === count ? "secondary" : "ghost"}
              onClick={() => setAgentCount(count)}
              className="w-12"
            >
              {count}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-300 dark:text-zinc-100">
          {agentCount === 1 && "Single agent mode. Simple and fast."}
          {agentCount === 2 && "Two agents can debate or review each other."}
          {agentCount === 3 && "Three agents for triangulation or pipeline."}
          {agentCount === 4 && "Four agents for complex workflows."}
        </p>
      </section>

      {agentCount > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-500" />
            Agent Configuration
          </h3>
          <div className="space-y-2">
            {agents.map((agent, idx) => (
              <div key={agent.id} className={`${cardCls} ${editingAgent === agent.id ? 'ring-2 ring-indigo-500' : ''}`}>
                {editingAgent === agent.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={agent.name}
                        onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                        placeholder="Agent name"
                        className={`flex-1 text-sm ${inputCls}`}
                      />
                      <select
                        value={agent.role}
                        onChange={(e) => updateAgent(agent.id, { role: e.target.value as AgentConfig["role"] })}
                        className={`rounded border px-2 py-1.5 text-sm ${inputCls}`}
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="critic">Critic</option>
                        <option value="synthesizer">Synthesizer</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={agent.provider}
                        onChange={(e) => updateAgent(agent.id, { provider: e.target.value })}
                        className={`rounded border px-2 py-1.5 text-sm flex-1 ${inputCls}`}
                      >
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <Input
                        value={agent.model}
                        onChange={(e) => updateAgent(agent.id, { model: e.target.value })}
                        placeholder="Model ID"
                        className={`flex-1 text-sm ${inputCls}`}
                      />
                    </div>
                    <textarea
                      value={agent.systemPrompt || ""}
                      onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
                      placeholder="Custom system prompt (optional)"
                      className={`${textareaCls} h-20`}
                    />
                    <Button size="sm" onClick={() => setEditingAgent(null)} className="bg-indigo-600 hover:bg-indigo-700">
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-zinc-100 w-6">#{idx + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">{agent.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            agent.role === "primary" ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" :
                            agent.role === "critic" ? "bg-red-500/20 text-red-600 dark:text-red-400" :
                            agent.role === "synthesizer" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                            "bg-zinc-200 dark:bg-zinc-700 text-zinc-300 dark:text-zinc-100"
                          }`}>
                            {agent.role}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-300">{agent.provider}:{agent.model}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEditingAgent(agent.id)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {agentCount > 1 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-indigo-500" />
            Flow Type
          </h3>
          <div className="flex gap-2">
            {(["sequential", "parallel"] as FlowType[]).map((type) => (
              <Button
                key={type}
                variant={flowType === type ? "secondary" : "ghost"}
                onClick={() => setFlowType(type)}
                className="capitalize"
              >
                {type === "sequential" && <ArrowRight className="h-3.5 w-3.5 mr-1.5" />}
                {type === "parallel" && <Layers className="h-3.5 w-3.5 mr-1.5" />}
                {type}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-300 dark:text-zinc-100">
            {flowType === "sequential" && "Agents run one after another. Output of one feeds the next."}
            {flowType === "parallel" && "Agents run simultaneously. Compare or vote on results."}
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Scale className="h-4 w-4 text-indigo-500" />
          Judge Mode
        </h3>
        <div className="flex items-center gap-3">
          <Button
            variant={hasJudge ? "secondary" : "ghost"}
            onClick={() => setHasJudge(!hasJudge)}
          >
            {hasJudge ? "Enabled" : "Disabled"}
          </Button>
          {hasJudge && (
            <span className="text-xs text-zinc-300">
              Judge: {judgeConfig.provider}:{judgeConfig.model}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-300 dark:text-zinc-100">
          {hasJudge
            ? "A judge agent evaluates all responses and picks the best one."
            : "No judge. User picks or all responses are shown."}
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-indigo-500" />
          Fallback Chain
        </h3>
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant={fallbackEnabled ? "secondary" : "ghost"}
            onClick={() => setFallbackEnabled(!fallbackEnabled)}
          >
            {fallbackEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>
        {fallbackEnabled && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-300 dark:text-zinc-100">
              If primary model fails, try these in order:
            </p>
            <div className="flex flex-wrap gap-2">
              {fallbackChain.map((model, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-xs text-zinc-100 dark:text-white flex items-center gap-1"
                >
                  {idx + 1}. {model}
                  <button
                    onClick={() => setFallbackChain(fallbackChain.filter((_, i) => i !== idx))}
                    className="text-zinc-100 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input
              placeholder="Add fallback (e.g., anthropic:claude-sonnet-4-20250514)"
              className={`text-sm ${inputCls}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) {
                  setFallbackChain([...fallbackChain, e.currentTarget.value.trim()]);
                  e.currentTarget.value = "";
                }
              }}
            />
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Save className="h-4 w-4 text-indigo-500" />
          Save Configuration
        </h3>
        {showSavePreset ? (
          <div className={`${dashedCardCls} space-y-3`}>
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name"
              className={inputCls}
            />
            <Input
              value={newPresetDesc}
              onChange={(e) => setNewPresetDesc(e.target.value)}
              placeholder="Short description"
              className={inputCls}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (newPresetName.trim()) {
                    saveAsPreset(newPresetName.trim(), newPresetDesc.trim());
                    setNewPresetName("");
                    setNewPresetDesc("");
                    setShowSavePreset(false);
                  }
                }}
                disabled={!newPresetName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
              >
                <Save className="h-3 w-3 mr-1" /> Save Preset
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSavePreset(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setShowSavePreset(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Save Current as Preset
          </Button>
        )}
      </section>
    </div>
  );
}
