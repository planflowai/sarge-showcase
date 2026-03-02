"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "../lib/utils/debouncedStorage";
import type {
  ForensicLogEntry,
  ForensicSession,
  ForensicLogViewType,
} from "../lib/types";
import { computeForensicHash, verifyChain } from "../lib/utils/forensicHash";
import {
  createSupabaseSession,
  completeSupabaseSession,
  logSupabaseResponse,
  saveEndpointSnapshot,
} from "../lib/supabase/sync";
import { isAirGapActive } from "../lib/security/cyberSecure";
import { useSyncStatusStore } from "./syncStatusStore";
import { useUIStore } from "./uiStore";

interface ForensicFilters {
  severity: string[];
  category: string[];
  searchText: string;
  sessionId: string | null;
}

interface ForensicLogState {
  // Data
  entries: ForensicLogEntry[];
  sessions: ForensicSession[];

  // UI
  showingForensicLog: boolean;
  currentView: ForensicLogViewType;
  selectedSessionId: string | null;
  expandedEntryId: string | null;

  // Replay
  replayIndex: number;
  replayPlaying: boolean;
  replaySpeed: number;
  replayInterval: ReturnType<typeof setInterval> | null;

  // Filters
  filters: ForensicFilters;

  // Chain integrity
  chainValid: boolean;

  // Sequence counter
  _seq: number;

  // Actions
  openForensicLog: () => void;
  closeForensicLog: () => void;
  setCurrentView: (view: ForensicLogViewType) => void;
  setSelectedSession: (id: string | null) => void;
  setExpandedEntry: (id: string | null) => void;

  captureEntry: (
    params: Omit<
      ForensicLogEntry,
      "id" | "sequenceNumber" | "hash" | "previousHash" | "timestamp" | "aiDecision" | "medicationContext" | "actors" | "dataLineage" | "compliance"
    > & {
      aiDecision?: ForensicLogEntry["aiDecision"];
      medicationContext?: ForensicLogEntry["medicationContext"];
      actors?: ForensicLogEntry["actors"];
      dataLineage?: ForensicLogEntry["dataLineage"];
      compliance?: ForensicLogEntry["compliance"];
    }
  ) => Promise<void>;
  startSession: (
    config: ForensicSession["config"],
    type: "single" | "batch"
  ) => string;
  endSession: (sessionId: string, verdict?: string) => void;

  // Replay
  setReplayIndex: (i: number) => void;
  replayNext: () => void;
  replayPrev: () => void;
  toggleReplayPlay: () => void;
  setReplaySpeed: (ms: number) => void;
  stopReplay: () => void;

  // Filters
  setFilters: (f: Partial<ForensicFilters>) => void;
  getFilteredEntries: () => ForensicLogEntry[];
  getSessionEntries: (sessionId: string) => ForensicLogEntry[];

  // Export
  exportJSON: () => void;

  // Housekeeping
  clearAll: () => void;
}

function generateId(): string {
  return `fl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// FORENSIC LOG CONFIGURATION
// ============================================================================

// Dev mode flag - set via localStorage or environment
// To disable trimming in dev: localStorage.setItem('SARGE_DEV_NO_TRIM', 'true')
const isDevNoTrim = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('SARGE_DEV_NO_TRIM') === 'true';
};

// Quota and limit configuration (raised for long Chaos/Armageddon runs)
const FORENSIC_CONFIG = {
  // localStorage quota threshold - set very high (100MB)
  // We only trim on ACTUAL quota exceeded errors, not estimates
  QUOTA_THRESHOLD_MB: 100,

  // In-memory entry limits (50000 for long runs)
  MAX_ENTRIES_MEMORY: 50000,
  MAX_SESSIONS_MEMORY: 1000,

  // Persist limits (10000 entries for full batch history)
  MAX_ENTRIES_PERSIST: 10000,
  MAX_SESSIONS_PERSIST: 500,

  // Emergency trim limits (when quota actually exceeded - be aggressive to recover)
  EMERGENCY_TRIM_ENTRIES: 100,
  EMERGENCY_TRIM_SESSIONS: 10,

  // Flush checkpoint every N entries (increased to reduce I/O)
  FLUSH_INTERVAL: 200,
};

// Track entries since last flush
let entriesSinceFlush = 0;

// Estimate localStorage usage and check if near quota
function isNearQuota(): boolean {
  // Dev mode: never trigger quota warnings
  if (isDevNoTrim()) return false;

  try {
    const used = new Blob(Object.values(localStorage)).size;
    const thresholdBytes = FORENSIC_CONFIG.QUOTA_THRESHOLD_MB * 1024 * 1024;
    return used > thresholdBytes;
  } catch {
    return false;
  }
}

// Flush critical batch data to JSON file (browser download)
function flushToFile(entries: ForensicLogEntry[], sessions: ForensicSession[], reason: string): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const data = {
      flushReason: reason,
      flushTime: new Date().toISOString(),
      entriesCount: entries.length,
      sessionsCount: sessions.length,
      entries: entries.slice(-FORENSIC_CONFIG.FLUSH_INTERVAL), // Last N entries
      sessions,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-flush-${timestamp}.json`;
    // Only auto-download if not in background (user won't see spam)
    if (document.hasFocus()) {
      // Don't auto-download, just log availability
      console.log(`[Forensic] Flush ready: ${entries.length} entries (${reason})`);
    }
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('[Forensic] Flush to file failed:', e);
  }
}

// Safely persist to localStorage with quota handling
function safePersist(key: string, data: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[Forensic] Storage quota exceeded, clearing old data...');
      return false;
    }
    throw e;
  }
}

export const useForensicLogStore = create<ForensicLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      sessions: [],
      showingForensicLog: false,
      currentView: "timeline",
      selectedSessionId: null,
      expandedEntryId: null,
      replayIndex: 0,
      replayPlaying: false,
      replaySpeed: 1500,
      replayInterval: null,
      filters: { severity: [], category: [], searchText: "", sessionId: null },
      chainValid: true,
      _seq: 0,

      openForensicLog: () => set({ showingForensicLog: true }),
      closeForensicLog: () => {
        const { replayInterval } = get();
        if (replayInterval) clearInterval(replayInterval);
        set({
          showingForensicLog: false,
          replayPlaying: false,
          replayInterval: null,
        });
      },

      setCurrentView: (view) => {
        const { replayInterval } = get();
        if (replayInterval) clearInterval(replayInterval);
        set({
          currentView: view,
          replayPlaying: false,
          replayInterval: null,
        });
      },

      setSelectedSession: (id) => set({ selectedSessionId: id, replayIndex: 0 }),
      setExpandedEntry: (id) => set({ expandedEntryId: id }),

      captureEntry: async (params) => {
        const state = get();

        // Track flush interval
        entriesSinceFlush++;

        // Periodic checkpoint (every FLUSH_INTERVAL entries) - silent in production
        if (entriesSinceFlush >= FORENSIC_CONFIG.FLUSH_INTERVAL) {
          entriesSinceFlush = 0;
          // Only log in dev mode, and even then very quietly
          if (process.env.NODE_ENV === 'development' && state.entries.length % 1000 === 0) {
            console.debug(`[Forensic] ${state.entries.length} entries in memory`);
          }
        }

        // QUOTA CHECK: Only check every 500 entries to avoid performance hit
        // and only trim if we're actually close to running out of space
        const shouldCheckQuota = state.entries.length % 500 === 0 && state.entries.length > 0;
        if (shouldCheckQuota && isNearQuota() && !isDevNoTrim()) {
          // Only log once per 5 minutes to avoid spam completely
          const lastTrimKey = 'SARGE_LAST_TRIM_LOG';
          const lastTrim = sessionStorage.getItem(lastTrimKey);
          const now = Date.now();
          if (!lastTrim || now - parseInt(lastTrim) > 300000) { // 5 minutes
            console.warn('[Forensic] Storage nearing limit, will trim on next persist');
            sessionStorage.setItem(lastTrimKey, now.toString());
          }
          // Don't trim here - let the persist handler do it on actual error
        }

        const seq = state._seq;
        const lastEntry = state.entries[state.entries.length - 1];
        const previousHash = lastEntry?.hash ?? "GENESIS";

        // Compute retention date (7 years from now per FDA SaMD / EU AI Act)
        const retentionDate = new Date();
        retentionDate.setFullYear(retentionDate.getFullYear() + 7);

        // Build defaults, then override with params
        const defaults = {
          aiDecision: {
            action: params.event || "N/A",
            confidence: 0,
            modelVersion: params.modelState?.modelId ?? "N/A",
            explanation: "N/A",
            factors: [] as string[],
            thresholds: {} as Record<string, string>,
          },
          medicationContext: {
            drugName: "N/A",
            prescribedDose: "N/A",
            administeredDose: "N/A",
            variance: "N/A",
          },
          actors: {
            aiSystem: "SARGE_v1",
            humanUsers: [] as string[],
            overrideOccurred: false,
            overrideReason: "N/A",
          },
          dataLineage: {
            sources: ["SARGE_v1 Test Engine"],
            transformations: [] as string[],
            validationChecks: ["echo_detection", "challenge_detection", "flag_detection"],
          },
          compliance: {
            regulations: ["EU AI Act", "FDA SaMD", "NIST AI RMF"],
            retentionUntil: retentionDate.toISOString().slice(0, 10),
            auditReady: true,
          },
        };

        const partial: Omit<ForensicLogEntry, "hash"> = {
          id: generateId(),
          sequenceNumber: seq,
          timestamp: new Date().toISOString(),
          previousHash,
          ...defaults,
          ...params,
        };

        const hash = await computeForensicHash(partial);
        const entry: ForensicLogEntry = { ...partial, hash };

        set((s) => {
          const newEntries = [...s.entries, entry];

          // Dev mode: no trimming at all
          // Production: keep up to MAX_ENTRIES_MEMORY (20000)
          const trimmedEntries = isDevNoTrim()
            ? newEntries
            : newEntries.length > FORENSIC_CONFIG.MAX_ENTRIES_MEMORY
              ? newEntries.slice(-FORENSIC_CONFIG.MAX_ENTRIES_MEMORY)
              : newEntries;

          // Sessions: keep up to MAX_SESSIONS_MEMORY (500)
          const trimmedSessions = isDevNoTrim()
            ? s.sessions
            : s.sessions.length > FORENSIC_CONFIG.MAX_SESSIONS_MEMORY
              ? s.sessions.slice(-FORENSIC_CONFIG.MAX_SESSIONS_MEMORY)
              : s.sessions;

          return {
            entries: trimmedEntries,
            _seq: s._seq + 1,
            // Update session entry count
            sessions: trimmedSessions.map((sess) =>
              sess.id === params.sessionId
                ? { ...sess, entryCount: sess.entryCount + 1 }
                : sess
            ),
          };
        });

        // Sync response entries to Supabase - ONLY if air-gap is NOT active
        if (!isAirGapActive() && params.sessionId && (params.category === "response" || params.category === "round")) {
          try {
            const success = await logSupabaseResponse(params.sessionId, entry);
            if (success) {
              useSyncStatusStore.getState().setLastSync("forensic");
            } else {
              // Queue for retry
              useSyncStatusStore.getState().addToQueue({
                type: "response",
                operation: "create",
                data: { sessionId: params.sessionId, entry },
              });
              useUIStore.getState().showToast({
                message: "Sync failed — data saved locally",
                type: "warning",
                duration: 4000,
              });
            }
          } catch (err) {
            console.warn("[Forensic] Failed to sync entry to Supabase:", err);
            // Queue for retry
            useSyncStatusStore.getState().addToQueue({
              type: "response",
              operation: "create",
              data: { sessionId: params.sessionId, entry },
            });
            useUIStore.getState().showToast({
              message: "Sync failed — data saved locally",
              type: "warning",
              duration: 4000,
            });
          }
        }
      },

      startSession: (config, type) => {
        const id = generateId();
        const session: ForensicSession = {
          id,
          type,
          startTime: new Date().toISOString(),
          config,
          entryCount: 0,
        };
        set((s) => ({ sessions: [...s.sessions, session] }));

        // Sync to Supabase - ONLY if air-gap is NOT active
        if (!isAirGapActive()) {
          createSupabaseSession(session)
            .then((supaId) => {
              if (supaId) {
                saveEndpointSnapshot(supaId, config.models);
                useSyncStatusStore.getState().setLastSync("forensic");
                console.log("[Forensic] Session synced to Supabase:", supaId);
              } else {
                // Queue for retry
                useSyncStatusStore.getState().addToQueue({
                  type: "session",
                  operation: "create",
                  data: { session, supabaseId: crypto.randomUUID() },
                });
                useUIStore.getState().showToast({
                  message: "Sync failed — data saved locally",
                  type: "warning",
                  duration: 4000,
                });
              }
            })
            .catch((err) => {
              console.warn("[Forensic] Failed to sync session to Supabase:", err);
              useSyncStatusStore.getState().addToQueue({
                type: "session",
                operation: "create",
                data: { session, supabaseId: crypto.randomUUID() },
              });
              useUIStore.getState().showToast({
                message: "Sync failed — data saved locally",
                type: "warning",
                duration: 4000,
              });
            });
        } else {
          useSyncStatusStore.getState().setStatus("airgap");
          console.log("[Forensic] Air-gap active - Supabase sync disabled");
        }

        return id;
      },

      endSession: (sessionId, verdict) => {
        const state = get();
        const session = state.sessions.find((s) => s.id === sessionId);

        // Find echo detection round from entries
        const sessionEntries = state.entries.filter((e) => e.sessionId === sessionId);
        const echoEntry = sessionEntries.find((e) => e.event.toLowerCase().includes("echo"));
        const echoRound = echoEntry?.systemState?.roundNumber;

        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, endTime: new Date().toISOString(), verdict }
              : sess
          ),
        }));

        // Sync completion to Supabase - ONLY if air-gap is NOT active
        if (!isAirGapActive()) {
          completeSupabaseSession(sessionId, verdict, echoRound)
            .then((ok) => {
              if (ok) {
                useSyncStatusStore.getState().setLastSync("forensic");
                console.log("[Forensic] Session completion synced to Supabase:", sessionId);
              } else {
                useSyncStatusStore.getState().addToQueue({
                  type: "session",
                  operation: "update",
                  data: { session: { ...session, endTime: new Date().toISOString(), verdict }, supabaseId: sessionId },
                });
                useUIStore.getState().showToast({
                  message: "Sync failed — data saved locally",
                  type: "warning",
                  duration: 4000,
                });
              }
            })
            .catch((err) => {
              console.warn("[Forensic] Failed to sync session completion:", err);
              useSyncStatusStore.getState().addToQueue({
                type: "session",
                operation: "update",
                data: { session: { ...session, endTime: new Date().toISOString(), verdict }, supabaseId: sessionId },
              });
              useUIStore.getState().showToast({
                message: "Sync failed — data saved locally",
                type: "warning",
                duration: 4000,
              });
            });
        }
      },

      setReplayIndex: (i) => set({ replayIndex: i }),

      replayNext: () => {
        const { replayIndex, selectedSessionId, entries } = get();
        const sessionEntries = selectedSessionId
          ? entries.filter((e) => e.sessionId === selectedSessionId)
          : entries;
        if (replayIndex < sessionEntries.length - 1) {
          set({ replayIndex: replayIndex + 1 });
        } else {
          get().stopReplay();
        }
      },

      replayPrev: () => {
        const { replayIndex } = get();
        if (replayIndex > 0) set({ replayIndex: replayIndex - 1 });
      },

      toggleReplayPlay: () => {
        const { replayPlaying, replayInterval, replaySpeed } = get();
        if (replayPlaying) {
          if (replayInterval) clearInterval(replayInterval);
          set({ replayPlaying: false, replayInterval: null });
        } else {
          const interval = setInterval(() => get().replayNext(), replaySpeed);
          set({ replayPlaying: true, replayInterval: interval });
        }
      },

      setReplaySpeed: (ms) => {
        const { replayPlaying, replayInterval } = get();
        if (replayPlaying && replayInterval) {
          clearInterval(replayInterval);
          const interval = setInterval(() => get().replayNext(), ms);
          set({ replaySpeed: ms, replayInterval: interval });
        } else {
          set({ replaySpeed: ms });
        }
      },

      stopReplay: () => {
        const { replayInterval } = get();
        if (replayInterval) clearInterval(replayInterval);
        set({ replayPlaying: false, replayInterval: null });
      },

      setFilters: (f) =>
        set((s) => ({ filters: { ...s.filters, ...f } })),

      getFilteredEntries: () => {
        const { entries, filters } = get();
        let result = entries;
        if (filters.sessionId) {
          result = result.filter((e) => e.sessionId === filters.sessionId);
        }
        if (filters.severity.length > 0) {
          result = result.filter((e) => filters.severity.includes(e.severity));
        }
        if (filters.category.length > 0) {
          result = result.filter((e) => filters.category.includes(e.category));
        }
        if (filters.searchText) {
          const q = filters.searchText.toLowerCase();
          result = result.filter(
            (e) =>
              e.event.toLowerCase().includes(q) ||
              e.input?.toLowerCase().includes(q) ||
              e.output?.toLowerCase().includes(q)
          );
        }
        return result;
      },

      getSessionEntries: (sessionId) => {
        return get().entries.filter((e) => e.sessionId === sessionId);
      },

      exportJSON: () => {
        const { entries, sessions } = get();
        const chainResult = verifyChain(entries);
        const report = {
          exportDate: new Date().toISOString(),
          chainIntegrity: chainResult.valid
            ? "VERIFIED"
            : `BROKEN at entry ${chainResult.brokenAt}`,
          totalEntries: entries.length,
          totalSessions: sessions.length,
          sessions,
          entries,
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `forensic-log-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      clearAll: () => {
        const { replayInterval } = get();
        if (replayInterval) clearInterval(replayInterval);
        set({
          entries: [],
          sessions: [],
          _seq: 0,
          chainValid: true,
          selectedSessionId: null,
          replayIndex: 0,
          replayPlaying: false,
          replayInterval: null,
          expandedEntryId: null,
        });
      },
    }),
    {
      name: "sarge-forensic-log",
      // Only persist the data, not UI state or intervals
      partialize: (state) => ({
        // Always limit — prevents hydration avalanche from multi-MB JSON parse on page load
        entries: state.entries.slice(-500),
        sessions: state.sessions.slice(-50),
        _seq: state._seq,
        chainValid: state.chainValid,
      }),
      // Custom storage with quota error handling
      storage: {
        getItem: (name) => {
          if (typeof window === "undefined") return null;
          try {
            const value = localStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch (e) {
            console.warn('[Forensic] Error reading storage:', e);
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window === "undefined") return;
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
              console.warn('[Forensic] Quota exceeded, clearing old data...');

              // Flush current data to file before clearing
              if (value.state?.entries?.length > 0) {
                flushToFile(
                  value.state.entries,
                  value.state.sessions || [],
                  'quota-exceeded-emergency-flush'
                );
              }

              // Clear ALL forensic data from localStorage to recover space
              localStorage.removeItem(name);

              // Also clear other SARGE data that might be large
              try {
                localStorage.removeItem('sarge-batch-history');
              } catch {}

              // Try again with minimal data
              try {
                const minimal = {
                  state: {
                    entries: value.state?.entries?.slice(-FORENSIC_CONFIG.EMERGENCY_TRIM_ENTRIES) || [],
                    sessions: value.state?.sessions?.slice(-FORENSIC_CONFIG.EMERGENCY_TRIM_SESSIONS) || [],
                    _seq: value.state?._seq || 0,
                    chainValid: true,
                  },
                  version: value.version,
                };
                localStorage.setItem(name, JSON.stringify(minimal));
                console.log('[Forensic] Storage recovered, keeping last', FORENSIC_CONFIG.EMERGENCY_TRIM_ENTRIES, 'entries');
              } catch {
                // Still failing - clear everything and give up persisting
                localStorage.clear();
                console.warn('[Forensic] Storage full, cleared all localStorage. Data saved to forensic log file.');
              }
            } else {
              throw e;
            }
          }
        },
        removeItem: (name) => {
          if (typeof window === "undefined") return;
          localStorage.removeItem(name);
        },
      },
    }
  )
);
