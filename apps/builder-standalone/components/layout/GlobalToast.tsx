"use client";

import { useUIStore } from "@sarge/core";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLORS = {
  success: "bg-[#FF6700] text-white",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
  warning: "bg-amber-500 text-white",
};

export function GlobalToast() {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${TOAST_COLORS[toast.type]}`}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
