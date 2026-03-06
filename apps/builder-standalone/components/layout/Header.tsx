"use client";

import {
  Moon,
  Sun,
  Settings,
  Flame,
  Plane,
  Radio,
  Hammer,
  DollarSign,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  useSettingsStore,
  useAirGapStore,
} from "@sarge/core";
import { launchBillingPopout } from "@/lib/billingPopoutManager";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavMode = "builder" | "chat";

interface NavItem {
  id: NavMode;
  label: string;
  emoji: string;
  href: string;
  activeColor: string;
  bgActive: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "chat",
    label: "Chat",
    emoji: "💬",
    href: "/chat",
    activeColor: "text-white",
    bgActive:
      "bg-zinc-700/60 border-zinc-500/80 text-zinc-100 shadow-sm",
  },
  {
    id: "builder",
    label: "Builder",
    emoji: "🔨",
    href: "/",
    activeColor: "text-white",
    bgActive:
      "bg-[#FF6700]/20 border-[#FF6700]/80 text-orange-100 shadow-[0_0_14px_rgba(255,103,0,0.25)]",
  },
];


export function Header() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  // Air-gap mode
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const toggleAirGap = useAirGapStore((s) => s.toggleAirGap);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync theme to <html> class so Tailwind dark: variants apply
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const getActiveMode = (): NavMode => {
    if (pathname === "/chat") return "chat";
    return "builder";
  };

  const activeMode = getActiveMode();

  // Placeholder during hydration
  if (!mounted) {
    return (
      <div className="flex flex-col border-b border-border">
        {/* Title Row */}
        <div className="h-14 flex items-center justify-center bg-gradient-to-r from-slate-100 via-indigo-50 to-slate-100 dark:from-zinc-900 dark:via-indigo-950/20 dark:to-zinc-900">
          <div className="flex items-center gap-2.5">
            <span className="text-base sm:text-lg font-semibold tracking-wide text-slate-700 dark:text-slate-300">
              The Foundry
            </span>
          </div>
        </div>
        {/* Nav Row */}
        <div className="h-11 bg-zinc-100 dark:bg-zinc-900/50 flex items-center px-4" />
      </div>
    );
  }

  return (
    <>
      {/* Air-Gap Banner */}
      {airGapEnabled && (
        <div
          className="text-white px-4 py-2 flex items-center justify-center gap-4 shadow-lg border-b-2 bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 border-amber-700/50 animate-pulse-slow"
        >
          <Plane className="h-5 w-5 rotate-45" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
            <span className="font-black tracking-widest text-sm uppercase drop-shadow-sm">
              AIR-GAP MODE
            </span>
            <span className="text-white/80 text-xs font-medium hidden sm:inline">
              All cloud APIs blocked &bull; Fully isolated &bull; Local models only
            </span>
          </div>
          <Plane className="h-5 w-5 -rotate-45 scale-x-[-1]" />
        </div>
      )}

      <div className="flex flex-col border-b border-border">
        {/* Row 1: Main Title - Centered */}
        <div className="h-14 flex items-center justify-center bg-gradient-to-r from-slate-100 via-orange-50/50 to-slate-100 dark:from-[#0a0a0a] dark:via-[#141414] dark:to-[#0a0a0a] relative border-b border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2.5 relative z-10">
            {/* Foundry icon */}
            <div className="relative">
              <Hammer className="h-6 w-6 text-[#FF6700] drop-shadow-[0_0_6px_rgba(255,103,0,0.5)]" />
              <Flame className="h-2.5 w-2.5 text-amber-400 absolute -right-0.5 -bottom-0.5 drop-shadow-[0_0_4px_rgba(251,191,36,0.9)]" />
            </div>

            {/* The Foundry — brand identity (orange→gold gradient) */}
            <h1 className="text-base sm:text-lg md:text-xl font-semibold tracking-wide">
              <span className="font-[900] text-2xl sm:text-3xl md:text-4xl tracking-wider bg-gradient-to-r from-[#FF6700] via-[#FF8C00] to-[#FFD700] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,103,0,0.5)]">
                The Foundry
              </span>
            </h1>
          </div>
        </div>

        {/* Row 2: Navigation centered + status icons right */}
        <div className="h-12 bg-zinc-100 dark:bg-[#0a0a0a] flex items-center px-4 border-t border-zinc-200/50 dark:border-zinc-800/50 relative">

          {/* Center: Chat | Builder nav */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeMode === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg text-base font-black tracking-wide transition-all duration-200 border-2",
                    isActive
                      ? `${item.bgActive} ${item.activeColor}`
                      : "border-transparent text-zinc-300 dark:text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100"
                  )}
                >
                  <span className="text-lg leading-none">{item.emoji}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Spacer pushes right-side icons to the right */}
          <div className="flex-1" />

          {/* Right side: Status + Air-Gap + Theme + Settings */}
          <div className="flex items-center gap-2">
            {/* Air-Gap Toggle Button - Airplane Mode Style */}
            <button
              onClick={toggleAirGap}
              title={
                airGapEnabled
                  ? "Disable Air-Gap Mode (allow cloud)"
                  : "Enable Air-Gap Mode (block all cloud APIs)"
              }
              className={cn(
                "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 border",
                airGapEnabled
                  ? "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border-amber-400/60 text-amber-300 hover:from-amber-500/40 hover:to-orange-500/40 ring-1 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : "bg-zinc-800/60 border-zinc-600/50 text-zinc-400 hover:bg-zinc-700/70 hover:text-zinc-200"
              )}
            >
              {airGapEnabled ? (
                <>
                  <Plane className="h-4 w-4 rotate-45 transition-transform group-hover:rotate-[60deg]" />
                  <span className="hidden sm:inline tracking-wide">
                    ISOLATED
                  </span>
                  <Shield className="h-3 w-3 opacity-70" />
                </>
              ) : (
                <Radio className="h-4 w-4 transition-transform group-hover:scale-110" />
              )}
            </button>

            {/* Separator */}
            <div className="h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* P6: Billing — bold icon + tooltip */}
            <button
              onClick={() => launchBillingPopout()}
              title="Billing & Usage"
              className="flex items-center justify-center h-9 w-9 rounded-md transition-all duration-200 bg-zinc-800/60 border border-zinc-600/50 text-zinc-300 hover:bg-[#FF6700]/20 hover:text-[#FF6700] hover:border-[#FF6700]/50"
            >
              <DollarSign className="h-5 w-5" />
            </button>

            {/* P6: Theme Toggle — bold icon + tooltip */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-md transition-all duration-200 bg-zinc-800/60 border border-zinc-600/50 hover:bg-zinc-700/70"
              title={theme === "dark" ? "Toggle Theme — Light Mode" : "Toggle Theme — Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-5 w-5 text-indigo-500 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* P6: Settings — bold icon + tooltip */}
            <Link
              href="/settings"
              title="Settings"
              className="flex items-center justify-center h-9 w-9 rounded-md transition-all duration-200 bg-zinc-800/60 border border-zinc-600/50 text-zinc-300 hover:bg-zinc-700/70 hover:text-white"
            >
              <Settings className="h-5 w-5 transition-transform hover:rotate-90 duration-300" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
