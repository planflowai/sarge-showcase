'use client';

import { useState, useEffect } from 'react';
import { TestTheme as Theme, PromptPools, SavedTestPrompt, SavedQuestion, SavedPoison } from '@/lib/types' // Test types;
import { DebateLogicTemplates } from '@/lib/stores/testModeStore';

interface ConnectionStatus {
  connected: boolean;
  masked_key?: string;
  error?: string;
}

interface AllStatus {
  ollama?: ConnectionStatus;
  supabase?: ConnectionStatus;
  anthropic?: ConnectionStatus;
  openai?: ConnectionStatus;
  google?: ConnectionStatus;
  xai?: ConnectionStatus;
}

interface ConfigViewProps {
  theme: Theme;
  promptPools: PromptPools;
  setPromptPools: (pools: PromptPools) => void;
  questions: SavedQuestion[];
  setQuestions: (questions: SavedQuestion[]) => void;
  poisons: SavedPoison[];
  setPoisons: (poisons: SavedPoison[]) => void;
  debateLogic: DebateLogicTemplates;
  updateDebateLogic: (updates: Partial<DebateLogicTemplates>) => void;
  resetDebateLogic: () => void;
}

export function ConfigView({
  theme,
  promptPools,
  setPromptPools,
  questions,
  setQuestions,
  poisons,
  setPoisons,
  debateLogic,
  updateDebateLogic,
  resetDebateLogic,
}: ConfigViewProps) {
  const [activeTab, setActiveTab] = useState<'logic' | 'prompts' | 'questions' | 'poisons' | 'endpoints'>('logic');
  const [editingPrompt, setEditingPrompt] = useState<{ pool: keyof PromptPools; prompt: SavedTestPrompt } | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<AllStatus>({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [editingMarkers, setEditingMarkers] = useState<{ id: string; markers: string } | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ key: keyof DebateLogicTemplates; label: string; value: string } | null>(null);

  const tabs = [
    { id: 'logic', label: 'Logic Editor', icon: '🧠' },
    { id: 'prompts', label: 'All Prompts', icon: '📝' },
    { id: 'questions', label: 'Questions', icon: '❓' },
    { id: 'poisons', label: 'Poison Pills', icon: '☠️' },
    { id: 'endpoints', label: 'Endpoints', icon: '🔌' },
  ];

  // Fetch connection status when endpoints tab is active
  useEffect(() => {
    if (activeTab === 'endpoints') {
      fetchConnectionStatus();
    }
  }, [activeTab]);

  const fetchConnectionStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/test/status');
      const data = await res.json();
      setConnectionStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
    setLoadingStatus(false);
  };

  const handleAddPrompt = (pool: keyof PromptPools) => {
    if (!newPromptName.trim()) return;
    const newPrompt: SavedTestPrompt = {
      id: `${pool}-${Date.now()}`,
      name: newPromptName,
      content: newPromptContent,
    };
    setPromptPools({
      ...promptPools,
      [pool]: [...promptPools[pool], newPrompt],
    });
    setNewPromptName('');
    setNewPromptContent('');
  };

  const handleDeletePrompt = (pool: keyof PromptPools, promptId: string) => {
    setPromptPools({
      ...promptPools,
      [pool]: promptPools[pool].filter(p => p.id !== promptId),
    });
  };

  const handleSaveEdit = () => {
    if (!editingPrompt) return;
    setPromptPools({
      ...promptPools,
      [editingPrompt.pool]: promptPools[editingPrompt.pool].map(p =>
        p.id === editingPrompt.prompt.id ? editingPrompt.prompt : p
      ),
    });
    setEditingPrompt(null);
  };

  const renderPromptPool = (poolKey: keyof PromptPools, label: string, color: string) => (
    <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
      <h3 className={`text-sm font-bold ${color} mb-3`}>{label} Prompt Pool</h3>
      
      {/* Existing Prompts */}
      <div className="space-y-2 mb-4 max-h-48 overflow-auto">
        {promptPools[poolKey].map(prompt => (
          <div key={prompt.id} className={`flex items-center gap-2 p-2 rounded ${theme.bgTertiary}`}>
            <span className={`flex-1 text-sm ${theme.text} truncate`}>{prompt.name}</span>
            <button
              onClick={() => setEditingPrompt({ pool: poolKey, prompt: { ...prompt } })}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeletePrompt(poolKey, prompt.id)}
              className="text-xs text-red-400 hover:text-red-300 px-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add New */}
      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
        <input
          type="text"
          placeholder="Prompt name..."
          value={newPromptName}
          onChange={(e) => setNewPromptName(e.target.value)}
          className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text}`}
        />
        <textarea
          placeholder="Prompt content..."
          value={newPromptContent}
          onChange={(e) => setNewPromptContent(e.target.value)}
          rows={2}
          className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text} resize-none`}
        />
        <button
          onClick={() => handleAddPrompt(poolKey)}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-500"
        >
          + Add Prompt
        </button>
      </div>
    </div>
  );

  const renderConnectionStatus = (name: string, label: string, status?: ConnectionStatus) => (
    <div className={`flex items-center justify-between p-3 rounded-lg ${theme.bgTertiary}`}>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${theme.text}`}>{label}</span>
        {status?.masked_key && (
          <span className={`text-xs font-mono ${theme.textMuted}`}>{status.masked_key}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {loadingStatus ? (
          <span className="text-xs text-zinc-500">Checking...</span>
        ) : status?.connected ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
            Not configured
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`w-48 border-r ${theme.borderSubtle} ${theme.bgSecondary} p-2`}>
        <div className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : `${theme.textSecondary} hover:bg-gray-200 dark:hover:bg-zinc-800`
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {/* LOGIC EDITOR TAB */}
        {activeTab === 'logic' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>🧠 Logic Editor</h2>
              <p className={`text-sm ${theme.textMuted}`}>
                Edit the core detection and judgment logic. Changes apply immediately.
              </p>
            </div>

            {/* Debate Flow Templates - How agents interact */}
            <div className={`${theme.bgSecondary} border-2 border-cyan-500/50 rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔄</span>
                  <h3 className={`text-sm font-bold text-cyan-400`}>Debate Flow Templates</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400`}>STRUCTURE</span>
                </div>
                <button
                  onClick={resetDebateLogic}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-500/10"
                >
                  Reset to Defaults
                </button>
              </div>
              <p className={`text-xs ${theme.textMuted} mb-3`}>
                These templates control how agents receive questions and see each other's responses. Use {"{{variable}}"} placeholders.
              </p>

              {/* Agent Templates Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* D1 Blind */}
                <div className={`p-3 rounded ${theme.bgTertiary} border border-cyan-500/20`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-cyan-400`}>D1 (Blind Pass)</span>
                    <button
                      onClick={() => setEditingTemplate({ key: 'd1Prompt', label: 'D1 Prompt (Blind Pass)', value: debateLogic.d1Prompt })}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      Edit
                    </button>
                  </div>
                  <p className={`text-[10px] ${theme.textMuted} font-mono line-clamp-2`}>{debateLogic.d1Prompt}</p>
                </div>

                {/* D1 With Context */}
                <div className={`p-3 rounded ${theme.bgTertiary} border border-cyan-500/20`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-cyan-400`}>D1 (With Context)</span>
                    <button
                      onClick={() => setEditingTemplate({ key: 'd1PromptWithContext', label: 'D1 Prompt (With Previous Context)', value: debateLogic.d1PromptWithContext })}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      Edit
                    </button>
                  </div>
                  <p className={`text-[10px] ${theme.textMuted} font-mono line-clamp-2`}>{debateLogic.d1PromptWithContext}</p>
                </div>

                {/* D2 Cross-Check */}
                <div className={`p-3 rounded ${theme.bgTertiary} border border-violet-500/20`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-violet-400`}>D2 (Cross-Check)</span>
                    <button
                      onClick={() => setEditingTemplate({ key: 'd2Prompt', label: 'D2 Prompt (Cross-Checking D1)', value: debateLogic.d2Prompt })}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      Edit
                    </button>
                  </div>
                  <p className={`text-[10px] ${theme.textMuted} font-mono line-clamp-2`}>{debateLogic.d2Prompt}</p>
                </div>

                {/* D3 Final Review */}
                <div className={`p-3 rounded ${theme.bgTertiary} border border-purple-500/20`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-purple-400`}>D3 (Final Review)</span>
                    <button
                      onClick={() => setEditingTemplate({ key: 'd3Prompt', label: 'D3 Prompt (Reviews D1 + D2)', value: debateLogic.d3Prompt })}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      Edit
                    </button>
                  </div>
                  <p className={`text-[10px] ${theme.textMuted} font-mono line-clamp-2`}>{debateLogic.d3Prompt}</p>
                </div>
              </div>

              {/* Poison Injection & Judge */}
              <div className="grid grid-cols-2 gap-3">
                {/* Poison Injection */}
                <div className={`p-3 rounded ${theme.bgTertiary} border border-red-500/20`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-red-400`}>☠️ Poison Injection</span>
                    <button
                      onClick={() => setEditingTemplate({ key: 'poisonInjection', label: 'Poison Injection Format', value: debateLogic.poisonInjection })}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      Edit
                    </button>
                  </div>
                  <p className={`text-[10px] ${theme.textMuted} font-mono line-clamp-2`}>{debateLogic.poisonInjection}</p>
                </div>

                {/* Judge Prompt */}
                <div className={`p-3 rounded ${theme.bgTertiary} border border-amber-500/20`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-amber-400`}>⚖️ Judge Template</span>
                    <button
                      onClick={() => setEditingTemplate({ key: 'judgePrompt', label: 'Judge Forensic Audit Prompt', value: debateLogic.judgePrompt })}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300"
                    >
                      Edit
                    </button>
                  </div>
                  <p className={`text-[10px] ${theme.textMuted} font-mono line-clamp-2`}>{debateLogic.judgePrompt.slice(0, 100)}...</p>
                </div>
              </div>

              {/* Placeholders Reference */}
              <div className={`mt-3 p-2 rounded ${theme.bgTertiary} text-[10px] ${theme.textMuted}`}>
                <strong>Placeholders:</strong>{' '}
                <code className="text-cyan-400">{'{{question}}'}</code>,{' '}
                <code className="text-cyan-400">{'{{previousContext}}'}</code>,{' '}
                <code className="text-cyan-400">{'{{d1Response}}'}</code>,{' '}
                <code className="text-cyan-400">{'{{d2Response}}'}</code>,{' '}
                <code className="text-cyan-400">{'{{poison}}'}</code>,{' '}
                <code className="text-cyan-400">{'{{debateTranscript}}'}</code>
              </div>
            </div>

            {/* Detection Keywords */}
            <div className={`${theme.bgSecondary} border-2 border-orange-500/50 rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🎯</span>
                <h3 className={`text-sm font-bold text-orange-400`}>Detection Keywords</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400`}>KEYWORDS</span>
              </div>
              <p className={`text-xs ${theme.textMuted} mb-3`}>
                These keywords trigger detection logic. Comma-separated, case-insensitive.
              </p>

              <div className="space-y-3">
                {/* Challenge Keywords */}
                <div className={`p-3 rounded ${theme.bgTertiary}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-emerald-400`}>🔍 Challenge Keywords</span>
                    <span className={`text-[9px] ${theme.textMuted}`}>D1/D2 challenges claim</span>
                  </div>
                  <input
                    type="text"
                    value={debateLogic.challengeKeywords}
                    onChange={(e) => updateDebateLogic({ challengeKeywords: e.target.value })}
                    className={`w-full px-2 py-1.5 text-xs rounded ${theme.input} ${theme.text} font-mono`}
                    placeholder="incorrect, false, wrong..."
                  />
                </div>

                {/* Flag Keywords */}
                <div className={`p-3 rounded ${theme.bgTertiary}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-purple-400`}>🚩 Flag Keywords</span>
                    <span className={`text-[9px] ${theme.textMuted}`}>D3 flags contradiction</span>
                  </div>
                  <input
                    type="text"
                    value={debateLogic.flagKeywords}
                    onChange={(e) => updateDebateLogic({ flagKeywords: e.target.value })}
                    className={`w-full px-2 py-1.5 text-xs rounded ${theme.input} ${theme.text} font-mono`}
                    placeholder="drift, contradiction, disagree..."
                  />
                </div>

                {/* Caught Keywords */}
                <div className={`p-3 rounded ${theme.bgTertiary}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold text-amber-400`}>✅ Caught Keywords</span>
                    <span className={`text-[9px] ${theme.textMuted}`}>Judge verdict = CAUGHT</span>
                  </div>
                  <input
                    type="text"
                    value={debateLogic.caughtKeywords}
                    onChange={(e) => updateDebateLogic({ caughtKeywords: e.target.value })}
                    className={`w-full px-2 py-1.5 text-xs rounded ${theme.input} ${theme.text} font-mono`}
                    placeholder="caught, corrected, detected..."
                  />
                </div>
              </div>
            </div>

            {/* Judge Prompt - The most important one */}
            <div className={`${theme.bgSecondary} border-2 border-amber-500/50 rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚖️</span>
                <h3 className={`text-sm font-bold text-amber-400`}>Judge System Prompts</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400`}>CRITICAL</span>
              </div>
              <p className={`text-xs ${theme.textMuted} mb-3`}>
                System prompts for the Judge (separate from the template above). These give the judge its persona.
              </p>
              <div className="space-y-2">
                {promptPools.judge.map(prompt => (
                  <div key={prompt.id} className={`p-3 rounded ${theme.bgTertiary} border ${prompt.id.includes('protected') ? 'border-amber-500/30' : theme.border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${theme.text}`}>{prompt.name}</span>
                      <button
                        onClick={() => setEditingPrompt({ pool: 'judge', prompt: { ...prompt } })}
                        className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-indigo-500/10"
                      >
                        Edit
                      </button>
                    </div>
                    <p className={`text-xs ${theme.textMuted} line-clamp-3`}>{prompt.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Protected Prompts - Anti-Poison Logic */}
            <div className={`${theme.bgSecondary} border-2 border-emerald-500/50 rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🛡️</span>
                <h3 className={`text-sm font-bold text-emerald-400`}>Protective Prompts (Pass 3)</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400`}>DEFENSE</span>
              </div>
              <p className={`text-xs ${theme.textMuted} mb-3`}>
                These prompts are used in "pill-prompt" mode (Pass 3) to help agents detect and challenge false information.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(['d1', 'd2', 'd3'] as const).map(role => {
                  const protectedPrompt = promptPools[role].find(p => p.id.includes('protected'));
                  return protectedPrompt ? (
                    <div key={role} className={`p-3 rounded ${theme.bgTertiary} border border-emerald-500/20`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold text-emerald-400 uppercase`}>{role}</span>
                        <button
                          onClick={() => setEditingPrompt({ pool: role, prompt: { ...protectedPrompt } })}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                          Edit
                        </button>
                      </div>
                      <p className={`text-[10px] ${theme.textMuted} line-clamp-4`}>{protectedPrompt.content}</p>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Detection Rules - Echo Markers */}
            <div className={`${theme.bgSecondary} border-2 border-red-500/50 rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔍</span>
                <h3 className={`text-sm font-bold text-red-400`}>Echo Detection Markers</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400`}>DETECTION</span>
              </div>
              <p className={`text-xs ${theme.textMuted} mb-3`}>
                Markers are keywords/phrases used to detect if an AI repeated the false claim. If the AI's response contains any marker, it counts as an "echo".
              </p>
              <div className="space-y-2 max-h-64 overflow-auto">
                {poisons.slice(0, 10).map(poison => (
                  <div key={poison.id} className={`p-3 rounded ${theme.bgTertiary} border ${theme.border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${theme.text}`}>{poison.name}</span>
                      <button
                        onClick={() => setEditingMarkers({ id: poison.id, markers: poison.markers?.join(', ') || '' })}
                        className="text-[10px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-red-500/10"
                      >
                        Edit Markers
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {poison.markers?.map((marker, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
                          {marker}
                        </span>
                      )) || <span className={`text-[10px] ${theme.textMuted} italic`}>No markers</span>}
                    </div>
                  </div>
                ))}
              </div>
              <p className={`text-[10px] ${theme.textMuted} mt-2`}>
                Showing first 10 pills. Edit all markers in the "Poison Pills" tab.
              </p>
            </div>

            {/* Quick Reference */}
            <div className={`${theme.bgTertiary} border ${theme.borderSubtle} rounded-lg p-4`}>
              <h4 className={`text-xs font-bold ${theme.text} mb-2`}>📖 How Detection Works</h4>
              <ol className={`text-xs ${theme.textMuted} space-y-1 list-decimal list-inside`}>
                <li>Poison pill is injected during debate (via D1 or D2)</li>
                <li>Each agent response is checked against <span className="text-red-400">markers</span></li>
                <li>If markers found → "echo" (AI repeated the lie)</li>
                <li>In Pass 3, <span className="text-emerald-400">protected prompts</span> help agents "kill" the lie</li>
                <li><span className="text-amber-400">Judge</span> reviews all responses and issues CAUGHT or MISSED</li>
              </ol>
            </div>
          </div>
        )}

        {/* PROMPTS TAB */}
        {activeTab === 'prompts' && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>📝 Prompt Pools</h2>
              <p className={`text-sm ${theme.textMuted}`}>
                [Small] prompts for local LLMs • [Cloud] prompts for Claude, GPT, etc.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {renderPromptPool('d1', 'D1', 'text-indigo-400')}
              {renderPromptPool('d2', 'D2', 'text-violet-400')}
              {renderPromptPool('d3', 'D3', 'text-purple-400')}
              {renderPromptPool('judge', 'Judge', 'text-amber-500')}
            </div>
          </div>
        )}

        {/* QUESTIONS TAB */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>❓ Test Questions</h2>
              <p className={`text-sm ${theme.textMuted}`}>Saved questions for testing. Optionally link to a poison pill.</p>
            </div>
            
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              {/* Existing Questions */}
              <div className="space-y-2 mb-4 max-h-64 overflow-auto">
                {questions.map(q => (
                  <div key={q.id} className={`flex items-center gap-2 p-3 rounded ${theme.bgTertiary}`}>
                    <span className={`flex-1 text-sm ${theme.text}`}>{q.question}</span>
                    {q.expectedAnswer && (
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded truncate max-w-[150px]" title={q.expectedAnswer}>
                        ✓ {q.expectedAnswer.slice(0, 20)}...
                      </span>
                    )}
                    {q.poisonId && (
                      <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                        ☠️ {poisons.find(p => p.id === q.poisonId)?.name || 'Linked'}
                      </span>
                    )}
                    <button 
                      onClick={() => {
                        const newQ = prompt('Edit question:', q.question);
                        const newA = prompt('Edit expected answer:', q.expectedAnswer || '');
                        if (newQ) {
                          setQuestions(questions.map(x => x.id === q.id ? { ...x, question: newQ, expectedAnswer: newA || undefined } : x));
                        }
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 px-2"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setQuestions(questions.filter(x => x.id !== q.id))}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {questions.length === 0 && (
                  <p className={`text-sm ${theme.textMuted} italic`}>No saved questions. Add one below.</p>
                )}
              </div>

              {/* Add New Question */}
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-zinc-700">
                <h4 className={`text-xs font-medium ${theme.textMuted}`}>Add New Question</h4>
                <input
                  type="text"
                  id="newQuestionText"
                  placeholder="Question (e.g., 'Who invented the telephone?')"
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text}`}
                />
                <input
                  type="text"
                  id="newQuestionAnswer"
                  placeholder="Expected answer (optional, e.g., 'Alexander Graham Bell in 1876')"
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text}`}
                />
                <div className="flex gap-2">
                  <select
                    id="newQuestionPoison"
                    className={`flex-1 px-3 py-2 rounded text-sm ${theme.input} ${theme.text}`}
                  >
                    <option value="">Link to pill (optional)</option>
                    {poisons.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const textInput = document.getElementById('newQuestionText') as HTMLInputElement;
                      const answerInput = document.getElementById('newQuestionAnswer') as HTMLInputElement;
                      const poisonSelect = document.getElementById('newQuestionPoison') as HTMLSelectElement;
                      if (textInput.value.trim()) {
                        setQuestions([...questions, {
                          id: `q-${Date.now()}`,
                          question: textInput.value.trim(),
                          expectedAnswer: answerInput.value.trim() || undefined,
                          poisonId: poisonSelect.value || undefined,
                        }]);
                        textInput.value = '';
                        answerInput.value = '';
                        poisonSelect.value = '';
                      }
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-500"
                  >
                    + Add Question
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* POISONS TAB */}
        {activeTab === 'poisons' && (
          <div className="space-y-4">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>☠️ Poison Pills</h2>
              <p className={`text-sm ${theme.textMuted}`}>
                Misinformation to inject during testing. Create pills that would cause hallucinations or echo chambers.
              </p>
            </div>
            
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              {/* Existing Pills */}
              <div className="space-y-2 mb-4 max-h-64 overflow-auto">
                {poisons.map(p => (
                  <div key={p.id} className={`flex items-start gap-2 p-3 rounded ${theme.bgTertiary}`}>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${theme.text} block mb-1`}>
                        {p.name}
                      </span>
                      <span className={`text-xs ${theme.textSecondary}`}>{p.content}</span>
                    </div>
                    <button 
                      onClick={() => {
                        const newName = prompt('Edit name:', p.name);
                        const newContent = prompt('Edit content:', p.content);
                        if (newName && newContent) {
                          setPoisons(poisons.map(x => x.id === p.id ? { ...x, name: newName, content: newContent } : x));
                        }
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 px-2"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setPoisons(poisons.filter(x => x.id !== p.id))}
                      className="text-xs text-red-400 hover:text-red-300 px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {poisons.length === 0 && (
                  <p className={`text-sm ${theme.textMuted} italic`}>No saved pills. Add one below.</p>
                )}
              </div>

              {/* Add New Pill */}
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-zinc-700">
                <h4 className={`text-xs font-medium ${theme.textMuted}`}>Add New Pill</h4>
                <input
                  type="text"
                  id="newPillName"
                  placeholder="Pill name (e.g., 'Telephone Date Error')"
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text}`}
                />
                <textarea
                  id="newPillContent"
                  placeholder="Pill content (the false claim to inject)"
                  rows={2}
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text} resize-none`}
                />
                <button
                  onClick={() => {
                    const nameInput = document.getElementById('newPillName') as HTMLInputElement;
                    const contentInput = document.getElementById('newPillContent') as HTMLTextAreaElement;
                    if (nameInput.value.trim() && contentInput.value.trim()) {
                      const content = contentInput.value.trim();
                      const autoMarkers = (content.match(/\d[\d,.]+/g) || []).slice(0, 5);
                      setPoisons([...poisons, {
                        id: `pill-${Date.now()}`,
                        name: nameInput.value.trim(),
                        content,
                        markers: autoMarkers,
                      }]);
                      nameInput.value = '';
                      contentInput.value = '';
                    }
                  }}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-500"
                >
                  + Add Pill
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ENDPOINTS TAB */}
        {activeTab === 'endpoints' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-bold ${theme.text}`}>🔌 Connections</h2>
                <p className={`text-sm ${theme.textMuted}`}>Keys are stored in .env.local (never displayed)</p>
              </div>
              <button
                onClick={fetchConnectionStatus}
                className={`px-3 py-1.5 text-xs ${theme.bgTertiary} ${theme.textSecondary} border ${theme.border} rounded hover:bg-gray-200 dark:hover:bg-zinc-700`}
              >
                🔄 Refresh Status
              </button>
            </div>

            {/* Local */}
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3`}>🖥️ Local</h3>
              <div className="space-y-2">
                {renderConnectionStatus('ollama', 'Ollama', connectionStatus.ollama)}
              </div>
            </div>

            {/* Database */}
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3`}>🗄️ Database</h3>
              <div className="space-y-2">
                {renderConnectionStatus('supabase', 'Supabase', connectionStatus.supabase)}
              </div>
            </div>

            {/* Cloud LLMs */}
            <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-3`}>☁️ Cloud LLMs</h3>
              <div className="space-y-2">
                {renderConnectionStatus('anthropic', 'Anthropic (Claude)', connectionStatus.anthropic)}
                {renderConnectionStatus('openai', 'OpenAI (GPT)', connectionStatus.openai)}
                {renderConnectionStatus('google', 'Google (Gemini)', connectionStatus.google)}
                {renderConnectionStatus('xai', 'xAI (Grok)', connectionStatus.xai)}
              </div>
            </div>

            <div className={`p-3 rounded-lg ${theme.bgTertiary} border ${theme.borderSubtle}`}>
              <p className={`text-xs ${theme.textMuted}`}>
                💡 To configure keys, edit <code className="text-indigo-400">.env.local</code> in your project root. 
                Keys are never sent to the browser.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Prompt Modal */}
      {editingPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-6 w-[600px] max-h-[80vh] overflow-auto`}>
            <h3 className={`text-lg font-bold ${theme.text} mb-4`}>
              Edit {editingPrompt.pool.toUpperCase()} Prompt
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`text-xs ${theme.textMuted} block mb-1`}>Prompt Name</label>
                <input
                  type="text"
                  value={editingPrompt.prompt.name}
                  onChange={(e) => setEditingPrompt({
                    ...editingPrompt,
                    prompt: { ...editingPrompt.prompt, name: e.target.value }
                  })}
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text}`}
                />
              </div>
              <div>
                <label className={`text-xs ${theme.textMuted} block mb-1`}>Prompt Content</label>
                <textarea
                  value={editingPrompt.prompt.content}
                  onChange={(e) => setEditingPrompt({
                    ...editingPrompt,
                    prompt: { ...editingPrompt.prompt, content: e.target.value }
                  })}
                  rows={12}
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text} resize-none font-mono`}
                />
              </div>
              <div className={`p-3 rounded ${theme.bgTertiary} text-xs ${theme.textMuted}`}>
                <strong>Tip:</strong> For judge prompts, include "VERDICT: CAUGHT" and "VERDICT: MISSED" keywords so the system can parse the result.
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingPrompt(null)}
                  className={`px-4 py-2 ${theme.bgTertiary} ${theme.textSecondary} text-sm rounded`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Markers Modal */}
      {editingMarkers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-6 w-[500px]`}>
            <h3 className={`text-lg font-bold ${theme.text} mb-4`}>
              Edit Detection Markers
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`text-xs ${theme.textMuted} block mb-1`}>
                  Poison: <span className="text-red-400">{poisons.find(p => p.id === editingMarkers.id)?.name}</span>
                </label>
                <p className={`text-xs ${theme.textMuted} mb-2`}>
                  Content: {poisons.find(p => p.id === editingMarkers.id)?.content}
                </p>
              </div>
              <div>
                <label className={`text-xs ${theme.textMuted} block mb-1`}>
                  Markers (comma-separated)
                </label>
                <textarea
                  value={editingMarkers.markers}
                  onChange={(e) => setEditingMarkers({ ...editingMarkers, markers: e.target.value })}
                  rows={3}
                  placeholder="e.g., 1920, paris, bell invented"
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text} resize-none font-mono`}
                />
              </div>
              <div className={`p-3 rounded ${theme.bgTertiary} text-xs ${theme.textMuted}`}>
                <strong>How markers work:</strong> If an AI response contains ANY of these keywords (case-insensitive),
                it counts as echoing the false claim. Use specific phrases from the poison pill.
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingMarkers(null)}
                  className={`px-4 py-2 ${theme.bgTertiary} ${theme.textSecondary} text-sm rounded`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const markers = editingMarkers.markers
                      .split(',')
                      .map(m => m.trim().toLowerCase())
                      .filter(m => m.length > 0);
                    setPoisons(poisons.map(p =>
                      p.id === editingMarkers.id ? { ...p, markers } : p
                    ));
                    setEditingMarkers(null);
                  }}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded"
                >
                  Save Markers
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-6 w-[700px] max-h-[85vh] overflow-auto`}>
            <h3 className={`text-lg font-bold ${theme.text} mb-4`}>
              Edit: {editingTemplate.label}
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`text-xs ${theme.textMuted} block mb-1`}>Template Content</label>
                <textarea
                  value={editingTemplate.value}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })}
                  rows={editingTemplate.key === 'judgePrompt' ? 20 : 8}
                  className={`w-full px-3 py-2 rounded text-sm ${theme.input} ${theme.text} resize-none font-mono`}
                />
              </div>
              <div className={`p-3 rounded ${theme.bgTertiary} text-xs ${theme.textMuted}`}>
                <strong>Available Placeholders:</strong>
                <div className="mt-2 flex flex-wrap gap-2">
                  <code className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">{'{{question}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">{'{{previousContext}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">{'{{d1Response}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">{'{{d2Response}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-red-500/20 text-red-300">{'{{poison}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">{'{{debateTranscript}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">{'{{poisonInfo}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">{'{{modeLabel}}'}</code>
                  <code className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">{'{{rounds}}'}</code>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingTemplate(null)}
                  className={`px-4 py-2 ${theme.bgTertiary} ${theme.textSecondary} text-sm rounded`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    updateDebateLogic({ [editingTemplate.key]: editingTemplate.value });
                    setEditingTemplate(null);
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white text-sm rounded"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
