# API Routes Reference — SARGE Platform

All 42 API endpoints with purposes, request/response shapes, and security checks.

---

## Chat & Core (5 routes)

### POST /api/chat
- **Purpose:** Main streaming chat endpoint. Routes by provider and model, handles fallback chain.
- **Request:**
  ```json
  {
    "messages": [{"role": "user", "content": "..."}],
    "model": "claude-opus-4-6",
    "temperature": 0.7,
    "maxTokens": 2048,
    "stream": true
  }
  ```
- **Response:** Server-sent events (SSE) text/event-stream with "data:" prefixed JSON chunks
- **Auth:** None (public, but IP-based rate limiting recommended)
- **Fallback:** Provider chain if primary fails
- **Used By:** Chat, Builder, Journal, Analysis

### GET /api/status
- **Purpose:** Platform health, truth lock, kill stats, air-gap status, uptime.
- **Response:**
  ```json
  {
    "healthy": true,
    "uptime": 12345,
    "airGapEnabled": false,
    "threadGuardianActive": true,
    "modelsAvailable": ["claude-opus-4-6", "gpt-4o", "llama3.2:3b"],
    "providersOnline": ["anthropic", "ollama"]
  }
  ```
- **Auth:** None
- **DNS Check:** Queries dns.google to detect air-gap mode
- **Used By:** Dashboard, Header status indicator

### POST /api/rollcall
- **Purpose:** Direct model ping with no fallback. Returns self-ID + latency.
- **Request:**
  ```json
  {
    "model": "claude-opus-4-6"
  }
  ```
- **Response:**
  ```json
  {
    "model": "claude-opus-4-6",
    "provider": "anthropic",
    "latency": 125,
    "available": true
  }
  ```
- **Auth:** None
- **Security:** No fallback (tests exact model connectivity)
- **Used By:** Settings → Roll Call

### GET /api/health
- **Purpose:** Service health check (Kubernetes-style liveness probe).
- **Response:** `{ "ok": true }`
- **Auth:** None
- **Used By:** Health checks, monitoring

### GET /api/voice-key
- **Purpose:** Retrieve XTTS voice synthesis key (if configured).
- **Response:**
  ```json
  {
    "key": "...",
    "endpoint": "http://..."
  }
  ```
- **Auth:** None
- **Used By:** Voice input/output

---

## Builder File Operations (13 routes)

### POST /api/builder/check-folder
- **Purpose:** Validate project directory and check read/write permissions.
- **Request:** `{ "path": "/home/user/my-project" }`
- **Response:** `{ "valid": true, "readable": true, "writable": true }`
- **Auth:** None (path is validated server-side)
- **Security:** Validates projectPath per-request, blocks .env* globally
- **Used By:** Builder sidebar

### POST /api/builder/list-directory
- **Purpose:** Recursive file tree (respects .gitignore).
- **Request:** `{ "path": "/home/user/my-project", "depth": 3 }`
- **Response:**
  ```json
  {
    "files": [
      {"name": "index.html", "type": "file", "size": 1024},
      {"name": "src", "type": "directory", "children": [...]}
    ]
  }
  ```
- **Auth:** None
- **Security:** .gitignore respected, sensitive dirs skipped
- **Used By:** FileExplorer

### POST /api/builder/read-file
- **Purpose:** Read file content.
- **Request:** `{ "path": "/home/user/my-project/index.html" }`
- **Response:** `{ "content": "..." }`
- **Auth:** None
- **Security:** .env* files blocked globally
- **Used By:** ArtifactPanel code editor

### POST /api/builder/write-file
- **Purpose:** Write file to disk (logs forensic event).
- **Request:**
  ```json
  {
    "path": "/home/user/my-project/index.html",
    "content": "..."
  }
  ```
- **Response:** `{ "success": true }`
- **Auth:** None
- **Security:** 5MB max per file, .env* blocked, forensic logging
- **Forensic Event:** Logged with hash chain entry
- **Used By:** BuilderChat (code generation)

### POST /api/builder/files
- **Purpose:** Multi-file CRUD (create, read, update, delete).
- **Request:**
  ```json
  {
    "operations": [
      {"op": "create", "path": "...", "content": "..."},
      {"op": "delete", "path": "..."},
      {"op": "rename", "from": "...", "to": "..."}
    ]
  }
  ```
- **Response:** `{ "success": true, "results": [...] }`
- **Auth:** None
- **Security:** Per-file validation, forensic logging per op
- **Used By:** Builder file operations (Phase 3)

### DELETE /api/builder/files
- **Purpose:** Delete multiple files.
- **Request:** `{ "paths": ["file1.js", "file2.css"] }`
- **Response:** `{ "deleted": 2 }`
- **Auth:** None
- **Security:** Forensic event per deletion
- **Used By:** FileExplorer

### POST /api/builder/create-project
- **Purpose:** Scaffold new project (template support planned).
- **Request:**
  ```json
  {
    "name": "my-app",
    "template": "blank" | "react" | "nextjs" | "tailwind"
  }
  ```
- **Response:** `{ "path": "/home/user/my-app", "success": true }`
- **Auth:** None
- **Security:** Path validated, BUILDER_PROJECTS_DIR enforcement
- **Status:** Basic implementation, templates Phase 5
- **Used By:** New Project wizard

### GET /api/builder/dev-status
- **Purpose:** Check if dev server alive (port 5000 by default).
- **Response:** `{ "alive": true, "port": 5000, "url": "http://localhost:5000" }`
- **Auth:** None
- **Used By:** BuilderPage (dev server integration Phase 3)

### POST /api/builder/preview
- **Purpose:** Generate srcdoc preview with inlined CSS/JS.
- **Request:**
  ```json
  {
    "html": "...",
    "css": "...",
    "js": "..."
  }
  ```
- **Response:** `{ "srcdoc": "..." }`
- **Auth:** None
- **Security:** Content security policy headers
- **Used By:** BuilderPreview iframe

### POST /api/builder/terminal
- **Purpose:** Execute shell command in project directory (30s timeout).
- **Request:**
  ```json
  {
    "command": "npm install"
  }
  ```
- **Response:**
  ```json
  {
    "stdout": "...",
    "stderr": "...",
    "exitCode": 0
  }
  ```
- **Auth:** None
- **Security:** Blocklist: rm, mv, sudo, git push, chmod, dd, mkfs (regex blocked)
- **30s Timeout:** Enforced with kill signal
- **Used By:** BuilderTerminal

### GET /api/builder/asset
- **Purpose:** Serve binary files (images, fonts, media) from a project folder for preview iframe.
- **Request (query params):**
  ```
  GET /api/builder/asset?projectPath=/path/to/project&file=assets/logo.png
  ```
- **Response:** Binary file content with correct MIME type and caching headers
- **Auth:** None
- **Security:** Path traversal prevention (resolved path must be within project directory)
- **MIME Types:** png, jpg, gif, webp, svg, ico, bmp, avif, woff/woff2, ttf, otf, css, js, json, mp4, webm, mp3, wav, pdf
- **Caching:** `Cache-Control: public, max-age=3600`
- **Used By:** BuilderPreview iframe (loads project assets via absolute URLs instead of broken relative paths)

### POST /api/builder/update-log
- **Purpose:** Manage BUILDER_LOG.md in project root. Supports 4 actions: init, append, scan, summary.
- **Request:**
  ```json
  {
    "projectPath": "/path/to/project",
    "projectName": "My App",
    "action": "append" | "init" | "scan" | "summary",
    "entry": { "filePath": "index.html", "action": "created", "summary": "Initial page", "model": "claude-opus-4-6", "provider": "anthropic" },
    "sessionSummary": { "recentChanges": [], "currentState": "...", "nextSteps": [] }
  }
  ```
- **Actions:**
  - `init` — Create new log (skip if exists)
  - `append` — Add single change entry with timestamp, file path, action, model
  - `scan` — Walk project directory tree (max depth 5) and generate inventory log (skip if log exists)
  - `summary` — Generate full session summary with changes, current state, next steps
- **Response:** `{ "success": true, "path": "...", "action": "..." }`
- **GET variant:** `GET /api/builder/update-log?projectPath=...` — Read existing log content
- **Auth:** None
- **Security:** Path normalization, forensic event logging
- **Used By:** BuilderChat (auto-logging after file changes), BuilderPage (project load)

---

## Diagnostics (5 routes)

### POST /api/diagnostics/scan
- **Purpose:** Full codebase scan by severity (error, warning, enhancement, security).
- **Request:**
  ```json
  {
    "depth": "medium",
    "includeSecurityIssues": true
  }
  ```
- **Response:**
  ```json
  {
    "findings": [
      {
        "id": "...",
        "file": "index.js",
        "line": 42,
        "severity": "error",
        "message": "..."
      }
    ]
  }
  ```
- **Auth:** None
- **Used By:** Diagnostics page

### POST /api/diagnostics/analyze
- **Purpose:** AI analysis of findings.
- **Request:**
  ```json
  {
    "findings": [...]
  }
  ```
- **Response:**
  ```json
  {
    "analysis": "...",
    "recommendations": [...]
  }
  ```
- **Auth:** None
- **Used By:** Diagnostics page

### POST /api/diagnostics/fix
- **Purpose:** AI fix suggestion for user approval.
- **Request:**
  ```json
  {
    "finding": {...},
    "context": "..."
  }
  ```
- **Response:**
  ```json
  {
    "suggestion": "...",
    "originalCode": "...",
    "fixedCode": "..."
  }
  ```
- **Auth:** None
- **Used By:** Diagnostics diff viewer

### POST /api/diagnostics/rollback
- **Purpose:** Restore file from snapshot.
- **Request:**
  ```json
  {
    "snapshotId": "...",
    "fileId": "..."
  }
  ```
- **Response:** `{ "success": true }`
- **Auth:** None
- **Used By:** Diagnostics snapshots

### POST /api/diagnostics/custom-request
- **Purpose:** Custom AI query against codebase.
- **Request:**
  ```json
  {
    "query": "Find all async functions that don't have error handling"
  }
  ```
- **Response:**
  ```json
  {
    "findings": [...],
    "analysis": "..."
  }
  ```
- **Auth:** None
- **Used By:** Diagnostics advanced mode

---

## Test & Evaluation (5 routes)

### POST /api/test/completion
- **Purpose:** Single completion for D1/D2/D3/Judge slots.
- **Request:**
  ```json
  {
    "model": "claude-opus-4-6",
    "messages": [...],
    "role": "D1",
    "temperature": 0.7
  }
  ```
- **Response:** `{ "response": "...", "tokens": 150 }`
- **Auth:** None
- **Fallback:** Provider chain on failure
- **Used By:** Test Mode, Debate Arena

### POST /api/test/stream
- **Purpose:** SSE streaming for live test mode and builder chat. Handles multi-provider routing with streaming support.
- **Request:** Same as /api/test/completion (plus optional `stream: true`)
- **Response:** Server-sent events text/event-stream
- **Auth:** None
- **Providers:** Routes to Anthropic SDK streaming, OpenAI/xAI/DeepSeek SSE, Ollama chunked, LM Studio OpenAI-compatible, Google Generative AI streaming
- **Used By:** TestModeView (live display), BuilderChat (code streaming), BatchView, Resume Tailor

### GET /api/test/status
- **Purpose:** Test mode health (models available, queue depth).
- **Response:**
  ```json
  {
    "healthy": true,
    "modelsAvailable": 3,
    "queueDepth": 0
  }
  ```
- **Auth:** None
- **Used By:** Test Mode UI

### GET /api/test/batch-logs
- **Purpose:** Batch history retrieval.
- **Response:**
  ```json
  {
    "batches": [
      {
        "id": "...",
        "timestamp": ...,
        "results": [...]
      }
    ]
  }
  ```
- **Auth:** None
- **Used By:** Review page, AI Analysis

### GET /api/test/models
- **Purpose:** Available models for test slots.
- **Response:**
  ```json
  {
    "models": ["claude-opus-4-6", "gpt-4o", "llama3.2:3b"],
    "judges": ["claude-opus-4-6"]
  }
  ```
- **Auth:** None
- **Used By:** Test Mode slot selector

---

## Guardian & Verification (3 routes)

### POST /api/thread-guardian
- **Purpose:** Background conversation analysis (3-tier: fast indexing, deep analysis, save points).
- **Request:**
  ```json
  {
    "messages": [...],
    "tier": 1 | 2 | 3
  }
  ```
- **Response:**
  ```json
  {
    "facts": [...],
    "contradictions": [...],
    "savePoint": {...}
  }
  ```
- **Auth:** None
- **Used By:** Background Guardian process, Chat UI
- **Async:** Non-blocking, background processing

### POST /api/jury-guardian
- **Purpose:** Debate jury coordination + verdict.
- **Request:**
  ```json
  {
    "agents": ["D1", "D2", "D3"],
    "responses": ["...", "...", "..."],
    "question": "..."
  }
  ```
- **Response:**
  ```json
  {
    "verdict": "...",
    "confidence": 87,
    "reasoning": "..."
  }
  ```
- **Auth:** None
- **Used By:** Debate Arena, Test Mode

### GET /api/airgap
- **Purpose:** Air-gap enabled/disabled + reason.
- **Response:**
  ```json
  {
    "airGapEnabled": false,
    "secureMode": false,
    "reason": "User toggle or environment variable"
  }
  ```
- **Auth:** None
- **Used By:** Header, routing decisions

---

## Content Generation & Search (6 routes)

### POST /api/image
- **Purpose:** Image generation (DALL-E 3, Grok-2, Imagen 3.0).
- **Request:**
  ```json
  {
    "prompt": "A cat wearing sunglasses",
    "provider": "openai" | "google" | "xai",
    "size": "1024x1024"
  }
  ```
- **Response:**
  ```json
  {
    "url": "https://...",
    "provider": "openai"
  }
  ```
- **Auth:** Requires valid API keys in settingsStore
- **Used By:** Future image gen tab

### POST /api/web-search
- **Purpose:** Web search (Brave → Google Custom → SearXNG → mock fallback).
- **Request:**
  ```json
  {
    "query": "latest AI news"
  }
  ```
- **Response:**
  ```json
  {
    "results": [
      {
        "title": "...",
        "url": "...",
        "snippet": "..."
      }
    ]
  }
  ```
- **Auth:** Optional API keys (fallback to mock if none available)
- **Fallback Chain:** Brave → Google Custom → SearXNG → mock
- **Air-gap:** Fallback to SearXNG or mock
- **Used By:** Research, Live Checker

### POST /api/search/tavily
- **Purpose:** Tavily search (fact verification, research).
- **Request:**
  ```json
  {
    "query": "fact to verify"
  }
  ```
- **Response:**
  ```json
  {
    "results": [...],
    "summary": "..."
  }
  ```
- **Auth:** Requires TAVILY_API_KEY
- **Used By:** Live Checker, Research
- **Air-gap:** Blocked

### POST /api/web-fetch
- **Purpose:** Fetch URL, return markdown.
- **Request:**
  ```json
  {
    "url": "https://example.com"
  }
  ```
- **Response:**
  ```json
  {
    "markdown": "...",
    "title": "...",
    "meta": {...}
  }
  ```
- **Auth:** None
- **Used By:** Live Checker, Research

### POST /api/research
- **Purpose:** Market research (news + sentiment + catalysts + recommendation).
- **Request:**
  ```json
  {
    "symbol": "AAPL"
  }
  ```
- **Response:**
  ```json
  {
    "news": [...],
    "sentiment": "bullish",
    "catalysts": [...],
    "recommendation": "BUY"
  }
  ```
- **Auth:** Requires FINNHUB_API_KEY (optional)
- **Used By:** Research page

---

## Journal & Infrastructure (4 routes)

### POST /api/journal/chat
- **Purpose:** Journal-specific chat context.
- **Request:** Same as /api/chat
- **Response:** SSE streaming
- **Auth:** None
- **Used By:** Journal page

### POST /api/journal/analyze
- **Purpose:** AI effectiveness scoring of conversation.
- **Request:**
  ```json
  {
    "conversation": [...],
    "criteria": ["clarity", "coherence", "engagement"]
  }
  ```
- **Response:**
  ```json
  {
    "scores": {"clarity": 8.5, "coherence": 9.0, "engagement": 7.5},
    "summary": "..."
  }
  ```
- **Auth:** None
- **Used By:** Journal analysis panel

### POST /api/sync/reverse
- **Purpose:** Push local state to Supabase.
- **Request:**
  ```json
  {
    "state": {...},
    "timestamp": ...
  }
  ```
- **Response:** `{ "success": true }`
- **Auth:** Supabase service key
- **Used By:** Sync system (optional)

### GET /api/models/scan
- **Purpose:** Query Ollama localhost:11434.
- **Response:**
  ```json
  {
    "models": [
      {"name": "llama3.2:3b", "size": 2000000000}
    ]
  }
  ```
- **Auth:** None
- **Used By:** Model discovery on startup

### POST /api/models/classify
- **Purpose:** Classify model capability.
- **Request:** `{ "model": "claude-opus-4-6" }`
- **Response:**
  ```json
  {
    "capabilities": ["builder", "judge", "analyzer"],
    "contextWindow": 200000,
    "costTier": "premium"
  }
  ```
- **Auth:** None
- **Used By:** Model selector

### GET /api/lmstudio/models
- **Purpose:** Query LM Studio localhost:1234.
- **Response:** Same format as /api/models/scan
- **Auth:** None
- **Used By:** Model discovery (LM Studio)

---

## Summary by Category

| Category | Count | Status |
|----------|-------|--------|
| Chat & Core | 5 | ✅ Stable |
| Builder File Ops | 13 | ✅ Stable |
| Diagnostics | 5 | ✅ Stable |
| Test & Evaluation | 5 | ✅ Stable |
| Guardian & Verification | 3 | ✅ Stable |
| Content & Search | 6 | ✅ Stable |
| Journal & Infrastructure | 5 | ✅ Stable |
| **TOTAL** | **42** | ✅ |

---

Generated from SARGE_PLATFORM.md and codebase analysis
Last updated: 2026-02-25
