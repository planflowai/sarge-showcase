"use client";

import { useEffect, useState } from "react";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { getTestTheme, EnhancedForensicEvent } from "@/lib/types";
import { TestModeLLMSection } from "./TestModeLLMSection";
import { BatchView } from "./BatchView";
import { LiveConsolePanel } from "./LiveConsolePanel";
import { LivePassColumn } from "./LivePassColumn";
import { Shield, FlaskConical, Swords, Save, Plus } from 'lucide-react';

// Speed mode configuration - 3 core scientific modes (matches BatchView)
// NOTE: Protected mode merged into Defense - Defense always uses protective prompts
const SPEED_MODES = [
  {
    id: 4,
    name: 'Full Experiment',
    description: 'Baseline + Poison + Defense',
    tooltip: 'Complete scientific test: baseline behavior, poison injection, then defense with protective prompts',
    passes: ['baseline', 'poison', 'defense'],
    color: 'from-emerald-500 to-teal-600',
    icon: Swords,
  },
  {
    id: 3,
    name: 'Poison + Defense',
    description: 'Inject poison → test defense',
    tooltip: 'Injects poison, then tests defense layer with protective prompts, kills, and recovery',
    passes: ['poison', 'defense'],
    color: 'from-purple-500 to-pink-500',
    icon: FlaskConical,
  },
  {
    id: 1,
    name: 'Defense Only',
    description: 'Protective prompts + kills',
    tooltip: 'Tests defense layer with protective prompts, kill detection, and recovery — no poison injection',
    passes: ['defense'],
    color: 'from-cyan-500 to-blue-500',
    icon: Shield,
  },
];

export function TestModeView() {
  console.log('[TestModeView] Component rendered');
  const batchModeActive = useTestModeStore((s) => s.batchModeActive);
  const batchConfig = useTestModeStore((s) => s.batchConfig);
  const setBatchConfig = useTestModeStore((s) => s.setBatchConfig);
  const stats = useTestModeStore((s) => s.stats);

  // Test page state (segregated from Batch)
  const testSpeedMode = useTestModeStore((s) => s.testSpeedMode);
  const setTestSpeedMode = useTestModeStore((s) => s.setTestSpeedMode);
  const testAgentMode = useTestModeStore((s) => s.testAgentMode);
  const setTestAgentMode = useTestModeStore((s) => s.setTestAgentMode);
  const testRunning = useTestModeStore((s) => s.testRunning);
  const testEvents = useTestModeStore((s) => s.testEvents);
  const testPassLogs = useTestModeStore((s) => s.testPassLogs);
  const testCurrentPass = useTestModeStore((s) => s.testCurrentPass);

  // Test page actions
  const runSingleTest = useTestModeStore((s) => s.runSingleTest);
  const stopSingleTest = useTestModeStore((s) => s.stopSingleTest);
  const clearTestResults = useTestModeStore((s) => s.clearTestResults);

  // Inputs
  const poison = useTestModeStore((s) => s.poison);
  const setPoison = useTestModeStore((s) => s.setPoison);
  const question = useTestModeStore((s) => s.question);
  const setQuestion = useTestModeStore((s) => s.setQuestion);

  console.log('[TestModeView] question:', JSON.stringify(question), 'poison:', JSON.stringify(poison), 'button disabled:', !question.trim() || !poison.trim());
  const poisons = useTestModeStore((s) => s.poisons);
  const questions = useTestModeStore((s) => s.questions);
  const source = useTestModeStore((s) => s.source);
  const setSource = useTestModeStore((s) => s.setSource);

  // Slots for LLM selection
  const slots = useTestModeStore((s) => s.slots);

  // Save functions
  const addQuestion = useTestModeStore((s) => s.addQuestion);
  const addPoison = useTestModeStore((s) => s.addPoison);

  // Local state for markers
  const [markers, setMarkers] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Use the main app's theme — single source of truth
  const mainTheme = useSettingsStore((s) => s.theme);
  const darkMode = mainTheme === "dark";
  const theme = getTestTheme(darkMode);

  // Handle running test
  const handleRunTest = async () => {
    try {
      console.log('[handleRunTest] Button clicked');
      console.log('[handleRunTest] runSingleTest type:', typeof runSingleTest);
      console.log('[handleRunTest] Question:', question);
      console.log('[handleRunTest] Poison:', poison);
      console.log('[handleRunTest] Source:', source);

      if (typeof runSingleTest !== 'function') {
        console.error('[handleRunTest] ERROR: runSingleTest is not a function!', runSingleTest);
        return;
      }

      const markerList = markers.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
      console.log('[handleRunTest] Marker list:', markerList);
      console.log('[handleRunTest] Calling runSingleTest');
      await runSingleTest(question, poison, markerList, source);
      console.log('[handleRunTest] runSingleTest completed');
    } catch (error) {
      console.error('[handleRunTest] Error:', error);
    }
  };

  // Handle clear
  const handleClear = () => {
    clearTestResults();
    setMarkers('');
  };

  // Handle save to library
  const handleSaveToLibrary = () => {
    if (!question.trim() || !poison.trim()) return;

    const markerList = markers.split(',').map(m => m.trim()).filter(Boolean);
    const poisonId = `p-custom-${Date.now()}`;
    const questionId = `q-custom-${Date.now()}`;

    // Save poison first
    addPoison({
      id: poisonId,
      name: `[Custom] ${poison.slice(0, 30)}...`,
      content: poison.trim(),
      markers: markerList.length > 0 ? markerList : ['custom'],
    });

    // Save question linked to poison
    addQuestion({
      id: questionId,
      question: question.trim(),
      poisonId: poisonId,
      tier: 'custom' as any,
    });

    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  // If in Batch mode, render BatchView
  if (batchModeActive) {
    return (
      <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
        <BatchView
          theme={theme}
          batchConfig={batchConfig}
          setBatchConfig={setBatchConfig}
          stats={stats}
        />
      </div>
    );
  }

  // Check if slots are configured
  const slotsConfigured = slots?.length > 0 && slots.some(s => s.provider && s.model);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      {/* ══════════════════════════════════════════════════════════════════
          LLM SELECTION - D1, D2, D3, Judge dropdowns
          ══════════════════════════════════════════════════════════════════ */}
      <TestModeLLMSection />

      {/* ══════════════════════════════════════════════════════════════════
          CONTROL BAR - Matches BatchView layout
          Line 1: LLM Config (source)
          Line 2: Agent Config
          Line 3: Test Modes
          Line 4: Question & Poison inputs
          Line 5: Run controls
          ══════════════════════════════════════════════════════════════════ */}
      <div className={`shrink-0 px-4 py-3 border-b ${theme.border} ${theme.bgSecondary} flex flex-col gap-2`}>

        {/* ═══ LINE 1: LLM SOURCE (fallback when slots not configured) ═══ */}
        {!slotsConfigured && (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wide`}>Fallback LLM:</span>

            {/* Source Toggle */}
            <div className="flex items-center rounded-md overflow-hidden border border-gray-300 dark:border-zinc-600">
              <button
                onClick={() => setSource('local')}
                disabled={testRunning}
                className={`px-3 py-1 text-xs font-semibold transition-all ${
                  source === 'local' ? 'bg-cyan-500 dark:bg-cyan-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                } disabled:opacity-50`}
              >
                Local
              </button>
              <button
                onClick={() => setSource('cloud')}
                disabled={testRunning}
                className={`px-3 py-1 text-xs font-semibold transition-all ${
                  source === 'cloud' ? 'bg-purple-500 dark:bg-purple-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                } disabled:opacity-50`}
              >
                Cloud
              </button>
            </div>
            <span className="text-[10px] text-amber-500">⚠️ Configure LLMs above for full pipeline</span>
          </div>
        )}

        {/* ═══ LINE 2: AGENT CONFIG ═══ */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wide`}>Agents:</span>
          {[
            { id: '2', label: '2 LLMs', desc: 'D1+D2 sanity check', color: 'from-sky-400 to-cyan-500' },
            { id: '3', label: '3 LLMs', desc: 'D1+D2+D3 sanity check', color: 'from-sky-500 to-blue-500' },
            { id: '2j', label: '2+Judge', desc: 'Lightweight adversarial', color: 'from-amber-500 to-orange-500' },
            { id: '3j', label: '3+Judge', desc: 'Full SARGE', color: 'from-emerald-500 to-teal-600' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => !testRunning && setTestAgentMode(mode.id as '2' | '3' | '2j' | '3j')}
              disabled={testRunning}
              className={`relative px-3 py-1.5 rounded-md text-xs font-semibold transition-all group border ${
                testAgentMode === mode.id
                  ? `bg-gradient-to-r ${mode.color} text-white shadow border-transparent`
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 border-gray-300 dark:border-zinc-600'
              } disabled:opacity-50`}
            >
              {mode.label}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 dark:bg-zinc-900 text-[10px] text-gray-100 dark:text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700 dark:border-zinc-700 z-20 whitespace-nowrap">
                {mode.desc}
              </div>
            </button>
          ))}
          {(testAgentMode === '2' || testAgentMode === '3') && (
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium ml-1">Sanity check only</span>
          )}
        </div>

        {/* ═══ LINE 3: TEST MODES (only for judge modes) ═══ */}
        {(testAgentMode === '2j' || testAgentMode === '3j') && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wide`}>Mode:</span>
            {SPEED_MODES.map((mode) => {
              const isSelected = testSpeedMode === mode.id;
              const IconComponent = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => !testRunning && setTestSpeedMode(mode.id as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)}
                  disabled={testRunning}
                  className={`relative px-2.5 py-1 rounded-md text-xs font-semibold transition-all group border ${
                    isSelected
                      ? `bg-gradient-to-r ${mode.color} text-white shadow border-transparent`
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 border-gray-300 dark:border-zinc-600'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-1">
                    <IconComponent size={12} />
                    <span>{mode.name}</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 dark:bg-zinc-900 text-[10px] text-gray-100 dark:text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700 dark:border-zinc-700 z-20 whitespace-nowrap">
                    {mode.tooltip}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ═══ LINE 4: QUESTION & POISON INPUTS ═══ */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className={`text-[10px] font-bold ${theme.textSecondary} uppercase`}>Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={testRunning}
              placeholder="Who invented the telephone?"
              className={`w-full px-2.5 py-1.5 text-xs rounded-md border ${theme.border} ${theme.bg} ${theme.text} disabled:opacity-50`}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className={`text-[10px] font-bold ${theme.textSecondary} uppercase`}>Poison Pill</label>
            <input
              type="text"
              value={poison}
              onChange={(e) => setPoison(e.target.value)}
              disabled={testRunning}
              placeholder="Alexander Graham Bell invented the telephone in 1920 in Paris."
              className={`w-full px-2.5 py-1.5 text-xs rounded-md border border-red-300 dark:border-red-700 ${theme.bg} ${theme.text} disabled:opacity-50`}
            />
          </div>
          <div className="w-32">
            <label className={`text-[10px] font-bold ${theme.textSecondary} uppercase`}>Markers</label>
            <input
              type="text"
              value={markers}
              onChange={(e) => setMarkers(e.target.value)}
              disabled={testRunning}
              placeholder="1920, Paris"
              className={`w-full px-2.5 py-1.5 text-xs rounded-md border ${theme.border} ${theme.bg} ${theme.text} disabled:opacity-50`}
            />
          </div>
        </div>

        {/* ═══ LINE 5: RUN CONTROLS ═══ */}
        <div className="flex items-center justify-center gap-3">
          {!testRunning ? (
            <>
              <button
                onClick={handleRunTest}
                className="px-4 py-1.5 bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400 dark:hover:bg-emerald-500 rounded-md text-xs font-bold text-white disabled:opacity-50"
              >
                RUN TEST
              </button>
              {/* Save to Library button */}
              <button
                onClick={handleSaveToLibrary}
                disabled={!question.trim() || !poison.trim()}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  saveStatus === 'saved'
                    ? 'bg-green-500 text-white'
                    : 'bg-indigo-500 dark:bg-indigo-600 hover:bg-indigo-400 dark:hover:bg-indigo-500 text-white disabled:opacity-50'
                }`}
                title="Save question + poison to library for batch testing"
              >
                {saveStatus === 'saved' ? (
                  <>✓ Saved</>
                ) : (
                  <>
                    <Save className="h-3 w-3" />
                    Save to Library
                  </>
                )}
              </button>
              {testEvents.length > 0 && (
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 rounded-md text-xs font-semibold text-gray-700 dark:text-zinc-200"
                >
                  Clear
                </button>
              )}
            </>
          ) : (
            <button
              onClick={stopSingleTest}
              className="px-4 py-1.5 bg-red-500 dark:bg-red-600 hover:bg-red-400 dark:hover:bg-red-500 rounded-md text-xs font-bold text-white"
            >
              STOP
            </button>
          )}
          {testRunning && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Pass {testCurrentPass}/4
            </span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RESULTS AREA - Pass columns + Live Feed
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Pass Columns - Show when we have logs */}
        {testPassLogs.length > 0 && (
          <div className={`shrink-0 p-2 border-b ${theme.border}`}>
            <div className={`grid gap-2 ${
              testPassLogs.length === 1 ? 'grid-cols-1' :
              testPassLogs.length === 2 ? 'grid-cols-2' :
              testPassLogs.length === 3 ? 'grid-cols-3' :
              'grid-cols-4'
            }`}>
              {testPassLogs.map((log, index) => (
                <LivePassColumn
                  key={`${log.pass}-${index}`}
                  theme={theme}
                  passName={log.pass}
                  passLabel={log.pass.replace(/-/g, ' ').replace(/pass\d/i, '').replace(/\b\w/g, c => c.toUpperCase()).trim()}
                  icon={log.mode === 'unfiltered' ? '🔬' : log.mode === 'defense' ? '🛡️' : log.mode === 'pill-prompt' ? '🛡️' : '☠️'}
                  mode={log.mode}
                  passLog={log}
                  isActive={testRunning && testCurrentPass === index + 1}
                  totalTests={log.summary.totalTests}
                  currentTest={log.summary.completed}
                />
              ))}
            </div>
          </div>
        )}

        {/* Live Console Feed - Same as BatchView */}
        {testEvents.length > 0 ? (
          <LiveConsolePanel
            events={testEvents as EnhancedForensicEvent[]}
            isRunning={testRunning}
            theme={theme}
            passLogs={testPassLogs}
          />
        ) : (
          <div className={`flex-1 flex items-center justify-center ${theme.textMuted}`}>
            <div className="text-center">
              <p className="text-sm font-medium">Ready to test</p>
              <p className="text-xs mt-1">Enter a question and poison pill above, then click RUN TEST</p>
              <p className="text-xs mt-2 text-indigo-500 dark:text-indigo-400">Same forensic logging as Batch mode</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
