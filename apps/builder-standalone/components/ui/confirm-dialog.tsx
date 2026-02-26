"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmText?: string; // Alias for confirmLabel
  cancelLabel?: string;
  variant?: "destructive" | "warning" | "default";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmText,
  cancelLabel = "Cancel",
  variant = "destructive",
  isLoading = false,
}: ConfirmDialogProps) {
  // Support both confirmLabel and confirmText (confirmText takes precedence)
  const finalConfirmLabel = confirmText || confirmLabel || "Confirm";
  if (!isOpen) return null;

  const iconColors = {
    destructive: "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400",
    warning: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
    default: "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
  };

  const buttonColors = {
    destructive: "bg-red-600 hover:bg-red-700 text-white",
    warning: "bg-amber-600 hover:bg-amber-700 text-white",
    default: "bg-blue-600 hover:bg-blue-700 text-white",
  };

  const Icon = variant === "destructive" ? Trash2 : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconColors[variant]}`}>
            <Icon className="h-6 w-6" />
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-center text-zinc-900 dark:text-zinc-100 mb-2">
            {title}
          </h2>

          {/* Description */}
          <p className="text-sm text-center text-zinc-600 dark:text-zinc-400 mb-6">
            {description}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              className={`flex-1 ${buttonColors[variant]}`}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                finalConfirmLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing confirm dialog state
import { useState, useCallback } from "react";

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "destructive" | "warning" | "default";
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirm = useCallback(
    (options: {
      title: string;
      description: string;
      confirmLabel?: string;
      variant?: "destructive" | "warning" | "default";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfig({
          ...options,
          onConfirm: () => resolve(true),
        });
        setIsOpen(true);
      });
    },
    []
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setConfig(null);
    setIsLoading(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!config) return;
    setIsLoading(true);
    try {
      await config.onConfirm();
    } finally {
      handleClose();
    }
  }, [config, handleClose]);

  const DialogComponent = config ? (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={config.title}
      description={config.description}
      confirmLabel={config.confirmLabel}
      variant={config.variant}
      isLoading={isLoading}
    />
  ) : null;

  return { confirm, DialogComponent };
}
