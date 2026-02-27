/**
 * Workbench Popout Manager
 *
 * Opens builder popout windows on specific physical monitors.
 * Uses Window Management API for precise monitor targeting.
 * BroadcastChannel('sarge-workbench') for cross-window communication.
 *
 * Monitor layout:
 *   Mon 5 (top-L)  |  Mon 1 (top-C)  |  Mon 3 (top-R)
 *   Mon 6 (bot-L)  |  [Mon 4 = cmd]  |  Mon 2 (bot-R)
 */

const MONITOR_GRID: Record<number, [number, number]> = {
  5: [0, 0], 1: [0, 1], 3: [0, 2],
  6: [1, 0], 4: [1, 1], 2: [1, 2],
};

const openWindows: Map<number, Window> = new Map(); // slot → window
let gridScreens: ScreenDetailed[][] | null = null;
let channel: BroadcastChannel | null = null;

export const WORKBENCH_CHANNEL = "sarge-workbench";

function getChannel(): BroadcastChannel {
  if (!channel || channel.name !== WORKBENCH_CHANNEL) {
    channel = new BroadcastChannel(WORKBENCH_CHANNEL);
  }
  return channel;
}

export interface ScreenDetailed {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  label: string;
  isPrimary: boolean;
}

export type PermissionStatus = "granted" | "denied" | "prompt" | "unavailable";

export async function checkWindowManagement(): Promise<PermissionStatus> {
  if (!("getScreenDetails" in window)) return "unavailable";
  try {
    const status = await navigator.permissions.query({ name: "window-management" as PermissionName });
    if (status.state === "granted") prefetchScreens();
    return status.state as PermissionStatus;
  } catch {
    return "prompt";
  }
}

export async function prefetchScreens(): Promise<boolean> {
  try {
    const details = await (window as any).getScreenDetails();
    const screens = details.screens as ScreenDetailed[];
    const rowMap = new Map<number, ScreenDetailed[]>();
    for (const s of screens) {
      const key = Math.round(s.availTop / 100) * 100;
      if (!rowMap.has(key)) rowMap.set(key, []);
      rowMap.get(key)!.push(s);
    }
    const keys = [...rowMap.keys()].sort((a, b) => a - b);
    gridScreens = keys.map((k) => rowMap.get(k)!.sort((a, b) => a.availLeft - b.availLeft));
    return true;
  } catch {
    gridScreens = null;
    return false;
  }
}

function getScreenForMonitor(mon: number): ScreenDetailed | undefined {
  if (!gridScreens) return undefined;
  const pos = MONITOR_GRID[mon];
  if (!pos) return undefined;
  return gridScreens[pos[0]]?.[pos[1]];
}

function buildFeatures(screen: ScreenDetailed | undefined, idx: number): string {
  if (screen) {
    return `left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight},menubar=no,toolbar=no,location=no,status=no`;
  }
  return `left=${120 + idx * 60},top=${80 + idx * 40},width=1280,height=800,menubar=no,toolbar=no,location=no,status=no`;
}

function buildUrl(slot: number, monitor: number, provider: string, model: string): string {
  return `http://localhost:3101/?workbench=1&slot=${slot}&monitor=${monitor}&provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(model)}`;
}

export function launchWorkbenchSlot(
  slot: number,
  monitor: number,
  provider: string,
  model: string,
  fallbackIndex = 0
): boolean {
  const screen = getScreenForMonitor(monitor);
  const features = buildFeatures(screen, fallbackIndex);
  const win = window.open(buildUrl(slot, monitor, provider, model), `sarge-workbench-${slot}`, features);
  if (win && !win.closed) {
    openWindows.set(slot, win);
    return true;
  }
  return false;
}

export function recallWorkbenchSlot(slot: number): boolean {
  const win = openWindows.get(slot);
  if (win && !win.closed) {
    // Tell the popout to close gracefully first
    try {
      getChannel().postMessage({ type: "RECALL", slot });
    } catch { /* ok */ }
    setTimeout(() => {
      try { if (win && !win.closed) win.close(); } catch { /* ok */ }
    }, 200);
    openWindows.delete(slot);
    return true;
  }
  openWindows.delete(slot);
  return false;
}

export function recallAllWorkbench(): void {
  try { getChannel().postMessage({ type: "RECALL", slot: null }); } catch { /* ok */ }
  setTimeout(() => {
    for (const win of openWindows.values()) {
      try { if (win && !win.closed) win.close(); } catch { /* ok */ }
    }
    openWindows.clear();
  }, 300);
}

export function isWorkbenchSlotOpen(slot: number): boolean {
  const win = openWindows.get(slot);
  return !!win && !win.closed;
}

export function broadcastWorkbenchPrompt(prompt: string, targetSlot: number | null = null): void {
  getChannel().postMessage({ type: "PROMPT", slot: targetSlot, prompt });
}

export function sendWorkbenchConfig(slot: number, provider: string, model: string): void {
  getChannel().postMessage({ type: "CONFIG", slot, provider, model });
}

export function getWorkbenchOpenCount(): number {
  let n = 0;
  for (const [slot, win] of openWindows) {
    if (win && !win.closed) n++;
    else openWindows.delete(slot);
  }
  return n;
}
