"use client";

import type { BatchHistoryEntry } from "@/lib/stores/testModeStore";
import type { BatchPassLog } from "@/lib/types";

interface EvidencePanelProps {
  batch: BatchHistoryEntry;
}

export function EvidencePanel({ batch }: EvidencePanelProps) {
  if (batch.passLogs.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          B. EVIDENCE
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No evidence data available
        </p>
      </div>
    );
  }

  const pass1 = batch.passLogs.find(p => p.pass === 'pass1-unfiltered');
  const pass2 = batch.passLogs.find(p => p.pass === 'pass2-pill');
  const pass3 = batch.passLogs.find(p => p.pass === 'pass3-pill-prompt');
  const pass4 = batch.passLogs.find(p => p.pass === 'pass4-defense');
  const chaosPass = batch.passLogs.find(p => p.pass === 'chaos');
  const armageddonPass = batch.passLogs.find(p => p.pass === 'armageddon');

  // Use the main pass for analysis (prefer pass3, then pass4, then any)
  const mainPass = pass3 || pass4 || pass2 || batch.passLogs[0];

  // Calculate protection effectiveness if we have pass2 and pass3
  const protectionBoost = pass2 && pass3
    ? pass3.summary.catchRate - pass2.summary.catchRate
    : null;
  const protectionEffective = protectionBoost !== null && protectionBoost > 0;

  // Agent performance analysis
  const agentPerformance = analyzeAgentPerformance(mainPass);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          B. EVIDENCE
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Proof that the system works (or doesn't)
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Pass Comparison */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Pass Results
          </h4>
          <div className="space-y-2">
            {pass1 && (
              <PassRow
                name="Pass 1 (Unfiltered)"
                desc="No poison, no protection"
                pass={pass1}
                variant="neutral"
              />
            )}
            {pass2 && (
              <PassRow
                name="Pass 2 (Poison, No Protection)"
                desc="Poison injected, no defensive prompts"
                pass={pass2}
                variant="danger"
              />
            )}
            {pass3 && (
              <PassRow
                name="Pass 3 (Protected)"
                desc="Poison + protective prompts active"
                pass={pass3}
                variant="success"
              />
            )}
            {pass4 && (
              <PassRow
                name="Pass 4 (Defense)"
                desc="Truth anchors + kill switch active"
                pass={pass4}
                variant="defense"
                showKills
              />
            )}
            {chaosPass && (
              <PassRow
                name="Chaos Mode"
                desc="Randomized poison injection"
                pass={chaosPass}
                variant="chaos"
              />
            )}
            {armageddonPass && (
              <PassRow
                name="ARMAGEDDON"
                desc="All agents poisoned"
                pass={armageddonPass}
                variant="armageddon"
              />
            )}
          </div>
        </div>

        {/* Protection Effectiveness - Only show if we have both pass2 and pass3 */}
        {protectionBoost !== null && (
          <div className={`p-4 rounded-lg ${
            protectionEffective
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-amber-500/10 border border-amber-500/20'
          }`}>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Protection Effectiveness
            </h4>
            <div className="flex items-center gap-3">
              <div className="text-3xl">
                {protectionEffective ? '🛡️' : '⚠️'}
              </div>
              <div className="flex-1">
                <p className={`text-lg font-bold ${
                  protectionEffective
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {protectionEffective ? `+${protectionBoost}%` : `${protectionBoost}%`} improvement
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {protectionEffective
                    ? `Protective prompts improved catch rate from ${pass2!.summary.catchRate}% to ${pass3!.summary.catchRate}%`
                    : `No improvement with protective prompts (${pass2!.summary.catchRate}% vs ${pass3!.summary.catchRate}%)`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Agent Performance */}
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Agent Performance
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded bg-zinc-100 dark:bg-zinc-900 text-center">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                D1 Worker
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {agentPerformance.d1.flagged}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                flags raised
              </div>
            </div>

            <div className="p-3 rounded bg-zinc-100 dark:bg-zinc-900 text-center">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                D2 Verifier
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {agentPerformance.d2.flagged}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                flags raised
              </div>
            </div>

            <div className="p-3 rounded bg-zinc-100 dark:bg-zinc-900 text-center">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                D3 Auditor
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {agentPerformance.d3.flagged}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                flags raised
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Total Tests
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {mainPass.summary.totalTests}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Average Echoes/Test
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {mainPass.summary.avgEchoesPerTest}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pass row component
function PassRow({ name, desc, pass, variant, showKills }: {
  name: string;
  desc: string;
  pass: BatchPassLog;
  variant: 'neutral' | 'danger' | 'success' | 'defense' | 'chaos' | 'armageddon';
  showKills?: boolean;
}) {
  const variantStyles = {
    neutral: 'bg-zinc-100 dark:bg-zinc-900',
    danger: 'bg-red-500/10 border border-red-500/20',
    success: 'bg-emerald-500/10 border border-emerald-500/20',
    defense: 'bg-purple-500/10 border border-purple-500/20',
    chaos: 'bg-orange-500/10 border border-orange-500/20',
    armageddon: 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20',
  };

  const textColor = {
    neutral: 'text-zinc-700 dark:text-zinc-300',
    danger: 'text-red-600 dark:text-red-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    defense: 'text-purple-600 dark:text-purple-400',
    chaos: 'text-orange-600 dark:text-orange-400',
    armageddon: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded ${variantStyles[variant]}`}>
      <div>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {name}
        </span>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {desc}
        </p>
      </div>
      <div className="text-right">
        <div className={`text-lg font-bold ${textColor[variant]}`}>
          {pass.summary.catchRate}%
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {pass.summary.echoTotal} echoes
          {showKills && pass.summary.kills !== undefined && ` • ${pass.summary.kills} kills`}
        </div>
      </div>
    </div>
  );
}

// Helper function to analyze agent performance
function analyzeAgentPerformance(passLog: BatchPassLog) {
  let d1Flagged = 0;
  let d2Flagged = 0;
  let d3Flagged = 0;

  passLog.tests.forEach((test) => {
    test.responses?.forEach((resp) => {
      if (resp.hasEcho === true) {
        if (resp.agent === 'd1') d1Flagged++;
        if (resp.agent === 'd2') d2Flagged++;
        if (resp.agent === 'd3') d3Flagged++;
      }
    });
  });

  return {
    d1: { flagged: d1Flagged },
    d2: { flagged: d2Flagged },
    d3: { flagged: d3Flagged },
  };
}
