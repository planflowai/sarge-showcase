'use client';

import { TestTheme as Theme, ResponseData } from '@/lib/types' // Test types;

interface RoundResponse extends ResponseData {
  round: number;
}

interface ReportModalProps {
  theme: Theme;
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
  question: string;
  poison: string;
  expectedAnswer?: string;
  whyDangerous?: string;
  poisonRound: number;
  poisonAgent?: string;
  mode: string;
  responses: RoundResponse[];
  judgeResponse: ResponseData | null;
  models: { d1: string; d2: string; d3: string; judge: string };
}

export function ReportModal({
  theme,
  darkMode,
  isOpen,
  onClose,
  question,
  poison,
  expectedAnswer,
  whyDangerous,
  poisonRound,
  poisonAgent,
  mode,
  responses,
  judgeResponse,
  models,
}: ReportModalProps) {
  if (!isOpen) return null;

  // Group responses by round
  const rounds: { [key: number]: RoundResponse[] } = {};
  responses.forEach(r => {
    if (!rounds[r.round]) rounds[r.round] = [];
    rounds[r.round].push(r);
  });

  // Calculate stats
  const totalEchoes = responses.filter(r => r.status === 'echo').length;
  const totalFlags = responses.filter(r => r.status === 'flagged').length;
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  // Find kill round
  let killRound = 0;
  let killAgent = '';
  for (const round of roundNumbers) {
    if (round >= poisonRound) {
      const roundResps = rounds[round] || [];
      const d2 = roundResps.find(r => r.role === 'd2');
      const d3 = roundResps.find(r => r.role === 'd3');
      
      if (d2 && (d2.status === 'flagged' || d2.content.toLowerCase().includes('incorrect') || d2.content.toLowerCase().includes('false'))) {
        killRound = round;
        killAgent = 'D2';
        break;
      }
      if (d3 && (d3.status === 'flagged' || d3.content.toLowerCase().includes('drift') || d3.content.toLowerCase().includes('fail'))) {
        killRound = round;
        killAgent = 'D3';
        break;
      }
    }
  }

  const timestamp = new Date().toISOString();
  
  const handleExportPDF = () => {
    // Create printable version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Forensic Audit Report - ${timestamp}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #1a1a1a; }
          h1 { border-bottom: 3px solid #4f46e5; padding-bottom: 10px; }
          h2 { color: #4f46e5; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          h3 { color: #6b7280; }
          .header-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .header-info p { margin: 5px 0; }
          .round { margin: 20px 0; padding: 15px; background: #fafafa; border-radius: 8px; border-left: 4px solid #6b7280; }
          .round.poison { border-left-color: #ef4444; background: #fef2f2; }
          .round.killed { border-left-color: #10b981; background: #f0fdf4; }
          .agent { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
          .agent-name { font-weight: bold; color: #4f46e5; }
          .agent.echo { border-left: 3px solid #ef4444; }
          .agent.flagged { border-left: 3px solid #f59e0b; }
          .verdict { margin-top: 30px; padding: 20px; background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; }
          .verdict.missed { background: #fef2f2; border-color: #ef4444; }
          .summary-box { background: #eef2ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .stats { display: flex; gap: 20px; flex-wrap: wrap; }
          .stat { background: white; padding: 10px 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .stat-value { font-size: 24px; font-weight: bold; color: #4f46e5; }
          .stat-label { font-size: 12px; color: #6b7280; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>🔬 Forensic Audit Report</h1>
        
        <div class="header-info">
          <p><strong>Timestamp:</strong> ${timestamp}</p>
          <p><strong>Test Mode:</strong> ${mode}</p>
          <p><strong>Question:</strong> ${question}</p>
          <p><strong>Poison Pill:</strong> ${poison}</p>
          <p><strong>Poison Injected:</strong> Round ${poisonRound}</p>
          <p><strong>Models:</strong> D1: ${models.d1} | D2: ${models.d2} | D3: ${models.d3} | Judge: ${models.judge}</p>
        </div>

        <div class="summary-box">
          <h2>📊 Executive Summary</h2>
          <div class="stats">
            <div class="stat">
              <div class="stat-value">${roundNumbers.length}</div>
              <div class="stat-label">Rounds</div>
            </div>
            <div class="stat">
              <div class="stat-value">${responses.length}</div>
              <div class="stat-label">Responses</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: ${totalEchoes > 0 ? '#ef4444' : '#10b981'}">${totalEchoes}</div>
              <div class="stat-label">Echoes Detected</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: ${totalFlags > 0 ? '#f59e0b' : '#6b7280'}">${totalFlags}</div>
              <div class="stat-label">Flags Raised</div>
            </div>
            <div class="stat">
              <div class="stat-value" style="color: ${killRound > 0 ? '#10b981' : '#ef4444'}">${killRound > 0 ? `R${killRound}` : 'N/A'}</div>
              <div class="stat-label">Kill Round</div>
            </div>
          </div>
        </div>

        <h2>📋 Round-by-Round Analysis</h2>
        ${roundNumbers.map(roundNum => {
          const roundResps = rounds[roundNum] || [];
          const isPoisonRound = roundNum === poisonRound;
          const isKillRound = roundNum === killRound;
          return `
            <div class="round ${isPoisonRound ? 'poison' : ''} ${isKillRound ? 'killed' : ''}">
              <h3>Round ${roundNum} ${isPoisonRound ? '☠️ POISON INJECTED' : ''} ${isKillRound ? '🛡️ KILL CONFIRMED' : ''}</h3>
              ${roundResps.map(r => `
                <div class="agent ${r.status}">
                  <span class="agent-name">${r.role.toUpperCase()}</span> (${r.model}) - ${r.time}
                  ${r.status === 'echo' ? '<span style="color:#ef4444;font-weight:bold;"> ⚠️ ECHOED</span>' : ''}
                  ${r.status === 'flagged' ? '<span style="color:#f59e0b;font-weight:bold;"> 🔍 FLAGGED</span>' : ''}
                  <pre>${r.content}</pre>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}

        <h2>⚖️ Judge Verdict</h2>
        <div class="verdict ${judgeResponse?.status === 'caught' ? '' : 'missed'}">
          <h3>${judgeResponse?.status === 'caught' ? '✅ MISINFORMATION CAUGHT' : '❌ MISINFORMATION MISSED'}</h3>
          <p><strong>Model:</strong> ${judgeResponse?.model || 'N/A'}</p>
          <p><strong>Processing Time:</strong> ${judgeResponse?.time || 'N/A'}</p>
          <pre>${judgeResponse?.content || 'No verdict available'}</pre>
        </div>

        <hr style="margin: 40px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          Generated by AI Tribunal Forensic Audit System<br>
          Report ID: ${Date.now()}<br>
          This report is intended for audit and compliance purposes.
        </p>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportCSV = () => {
    const headers = ['Round', 'Agent', 'Model', 'Status', 'Time', 'Tokens', 'Content'];
    const rows = responses.map(r => [
      r.round,
      r.role.toUpperCase(),
      r.model,
      r.status,
      r.time,
      r.tokens,
      `"${r.content.replace(/"/g, '""')}"`
    ]);
    
    // Add judge row
    if (judgeResponse) {
      rows.push([
        'FINAL',
        'JUDGE',
        judgeResponse.model,
        judgeResponse.status,
        judgeResponse.time,
        judgeResponse.tokens,
        `"${judgeResponse.content.replace(/"/g, '""')}"`
      ]);
    }

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className={`w-[90vw] h-[90vh] ${darkMode ? 'bg-zinc-900' : 'bg-white'} rounded-xl shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${theme.borderSubtle}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Forensic Audit Report</h2>
              <p className={`text-xs ${theme.textMuted}`}>{timestamp}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500"
            >
              📄 Export PDF
            </button>
            <button
              onClick={handleExportCSV}
              className={`flex items-center gap-2 px-4 py-2 ${theme.bgTertiary} ${theme.text} border ${theme.borderSubtle} rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-zinc-700`}
            >
              📊 Export CSV
            </button>
            <button
              onClick={onClose}
              className={`px-4 py-2 ${theme.bgTertiary} ${theme.text} border ${theme.borderSubtle} rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-zinc-700`}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Summary Box */}
          <div className={`${darkMode ? 'bg-indigo-950/30' : 'bg-indigo-50'} p-5 rounded-xl mb-6`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4`}>📊 Executive Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className={`${theme.bgSecondary} p-3 rounded-lg border ${theme.borderSubtle}`}>
                <div className={`text-2xl font-bold ${theme.text}`}>{roundNumbers.length}</div>
                <div className={`text-xs ${theme.textMuted}`}>Rounds</div>
              </div>
              <div className={`${theme.bgSecondary} p-3 rounded-lg border ${theme.borderSubtle}`}>
                <div className={`text-2xl font-bold ${totalEchoes > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{totalEchoes}</div>
                <div className={`text-xs ${theme.textMuted}`}>Echoes</div>
              </div>
              <div className={`${theme.bgSecondary} p-3 rounded-lg border ${theme.borderSubtle}`}>
                <div className={`text-2xl font-bold ${totalFlags > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>{totalFlags}</div>
                <div className={`text-xs ${theme.textMuted}`}>Flags</div>
              </div>
              <div className={`${theme.bgSecondary} p-3 rounded-lg border ${theme.borderSubtle}`}>
                <div className={`text-2xl font-bold ${killRound > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{killRound > 0 ? `R${killRound}` : 'N/A'}</div>
                <div className={`text-xs ${theme.textMuted}`}>Kill Round</div>
              </div>
            </div>
            <div className={`text-sm ${theme.text}`}>
              <p><strong>Question:</strong> {question}</p>
              <p><strong>Poison:</strong> <span className="text-red-400">{poison}</span></p>
              <p><strong>Poison Round:</strong> {poisonRound} via {poisonAgent || 'D1'}</p>
              {killRound > 0 && <p><strong>Kill Confirmed:</strong> Round {killRound} by {killAgent}</p>}
            </div>
          </div>

          {/* NEW: Test Configuration Details */}
          <div className={`${theme.bgSecondary} p-5 rounded-xl mb-6 border ${theme.borderSubtle}`}>
            <h3 className={`text-sm font-bold ${theme.text} mb-4`}>🎯 Test Configuration</h3>
            <div className="space-y-3">
              <div>
                <span className={`text-xs font-medium ${theme.textMuted}`}>QUESTION ASKED</span>
                <p className={`text-sm ${theme.text} mt-1`}>{question}</p>
              </div>
              {expectedAnswer && (
                <div>
                  <span className={`text-xs font-medium text-emerald-400`}>EXPECTED CORRECT ANSWER</span>
                  <p className={`text-sm ${theme.text} mt-1`}>{expectedAnswer}</p>
                </div>
              )}
              <div>
                <span className={`text-xs font-medium text-red-400`}>POISON PILL INJECTED</span>
                <p className={`text-sm ${theme.text} mt-1 p-2 bg-red-500/10 rounded border border-red-500/30`}>{poison}</p>
              </div>
              {whyDangerous && (
                <div>
                  <span className={`text-xs font-medium text-amber-400`}>WHY THIS IS DANGEROUS</span>
                  <p className={`text-sm ${theme.textSecondary} mt-1`}>{whyDangerous}</p>
                </div>
              )}
              <div>
                <span className={`text-xs font-medium ${theme.textMuted}`}>INJECTION POINT</span>
                <p className={`text-sm ${theme.text} mt-1`}>Round {poisonRound}, via {poisonAgent?.toUpperCase() || 'D1'}</p>
              </div>
            </div>
          </div>

          {/* NEW: Kill Confirmation Details */}
          {killRound > 0 && (
            <div className={`bg-emerald-500/10 p-5 rounded-xl mb-6 border border-emerald-500/30`}>
              <h3 className={`text-sm font-bold text-emerald-400 mb-4`}>🛡️ Kill Confirmation</h3>
              <div className="space-y-2">
                <p className={`text-sm ${theme.text}`}><strong>Killed by:</strong> {killAgent}</p>
                <p className={`text-sm ${theme.text}`}><strong>Kill Round:</strong> {killRound}</p>
                <p className={`text-sm ${theme.text}`}><strong>Rounds after injection:</strong> {killRound - poisonRound}</p>
                {(() => {
                  const killResponse = rounds[killRound]?.find(r => r.role.toUpperCase() === killAgent);
                  if (killResponse) {
                    return (
                      <div className="mt-3">
                        <span className={`text-xs font-medium ${theme.textMuted}`}>KILL RESPONSE</span>
                        <p className={`text-sm ${theme.textSecondary} mt-1 p-2 bg-emerald-500/5 rounded`}>{killResponse.content.slice(0, 500)}...</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          {/* NEW: Persistence Check */}
          {killRound > 0 && killRound < roundNumbers.length && (
            <div className={`${theme.bgSecondary} p-5 rounded-xl mb-6 border ${theme.borderSubtle}`}>
              <h3 className={`text-sm font-bold ${theme.text} mb-4`}>🔄 Persistence Check</h3>
              <p className={`text-sm ${theme.textSecondary} mb-3`}>
                Did the poison resurface after being killed in Round {killRound}?
              </p>
              {(() => {
                const postKillRounds = roundNumbers.filter(r => r > killRound);
                const resurfaces = postKillRounds.filter(r => 
                  rounds[r]?.some(resp => resp.status === 'echo')
                );
                if (resurfaces.length > 0) {
                  return (
                    <div className="p-3 bg-red-500/10 rounded border border-red-500/30">
                      <span className="text-red-400 font-bold">⚠️ RESURFACE DETECTED</span>
                      <p className={`text-sm ${theme.text} mt-1`}>Poison echoed again in rounds: {resurfaces.join(', ')}</p>
                    </div>
                  );
                }
                return (
                  <div className="p-3 bg-emerald-500/10 rounded border border-emerald-500/30">
                    <span className="text-emerald-400 font-bold">✅ STAYED DEAD</span>
                    <p className={`text-sm ${theme.text} mt-1`}>No resurface in {postKillRounds.length} subsequent round(s)</p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Round by Round */}
          <h3 className={`text-sm font-bold ${theme.text} mb-4`}>📋 Round-by-Round Analysis</h3>
          {roundNumbers.map(roundNum => {
            const roundResps = rounds[roundNum] || [];
            const isPoisonRound = roundNum === poisonRound;
            const isKillRound = roundNum === killRound;
            
            return (
              <div 
                key={roundNum}
                className={`mb-4 p-4 rounded-lg border ${
                  isPoisonRound ? 'border-red-500 bg-red-500/5' :
                  isKillRound ? 'border-emerald-500 bg-emerald-500/5' :
                  theme.borderSubtle
                } ${theme.bgSecondary}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`font-bold ${theme.text}`}>Round {roundNum}</span>
                  {isPoisonRound && <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">☠️ POISON INJECTED</span>}
                  {isKillRound && <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">🛡️ KILL CONFIRMED</span>}
                </div>
                
                {roundResps.map((r, i) => (
                  <div key={i} className={`mb-2 p-3 rounded border-l-4 ${
                    r.status === 'echo' ? 'border-red-500 bg-red-500/5' :
                    r.status === 'flagged' ? 'border-amber-500 bg-amber-500/5' :
                    'border-gray-300 dark:border-zinc-600'
                  } ${theme.bgTertiary}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-sm ${
                        r.status === 'echo' ? 'text-red-400' :
                        r.status === 'flagged' ? 'text-amber-400' :
                        theme.text
                      }`}>
                        {r.role.toUpperCase()}
                        {r.status === 'echo' && ' ⚠️ ECHOED'}
                        {r.status === 'flagged' && ' 🔍 FLAGGED'}
                      </span>
                      <span className={`text-xs ${theme.textMuted}`}>{r.model} • {r.time}</span>
                    </div>
                    <p className={`text-sm ${theme.textSecondary} whitespace-pre-wrap`}>{r.content}</p>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Judge Verdict */}
          {judgeResponse && (
            <div className={`mt-6 p-5 rounded-xl border-2 ${
              judgeResponse.status === 'caught' 
                ? 'border-emerald-500 bg-emerald-500/5' 
                : 'border-red-500 bg-red-500/5'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⚖️</span>
                <span className={`font-bold text-lg ${judgeResponse.status === 'caught' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {judgeResponse.status === 'caught' ? '✅ MISINFORMATION CAUGHT' : '❌ MISINFORMATION MISSED'}
                </span>
              </div>
              <p className={`text-xs ${theme.textMuted} mb-3`}>{judgeResponse.model} • {judgeResponse.time}</p>
              <div className={`${theme.bgSecondary} p-4 rounded-lg`}>
                <p className={`text-sm ${theme.text} whitespace-pre-wrap`}>{judgeResponse.content}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
