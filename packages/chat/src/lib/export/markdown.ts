import { providers } from "@sarge/core";
import type { Debate, Provider } from "@sarge/core";

function getProviderName(provider: Provider): string {
  return providers.find((p) => p.id === provider)?.name ?? provider;
}

export function formatDebateAsMarkdown(debate: Debate): string {
  const lines: string[] = [];

  lines.push(`# Debate: ${debate.topic}`);
  lines.push("");
  lines.push(`**Status:** ${debate.status}`);
  lines.push(`**Created:** ${new Date(debate.createdAt).toLocaleString()}`);
  if (debate.completedAt) {
    lines.push(`**Completed:** ${new Date(debate.completedAt).toLocaleString()}`);
  }
  lines.push(`**Rounds:** ${debate.roundSummaries.length} / ${debate.rounds}`);
  lines.push("");

  // Participants
  lines.push("## Participants");
  lines.push("");
  debate.participants.forEach((p, i) => {
    lines.push(`- **Agent ${i + 1}:** ${getProviderName(p.provider)} / ${p.model}`);
  });
  lines.push(`- **Judge:** ${getProviderName(debate.judge.provider)} / ${debate.judge.model}`);
  lines.push("");

  // Redirects
  if (debate.redirects.length > 0) {
    lines.push("## User Redirections");
    lines.push("");
    debate.redirects.forEach((r, i) => {
      lines.push(`${i + 1}. ${r}`);
    });
    lines.push("");
  }

  // Per-round content
  for (let round = 1; round <= debate.roundSummaries.length; round++) {
    lines.push(`---`);
    lines.push(`## Round ${round}`);
    lines.push("");

    // Agent messages for this round
    debate.participants.forEach((p, pIdx) => {
      const msgs = debate.messages.filter(
        (m) => m.provider === p.provider && m.model === p.model
      );
      const roundMsg = msgs[round - 1];
      if (roundMsg) {
        lines.push(`### Agent ${pIdx + 1} — ${getProviderName(p.provider)} / ${p.model}`);
        lines.push("");
        lines.push(roundMsg.content);
        lines.push("");
      }
    });

    // Critiques
    const roundCrits = debate.critiques.filter((c) => c.round === round);
    if (roundCrits.length > 0) {
      lines.push("### Cross-Check Reviews");
      lines.push("");
      roundCrits.forEach((c) => {
        const agent = debate.participants[c.fromParticipantIndex];
        lines.push(`**Agent ${c.fromParticipantIndex + 1} (${getProviderName(agent.provider)}) Review:**`);
        lines.push("");
        lines.push(c.content);
        lines.push("");
      });
    }

    // Judge summary
    const summary = debate.roundSummaries.find((rs) => rs.round === round);
    if (summary) {
      lines.push(`### Judge Summary — ${getProviderName(summary.judgeProvider)} / ${summary.judgeModel}`);
      lines.push("");
      lines.push(summary.summary);
      lines.push("");
    }
  }

  // All citations
  if (debate.usedCitations.length > 0) {
    lines.push("---");
    lines.push("## All Citations");
    lines.push("");
    debate.usedCitations.forEach((url) => {
      lines.push(`- ${url}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}
