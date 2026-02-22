"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Play, Square, Trash2, TestTube, FlaskConical, Settings, FileText, ArrowLeft, FileSearch, Maximize2, X, Search } from "lucide-react";
import { useUIStore } from "@/lib/stores/uiStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { Button } from "@/components/ui/button";

export function TestModeSidebar() {
  const collapsed = useUIStore((s) => s.testModeSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleTestModeSidebar);

  const batchModeActive = useTestModeStore((s) => s.batchModeActive);
  const currentView = useTestModeStore((s) => s.currentView);
  const setCurrentView = useTestModeStore((s) => s.setCurrentView);
  const mode = useTestModeStore((s) => s.mode);
  const setMode = useTestModeStore((s) => s.setMode);
  const source = useTestModeStore((s) => s.source);
  const setSource = useTestModeStore((s) => s.setSource);
  const question = useTestModeStore((s) => s.question);
  const setQuestion = useTestModeStore((s) => s.setQuestion);
  const questionLocked = useTestModeStore((s) => s.questionLocked);
  const setQuestionLocked = useTestModeStore((s) => s.setQuestionLocked);
  const poison = useTestModeStore((s) => s.poison);
  const setPoison = useTestModeStore((s) => s.setPoison);
  const poisonLocked = useTestModeStore((s) => s.poisonLocked);
  const setPoisonLocked = useTestModeStore((s) => s.setPoisonLocked);
  const echoConfig = useTestModeStore((s) => s.echoConfig);
  const setEchoConfig = useTestModeStore((s) => s.setEchoConfig);
  const isRunning = useTestModeStore((s) => s.isRunning);
  const runTest = useTestModeStore((s) => s.runTest);
  const stopTest = useTestModeStore((s) => s.stopTest);
  const clearResults = useTestModeStore((s) => s.clearResults);
  const closeTestMode = useTestModeStore((s) => s.closeTestMode);
  const hideTestMode = useTestModeStore((s) => s.hideTestMode);
  const batchRunning = useTestModeStore((s) => s.batchRunning);
  const openForensicLog = useForensicLogStore((s) => s.openForensicLog);
  const forensicEntryCount = useForensicLogStore((s) => s.entries.length);
  const stats = useTestModeStore((s) => s.stats);
  const selectRandomQuestionPoisonPair = useTestModeStore((s) => s.selectRandomQuestionPoisonPair);
  const saveCurrentQuestionPoison = useTestModeStore((s) => s.saveCurrentQuestionPoison);

  const showPillConfig = mode === 'pill' || mode === 'pill-prompt';
  const [expandedInput, setExpandedInput] = useState<'question' | 'poison' | null>(null);

  if (collapsed) {
    return (
      <div className="w-12 border-r border-zinc-300 dark:border-zinc-800 p-1 space-y-1 bg-white dark:bg-zinc-950">
        {/* Expand button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full h-7 px-1"
          title="Expand sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        {/* View icons */}
        <div className="space-y-0.5">
          {!batchModeActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("test")}
              className={`w-full h-7 px-1 ${currentView === "test" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}
              title="Test"
            >
              <TestTube className="h-3.5 w-3.5" />
            </Button>
          )}
          {batchModeActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("batch")}
              className={`w-full h-7 px-1 ${currentView === "batch" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}
              title="Batch"
            >
              <FlaskConical className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("review")}
            className={`w-full h-7 px-1 ${currentView === "review" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}
            title="Review"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("config")}
            className={`w-full h-7 px-1 ${currentView === "config" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}
            title="Config"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Stats badge */}
        <div className="pt-2 text-center text-[10px]">
          <div className="text-emerald-400 font-bold">{stats.caught}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-zinc-300 dark:border-zinc-800 px-3 py-3 flex flex-col overflow-y-auto bg-white dark:bg-zinc-950">
      {/* Header with collapse */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">S.A.R.G.E.</div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={hideTestMode}
            className="h-6 px-2 text-[10px] gap-1"
            title="Back to Workbench"
          >
            <ArrowLeft className="h-3 w-3" />
          </Button>
          {!isRunning && !batchRunning && (
            <Button
              variant="ghost"
              size="sm"
              onClick={closeTestMode}
              className="h-6 px-2 text-[10px] text-zinc-500 hover:text-red-400"
              title="Close Test Mode"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { closeTestMode(); setTimeout(() => openForensicLog(), 50); }}
            className="h-6 px-2 text-[10px] text-emerald-500"
            title="Forensic Log"
          >
            <FileSearch className="h-3 w-3" />
            {forensicEntryCount > 0 && (
              <span className="ml-0.5 text-[9px] font-bold">{forensicEntryCount > 99 ? "99+" : forensicEntryCount}</span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="h-6 w-6 p-0"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* View Switcher */}
      <div className={`grid ${batchModeActive ? 'grid-cols-4' : 'grid-cols-4'} gap-0 rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden mb-4`}>
        {(batchModeActive ? [
          { view: 'batch' as const, icon: FlaskConical, label: 'Batch' },
          { view: 'audit' as const, icon: Search, label: 'Audit' },
          { view: 'review' as const, icon: FileText, label: 'Review' },
          { view: 'config' as const, icon: Settings, label: 'Config' },
        ] : [
          { view: 'test' as const, icon: TestTube, label: 'Test' },
          { view: 'audit' as const, icon: Search, label: 'Audit' },
          { view: 'review' as const, icon: FileText, label: 'Review' },
          { view: 'config' as const, icon: Settings, label: 'Config' },
        ]).map(({ view, icon: Icon, label }, i) => (
          <button
            key={view}
            onClick={() => setCurrentView(view)}
            className={`flex flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors ${
              i > 0 ? 'border-l border-zinc-300 dark:border-zinc-700' : ''
            } ${
              currentView === view
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Icon className="h-4 w-4 mb-0.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Random buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          onClick={() => { setSource('local'); selectRandomQuestionPoisonPair(); }}
          disabled={isRunning}
          className="flex-1 h-8 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
          title="Random from Easy/Batch tier"
        >
          🎲 Local
        </Button>
        <Button
          onClick={() => { setSource('cloud'); selectRandomQuestionPoisonPair(); }}
          disabled={isRunning}
          className="flex-1 h-8 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
          title="Random from Hard/Cloud tier"
        >
          🎲 Cloud
        </Button>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setMode("unfiltered")}
          disabled={isRunning}
          className={`flex-1 h-7 text-xs font-medium rounded-lg transition-colors ${
            mode === "unfiltered"
              ? "bg-zinc-600 text-white"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          } disabled:opacity-50`}
        >
          Unfiltered
        </button>
        <button
          onClick={() => setMode("pill")}
          disabled={isRunning}
          className={`flex-1 h-7 text-xs font-medium rounded-lg transition-colors ${
            mode === "pill"
              ? "bg-red-600 text-white"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          } disabled:opacity-50`}
        >
          Pill
        </button>
        <button
          onClick={() => setMode("pill-prompt")}
          disabled={isRunning}
          className={`flex-1 h-7 text-xs font-medium rounded-lg transition-colors ${
            mode === "pill-prompt"
              ? "bg-amber-600 text-white"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          } disabled:opacity-50`}
        >
          Pill+
        </button>
      </div>

      {/* Question Input */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Question</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpandedInput('question')}
              className="text-zinc-500 hover:text-indigo-400 p-1"
              title="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={saveCurrentQuestionPoison}
              className="text-zinc-500 hover:text-emerald-400 p-1"
              title="Save"
            >
              💾
            </button>
            <button
              onClick={() => setQuestionLocked(!questionLocked)}
              className="text-zinc-500 p-1"
            >
              {questionLocked ? "🔒" : "🔓"}
            </button>
          </div>
        </div>
        <div
          onClick={() => !questionLocked && setExpandedInput('question')}
          className={`w-full h-16 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 overflow-hidden cursor-pointer hover:border-indigo-500/50 ${questionLocked ? 'opacity-50' : ''}`}
        >
          <div className="line-clamp-3">{question || <span className="text-zinc-400">Click to edit question...</span>}</div>
        </div>
      </div>

      {/* Poison Input */}
      {showPillConfig && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold uppercase tracking-wider text-red-400">☠️ Poison</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpandedInput('poison')}
                className="text-zinc-500 hover:text-red-400 p-1"
                title="Expand"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPoisonLocked(!poisonLocked)}
                className="text-zinc-500 p-1"
              >
                {poisonLocked ? "🔒" : "🔓"}
              </button>
            </div>
          </div>
          <div
            onClick={() => !poisonLocked && setExpandedInput('poison')}
            className={`w-full h-16 px-3 py-2 text-sm rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700/50 text-zinc-900 dark:text-zinc-100 overflow-hidden cursor-pointer hover:border-red-500/50 ${poisonLocked ? 'opacity-50' : ''}`}
          >
            <div className="line-clamp-3">{poison || <span className="text-zinc-400">Click to edit poison...</span>}</div>
          </div>
        </div>
      )}

      {/* Expanded Input Modal */}
      {expandedInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
              <h2 className={`text-sm font-semibold ${expandedInput === 'poison' ? 'text-red-400' : 'text-zinc-100'}`}>
                {expandedInput === 'question' ? 'Edit Question' : '☠️ Edit Poison Pill'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setExpandedInput(null)} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <textarea
                value={expandedInput === 'question' ? question : poison}
                onChange={(e) => expandedInput === 'question' ? setQuestion(e.target.value) : setPoison(e.target.value)}
                className={`w-full h-64 px-3 py-2 text-sm rounded-lg border ${
                  expandedInput === 'poison'
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700/50'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                } text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-2 ${
                  expandedInput === 'poison' ? 'focus:ring-red-500' : 'focus:ring-indigo-500'
                }`}
                placeholder={expandedInput === 'question' ? 'Enter your test question...' : 'Enter the false information to inject...'}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-700 px-4 py-3">
              <Button variant="ghost" onClick={() => setExpandedInput(null)} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Echo Config */}
      {showPillConfig && (
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-[10px] text-zinc-500 block mb-1">Rounds</label>
            <select
              value={echoConfig.rounds}
              onChange={(e) => setEchoConfig({ ...echoConfig, rounds: Number(e.target.value) })}
              className="w-full h-7 px-2 text-xs rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-zinc-500 block mb-1">Inject At</label>
            <select
              value={echoConfig.poisonRound}
              onChange={(e) => setEchoConfig({ ...echoConfig, poisonRound: Number(e.target.value) })}
              className="w-full h-7 px-2 text-xs rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
            >
              {Array.from({ length: echoConfig.rounds }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Round {n}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-zinc-500 block mb-1">Via Agent</label>
            <select
              value={echoConfig.poisonAgent}
              onChange={(e) => setEchoConfig({ ...echoConfig, poisonAgent: e.target.value as 'd1' | 'd2' | 'd3' })}
              className="w-full h-7 px-2 text-xs rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
            >
              <option value="d1">D1</option>
              <option value="d2">D2</option>
              <option value="d3">D3</option>
            </select>
          </div>
        </div>
      )}

      {/* Run/Stop + Clear */}
      <div className="flex gap-2 mb-4">
        {!isRunning ? (
          <Button
            onClick={runTest}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-sm font-bold"
          >
            <Play className="h-4 w-4 mr-1.5" />
            Run Test
          </Button>
        ) : (
          <Button
            onClick={stopTest}
            className="flex-1 h-9 text-sm text-red-400 border border-red-700"
            variant="ghost"
          >
            <Square className="h-4 w-4 mr-1.5" />
            Stop
          </Button>
        )}
        <Button
          onClick={clearResults}
          disabled={isRunning}
          variant="ghost"
          size="sm"
          className="h-9 px-3"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          COMPACT STATS - Single row with key metrics
          ═══════════════════════════════════════════════════════════════ */}
      <div className="pt-3 border-t border-zinc-300 dark:border-zinc-800 space-y-2">
        {/* Catch Rate Bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-6 rounded-full overflow-hidden bg-zinc-800 relative">
            <div
              className={`h-full transition-all duration-500 ${
                stats.catchRate >= 80 ? 'bg-emerald-500' :
                stats.catchRate >= 50 ? 'bg-amber-500' :
                stats.catchRate > 0 ? 'bg-red-500' : 'bg-zinc-700'
              }`}
              style={{ width: `${stats.catchRate}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
              {stats.catchRate}% Catch Rate
            </span>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded ${
            stats.catchRate >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
            stats.catchRate >= 50 ? 'bg-amber-500/20 text-amber-400' :
            stats.testsRun > 0 ? 'bg-red-500/20 text-red-400' : 'bg-zinc-700 text-zinc-500'
          }`}>
            {stats.catchRate >= 80 ? '🛡️' : stats.catchRate >= 50 ? '⚠️' : stats.testsRun > 0 ? '🚨' : '—'}
          </span>
        </div>

        {/* Compact 4-stat row */}
        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="p-1.5 rounded bg-zinc-800" title="Tests Run">
            <div className="text-lg font-black text-zinc-100">{stats.testsRun}</div>
            <div className="text-[8px] text-zinc-500">Tests</div>
          </div>
          <div className="p-1.5 rounded bg-emerald-900/30" title="Judge Caught">
            <div className="text-lg font-black text-emerald-400">{stats.caught}</div>
            <div className="text-[8px] text-emerald-500">Caught</div>
          </div>
          <div className="p-1.5 rounded bg-red-900/30" title="Lie Spread">
            <div className="text-lg font-black text-red-400">{stats.echoChambers}</div>
            <div className="text-[8px] text-red-500">Spread</div>
          </div>
          <div className="p-1.5 rounded bg-amber-900/30" title="Lie Killed">
            <div className="text-lg font-black text-amber-400">{stats.poisonKilled}</div>
            <div className="text-[8px] text-amber-500">Killed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
