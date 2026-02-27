"use client";

import {
  Moon,
  Sun,
  Settings,
  XCircle,
  Flame,
  Shield,
  ShieldOff,
  Plane,
  Radio,
  Activity,
  Hammer,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  useSettingsStore,
  useAirGapStore,
} from "@sarge/core";
import { useWarRoomStore } from "@/lib/stores/warRoomStore";
import { useWorkbenchStore } from "@/lib/stores/workbenchStore";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    id: "builder",
    label: "Builder",
    emoji: "🔨",
    href: "/",
    activeColor: "text-black dark:text-white",
    bgActive:
      "bg-purple-100 dark:bg-purple-900/50 border-purple-400 dark:border-purple-500",
  },
  {
    id: "chat",
    label: "Chat",
    emoji: "💬",
    href: "/chat",
    activeColor: "text-black dark:text-white",
    bgActive:
      "bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-500",
  },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  // Workbench (War Room — chat standalone)
  const warRoomEnabled = useWarRoomStore((s) => s.enabled);
  const setWarRoomEnabled = useWarRoomStore((s) => s.setEnabled);

  // Workbench (Builder Command Center)
  const workbenchActive = useWorkbenchStore((s) => s.active);
  const setWorkbenchActive = useWorkbenchStore((s) => s.setActive);

  // Air-gap mode
  const airGapEnabled = useAirGapStore((s) => s.airGapEnabled);
  const toggleAirGap = useAirGapStore((s) => s.toggleAirGap);

  // Secure mode (cybersecurity)
  const secureMode = useAirGapStore((s) => s.secureMode);
  const toggleSecureMode = useAirGapStore((s) => s.toggleSecureMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check API connectivity via proxy
  useEffect(() => {
    fetch("/api/status")
      .then((r) => {
        setApiConnected(r.ok);
      })
      .catch(() => setApiConnected(false));
  }, []);

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
              S.A.R.G.E.
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
      {/* Security Banners - Show when Secure or Air-Gap modes are enabled */}
      {(secureMode || airGapEnabled) && (
        <div
          className={cn(
            "text-white px-4 py-2 flex items-center justify-center gap-4 shadow-lg border-b-2",
            secureMode && airGapEnabled
              ? "bg-gradient-to-r from-red-700 via-red-600 to-amber-600 border-red-800/50"
              : secureMode
              ? "bg-gradient-to-r from-red-700 via-red-600 to-red-700 border-red-800/50"
              : "bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 border-amber-700/50 animate-pulse-slow"
          )}
        >
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
                : "✈️ AIR-GAP MODE"}
            </span>
            <span className="text-white/80 text-xs font-medium hidden sm:inline">
              {secureMode && airGapEnabled
                ? "All threats blocked • Fully isolated • Local only • FIPS sanitization active"
                : secureMode
                ? "Input/output sanitization • Threat detection • Code injection blocked"
                : "All cloud APIs blocked • Fully isolated • Local models only"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {airGapEnabled && (
              <Plane className="h-5 w-5 -rotate-45 scale-x-[-1]" />
            )}
            {secureMode && <Shield className="h-5 w-5" />}
          </div>
        </div>
      )}

      <div className="flex flex-col border-b border-border">
        {/* Row 1: Main Title - Centered */}
        <div className="h-14 flex items-center justify-center bg-gradient-to-r from-slate-100 via-indigo-50 to-slate-100 dark:from-zinc-900 dark:via-indigo-950/20 dark:to-zinc-900 relative border-b border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2.5 relative z-10">
            {/* Builder icon */}
            <div className="relative">
              <Hammer className="h-6 w-6 text-purple-600 dark:text-purple-400 drop-shadow-sm" />
              <Flame className="h-2.5 w-2.5 text-orange-400 dark:text-orange-300 absolute -right-0.5 -bottom-0.5 drop-shadow-[0_0_4px_rgba(251,146,60,0.9)]" />
            </div>

            {/* S.A.R.G.E. Forge — premium builder identity */}
            <h1 className="text-base sm:text-lg md:text-xl font-semibold tracking-wide">
              <span className="text-purple-700 dark:text-purple-400 font-black text-xl sm:text-2xl md:text-3xl tracking-wider">
                S.A.R.G.E.
              </span>
              <span className="text-purple-500 dark:text-purple-300 font-semibold text-base sm:text-lg md:text-xl ml-2 tracking-widest uppercase">
                Forge
              </span>
            </h1>
          </div>
        </div>

        {/* Row 2: Navigation centered + status icons right */}
        <div className="h-11 bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100 dark:from-zinc-900/80 dark:via-zinc-800/50 dark:to-zinc-900/80 flex items-center px-4 border-t border-zinc-200/50 dark:border-zinc-700/30 relative">

          {/* Center: Builder | Chat | Workbench */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeMode === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-all duration-200 border",
                    isActive
                      ? `${item.bgActive} ${item.activeColor} shadow-sm`
                      : "border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/60"
                  )}
                >
                  <span className="text-base leading-none">{item.emoji}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Workbench button — toggles builder command center */}
            <button
              tabIndex={-1}
              onClick={() => {
                if (pathname === "/") {
                  setWorkbenchActive(!workbenchActive);
                } else {
                  setWorkbenchActive(true);
                  router.push("/");
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-all duration-300 border",
                workbenchActive
                  ? "bg-purple-600/30 border-purple-500/60 text-purple-300 ring-1 ring-purple-500/40"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:bg-purple-500/10 hover:text-purple-300 hover:border-purple-500/30"
              )}
              title={workbenchActive ? "Close Workbench" : "Open 5-Monitor Workbench"}
            >
              <Wrench className="h-4 w-4" />
              <span>Workbench</span>
            </button>
          </div>

          {/* Spacer pushes right-side icons to the right */}
          <div className="flex-1" />

          {/* Right side: Status + Air-Gap + Theme + Settings */}
          <div className="flex items-center gap-2">
            {/* Connection Status with pulse animation */}
            {apiConnected !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                  apiConnected
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30"
                )}
              >
                {apiConnected ? (
                  <>
                    <Activity className="h-3 w-3 animate-pulse" />
                    <span className="hidden sm:inline">Connected</span>
                  </>
                ) : (
                  <>
                    <Hammer className="h-3 w-3" />
                    <span className="hidden sm:inline">Local Mode</span>
                  </>
                )}
              </div>
            )}

            {/* Separator */}
            <div className="h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* SECURE Mode Button - Cybersecurity */}
            <button
              onClick={toggleSecureMode}
              title={
                secureMode
                  ? "Disable Secure Mode (standard operation)"
                  : "Enable Secure Mode (input/output sanitization, threat blocking)"
              }
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
                  <span className="hidden sm:inline tracking-widest">
                    SECURE
                  </span>
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
              title={
                airGapEnabled
                  ? "Disable Air-Gap Mode (allow cloud)"
                  : "Enable Air-Gap Mode (block all cloud APIs)"
              }
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
                  <span className="hidden sm:inline tracking-wide">
                    ISOLATED
                  </span>
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
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500 transition-transform hover:-rotate-12" />
              )}
            </Button>

            {/* Settings */}
            <Link href="/settings" title="Settings">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Settings className="h-4 w-4 transition-transform hover:rotate-90 duration-300" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
