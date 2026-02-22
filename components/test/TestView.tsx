'use client';

import { useState, useEffect } from 'react';
import { TestTheme as Theme, ResponseData, EchoConfig } from '@/lib/types' // Test types;
import { ResponseBox } from './ResponseBox';

interface RoundResponse extends ResponseData {
  round: number;
}

interface StreamingState {
  d1: 'waiting' | 'streaming' | 'done';
  d2: 'waiting' | 'streaming' | 'done';
  d3: 'waiting' | 'streaming' | 'done';
  judge: 'waiting' | 'streaming' | 'done';
}

interface TestViewProps {
  theme: Theme;
  darkMode: boolean;
  demoMode: boolean;
  unfilteredResponses: RoundResponse[];
  tribunalResponses: ResponseData[];
  streamingState: {
    phase: 'idle' | 'unfiltered' | 'tribunal';
    unfiltered: StreamingState;
    tribunal: StreamingState;
  };
  isRunning: boolean;
  onOpenReport?: () => void;
  echoConfig?: EchoConfig;
  mode?: 'unfiltered' | 'pill' | 'pill-prompt' | 'defense';
  poisonMarkers?: string[];
  poisonText?: string;
}

export function TestView({ 
  theme, 
  darkMode, 
  demoMode, 
  unfilteredResponses,
  tribunalResponses,
  streamingState,
  isRunning,
  onOpenReport,
  echoConfig,
  mode,
  poisonMarkers,
  poisonText,
}: TestViewProps) {
  
  // Track which rounds are expanded
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());
  const [tribunalExpanded, setTribunalExpanded] = useState(false);

  // Group responses by round
  const rounds: { [key: number]: RoundResponse[] } = {};
  unfilteredResponses.forEach(r => {
    if (!rounds[r.round]) rounds[r.round] = [];
    rounds[r.round].push(r);
  });
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const currentRound = roundNumbers.length > 0 ? Math.max(...roundNumbers) : 0;

  // Auto-expand current streaming round
  useEffect(() => {
    if (streamingState.phase === 'unfiltered' && currentRound > 0) {
      setExpandedRounds(prev => new Set([...prev, currentRound]));
    }
    if (streamingState.phase === 'tribunal') {
      setTribunalExpanded(true);
    }
  }, [streamingState.phase, currentRound]);

  // Auto-expand tribunal when test completes
  useEffect(() => {
    if (tribunalResponses.length > 0 && streamingState.phase === 'idle') {
      setTribunalExpanded(true);
    }
  }, [tribunalResponses.length, streamingState.phase]);

  const toggleRound = (roundNum: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      if (next.has(roundNum)) {
        next.delete(roundNum);
      } else {
        next.add(roundNum);
      }
      return next;
    });
  };

  // If not running and no results, show compact ready banner
  if (!isRunning && unfilteredResponses.length === 0 && tribunalResponses.length === 0) {
    return (
      <div className="flex-1 flex flex-col p-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded ${theme.bgSecondary} border ${theme.border}`}>
          <span className="text-base">⚖️</span>
          <span className={`text-xs font-medium ${theme.text}`}>Ready</span>
          <span className={`text-[10px] ${theme.textMuted}`}>Enter prompt → Run Test</span>
          <span className={`text-[10px] ${theme.textFaint} ml-auto`}>D1→D2→D3→Judge</span>
        </div>
      </div>
    );
  }

  const unfilteredHallucinations = unfilteredResponses.filter(r => r.status === 'echo').length;
  const unfilteredDrifts = unfilteredResponses.filter(r => r.status === 'flagged').length;
  const tribunalVerdict = tribunalResponses.find(r => r.role === 'judge')?.status;
  const showTribunal = streamingState.phase === 'tribunal' || tribunalResponses.length > 0;
  const isStreamingUnfiltered = streamingState.phase === 'unfiltered';

  // Get round status summary
  const getRoundStatus = (roundNum: number) => {
    const responses = rounds[roundNum] || [];
    const echos = responses.filter(r => r.status === 'echo').length;
    const drifts = responses.filter(r => r.status === 'flagged').length;
    const complete = responses.length === 3;
    const isCurrentRound = roundNum === currentRound && isStreamingUnfiltered;
    
    return { responses, echos, drifts, complete, isCurrentRound };
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
      {/* Poison Callout — prominent display of what false claim was injected */}
      {(mode === 'pill' || mode === 'pill-prompt') && poisonText && echoConfig && (
        <div className="p-4 bg-red-500/10 border-2 border-red-500/40 rounded-lg">
          <div className="text-sm font-bold text-red-400 mb-1">The False Claim We Injected:</div>
          <div className={`text-base ${theme.text} font-medium mb-2`}>&quot;{poisonText}&quot;</div>
          <div className={`text-xs ${theme.textMuted}`}>
            Injected in Round {echoConfig.poisonRound} through {echoConfig.poisonAgent.toUpperCase()}.
            {mode === 'pill-prompt' && ' Safety prompts are active for protection.'}
            {' '}Watch below to see if the AI repeats it.
          </div>
        </div>
      )}

      {/* SECTION HEADER */}
      <div className="flex items-center gap-3">
        <span className="text-lg">🚫</span>
        <span className={`text-sm font-bold ${theme.text} uppercase tracking-wide`}>
          {mode === 'pill' || mode === 'pill-prompt' ? 'Debate Rounds' : 'Testing Without Protection'}
        </span>
        <span className={`text-xs ${theme.textMuted}`}>
          {roundNumbers.length} round{roundNumbers.length !== 1 ? 's' : ''}
        </span>
        <div className={`flex-1 h-px ${theme.border}`} />
        {!isStreamingUnfiltered && unfilteredResponses.length > 0 && (
          <div className="flex items-center gap-2">
            {unfilteredDrifts > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-amber-400 bg-amber-500/10 border border-amber-500/20">
                🔍 {unfilteredDrifts} Challenged
              </span>
            )}
            {unfilteredHallucinations > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-red-400 bg-red-500/10 border border-red-500/20">
                ❌ {unfilteredHallucinations} Repeated the Lie
              </span>
            )}
          </div>
        )}
      </div>

      {/* COLLAPSIBLE ROUNDS */}
      <div className="space-y-2">
        {roundNumbers.map(roundNum => {
          const { responses, echos, drifts, complete, isCurrentRound } = getRoundStatus(roundNum);
          const usePoison = mode === 'pill' || mode === 'pill-prompt';
          const isPoisonRound = usePoison && echoConfig ? roundNum === echoConfig.poisonRound : false;
          const hasEchoes = responses.some(r => r.status === 'echo');
          const isExpanded = expandedRounds.has(roundNum);
          
          return (
            <div 
              key={roundNum} 
              className={`rounded-lg border overflow-hidden transition-all ${
                isPoisonRound ? 'border-red-500/40' :
                hasEchoes ? 'border-red-500/30 ring-2 ring-red-500/20' :
                isCurrentRound ? 'border-indigo-500/40' :
                theme.border
              } ${theme.bgSecondary}`}
            >
              {/* Round Header - Always visible, clickable */}
              <button
                onClick={() => toggleRound(roundNum)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isPoisonRound ? 'bg-red-500/10 hover:bg-red-500/15' : 
                  isCurrentRound ? 'bg-indigo-500/10 hover:bg-indigo-500/15' :
                  `${theme.bgTertiary} ${darkMode ? 'hover:bg-zinc-700/50' : 'hover:bg-gray-200'}`
                }`}
              >
                {/* Expand/Collapse Icon */}
                <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''} ${theme.textMuted}`}>
                  ▶
                </span>
                
                {/* Round Label */}
                <span className={`text-sm font-bold ${
                  isPoisonRound ? 'text-red-400' : 
                  isCurrentRound ? 'text-indigo-400' :
                  theme.text
                }`}>
                  {isPoisonRound ? '☠️' : isCurrentRound ? '●' : '✓'} ROUND {roundNum}
                </span>
                
                {/* Status badges */}
                {isPoisonRound && (
                  <span className="text-[10px] text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">POISON</span>
                )}
                {isCurrentRound && (
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded animate-pulse">ACTIVE</span>
                )}
                
                <div className="flex-1" />
                
                {/* Worker status indicators */}
                <div className="flex items-center gap-1">
                  {['D1', 'D2', 'D3'].map((label, idx) => {
                    const response = responses[idx];
                    // Show streaming for the next expected response slot
                    const isStreaming = isCurrentRound && !response && idx === responses.length && responses.length < 3;
                    return (
                      <span 
                        key={label}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          response?.status === 'echo' ? 'bg-red-500/20 text-red-400' :
                          response?.status === 'flagged' ? 'bg-amber-500/20 text-amber-400' :
                          response ? 'bg-emerald-500/20 text-emerald-400' :
                          isStreaming ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' :
                          `${theme.bgTertiary} ${theme.textFaint}`
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
                
                {/* Echo/Drift counts */}
                {complete && (echos > 0 || drifts > 0) && (
                  <div className="flex items-center gap-1 text-[10px]">
                    {echos > 0 && <span className="text-red-400">⚠{echos}</span>}
                    {drifts > 0 && <span className="text-amber-400">🔍{drifts}</span>}
                  </div>
                )}
              </button>
              
              {/* Round Content - Collapsible */}
              {isExpanded && (
                <div className={`p-3 space-y-2 border-t ${theme.borderSubtle}`}>
                  {isPoisonRound && echoConfig && (
                    <div className="p-2 bg-red-500/15 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
                      <span className="text-base">☠️</span>
                      <span className="font-bold">False claim inserted here</span>
                      <span>via {echoConfig.poisonAgent.toUpperCase()}</span>
                    </div>
                  )}
                  {responses.map((response, idx) => (
                    <ResponseBox
                      key={`r${roundNum}-${response.role}-${idx}`}
                      theme={theme}
                      darkMode={darkMode}
                      demoMode={demoMode}
                      data={response}
                      section="unfiltered"
                      isStreaming={isCurrentRound && idx === responses.length - 1 && streamingState.unfiltered[response.role] === 'streaming'}
                      isWaiting={false}
                    />
                  ))}
                  
                  {/* Waiting placeholder for current round */}
                  {isCurrentRound && responses.length < 3 && (
                    <div className={`p-3 rounded-lg border ${theme.border} ${theme.bgTertiary}`}>
                      <span className={`${theme.textMuted} text-sm italic animate-pulse`}>
                        {responses.length === 0 ? '⏳ D1 (Worker) waiting...' :
                         responses.length === 1 ? '⏳ D2 (Cross-Verifier) waiting...' :
                         '⏳ D3 (Forensic Auditor) waiting...'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* TRIBUNAL SECTION */}
      {(showTribunal || streamingState.phase === 'tribunal') && (
        <>
          {/* Divider */}
          <div className={`h-px my-1 ${darkMode ? 'bg-emerald-500/30' : 'bg-emerald-300'}`} />
          
          {/* Tribunal - Also collapsible */}
          <div className={`rounded-lg border border-emerald-500/40 ${theme.bgSecondary} overflow-hidden`}>
            <button
              onClick={() => setTribunalExpanded(!tribunalExpanded)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors"
            >
              <span className={`text-xs transition-transform ${tribunalExpanded ? 'rotate-90' : ''} ${theme.textMuted}`}>
                ▶
              </span>
              <span className="text-sm font-bold text-emerald-400">
                🛡️ Final Safety Check
              </span>
              <span className={`text-xs ${theme.textMuted}`}>Independent Verification</span>
              
              {streamingState.phase === 'tribunal' && (
                <span className="text-[10px] text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded animate-pulse">ACTIVE</span>
              )}
              
              <div className="flex-1" />
              
              {/* Worker status */}
              <div className="flex items-center gap-1">
                {['D1', 'D2', 'D3', '⚖️'].map((label, idx) => {
                  const roles = ['d1', 'd2', 'd3', 'judge'];
                  const response = tribunalResponses.find(r => r.role === roles[idx]);
                  return (
                    <span 
                      key={label}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        response?.status === 'caught' ? 'bg-emerald-500/20 text-emerald-400' :
                        response?.status === 'flagged' ? 'bg-amber-500/20 text-amber-400' :
                        response ? 'bg-emerald-500/20 text-emerald-400' :
                        `${theme.bgTertiary} ${theme.textFaint}`
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
              
              {/* Final verdict badge */}
              {tribunalVerdict && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  tribunalVerdict === 'caught' 
                    ? 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/30' 
                    : 'text-red-400 bg-red-500/20 border border-red-500/30'
                }`}>
                  {tribunalVerdict === 'caught' ? '✅ System Detected It' : '❌ System Missed It'}
                </span>
              )}
            </button>
            
            {tribunalExpanded && (
              <div className="p-3 space-y-2 border-t border-emerald-500/20">
                {tribunalResponses.map((response, idx) => (
                  <ResponseBox
                    key={`tribunal-${response.role}-${idx}`}
                    theme={theme}
                    darkMode={darkMode}
                    demoMode={demoMode}
                    data={response}
                    section="tribunal"
                    isStreaming={streamingState.phase === 'tribunal' && idx === tribunalResponses.length - 1}
                    isWaiting={false}
                    onOpenReport={response.role === 'judge' ? onOpenReport : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
