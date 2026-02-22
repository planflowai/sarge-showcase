"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle, AlertCircle, Info, TrendingDown, UserMinus } from "lucide-react";
import { useJuryGuardianStore } from "@/lib/stores/juryGuardianStore";
import { cn } from "@/lib/utils";
import type { JuryToastData, JuryToastType } from "@/lib/types/juryGuardian";

// Toast colors and icons by type
const toastConfig: Record<
  JuryToastType,
  { borderColor: string; bgColor: string; icon: React.ReactNode; iconColor: string }
> = {
  echo: {
    borderColor: "border-l-yellow-500",
    bgColor: "bg-yellow-950/90",
    icon: <AlertTriangle className="h-4 w-4" />,
    iconColor: "text-yellow-400",
  },
  contradiction: {
    borderColor: "border-l-red-500",
    bgColor: "bg-red-950/90",
    icon: <AlertCircle className="h-4 w-4" />,
    iconColor: "text-red-400",
  },
  drift: {
    borderColor: "border-l-orange-500",
    bgColor: "bg-orange-950/90",
    icon: <TrendingDown className="h-4 w-4" />,
    iconColor: "text-orange-400",
  },
  info: {
    borderColor: "border-l-blue-500",
    bgColor: "bg-blue-950/90",
    icon: <Info className="h-4 w-4" />,
    iconColor: "text-blue-400",
  },
  strike: {
    borderColor: "border-l-purple-500",
    bgColor: "bg-purple-950/90",
    icon: <UserMinus className="h-4 w-4" />,
    iconColor: "text-purple-400",
  },
  killed: {
    borderColor: "border-l-red-600",
    bgColor: "bg-red-950/95",
    icon: <AlertTriangle className="h-4 w-4" />,
    iconColor: "text-red-500",
  },
};

interface SingleToastProps {
  toast: JuryToastData;
  onDismiss: (id: string) => void;
  onAction: (toast: JuryToastData, action: string) => void;
}

function SingleToast({ toast, onDismiss, onAction }: SingleToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const config = toastConfig[toast.type];

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 8000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300",
        config.borderColor,
        config.bgColor,
        isExiting ? "opacity-0 translate-y-[-20px]" : "opacity-100 translate-y-0"
      )}
      style={{ minWidth: "320px", maxWidth: "420px" }}
    >
      {/* Icon */}
      <div className={cn("flex-shrink-0 mt-0.5", config.iconColor)}>{config.icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{toast.title}</p>
        <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2">{toast.message}</p>

        {/* Actions */}
        {toast.actions && toast.actions.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            {toast.actions.map((action) => (
              <button
                key={action.action}
                onClick={() => onAction(toast, action.action)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                  action.action === "dismiss"
                    ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                    : action.action === "swap"
                    ? "bg-purple-600 hover:bg-purple-500 text-white"
                    : action.action === "inject"
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-zinc-600 hover:bg-zinc-500 text-white"
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function JuryToastContainer() {
  const { toasts, dismissToast, dismissAllToasts, setPanelOpen } = useJuryGuardianStore();

  // Only show max 3 visible toasts
  const visibleToasts = toasts.slice(-3);
  const queuedCount = Math.max(0, toasts.length - 3);

  const handleAction = (toast: JuryToastData, action: string) => {
    switch (action) {
      case "dismiss":
        dismissToast(toast.id);
        break;
      case "view":
        setPanelOpen(true);
        dismissToast(toast.id);
        break;
      case "swap":
        // Open panel to config tab for model swap
        setPanelOpen(true);
        dismissToast(toast.id);
        break;
      case "inject":
        // TODO: Implement correction injection
        dismissToast(toast.id);
        break;
    }
  };

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {/* Queued indicator */}
      {queuedCount > 0 && (
        <div className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-1 rounded-full">
          +{queuedCount} more alerts queued
        </div>
      )}

      {/* Toasts */}
      {visibleToasts.map((toast) => (
        <SingleToast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onAction={handleAction}
        />
      ))}

      {/* Dismiss All button */}
      {toasts.length > 1 && (
        <button
          onClick={dismissAllToasts}
          className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 px-3 py-1 rounded-full transition-colors"
        >
          Dismiss All
        </button>
      )}
    </div>
  );
}
