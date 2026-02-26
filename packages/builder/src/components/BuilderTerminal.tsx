"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBuilderStore } from "@/lib/stores/builderStore";

const COMMAND_TIMEOUT_MS = 30_000;

interface BuilderTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TerminalLine {
  type: 'command' | 'output' | 'error';
  content: string;
}

/** Detect the OS shell name for the welcome message */
function detectShellName(): string {
  if (typeof navigator === 'undefined') return 'Terminal';
  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) return 'PowerShell';
  if (/Mac/i.test(ua)) return 'zsh';
  return 'bash';
}

export default function BuilderTerminal({ isOpen, onClose }: BuilderTerminalProps) {
  const shellName = detectShellName();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: 'output', content: `${shellName} Terminal — Type commands and press Enter` },
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { projectPath } = useBuilderStore();

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input when terminal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedSeconds(0);
  }, []);

  const handleKill = useCallback(() => {
    abortControllerRef.current?.abort();
    stopTimer();
    setIsRunning(false);
    setHistory(prev => [...prev, { type: 'error', content: '⚠ Command killed by user' }]);
  }, [stopTimer]);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;

    setHistory(prev => [...prev, { type: 'command', content: `> ${command}` }]);
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    setInput("");
    setIsRunning(true);
    startTimer();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Auto-kill after timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
      stopTimer();
      setIsRunning(false);
      setHistory(prev => [...prev, {
        type: 'error',
        content: `⚠ Command timed out after ${COMMAND_TIMEOUT_MS / 1000}s`,
      }]);
    }, COMMAND_TIMEOUT_MS);

    try {
      const response = await fetch('/api/builder/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          cwd: projectPath || undefined,
          projectPath: projectPath || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success) {
        if (data.output) {
          setHistory(prev => [...prev, { type: 'output', content: data.output }]);
        }
      } else {
        setHistory(prev => [...prev, { type: 'error', content: data.error || 'Command failed' }]);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name !== 'AbortError') {
        setHistory(prev => [...prev, { type: 'error', content: `Error: ${error.message}` }]);
      }
    } finally {
      stopTimer();
      setIsRunning(false);
    }
  }, [projectPath, startTimer, stopTimer]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isRunning) {
      executeCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const handleClear = () => {
    setHistory([{ type: 'output', content: 'Terminal cleared' }]);
  };

  if (!isOpen) return null;

  return (
    <div className="h-[200px] border-t border-zinc-300 dark:border-zinc-700 bg-zinc-900 flex flex-col">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-300">{shellName}</span>
          {projectPath && (
            <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">
              {projectPath}
            </span>
          )}
          {isRunning && (
            <span className="text-[10px] text-amber-400 font-mono tabular-nums">
              {elapsedSeconds}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isRunning && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleKill}
              title="Kill running command"
              className="h-6 px-2 text-[10px] text-red-400 hover:text-red-200 hover:bg-red-900/30"
            >
              <Square className="h-3 w-3 mr-1 fill-current" />
              Kill
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isRunning}
            className="h-6 px-2 text-[10px] text-zinc-400 hover:text-zinc-200"
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs"
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((line, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap break-all",
              line.type === 'command' && "text-cyan-400",
              line.type === 'output' && "text-zinc-300",
              line.type === 'error' && "text-red-400"
            )}
          >
            {line.content}
          </div>
        ))}
        {isRunning && (
          <div className="text-zinc-500 animate-pulse">Running…</div>
        )}
      </div>

      {/* Terminal input */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border-t border-zinc-700">
        <span className="text-cyan-400 font-mono text-xs">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? "Command running…" : "Enter command…"}
          className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-zinc-200 placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}
