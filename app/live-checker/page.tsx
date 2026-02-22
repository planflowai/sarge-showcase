"use client";

import { useState } from "react";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useModelStore } from "@/lib/stores/modelStore";
import { getTestTheme } from "@/lib/types";
import {
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Verdict = "VERIFIED" | "UNVERIFIED" | "INCONCLUSIVE" | null;

interface AgentResponse {
  agent: string;
  content: string;
  status: "pending" | "running" | "done";
}

interface VerificationResult {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  pipeline: AgentResponse[];
  searchContext: string[];
  sourcesChecked: number;
}

// ─── Verdict helpers (defined once, used in LiveCheckerPage and result display) ─

function getVerdictIcon(verdict: Verdict) {
  switch (verdict) {
    case "VERIFIED":
      return <CheckCircle className="h-8 w-8 text-emerald-500" />;
    case "UNVERIFIED":
      return <XCircle className="h-8 w-8 text-red-500" />;
    case "INCONCLUSIVE":
      return <AlertTriangle className="h-8 w-8 text-amber-500" />;
    default:
      return null;
  }
}

function getVerdictColor(verdict: Verdict) {
  switch (verdict) {
    case "VERIFIED":
      return "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/50";
    case "UNVERIFIED":
      return "text-red-500 bg-red-50 dark:bg-red-950/30 border-red-500/50";
    case "INCONCLUSIVE":
      return "text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-500/50";
    default:
      return "";
  }
}

export default function LiveCheckerPage() {
  const [claim, setClaim] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);

  // Theme
  const mainTheme = useSettingsStore((s) => s.theme);
  const darkMode = mainTheme === "dark";
  const theme = getTestTheme(darkMode);

  // Get LLM caller from store
  const streamLLM = useTestModeStore((s) => s.streamLLM);
  const slots = useTestModeStore((s) => s.slots);
  const { getEffectiveModels } = useModelStore();

  const LOCAL_PROVIDERS = ['ollama', 'lmstudio'];

  // Return the model and source for a slot — respects whatever provider the user picked
  const getSlotConfig = (index: number): { model: string; source: 'local' | 'cloud' } => {
    const slot = slots[index];
    if (slot?.provider && slot?.model) {
      return {
        model: slot.model,
        source: LOCAL_PROVIDERS.includes(slot.provider) ? 'local' : 'cloud',
      };
    }
    // Dynamic fallback: first available Ollama model, never a hardcoded string
    const localModels = getEffectiveModels('ollama');
    if (localModels.length > 0) {
      return { model: localModels[0].id, source: 'local' };
    }
    return { model: '', source: 'local' };
  };

  const verifyClaim = async () => {
    if (!claim.trim()) return;

    setIsVerifying(true);
    setError(null);
    setResult(null);

    const pipeline: AgentResponse[] = [
      { agent: "D1", content: "", status: "pending" },
      { agent: "D2", content: "", status: "pending" },
      { agent: "D3", content: "", status: "pending" },
      { agent: "Judge", content: "", status: "pending" },
    ];

    try {
      // Step 1: Tavily Search
      setCurrentAgent("Searching...");
      const searchRes = await fetch("/api/search/tavily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: claim }),
      });

      if (!searchRes.ok) {
        const errData = await searchRes.json();
        throw new Error(errData.error || "Search failed");
      }

      const searchData = await searchRes.json();
      const sourcesChecked = searchData.sourcesChecked || 0;

      // Limit context size to prevent token overflow (max ~2000 chars for context)
      let context = searchData.context || "";
      if (context.length > 2000) {
        context = context.substring(0, 2000) + "...";
      }

      // Parse context into bullet points for display
      const searchContext = context
        .split("\n\n")
        .filter((s: string) => s.trim().length > 0);

      // Helper to truncate agent responses for passing to next agent (max ~1000 chars)
      const truncateForContext = (text: string, maxLen = 1000): string => {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen) + "... [truncated]";
      };

      // Step 2: D1 Analysis
      setCurrentAgent("D1");
      pipeline[0].status = "running";
      setResult({
        verdict: null,
        confidence: 0,
        reasoning: "",
        pipeline: [...pipeline],
        searchContext,
        sourcesChecked,
      });

      const d1Prompt = `You are a fact-checker analyzing a claim. You have been given search results (sources hidden for blind verification).

CLAIM: "${claim}"

SEARCH CONTEXT (sources stripped):
${context}

Analyze whether the search context supports, contradicts, or is inconclusive about the claim. Be specific about what evidence you found. Do NOT ask for more sources - work only with what you have.`;

      const d1Config = getSlotConfig(0);
      let d1Content = "";
      await streamLLM(
        d1Config.model,
        d1Prompt,
        "You are D1, the first fact-checker in a verification pipeline. Analyze claims against provided context.",
        (chunk) => {
          d1Content += chunk;
          pipeline[0].content = d1Content;
          setResult((prev) =>
            prev ? { ...prev, pipeline: [...pipeline] } : null
          );
        },
        d1Config.source
      );
      pipeline[0].status = "done";

      // Step 3: D2 Cross-check
      setCurrentAgent("D2");
      pipeline[1].status = "running";
      setResult((prev) =>
        prev ? { ...prev, pipeline: [...pipeline] } : null
      );

      const d2Prompt = `You are D2, cross-checking D1's analysis.

ORIGINAL CLAIM: "${claim}"

D1's ANALYSIS:
${truncateForContext(d1Content)}

SEARCH CONTEXT (sources stripped):
${context}

Review D1's analysis. Did D1 miss anything? Are there contradictions D1 overlooked? Do you agree with D1's assessment? Keep response brief.`;

      const d2Config = getSlotConfig(1);
      let d2Content = "";
      await streamLLM(
        d2Config.model,
        d2Prompt,
        "You are D2, the second fact-checker. Cross-check D1's analysis for errors or oversights.",
        (chunk) => {
          d2Content += chunk;
          pipeline[1].content = d2Content;
          setResult((prev) =>
            prev ? { ...prev, pipeline: [...pipeline] } : null
          );
        },
        d2Config.source
      );
      pipeline[1].status = "done";

      // Step 4: D3 Audit
      setCurrentAgent("D3");
      pipeline[2].status = "running";
      setResult((prev) =>
        prev ? { ...prev, pipeline: [...pipeline] } : null
      );

      const d3Prompt = `You are D3, auditing the verification chain.

ORIGINAL CLAIM: "${claim}"

D1's ANALYSIS:
${truncateForContext(d1Content, 800)}

D2's CROSS-CHECK:
${truncateForContext(d2Content, 800)}

Check for echo chamber behavior - are D1 and D2 just agreeing without critical analysis? Flag any issues. Keep response brief.`;

      const d3Config = getSlotConfig(2);
      let d3Content = "";
      await streamLLM(
        d3Config.model,
        d3Prompt,
        "You are D3, the auditor. Check for echo chamber behavior and reasoning flaws.",
        (chunk) => {
          d3Content += chunk;
          pipeline[2].content = d3Content;
          setResult((prev) =>
            prev ? { ...prev, pipeline: [...pipeline] } : null
          );
        },
        d3Config.source
      );
      pipeline[2].status = "done";

      // Step 5: Judge Verdict
      setCurrentAgent("Judge");
      pipeline[3].status = "running";
      setResult((prev) =>
        prev ? { ...prev, pipeline: [...pipeline] } : null
      );

      const judgePrompt = `You are the Judge delivering a final verdict on a claim.

CLAIM: "${claim}"

D1 ANALYSIS: ${truncateForContext(d1Content, 600)}

D2 CROSS-CHECK: ${truncateForContext(d2Content, 600)}

D3 AUDIT: ${truncateForContext(d3Content, 600)}

Respond with ONLY valid JSON (no markdown fences, no extra text):
{"verdict":"VERIFIED","confidence":85,"reasoning":"one sentence explanation"}

The verdict must be exactly one of: VERIFIED, UNVERIFIED, INCONCLUSIVE
confidence must be an integer 0-100.`;

      const judgeConfig = getSlotConfig(3);
      let judgeContent = "";
      await streamLLM(
        judgeConfig.model,
        judgePrompt,
        "You are the Judge. Deliver a final verdict based on all agent analyses.",
        (chunk) => {
          judgeContent += chunk;
          pipeline[3].content = judgeContent;
          setResult((prev) =>
            prev ? { ...prev, pipeline: [...pipeline] } : null
          );
        },
        judgeConfig.source
      );
      pipeline[3].status = "done";

      // Parse Judge response — 3-tier fallback strategy
      let verdict: Verdict = "INCONCLUSIVE";
      let confidence = 50;
      let reasoning = "Unable to parse judge response";
      let parsed = false;

      // ── Tier 1: JSON parse ────────────────────────────────────────────────
      try {
        // Strip markdown fences if the model wrapped it anyway
        const jsonCandidate = judgeContent
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        // Find first {...} block in case there's preamble text
        const jsonMatch = jsonCandidate.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed_json = JSON.parse(jsonMatch[0]);
          const rawVerdict = String(parsed_json.verdict || '').toUpperCase();
          if (['VERIFIED', 'UNVERIFIED', 'INCONCLUSIVE'].includes(rawVerdict)) {
            verdict = rawVerdict as Verdict;
            confidence = Math.min(100, Math.max(0, Number(parsed_json.confidence) || 50));
            reasoning = String(parsed_json.reasoning || '').slice(0, 500) || reasoning;
            parsed = true;
          }
        }
      } catch {
        // JSON failed — continue to tier 2
      }

      // ── Tier 2: structured regex ──────────────────────────────────────────
      if (!parsed) {
        const structuredMatch = judgeContent.match(
          /VERDICT:\s*(VERIFIED|UNVERIFIED|INCONCLUSIVE)[\s\S]*?CONFIDENCE:\s*(\d+)%?[\s\S]*?REASONING:\s*([^\n]+)/i
        );
        if (structuredMatch) {
          const [, v, c, r] = structuredMatch;
          verdict = v.toUpperCase() as Verdict;
          confidence = Math.min(100, Math.max(0, parseInt(c, 10)));
          reasoning = r.trim().slice(0, 500);
          parsed = true;
        }
      }

      // ── Tier 3: keyword detection (lower confidence) ──────────────────────
      if (!parsed) {
        const upper = judgeContent.toUpperCase();
        if (upper.includes('VERIFIED') && !upper.includes('UNVERIFIED')) {
          verdict = 'VERIFIED';
          confidence = 40; // Lower confidence — we guessed from keyword only
        } else if (upper.includes('UNVERIFIED') || upper.includes('FALSE') || upper.includes('INCORRECT')) {
          verdict = 'UNVERIFIED';
          confidence = 40;
        } else {
          verdict = 'INCONCLUSIVE';
          confidence = 30;
        }
        reasoning = judgeContent.split('\n').find(l => l.trim().length > 20)?.trim().slice(0, 300)
          || 'Verdict inferred from keywords — see raw agent output for details.';
        console.warn('[LiveChecker] Judge parsing fell through to keyword detection. Raw output:', judgeContent);
      }

      setResult({
        verdict,
        confidence,
        reasoning,
        pipeline: [...pipeline],
        searchContext,
        sourcesChecked,
      });
      setCurrentAgent(null);
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setCurrentAgent(null);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className={`flex h-full flex-col ${theme.bg}`}>
      {/* Header */}
      <div
        className={`shrink-0 px-6 py-4 border-b ${theme.border} ${theme.bgSecondary}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="h-6 w-6 text-cyan-500" />
            <h1 className={`text-xl font-bold ${theme.text}`}>Live Checker</h1>
          </div>
          <Button variant="ghost" size="icon" title="Settings">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        <p className={`text-sm ${theme.textSecondary} mt-1`}>
          Verify claims using web search + SARGE pipeline (blind pass - sources
          hidden)
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Input Section */}
        <div
          className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}
        >
          <label
            className={`block text-sm font-semibold ${theme.text} mb-2`}
          >
            Paste X post or claim to verify:
          </label>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="Enter a claim to verify..."
            className={`w-full h-24 rounded-lg border ${theme.border} ${theme.bg} ${theme.text} px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500`}
          />
          <div className="flex items-center gap-3 mt-3">
            <Button
              onClick={verifyClaim}
              disabled={isVerifying || !claim.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {currentAgent || "Verifying..."}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Verify Claim
                </>
              )}
            </Button>
            {result && (
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setClaim("");
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-50 dark:bg-red-950/30 p-4 text-red-600 dark:text-red-400">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Verdict Box */}
            <div
              className={`rounded-xl border-2 p-6 ${
                result.verdict
                  ? getVerdictColor(result.verdict)
                  : `${theme.border} ${theme.bgSecondary}`
              }`}
            >
              <h2
                className={`text-lg font-bold mb-4 ${
                  result.verdict ? "" : theme.text
                }`}
              >
                VERDICT
              </h2>

              {result.verdict ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {getVerdictIcon(result.verdict)}
                    <span className="text-2xl font-black">{result.verdict}</span>
                  </div>

                  <div>
                    <span className="text-sm font-semibold">Confidence:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            result.confidence >= 80
                              ? "bg-emerald-500"
                              : result.confidence >= 50
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${result.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">
                        {result.confidence}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-semibold">Reasoning:</span>
                    <p className="text-sm mt-1">{result.reasoning}</p>
                  </div>

                  <div className={`text-xs ${theme.textSecondary}`}>
                    Sources checked: {result.sourcesChecked}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Analyzing...</span>
                </div>
              )}
            </div>

            {/* Agent Pipeline */}
            <div
              className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4 lg:col-span-2`}
            >
              <h2 className={`text-lg font-bold ${theme.text} mb-4`}>
                Agent Pipeline
              </h2>

              <div className="space-y-3">
                {result.pipeline.map((agent) => (
                  <AgentBox
                    key={agent.agent}
                    agent={agent}
                    theme={theme}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search Context */}
        {result && result.searchContext.length > 0 && (
          <div
            className={`rounded-xl border-2 ${theme.border} ${theme.bgSecondary} p-4`}
          >
            <h2 className={`text-lg font-bold ${theme.text} mb-4`}>
              Search Context (what agents saw - sources hidden)
            </h2>
            <ul className="space-y-2">
              {result.searchContext.map((snippet, idx) => (
                <li
                  key={idx}
                  className={`text-sm ${theme.textSecondary} flex gap-2`}
                >
                  <span className="text-cyan-500">•</span>
                  <span>{snippet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Box Component (Collapsible with Copy) ─────────────────────────────

interface AgentBoxProps {
  agent: AgentResponse;
  theme: ReturnType<typeof getTestTheme>;
}

function AgentBox({ agent, theme }: AgentBoxProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // Get summary (first sentence or first 100 chars)
  const getSummary = (content: string): string => {
    if (!content) return "...";
    const firstSentence = content.match(/^[^.!?]*[.!?]/);
    if (firstSentence && firstSentence[0].length < 150) {
      return firstSentence[0];
    }
    return content.slice(0, 100) + (content.length > 100 ? "..." : "");
  };

  const handleCopy = async () => {
    if (!agent.content) return;
    try {
      await navigator.clipboard.writeText(agent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failed
    }
  };

  const getAgentColor = (agentName: string) => {
    switch (agentName) {
      case "D1":
        return "border-l-blue-500";
      case "D2":
        return "border-l-purple-500";
      case "D3":
        return "border-l-amber-500";
      case "Judge":
        return "border-l-emerald-500";
      default:
        return "border-l-zinc-500";
    }
  };

  return (
    <div
      className={`rounded-lg border ${theme.border} border-l-4 ${getAgentColor(
        agent.agent
      )} overflow-hidden`}
    >
      {/* Header - Always visible */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${theme.bgSecondary} cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          )}
          <span className={`text-sm font-bold ${theme.text} uppercase`}>
            {agent.agent}
          </span>
          {agent.status === "running" && (
            <Loader2 className="h-3 w-3 animate-spin text-cyan-500" />
          )}
          {agent.status === "done" && (
            <CheckCircle className="h-3 w-3 text-emerald-500" />
          )}
          {agent.status === "pending" && (
            <span className={`text-[10px] ${theme.textSecondary}`}>
              Waiting
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Copy button */}
          {agent.status === "done" && agent.content && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 ${theme.textSecondary}`}
              title="Copy response"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Summary - Always visible when collapsed */}
      {!expanded && agent.content && (
        <div className={`px-3 py-2 text-xs ${theme.textSecondary}`}>
          {getSummary(agent.content)}
        </div>
      )}

      {/* Full content - Only when expanded */}
      {expanded && (
        <div className={`px-3 py-3 ${theme.bg}`}>
          <p
            className={`text-xs ${theme.textSecondary} whitespace-pre-wrap leading-relaxed`}
          >
            {agent.content || "..."}
          </p>
        </div>
      )}
    </div>
  );
}
