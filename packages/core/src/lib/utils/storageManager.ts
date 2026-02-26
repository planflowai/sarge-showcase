/**
 * Storage Manager
 *
 * Utilities for inspecting, clearing, exporting, and importing
 * all localStorage data used by the app.
 */

export interface StorageStats {
  /** Total bytes used across all keys (estimated via JSON string length). */
  totalBytes: number;
  /** Human-readable size string, e.g. "1.2 MB". */
  totalFormatted: string;
  /** Number of localStorage keys owned by the app. */
  keyCount: number;
  /** Per-key breakdown, sorted largest first. */
  keys: Array<{ key: string; bytes: number; formatted: string }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Read all localStorage keys and compute size statistics. */
export function getStorageStats(): StorageStats {
  if (typeof window === 'undefined') {
    return { totalBytes: 0, totalFormatted: '0 B', keyCount: 0, keys: [] };
  }

  const keys: StorageStats['keys'] = [];
  let total = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? '';
    // Estimate: key + value byte length (UTF-16 in JS engine, approximated as chars)
    const bytes = (key.length + value.length) * 2;
    total += bytes;
    keys.push({ key, bytes, formatted: formatBytes(bytes) });
  }

  keys.sort((a, b) => b.bytes - a.bytes);

  return {
    totalBytes: total,
    totalFormatted: formatBytes(total),
    keyCount: keys.length,
    keys,
  };
}

/** Remove all localStorage keys. Returns the number of keys cleared. */
export function clearAllStorage(): number {
  if (typeof window === 'undefined') return 0;
  const count = localStorage.length;
  localStorage.clear();
  return count;
}

/** Remove a single localStorage key by name. */
export function clearStorageKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

/** Export all localStorage data as a JSON blob (download helper). */
export function exportAllStorage(): string {
  if (typeof window === 'undefined') return '{}';

  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const raw = localStorage.getItem(key);
    try {
      data[key] = raw !== null ? JSON.parse(raw) : null;
    } catch {
      data[key] = raw; // Keep as string if not valid JSON
    }
  }
  return JSON.stringify(data, null, 2);
}

/** Trigger a browser download of the exported JSON. */
export function downloadStorageExport(filename = 'sarge-storage-export.json'): void {
  const json = exportAllStorage();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import localStorage data from a previously exported JSON string.
 * @param json - The JSON string returned by exportAllStorage / downloadStorageExport.
 * @param merge - If true, merges with existing data. If false (default), clears first.
 * @returns Number of keys imported.
 */
export function importAllStorage(json: string, merge = false): number {
  if (typeof window === 'undefined') return 0;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON export file');
  }

  if (!merge) {
    localStorage.clear();
  }

  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      count++;
    } catch {
      console.warn(`[storageManager] Could not import key: ${key}`);
    }
  }
  return count;
}
