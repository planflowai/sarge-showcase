"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@sarge/core";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLORS = {
  success: "bg-[#FF6700] text-white shadow-[#FF6700]/30",
  error: "bg-red-600 text-white shadow-red-600/30",
  info: "bg-blue-600 text-white shadow-blue-600/30",
  warning: "bg-amber-500 text-white shadow-amber-500/30",
};

function ToastItem({ id, message, type }: { id: string; message: string; type: "success" | "error" | "info" | "warning" }) {
  const dismissToast = useUIStore((s) => s.dismissToast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const Icon = TOAST_ICONS[type];

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border border-white/10 transition-all duration-300 ${TOAST_COLORS[type]} ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-semibold flex-1">{message}</span>
      <button
        onClick={() => dismissToast(id)}
        className="p-1 rounded hover:bg-white/20 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function GlobalToast() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-lg pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} type={toast.type} />
      ))}
    </div>
  );
}
