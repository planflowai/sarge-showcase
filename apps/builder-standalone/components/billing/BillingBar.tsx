"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DollarSign } from "lucide-react";

/** Format cost for display — inlined to avoid @sarge/billing barrel import (logger.ts crashes client) */
function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.005) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export default function BillingBar() {
  const [sessionCost, setSessionCost] = useState(0);
  const [sessionCalls, setSessionCalls] = useState(0);
  const [todayCost, setTodayCost] = useState(0);
  const [lastModel, setLastModel] = useState("");
  const [lastCost, setLastCost] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [sessRes, statsRes] = await Promise.all([
        fetch("/api/billing/session"),
        fetch("/api/billing/stats?period=day"),
      ]);
      const sessData = await sessRes.json();
      const statsData = await statsRes.json();

      if (sessData.session) {
        setSessionCost(sessData.session.totalCost || 0);
        setSessionCalls(sessData.session.callCount || 0);
      }
      setTodayCost(statsData.totalCost || 0);

      if (statsData.entries?.length > 0) {
        const last = statsData.entries[statsData.entries.length - 1];
        setLastModel(last.model);
        setLastCost(last.cost);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 10_000);
    return () => clearInterval(iv);
  }, [refresh]);

  return (
    <div className="flex-shrink-0 h-9 flex items-center justify-between px-4 border-t border-zinc-800 dark:border-zinc-800 bg-[#0f0f12] dark:bg-[#0f0f12] text-sm select-none">
      <div className="flex items-center gap-5">
        {lastModel && (
          <span className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-bold">Last:</span>
            <span className="text-[#FF6700] font-bold">{lastModel}</span>
            <span className="font-mono text-[#F5F5F5] font-bold">{formatCost(lastCost)}</span>
          </span>
        )}
        <span className="text-zinc-700 dark:text-zinc-700">|</span>
        <span className="flex items-center gap-1.5">
          <span className="text-zinc-500 font-bold">Session:</span>
          <span className="font-mono text-[#F5F5F5] font-bold">{formatCost(sessionCost)}</span>
          {sessionCalls > 0 && (
            <span className="text-zinc-600 text-xs">({sessionCalls})</span>
          )}
        </span>
        <span className="text-zinc-700 dark:text-zinc-700">|</span>
        <span className="flex items-center gap-1.5">
          <span className="text-zinc-500 font-bold">Today:</span>
          <span className="font-mono text-[#F5F5F5] font-bold">{formatCost(todayCost)}</span>
        </span>
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("forge:billing"))}
        className="flex items-center gap-1.5 px-3 py-1 bg-[#FF6700]/10 hover:bg-[#FF6700]/20 text-[#FF6700] rounded text-xs font-bold border border-[#FF6700]/30 transition-colors duration-200"
      >
        <DollarSign className="w-3.5 h-3.5" />
        Dashboard
      </button>
    </div>
  );
}
