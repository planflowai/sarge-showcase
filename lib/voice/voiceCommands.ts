import type { Provider } from "@/lib/types";
import type { VoicePersona } from "@/lib/stores/modelStore";

export type VoiceCommand =
  | { type: "switch_provider"; provider: Provider; displayName: string }
  | { type: "switch_model"; provider: Provider; modelId: string; displayName: string }
  | { type: "switch_voice"; persona: VoicePersona; displayName: string }
  | { type: "start_debate" }
  | null;

const VOICE_PERSONAS: Record<string, { persona: VoicePersona; display: string }> = {
  jarvis: { persona: "jarvis", display: "Jarvis" },
  friday: { persona: "friday", display: "Friday" },
};

const PROVIDER_ALIASES: Record<string, { id: Provider; display: string }> = {
  claude: { id: "anthropic", display: "Claude" },
  anthropic: { id: "anthropic", display: "Claude" },
  gpt: { id: "openai", display: "GPT" },
  openai: { id: "openai", display: "GPT" },
  chatgpt: { id: "openai", display: "GPT" },
  gemini: { id: "google", display: "Gemini" },
  google: { id: "google", display: "Gemini" },
  grok: { id: "xai", display: "Grok" },
  xai: { id: "xai", display: "Grok" },
  ollama: { id: "ollama", display: "Ollama" },
};

/** Model nickname entry: modelId → { nickname, provider } */
export interface NicknameEntry {
  modelId: string;
  nickname: string;
  provider: Provider;
}

/**
 * Parse a voice/text command. Checks nickname-based model switching first,
 * then falls back to provider-level switching.
 *
 * @param transcript - The spoken or typed text
 * @param nicknameEntries - All model nicknames with their provider IDs (optional)
 */
export function parseVoiceCommand(
  transcript: string,
  nicknameEntries?: NicknameEntry[]
): VoiceCommand {
  const text = transcript.toLowerCase().trim();

  // Extract the target name from "bring in X" or "switch to X"
  const bringInMatch = text.match(/bring\s+in\s+(.+)/);
  const switchToMatch = text.match(/switch\s+to\s+(.+)/);
  const targetName = (bringInMatch?.[1] || switchToMatch?.[1])?.trim().replace(/[.,!?;:]+$/, "");

  if (targetName) {
    // 1. Check nicknames first (case-insensitive exact match)
    if (nicknameEntries && nicknameEntries.length > 0) {
      const nicknameMatch = nicknameEntries.find(
        (e) => e.nickname.toLowerCase() === targetName
      );
      if (nicknameMatch) {
        return {
          type: "switch_model",
          provider: nicknameMatch.provider,
          modelId: nicknameMatch.modelId,
          displayName: nicknameMatch.nickname,
        };
      }
    }

    // 2. Check voice personas (jarvis / friday)
    const voiceMatch = VOICE_PERSONAS[targetName];
    if (voiceMatch) {
      return {
        type: "switch_voice",
        persona: voiceMatch.persona,
        displayName: voiceMatch.display,
      };
    }

    // 3. Fall back to provider alias matching
    const alias = PROVIDER_ALIASES[targetName];
    if (alias) {
      return {
        type: "switch_provider",
        provider: alias.id,
        displayName: alias.display,
      };
    }
  }

  // Debate commands - only trigger for short, direct commands (not embedded in long text)
  // This prevents accidental triggers when pasting long threads that happen to contain these phrases
  if (text.length < 50) {
    if (
      text === "let's have a debate" ||
      text === "lets have a debate" ||
      text === "start debate" ||
      text === "start a debate" ||
      text === "begin debate" ||
      text === "begin a debate" ||
      text.startsWith("start debate") ||
      text.startsWith("begin debate")
    ) {
      return { type: "start_debate" };
    }
  }

  return null;
}
