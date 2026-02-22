"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAIAnalysisStore } from "@/lib/stores/aiAnalysisStore";
import { useProviderStore } from "@/lib/stores/providerStore";
import { providers } from "@/lib/providers";
import { MessageBubble } from "./MessageBubble";
import { InputArea } from "./InputArea";
import { Button } from "@/components/ui/button";
import { FileText, Download, Bot, Sparkles } from "lucide-react";
import { exportChatToPDF } from "@/lib/export/pdf";
import { exportChatToCSV } from "@/lib/export/csv";
import type { Message } from "@/lib/types";

export function AIChatView() {
  const aiChat = useAIAnalysisStore((s) => ({
    currentConversationId: s.aiChat.currentConversationId,
    conversations: s.aiChat.conversations ?? [],
    messages: s.aiChat.messages ?? [],
    loading: s.aiChat.loading ?? false,
    sending: s.aiChat.sending ?? false,
  }));
  const aiChatSendMessage = useAIAnalysisStore((s) => s.aiChatSendMessage);
  const aiChatLoadMessages = useAIAnalysisStore((s) => s.aiChatLoadMessages);
  const aiChatCreateConversation = useAIAnalysisStore((s) => s.aiChatCreateConversation);
  const currentProvider = useProviderStore((s) => s.currentProvider);
  const currentModel = useProviderStore((s) => s.currentModel);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const activeProvider = providers.find((p) => p.id === currentProvider);

  // Create initial conversation if none exists
  useEffect(() => {
    if (!aiChat.currentConversationId && aiChat.conversations.length === 0) {
      aiChatCreateConversation("AI Analysis Chat").then((id) => {
        if (id) {
          setConversationId(id);
        }
      });
    } else if (aiChat.currentConversationId) {
      setConversationId(aiChat.currentConversationId);
    }
  }, [aiChat.currentConversationId, aiChat.conversations.length, aiChatCreateConversation]);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      aiChatLoadMessages(conversationId);
    }
  }, [conversationId, aiChatLoadMessages]);

  // Scroll to bottom on new messages or sending state change
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(t);
  }, [aiChat.messages, aiChat.sending, scrollToBottom]);

  const handleSend = async (content: string) => {
    if (!conversationId || !content.trim()) return;
    await aiChatSendMessage(conversationId, content.trim(), currentProvider, currentModel);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto" ref={scrollRef}>
        <div>
          {aiChat.loading ? (
            <div className="space-y-4 px-4 sm:px-6 py-4 mx-auto max-w-7xl">
              {/* Loading skeletons */}
              {[1, 2, 3].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <div className="animate-pulse rounded-lg bg-zinc-800 px-5 py-4" style={{ width: `${40 + i * 10}%` }}>
                    <div className="h-3 rounded bg-zinc-700 mb-2" style={{ width: "80%" }} />
                    <div className="h-3 rounded bg-zinc-700 mb-2" style={{ width: "60%" }} />
                    <div className="h-3 rounded bg-zinc-700" style={{ width: "40%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : aiChat.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-20">
              <p className="text-sm text-zinc-500">Start typing to begin your AI analysis conversation</p>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6 py-4">
              {aiChat.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {aiChat.sending && (
                <div className="flex items-start gap-3">
                  <div className="relative rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 px-6 py-4 border border-zinc-700/50 shadow-lg">
                    {/* Animated glow background */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />

                    <div className="relative flex items-center gap-3">
                      {/* Bot icon with glow */}
                      <div className="relative">
                        <Bot className="h-5 w-5 text-cyan-400 animate-pulse" />
                        <div className="absolute inset-0 blur-md bg-cyan-400/40 animate-pulse" />
                      </div>

                      {/* Model name with glow */}
                      <span
                        className="text-sm font-bold tracking-wide"
                        style={{
                          background: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.5))',
                        }}
                      >
                        {currentModel || 'AI'}
                      </span>

                      {/* Pulsing dots */}
                      <span className="inline-flex items-center gap-1 ml-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: "300ms" }} />
                      </span>

                      {/* Sparkles icon */}
                      <Sparkles className="h-4 w-4 text-yellow-400/70 animate-spin" style={{ animationDuration: '3s' }} />
                    </div>

                    {/* "Thinking..." text */}
                    <div className="mt-2 text-[10px] text-zinc-500 font-medium tracking-wider uppercase">
                      Generating response...
                    </div>
                  </div>
                </div>
              )}

              {/* Export buttons when there are messages */}
              {aiChat.messages.length > 0 && !aiChat.sending && (
                <div className="flex justify-center gap-2 pt-2 opacity-0 transition-opacity hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportChatToPDF(aiChat.messages as Message[], "AI Analysis Chat Export")}
                    className="h-6 gap-1 px-2 text-[10px] text-zinc-600 hover:text-zinc-400"
                  >
                    <FileText className="h-3 w-3" /> Export PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportChatToCSV(aiChat.messages as Message[], "AI Analysis Chat Export")}
                    className="h-6 gap-1 px-2 text-[10px] text-zinc-600 hover:text-zinc-400"
                  >
                    <Download className="h-3 w-3" /> Export CSV
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <InputArea
        onSend={handleSend}
        disabled={aiChat.sending || !conversationId}
      />
    </div>
  );
}
