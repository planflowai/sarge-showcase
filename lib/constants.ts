/**
 * App-wide constants
 *
 * Centralised here so magic numbers are easy to find and update.
 * Import from this file rather than inlining literal values in source.
 */

// ── Artifact versioning ────────────────────────────────────────────────────
/** Maximum number of artifact versions kept in history (oldest are dropped). */
export const ARTIFACT_MAX_VERSIONS = 10;

// ── Capability event bus ───────────────────────────────────────────────────
/** Maximum number of events retained in the in-memory event history. */
export const EVENT_BUS_MAX_HISTORY = 100;

// ── Streaming preview debounce ─────────────────────────────────────────────
/** Minimum milliseconds between live-preview updates during streaming. */
export const STREAMING_MIN_UPDATE_INTERVAL_MS = 80;
/** Minimum new characters accumulated before a live-preview update fires. */
export const STREAMING_MIN_CONTENT_DELTA = 30;

// ── Sidebar hidden routes ──────────────────────────────────────────────────
/**
 * Routes on which the main navigation sidebar is hidden.
 * Add new full-screen routes here; the Sidebar component reads this list.
 */
export const SIDEBAR_HIDDEN_ROUTES: string[] = [
  "/dashboard",
  "/library",
  "/review",
  "/ai-analysis",
  "/optimize",
  "/diagnostics",
  "/builder",
  "/research",
  "/apps",
  "/apps/resume-tailor",
  "/test",
  "/batch",
  "/journal",
];

// ── Network / Air-gap detection ────────────────────────────────────────────
/**
 * Hostname used for the DNS connectivity check in /api/status.
 * Using a neutral, well-known resolver rather than a specific vendor endpoint.
 */
export const AIR_GAP_CHECK_HOST = "dns.google";
