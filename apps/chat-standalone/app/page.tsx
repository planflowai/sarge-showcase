"use client";

import { ChatView } from "@sarge/chat/index.client";

export default function Home() {
  return (
    <div className="flex h-screen w-full">
      <main className="flex-1 flex flex-col">
        <header className="h-12 border-b border-zinc-800 flex items-center px-4">
          <h1 className="text-sm font-semibold text-zinc-300">SARGE Chat Standalone</h1>
        </header>
        <div className="flex-1 overflow-hidden">
          <ChatView />
        </div>
      </main>
    </div>
  );
}
