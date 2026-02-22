import type { Provider } from "@/lib/types";

export interface VoiceSession {
  send: (audioData: ArrayBuffer) => void;
  close: () => void;
  interrupt: () => void;
}

export interface VoiceCallbacks {
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onTranscript: (text: string, role: "user" | "assistant") => boolean;
  onStateChange: (state: "listening" | "processing" | "speaking" | "idle") => void;
  onError: (error: string) => void;
}

const PROCESSING_TIMEOUT_MS = 15000;

export function createOpenAIVoiceSession(
  apiKey: string,
  model: string,
  callbacks: VoiceCallbacks
): VoiceSession {
  const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";
  const ws = new WebSocket(url, [
    "realtime",
    `openai-insecure-api-key.${apiKey}`,
    "openai-beta.realtime-v1",
  ]);

  let processingTimer: ReturnType<typeof setTimeout> | null = null;

  function clearProcessingTimeout() {
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = null;
    }
  }

  function startProcessingTimeout() {
    clearProcessingTimeout();
    processingTimer = setTimeout(() => {
      callbacks.onError("No response received — try again");
      callbacks.onStateChange("listening");
    }, PROCESSING_TIMEOUT_MS);
  }

  ws.onopen = () => {
    // Configure session for audio input/output
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: { type: "server_vad" },
        },
      })
    );
    callbacks.onStateChange("listening");
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "response.audio.delta": {
          clearProcessingTimeout();
          // Base64-encoded PCM16 audio chunk
          const binary = atob(msg.delta);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          callbacks.onAudioChunk(bytes.buffer);
          callbacks.onStateChange("speaking");
          break;
        }
        case "response.audio.done":
          clearProcessingTimeout();
          callbacks.onStateChange("listening");
          break;
        case "response.audio_transcript.done":
          callbacks.onTranscript(msg.transcript ?? "", "assistant");
          break;
        case "conversation.item.input_audio_transcription.completed": {
          const wasCommand = callbacks.onTranscript(msg.transcript ?? "", "user");
          if (wasCommand) {
            // Command detected — cancel any in-progress AI response
            ws.send(JSON.stringify({ type: "response.cancel" }));
          }
          break;
        }
        case "input_audio_buffer.speech_started":
          clearProcessingTimeout();
          callbacks.onStateChange("listening");
          break;
        case "input_audio_buffer.speech_stopped":
          callbacks.onStateChange("processing");
          startProcessingTimeout();
          break;
        case "error":
          clearProcessingTimeout();
          callbacks.onError(msg.error?.message ?? "OpenAI voice error");
          callbacks.onStateChange("listening");
          break;
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => {
    clearProcessingTimeout();
    callbacks.onError("WebSocket connection failed");
    callbacks.onStateChange("idle");
  };

  ws.onclose = () => {
    clearProcessingTimeout();
    callbacks.onStateChange("idle");
  };

  return {
    send: (audioData: ArrayBuffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Convert ArrayBuffer to base64
        const bytes = new Uint8Array(audioData);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64,
          })
        );
      }
    },
    close: () => {
      clearProcessingTimeout();
      ws.close();
    },
    interrupt: () => {
      clearProcessingTimeout();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "response.cancel" }));
        callbacks.onStateChange("listening");
      }
    },
  };
}
