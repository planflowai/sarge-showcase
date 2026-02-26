import type { VoiceSession, VoiceCallbacks } from "./openaiVoice";

const PROCESSING_TIMEOUT_MS = 15000;

export function createGoogleVoiceSession(
  apiKey: string,
  model: string,
  callbacks: VoiceCallbacks
): VoiceSession {
  // Gemini Live API uses WebSocket at the multimodal live endpoint
  const wsModel = "gemini-2.0-flash-exp";
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  const ws = new WebSocket(url);

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
    // Send setup message
    ws.send(
      JSON.stringify({
        setup: {
          model: `models/${wsModel}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Aoede" },
              },
            },
          },
        },
      })
    );
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.setupComplete) {
        callbacks.onStateChange("listening");
        return;
      }

      if (msg.error) {
        clearProcessingTimeout();
        callbacks.onError(msg.error?.message ?? "Google voice error");
        callbacks.onStateChange("listening");
        return;
      }

      if (msg.serverContent) {
        const parts = msg.serverContent.modelTurn?.parts ?? [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            clearProcessingTimeout();
            // Base64 PCM audio
            const binary = atob(part.inlineData.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            callbacks.onAudioChunk(bytes.buffer);
            callbacks.onStateChange("speaking");
          }
          if (part.text) {
            callbacks.onTranscript(part.text, "assistant");
          }
        }

        if (msg.serverContent.turnComplete) {
          callbacks.onStateChange("listening");
        }
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => {
    clearProcessingTimeout();
    callbacks.onError("Google voice WebSocket failed");
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
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64,
                },
              ],
            },
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
        // Gemini doesn't have a direct cancel, close and reopen would be needed
        // For now just signal state change
        callbacks.onStateChange("listening");
      }
    },
  };
}
