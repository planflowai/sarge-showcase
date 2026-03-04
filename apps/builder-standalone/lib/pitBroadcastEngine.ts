/**
 * Pit Broadcast Engine — parallel streaming to all selected monitors
 *
 * For each selected slot, fires a streaming request to /api/test/stream,
 * extracts HTML code, and updates the workbench store in real-time.
 * Also writes generated code to fork folders on completion.
 */

import { useWorkbenchStore, type WorkbenchSlot } from "./stores/workbenchStore";
import { broadcastWorkbenchPrompt, WORKBENCH_CHANNEL } from "./workbenchPopoutManager";

// ─── System prompt for Pit builds ─────────────────────────────────────────────

const PIT_SYSTEM_PROMPT = `You are a web developer inside The Foundry's Pit — a multi-model code arena.

RULES:
- ALWAYS generate a complete, self-contained single HTML file.
- Include ALL CSS inside <style> tags. Include ALL JavaScript inside <script> tags.
- NEVER reference external files like ./main.js or ./style.css.
- Use Tailwind CSS via CDN when helpful: <script src="https://cdn.tailwindcss.com"></script>
- Start with a brief explanation (1-2 sentences) of what you built.
- Then provide the COMPLETE code in a single \`\`\`html code block.
- Make it visually impressive and polished.
- Be concise. No lengthy explanations.`;

// ─── HTML extraction (same logic as WorkbenchPopout) ──────────────────────────

function extractHtml(text: string): string {
  const htmlMatch = text.match(/```html\s*([\s\S]*?)```/i);
  if (htmlMatch) return htmlMatch[1].trim();
  const genericMatch = text.match(/```\s*(<!DOCTYPE[\s\S]*?|<html[\s\S]*?)```/i);
  if (genericMatch) return genericMatch[1].trim();
  const partialHtml = text.match(/```html\s*([\s\S]*?)$/i);
  if (partialHtml) return partialHtml[1].trim();
  const partialGeneric = text.match(/```\s*(<!DOCTYPE[\s\S]*|<html[\s\S]*)$/i);
  if (partialGeneric) return partialGeneric[1].trim();
  return "";
}

// ─── Fork path helpers ────────────────────────────────────────────────────────

function getForkPath(projectPath: string, projectName: string, slot: WorkbenchSlot): string {
  // Mon 1 (anchor, slot 2) → main project folder
  // Others → project-pit-monN
  if (slot.monitorNumber === 1) return projectPath;
  const base = projectPath.replace(/[\\/][^\\/]*$/, ""); // parent directory
  return `${base}/${projectName}-pit-mon${slot.monitorNumber}`;
}

// ─── Write HTML to fork folder ────────────────────────────────────────────────

async function writeToFork(projectPath: string, projectName: string, slot: WorkbenchSlot, html: string): Promise<boolean> {
  if (!projectPath || !projectName) return false;
  const forkPath = getForkPath(projectPath, projectName, slot);
  try {
    const res = await fetch("/api/builder/write-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `${forkPath}/index.html`,
        content: html,
        projectPath: forkPath,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Stream a single slot ─────────────────────────────────────────────────────

async function streamSlot(
  slot: WorkbenchSlot,
  prompt: string,
  abortSignal: AbortSignal,
  projectPath: string | null,
  projectName: string | null,
): Promise<void> {
  const store = useWorkbenchStore.getState();
  store.setSlotStarted(slot.slot);

  const source = slot.provider === "ollama" || slot.provider === "lmstudio" ? "local" : slot.provider;

  // Include existing code as context so the model can modify instead of rebuilding
  const existingCode = slot.lastCode || slot.previewHtml || "";
  let fullPrompt: string;
  if (existingCode) {
    fullPrompt = `${PIT_SYSTEM_PROMPT}\n\nHere is the current code you previously generated:\n\`\`\`html\n${existingCode}\n\`\`\`\n\nUser request: ${prompt}\n\nIMPORTANT: Modify the existing code above based on the user's request. Output the COMPLETE updated file.`;
  } else {
    fullPrompt = `${PIT_SYSTEM_PROMPT}\n\nUser request: ${prompt}`;
  }

  try {
    const res = await fetch("/api/test/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: slot.model,
        provider: slot.provider,
        prompt: fullPrompt,
        source,
      }),
      signal: abortSignal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      useWorkbenchStore.getState().setSlotError(slot.slot, errText.slice(0, 200));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      useWorkbenchStore.getState().setSlotError(slot.slot, "No response stream");
      return;
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let lineBuffer = "";
    let tokenCount = 0;
    const startTime = Date.now();
    let lastPreviewUpdate = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const text = parsed?.message?.content ?? parsed?.content ?? "";

          // Handle Ollama done signal with eval_count
          if (parsed.done && parsed.eval_count) {
            tokenCount = parsed.eval_count;
          }

          if (text) {
            fullText += text;
            tokenCount++;

            // Update metrics every chunk
            const elapsed = (Date.now() - startTime) / 1000;
            const tps = elapsed > 0 ? tokenCount / elapsed : 0;
            useWorkbenchStore.getState().setSlotMetrics(slot.slot, tokenCount, Math.round(tps * 10) / 10);

            // Throttled preview update (every 400ms)
            const now = Date.now();
            if (now - lastPreviewUpdate > 400) {
              lastPreviewUpdate = now;
              const html = extractHtml(fullText);
              if (html) {
                useWorkbenchStore.getState().setSlotStatus(slot.slot, "building");
                // Update preview without changing status to "complete"
                const s = useWorkbenchStore.getState().slots.find((x) => x.slot === slot.slot);
                if (s) {
                  useWorkbenchStore.setState((state) => ({
                    slots: state.slots.map((x) =>
                      x.slot === slot.slot ? { ...x, previewHtml: html, lastCode: html } : x
                    ),
                  }));
                }
              }
            }
          }
        } catch {
          // Partial JSON — accumulate raw text
          if (trimmed) fullText += trimmed;
        }
      }
    }

    // Final extraction
    const finalHtml = extractHtml(fullText);
    if (finalHtml) {
      const s = useWorkbenchStore.getState();
      // Update preview + code + status
      useWorkbenchStore.setState((state) => ({
        slots: state.slots.map((x) =>
          x.slot === slot.slot
            ? { ...x, previewHtml: finalHtml, lastCode: finalHtml, status: "complete" as const, completedAt: Date.now() }
            : x
        ),
      }));

      // Write to fork folder
      if (projectPath && projectName) {
        writeToFork(projectPath, projectName, slot, finalHtml);
      }

      // Also broadcast to popout windows so they update too
      try {
        const ch = new BroadcastChannel(WORKBENCH_CHANNEL);
        ch.postMessage({ type: "PREVIEW_HTML", slot: slot.slot, html: finalHtml });
        ch.postMessage({ type: "CODE", slot: slot.slot, code: finalHtml });
        ch.postMessage({ type: "STATUS", slot: slot.slot, status: "complete" });
        ch.close();
      } catch { /* popout may not exist */ }
    } else {
      useWorkbenchStore.getState().setSlotError(slot.slot, "No code generated");
    }

    // Final metrics
    const elapsed = (Date.now() - startTime) / 1000;
    const tps = elapsed > 0 ? tokenCount / elapsed : 0;
    useWorkbenchStore.getState().setSlotMetrics(slot.slot, tokenCount, Math.round(tps * 10) / 10);

    // Log usage to billing — fire and forget
    try {
      if (slot.provider !== "ollama" && slot.provider !== "lmstudio") {
        fetch("/api/billing/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: slot.model,
            provider: slot.provider,
            app: "pit-workspace",
            tokensIn: 0,
            tokensOut: tokenCount,
            durationMs: Date.now() - startTime,
          }),
        }).catch(() => {});
      }
    } catch {}

  } catch (err: any) {
    if (err?.name === "AbortError") {
      useWorkbenchStore.getState().setSlotStatus(slot.slot, "idle");
    } else {
      useWorkbenchStore.getState().setSlotError(slot.slot, err?.message ?? "Stream failed");
    }
  }
}

// ─── Active abort controllers ─────────────────────────────────────────────────
let activeAbortControllers: Map<number, AbortController> = new Map();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fire parallel streaming builds to all selected monitors.
 * Also broadcasts the prompt to any open popout windows.
 */
export function broadcastToAllMonitors(
  prompt: string,
  projectPath: string | null,
  projectName: string | null,
): number {
  const store = useWorkbenchStore.getState();
  const selectedSlots = store.slots.filter((s) => s.selected);

  if (selectedSlots.length === 0) return 0;

  // Abort any in-flight requests
  abortAllStreams();

  // Also broadcast to popout windows (they handle their own streaming)
  // But we'll stream from the dashboard too for the cards
  // Popouts will show their own preview; dashboard cards show ours
  // Don't double-broadcast to popouts — they'd get duplicate streams
  // Just stream from the dashboard for all slots

  // Fire parallel streams
  for (const slot of selectedSlots) {
    const abort = new AbortController();
    activeAbortControllers.set(slot.slot, abort);
    // Fire and forget — each runs independently
    streamSlot(slot, prompt, abort.signal, projectPath, projectName);
  }

  return selectedSlots.length;
}

/**
 * Abort all in-flight streams
 */
export function abortAllStreams(): void {
  for (const [, ctrl] of activeAbortControllers) {
    ctrl.abort();
  }
  activeAbortControllers.clear();
}

/**
 * Abort a single slot's stream
 */
export function abortSlotStream(slot: number): void {
  const ctrl = activeAbortControllers.get(slot);
  if (ctrl) {
    ctrl.abort();
    activeAbortControllers.delete(slot);
  }
}

/**
 * Promote a challenger's code to the anchor (Mon 1) folder
 */
export async function promoteToAnchor(
  slotNum: number,
  projectPath: string | null,
  projectName: string | null,
): Promise<boolean> {
  const store = useWorkbenchStore.getState();
  const srcSlot = store.slots.find((s) => s.slot === slotNum);
  const anchorSlot = store.slots.find((s) => s.monitorNumber === 1);
  if (!srcSlot?.lastCode || !anchorSlot || !projectPath || !projectName) return false;

  // Copy code to anchor's preview
  useWorkbenchStore.setState((state) => ({
    slots: state.slots.map((s) =>
      s.monitorNumber === 1
        ? { ...s, previewHtml: srcSlot.lastCode, lastCode: srcSlot.lastCode, status: "complete" as const }
        : s
    ),
  }));

  // Write to anchor's folder
  const anchorPath = projectPath; // anchor = main project
  try {
    const res = await fetch("/api/builder/write-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `${anchorPath}/index.html`,
        content: srcSlot.lastCode,
        projectPath: anchorPath,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
