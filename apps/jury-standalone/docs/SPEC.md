# THREAD GUARDIAN HYBRID — Parallel Chat Jury System

Read CLAUDE.md first. ONLY work in L:\ai_builder\ai_builderv2.
Do NOT update or create any todo lists. Do NOT summarize completed tasks.
Build each section, test it compiles, then move to the next.

---

## WHAT THIS IS

A silent background jury system that monitors all active chat conversations for hallucinations, echo chambers, contradictions, and drift. It watches four simultaneous cloud model conversations in Parallel Chat and cross-checks them against each other using one lightweight local model at a time.

This is NOT a new tab. It integrates into the existing Chat tab (both Single and Parallel modes) and lightly into Architect and Builder.

---

## ARCHITECTURE OVERVIEW

Three tiers of background monitoring. Only ONE local model runs at a time. All four Parallel Chat panes use cloud models, so the GPU is 100% free for the jury.

### Tier 1 — Fast Skim (every 90-120 seconds)
- Model: phi4-mini or phi3:mini (user configurable)
- Reads: ONLY new responses since last check (not full history)
- Job: Scan for contradictions between the four panes, flag echo (3+ models agree on same unverified claim), extract key facts with source model attribution
- Output: JSON only. No natural language. No chat output.
- JSON format:
```json
{
  "timestamp": "ISO8601",
  "tier": 1,
  "factsFound": [
    { "fact": "string", "sourceModel": "string", "sourcePane": 1, "confidence": 85 }
  ],
  "contradictions": [
    { "claim": "string", "models": ["Claude", "Grok"], "description": "string" }
  ],
  "echoRisk": {
    "detected": false,
    "agreeingModels": [],
    "claim": "",
    "confidence": 0
  },
  "driftDetected": false,
  "escalateToTier2": false,
  "reason": ""
}
```

### Tier 2 — Review (every 5-8 minutes)
- Model: mistral:7b or llama3.1:8b (user configurable)
- Reads: Tier 1's accumulated findings + new responses since last Tier 2 check
- Job: Verify Tier 1's flags, deeper contradiction analysis, check if echo risk is real or false positive, review fact accuracy
- Output: JSON only. Same format as Tier 1 plus:
```json
{
  "tier1Corrections": [
    { "originalFlag": "string", "correction": "string", "action": "dismiss|confirm|escalate" }
  ],
  "verifiedFacts": [
    { "fact": "string", "verifiedBy": ["Claude", "GPT"], "confidence": 92 }
  ],
  "escalateToTier3": false,
  "reason": ""
}
```

### Tier 3 — Deep Audit (every 3-4 hours OR on user command "vault now")
- Model: Claude Opus 4.6 or Grok 4.2 (cloud, user configurable)
- Reads: Full shared ledger + all Tier 1/2 findings since last Tier 3 run + messages since last save point
- Job: Create save point, verify all facts, resolve contradictions, retire stale facts, assess overall thread health
- Output: JSON save point (max 2000 tokens)
- Can override Tier 1/2 on factual errors only
- User can trigger manually via "Vault Now" button

---

## SHARED CONTEXT LEDGER

One single ledger shared across ALL panes in a Parallel Chat session. This is the core data structure.

Create `lib/types/juryGuardian.ts`:

```typescript
interface SharedContextLedger {
  sessionId: string;
  createdAt: Date;
  lastUpdated: Date;
  
  // Facts tracked across all panes
  activeFacts: Array<{
    id: string;
    fact: string;
    sourceModel: string;
    sourcePane: number;
    timestamp: Date;
    verified: boolean;
    verifiedBy: string[]; // which models confirmed
    confidence: number;
    citations: string[];
  }>;
  
  retiredFacts: Array<{
    id: string;
    fact: string;
    reason: string;
    retiredAt: Date;
  }>;
  
  // Cross-model contradictions
  contradictions: Array<{
    id: string;
    claim: string;
    models: Array<{ model: string; pane: number; position: string }>;
    timestamp: Date;
    resolved: boolean;
    resolution?: string;
  }>;
  
  // Echo chamber alerts
  echoAlerts: Array<{
    id: string;
    claim: string;
    agreeingModels: string[];
    confidence: number;
    timestamp: Date;
    dismissed: boolean;
  }>;
  
  // Drift tracking
  driftAlerts: Array<{
    id: string;
    description: string;
    pane: number;
    model: string;
    timestamp: Date;
  }>;
  
  // Tier execution log
  tierLog: Array<{
    tier: 1 | 2 | 3;
    timestamp: Date;
    model: string;
    findingsCount: number;
    escalated: boolean;
    duration: number; // ms
  }>;
  
  // Save points (Tier 3 only)
  savePoints: Array<{
    id: string;
    timestamp: Date;
    summary: string;
    verifiedFacts: string[];
    unresolvedItems: Array<{ description: string; models: string[] }>;
    messageIdCutoff: string; // Tier 3 only reads AFTER this point next time
    tokenCount: number;
  }>;
  
  // Model health tracking
  modelHealth: Record<string, {
    model: string;
    pane: number;
    strikes: number; // 3 strikes = suggest swap
    lastFlag: Date | null;
    flagHistory: Array<{ reason: string; timestamp: Date }>;
  }>;
}
```

---

## JURY STORE

Create `lib/stores/juryGuardianStore.ts` using Zustand with persist:

```
State:
  enabled: boolean (default false)
  
  // Scope
  scope: {
    parallelChat: boolean (default true — full monitoring)
    singleChat: boolean (default true — full monitoring)  
    architect: boolean (default true — light monitoring, every 2-3 min)
    builder: boolean (default true — light monitoring, every 2-3 min)
    debate: boolean (default false — NEVER)
    test: boolean (default false — NEVER)
    tribunal: boolean (default false — NEVER)
    batch: boolean (default false — NEVER)
  }
  
  // Tier configs
  tier1: {
    model: string (default "phi4-mini")
    intervalSeconds: number (default 100)
    enabled: boolean (default true)
  }
  tier2: {
    model: string (default "mistral:7b")
    intervalSeconds: number (default 360)
    enabled: boolean (default true)
  }
  tier3: {
    model: string (default "claude-opus-4-6")
    intervalHours: number (default 4)
    enabled: boolean (default true)
    provider: string (default "anthropic")
  }
  
  // Behavior settings
  behavior: {
    toastOnly: boolean (default true)
    autoSwapEnabled: boolean (default false — opt-in)
    autoInjectEnabled: boolean (default false — opt-in)
    echoThreshold: number (default 0.7 — 70% agreement triggers alert)
    strikeLimit: number (default 3 — strikes before swap suggestion)
  }
  
  // Active ledger per session
  ledgers: Record<string, SharedContextLedger>
  
  // Preference
  preferCost: boolean (default true)

Actions:
  setEnabled(enabled: boolean)
  updateTierConfig(tier: 1|2|3, config: Partial<TierConfig>)
  updateBehavior(config: Partial<BehaviorConfig>)
  getLedger(sessionId: string): SharedContextLedger
  updateLedger(sessionId: string, updates: Partial<SharedContextLedger>)
  addFact(sessionId: string, fact: ActiveFact)
  addContradiction(sessionId: string, contradiction: Contradiction)
  addEchoAlert(sessionId: string, alert: EchoAlert)
  addDriftAlert(sessionId: string, alert: DriftAlert)
  addStrike(sessionId: string, model: string, reason: string)
  createSavePoint(sessionId: string, savePoint: SavePoint)
  dismissEchoAlert(sessionId: string, alertId: string)
  resolveContradiction(sessionId: string, contradictionId: string, resolution: string)
  resetLedger(sessionId: string)
```

---

## JURY ENGINE

Create `lib/juryGuardian/engine.ts`:

### Core Functions:

**getNewResponses(sessionId: string, sinceTimestamp: Date): PaneResponse[]**
- Reads from the parallel chat message stores
- Returns only messages added since the given timestamp
- Each response includes: pane number, model name, content, timestamp

**runTier1(sessionId: string): Tier1Result**
- Get new responses since last Tier 1 run
- If no new responses, skip (save GPU cycles)
- Build prompt: system prompt + new responses from all panes
- Call Ollama with the configured Tier 1 model
- Parse JSON response
- Update shared ledger: add facts, contradictions, echo alerts
- If escalateToTier2 is true, trigger Tier 2 immediately
- Log execution to tierLog

**runTier2(sessionId: string): Tier2Result**
- Get Tier 1 findings since last Tier 2 run + new responses
- Call Ollama with configured Tier 2 model
- Parse JSON, verify/dismiss Tier 1 flags
- Update ledger: confirm/retire facts, resolve false positives
- If escalateToTier3, trigger Tier 3
- Log execution

**runTier3(sessionId: string): Tier3Result**
- Get full ledger + messages since last save point
- Call cloud API (Claude or Grok) via existing /api/chat route
- Create save point
- Override Tier 1/2 factual errors if found
- Update ledger
- Log execution

### Interval Manager:

**startJury(sessionId: string)**
- Start Tier 1 interval (every 90-120 seconds)
- Start Tier 2 interval (every 5-8 minutes)
- Start Tier 3 interval (every 3-4 hours)
- Only ONE local model runs at a time — if Tier 2 is running when Tier 1 fires, Tier 1 waits
- Use a mutex/lock: `localModelBusy: boolean`

**stopJury(sessionId: string)**
- Clear all intervals
- Save current ledger state

**vaultNow(sessionId: string)**
- Manually trigger Tier 3 immediately
- User-initiated via button

### System Prompts:

**Tier 1 System Prompt:**
```
You are a silent background monitor. Your ONLY job is to scan recent AI responses from multiple models and identify:
1. Contradictions between models (Model A says X, Model B says not-X)
2. Echo chamber risk (3+ models agree on the same unverified claim)
3. Key facts with source attribution
4. Topic drift from the user's original question

You are reading responses from multiple AI models in a parallel chat session.
Each response is labeled with [PANE X - MODEL_NAME].

Output ONLY a JSON object. No explanations. No natural language. No commentary.
Never add rules. Never interpret user intent. Never fix anything.
If nothing notable is found, output: {"noFindings": true}
```

**Tier 2 System Prompt:**
```
You are a review monitor. You verify findings from a fast scanner (Tier 1).
You receive: Tier 1's JSON findings + recent responses from multiple AI models.
Your job:
1. Confirm or dismiss Tier 1's flags (was the contradiction real? was the echo genuine?)
2. Check fact accuracy more carefully
3. Identify anything Tier 1 missed

Output ONLY a JSON object. No explanations. No natural language.
If Tier 1 was correct, confirm. If Tier 1 was wrong, dismiss with reason.
Never add rules. Never interpret. Never override the user.
```

**Tier 3 System Prompt:**
```
You are a deep auditor. You review the full shared context ledger and all findings from Tier 1 and Tier 2 monitors.
Create a clean save point summarizing:
1. All verified facts (with which models confirmed them)
2. All unresolved contradictions
3. Any retired facts (with reason)
4. Overall thread health assessment

You may override Tier 1 and Tier 2 ONLY if there is a clear factual error.
Max 2000 tokens for the save point.
Output ONLY a JSON object.
```

---

## API ROUTE

Create `/api/jury-guardian/route.ts`:
- POST endpoint
- Body: { tier: 1|2|3, model: string, provider: "ollama"|"anthropic"|"xai"|etc, messages: array, systemPrompt: string }
- Routes to Ollama for local models, to existing cloud provider logic for cloud models
- Forces JSON mode where possible
- Returns parsed JSON result
- Error handling: if model fails, return { error: string } — don't crash

---

## TOAST NOTIFICATIONS

Create `components/chat/JuryToast.tsx`:

- Floating toast at **top-center** of the screen
- Semi-transparent dark background with colored left border:
  - Yellow: echo risk
  - Red: contradiction detected
  - Orange: drift alert
  - Blue: info (Tier 3 save point created)
- Auto-dismisses after 8 seconds
- Shows: icon + short message + action buttons
- Action buttons (only shown when relevant):
  - "Dismiss" — marks alert as dismissed in ledger
  - "Swap Model" — opens model selector for the flagged pane (only if autoSwap is off)
  - "Inject Correction" — sends correction context to the flagged model (only if autoInject is off)
  - "View Details" — opens the jury panel
- Multiple toasts stack vertically (max 3 visible, older ones queue)
- Animation: slide down from top, fade out on dismiss

---

## MONITORING PANEL

Create `components/chat/JuryMonitorPanel.tsx`:

Slide-out panel on the **right side** of the screen. Triggered by a small shield/jury icon in the Chat header bar (next to model selectors). Same visual style as the existing app panels.

### 4 Tabs:

**STATUS Tab:**
- Jury enabled/disabled toggle
- Health score (0-100 based on contradiction count, echo alerts, drift)
- Tier cards showing: model name, last run time, next run countdown, status (idle/running/error)
- "Vault Now" button to trigger Tier 3 manually
- "Run Tier 1 Now" and "Run Tier 2 Now" buttons for manual triggers

**LEDGER Tab:**
- Active facts list: fact text, source model, verified badge, confidence bar
- Contradictions list: claim, which models disagree, timestamp, resolved/unresolved toggle
- Echo alerts: claim, agreeing models, dismiss button
- Drift alerts: description, pane, model
- Retired facts (collapsible): fact, reason retired

**TIMELINE Tab:**
- Chronological event log
- Color-coded: green (fact verified), yellow (echo alert), red (contradiction), blue (tier run), orange (drift)
- Filter buttons: Tier 1 / Tier 2 / Tier 3 / Alerts only
- Each entry shows: timestamp, tier, event type, brief description

**CONFIG Tab:**
- Tier 1 model selector (dropdown of available Ollama models)
- Tier 1 interval slider (30s to 300s)
- Tier 2 model selector
- Tier 2 interval slider (120s to 600s)
- Tier 3 model selector (cloud models)
- Tier 3 interval slider (1h to 8h)
- Behavior toggles:
  - Toast only (default on)
  - Auto-swap on 3 strikes (default off)
  - Auto-inject corrections (default off)
- Echo threshold slider (50% to 95%, default 70%)
- Strike limit (1-5, default 3)
- Scope checkboxes: which modes the jury watches
- "Reset Ledger" button (with confirmation)

---

## INTEGRATION POINTS

### Parallel Chat (full monitoring):
- When Parallel Chat mode is active and jury is enabled:
  - Start jury intervals on session start
  - Stop jury intervals when Parallel Chat is closed or switched to Single mode
  - Every cloud model response gets logged to the jury's response queue
  - Jury reads from this queue on each tier cycle

### Single Chat (full monitoring):
- Same as Parallel Chat but only one pane to watch
- Jury still runs but cross-model checking is N/A (only drift and fact tracking)

### Architect + Builder (light monitoring):
- Tier 1 runs every 2-3 minutes instead of 90 seconds
- Tier 2 runs every 10 minutes instead of 5
- Tier 3 same schedule
- No echo detection (only one model talking)
- Focus on: drift from topic, hallucinated facts, contradictions with known facts in ledger

### Chat Header Integration:
- Add a small shield icon next to the Parallel/Single toggle in the Chat header
- Shield color indicates status:
  - Gray: jury disabled
  - Green: jury running, no alerts
  - Yellow: echo or drift alerts active
  - Red: contradictions detected
- Click shield: opens JuryMonitorPanel
- Tooltip on hover: "Jury: Active — 2 alerts"

---

## EXECUTION ORDER

Build in this exact order. Test each step compiles before moving to next.

1. Create `lib/types/juryGuardian.ts` — all type definitions
2. Create `lib/stores/juryGuardianStore.ts` — Zustand store with persist
3. Create `lib/juryGuardian/engine.ts` — tier runners, interval manager, mutex
4. Create `/api/jury-guardian/route.ts` — API endpoint
5. Create `components/chat/JuryToast.tsx` — toast notifications
6. Create `components/chat/JuryMonitorPanel.tsx` — slide-out panel with 4 tabs
7. Integrate into Chat header — shield icon, panel toggle
8. Integrate into Parallel Chat — start/stop jury on session lifecycle, feed responses to queue
9. Integrate into Single Chat — same but single pane
10. Integrate into Architect/Builder — light monitoring with longer intervals

---

## CRITICAL RULES

- Do NOT break Parallel Chat, Single Chat, Builder, or any existing feature
- Do NOT create a new tab — this integrates into existing Chat UI
- Do NOT run two local models simultaneously — use a mutex lock
- Do NOT monitor Debate, Test, Tribunal, or Batch — those are controlled environments
- Jury output is JSON ONLY — never natural language in jury responses
- Toast is the DEFAULT alert method — auto-swap and auto-inject are OPT-IN
- One shared ledger per Parallel Chat session — not per pane
- Use existing /api/chat route patterns for cloud Tier 3 calls
- Use existing Ollama connection for local Tier 1/2 calls
- All jury operations log to forensicLogStore for audit trail
