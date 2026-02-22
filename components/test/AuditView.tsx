'use client';

import { useState, useMemo } from 'react';
import { TestTheme as Theme, BatchTestResult, BatchPassLog } from '@/lib/types';

interface AuditViewProps {
  theme: Theme;
  passLogs: BatchPassLog[];
}

export function AuditView({ theme, passLogs }: AuditViewProps) {
  const [selectedTest, setSelectedTest] = useState<BatchTestResult | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'kills' | 'echoes' | 'missed'>('all');
  const [selectedPass, setSelectedPass] = useState<string>('all');

  // Flatten all tests from all passes
  const allTests = useMemo(() => {
    const tests: (BatchTestResult & { passName: string })[] = [];
    for (const log of passLogs) {
      for (const test of log.tests) {
        tests.push({ ...test, passName: log.pass });
      }
    }
    return tests;
  }, [passLogs]);

  // Filter tests
  const filteredTests = useMemo(() => {
    let filtered = allTests;

    if (selectedPass !== 'all') {
      filtered = filtered.filter(t => t.passName === selectedPass);
    }

    switch (filterMode) {
      case 'kills':
        return filtered.filter(t => (t.killRound ?? 0) > 0);
      case 'echoes':
        return filtered.filter(t => (t.echoCount ?? 0) > 0);
      case 'missed':
        return filtered.filter(t => t.judgeResponse?.verdict === 'missed' && t.mode !== 'unfiltered');
      default:
        return filtered;
    }
  }, [allTests, filterMode, selectedPass]);

  // Stats
  const stats = useMemo(() => {
    const poisonTests = allTests.filter(t => t.mode !== 'unfiltered');
    const kills = poisonTests.filter(t => (t.killRound ?? 0) > 0).length;
    const echoes = poisonTests.filter(t => (t.echoCount ?? 0) > 0).length;
    const caught = poisonTests.filter(t => t.judgeResponse?.verdict === 'caught').length;
    const missed = poisonTests.filter(t => t.judgeResponse?.verdict === 'missed').length;

    return {
      total: allTests.length,
      poisonTests: poisonTests.length,
      kills,
      echoes,
      caught,
      missed,
      killRate: poisonTests.length > 0 ? Math.round((kills / poisonTests.length) * 100) : 0,
      catchRate: poisonTests.length > 0 ? Math.round((caught / poisonTests.length) * 100) : 0,
    };
  }, [allTests]);

  // Highlight markers in text
  const highlightMarkers = (text: string, markers: string[]) => {
    if (!markers || markers.length === 0) return text;
    let result = text;
    for (const marker of markers) {
      const regex = new RegExp(`(${marker})`, 'gi');
      result = result.replace(regex, '<<<MARK>>>$1<<<ENDMARK>>>');
    }
    // Split by markers and render
    const parts = result.split(/<<<MARK>>>|<<<ENDMARK>>>/);
    return parts.map((part, i) => {
      const isMarker = markers.some(m => part.toLowerCase() === m.toLowerCase());
      return isMarker ? (
        <span key={i} className="bg-red-500/40 text-red-200 font-bold px-1 rounded">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  };

  if (passLogs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className={`text-xl font-bold ${theme.text} mb-2`}>No Data to Audit</h2>
          <p className={theme.textMuted}>Run a batch test first, then come here to verify results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Stats - Clickable for proof */}
      <div className={`${theme.bgSecondary} border-b ${theme.border} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-lg font-bold ${theme.text}`}>🔍 Audit & Verification</h2>
          <span className={`text-xs ${theme.textMuted}`}>Click any stat to filter and verify</span>
        </div>

        <div className="grid grid-cols-6 gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`p-3 rounded-lg text-center transition-all ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                : `${theme.bgTertiary} ${theme.text} hover:bg-zinc-700`
            }`}
          >
            <div className="text-2xl font-black">{stats.total}</div>
            <div className="text-[10px] uppercase tracking-wider">Total Tests</div>
          </button>

          <button
            onClick={() => setFilterMode('kills')}
            className={`p-3 rounded-lg text-center transition-all ${
              filterMode === 'kills'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                : `${theme.bgTertiary} hover:bg-zinc-700`
            }`}
          >
            <div className={`text-2xl font-black ${filterMode !== 'kills' ? 'text-emerald-400' : ''}`}>
              {stats.kills}
            </div>
            <div className={`text-[10px] uppercase tracking-wider ${filterMode !== 'kills' ? 'text-emerald-500' : ''}`}>
              🗡️ Killed
            </div>
          </button>

          <button
            onClick={() => setFilterMode('echoes')}
            className={`p-3 rounded-lg text-center transition-all ${
              filterMode === 'echoes'
                ? 'bg-red-600 text-white ring-2 ring-red-400'
                : `${theme.bgTertiary} hover:bg-zinc-700`
            }`}
          >
            <div className={`text-2xl font-black ${filterMode !== 'echoes' ? 'text-red-400' : ''}`}>
              {stats.echoes}
            </div>
            <div className={`text-[10px] uppercase tracking-wider ${filterMode !== 'echoes' ? 'text-red-500' : ''}`}>
              ⚠️ Echoed
            </div>
          </button>

          <button
            onClick={() => { setFilterMode('all'); }}
            className={`p-3 rounded-lg text-center ${theme.bgTertiary}`}
          >
            <div className="text-2xl font-black text-amber-400">{stats.caught}</div>
            <div className="text-[10px] uppercase tracking-wider text-amber-500">✅ Caught</div>
          </button>

          <button
            onClick={() => setFilterMode('missed')}
            className={`p-3 rounded-lg text-center transition-all ${
              filterMode === 'missed'
                ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                : `${theme.bgTertiary} hover:bg-zinc-700`
            }`}
          >
            <div className={`text-2xl font-black ${filterMode !== 'missed' ? 'text-orange-400' : ''}`}>
              {stats.missed}
            </div>
            <div className={`text-[10px] uppercase tracking-wider ${filterMode !== 'missed' ? 'text-orange-500' : ''}`}>
              ❌ Missed
            </div>
          </button>

          <div className={`p-3 rounded-lg text-center ${theme.bgTertiary} border-2 ${
            stats.catchRate >= 80 ? 'border-emerald-500' : stats.catchRate >= 50 ? 'border-amber-500' : 'border-red-500'
          }`}>
            <div className={`text-2xl font-black ${
              stats.catchRate >= 80 ? 'text-emerald-400' : stats.catchRate >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {stats.catchRate}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Catch Rate</div>
          </div>
        </div>

        {/* Pass filter */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setSelectedPass('all')}
            className={`px-3 py-1 text-xs rounded ${
              selectedPass === 'all' ? 'bg-indigo-600 text-white' : `${theme.bgTertiary} ${theme.textMuted}`
            }`}
          >
            All Passes
          </button>
          {passLogs.map(log => (
            <button
              key={log.pass}
              onClick={() => setSelectedPass(log.pass)}
              className={`px-3 py-1 text-xs rounded ${
                selectedPass === log.pass ? 'bg-indigo-600 text-white' : `${theme.bgTertiary} ${theme.textMuted}`
              }`}
            >
              {log.pass.replace('pass1-', 'P1: ').replace('pass2-', 'P2: ').replace('pass3-', 'P3: ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Test List */}
        <div className={`w-80 border-r ${theme.border} overflow-auto`}>
          <div className={`p-2 ${theme.bgSecondary} border-b ${theme.border} sticky top-0`}>
            <div className={`text-xs ${theme.textMuted}`}>
              Showing {filteredTests.length} tests
              {filterMode !== 'all' && ` (${filterMode})`}
            </div>
          </div>

          <div className="p-2 space-y-1">
            {filteredTests.map((test, idx) => (
              <button
                key={`${test.passName}-${test.testIndex}`}
                onClick={() => setSelectedTest(test)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedTest === test
                    ? 'bg-indigo-600 text-white'
                    : `${theme.bgTertiary} hover:bg-zinc-700`
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-mono ${selectedTest === test ? 'text-indigo-200' : theme.textMuted}`}>
                    #{test.testIndex + 1} • {test.passName.split('-')[0]}
                  </span>
                  <div className="flex gap-1">
                    {(test.killRound ?? 0) > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        🗡️ R{test.killRound}
                      </span>
                    )}
                    {(test.echoCount ?? 0) > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                        ⚠️ {test.echoCount}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      test.judgeResponse?.verdict === 'caught'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {test.judgeResponse?.verdict === 'caught' ? '✅' : '❌'}
                    </span>
                  </div>
                </div>
                <div className={`text-xs truncate ${selectedTest === test ? 'text-white/80' : theme.textSecondary}`}>
                  {test.question}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail View */}
        <div className="flex-1 overflow-auto p-4">
          {!selectedTest ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4">👈</div>
                <p className={theme.textMuted}>Select a test to see proof</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl">
              {/* Test Summary */}
              <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={`text-lg font-bold ${theme.text}`}>Test #{selectedTest.testIndex + 1}</h3>
                    <p className={`text-sm ${theme.textMuted}`}>{selectedTest.question}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                    selectedTest.judgeResponse?.verdict === 'caught'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {selectedTest.judgeResponse?.verdict === 'caught' ? '✅ CAUGHT' : '❌ MISSED'}
                  </div>
                </div>

                {/* The Lie */}
                <div className={`p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-3`}>
                  <div className="text-xs font-bold text-red-400 mb-1">☠️ THE LIE (injected R{selectedTest.poisonRound} via {selectedTest.poisonAgent?.toUpperCase() ?? 'N/A'})</div>
                  <div className={`text-sm ${theme.text}`}>"{selectedTest.poison}"</div>
                </div>

                {/* Kill Evidence */}
                {(selectedTest.killRound ?? 0) > 0 ? (
                  <div className={`p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20`}>
                    <div className="text-xs font-bold text-emerald-400 mb-1">
                      🗡️ KILLED in Round {selectedTest.killRound} by {selectedTest.killAgent}
                    </div>
                    {(() => {
                      const killResponse = (selectedTest.responses ?? []).find(
                        r => r.round === selectedTest.killRound && r.status === 'flagged'
                      );
                      return killResponse ? (
                        <div className={`text-sm ${theme.textSecondary}`}>
                          <span className="font-bold text-emerald-400">{killResponse.role.toUpperCase()}</span>:
                          "{killResponse.content.slice(0, 300)}..."
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : selectedTest.mode !== 'unfiltered' ? (
                  <div className={`p-3 rounded-lg bg-orange-500/10 border border-orange-500/20`}>
                    <div className="text-xs font-bold text-orange-400">⚠️ NO KILL - Lie spread unchallenged</div>
                  </div>
                ) : null}
              </div>

              {/* Round by Round Proof */}
              <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
                <h4 className={`text-sm font-bold ${theme.text} mb-3`}>📜 Round-by-Round Evidence</h4>

                <div className="space-y-3">
                  {Array.from({ length: selectedTest.rounds ?? 0 }, (_, i) => i + 1).map((round: number) => {
                    const roundResponses = (selectedTest.responses ?? []).filter(r => r.round === round);
                    const isPoisonRound = round === selectedTest.poisonRound;

                    return (
                      <div key={round} className={`p-3 rounded-lg ${theme.bgTertiary} ${
                        isPoisonRound ? 'border-l-4 border-red-500' : ''
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold ${theme.text}`}>Round {round}</span>
                          {isPoisonRound && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                              💉 POISON INJECTED via {selectedTest.poisonAgent?.toUpperCase() ?? 'N/A'}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {roundResponses.map(resp => (
                            <div key={`${round}-${resp.role}`} className={`text-xs p-2 rounded ${
                              resp.status === 'echo' ? 'bg-red-500/10 border border-red-500/20' :
                              resp.status === 'flagged' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                              'bg-zinc-800'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-bold ${
                                  resp.status === 'echo' ? 'text-red-400' :
                                  resp.status === 'flagged' ? 'text-emerald-400' :
                                  theme.text
                                }`}>
                                  {resp.role.toUpperCase()}
                                </span>
                                <span className={`text-[10px] ${theme.textMuted}`}>({resp.model})</span>

                                {resp.status === 'echo' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 font-bold">
                                    ⚠️ ECHOED: {resp.matchedMarkers?.join(', ')}
                                  </span>
                                )}
                                {resp.status === 'flagged' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-bold">
                                    🔍 CHALLENGED
                                  </span>
                                )}
                                {resp.poisonInjected && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-300">
                                    💉 Received Poison
                                  </span>
                                )}
                              </div>

                              {/* Show excerpt with highlighted markers if echoed */}
                              {resp.status === 'echo' && resp.echoExcerpt ? (
                                <div className={`${theme.textSecondary} mt-1 p-2 rounded bg-red-900/20`}>
                                  <span className="text-[10px] text-red-400 font-bold block mb-1">PROOF - Found lie in response:</span>
                                  <span className="italic">
                                    "{highlightMarkers(resp.echoExcerpt, resp.matchedMarkers || [])}"
                                  </span>
                                </div>
                              ) : (
                                <div className={`${theme.textSecondary} line-clamp-2`}>
                                  {resp.content.slice(0, 200)}...
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Judge Verdict */}
              <div className={`${theme.bgSecondary} border ${theme.border} rounded-lg p-4`}>
                <h4 className={`text-sm font-bold ${theme.text} mb-3`}>⚖️ Judge Verdict</h4>
                <div className={`p-3 rounded-lg ${
                  selectedTest.judgeResponse?.verdict === 'caught'
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  <div className={`text-sm ${theme.textSecondary} whitespace-pre-wrap`}>
                    {selectedTest.judgeResponse?.content ?? ''}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
