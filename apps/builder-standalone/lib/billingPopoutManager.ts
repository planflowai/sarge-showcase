/**
 * Billing Popout Manager — opens billing dashboard in its own window.
 * Follows the same pattern as popoutManager.ts and workbenchPopoutManager.ts
 * but simpler: no BroadcastChannel needed (billing auto-refreshes every 10s).
 */

let billingWindow: Window | null = null;

export function launchBillingPopout(): boolean {
  // If already open, just focus it
  if (billingWindow && !billingWindow.closed) {
    billingWindow.focus();
    return true;
  }

  const w = 1400;
  const h = 900;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = screen as any;
  const left = Math.round((screen.availWidth - w) / 2) + (s.availLeft || 0);
  const top = Math.round((screen.availHeight - h) / 2) + (s.availTop || 0);

  const url = `${window.location.origin}/?billing=1`;
  const features = `left=${left},top=${top},width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`;

  billingWindow = window.open(url, "sarge-billing", features);
  // Fallback: if popup was blocked, open as a new tab
  if (!billingWindow || billingWindow.closed) {
    billingWindow = window.open(url, "_blank");
  }
  return !!billingWindow && !billingWindow.closed;
}

export function isBillingPopoutOpen(): boolean {
  return !!billingWindow && !billingWindow.closed;
}

export function closeBillingPopout(): void {
  if (billingWindow && !billingWindow.closed) {
    billingWindow.close();
  }
  billingWindow = null;
}
