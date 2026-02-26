import type { VoiceSession, VoiceCallbacks } from "./openaiVoice";

/* eslint-disable @typescript-eslint/no-explicit-any */

const XTTS_URL = process.env.NEXT_PUBLIC_XTTS_URL || "http://localhost:8787";

/** Try XTTS-v2 server for TTS, returns audio blob or null on failure. */
async function xttsSpeak(text: string, speaker: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${XTTS_URL}/api/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Ollama voice using browser Web Speech API for STT,
 * XTTS-v2 for custom TTS (falls back to browser SpeechSynthesis),
 * and Ollama chat API for the LLM response.
 */
export function createOllamaVoiceSession(
  model: string,
  callbacks: VoiceCallbacks,
  speaker?: string
): VoiceSession {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

  if (!SR) {
    callbacks.onError("Speech recognition not supported in this browser");
    return { send() {}, close() {}, interrupt() {} };
  }

  const recognition = new SR() as any;
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  let closed = false;
  let speaking = false;
  const synth = window.speechSynthesis;

  recognition.onresult = async (event: any) => {
    const last = event.results[event.results.length - 1];
    if (!last?.isFinal) return;
    const transcript = (last[0].transcript as string).trim();
    if (!transcript) return;

    const wasCommand = callbacks.onTranscript(transcript, "user");
    if (wasCommand) {
      // Voice command handled (model switch, etc.) — don't send to Ollama
      return;
    }
    callbacks.onStateChange("processing");

    try {
      const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: transcript }],
          stream: false,
          keep_alive: "1h",          // Keep model loaded (prevents reload delays)
          options: {
            temperature: 0.3,        // Lower for speed
            num_predict: 2048,       // Balance speed and completeness
            num_gpu: 99,             // Force GPU acceleration
            num_thread: 12,          // CPU thread config
            keep_alive: "1h",        // Keep model loaded (300% faster subsequent responses)
            num_ctx: 8192,           // Match model context window (prevents silent truncation)
            num_batch: 256,          // Optimize token batching (15% faster generation)
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);

      if (!res.ok) {
        callbacks.onError(`Ollama error: ${res.status}`);
        callbacks.onStateChange("listening");
        return;
      }

      const data = await res.json();
      const reply = data.message?.content ?? "";

      callbacks.onTranscript(reply, "assistant");
      callbacks.onStateChange("speaking");

      // Pause recognition while speaking to prevent feedback loop
      speaking = true;
      recognition.stop();

      const resumeListening = () => {
        speaking = false;
        if (!closed) {
          callbacks.onStateChange("listening");
          try { recognition.start(); } catch { /* already started */ }
        }
      };

      // Try XTTS-v2 custom voice first, fall back to browser TTS
      const audioBlob = speaker ? await xttsSpeak(reply, speaker) : null;

      if (audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => { URL.revokeObjectURL(audioUrl); resumeListening(); };
        audio.onerror = () => { URL.revokeObjectURL(audioUrl); resumeListening(); };
        audio.play().catch(() => resumeListening());
      } else {
        // Browser TTS fallback
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.onend = resumeListening;
        utterance.onerror = resumeListening;
        synth.speak(utterance);
      }
    } catch (err) {
      callbacks.onError(`Ollama voice error: ${err}`);
      if (!closed) callbacks.onStateChange("listening");
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error !== "aborted") {
      callbacks.onError(`Speech recognition error: ${event.error}`);
    }
  };

  recognition.onend = () => {
    if (!closed && !speaking) {
      try {
        recognition.start();
      } catch {
        // already started
      }
    }
  };

  recognition.start();
  callbacks.onStateChange("listening");

  return {
    send() {
      // Audio data not used — Web Speech API handles mic directly
    },
    close() {
      closed = true;
      recognition.stop();
      synth.cancel();
    },
    interrupt() {
      synth.cancel();
      callbacks.onStateChange("listening");
    },
  };
}
