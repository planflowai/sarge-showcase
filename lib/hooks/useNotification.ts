// lib/hooks/useNotification.ts

import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationStore {
  notifications: Notification[];
  add: (notification: Omit<Notification, 'id'>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  add: (notification) => {
    const id = crypto.randomUUID();
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));

    // Auto-remove after duration
    if (notification.duration !== Infinity) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notification.duration || 3000);
    }
  },
  remove: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  clear: () => set({ notifications: [] }),
}));

// Hook for easy usage in components
export function useNotification() {
  const { add } = useNotificationStore();

  return {
    success: (message: string, duration?: number) =>
      add({ type: 'success', message, duration }),
    error: (message: string, duration?: number) =>
      add({ type: 'error', message, duration }),
    warning: (message: string, duration?: number) =>
      add({ type: 'warning', message, duration }),
    info: (message: string, duration?: number) =>
      add({ type: 'info', message, duration }),
  };
}
