"use client";

import { useEffect } from "react";
import { useAIAnalysisStore, type AIAnalysisSubTab } from "@/lib/stores/aiAnalysisStore";
import { AIChatView } from "@/components/aiAnalysis/chat/AIChatView";
import { AIDebateView } from "@/components/aiAnalysis/debate/AIDebateView";
import { AITestView } from "@/components/aiAnalysis/test/AITestView";
import { AIForensicView } from "@/components/aiAnalysis/forensic/AIForensicView";
import { AIReviewView } from "@/components/aiAnalysis/review/AIReviewView";
import {
  MessageSquare,
  Swords,
  FlaskConical,
  Shield,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { id: AIAnalysisSubTab; label: string; icon: typeof MessageSquare; color: string }[] = [
  { id: "chat", label: "AI Chat", icon: MessageSquare, color: "#3b82f6" },
  // { id: "debate", label: "AI Debate", icon: Swords, color: "#f97316" },
  // { id: "test", label: "AI Test", icon: FlaskConical, color: "#ef4444" },
  // { id: "forensic", label: "AI Forensic", icon: Shield, color: "#f43f5e" },
  // { id: "review", label: "AI Review", icon: FileSearch, color: "#6366f1" },
];

export default function AIAnalysisPage() {
  const activeSubTab = useAIAnalysisStore((s) => s.activeSubTab);
  const setActiveSubTab = useAIAnalysisStore((s) => s.aiSetActiveSubTab);

  // Render active view
  const renderView = () => {
    switch (activeSubTab) {
      case "chat":
        return <AIChatView />;
      case "debate":
        return <AIDebateView />;
      case "test":
        return <AITestView />;
      case "forensic":
        return <AIForensicView />;
      case "review":
        return <AIReviewView />;
      default:
        return <AIChatView />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4">
        <div className="flex items-center gap-1 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                )}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: isActive ? tab.color : undefined }}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderView()}
      </div>
    </div>
  );
}
