"use client";

import { useNotificationStore, type NotificationType } from "@/lib/hooks/useNotification";
import { X } from "lucide-react";

const typeStyles: Record<NotificationType, string> = {
  success: "bg-green-500 text-white",
  error: "bg-red-500 text-white",
  warning: "bg-yellow-500 text-black",
  info: "bg-blue-500 text-white",
};

const typeEmojis: Record<NotificationType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function NotificationCenter() {
  const { notifications, remove } = useNotificationStore();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-3 rounded-lg shadow-lg flex justify-between items-center gap-3 animate-in fade-in slide-in-from-top-2 pointer-events-auto ${
            typeStyles[notification.type]
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">
              {typeEmojis[notification.type]}
            </span>
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => remove(notification.id)}
            className="flex-shrink-0 hover:opacity-75 transition-opacity"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
