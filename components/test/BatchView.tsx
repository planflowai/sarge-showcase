'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTestModeStore } from '@/lib/stores/testModeStore';
import { TestTheme as Theme, BatchConfig, SessionStats, EnhancedForensicEvent } from '@/lib/types';
import { LivePassColumn } from '@/components/test/LivePassColumn';
import { LiveConsolePanel } from '@/components/test/LiveConsolePanel';
import { Activity, AlertTriangle, CheckCircle2, Shield, FlaskConical, Swords, ChevronDown, Zap, Skull, TrendingUp, Target, Copy, Check, ChevronRight, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCloudProviders } from '@/lib/providers';

// Cloud model options for the dropdown
const CLOUD_MODEL_OPTIONS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', short: 'Sonnet 4' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', short: 'Opus 4' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', short: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', short: '4o Mini' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', short: 'Gemini' },
  { id: 'grok-4', name: 'Grok 4', provider: 'xai', short: 'Grok 4' },
];

// Speed mode configuration - all modes including Chaos and Armageddon
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
  {
    id: 5,
    name: 'Chaos',
    description: 'Multi-agent poison attacks',
    tooltip: 'Multi-agent poison attacks — defense only (no protected prompts)',
    passes: ['chaos'],
    color: 'from-red-600 to-rose-700',
    icon: Zap,
  },
  {
    id: 6,
    name: 'ARMAGEDDON',
    description: 'Maximum stress test',
    tooltip: 'Maximum stress — defense only, judge poisoned, recovery disabled',
    passes: ['armageddon'],
    color: 'from-orange-600 via-red-700 to-black',
    icon: Skull,
  },
  {
    id: 7,
    name: 'Chaos+Prot',
    description: 'Chaos with protection',
    tooltip: 'Chaos with PROTECTED PROMPTS active',
    passes: ['chaos'],
    color: 'from-red-500 via-emerald-600 to-red-600',
    icon: Zap,
  },
  {
    id: 8,
    name: 'ARMG+Prot',
    description: 'Armageddon with protection',
    tooltip: 'Armageddon with PROTECTED PROMPTS active',
    passes: ['armageddon'],
    color: 'from-orange-600 via-emerald-600 to-red-700',
    icon: Skull,
  },
];

const PASS_INFO: Record<string, { label: string; color: string; activeColor?: string }> = {
  baseline: { label: 'Baseline', color: 'bg-zinc-500', activeColor: 'bg-zinc-400' },
  poison: { label: 'Poison', color: 'bg-orange-500', activeColor: 'bg-orange-400' },
  defense: { label: 'Defense', color: 'bg-blue-500', activeColor: 'bg-blue-400' },
  chaos: { label: 'Chaos', color: 'bg-red-600', activeColor: 'bg-red-500' },
  armageddon: { label: 'ARMAGEDDON', color: 'bg-orange-700', activeColor: 'bg-red-800' },
  'lite': { label: 'Lite', color: 'bg-sky-500', activeColor: 'bg-cyan-500' },
};

interface BatchViewProps {
  theme: Theme;
  batchConfig: BatchConfig;
  setBatchConfig: (config: BatchConfig) => void;
  stats: SessionStats;
}

export function BatchView({ theme, batchConfig, setBatchConfig, stats }: BatchViewProps) {
  const batchRunning = useTestModeStore((s) => s.batchRunning);
  const batchPaused = useTestModeStore((s) => s.batchPaused);
  const batchCurrentPass = useTestModeStore((s) => s.batchCurrentPass);
  const batchCurrentTest = useTestModeStore((s) => s.batchCurrentTest);
  const batchTotalTests = useTestModeStore((s) => s.batchTotalTests);
  const batchPassLogs = useTestModeStore((s) => s.batchPassLogs);
  const batchEvents = useTestModeStore((s) => s.batchEvents);
  const batchActivity = useTestModeStore((s) => s.batchActivity);
  const batchLockedRotation = useTestModeStore((s) => s.batchLockedRotation);
  const batchHistory = useTestModeStore((s) => s.batchHistory);
  const batchId = useTestModeStore((s) => s.batchId);
  const runBatch = useTestModeStore((s) => s.runBatch);
  const stopBatch = useTestModeStore((s) => s.stopBatch);
  const pauseBatch = useTestModeStore((s) => s.pauseBatch);
  const resumeBatch = useTestModeStore((s) => s.resumeBatch);
  const speedMode = useTestModeStore((s) => s.speedMode);
  const setSpeedMode = useTestModeStore((s) => s.setSpeedMode);
  const agentMode = useTestModeStore((s) => s.agentMode);
  const setAgentMode = useTestModeStore((s) => s.setAgentMode);
  const clearResults = useTestModeStore((s) => s.clearResults);

  // Get current test's question and poison for display
  const currentTestEntry = batchLockedRotation && batchCurrentTest > 0
    ? batchLockedRotation[batchCurrentTest - 1]
    : null;

  const [source, setSource] = useState<'local' | 'cloud'>('local');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Cloud model selection state
  const cloudModels = useTestModeStore((s) => s.cloudModels);
  const setCloudModels = useTestModeStore((s) => s.setCloudModels);

  // Get selected model display name
  const selectedCloudModel = CLOUD_MODEL_OPTIONS.find(m => m.id === cloudModels.d1) || CLOUD_MODEL_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showModelDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-model-dropdown]')) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showModelDropdown]);

  // Real-time stats for current run
  const [runStats, setRunStats] = useState({
    testsRan: 0,
    hallucinations: 0,
    echoes: 0,
    kills: 0,
  });

  const pass1Log = batchPassLogs.find(p => p.pass === 'pass1-unfiltered');
  const pass2Log = batchPassLogs.find(p => p.pass === 'pass2-pill');
  // NOTE: pass3 (Protected) merged into Defense - look for 'pass4-defense'
  const pass4Log = batchPassLogs.find(p => p.pass === 'pass4-defense');

  // Calculate progress values BEFORE useEffect (needed for dependency array)
  // Now only 3 passes: Baseline, Poison, Defense
  const passCount = speedMode === 4 ? 3 : speedMode === 3 ? 2 : 1; // Full=3, Poison+Defense=2, Defense=1
  const totalProgress = (pass1Log?.summary.completed || 0)
    + (pass2Log?.summary.completed || 0)
    + (pass4Log?.summary.completed || 0)
    + (batchRunning && !pass1Log?.completedAt && batchCurrentPass === 1 ? batchCurrentTest : 0)
    + (batchRunning && !pass2Log?.completedAt && batchCurrentPass === 2 ? batchCurrentTest : 0)
    + (batchRunning && !pass4Log?.completedAt && (batchCurrentPass === 3 || batchCurrentPass === 4) ? batchCurrentTest : 0);
  const totalExpected = (batchTotalTests || (batchConfig?.tests ?? 0)) * passCount;
  const progressPct = totalExpected > 0 ? Math.round((totalProgress / totalExpected) * 100) : 0;

  // Calculate real-time stats from batch results
  useEffect(() => {
    if (!pass2Log && !pass4Log) {
      // No poison/defense passes yet, keep stats at 0
      return;
    }

    let hallucinations = 0;
    let echoes = 0;
    let kills = 0;

    // Pass 2: Count hallucinations and echoes
    if (pass2Log?.tests) {
      pass2Log?.tests.forEach(test => {
        // Echo: poison markers appear in response
        const hasEcho = test?.poisonMarkers?.some(marker =>
          marker && test?.response?.toLowerCase().includes(marker.toLowerCase())
        );
        if (hasEcho) echoes++;

        // Hallucination: verdict is MISSED (poison not caught)
        if (test?.verdict === 'MISSED') hallucinations++;
      });
    }

    // Defense: Count kills (successful defenses) - now includes what was Pass 3
    if (pass4Log?.tests) {
      pass4Log?.tests.forEach(test => {
        if (test?.verdict === 'CAUGHT') kills++;
      });
    }

    setRunStats({
      testsRan: totalProgress,
      hallucinations,
      echoes,
      kills,
    });
  }, [pass2Log, pass4Log, totalProgress]);

  const handleStart = (testCount: number) => {
    console.log('[handleStart] called', { source, testCount });
    setBatchConfig({ ...batchConfig, running: true, paused: false, progress: 0, tests: testCount });
    runBatch(source, testCount);
  };

  const handleStop = () => {
    stopBatch();
    setBatchConfig({ ...batchConfig, running: false, paused: false });
  };

  const handleClear = () => {
    // Clear batch-specific data
    useTestModeStore.setState({
      batchPassLogs: [],
      batchEvents: [],
      batchActivity: '',
      batchRunning: false,
      batchPaused: false,
      batchCurrentPass: 0,
      batchCurrentTest: 0,
      batchTotalTests: 0,
      batchLockedRotation: null,      // Clear locked rotation
      batchBaselineResults: null,     // Clear baseline results
    });
    // Clear local stats
    setRunStats({ testsRan: 0, hallucinations: 0, echoes: 0, kills: 0 });
    setBatchConfig({ ...batchConfig, running: false, paused: false, progress: 0 });
  };

  const handleStopResume = () => {
    if (batchPaused) {
      resumeBatch();
    } else {
      pauseBatch();
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const rows = [
      ['Phase', 'Test#', 'Question', 'Poison', 'Verdict', 'EchoCount', 'CaughtRound', 'Model_D1', 'Model_D2', 'Model_D3'],
    ];

    batchPassLogs.forEach(log => {
      log.tests.forEach(test => {
        const rotation = batchLockedRotation?.[test.testIndex];
        rows.push([
          log.pass,
          String(test.testIndex + 1),
          test.question,
          test.poison,
          test.verdict || '',
          String(test.echoCount || 0),
          String(test.caughtRound || ''),
          rotation?.models?.d1 || '',
          rotation?.models?.d2 || '',
          rotation?.models?.d3 || '',
        ]);
      });
    });

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarge-batch-${batchId || Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export audit trail as JSON
  const handleExport = () => {
    const state = useTestModeStore.getState();
    const auditData = {
      exportedAt: new Date().toISOString(),
      batchId: state.batchId,
      source: source,
      speedMode: speedMode,
      totalTests: state.batchTotalTests,
      passLogs: state.batchPassLogs.map(log => ({
        pass: log?.pass,
        mode: log?.mode,
        startedAt: log?.startedAt,
        completedAt: log?.completedAt,
        summary: log?.summary,
        tests: (log?.tests ?? []).map(test => ({
          testIndex: test?.testIndex,
          question: test?.question,
          poison: test?.poison,
          poisonRound: test?.poisonRound,
          poisonAgent: test?.poisonAgent,
          rounds: test?.rounds,
          mode: test?.mode,
          echoCount: test?.echoCount,
          killRound: test?.killRound,
          killAgent: test?.killAgent,
          judgeVerdict: test?.judgeResponse?.verdict,
          responses: test?.responses?.map(r => ({
            round: r?.round,
            agent: r?.agent,
            model: r?.model,
            content: r?.content,
            hasEcho: r.hasEcho,
            matchedMarkers: r.matchedMarkers,
            poisonInjected: r.poisonInjected,
          })),
        })),
      })),
      events: state.batchEvents.map(e => ({
        timestamp: e.timestamp,
        event: e.event,
        icon: e.icon,
        type: e.type,
      })),
      airGapCompliance: {
        exportedOffline: typeof navigator !== 'undefined' && !navigator.onLine,
        noExternalConnections: source === 'local',
        dataRetainedLocally: true,
      },
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarge-audit-${state.batchId || 'batch'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-auto">
      {/* ══════════════════════════════════════════════════════════════════
          4-LINE CONTROL BAR
          Line 1: LLM Config (source, model, test count)
          Line 2: Agent Config (2 LLMs, 3 LLMs, 2+Judge, 3+Judge)
          Line 3: Test Modes (only for with-judge modes)
          Line 4: Progress
          ══════════════════════════════════════════════════════════════════ */}
      <div className={`shrink-0 px-4 py-3 border-b ${theme.border} ${theme.bgSecondary} flex flex-col gap-2`}>

        {/* ═══ LINE 1: LLM CONFIG ═══ */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wide`}>LLM:</span>

          {/* Source Toggle */}
          <div className="flex items-center rounded-md overflow-hidden border border-gray-300 dark:border-zinc-600">
            <button
              onClick={() => setSource('local')}
              disabled={batchRunning}
              className={`px-3 py-1 text-xs font-semibold transition-all ${
                source === 'local' ? 'bg-cyan-500 dark:bg-cyan-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              } disabled:opacity-50`}
            >
              🖥️ Local
            </button>
            <button
              onClick={() => setSource('cloud')}
              disabled={batchRunning}
              className={`px-3 py-1 text-xs font-semibold transition-all ${
                source === 'cloud' ? 'bg-purple-500 dark:bg-purple-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              } disabled:opacity-50`}
            >
              ☁️ Cloud
            </button>
          </div>

          {/* Cloud Model Selector */}
          {source === 'cloud' && (
            <div className="relative" data-model-dropdown>
              <button
                onClick={() => !batchRunning && setShowModelDropdown(!showModelDropdown)}
                disabled={batchRunning}
                className="flex items-center gap-1 px-2 py-0.5 bg-purple-700/80 hover:bg-purple-600 rounded text-[9px] font-bold text-white border border-purple-500/50 disabled:opacity-50"
              >
                <span>{selectedCloudModel.short}</span>
                <ChevronDown className={`h-3 w-3 ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showModelDropdown && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-zinc-900 border border-zinc-700 rounded shadow-xl z-30 min-w-[180px]">
                  {CLOUD_MODEL_OPTIONS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { setCloudModels({ d1: model.id, d2: model.id, d3: model.id, judge: model.id }); setShowModelDropdown(false); }}
                      className={`w-full px-2 py-1 text-left text-[10px] hover:bg-zinc-800 ${cloudModels.d1 === model.id ? 'bg-purple-600/30 text-purple-300' : 'text-zinc-300'}`}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="w-px h-5 bg-gray-300 dark:bg-zinc-700" />

          {/* Test Count & Run */}
          <span className={`text-xs font-bold ${theme.textSecondary}`}>Tests:</span>
          {!batchRunning ? (
            <>
              <button onClick={() => handleStart(1)} className="px-2.5 py-1 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 rounded-md text-xs font-semibold text-gray-700 dark:text-white">1</button>
              <button onClick={() => handleStart(5)} className="px-2.5 py-1 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 rounded-md text-xs font-semibold text-gray-700 dark:text-white">5</button>
              <button onClick={() => handleStart(10)} className="px-2.5 py-1 bg-amber-500 dark:bg-amber-600 hover:bg-amber-400 dark:hover:bg-amber-500 rounded-md text-xs font-semibold text-white">10</button>
              <input
                type="number" min={1} max={100} value={batchConfig?.tests ?? 0}
                onChange={(e) => setBatchConfig({ ...batchConfig, tests: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
                className="w-12 px-2 py-1 rounded-md text-xs bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 border border-gray-300 dark:border-zinc-700"
              />
              <button onClick={() => handleStart(batchConfig?.tests ?? 0)} className="px-3 py-1 bg-emerald-500 dark:bg-emerald-600 hover:bg-emerald-400 dark:hover:bg-emerald-500 rounded-md text-xs font-semibold text-white">▶ Run</button>
            </>
          ) : (
            <>
              <button onClick={handleStopResume} className={`px-3 py-1 rounded-md text-xs font-semibold ${batchPaused ? 'bg-emerald-500 dark:bg-emerald-600 text-white' : 'bg-red-500 dark:bg-red-600 text-white'}`}>
                {batchPaused ? '▶ Resume' : '⏹ Pause'}
              </button>
              <button onClick={handleClear} disabled={batchRunning && !batchPaused} className="px-3 py-1 bg-gray-200 dark:bg-zinc-700 rounded-md text-xs font-semibold text-gray-700 dark:text-white disabled:opacity-50">🗑 Clear</button>
            </>
          )}

          {batchPassLogs.length > 0 && (
            <>
              <button onClick={handleExport} className="px-3 py-1 bg-indigo-500 dark:bg-indigo-700 hover:bg-indigo-400 dark:hover:bg-indigo-600 rounded-md text-xs font-semibold text-white">📤 JSON</button>
              <button onClick={handleExportCSV} className="px-3 py-1 bg-emerald-500 dark:bg-emerald-700 hover:bg-emerald-400 dark:hover:bg-emerald-600 rounded-md text-xs font-semibold text-white">📊 CSV</button>
            </>
          )}
        </div>

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
              onClick={() => !batchRunning && setAgentMode(mode.id as '2' | '3' | '2j' | '3j')}
              disabled={batchRunning}
              className={`relative px-3 py-1.5 rounded-md text-xs font-semibold transition-all group border ${
                agentMode === mode.id
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
          {(agentMode === '2' || agentMode === '3') && (
            <span className="text-xs text-amber-600 dark:text-amber-500 font-medium ml-1">← Sanity check only</span>
          )}
        </div>

        {/* ═══ LINE 3: TEST MODES (only for judge modes) ═══ */}
        {(agentMode === '2j' || agentMode === '3j') && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${theme.textSecondary} uppercase tracking-wide`}>Mode:</span>
            {SPEED_MODES.map((mode) => {
              const isSelected = speedMode === mode.id;
              const IconComponent = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => !batchRunning && setSpeedMode(mode.id as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)}
                  disabled={batchRunning}
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

        {/* ═══ LINE 4: PROGRESS ═══ */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-gray-300 dark:border-zinc-700">
            <div
              className={`h-full transition-all duration-500 ${
                batchRunning ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : progressPct === 100 ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-zinc-600'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={`text-xs font-bold min-w-[100px] ${batchRunning ? 'text-amber-600 dark:text-amber-400' : progressPct === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-zinc-500'}`}>
            {batchRunning ? `${batchCurrentTest}/${batchTotalTests} (${progressPct}%)` : progressPct === 100 ? '✓ Complete' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Question & Poison Summary - Shows what's being tested */}
      {(batchRunning || batchPassLogs.length > 0) && currentTestEntry && (
        <div className={`shrink-0 px-4 py-1.5 border-b ${theme.border} bg-indigo-50 dark:bg-indigo-900/20`}>
          <div className="flex items-start gap-4 text-xs">
            <div className="flex-1 min-w-0">
              <span className="font-bold text-indigo-700 dark:text-indigo-400">❓ Question: </span>
              <span className="text-zinc-800 dark:text-zinc-200">{currentTestEntry.question}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-red-600 dark:text-red-400">💉 Poison being tested: </span>
              <span className="text-zinc-800 dark:text-zinc-200 italic">"{currentTestEntry.poison}"</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary line when running - high contrast for light/dark mode */}
      {batchRunning && (
        <div className={`shrink-0 px-4 py-2 border-b ${theme.border} bg-zinc-100 dark:bg-zinc-900/80 flex items-center gap-3 text-sm`}>
          <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Current:</span>
          <span className="text-amber-600 dark:text-amber-400 font-black">
            {batchCurrentPass === 1 ? 'Baseline' : batchCurrentPass === 2 ? 'Poison' : 'Defense'}
          </span>
          <span className="text-zinc-400 dark:text-zinc-600 font-bold">•</span>
          <span className="text-zinc-800 dark:text-zinc-200 font-bold">
            Test {batchCurrentTest}/{batchTotalTests}
          </span>
          {batchActivity && (
            <>
              <span className="text-zinc-400 dark:text-zinc-600 font-bold">•</span>
              <span className="text-zinc-600 dark:text-zinc-400 font-medium truncate max-w-[300px]">{batchActivity}</span>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CONTENT - Live streaming or completed rows
          ══════════════════════════════════════════════════════════════════ */}
      <div className={`flex overflow-hidden ${batchRunning ? 'shrink-0' : 'flex-1'}`}>
        {/* Show live 3-column view when running, rows view when stopped */}
        {batchRunning ? (
          /* 3-Column Live View - Baseline, Poison, Defense (Protected merged into Defense) */
          <div className="grid grid-cols-3 gap-3 p-3 w-full items-start">
            <LivePassColumn
              theme={theme}
              passName="pass1"
              passLabel="Baseline"
              icon="🔬"
              mode="unfiltered"
              passLog={pass1Log}
              isActive={batchRunning && batchCurrentPass === 1}
              totalTests={batchTotalTests || (batchConfig?.tests ?? 0)}
              currentTest={batchCurrentPass === 1 ? batchCurrentTest : 0}
            />
            <LivePassColumn
              theme={theme}
              passName="pass2"
              passLabel="Poison"
              icon="☠️"
              mode="pill"
              passLog={pass2Log}
              isActive={batchRunning && batchCurrentPass === 2}
              totalTests={batchTotalTests || (batchConfig?.tests ?? 0)}
              currentTest={batchCurrentPass === 2 ? batchCurrentTest : 0}
            />
            <LivePassColumn
              theme={theme}
              passName="defense"
              passLabel="Defense"
              icon="🛡️"
              mode="defense"
              passLog={pass4Log}
              isActive={batchRunning && (batchCurrentPass === 3 || batchCurrentPass === 4)}
              totalTests={batchTotalTests || (batchConfig?.tests ?? 0)}
              currentTest={(batchCurrentPass === 3 || batchCurrentPass === 4) ? batchCurrentTest : 0}
              showSuccessBanner={!!(pass4Log?.completedAt && (pass4Log?.summary.catchRate ?? 0) >= 80)}
            />
          </div>
        ) : (
          /* Rounds List - Completed view */
          <div className="flex-1 overflow-auto p-3 w-full">
          <div className="space-y-2">
            {/* Render completed rounds - use whichever pass log has data */}
            {(() => {
              // Use the first available pass log that has tests (Defense or Poison or Baseline)
              const activeLog = pass4Log || pass2Log || pass1Log;
              if (!activeLog?.tests || (activeLog?.tests?.length ?? 0) === 0) {
                return (
                  <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                    <p className="text-lg font-medium">No rounds yet</p>
                    <p className="text-sm mt-1">Start a batch test to see results here</p>
                  </div>
                );
              }

              return (activeLog?.tests ?? []).map((test, idx) => {
                const pass1Test = pass1Log?.tests[idx];
                const pass2Test = pass2Log?.tests[idx];
                const defenseTest = pass4Log?.tests[idx];
                const isCaught = defenseTest?.verdict === 'CAUGHT';
                const isMissed = defenseTest?.verdict === 'MISSED';

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedRound(idx)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${
                      isCaught
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/50 dark:border-emerald-500/40'
                        : isMissed
                        ? 'bg-red-500/10 dark:bg-red-500/10 border-red-500/50 dark:border-red-500/40'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Round Number */}
                      <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center font-black text-2xl ${
                        isCaught
                          ? 'bg-emerald-600 dark:bg-emerald-600 text-white'
                          : isMissed
                          ? 'bg-red-600 dark:bg-red-600 text-white'
                          : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {idx + 1}
                      </div>

                      {/* Question */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {test?.question || 'Test Question'}
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {test.completedAt ? new Date(test.completedAt).toLocaleTimeString() : 'In progress...'}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="flex-shrink-0">
                        {isCaught && (
                          <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold uppercase">
                            ✅ Caught
                          </span>
                        )}
                        {isMissed && (
                          <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold uppercase">
                            ❌ Missed
                          </span>
                        )}
                        {!isCaught && !isMissed && defenseTest && (
                          <span className="px-3 py-1 rounded-full bg-zinc-400 text-white text-xs font-bold uppercase">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
        )}
      </div>

      {/* Live Console Feed - Always visible at bottom */}
      <LiveConsolePanel
        events={batchEvents as EnhancedForensicEvent[]}
        isRunning={batchRunning}
        theme={theme}
        passLogs={batchPassLogs}
        batchHistory={batchHistory}
        currentBatchId={batchId}
      />

      {/* Batch Summary Dashboard - Shows after batch completes */}
      {!batchRunning && pass4Log?.completedAt && (
        <BatchSummaryDashboard
          theme={theme}
          pass1Log={pass1Log}
          pass2Log={pass2Log}
          pass4Log={pass4Log}
          batchEvents={batchEvents as EnhancedForensicEvent[]}
          totalTests={batchTotalTests || (batchConfig?.tests ?? 0)}
          speedMode={speedMode}
          source={source}
          batchId={batchId}
        />
      )}

      {/* Full Page Modal for Round Details */}
      {selectedRound !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Round {selectedRound + 1} - Full Details
              </h2>
              <button
                onClick={() => setSelectedRound(null)}
                className="px-3 py-1.5 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium"
              >
                Close
              </button>
            </div>

            {/* Modal Content - 3 Passes */}
            <div className="p-6 space-y-6">
              {/* Pass 1: Baseline */}
              {pass1Log?.tests[selectedRound] && (
                <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-3">
                    🔬 Pass 1: Baseline (Unfiltered)
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Question:</p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{pass1Log?.tests?.[selectedRound]?.question}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Response:</p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">{pass1Log?.tests?.[selectedRound]?.response}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pass 2: Poison */}
              {pass2Log?.tests[selectedRound] && (
                <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-orange-600 dark:text-orange-400 mb-3">
                    ☠️ Pass 2: Poison Injected
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Question:</p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{pass2Log?.tests?.[selectedRound]?.question}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Response:</p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">{pass2Log?.tests?.[selectedRound]?.response}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Defense (includes protective prompts) */}
              {pass4Log?.tests[selectedRound] && (
                <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-3">
                    🛡️ Defense
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Question:</p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{pass4Log?.tests?.[selectedRound]?.question}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Response:</p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">{pass4Log?.tests?.[selectedRound]?.response}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">Verdict:</p>
                      <p className={`text-lg font-bold ${
                        pass4Log?.tests?.[selectedRound]?.verdict === 'CAUGHT'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {pass4Log?.tests?.[selectedRound]?.verdict === 'CAUGHT' ? '✅ CAUGHT' : '❌ MISSED'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH SUMMARY DASHBOARD - Auto-generated metrics after batch completes
// ═══════════════════════════════════════════════════════════════════════════════

interface BatchSummaryDashboardProps {
  theme: Theme;
  pass1Log: any;
  pass2Log: any;
  pass4Log: any;
  batchEvents: EnhancedForensicEvent[];
  totalTests: number;
  speedMode: number;
  source: 'local' | 'cloud';
  batchId?: string;
}

function BatchSummaryDashboard({
  theme,
  pass1Log,
  pass2Log,
  pass4Log,
  batchEvents,
  totalTests,
  speedMode,
  source,
  batchId,
}: BatchSummaryDashboardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // Calculate metrics from pass logs
  const metrics = useMemo(() => {
    let kills = 0;
    let echoes = 0;
    let catches = 0;
    let misses = 0;
    let totalLatency = 0;
    let totalTokens = 0;
    let responseCount = 0;

    // Agent performance tracking
    const agentStats: Record<string, { kills: number; echoes: number; cleans: number; responses: number }> = {
      D1: { kills: 0, echoes: 0, cleans: 0, responses: 0 },
      D2: { kills: 0, echoes: 0, cleans: 0, responses: 0 },
      D3: { kills: 0, echoes: 0, cleans: 0, responses: 0 },
      Judge: { kills: 0, echoes: 0, cleans: 0, responses: 0 },
    };

    // Count from defense pass
    if (pass4Log?.tests) {
      pass4Log?.tests.forEach((test: any) => {
        if (test?.verdict === 'CAUGHT') catches++;
        if (test?.verdict === 'MISSED') misses++;

        // Process individual responses for agent stats
        test?.responses?.forEach((resp: any) => {
          const agent = resp?.role?.toUpperCase() || 'D1';
          if (agentStats[agent]) {
            agentStats[agent].responses++;
            if (resp?.status === 'echoed') {
              agentStats[agent].echoes++;
              echoes++;
            } else if (resp?.status === 'killed' || resp?.content?.includes('[KILL_TRIGGERED')) {
              agentStats[agent].kills++;
              kills++;
            } else {
              agentStats[agent].cleans++;
            }

            if (resp?.timeMs) {
              totalLatency += resp.timeMs;
              responseCount++;
            }
            if (resp?.tokens) totalTokens += resp.tokens;
          }
        });

        // Count kills from test level
        if (test?.killRound) kills++;
      });
    }

    const catchRate = totalTests > 0 ? Math.round((catches / totalTests) * 100) : 0;
    const echoRate = totalTests > 0 ? Math.round((echoes / Math.max(1, responseCount / 4)) * 100) : 0;
    const avgLatency = responseCount > 0 ? totalLatency / responseCount / 1000 : 0; // Convert to seconds

    return {
      kills,
      echoes,
      catches,
      misses,
      catchRate,
      echoRate,
      avgLatency,
      totalTokens,
      agentStats,
    };
  }, [pass4Log, batchEvents, totalTests]);

  // Get speed mode name
  const speedModeName = SPEED_MODES.find(m => m.id === speedMode)?.name || 'Unknown';

  // Copy summary to clipboard
  const handleCopy = async () => {
    const summary = `SARGE Batch Summary
═══════════════════════════════
Mode: ${speedModeName} (${source})
Total Tests: ${totalTests}
Catch Rate: ${metrics.catchRate}%
Kills: ${metrics.kills}
Echoes: ${metrics.echoes}
Catches: ${metrics.catches}
Misses: ${metrics.misses}
Avg Latency: ${metrics.avgLatency.toFixed(2)}s
Total Tokens: ${metrics.totalTokens.toLocaleString()}

Agent Performance:
- D1: ${metrics.agentStats.D1.kills} kills, ${metrics.agentStats.D1.echoes} echoes, ${metrics.agentStats.D1.cleans} cleans
- D2: ${metrics.agentStats.D2.kills} kills, ${metrics.agentStats.D2.echoes} echoes, ${metrics.agentStats.D2.cleans} cleans
- D3: ${metrics.agentStats.D3.kills} kills, ${metrics.agentStats.D3.echoes} echoes, ${metrics.agentStats.D3.cleans} cleans
- Judge: ${metrics.agentStats.Judge.responses} verdicts

Generated: ${new Date().toLocaleString()}`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failed
    }
  };

  return (
    <div className={`border-t-2 ${theme.border} ${theme.bgSecondary}`}>
      {/* Header - Clickable to expand/collapse */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-zinc-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-zinc-500" />
          )}
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          <span className={`text-lg font-bold ${theme.text}`}>Batch Summary Dashboard</span>
          <span className={`text-xs ${theme.textSecondary} ml-2`}>
            {speedModeName} • {totalTests} tests • {source}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className={`font-bold ${metrics.catchRate >= 80 ? 'text-emerald-500' : metrics.catchRate >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
              {metrics.catchRate}% Catch
            </span>
            <span className="text-red-500 font-bold">{metrics.kills} Kills</span>
            <span className="text-amber-500 font-bold">{metrics.echoes} Echoes</span>
          </div>

          {/* View in Review button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push('/review?preselect=latest');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            title="View detailed analysis in Review"
          >
            <ExternalLink className="h-4 w-4" />
            View in Review
          </button>

          {/* Copy button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className={`p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 ${theme.textSecondary}`}
            title="Copy summary"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Main metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* Catch Rate */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center ${
              metrics.catchRate >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/50' :
              metrics.catchRate >= 60 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500/50' :
              'bg-red-50 dark:bg-red-950/30 border-red-500/50'
            }`}>
              <div className={`text-2xl font-black ${
                metrics.catchRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                metrics.catchRate >= 60 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {metrics.catchRate}%
              </div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Catch Rate</div>
            </div>

            {/* Catches */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/50`}>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.catches}</div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Catches</div>
            </div>

            {/* Misses */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center bg-red-50 dark:bg-red-950/30 border-red-500/50`}>
              <div className="text-2xl font-black text-red-600 dark:text-red-400">{metrics.misses}</div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Misses</div>
            </div>

            {/* Kills */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center bg-red-50 dark:bg-red-950/30 border-red-500/50`}>
              <div className="text-2xl font-black text-red-600 dark:text-red-400">{metrics.kills}</div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Kills</div>
            </div>

            {/* Echoes */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center bg-amber-50 dark:bg-amber-950/30 border-amber-500/50`}>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.echoes}</div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Echoes</div>
            </div>

            {/* Echo Rate */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center ${
              metrics.echoRate <= 5 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/50' :
              metrics.echoRate <= 15 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500/50' :
              'bg-red-50 dark:bg-red-950/30 border-red-500/50'
            }`}>
              <div className={`text-2xl font-black ${
                metrics.echoRate <= 5 ? 'text-emerald-600 dark:text-emerald-400' :
                metrics.echoRate <= 15 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {metrics.echoRate}%
              </div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Echo Rate</div>
            </div>

            {/* Avg Latency */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center ${theme.bgSecondary}`}>
              <div className={`text-2xl font-black ${theme.text}`}>{metrics.avgLatency.toFixed(1)}s</div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Avg Latency</div>
            </div>

            {/* Total Tokens */}
            <div className={`rounded-lg border ${theme.border} p-3 text-center ${theme.bgSecondary}`}>
              <div className={`text-2xl font-black ${theme.text}`}>{(metrics.totalTokens / 1000).toFixed(1)}k</div>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase`}>Tokens</div>
            </div>
          </div>

          {/* Agent Performance Breakdown */}
          <div className={`rounded-lg border ${theme.border} ${theme.bgSecondary} p-4`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-3 uppercase`}>Agent Performance</h3>
            <div className="grid grid-cols-4 gap-4">
              {(['D1', 'D2', 'D3', 'Judge'] as const).map((agent, idx) => {
                const stats = metrics.agentStats[agent];
                const total = stats.kills + stats.echoes + stats.cleans;
                const killPct = total > 0 ? Math.round((stats.kills / total) * 100) : 0;
                const echoPct = total > 0 ? Math.round((stats.echoes / total) * 100) : 0;
                const cleanPct = total > 0 ? Math.round((stats.cleans / total) * 100) : 0;

                const colors = ['border-l-blue-500', 'border-l-purple-500', 'border-l-amber-500', 'border-l-emerald-500'];

                return (
                  <div key={agent} className={`rounded-lg border ${theme.border} border-l-4 ${colors[idx]} p-3`}>
                    <div className={`text-sm font-bold ${theme.text} mb-2`}>{agent}</div>

                    {agent === 'Judge' ? (
                      <div className={`text-xs ${theme.textSecondary}`}>
                        <div>{stats.responses} verdicts</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-red-500">Kills</span>
                          <span className="font-bold">{stats.kills} ({killPct}%)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-amber-500">Echoes</span>
                          <span className="font-bold">{stats.echoes} ({echoPct}%)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-500">Cleans</span>
                          <span className="font-bold">{stats.cleans} ({cleanPct}%)</span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden flex mt-2">
                          <div className="bg-red-500" style={{ width: `${killPct}%` }} />
                          <div className="bg-amber-500" style={{ width: `${echoPct}%` }} />
                          <div className="bg-emerald-500" style={{ width: `${cleanPct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verdict breakdown */}
          <div className={`rounded-lg border ${theme.border} ${theme.bgSecondary} p-4`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-3 uppercase`}>Verdict Distribution</h3>
            <div className="flex items-center gap-4">
              {/* Progress bar */}
              <div className="flex-1 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden flex">
                <div
                  className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white"
                  style={{ width: `${metrics.catchRate}%` }}
                >
                  {metrics.catchRate > 15 && `${metrics.catches} CAUGHT`}
                </div>
                <div
                  className="bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                  style={{ width: `${100 - metrics.catchRate}%` }}
                >
                  {(100 - metrics.catchRate) > 15 && `${metrics.misses} MISSED`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
