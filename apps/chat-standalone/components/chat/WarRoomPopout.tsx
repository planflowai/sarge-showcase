"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * WarRoomPopout — the receiver side rendered in popout windows.
 *
 * Covers the entire viewport (hides header/sidebar). Listens for
 * PROMPT messages on BroadcastChannel, calls /api/test/stream,
 * streams tokens back via RESPONSE_CHUNK/RESPONSE_DONE.
 *
 * Supports CONFIG_UPDATE to change provider/model dynamically
 * when user switches models in the dashboard dropdowns.
 */

// Provider colors for accent
const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  google: "#3b82f6",
  xai: "#ec4899",
  deepseek: "#6366f1",
  ollama: "#fbbf24",
  lmstudio: "#22c55e",
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Claude",
  openai: "GPT",
  google: "Gemini",
  xai: "Grok",
  deepseek: "DeepSeek",
  ollama: "Ollama",
  lmstudio: "LM Studio",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function WarRoomPopout({
  slotId,
  provider: initialProvider,
  model: initialModel,
}: {
  slotId: string;
  provider: string;
  model: string;
}) {
  // Dynamic provider/model — can be updated via CONFIG_UPDATE from dashboard
  const [activeProvider, setActiveProvider] = useState(initialProvider);
  const [activeModel, setActiveModel] = useState(initialModel);
  const providerRef = useRef(initialProvider);
  const modelRef = useRef(initialModel);

  // Keep refs in sync for use in async handlePrompt
  useEffect(() => {
    providerRef.current = activeProvider;
    modelRef.current = activeModel;
  }, [activeProvider, activeModel]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const color = PROVIDER_COLORS[activeProvider] ?? "#71717a";
  const providerName = PROVIDER_NAMES[activeProvider] ?? activeProvider;
  const monNumber = slotId.replace("mon", "");

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, currentStream]);

  // Stream a prompt to /api/test/stream and relay tokens via BroadcastChannel
  const handlePrompt = useCallback(async (prompt: string) => {
    // Abort any in-progress stream
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    // Read current provider/model from refs (may have been updated via CONFIG_UPDATE)
    const currentProvider = providerRef.current;
    const currentModel = modelRef.current;

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setStreaming(true);
    setCurrentStream("");

    const ch = new BroadcastChannel("sarge-warroom");

    // Signal start
    ch.postMessage({ type: "RESPONSE_START", payload: { slotId } });

    try {
      const source = currentProvider === "ollama" || currentProvider === "lmstudio" ? "local" : currentProvider;
      const res = await fetch("/api/test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: currentModel, prompt, provider: currentProvider, source }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        ch.postMessage({ type: "RESPONSE_DONE", payload: { slotId, error: true } });
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errText}` }]);
        setStreaming(false);
        ch.close();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        ch.postMessage({ type: "RESPONSE_DONE", payload: { slotId, error: true } });
        setStreaming(false);
        ch.close();
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let tokenCount = 0;
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        lineBuffer += raw;

        // Parse NDJSON lines: {"message":{"content":"..."}}
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? ""; // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const text = parsed?.message?.content ?? "";
            if (text) {
              fullText += text;
              tokenCount++;
              setCurrentStream(fullText);
              ch.postMessage({ type: "RESPONSE_CHUNK", payload: { slotId, text } });
            }
          } catch {
            // Not JSON — treat as raw text
            fullText += trimmed;
            setCurrentStream(fullText);
            ch.postMessage({ type: "RESPONSE_CHUNK", payload: { slotId, text: trimmed } });
          }
        }
      }

      // Flush remaining buffer
      if (lineBuffer.trim()) {
        try {
          const parsed = JSON.parse(lineBuffer.trim());
          const text = parsed?.message?.content ?? "";
          if (text) {
            fullText += text;
            tokenCount++;
          }
        } catch {
          fullText += lineBuffer.trim();
        }
        setCurrentStream(fullText);
      }

      // Done
      setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      setCurrentStream("");
      ch.postMessage({ type: "RESPONSE_DONE", payload: { slotId, tokens: tokenCount } });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        ch.postMessage({ type: "RESPONSE_DONE", payload: { slotId, error: true } });
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
      }
    } finally {
      setStreaming(false);
      ch.close();
    }
  }, [slotId]);

  // Listen for BroadcastChannel messages
  useEffect(() => {
    const ch = new BroadcastChannel("sarge-warroom");
    ch.onmessage = (e) => {
      const { type, payload } = e.data ?? {};

      if (type === "PROMPT") {
        // Only respond if broadcast (target=null) or targeted at this slot
        if (payload.target === null || payload.target === slotId) {
          handlePrompt(payload.text);
        }
      }

      // Dashboard changed model for this slot — update dynamically
      if (type === "CONFIG_UPDATE" && payload?.slotId === slotId) {
        if (payload.provider) setActiveProvider(payload.provider);
        if (payload.model) setActiveModel(payload.model);
      }

      if (type === "RECALL") {
        try { window.close(); } catch { /* may not be allowed */ }
      }

      if (type === "CLEAR") {
        setMessages([]);
        setCurrentStream("");
      }
    };
    return () => ch.close();
  }, [slotId, handlePrompt]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
      style={{ backgroundColor: "#09090b" }}
    >
      {/* -- Slim Header -- */}
      <div
        className="flex items-center justify-between px-5 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${color}20`, background: `${color}06` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
            style={{ border: `2px solid ${color}40`, color }}
          >
            {(PROVIDER_NAMES[activeProvider]?.[0] ?? "?").toUpperCase()}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
              {providerName}
            </span>
            <span className="text-xs text-zinc-500 ml-2">{activeModel}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold text-zinc-600">MON {monNumber}</span>
      </div>

      {/* -- Messages -- */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.role === "user" ? (
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600/20 border border-indigo-500/20 text-sm text-zinc-200">
                {msg.content}
              </div>
            ) : (
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* Streaming in progress */}
        {streaming && currentStream && (
          <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {currentStream}
            <span
              className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse"
              style={{ backgroundColor: color }}
            />
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !streaming && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-4xl font-black"
                style={{
                  color,
                  border: `2px solid ${color}25`,
                  boxShadow: `0 0 20px ${color}10`,
                  animation: "popout-breathe 3s ease-in-out infinite",
                }}
              >
                {(PROVIDER_NAMES[activeProvider]?.[0] ?? "?").toUpperCase()}
              </div>
              <div className="text-xs text-zinc-600">Waiting for broadcast...</div>
            </div>
          </div>
        )}
      </div>

      {/* -- Status Bar -- */}
      <div
        className="flex items-center justify-between px-5 py-1.5 flex-shrink-0 text-[10px] font-mono"
        style={{ borderTop: `1px solid ${color}12`, background: `${color}04` }}
      >
        <span className="text-zinc-600">
          {streaming ? "Streaming..." : messages.length > 0 ? `${messages.length} messages` : "Ready"}
        </span>
        <span style={{ color: `${color}60` }}>The Foundry — War Room</span>
      </div>

      <style jsx>{`
        @keyframes popout-breathe {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.03); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
