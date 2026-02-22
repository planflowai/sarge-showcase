"use client";

import { Terminal, Plus, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ProviderSelector } from "@/components/providers/ProviderSelector";
import { ConversationList } from "@/components/conversation/ConversationList";
import { ClientOnly } from "@/components/ClientOnly";
import { useConversationStore } from "@/lib/stores/conversationStore";
import { useMessageStore } from "@/lib/stores/messageStore";
import { useProviderStore } from "@/lib/stores/providerStore";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { SupabaseStatus } from "@/components/layout/SupabaseStatus";
import { usePathname } from "next/navigation";
import { SIDEBAR_HIDDEN_ROUTES } from "@/lib/constants";

export function Sidebar() {
  const pathname = usePathname();

  const debate = useDebateStore((s) => s.debate);
  const showingSetup = useDebateStore((s) => s.showingSetup);
  const debateHidden = useDebateStore((s) => s.debateHidden);
  const showingTestMode = useTestModeStore((s) => s.showingTestMode);
  const testModeHidden = useTestModeStore((s) => s.testModeHidden);
  const showingForensicLog = useForensicLogStore((s) => s.showingForensicLog);
  const mainSidebarCollapsed = useUIStore((s) => s.mainSidebarCollapsed);
  const toggleMainSidebar = useUIStore((s) => s.toggleMainSidebar);
  const createConversation = useConversationStore((s) => s.createConversation);
  const clearMessages = useMessageStore((s) => s.clearMessages);
  const summarizeForCloud = useProviderStore((s) => s.summarizeForCloud);
  const setSummarizeForCloud = useProviderStore((s) => s.setSummarizeForCloud);
  const sanitizeForCloud = useProviderStore((s) => s.sanitizeForCloud);
  const setSanitizeForCloud = useProviderStore((s) => s.setSanitizeForCloud);

  const handleNewChat = async () => {
    clearMessages();
    await createConversation();
  };

  // Hide sidebar when debate or test mode is active — full-width view
  // But show sidebar when mode is hidden (user went back to chat)
  // Also hide sidebar on full-screen routes (see SIDEBAR_HIDDEN_ROUTES in lib/constants.ts)
  const debateActive = (debate || showingSetup) && !debateHidden;
  const testModeActive = showingTestMode && !testModeHidden;
  const onHiddenRoute = SIDEBAR_HIDDEN_ROUTES.includes(pathname ?? "");
  if (debateActive || testModeActive || showingForensicLog || onHiddenRoute) return null;

  // Collapsed view - thin vertical bar with icons
  if (mainSidebarCollapsed) {
    return (
      <aside className="hidden w-16 flex-shrink-0 flex-col border-r border-border bg-white dark:bg-zinc-900 md:flex">
        {/* Expand button */}
        <div className="flex h-14 items-center justify-center">
          <button
            onClick={toggleMainSidebar}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <Separator className="bg-zinc-200 dark:bg-zinc-800" />

        {/* Icon buttons */}
        <div className="flex flex-col items-center gap-2 py-3">
          <button
            onClick={handleNewChat}
            className="rounded-md p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-600 transition-colors group relative"
            title="New Chat"
          >
            <Plus className="h-5 w-5" />
            <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white z-50">
              New Chat
            </span>
          </button>

          <button
            className="rounded-md p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-600 transition-colors group relative"
            title="Conversations"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white z-50">
              Conversations
            </span>
          </button>
        </div>
      </aside>
    );
  }

  // Expanded view - full sidebar
  return (
    <aside className="hidden w-[280px] flex-shrink-0 flex-col border-r border-border bg-white dark:bg-zinc-900 md:flex">
      {/* Collapse button */}
      <div className="flex h-14 items-center justify-end px-4">
        <button
          onClick={toggleMainSidebar}
          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <Button
          className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
          onClick={handleNewChat}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator className="bg-zinc-200 dark:bg-zinc-800" />

      <ScrollArea className="flex-1">
        {/* Conversations */}
        <div className="px-3 py-3">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">
            Conversations
          </p>
          <ClientOnly>
            <ConversationList />
          </ClientOnly>
        </div>

        <Separator className="bg-zinc-200 dark:bg-zinc-800" />

        {/* Providers */}
        <div className="px-3 py-3">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">
            Providers
          </p>
          <ClientOnly>
            <ProviderSelector />
          </ClientOnly>
        </div>

        <Separator className="bg-zinc-200 dark:bg-zinc-800" />

        {/* Cloud Privacy Settings */}
        <div className="px-3 py-3">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-500">
            Cloud Privacy
          </p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <input
                type="checkbox"
                checked={summarizeForCloud}
                onChange={(e) => setSummarizeForCloud(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-indigo-500"
              />
              Summarize threads for cloud
            </label>
            <p className="px-1 pl-7 text-[10px] leading-tight text-zinc-600">
              Sends a summary of your chat (via local Ollama) instead of full history to cloud providers.
            </p>

            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <input
                type="checkbox"
                checked={sanitizeForCloud}
                onChange={(e) => setSanitizeForCloud(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-indigo-500"
              />
              Sanitize queries for cloud
            </label>
            <p className="px-1 pl-7 text-[10px] leading-tight text-zinc-600">
              Rewrites your query (via local Ollama) to strip proprietary info before sending to cloud.
            </p>
          </div>
        </div>
      </ScrollArea>

      <Separator className="bg-zinc-200 dark:bg-zinc-800" />
      <ClientOnly>
        <SupabaseStatus />
      </ClientOnly>
    </aside>
  );
}
