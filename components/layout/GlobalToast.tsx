"use client";

import { useUIStore, ToastNotification } from "@/lib/stores/uiStore";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import Link from "next/link";

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLORS = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
  warning: "bg-amber-500 text-white",
};

function ToastItem({ toast }: { toast: ToastNotification }) {
  const dismissToast = useUIStore((s) => s.dismissToast);
  const Icon = TOAST_ICONS[toast.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right-full fade-in duration-300 ${TOAST_COLORS[toast.type]}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{toast.message}</span>

      {toast.action && (
        toast.action.href ? (
          <Link
            href={toast.action.href}
            onClick={() => {
              toast.action?.onClick?.();
              dismissToast(toast.id);
            }}
            className="px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors"
          >
            {toast.action.label}
          </Link>
        ) : (
          <button
            onClick={() => {
              toast.action?.onClick?.();
              dismissToast(toast.id);
            }}
            className="px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors"
          >
            {toast.action.label}
          </button>
        )
      )}

      <button
        onClick={() => dismissToast(toast.id)}
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
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
