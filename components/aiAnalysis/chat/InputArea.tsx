"use client";

import { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Send } from "lucide-react";

interface InputAreaProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function InputArea({ onSend, disabled }: InputAreaProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    setInput("");
    onSend(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 backdrop-blur-sm px-4 pt-3 pb-3">
      <div className="mx-auto max-w-5xl">
        {/* Textarea */}
        <TextareaAutosize
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          minRows={2}
          maxRows={10}
          disabled={disabled}
          className="w-full resize-none rounded-lg bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none disabled:opacity-50 border border-zinc-300 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-600"
        />

        {/* Bottom action bar */}
        <div className="flex items-center justify-center gap-1 mt-2">
          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            title="Send message"
            className="p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:hover:bg-indigo-600"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
