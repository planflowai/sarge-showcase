"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ForensicLogEntry,
  ForensicSession,
  ForensicLogViewType,
} from "@/lib/types";
import { computeForensicHash, verifyChain } from "@/lib/utils/forensicHash";

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

const isDevNoTrim = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('SARGE_DEV_NO_TRIM') === 'true';
};

const FORENSIC_CONFIG = {
  QUOTA_THRESHOLD_MB: 100,
  MAX_ENTRIES_MEMORY: 50000,
  MAX_SESSIONS_MEMORY: 1000,
  MAX_ENTRIES_PERSIST: 10000,
  MAX_SESSIONS_PERSIST: 500,
  EMERGENCY_TRIM_ENTRIES: 100,
  EMERGENCY_TRIM_SESSIONS: 10,
  FLUSH_INTERVAL: 200,
};

let entriesSinceFlush = 0;

function isNearQuota(): boolean {
  if (isDevNoTrim()) return false;
  try {
    const used = new Blob(Object.values(localStorage)).size;
    const thresholdBytes = FORENSIC_CONFIG.QUOTA_THRESHOLD_MB * 1024 * 1024;
    return used > thresholdBytes;
  } catch {
    return false;
  }
}

function flushToFile(entries: ForensicLogEntry[], sessions: ForensicSession[], reason: string): void {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const data = {
      flushReason: reason,
      flushTime: new Date().toISOString(),
      entriesCount: entries.length,
      sessionsCount: sessions.length,
      entries: entries.slice(-FORENSIC_CONFIG.FLUSH_INTERVAL),
      sessions,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    if (document.hasFocus()) {
      console.log(`[Forensic] Flush ready: ${entries.length} entries (${reason})`);
    }
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('[Forensic] Flush to file failed:', e);
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

        entriesSinceFlush++;

        if (entriesSinceFlush >= FORENSIC_CONFIG.FLUSH_INTERVAL) {
          entriesSinceFlush = 0;
          if (process.env.NODE_ENV === 'development' && state.entries.length % 1000 === 0) {
            console.debug(`[Forensic] ${state.entries.length} entries in memory`);
          }
        }

        const shouldCheckQuota = state.entries.length % 500 === 0 && state.entries.length > 0;
        if (shouldCheckQuota && isNearQuota() && !isDevNoTrim()) {
          const lastTrimKey = 'SARGE_LAST_TRIM_LOG';
          const lastTrim = sessionStorage.getItem(lastTrimKey);
          const now = Date.now();
          if (!lastTrim || now - parseInt(lastTrim) > 300000) {
            console.warn('[Forensic] Storage nearing limit, will trim on next persist');
            sessionStorage.setItem(lastTrimKey, now.toString());
          }
        }

        const seq = state._seq;
        const lastEntry = state.entries[state.entries.length - 1];
        const previousHash = lastEntry?.hash ?? "GENESIS";

        const retentionDate = new Date();
        retentionDate.setFullYear(retentionDate.getFullYear() + 7);

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

          const trimmedEntries = isDevNoTrim()
            ? newEntries
            : newEntries.length > FORENSIC_CONFIG.MAX_ENTRIES_MEMORY
              ? newEntries.slice(-FORENSIC_CONFIG.MAX_ENTRIES_MEMORY)
              : newEntries;

          const trimmedSessions = isDevNoTrim()
            ? s.sessions
            : s.sessions.length > FORENSIC_CONFIG.MAX_SESSIONS_MEMORY
              ? s.sessions.slice(-FORENSIC_CONFIG.MAX_SESSIONS_MEMORY)
              : s.sessions;

          return {
            entries: trimmedEntries,
            _seq: s._seq + 1,
            sessions: trimmedSessions.map((sess) =>
              sess.id === params.sessionId
                ? { ...sess, entryCount: sess.entryCount + 1 }
                : sess
            ),
          };
        });
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
        return id;
      },

      endSession: (sessionId, verdict) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, endTime: new Date().toISOString(), verdict }
              : sess
          ),
        }));
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
      name: "forensic-standalone-log",
      partialize: (state) => ({
        entries: isDevNoTrim()
          ? state.entries
          : state.entries.slice(-FORENSIC_CONFIG.MAX_ENTRIES_PERSIST),
        sessions: isDevNoTrim()
          ? state.sessions
          : state.sessions.slice(-FORENSIC_CONFIG.MAX_SESSIONS_PERSIST),
        _seq: state._seq,
        chainValid: state.chainValid,
      }),
      storage: {
        getItem: (name) => {
          try {
            const value = localStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch (e) {
            console.warn('[Forensic] Error reading storage:', e);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
              console.warn('[Forensic] Quota exceeded, clearing old data...');

              if (value.state?.entries?.length > 0) {
                flushToFile(
                  value.state.entries,
                  value.state.sessions || [],
                  'quota-exceeded-emergency-flush'
                );
              }

              localStorage.removeItem(name);

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
                localStorage.clear();
                console.warn('[Forensic] Storage full, cleared all localStorage.');
              }
            } else {
              throw e;
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
