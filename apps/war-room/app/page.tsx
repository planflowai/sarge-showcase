"use client";

import { ShieldCheck, Zap, Monitor } from "lucide-react";

export default function WarRoom() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center justify-center bg-gradient-to-r from-zinc-900 via-indigo-950/20 to-zinc-900 border-b border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <ShieldCheck className="h-6 w-6 text-indigo-400 drop-shadow-sm" />
            <Zap className="h-2.5 w-2.5 text-amber-400 absolute -right-0.5 -bottom-0.5 drop-shadow-[0_0_3px_rgba(245,158,11,0.8)]" />
          </div>
          <h1 className="text-lg md:text-xl font-semibold tracking-wide">
            <span className="text-indigo-400 font-black text-2xl md:text-3xl">S</span>
            <span className="text-slate-300">.A.R.G.E. </span>
            <span className="text-red-400/80 font-bold text-sm md:text-base ml-2 tracking-widest uppercase">War Room</span>
          </h1>
        </div>
      </div>

      {/* Main content — placeholder */}
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-red-600/20 to-indigo-600/20 border border-zinc-800 flex items-center justify-center">
            <Monitor className="w-12 h-12 text-red-400/60" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">War Room</h2>
            <p className="text-zinc-500 text-lg">Monitor 4 Cockpit</p>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-zinc-600">
            <span className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900">localhost:3004</span>
            <span className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900">6-Monitor Layout</span>
            <span className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900">Scaffold Only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
