'use client';

import { TestTheme as Theme, EchoConfig } from '@/lib/types' // Test types;

interface SavedPill {
  id: string;
  name: string;
  content: string;
}

interface BottomControlsProps {
  theme: Theme;
  darkMode: boolean;
  demoMode: boolean;
  mode: 'unfiltered' | 'pill' | 'pill-prompt';
  setMode: (mode: 'unfiltered' | 'pill' | 'pill-prompt') => void;
  question: string;
  setQuestion: (q: string) => void;
  questionLocked: boolean;
  setQuestionLocked: (locked: boolean) => void;
  poison: string;
  setPoison: (p: string) => void;
  poisonLocked: boolean;
  setPoisonLocked: (locked: boolean) => void;
  savedPills: SavedPill[];
  echoConfig: EchoConfig;
  setEchoConfig: (config: EchoConfig) => void;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function BottomControls({
  theme,
  darkMode,
  demoMode,
  mode,
  setMode,
  question,
  setQuestion,
  questionLocked,
  setQuestionLocked,
  poison,
  setPoison,
  poisonLocked,
  setPoisonLocked,
  savedPills,
  echoConfig,
  setEchoConfig,
  isRunning,
  onRun,
  onStop,
  onClear,
}: BottomControlsProps) {

  const showPillConfig = mode === 'pill' || mode === 'pill-prompt';

  return (
    <div className={`border-t ${theme.borderSubtle} ${theme.bgSecondary} p-4`}>
      {/* Question Input */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <label className={`text-xs font-medium ${theme.textMuted}`}>Question</label>
          {questionLocked && <span className="text-xs text-emerald-400">🔒 Locked</span>}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => !questionLocked && setQuestion(e.target.value)}
            placeholder="Type your question..."
            disabled={questionLocked}
            className={`flex-1 px-3 py-2 rounded-lg text-sm ${theme.input} ${theme.text} ${
              questionLocked ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
          <button
            onClick={() => setQuestionLocked(!questionLocked)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              questionLocked 
                ? 'bg-emerald-600 text-white' 
                : `${theme.bgTertiary} ${theme.textSecondary} border ${theme.border}`
            }`}
          >
            {questionLocked ? '🔓 Unlock' : '🔒 Lock'}
          </button>
        </div>
      </div>

      {/* Poison Input - only show for pill modes */}
      {showPillConfig && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <label className={`text-xs font-medium ${theme.textMuted}`}>Poison Pill</label>
            {poisonLocked && <span className="text-xs text-red-400">🔒 Locked</span>}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={poison}
              onChange={(e) => !poisonLocked && setPoison(e.target.value)}
              placeholder="Type poison pill or select from saved..."
              disabled={poisonLocked}
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${theme.input} ${theme.text} ${
                poisonLocked ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const pill = savedPills.find(p => p.id === e.target.value);
                  if (pill) setPoison(pill.content);
                }
              }}
              disabled={poisonLocked}
              className={`px-3 py-2 rounded-lg text-sm ${theme.input} ${theme.text} ${
                poisonLocked ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <option value="">▼ Saved Pills</option>
              {savedPills.map(pill => (
                <option key={pill.id} value={pill.id}>{pill.name}</option>
              ))}
            </select>
            <button
              onClick={() => setPoisonLocked(!poisonLocked)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                poisonLocked 
                  ? 'bg-red-600 text-white' 
                  : `${theme.bgTertiary} ${theme.textSecondary} border ${theme.border}`
              }`}
            >
              {poisonLocked ? '🔓 Unlock' : '🔒 Lock'}
            </button>
          </div>
        </div>
      )}

      {/* Pill Config - rounds, inject at, via */}
      {showPillConfig && (
        <div className="flex items-center gap-4 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <span className="text-xs text-red-400 font-medium">☠️ Injection Config:</span>
          
          <div className="flex items-center gap-2">
            <label className={`text-xs ${theme.textMuted}`}>Rounds:</label>
            <select
              value={echoConfig.rounds}
              onChange={(e) => setEchoConfig({ ...echoConfig, rounds: parseInt(e.target.value) })}
              className={`px-2 py-1 rounded text-xs ${theme.input} ${theme.text}`}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className={`text-xs ${theme.textMuted}`}>Inject at:</label>
            <select
              value={echoConfig.poisonRound}
              onChange={(e) => setEchoConfig({ ...echoConfig, poisonRound: parseInt(e.target.value) })}
              className={`px-2 py-1 rounded text-xs ${theme.input} ${theme.text}`}
            >
              {Array.from({ length: echoConfig.rounds }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Round {n}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className={`text-xs ${theme.textMuted}`}>Via:</label>
            <select
              value={echoConfig.poisonAgent}
              onChange={(e) => setEchoConfig({ ...echoConfig, poisonAgent: e.target.value as 'd1' | 'd2' | 'd3' })}
              className={`px-2 py-1 rounded text-xs ${theme.input} ${theme.text}`}
            >
              <option value="d1">D1</option>
              <option value="d2">D2</option>
              <option value="d3">D3</option>
            </select>
          </div>
        </div>
      )}

      {/* Mode Buttons + Run/Stop */}
      <div className="flex items-center gap-3">
        {/* Mode Buttons */}
        <div className="flex rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-600">
          <button
            onClick={() => setMode('unfiltered')}
            disabled={isRunning}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              mode === 'unfiltered'
                ? 'bg-indigo-600 text-white'
                : `${theme.bgTertiary} ${theme.textSecondary} hover:bg-gray-200 dark:hover:bg-zinc-700`
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            ⚡ Unfiltered
          </button>
          <button
            onClick={() => setMode('pill')}
            disabled={isRunning}
            className={`px-4 py-2 text-sm font-medium border-l border-zinc-300 dark:border-zinc-600 transition-all ${
              mode === 'pill'
                ? 'bg-red-600 text-white'
                : `${theme.bgTertiary} ${theme.textSecondary} hover:bg-gray-200 dark:hover:bg-zinc-700`
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            ☠️ Pill
          </button>
          <button
            onClick={() => setMode('pill-prompt')}
            disabled={isRunning}
            className={`px-4 py-2 text-sm font-medium border-l border-zinc-300 dark:border-zinc-600 transition-all ${
              mode === 'pill-prompt'
                ? 'bg-emerald-600 text-white'
                : `${theme.bgTertiary} ${theme.textSecondary} hover:bg-gray-200 dark:hover:bg-zinc-700`
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            🛡️ Pill + Prompt
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mode indicator */}
        <div className={`text-xs ${theme.textMuted} px-3 py-1 rounded ${theme.bgTertiary}`}>
          {mode === 'unfiltered' && 'No pill • No prompts'}
          {mode === 'pill' && 'Pill injected • No prompts'}
          {mode === 'pill-prompt' && 'Pill injected • Prompts active'}
        </div>

        {/* Clear Button */}
        <button
          onClick={onClear}
          disabled={isRunning}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.bgTertiary} ${theme.textSecondary} border ${theme.border} hover:bg-gray-200 dark:hover:bg-zinc-700 ${
            isRunning ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          🗑️ Clear
        </button>

        {/* Run/Stop Button */}
        {isRunning ? (
          <button
            onClick={onStop}
            className="px-6 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition-all"
          >
            ■ STOP
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={!question.trim()}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              question.trim()
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
            }`}
          >
            ▶ RUN
          </button>
        )}
      </div>
    </div>
  );
}
