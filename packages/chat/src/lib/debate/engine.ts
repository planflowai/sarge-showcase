"use client";

/**
 * Debate Engine for SARGE Debate Arena
 * Orchestrates multi-agent adversarial debates with streaming responses
 * Implements blind pass mode, sequential/open mode, and structured judge verdicts
 */

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface DebateAgent {
  id: string;
  provider: string; // 'anthropic' | 'openai' | 'google' | 'xai' | 'ollama' | 'lmstudio' | 'No LLM'
  model: string;
  role: string; // '' | 'researcher' | 'engineer' | 'analyst' | 'critic' | 'custom'
  customPrompt?: string; // Used when role === 'custom'
  color: string; // Hex color for UI
}

export interface DebateRound {
  roundNumber: number;
  responses: Array<{
    agentId: string;
    role: string;
    content: string;
    model: string;
  }>;
}

export interface DebateConfig {
  topic: string;
  agents: DebateAgent[]; // Filter out 'No LLM' before passing
  judge: DebateAgent;
  totalRounds: number; // 1-5
  passMode: "blind" | "sequential";
}

export interface DebateEvent {
  type:
    | "round_start"
    | "agent_start"
    | "chunk"
    | "agent_complete"
    | "round_complete"
    | "judge_start"
    | "judge_chunk"
    | "judge_complete"
    | "complete"
    | "error";
  roundNumber?: number;
  agentId?: string;
  agentRole?: string;
  chunk?: string;
  error?: string;
  debate?: any; // Full debate object on 'complete'
}

// ─── System Prompts ────────────────────────────────────────────────────────

const ROLE_PROMPTS: Record<string, string> = {
  researcher:
    "You are a Researcher. Find facts, cite sources, focus on evidence and data. Be thorough but concise.",
  engineer:
    "You are an Engineer. Focus on implementation, feasibility, technical constraints, and practical solutions.",
  analyst:
    "You are an Analyst. Analyze trade-offs, compare options, identify patterns, and evaluate risks.",
  critic:
    "You are a Critic. Challenge assumptions, find flaws, play devil's advocate, and stress-test ideas.",
};

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Build context from previous rounds based on pass mode
 * Blind mode: agents see content but NOT role names ('Participant N' instead)
 * Sequential mode: agents see full history with role names
 * Blind mode Round 2+: includes prohibited sources constraint
 */
function buildContext(
  rounds: DebateRound[],
  passMode: "blind" | "sequential",
  prohibitedCitations?: string[]
): string {
  if (rounds.length === 0) return "";

  let context = "\n--- PREVIOUS ROUNDS ---\n\n";

  rounds.forEach((round) => {
    context += `Round ${round.roundNumber}:\n`;
    round.responses.forEach((resp, idx) => {
      if (passMode === "blind") {
        context += `[Participant ${idx + 1}]: ${resp.content}\n\n`;
      } else {
        context += `[${resp.role}]: ${resp.content}\n\n`;
      }
    });
  });

  // Append prohibited citations constraint in blind mode Round 2+
  if (prohibitedCitations && prohibitedCitations.length > 0) {
    context += `\n\nDo NOT cite or reference these sources again. Find new sources:\n${prohibitedCitations.join('\n')}`;
  }

  return context;
}

/**
 * Build system prompt for an agent
 */
function buildSystemPrompt(agent: DebateAgent): string {
  if (agent.customPrompt) {
    return agent.customPrompt;
  }

  if (agent.role && ROLE_PROMPTS[agent.role.toLowerCase()]) {
    return ROLE_PROMPTS[agent.role.toLowerCase()];
  }

  return "You are a debate participant. Provide clear, thoughtful arguments.";
}

/**
 * Extract citations (URLs and DOIs) from content
 * Used for blind mode Round 2+ source rotation enforcement
 */
function extractCitations(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s)>\]"]+/g;
  const doiRegex = /doi:[^\s)>\]"]+/gi;
  const urls = content.match(urlRegex) || [];
  const dois = content.match(doiRegex) || [];
  return [...new Set([...urls, ...dois])];
}

/**
 * Build judge prompt
 */
function buildJudgePrompt(
  config: DebateConfig,
  rounds: DebateRound[],
  roundNum: number,
  isLastRound: boolean,
  roundSummaries: { round: number; summary: string }[]
): string {
  let prompt = `You are the judge in a multi-perspective debate.

TOPIC: ${config.topic}

`;

  // Include prior judge summaries for context
  if (roundSummaries.length > 0) {
    prompt += `PRIOR ROUND SUMMARIES:\n`;
    roundSummaries.forEach((summary) => {
      prompt += `--- Judge Summary: Round ${summary.round} ---\n${summary.summary}\n\n`;
    });
  }

  // Include only the current round responses
  const currentRound = rounds.find(r => r.roundNumber === roundNum);
  if (currentRound) {
    prompt += `--- CURRENT ROUND (Round ${roundNum}) ---\n`;
    currentRound.responses.forEach((resp) => {
      if (config.passMode === "blind") {
        prompt += `[Participant ${resp.agentId}]: ${resp.content}\n`;
      } else {
        prompt += `[${resp.role}]: ${resp.content}\n`;
      }
    });
    prompt += "\n";
  }

  if (isLastRound) {
    // Final round: produce full structured verdict
    prompt += `This is the FINAL ROUND. Produce a comprehensive final verdict formatted as follows:

## CONSENSUS
Points all participants agreed on throughout the debate

## DISAGREEMENTS
Key points of contention with different perspectives

## KEY INSIGHTS
Most valuable contributions from each perspective

## RECOMMENDATION
Your synthesis and recommended course of action

## CONFIDENCE
Rate overall reliability and confidence level as a percentage (0-100%) with reasoning

Ensure the final verdict is clear, balanced, and actionable.`;
  } else {
    // Intermediate round: clean structured summary
    prompt += `Summarize Round ${roundNum} in the following clean format:

## AGREED
Points where all participants are in agreement

## DISAGREED
Points where participants have conflicting views

## UP FOR DEBATE
Questions and areas requiring further investigation or evidence

## CONSENSUS
Current level of agreement/consensus reached (as percentage 0-100%)

## CONFIDENCE
Confidence score in the current findings (as percentage 0-100%) with reasoning

Keep this summary concise and well-structured for clarity.`;
  }

  return prompt;
}

/**
 * Call LLM API and stream response
 * Returns AsyncGenerator that yields chunks
 * Note: /api/chat is non-streaming, so we split response into words
 * and yield them with 20ms delay for visual streaming effect
 */
async function* callLLMStream(
  provider: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  abortSignal?: AbortSignal
): AsyncGenerator<string> {
  try {
    // Use the /api/chat endpoint (non-streaming)
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider,
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Split content into words and yield with delay for visual streaming effect
    if (data.content) {
      const words = data.content.split(' ');
      for (const word of words) {
        abortSignal?.throwIfAborted();
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`LLM call failed: ${error.message}`);
    }
    throw error;
  }
}

// ─── Main Debate Engine ────────────────────────────────────────────────────

/**
 * Main debate execution engine
 * Yields events as debate progresses in real-time
 */
export async function* runDebate(
  config: DebateConfig,
  abortSignal?: AbortSignal
): AsyncGenerator<DebateEvent> {
  // Filter out 'No LLM' agents
  const activeAgents = config.agents.filter((a) => a.provider !== "No LLM");

  if (activeAgents.length < 2) {
    yield {
      type: "error",
      error: "Debate requires at least 2 active agents",
    };
    return;
  }

  const rounds: DebateRound[] = [];
  const messages: any[] = [];
  const critiques: any[] = [];
  const roundSummaries: any[] = [];
  let prohibitedCitations: string[] = [];

  // ─── Main Round Loop ────────────────────────────────────────────────────

  for (
    let roundNum = 1;
    roundNum <= config.totalRounds;
    roundNum++
  ) {
    abortSignal?.throwIfAborted();

    yield { type: "round_start", roundNumber: roundNum };

    const roundResponses: DebateRound["responses"] = [];

    // ─── Agent Responses (SEQUENTIAL with real-time streaming) ────────────────────────────────────────────────

    // Build context once for all agents in this round
    const context = buildContext(
      rounds,
      config.passMode,
      config.passMode === "blind" && roundNum > 1 ? prohibitedCitations : undefined
    );

    // Execute agents sequentially to stream chunks in real-time
    for (const agent of activeAgents) {
      abortSignal?.throwIfAborted();

      yield {
        type: "agent_start",
        roundNumber: roundNum,
        agentId: agent.id,
        agentRole: agent.role,
      };

      // Build user message
      const userMessage =
        roundNum === 1
          ? config.topic
          : `${config.topic}\n${context}`;

      // Build system prompt
      const systemPrompt = buildSystemPrompt(agent);

      // Stream agent response with real-time chunk yields
      let agentContent = "";
      try {
        for await (const chunk of callLLMStream(
          agent.provider,
          agent.model,
          systemPrompt,
          userMessage,
          abortSignal
        )) {
          agentContent += chunk;
          yield {
            type: "chunk",
            roundNumber: roundNum,
            agentId: agent.id,
            chunk,
          };
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        yield {
          type: "error",
          error: `Agent ${agent.id} failed: ${errorMsg}`,
        };
        return;
      }

      // Store response
      roundResponses.push({
        agentId: agent.id,
        role: agent.role || `Agent ${activeAgents.indexOf(agent) + 1}`,
        content: agentContent,
        model: agent.model,
      });

      messages.push({
        role: "assistant",
        content: agentContent,
        agentId: agent.id,
        roundNumber: roundNum,
      });

      yield {
        type: "agent_complete",
        roundNumber: roundNum,
        agentId: agent.id,
      };
    }

    // Store round
    rounds.push({
      roundNumber: roundNum,
      responses: roundResponses,
    });

    // Extract citations from this round for blind mode source rotation (accumulative)
    if (config.passMode === "blind") {
      prohibitedCitations = prohibitedCitations.concat(
        roundResponses.flatMap(r => extractCitations(r.content))
      );
    }

    yield { type: "round_complete", roundNumber: roundNum };

    // ─── Judge for this round ──────────────────────────────────────────────────

    abortSignal?.throwIfAborted();

    yield { type: "judge_start", roundNumber: roundNum };

    // Build judge prompt for this round (includes current round responses + prior summaries)
    const isLastRound = roundNum === config.totalRounds;
    const judgePrompt = buildJudgePrompt(config, rounds, roundNum, isLastRound, roundSummaries);
    const judgeSystemPrompt = buildSystemPrompt(config.judge);

    // Stream judge verdict for this round
    let judgeSummary = "";
    try {
      for await (const chunk of callLLMStream(
        config.judge.provider,
        config.judge.model,
        judgeSystemPrompt,
        judgePrompt,
        abortSignal
      )) {
        judgeSummary += chunk;
        yield {
          type: "judge_chunk",
          roundNumber: roundNum,
          chunk,
        };
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error";
      yield {
        type: "error",
        error: `Judge failed for round ${roundNum}: ${errorMsg}`,
      };
      return;
    }

    // Store judge summary for this round
    roundSummaries.push({
      round: roundNum,
      summary: judgeSummary,
    });

    yield { type: "judge_complete", roundNumber: roundNum };
  }

  // ─── Complete ──────────────────────────────────────────────────────────

  const debate = {
    id: `debate-${Date.now()}`,
    topic: config.topic,
    agents: activeAgents,
    judge: config.judge,
    totalRounds: config.totalRounds,
    passMode: config.passMode,
    status: "completed",
    messages,
    critiques,
    roundSummaries,
    agreements: [],
    executiveSummary: roundSummaries[roundSummaries.length - 1]?.summary || "",
    createdAt: new Date(),
    prohibitedCitations,
  };

  yield {
    type: "complete",
    debate,
  };
}
