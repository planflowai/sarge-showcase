import type { VoiceSession, VoiceCallbacks } from "./openaiVoice";

const PROCESSING_TIMEOUT_MS = 15000;

export function createXAIVoiceSession(
  apiKey: string,
  model: string,
  callbacks: VoiceCallbacks
): VoiceSession {
  // xAI Grok uses OpenAI-compatible realtime API
  const url = "wss://api.x.ai/v1/realtime?model=grok-2-public";
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
          callbacks.onError(msg.error?.message ?? "xAI voice error");
          callbacks.onStateChange("listening");
          break;
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => {
    clearProcessingTimeout();
    callbacks.onError("xAI WebSocket connection failed");
    callbacks.onStateChange("idle");
  };

  ws.onclose = () => {
    clearProcessingTimeout();
    callbacks.onStateChange("idle");
  };

  return {
    send: (audioData: ArrayBuffer) => {
      if (ws.readyState === WebSocket.OPEN) {
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
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "response.cancel" }));
        callbacks.onStateChange("listening");
      }
    },
  };
}
