"use client";

import { useCallback, useRef, useState } from "react";
import { createOpenAIVoiceSession } from "./openaiVoice";
import { createGoogleVoiceSession } from "./googleVoice";
import { createXAIVoiceSession } from "./xaiVoice";
import { createOllamaVoiceSession } from "./ollamaVoice";
import { AudioPlayer } from "./audioPlayer";
import type { VoiceSession, VoiceCallbacks } from "./openaiVoice";
import type { Provider, VoiceState } from "@sarge/core";

interface UseVoiceChatOptions {
  provider: Provider;
  model: string;
  speaker?: string;
  onTranscript: (text: string, role: "user" | "assistant") => boolean;
  onError?: (error: string) => void;
}

async function fetchVoiceKey(provider: Provider): Promise<string> {
  const res = await fetch(`/api/voice-key?provider=${provider}`);
  if (!res.ok) return "";
  const data = await res.json();
  return data.key ?? "";
}

export function useVoiceChat({
  provider,
  model,
  speaker,
  onTranscript,
  onError,
}: UseVoiceChatOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const sessionRef = useRef<VoiceSession | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const start = useCallback(async () => {
    // Ollama uses browser Web Speech API — no API key or AudioWorklet needed
    if (provider === "ollama") {
      const callbacks: VoiceCallbacks = {
        onAudioChunk: () => {},
        onTranscript: (text, role) => onTranscript(text, role),
        onStateChange: (state) => setVoiceState(state),
        onError: (error) => onError?.(error),
      };
      const session = createOllamaVoiceSession(model, callbacks, speaker);
      sessionRef.current = session;
      return;
    }

    // Cloud providers need API key
    const apiKey = await fetchVoiceKey(provider);
    if (!apiKey) {
      onError?.(`No API key found for ${provider}`);
      return;
    }

    // Request microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch {
      onError?.("Microphone permission denied");
      return;
    }
    mediaStreamRef.current = stream;

    // Create audio player for response
    const player = new AudioPlayer();
    playerRef.current = player;

    // Callbacks
    const callbacks: VoiceCallbacks = {
      onAudioChunk: (chunk) => {
        player.enqueue(chunk);
      },
      onTranscript: (text, role) => {
        return onTranscript(text, role);
      },
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onError: (error) => {
        onError?.(error);
      },
    };

    // Create provider-specific session
    let session: VoiceSession;
    switch (provider) {
      case "openai":
        session = createOpenAIVoiceSession(apiKey, model, callbacks);
        break;
      case "google":
        session = createGoogleVoiceSession(apiKey, model, callbacks);
        break;
      case "xai":
        session = createXAIVoiceSession(apiKey, model, callbacks);
        break;
      default:
        onError?.("Voice not supported for this provider");
        stream.getTracks().forEach((t) => t.stop());
        return;
    }
    sessionRef.current = session;

    // Capture mic audio via AudioWorklet and send PCM16 chunks to WebSocket
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    await audioCtx.audioWorklet.addModule("/pcm16-worklet.js");

    const source = audioCtx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioCtx, "pcm16-processor");
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      session.send(e.data);
    };

    source.connect(workletNode);
    workletNode.connect(audioCtx.destination);

    setVoiceState("listening");
  }, [provider, model, speaker, onTranscript, onError]);

  const stop = useCallback(() => {
    // Stop mic
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // Stop worklet node
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Close audio capture context
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    // Close session
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    // Stop playback
    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }

    setVoiceState("idle");
  }, []);

  const interrupt = useCallback(() => {
    // Stop audio playback
    if (playerRef.current) {
      playerRef.current.stop();
    }
    // Tell session to cancel response
    if (sessionRef.current) {
      sessionRef.current.interrupt();
    }
  }, []);

  return { voiceState, start, stop, interrupt };
}
