'use client';

import { TestTheme as Theme, EchoConfig, SavedPoison } from '@/lib/types';
import { Shield, FlaskConical, Swords, Zap, Skull } from 'lucide-react';

// Speed mode configuration - matches batch
const SPEED_MODES = [
  { id: 1, name: 'Defense Only', icon: Shield, color: 'from-cyan-500 to-blue-500', tooltip: 'Uses locked true facts + kill switch to stop contradictions' },
  { id: 2, name: 'Protected + Defense', icon: Shield, color: 'from-amber-500 to-orange-500', tooltip: 'First tries anti-lie prompts, then truth anchors as backup' },
  { id: 3, name: 'Pill + Protected + Defense', icon: FlaskConical, color: 'from-purple-500 to-pink-500', tooltip: 'Injects poison, tests if prompts catch it, then defense layer' },
  { id: 4, name: 'Full Experiment', icon: Swords, color: 'from-emerald-500 to-teal-600', tooltip: 'Runs all 4 passes: baseline, poison, protected, defense' },
  { id: 5, name: 'Chaos', icon: Zap, color: 'from-red-600 to-rose-700', tooltip: 'Multi-agent poison attacks — defense only (no protected prompts)' },
  { id: 6, name: 'ARMAGEDDON', icon: Skull, color: 'from-orange-600 via-red-700 to-black', tooltip: 'Maximum stress — defense only, judge poisoned, recovery disabled' },
  { id: 7, name: 'Chaos+Prot', icon: Zap, color: 'from-red-500 via-emerald-600 to-red-600', tooltip: 'Chaos with PROTECTED PROMPTS active' },
  { id: 8, name: 'ARMG+Prot', icon: Skull, color: 'from-orange-600 via-emerald-600 to-red-700', tooltip: 'Armageddon with PROTECTED PROMPTS active' },
  { id: 9, name: 'Lite', icon: Zap, color: 'from-sky-400 to-cyan-500', tooltip: '2 agents only (D1+D2) — fast hallucination check for production apps' },
];

interface TestControlsProps {
  theme: Theme;
  darkMode: boolean;
  speedMode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  setSpeedMode: (mode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) => void;
  question: string;
  setQuestion: (q: string) => void;
  poison: string;
  setPoison: (p: string) => void;
  markers: string;
  setMarkers: (m: string) => void;
  savedPoisons: SavedPoison[];
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function TestControls({
  theme,
  darkMode,
  speedMode,
  setSpeedMode,
  question,
  setQuestion,
  poison,
  setPoison,
  markers,
  setMarkers,
  savedPoisons,
  isRunning,
  onRun,
  onStop,
  onClear,
}: TestControlsProps) {
  return (
    <div className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-3">
      {/* Speed Mode Selector - Compact */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Mode:</span>
        <div className="flex gap-1 flex-wrap">
          {SPEED_MODES.map((mode) => {
            const isSelected = speedMode === mode.id;
            const IconComponent = mode.icon;
            return (
              <div key={mode.id} className="relative group">
                <button
                  onClick={() => !isRunning && setSpeedMode(mode.id as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)}
                  disabled={isRunning}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                    isSelected
                      ? `bg-gradient-to-r ${mode.color} text-white`
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <IconComponent size={10} />
                  <span>{mode.name}</span>
                </button>
                {/* Tooltip on hover */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 bg-zinc-900 text-[9px] text-zinc-200 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-zinc-700 z-20 shadow-xl whitespace-nowrap">
                  {mode.tooltip}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question and Poison Inputs - Side by Side */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Question Input */}
        <div>
          <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
            Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter your test question..."
            disabled={isRunning}
            className={`w-full px-2 py-1.5 rounded text-xs ${theme.input} ${theme.text} resize-none h-16 ${
              isRunning ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        </div>

        {/* Poison Input */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              Poison Pill
            </label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const pill = savedPoisons.find(p => p.id === e.target.value);
                  if (pill) setPoison(pill.content);
                }
              }}
              disabled={isRunning}
              className={`px-1 py-0.5 rounded text-[10px] ${theme.input} ${theme.text} ${
                isRunning ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Saved...</option>
              {savedPoisons.map(pill => (
                <option key={pill.id} value={pill.id}>{pill.name}</option>
              ))}
            </select>
          </div>
          <textarea
            value={poison}
            onChange={(e) => setPoison(e.target.value)}
            placeholder="Enter false information to inject..."
            disabled={isRunning}
            className={`w-full px-2 py-1.5 rounded text-xs ${theme.input} ${theme.text} resize-none h-16 ${
              isRunning ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        </div>
      </div>

      {/* Markers Input */}
      <div className="mb-3">
        <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
          Markers (comma-separated keywords to detect in responses)
        </label>
        <input
          type="text"
          value={markers}
          onChange={(e) => setMarkers(e.target.value)}
          placeholder="1920, paris, false-claim"
          disabled={isRunning}
          className={`w-full px-2 py-1.5 rounded text-xs ${theme.input} ${theme.text} ${
            isRunning ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </div>

      {/* Action Buttons - Compact */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            className="px-4 py-1.5 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-all"
          >
            ■ STOP
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={!question.trim() || !poison.trim()}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
              question.trim() && poison.trim()
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed'
            }`}
          >
            ▶ RUN TEST
          </button>
        )}

        <button
          onClick={onClear}
          disabled={isRunning}
          className={`px-3 py-1.5 rounded text-xs font-medium ${theme.bgTertiary} ${theme.textSecondary} border ${theme.border} hover:bg-zinc-200 dark:hover:bg-zinc-600 ${
            isRunning ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Clear
        </button>

        <span className="text-[10px] text-zinc-500 ml-2">
          {isRunning ? 'Running...' : 'Ready'}
        </span>
      </div>
    </div>
  );
}
