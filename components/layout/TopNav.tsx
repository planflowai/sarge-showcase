"use client";

import { useState, useEffect, useCallback } from "react";
import { Terminal, Swords, BookOpen, FileSearch, MessageSquare, ChevronRight, FlaskConical, Brain, Code2 } from "lucide-react";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { cn } from "@/lib/utils";
import { useRouter, usePathname } from "next/navigation";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

type NavMode = 'batch' | 'test' | 'review' | 'debate' | 'library' | 'forensic' | 'chat' | 'builder' | 'aiAnalysis' | 'optimize';

interface NavItem {
  id: NavMode;
  label: string;
  icon: typeof Terminal;
  color: string;
  activeColor: string;
  bgActive: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'builder',
    label: 'Builder',
    icon: Code2,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'debate',
    label: 'Debate Arena',
    icon: Swords,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'batch',
    label: 'Batch',
    icon: Terminal,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'test',
    label: 'Test',
    icon: Terminal,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'aiAnalysis',
    label: 'Journal',
    icon: FlaskConical,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: Brain,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'review',
    label: 'Review',
    icon: FileSearch,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'forensic',
    label: 'Forensic',
    icon: FileSearch,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
  {
    id: 'library',
    label: 'Library',
    icon: BookOpen,
    color: 'text-zinc-500 dark:text-zinc-400',
    activeColor: 'text-black dark:text-white',
    bgActive: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500',
  },
];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Get current mode from stores
  const debate = useDebateStore((s) => s.debate);
  const showingSetup = useDebateStore((s) => s.showingSetup);
  const debateHidden = useDebateStore((s) => s.debateHidden);
  const openDebateFunc = useDebateStore((s) => s.openDebate);
  const hideDebate = useDebateStore((s) => s.hideDebate);
  const showDebate = useDebateStore((s) => s.showDebate);

  const showingTestMode = useTestModeStore((s) => s.showingTestMode);
  const testModeHidden = useTestModeStore((s) => s.testModeHidden);
  const batchModeActive = useTestModeStore((s) => s.batchModeActive);
  const openTestMode = useTestModeStore((s) => s.openTestMode);
  const openBatchMode = useTestModeStore((s) => s.openBatchMode);
  const hideTestMode = useTestModeStore((s) => s.hideTestMode);

  const showingForensicLog = useForensicLogStore((s) => s.showingForensicLog);
  const openForensicLog = useForensicLogStore((s) => s.openForensicLog);
  const closeForensicLog = useForensicLogStore((s) => s.closeForensicLog);

  // Determine active mode
  const getActiveMode = (): NavMode => {
    // Check for page routes first
    if (pathname === '/builder') return 'builder';
    if (pathname === '/library') return 'library';
    if (pathname === '/review') return 'review';
    if (pathname === '/journal') return 'aiAnalysis';
    if (pathname === '/optimize') return 'optimize';
    if (showingForensicLog) return 'forensic';
    if ((debate || showingSetup) && !debateHidden) return 'debate';
    if (showingTestMode && !testModeHidden) {
      return batchModeActive ? 'batch' : 'test';
    }
    return 'chat';
  };

  const activeMode = getActiveMode();

  // Handle navigation
  const handleNavClick = useCallback((mode: NavMode) => {
    const isOnSubPage = pathname !== '/';

    // Close all open modes first (batch operations to reduce re-renders)
    if (mode !== 'forensic' && showingForensicLog) {
      closeForensicLog();
    }
    if (mode !== 'debate' && (debate || showingSetup) && !debateHidden) {
      hideDebate();
    }
    if (mode !== 'test' && mode !== 'batch' && showingTestMode && !testModeHidden) {
      hideTestMode();
    }

    // Navigate back home if needed
    if (isOnSubPage && mode !== 'library' && mode !== 'review' && mode !== 'aiAnalysis' && mode !== 'optimize' && mode !== 'builder') {
      router.push('/');
      return; // Let router handle the rest after navigation
    }

    // Activate target mode (no setTimeout delays)
    switch (mode) {
      case 'batch':
        if (showingTestMode && testModeHidden) {
          useTestModeStore.getState().showTestMode();
        } else {
          openBatchMode();
        }
        break;
      case 'test':
        if (showingTestMode && testModeHidden) {
          useTestModeStore.getState().showTestMode();
        } else {
          openTestMode();
        }
        break;
      case 'review':
        router.push('/review');
        break;
      case 'debate':
        if ((debate || showingSetup) && debateHidden) {
          showDebate();
        } else if (!debate && !showingSetup) {
          openDebateFunc();
        } else {
          showDebate();
        }
        break;
      case 'library':
        router.push('/library');
        break;
      case 'forensic':
        openForensicLog();
        break;
      case 'aiAnalysis':
        router.push('/journal');
        break;
      case 'optimize':
        router.push('/optimize');
        break;
      case 'builder':
        router.push('/builder');
        break;
      case 'chat':
        if (pathname !== '/') {
          router.push('/');
        }
        break;
    }
  }, [pathname, debate, showingSetup, debateHidden, showingTestMode, testModeHidden, showingForensicLog, closeForensicLog, hideDebate, hideTestMode, showDebate, openDebateFunc, openBatchMode, openTestMode, openForensicLog, router]);

  // Get breadcrumb for current sub-mode
  const getBreadcrumb = (): string | null => {
    if (showingTestMode && !testModeHidden) {
      const currentView = useTestModeStore.getState().currentView;
      return currentView === 'batch' ? 'Batch Test Runner' :
             currentView === 'test' ? 'Single Test' :
             currentView === 'review' ? 'Review' :
             currentView === 'config' ? 'Configuration' : null;
    }
    if ((debate || showingSetup) && !debateHidden) {
      return debate ? `Round ${debate.currentRound}/${debate.rounds}` : 'Setup';
    }
    return null;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <nav className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center px-4 shrink-0">
      {/* Main Navigation */}
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeMode === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all border",
                isActive
                  ? `${item.bgActive} ${item.activeColor}`
                  : `border-transparent ${item.color} hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50`
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sync Status Indicator */}
      <SyncStatusIndicator />

      {/* Breadcrumb / Current Context */}
      {breadcrumb && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 ml-2">
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium">{breadcrumb}</span>
        </div>
      )}
    </nav>
  );
}
