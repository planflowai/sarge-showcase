/**
 * Workbench Popout Manager (builder-standalone)
 *
 * Uses the Window Management API (getScreenDetails) to open chat windows
 * on specific physical monitors. Falls back to basic window.open
 * if permission is denied.
 *
 * BroadcastChannel('sarge-warroom') sends prompts to all popout windows.
 */

// 6-monitor grid layout (by monitor number):
//   Mon 5 (top-L)  |  Mon 1 (top-C)  |  Mon 3 (top-R)
//   Mon 6 (bot-L)  |  Mon 4 (bot-C)  |  Mon 2 (bot-R)
const MONITOR_GRID_POSITION: Record<number, [number, number]> = {
  5: [0, 0],
  1: [0, 1],
  3: [0, 2],
  6: [1, 0],
  4: [1, 1],
  2: [1, 2],
};

// Track open windows by slot ID
const openWindows: Map<string, Window> = new Map();

// Cached screens sorted into grid positions
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

export async function checkWindowManagement(): Promise<PermissionStatus> {
  if (!("getScreenDetails" in window)) return "unavailable";
  try {
    const status = await navigator.permissions.query({
      name: "window-management" as PermissionName,
    });
    if (status.state === "granted") prefetchScreens();
    return status.state as PermissionStatus;
  } catch {
    return "prompt";
  }
}

export async function prefetchScreens(): Promise<boolean> {
  try {
    const screenDetails = await (window as any).getScreenDetails();
    const screens = screenDetails.screens as ScreenDetailed[];
    console.log(`[Workbench] Fetched ${screens.length} screens`);

    const rowMap = new Map<number, ScreenDetailed[]>();
    for (const s of screens) {
      const rowKey = Math.round(s.availTop / 100) * 100;
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
      rowMap.get(rowKey)!.push(s);
    }

    const sortedRowKeys = [...rowMap.keys()].sort((a, b) => a - b);
    gridScreens = sortedRowKeys.map((key) =>
      rowMap.get(key)!.sort((a, b) => a.availLeft - b.availLeft)
    );

    console.log(`[Workbench] Grid: ${gridScreens.map((r) => r.length).join("x")} rows`);
    return true;
  } catch (err) {
    console.warn("[Workbench] getScreenDetails failed:", err);
    gridScreens = null;
    return false;
  }
}

function getScreenForMonitor(monitorNumber: number): ScreenDetailed | undefined {
  if (!gridScreens) return undefined;
  const pos = MONITOR_GRID_POSITION[monitorNumber];
  if (!pos) return undefined;
  return gridScreens[pos[0]]?.[pos[1]];
}

function buildFeatures(screen: ScreenDetailed | undefined, fallbackIndex: number): string {
  if (screen) {
    return `left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight},menubar=no,toolbar=no,location=no,status=no`;
  }
  return `left=${100 + fallbackIndex * 50},top=${100 + fallbackIndex * 50},width=1200,height=800,menubar=no,toolbar=no,location=no,status=no`;
}

function buildUrl(slot: { id: string; provider: string; model: string }): string {
  return `http://localhost:3101/?warroom=1&slot=${slot.id}&provider=${slot.provider}&model=${encodeURIComponent(slot.model)}`;
}

export interface PopoutResult {
  success: boolean;
  opened: string[];
  failed: string[];
  error?: string;
}

/**
 * Launch popout windows for all active slots. Fully synchronous —
 * no awaits, preserves user gesture for popup blocker.
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

  for (let i = 0; i < activeSlots.length; i++) {
    const slot = activeSlots[i];
    const screen = getScreenForMonitor(slot.monitorNumber);
    const features = buildFeatures(screen, i);
    const win = window.open(buildUrl(slot), `sarge-warroom-${slot.id}`, features);

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
    error: failed.length > 0 ? `${failed.length} window(s) blocked` : undefined,
  };
}

/**
 * Launch a single slot's popout window (step-launch mode).
 */
export function launchSingleSlot(
  slot: { id: string; monitorNumber: number; provider: string; model: string },
  fallbackIndex: number = 0
): boolean {
  const screen = getScreenForMonitor(slot.monitorNumber);
  const features = buildFeatures(screen, fallbackIndex);
  const win = window.open(buildUrl(slot), `sarge-warroom-${slot.id}`, features);

  if (win && !win.closed) {
    openWindows.set(slot.id, win);
    return true;
  }
  return false;
}

/**
 * Re-launch a single slot that was previously recalled ("Send Out").
 */
export function relaunchSlot(
  slot: { id: string; monitorNumber: number; provider: string; model: string }
): boolean {
  return launchSingleSlot(slot, 0);
}

/**
 * Recall (close) a single specific slot's popout window.
 */
export function recallSlot(slotId: string): boolean {
  const win = openWindows.get(slotId);
  if (win && !win.closed) {
    try { win.close(); } catch { /* cross-origin */ }
    openWindows.delete(slotId);
    return true;
  }
  openWindows.delete(slotId);
  return false;
}

/**
 * Close all open popout windows.
 */
export function recallAllPopouts(): number {
  let closed = 0;
  for (const [slotId, win] of openWindows) {
    try {
      if (win && !win.closed) { win.close(); closed++; }
    } catch { /* cross-origin */ }
    openWindows.delete(slotId);
  }
  try { getChannel().postMessage({ type: "RECALL" }); } catch { /* channel closed */ }
  return closed;
}

export function getUnopenedSlotIds(
  slots: Array<{ id: string; enabled: boolean }>
): string[] {
  return slots.filter((s) => s.enabled && !isSlotOpen(s.id)).map((s) => s.id);
}

export function broadcastPrompt(prompt: string, targetSlotId?: string): void {
  getChannel().postMessage({
    type: "PROMPT",
    payload: { text: prompt, target: targetSlotId ?? null, timestamp: Date.now() },
  });
}

export function getOpenWindowCount(): number {
  let count = 0;
  for (const [slotId, win] of openWindows) {
    if (win && !win.closed) count++;
    else openWindows.delete(slotId);
  }
  return count;
}

export function isSlotOpen(slotId: string): boolean {
  const win = openWindows.get(slotId);
  return !!win && !win.closed;
}

// Type declarations for Window Management API
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
