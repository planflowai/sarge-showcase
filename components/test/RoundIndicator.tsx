'use client';

import { TestTheme as Theme } from '@/lib/types' // Test types;

interface RoundIndicatorProps {
  theme: Theme;
  darkMode: boolean;
  currentRound: number;
  totalRounds: number;
  poisonRound: number;
  isRunning: boolean;
}

export function RoundIndicator({
  theme,
  darkMode,
  currentRound,
  totalRounds,
  poisonRound,
  isRunning,
}: RoundIndicatorProps) {
  
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b ${theme.borderSubtle} ${darkMode ? 'bg-violet-950/20' : 'bg-violet-50'}`}>
      {/* Left: Visual Round Display */}
      <div className="flex items-center gap-4">
        <span className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider`}>Echo Chamber Test</span>
        
        {/* Round Boxes */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => {
            const isPoisonRound = r === poisonRound;
            const isComplete = r < currentRound;
            const isCurrent = r === currentRound;
            
            return (
              <div
                key={r}
                className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all ${
                  isComplete 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : isCurrent 
                    ? 'bg-violet-600 text-white scale-110 shadow-lg' 
                    : `${theme.bgTertiary} ${theme.textFaint} border ${theme.borderSubtle}`
                } ${isPoisonRound ? 'ring-2 ring-red-500' : ''}`}
              >
                {isPoisonRound ? (
                  <span>☠️</span>
                ) : (
                  <span>R{r}</span>
                )}
              </div>
            );
          })}
        </div>
        
        <span className={`text-sm ${theme.textSecondary}`}>
          Round <span className={`${theme.text} font-bold`}>{currentRound || 0}</span> / {totalRounds}
        </span>
        
        {isRunning && currentRound >= poisonRound && (
          <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Poison Active
          </span>
        )}
      </div>
      
      {/* Right: Status */}
      <div className="flex items-center gap-3">
        {isRunning ? (
          <span className="text-xs text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-full border border-violet-500/20 flex items-center gap-2">
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            Running...
          </span>
        ) : currentRound > 0 ? (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            ✓ Complete
          </span>
        ) : (
          <span className={`text-xs ${theme.textMuted}`}>Ready</span>
        )}
      </div>
    </div>
  );
}
