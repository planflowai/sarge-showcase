"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { WORKBENCH_CHANNEL } from "@/lib/workbenchPopoutManager";

// ─── Provider styling ─────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#d97706",
  openai:    "#10b981",
  google:    "#3b82f6",
  xai:       "#ec4899",
  deepseek:  "#6366f1",
  ollama:    "#fbbf24",
  lmstudio:  "#22c55e",
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: "Claude",
  openai:    "GPT",
  google:    "Gemini",
  xai:       "Grok",
  deepseek:  "DeepSeek",
  ollama:    "Ollama",
  lmstudio:  "LM Studio",
};

// ─── Builder system prompt ────────────────────────────────────────────────────

const BUILDER_SYSTEM = `You are a code builder assistant inside AI Builder Workbench.

RULES:
- ALWAYS generate complete, self-contained single HTML files.
- Include ALL CSS inside <style> tags. Include ALL JavaScript inside <script> tags.
- NEVER reference external files like ./main.js or ./style.css.
- Start with a brief explanation (1-2 sentences) of what you built.
- Then provide the code in a single \`\`\`html code block.
- Make it visually impressive with Tailwind CSS via CDN.
- Be concise. No lengthy explanations.`;

// ─── Code extraction ──────────────────────────────────────────────────────────

function extractHtml(text: string): string {
  // Try ```html ... ```
  const htmlMatch = text.match(/```html\s*([\s\S]*?)```/i);
  if (htmlMatch) return htmlMatch[1].trim();
  // Try ``` ... ``` with DOCTYPE or <html
  const genericMatch = text.match(/```\s*(<!DOCTYPE[\s\S]*?|<html[\s\S]*?)```/i);
  if (genericMatch) return genericMatch[1].trim();
  // Partial fence — code is still streaming
  const partialHtml = text.match(/```html\s*([\s\S]*?)$/i);
  if (partialHtml) return partialHtml[1].trim();
  const partialGeneric = text.match(/```\s*(<!DOCTYPE[\s\S]*|<html[\s\S]*)$/i);
  if (partialGeneric) return partialGeneric[1].trim();
  return "";
}

// ─── Chat message type ────────────────────────────────────────────────────────

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// ─── WorkbenchPopout ──────────────────────────────────────────────────────────

interface WorkbenchPopoutProps {
  slotNum: number;
  monitorNumber: number;
  provider: string;
  model: string;
}

export function WorkbenchPopout({ slotNum, monitorNumber, provider: initProvider, model: initModel }: WorkbenchPopoutProps) {
  const [activeProvider, setActiveProvider] = useState(initProvider);
  const [activeModel,    setActiveModel]    = useState(initModel);
  const providerRef = useRef(initProvider);
  const modelRef    = useRef(initModel);

  useEffect(() => {
    providerRef.current = activeProvider;
    modelRef.current    = activeModel;
  }, [activeProvider, activeModel]);

  const [messages,      setMessages]      = useState<Msg[]>([]);
  const [streaming,     setStreaming]      = useState(false);
  const [currentStream, setCurrentStream] = useState("");
  const [previewHtml,   setPreviewHtml]   = useState("");
  const [input,         setInput]         = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  // Throttle preview broadcasts — send at most every 400ms
  const lastBroadcastRef = useRef(0);

  const color        = PROVIDER_COLORS[activeProvider] ?? "#71717a";
  const providerName = PROVIDER_NAMES[activeProvider]  ?? activeProvider;

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, currentStream]);

  // ─── Send prompt to AI ──────────────────────────────────────────────────────
  const handlePrompt = useCallback(async (prompt: string) => {
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const prov  = providerRef.current;
    const model = modelRef.current;

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setStreaming(true);
    setCurrentStream("");

    const ch = new BroadcastChannel(WORKBENCH_CHANNEL);
    ch.postMessage({ type: "STATUS", slot: slotNum, status: "building" });

    // Prepend builder system instructions to the user prompt
    const fullPrompt = `${BUILDER_SYSTEM}\n\nUser request: ${prompt}`;

    try {
      const source = prov === "ollama" || prov === "lmstudio" ? "local" : prov;
      const res = await fetch("/api/test/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: fullPrompt, provider: prov, source }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown error");
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
        ch.postMessage({ type: "STATUS", slot: slotNum, status: "idle" });
        setStreaming(false);
        ch.close();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        ch.postMessage({ type: "STATUS", slot: slotNum, status: "idle" });
        setStreaming(false);
        ch.close();
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const text = parsed?.message?.content ?? parsed?.content ?? "";
            if (text) {
              fullText += text;
              setCurrentStream(fullText);
              // Extract + update preview
              const html = extractHtml(fullText);
              if (html) {
                setPreviewHtml(html);
                // Throttled broadcast to dashboard
                const now = Date.now();
                if (now - lastBroadcastRef.current > 400) {
                  lastBroadcastRef.current = now;
                  ch.postMessage({ type: "PREVIEW_HTML", slot: slotNum, html });
                }
              }
            }
          } catch {
            if (trimmed) {
              fullText += trimmed;
              setCurrentStream(fullText);
            }
          }
        }
      }

      // Final extraction
      const finalHtml = extractHtml(fullText);
      if (finalHtml) {
        setPreviewHtml(finalHtml);
        ch.postMessage({ type: "PREVIEW_HTML", slot: slotNum, html: finalHtml });
        ch.postMessage({ type: "CODE", slot: slotNum, code: finalHtml });
      }

      setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      setCurrentStream("");
      ch.postMessage({ type: "STATUS", slot: slotNum, status: "complete" });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err?.message ?? "Unknown"}` }]);
        ch.postMessage({ type: "STATUS", slot: slotNum, status: "idle" });
      }
    } finally {
      setStreaming(false);
      ch.close();
    }
  }, [slotNum]);

  // ─── BroadcastChannel listener ──────────────────────────────────────────────
  useEffect(() => {
    const ch = new BroadcastChannel(WORKBENCH_CHANNEL);
    ch.onmessage = (e) => {
      const { type, slot, prompt, provider, model } = e.data ?? {};

      if (type === "PROMPT") {
        if (slot === null || slot === slotNum) handlePrompt(prompt);
      }
      if (type === "CONFIG" && slot === slotNum) {
        if (provider) setActiveProvider(provider);
        if (model)    setActiveModel(model);
      }
      if (type === "RECALL") {
        if (slot === null || slot === slotNum) {
          try { window.close(); } catch { /* ok */ }
        }
      }
    };
    return () => ch.close();
  }, [slotNum, handlePrompt]);

  // ─── Manual send ────────────────────────────────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    handlePrompt(text);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden" style={{ backgroundColor: "#09090b" }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${color}20`, background: `${color}06` }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
            style={{ border: `2px solid ${color}40`, color }}
          >
            {(providerName[0] ?? "?").toUpperCase()}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
              {providerName}
            </span>
            <span className="text-xs text-zinc-500 ml-2">{activeModel}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold text-zinc-600">
          MON {monitorNumber} · SLOT {slotNum}
        </span>
      </div>

      {/* Main split: chat left | preview right */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Chat panel */}
        <div className="flex flex-col w-[400px] flex-shrink-0 border-r" style={{ borderColor: `${color}15` }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">

            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
                {msg.role === "user" ? (
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-indigo-600/20 border border-indigo-500/20 text-sm text-zinc-200">
                    {msg.content}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-[20]">
                    {/* Show first ~600 chars in chat; full content in preview */}
                    {msg.content.length > 600 ? msg.content.slice(0, 600) + "\n\n[code in preview →]" : msg.content}
                  </div>
                )}
              </div>
            ))}

            {streaming && currentStream && (
              <div className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {currentStream.length > 400 ? currentStream.slice(0, 400) + "..." : currentStream}
                <span className="inline-block w-1.5 h-4 ml-0.5 rounded-sm animate-pulse" style={{ backgroundColor: color }} />
              </div>
            )}

            {messages.length === 0 && !streaming && (
              <div className="flex items-center justify-center h-40">
                <div className="text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 text-2xl font-black"
                    style={{ color, border: `2px solid ${color}25`, boxShadow: `0 0 20px ${color}10` }}
                  >
                    {(providerName[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="text-xs text-zinc-600">Waiting for prompt...</div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t flex-shrink-0" style={{ borderColor: `${color}12` }}>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type to build..."
                rows={2}
                disabled={streaming}
                className="flex-1 resize-none rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none border border-zinc-700 focus:border-zinc-600 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className="px-3 rounded-lg text-white transition-colors disabled:opacity-30"
                style={{ backgroundColor: color }}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Preview header */}
          <div
            className="px-4 py-1.5 flex items-center gap-2 flex-shrink-0"
            style={{ borderBottom: `1px solid ${color}15`, background: `${color}04` }}
          >
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Preview</span>
            {streaming && previewHtml && (
              <div className="flex items-center gap-1 ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[9px] font-bold text-amber-400">LIVE</span>
              </div>
            )}
          </div>

          {/* Iframe */}
          <div className="flex-1 relative">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                sandbox="allow-scripts allow-forms"
                title="Builder preview"
                className="absolute inset-0 w-full h-full"
                style={{ border: "none" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-5xl mb-3" style={{ color: `${color}40` }}>⚡</div>
                  <p className="text-sm text-zinc-600">Preview will appear here</p>
                  <p className="text-xs text-zinc-700 mt-1">Send a prompt to generate code</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 py-1 flex-shrink-0 text-[9px] font-mono"
        style={{ borderTop: `1px solid ${color}12`, background: `${color}04` }}
      >
        <span className="text-zinc-600">
          {streaming ? "Generating..." : messages.length > 0 ? `${messages.length} messages` : "Ready"}
        </span>
        <span style={{ color: `${color}50` }}>AI Builder Workbench</span>
      </div>
    </div>
  );
}
