"use client";

import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ProviderSelector } from "@/components/providers/ProviderSelector";
import { ConversationList } from "@/components/conversation/ConversationList";
import { ClientOnly } from "@/components/ClientOnly";
import { useConversationStore } from "@/lib/stores/conversationStore";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const createConversation = useConversationStore(
    (s) => s.createConversation
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] bg-zinc-900 p-0">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 px-4">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          <span className="text-lg font-bold tracking-wider text-white">
            AI WORKBENCH
          </span>
        </div>

        <div className="px-3 pb-3">
          <Button
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => {
              createConversation("New Conversation");
              onOpenChange(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        <Separator className="bg-zinc-800" />

        <ScrollArea className="flex-1">
          {/* Conversations */}
          <div className="px-3 py-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Conversations
            </p>
            <ClientOnly>
              <ConversationList />
            </ClientOnly>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Context Library */}
          <div className="px-3 py-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Context Library
            </p>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Providers */}
          <div className="px-3 py-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Providers
            </p>
            <ClientOnly>
              <ProviderSelector />
            </ClientOnly>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
