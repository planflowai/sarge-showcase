/**
 * War Room Popout Manager
 *
 * Uses the Window Management API (getScreenDetails) to open chat-standalone
 * windows on specific physical monitors. Falls back to basic window.open
 * if permission is denied.
 *
 * BroadcastChannel('sarge-warroom') sends prompts to all popout windows.
 */

// 6-monitor grid layout (by monitor number):
//   Mon 5 (top-L)  |  Mon 1 (top-C)  |  Mon 3 (top-R)
//   Mon 6 (bot-L)  |  Mon 4 (bot-C)  |  Mon 2 (bot-R)
//
// Grid positions: [row, col] — used to match against physical screen coordinates
const MONITOR_GRID_POSITION: Record<number, [number, number]> = {
  5: [0, 0],  // top-left
  1: [0, 1],  // top-center
  3: [0, 2],  // top-right
  6: [1, 0],  // bottom-left
  4: [1, 1],  // bottom-center
  2: [1, 2],  // bottom-right
};

// Track open windows by slot ID
const openWindows: Map<string, Window> = new Map();

// Cached screens sorted into grid positions — built from physical coordinates
// gridScreens[row][col] = ScreenDetailed
let gridScreens: ScreenDetailed[][] | null = null;

// BroadcastChannel for cross-window communication
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel("sarge-warroom");
  }
  return channel;
}

export type PermissionStatus = "granted" | "denied" | "prompt" | "unavailable";

/**
 * Check if Window Management API is available and get permission status.
 * Also pre-caches screen details when permission is granted.
 */
export async function checkWindowManagement(): Promise<PermissionStatus> {
  // Check if API exists
  if (!("getScreenDetails" in window)) {
    return "unavailable";
  }

  // Check permission status via Permissions API
  try {
    const status = await navigator.permissions.query({
      name: "window-management" as PermissionName,
    });

    // Pre-cache screens if already granted
    if (status.state === "granted") {
      prefetchScreens();
    }

    return status.state as PermissionStatus;
  } catch {
    // Permissions query may fail — try requesting directly
    return "prompt";
  }
}

/**
 * Pre-fetch and cache screen details, sorting them into a 2D grid by
 * physical coordinates (availTop for rows, availLeft for columns).
 *
 * Call this BEFORE the click handler so that launchPopouts() can be
 * fully synchronous (no awaits = no gesture loss).
 */
export async function prefetchScreens(): Promise<boolean> {
  try {
    const screenDetails = await (window as any).getScreenDetails();
    const screens = screenDetails.screens as ScreenDetailed[];
    console.log(`[WarRoom] Fetched ${screens.length} screens`);

    // Group screens into rows by availTop (screens at similar Y = same row)
    const rowMap = new Map<number, ScreenDetailed[]>();
    for (const s of screens) {
      // Round availTop to nearest 100 to group screens in the same row
      // (monitors in the same row may differ by a few pixels)
      const rowKey = Math.round(s.availTop / 100) * 100;
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
      rowMap.get(rowKey)!.push(s);
    }

    // Sort rows top-to-bottom, then screens left-to-right within each row
    const sortedRowKeys = [...rowMap.keys()].sort((a, b) => a - b);
    gridScreens = sortedRowKeys.map((key) =>
      rowMap.get(key)!.sort((a, b) => a.availLeft - b.availLeft)
    );

    console.log(`[WarRoom] Grid: ${gridScreens.map((r) => r.length).join("x")} rows`);
    for (let r = 0; r < gridScreens.length; r++) {
      for (let c = 0; c < gridScreens[r].length; c++) {
        const s = gridScreens[r][c];
        console.log(`[WarRoom]   [${r},${c}] ${s.label || "?"} — ${s.availLeft},${s.availTop} ${s.availWidth}x${s.availHeight}`);
      }
    }

    return true;
  } catch (err) {
    console.warn("[WarRoom] getScreenDetails failed:", err);
    gridScreens = null;
    return false;
  }
}

/**
 * Get the screen for a given monitor number using the grid position map.
 */
function getScreenForMonitor(monitorNumber: number): ScreenDetailed | undefined {
  if (!gridScreens) return undefined;
  const pos = MONITOR_GRID_POSITION[monitorNumber];
  if (!pos) return undefined;
  const [row, col] = pos;
  return gridScreens[row]?.[col];
}

export interface PopoutResult {
  success: boolean;
  opened: string[];   // slot IDs that were opened
  failed: string[];   // slot IDs that failed
  error?: string;
}

/**
 * Launch popout windows for all active slots on their assigned monitors.
 * Each popout opens chat-standalone at localhost:3100.
 *
 * IMPORTANT: This function is fully SYNCHRONOUS — no awaits, no promises.
 * All window.open() calls happen in the same synchronous call stack as the
 * user's click event, so the browser treats them all as user-initiated.
 *
 * Call prefetchScreens() ahead of time (on mount or permission grant) so
 * screen coordinates are already cached.
 */
export function launchPopouts(
  slots: Array<{ id: string; monitorNumber: number; enabled: boolean; provider: string; model: string }>
): PopoutResult {
  const activeSlots = slots.filter((s) => s.enabled);
  if (activeSlots.length === 0) {
    return { success: false, opened: [], failed: [], error: "No active slots" };
  }

  const opened: string[] = [];
  const failed: string[] = [];

  // Open ALL windows synchronously in one burst — preserves user gesture
  for (let i = 0; i < activeSlots.length; i++) {
    const slot = activeSlots[i];
    const screen = getScreenForMonitor(slot.monitorNumber);

    let features: string;
    const windowName = `sarge-warroom-${slot.id}`;

    if (screen) {
      // Use exact screen coordinates for fullscreen placement
      features = [
        `left=${screen.availLeft}`,
        `top=${screen.availTop}`,
        `width=${screen.availWidth}`,
        `height=${screen.availHeight}`,
        `menubar=no`,
        `toolbar=no`,
        `location=no`,
        `status=no`,
      ].join(",");
    } else {
      // Fallback: cascade windows with offset
      features = [
        `left=${100 + i * 50}`,
        `top=${100 + i * 50}`,
        `width=1200`,
        `height=800`,
        `menubar=no`,
        `toolbar=no`,
        `location=no`,
        `status=no`,
      ].join(",");
    }

    // Open chat-standalone on the target monitor
    const url = `http://localhost:3100/?warroom=1&slot=${slot.id}&provider=${slot.provider}&model=${encodeURIComponent(slot.model)}`;
    const win = window.open(url, windowName, features);

    if (win && !win.closed) {
      openWindows.set(slot.id, win);
      opened.push(slot.id);
    } else {
      failed.push(slot.id);
    }
  }

  return {
    success: opened.length > 0,
    opened,
    failed,
    error: failed.length > 0
      ? `${failed.length} window(s) blocked by popup blocker`
      : undefined,
  };
}

/**
 * Launch a SINGLE slot's popout window. Used for step-launch mode where
 * each user click opens one window (always succeeds — 1 popup per gesture is allowed).
 * Returns true if the window opened successfully.
 */
export function launchSingleSlot(
  slot: { id: string; monitorNumber: number; provider: string; model: string },
  fallbackIndex: number = 0
): boolean {
  const screen = getScreenForMonitor(slot.monitorNumber);

  let features: string;
  const windowName = `sarge-warroom-${slot.id}`;

  if (screen) {
    features = [
      `left=${screen.availLeft}`,
      `top=${screen.availTop}`,
      `width=${screen.availWidth}`,
      `height=${screen.availHeight}`,
      `menubar=no`,
      `toolbar=no`,
      `location=no`,
      `status=no`,
    ].join(",");
  } else {
    features = [
      `left=${100 + fallbackIndex * 50}`,
      `top=${100 + fallbackIndex * 50}`,
      `width=1200`,
      `height=800`,
      `menubar=no`,
      `toolbar=no`,
      `location=no`,
      `status=no`,
    ].join(",");
  }

  const url = `http://localhost:3100/?warroom=1&slot=${slot.id}&provider=${slot.provider}&model=${encodeURIComponent(slot.model)}`;
  const win = window.open(url, windowName, features);

  if (win && !win.closed) {
    openWindows.set(slot.id, win);
    return true;
  }
  return false;
}

/**
 * Get the list of slot IDs that do NOT have an open window yet.
 */
export function getUnopenedSlotIds(
  slots: Array<{ id: string; enabled: boolean }>
): string[] {
  return slots
    .filter((s) => s.enabled && !isSlotOpen(s.id))
    .map((s) => s.id);
}

/**
 * Close all open popout windows and clean up.
 */
export function recallAllPopouts(): number {
  let closed = 0;
  for (const [slotId, win] of openWindows) {
    try {
      if (win && !win.closed) {
        win.close();
        closed++;
      }
    } catch {
      // Cross-origin or already closed — ignore
    }
    openWindows.delete(slotId);
  }
  // Notify any remaining windows to self-close
  try {
    getChannel().postMessage({ type: "RECALL" });
  } catch {
    // Channel may be closed
  }
  return closed;
}

/**
 * Broadcast a prompt to all open popout windows.
 */
export function broadcastPrompt(prompt: string, targetSlotId?: string): void {
  const ch = getChannel();
  ch.postMessage({
    type: "PROMPT",
    payload: {
      text: prompt,
      target: targetSlotId ?? null, // null = broadcast to all
      timestamp: Date.now(),
    },
  });
}

/**
 * Get the count of currently open (not closed) windows.
 */
export function getOpenWindowCount(): number {
  let count = 0;
  for (const [slotId, win] of openWindows) {
    if (win && !win.closed) {
      count++;
    } else {
      openWindows.delete(slotId);
    }
  }
  return count;
}

/**
 * Check if a specific slot has an open window.
 */
export function isSlotOpen(slotId: string): boolean {
  const win = openWindows.get(slotId);
  return !!win && !win.closed;
}

// Type declarations for the Window Management API
interface ScreenDetailed {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  width: number;
  height: number;
  label: string;
  isPrimary: boolean;
  isInternal: boolean;
}
