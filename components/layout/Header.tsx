"use client";

import { Menu, Moon, Sun, Settings, CheckCircle, XCircle, Swords, BookOpen, FileSearch, MessageSquare, FlaskConical, ShieldCheck, Zap, Brain, Code, Code2, BookText, Shield, ShieldOff, Plane, Radio, Sparkles, Activity, Search, Building2, Stethoscope, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/MobileNav";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSettingsStore } from "@/lib/stores/settingsStore";
import { useDebateStore } from "@/lib/stores/debateStore";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import { useForensicLogStore } from "@/lib/stores/forensicLogStore";
import { useAirGapStore } from "@/lib/stores/airGapStore";
import { useAIAnalysisStore } from "@/lib/stores/aiAnalysisStore";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavMode = 'dashboard' | 'chat' | 'builder' | 'research' | 'apps' | 'debate' | 'batch' | 'test' | 'review' | 'library' | 'forensic' | 'ai-analysis' | 'sandbox' | 'journal' | 'optimize' | 'live-checker' | 'real-world' | 'diagnostics' | 'demo';

interface NavItem {
  id: NavMode;
  label: string;
  emoji: string;
  activeColor: string;
  bgActive: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', emoji: '📊', activeColor: 'text-black dark:text-white', bgActive: 'bg-gradient-to-r from-indigo-200 to-purple-200 dark:from-indigo-700 dark:to-purple-700 border-indigo-400 dark:border-indigo-500' },
  { id: 'chat', label: 'Chat', emoji: '💬', activeColor: 'text-black dark:text-white', bgActive: 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-500' },
  { id: 'debate', label: 'Debate', emoji: '⚔️', activeColor: 'text-black dark:text-white', bgActive: 'bg-orange-100 dark:bg-orange-900/50 border-orange-400 dark:border-orange-500' },
  { id: 'batch', label: 'Batch', emoji: '📊', activeColor: 'text-black dark:text-white', bgActive: 'bg-green-100 dark:bg-green-900/50 border-green-400 dark:border-green-500' },
  { id: 'test', label: 'Test', emoji: '🧪', activeColor: 'text-black dark:text-white', bgActive: 'bg-red-100 dark:bg-red-900/50 border-red-400 dark:border-red-500' },
  { id: 'journal', label: 'Journal', emoji: '📓', activeColor: 'text-black dark:text-white', bgActive: 'bg-amber-100 dark:bg-amber-900/50 border-amber-400 dark:border-amber-500' },
  { id: 'optimize', label: 'Optimize', emoji: '⚡', activeColor: 'text-black dark:text-white', bgActive: 'bg-pink-100 dark:bg-pink-900/50 border-pink-400 dark:border-pink-500' },
  { id: 'live-checker', label: 'Live', emoji: '🔍', activeColor: 'text-black dark:text-white', bgActive: 'bg-cyan-100 dark:bg-cyan-900/50 border-cyan-400 dark:border-cyan-500' },
  { id: 'real-world', label: 'Real', emoji: '🏢', activeColor: 'text-black dark:text-white', bgActive: 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 dark:border-emerald-500' },
  { id: 'review', label: 'Review', emoji: '📋', activeColor: 'text-black dark:text-white', bgActive: 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-400 dark:border-indigo-500' },
  { id: 'forensic', label: 'Forensic', emoji: '🔗', activeColor: 'text-black dark:text-white', bgActive: 'bg-rose-100 dark:bg-rose-900/50 border-rose-400 dark:border-rose-500' },
  { id: 'ai-analysis', label: 'AI', emoji: '🧠', activeColor: 'text-black dark:text-white', bgActive: 'bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-blue-700 dark:to-indigo-700 border-blue-400 dark:border-blue-500' },
  { id: 'library', label: 'Library', emoji: '📚', activeColor: 'text-black dark:text-white', bgActive: 'bg-teal-100 dark:bg-teal-900/50 border-teal-400 dark:border-teal-500' },
  { id: 'diagnostics', label: 'Diag', emoji: '🔧', activeColor: 'text-black dark:text-white', bgActive: 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-400 dark:border-yellow-500' },
  { id: 'builder', label: 'Builder', emoji: '🔨', activeColor: 'text-black dark:text-white', bgActive: 'bg-purple-100 dark:bg-purple-900/50 border-purple-400 dark:border-purple-500' },
  { id: 'research', label: 'Research', emoji: '🔬', activeColor: 'text-black dark:text-white', bgActive: 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-500' },
  { id: 'apps', label: 'Apps', emoji: '📱', activeColor: 'text-black dark:text-white', bgActive: 'bg-violet-100 dark:bg-violet-900/50 border-violet-400 dark:border-violet-500' },
  { id: 'demo', label: 'Demo', emoji: '🎬', activeColor: 'text-black dark:text-white', bgActive: 'bg-pink-100 dark:bg-pink-900/50 border-pink-400 dark:border-pink-500' },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

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

  // Air-gap mode
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const toggleAirGap = useAirGapStore((s) => s.toggleAirGap);

  // Secure mode (cybersecurity)
  const secureMode = useAirGapStore((s) => s.secureMode);
  const toggleSecureMode = useAirGapStore((s) => s.toggleSecureMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(() => setSupabaseConnected(true))
      .catch(() => setSupabaseConnected(false));
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Determine active mode
  const activeSubTab = useAIAnalysisStore((s) => s.activeSubTab);

  const getActiveMode = (): NavMode => {
    if (pathname === '/dashboard') return 'dashboard';
    if (pathname === '/builder') return 'builder';
    if (pathname === '/research') return 'research';
    if (pathname.startsWith('/apps')) return 'apps';
    if (pathname === '/library') return 'library';
    if (pathname === '/review') return 'review';
    if (pathname === '/journal') return 'journal';
    if (pathname === '/optimize') return 'optimize';
    if (pathname === '/live-checker') return 'live-checker';
    if (pathname === '/real-world') return 'real-world';
    if (pathname === '/diagnostics') return 'diagnostics';
    if (pathname === '/ai-analysis') {
      return activeSubTab === 'batch' ? 'batch' : 'ai-analysis';
    }
    if (pathname === '/demo') return 'demo';
    if (showingForensicLog) return 'forensic';
    if ((debate || showingSetup) && !debateHidden) return 'debate';
    if (showingTestMode && !testModeHidden) {
      return batchModeActive ? 'batch' : 'test';
    }
    return 'chat';
  };

  const activeMode = getActiveMode();

  // Handle navigation
  const handleNavClick = (mode: NavMode) => {
    // First, hide/close current modes if switching away
    if (mode !== 'forensic' && showingForensicLog) {
      closeForensicLog();
    }
    if (mode !== 'debate' && (debate || showingSetup) && !debateHidden) {
      hideDebate();
    }
    if (mode !== 'batch' && mode !== 'test' && showingTestMode && !testModeHidden) {
      hideTestMode();
    }

    const isOnSubPage = pathname !== '/';
    if (isOnSubPage && mode !== 'dashboard' && mode !== 'library' && mode !== 'review' && mode !== 'ai-analysis' && mode !== 'journal' && mode !== 'optimize' && mode !== 'live-checker' && mode !== 'real-world' && mode !== 'diagnostics' && mode !== 'builder' && mode !== 'research' && mode !== 'apps' && mode !== 'demo' && mode !== 'test' && mode !== 'batch') {
      router.push('/');
    }

    switch (mode) {
      case 'batch':
        router.push('/batch');
        break;
      case 'test':
        router.push('/test');
        break;
      case 'review':
        router.push('/review');
        break;
      case 'debate':
        if (isOnSubPage) {
          setTimeout(() => {
            if ((debate || showingSetup) && debateHidden) {
              showDebate();
            } else if (!debate && !showingSetup) {
              openDebateFunc();
            } else {
              showDebate();
            }
          }, 100);
        } else if ((debate || showingSetup) && debateHidden) {
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
        if (isOnSubPage) {
          setTimeout(() => openForensicLog(), 100);
        } else {
          openForensicLog();
        }
        break;
      case 'chat':
        // Navigation to '/' already handled by isOnSubPage block above.
        // If already on '/', nothing to do — modes were already hidden above.
        break;
      case 'ai-analysis':
        router.push('/ai-analysis');
        break;
      case 'journal':
        router.push('/journal');
        break;
      case 'optimize':
        router.push('/optimize');
        break;
      case 'live-checker':
        router.push('/live-checker');
        break;
      case 'real-world':
        router.push('/real-world');
        break;
      case 'diagnostics':
        router.push('/diagnostics');
        break;
      case 'builder':
        router.push('/builder');
        break;
      case 'research':
        router.push('/research');
        break;
      case 'apps':
        router.push('/apps');
        break;
      case 'dashboard':
        router.push('/dashboard');
        break;
      case 'demo':
        router.push('/demo');
        break;
    }
  };

  // Placeholder during hydration
  if (!mounted) {
    return (
      <div className="flex flex-col border-b border-border">
        {/* Title Row */}
        <div className="h-14 flex items-center justify-center bg-gradient-to-r from-slate-100 via-orange-50 to-slate-100 dark:from-[#0a0a0a] dark:via-[#141414] dark:to-[#0a0a0a]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl sm:text-2xl font-black tracking-wider text-[#FF6700]">S.A.R.G.E.</span>
          </div>
        </div>
        {/* Nav Row */}
        <div className="h-12 bg-zinc-100 dark:bg-[#0a0a0a] flex items-center px-4" />
      </div>
    );
  }

  return (
    <>
      {/* Security Banners - Show when Secure or Air-Gap modes are enabled */}
      {(secureMode || airGapEnabled) && (
        <div className={cn(
          "text-white px-4 py-2 flex items-center justify-center gap-4 shadow-lg border-b-2",
          secureMode && airGapEnabled
            ? "bg-gradient-to-r from-red-700 via-red-600 to-amber-600 border-red-800/50"
            : secureMode
            ? "bg-gradient-to-r from-red-700 via-red-600 to-red-700 border-red-800/50"
            : "bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 border-amber-700/50 animate-pulse-slow"
        )}>
          <div className="flex items-center gap-2">
            {secureMode && <Shield className="h-5 w-5" />}
            {airGapEnabled && <Plane className="h-5 w-5 rotate-45" />}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
            <span className="font-black tracking-widest text-sm uppercase drop-shadow-sm">
              {secureMode && airGapEnabled
                ? "🔒 MAXIMUM SECURITY"
                : secureMode
                ? "🔴 SECURE MODE"
                : "✈️ AIR-GAP MODE"
              }
            </span>
            <span className="text-white/80 text-xs font-medium hidden sm:inline">
              {secureMode && airGapEnabled
                ? "All threats blocked • Fully isolated • Local only • FIPS sanitization active"
                : secureMode
                ? "Input/output sanitization • Threat detection • Code injection blocked"
                : "All cloud APIs blocked • Fully isolated • Local models only"
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            {airGapEnabled && <Plane className="h-5 w-5 -rotate-45 scale-x-[-1]" />}
            {secureMode && <Shield className="h-5 w-5" />}
          </div>
        </div>
      )}

      <div className="flex flex-col border-b border-border">
        {/* Row 1: Main Title - Centered */}
        <div className="h-14 flex items-center justify-center bg-gradient-to-r from-slate-100 via-orange-50 to-slate-100 dark:from-zinc-900 dark:via-zinc-800/60 dark:to-zinc-900 relative border-b border-slate-200 dark:border-zinc-800 shadow-sm">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute left-2 z-10"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2.5 relative z-10">
            {/* S.A.R.G.E. icon */}
            <div className="relative">
              <ShieldCheck className="h-6 w-6 text-[#FF6700] drop-shadow-[0_0_6px_rgba(255,103,0,0.5)]" />
              <Zap className="h-2.5 w-2.5 text-amber-400 absolute -right-0.5 -bottom-0.5 drop-shadow-[0_0_3px_rgba(251,191,36,0.8)]" />
            </div>

            {/* S.A.R.G.E. — brand title */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-wider">
              <span className="text-[#FF6700] drop-shadow-[0_0_8px_rgba(255,103,0,0.4)]">S.A.R.G.E.</span>
            </h1>
          </div>
        </div>

        {/* Row 2: Navigation + Icons on same line */}
        <div className="h-12 bg-zinc-100 dark:bg-[#0a0a0a] flex items-center px-4 border-t border-zinc-200/50 dark:border-zinc-800/50">
          {/* Navigation Items */}
          <div className="flex items-center justify-start gap-1 min-w-0 overflow-x-auto scrollbar-hide">
            {NAV_ITEMS.map((item) => {
              const isActive = activeMode === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "group flex flex-shrink-0 items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 border",
                    isActive
                      ? `${item.bgActive} ${item.activeColor} shadow-sm`
                      : "border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/60"
                  )}
                >
                  <span className="text-base leading-none">{item.emoji}</span>
                  <span className="hidden xl:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: Status + Air-Gap + Theme + Settings */}
          <div className="flex items-center gap-2">
            {/* Connection Status with pulse animation */}
            {supabaseConnected !== null && (
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                supabaseConnected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              )}>
                {supabaseConnected ? (
                  <>
                    <Activity className="h-3 w-3 animate-pulse" />
                    <span className="hidden sm:inline">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
              </div>
            )}

            {/* Separator */}
            <div className="h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* SECURE Mode Button - Cybersecurity */}
            <button
              onClick={toggleSecureMode}
              title={secureMode ? "Disable Secure Mode (standard operation)" : "Enable Secure Mode (input/output sanitization, threat blocking)"}
              className={cn(
                "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all duration-300 border",
                secureMode
                  ? "bg-gradient-to-r from-red-600/40 to-red-500/40 border-red-500/70 text-red-100 hover:from-red-600/50 hover:to-red-500/50 ring-1 ring-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
                  : "bg-zinc-200/80 dark:bg-zinc-800/60 border-zinc-400 dark:border-zinc-600/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300/80 dark:hover:bg-zinc-700/70 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {secureMode ? (
                <>
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline tracking-widest">SECURE</span>
                </>
              ) : (
                <>
                  <ShieldOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Unsecured</span>
                </>
              )}
            </button>

            {/* Air-Gap Toggle Button - Airplane Mode Style */}
            <button
              onClick={toggleAirGap}
              title={airGapEnabled ? "Disable Air-Gap Mode (allow cloud)" : "Enable Air-Gap Mode (block all cloud APIs)"}
              className={cn(
                "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 border",
                airGapEnabled
                  ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border-amber-400/60 text-amber-600 dark:text-amber-300 hover:from-amber-500/40 hover:to-orange-500/40 ring-1 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-airgap-glow"
                  : "bg-emerald-100/80 dark:bg-zinc-800/60 border-emerald-300 dark:border-zinc-600/50 text-emerald-700 dark:text-zinc-400 hover:bg-emerald-200/80 dark:hover:bg-zinc-700/70 hover:text-emerald-800 dark:hover:text-zinc-200 hover:border-emerald-400 dark:hover:border-zinc-500/60"
              )}
            >
              {airGapEnabled ? (
                <>
                  <Plane className="h-4 w-4 rotate-45 transition-transform group-hover:rotate-[60deg]" />
                  <span className="hidden sm:inline tracking-wide">ISOLATED</span>
                  <Shield className="h-3 w-3 opacity-70" />
                </>
              ) : (
                <>
                  <Radio className="h-4 w-4 transition-transform group-hover:scale-110" />
                  <span className="hidden sm:inline">Online</span>
                </>
              )}
            </button>

            {/* Separator */}
            <div className="h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500 transition-transform hover:-rotate-12" />
              )}
            </Button>

            {/* Settings */}
            <Link href="/settings" title="Settings">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                <Settings className="h-4 w-4 transition-transform hover:rotate-90 duration-300" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  );
}
