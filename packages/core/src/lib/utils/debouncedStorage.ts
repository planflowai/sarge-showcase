// lib/utils/debouncedStorage.ts

import type { PersistStorage, StorageValue } from 'zustand/middleware';

interface DebouncedStorageOptions {
  debounceMs?: number;
  onError?: (error: Error) => void;
}

/**
 * Creates a debounced localStorage wrapper to reduce write frequency.
 * Prevents quota exceeded errors by batching writes.
 */
export function createDebouncedStorage(
  options: DebouncedStorageOptions = {}
): PersistStorage<unknown> {
  const { debounceMs = 1000, onError } = options;
  const timers = new Map<string, NodeJS.Timeout>();

  return {
    getItem: (key: string): StorageValue<unknown> | null => {
      if (typeof window === "undefined") return null;
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        onError?.(error as Error);
        return null;
      }
    },
    setItem: (key: string, value: StorageValue<unknown>) => {
      if (typeof window === "undefined") return;
      // Clear existing timer for this key
      if (timers.has(key)) {
        clearTimeout(timers.get(key)!);
      }

      // Set new debounced timer
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          timers.delete(key);
        } catch (error) {
          onError?.(error as Error);
          timers.delete(key);
        }
      }, debounceMs);

      timers.set(key, timer);
    },
    removeItem: (key: string) => {
      if (typeof window === "undefined") return;
      if (timers.has(key)) {
        clearTimeout(timers.get(key)!);
        timers.delete(key);
      }
      try {
        localStorage.removeItem(key);
      } catch (error) {
        onError?.(error as Error);
      }
    },
  };
}
