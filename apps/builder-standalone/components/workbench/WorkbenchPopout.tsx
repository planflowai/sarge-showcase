"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WORKBENCH_CHANNEL } from "@/lib/workbenchPopoutManager";
import { providers } from "@sarge/core";

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

const BUILDER_SYSTEM = `You are a code builder assistant inside The Foundry.

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

  const [messages,  setMessages]  = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const abortRef  = useRef<AbortController | null>(null);
  // Throttle preview broadcasts — send at most every 400ms
  const lastBroadcastRef = useRef(0);

  const color        = PROVIDER_COLORS[activeProvider] ?? "#71717a";
  const providerName = PROVIDER_NAMES[activeProvider]  ?? activeProvider;

  // Resolve full model display name
  const cloudProvider = providers.find((p) => p.id === activeProvider);
  const cloudModel    = cloudProvider?.models.find((m) => m.id === activeModel);
  const isLocal       = activeProvider === "ollama" || activeProvider === "lmstudio";
  const displayName   = isLocal ? (activeModel || "Local Model") : (cloudModel?.name ?? activeModel ?? "Unknown Model");

  // ─── Send prompt to AI ──────────────────────────────────────────────────────
  const handlePrompt = useCallback(async (prompt: string) => {
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const prov  = providerRef.current;
    const model = modelRef.current;

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setStreaming(true);

    const ch = new BroadcastChannel(WORKBENCH_CHANNEL);
    ch.postMessage({ type: "STATUS", slot: slotNum, status: "building" });

    // Prepend builder system instructions to the user prompt
    const fullPrompt = `${BUILDER_SYSTEM}\n\nUser request: ${prompt}`;

    const _billingStart = Date.now();
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
      ch.postMessage({ type: "STATUS", slot: slotNum, status: "complete" });

      // Log usage to billing — fire and forget
      try {
        if (prov !== "ollama" && prov !== "lmstudio") {
          fetch("/api/billing/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              provider: prov,
              app: "workbench-popout",
              tokensIn: 0,
              tokensOut: fullText.split(/\s+/).length,
              durationMs: Date.now() - _billingStart,
            }),
          }).catch(() => {});
        }
      } catch {}
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

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden" style={{ backgroundColor: "#09090b" }}>

      {/* Header — model name centered, provider left, mon/slot right */}
      <div
        className="relative flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${color}25`, background: `linear-gradient(to right, ${color}08, transparent)` }}
      >
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Provider color pill */}
          <div
            className="px-3 py-1.5 rounded-lg text-base font-black uppercase tracking-widest flex-shrink-0"
            style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}
          >
            {providerName}
          </div>
          {/* Live indicator */}
          {streaming && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Generating</span>
            </div>
          )}
        </div>
        {/* Centered model name */}
        <span className="absolute left-1/2 -translate-x-1/2 text-2xl font-[800] tracking-wide" style={{ color }} title={activeModel}>
          {displayName}
        </span>
        <span className="text-xl font-mono font-[800] text-zinc-400 flex-shrink-0 tracking-wide">
          MON {monitorNumber} · SLOT {slotNum}
        </span>
      </div>

      {/* Full-width live preview */}
      <div className="flex-1 relative overflow-hidden">
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
              <p className="text-[36px] font-[800] mb-3" style={{ color }}>
                {displayName}
              </p>
              <p className="text-base text-zinc-600">Waiting for prompt from command center...</p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-5 py-2 flex-shrink-0 text-sm font-mono"
        style={{ borderTop: `1px solid ${color}12`, background: `${color}04` }}
      >
        <span className="text-zinc-500">
          {streaming ? "⚡ Generating..." : messages.length > 0 ? `✓ ${messages.length} exchanges` : "Ready"}
        </span>
        <span style={{ color: `${color}50` }}>The Foundry — The Pit</span>
      </div>
    </div>
  );
}
