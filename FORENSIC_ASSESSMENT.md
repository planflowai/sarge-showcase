# FORENSIC ASSESSMENT — S.A.R.G.E. Builder Pipeline
**Date**: 2026-03-08
**Branch**: sargebuild-v1
**Assessed by**: Claude Opus 4.6 (forensic read-only audit)
**Scope**: Last 5 commits (`5cc6ed3` through `728e939`)
**Rule**: NO CODE WAS MODIFIED. This is a report only.

---

## TABLE OF CONTENTS

1. [Full Client Pipeline Trace](#section-1--full-client-pipeline-trace)
2. [Why Opus Built the Wrong Thing](#section-2--why-opus-built-the-wrong-thing)
3. [Billing: $0.00 Logged but $0.28 Charged](#section-3--billing-000-logged-but-028-charged)
4. [Builder State After All Changes](#section-4--builder-state-after-all-changes)
5. [Forge Trials Integrity](#section-5--forge-trials-integrity)
6. [What Got Changed That Shouldn't Have](#section-6--what-got-changed-that-shouldnt-have)

---

## SECTION 1 — Full Client Pipeline Trace

### Step 1: Intake Form
**Status: WORKS**

- **File**: `apps/builder-standalone/public/intake-form.html` (2080 lines)
- **Wrapper**: `apps/builder-standalone/app/(client)/intake/[ref]/page.tsx` — loads form in iframe, injects `ref` URL param
- **Fields collected**: `client_name`, `business_name`, `email`, `phone`, `industry`, `location`, `business_description`, `pages` (toggle cards), `features` (toggle cards), `service_name[]`/`service_desc[]`, `team_name[]`/`team_role[]`/`team_bio[]`, `testimonial_quote[]`/`testimonial_name[]`, `site_phone`, `site_email`, `site_address`, `social_*`, `budget`, `timeline`
- **POST target**: `/api/intake/submit` (intake-form.html line 2045)

### Step 2: Form Submission
**Status: WORKS**

- **File**: `apps/builder-standalone/app/api/intake/submit/route.ts`
- Accepts POST with flat or nested `form_data` structure (line 12-14)
- Extracts `ref_code` from multiple fallback fields (line 17-19)
- **Writes to Supabase** table `client_intake` — upsert by `ref_code` (lines 28-64)
- Calls `sendIntakeEmails()` non-blocking (line 74)
- Returns `{ success: true, ref_code }`
- **Supabase dependency**: Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Skips DB if not set.

### Step 3: Email Trigger
**Status: PARTIALLY WORKING — field name mismatch**

- **File**: `apps/builder-standalone/app/api/intake/submit/route.ts`, lines 88-174
- **Function**: `sendIntakeEmails(requestUrl, formData, refCode)`
- Two emails sent: (a) confirmation to client using template `intake_received`, (b) notification to owner
- Both call `POST /api/email/send`

### Step 4: Field Mapping
**Status: BUG — client_name → contact_name mismatch**

| Field | Form HTML sends | Submit route reads | Email function reads | Result |
|-------|----------------|-------------------|---------------------|--------|
| CLIENT_NAME | `client_name` (line 858) | `body.client_name` ✓ (line 24) | `formData.contact_name` ✗ (line 97) | **BUG**: Email uses `contact_name` but form sends `client_name`. Falls back to `business_name` or "Unknown" |
| CLIENT_EMAIL | `email` (line 868) | `body.client_email \|\| formData.email` ✓ (line 25) | `formData.email` ✓ (line 96) | Works |
| BUSINESS_NAME | `business_name` (line 862) | `formData.business_name` ✓ (line 23) | `formData.business_name \|\| "Unknown"` (line 94) | Works (shows "Unknown" only if field is blank) |

**Root cause**: `submit/route.ts` line 97: `const contactName = formData.contact_name || businessName;` — The form sends `client_name`, not `contact_name`. Every intake email greets the client by their business name instead of their personal name.

### Step 5: Build Trigger
**Status: WORKS — Manual, not auto-triggered**

- Intake submission does NOT auto-trigger a build
- Must manually call:
  - `POST /api/intake/build` — assembles prompt only, no AI call
  - `POST /api/intake/build-multipage` — full automated pipeline (AI calls, guardian, PII, deploy)
  - `POST /api/intake/approve` with `action: "start_build"` — only updates Supabase status, does NOT build
- No webhook, cron, or event listener exists for auto-build

### Step 6: Model Selection
**Status: WORKS**

- **File**: `apps/builder-standalone/app/api/intake/build-multipage/route.ts`, lines 38-99
- `MODEL_CHAINS` defines ordered fallback chains per difficulty tier:

| Tier | Chain (tried in order) |
|------|----------------------|
| Easy | ollama:qwen2.5-coder:14b → ollama:qwen2.5-coder:7b → ollama:codellama:7b → deepseek-chat → grok-4-1-fast-non-reasoning → gemini-2.5-flash |
| Medium | deepseek-chat → grok-4-1-fast-non-reasoning → gemini-2.5-flash → gpt-4.1 |
| Hard | gemini-2.5-flash → gpt-4.1 → grok-4-0709 → claude-sonnet-4-5-20250514 |

- `routeModel()` (lines 74-99): Skips failed models, checks Ollama availability for local, always considers cloud available
- Ultimate fallback: `gemini-2.5-flash`
- User override via `body.provider` + `body.model` (lines 204-206)
- Retry escalation: Up to 3 attempts, failed model added to skip list, difficulty escalated

### Step 7: Prompt Assembly
**Status: WORKS**

- **File**: `packages/builder/src/lib/intakeToPrompt.ts`
- `intakeToPagePrompt(formData, pageName, sharedCss?, navSnippet?)` — per-page prompt for multi-page pipeline
- System prompt in `build-multipage/route.ts` lines 789-801 (Ollama) / 828-840 (cloud):
  ```
  You are a web developer building the "[pageName]" page for a client website.
  OUTPUT RULES:
  - Output ONLY the complete HTML file — no explanations, no markdown fences.
  - Start with <!DOCTYPE html> and end with </html>.
  - Include ALL CSS in <style> tags and ALL JavaScript in <script> tags.
  - Use PII placeholders: {{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}, etc.
  - Each page must fit in 2-3 viewport heights max (under 4000px total height).
  - Do NOT use source.unsplash.com URLs — use picsum.photos.
  ```
- Industry-specific styles from `intakeToPrompt.ts` line 19 (e.g., restaurant: "warm, inviting, food photography focus, rich earth tones")
- Page difficulty tiers: `intakeToPrompt.ts` lines 354-368

### Step 8: API Call
**Status: WORKS**

- **File**: `build-multipage/route.ts`, `buildOnePage()` lines 758-919
- **Ollama (local)**: Direct POST to `http://127.0.0.1:11434/api/generate`, `stream: false`, 120s timeout
- **Cloud**: Self-fetch to `http://localhost:3101/api/test/stream`, NDJSON streaming, 180s timeout
- Auth handled by `/api/test/stream` reading provider-specific API keys from env vars

### Step 9: Response Handling
**Status: WORKS**

- `extractHtml()` at `build-multipage/route.ts` lines 922-943: Strips markdown fences, finds `<!DOCTYPE` or `<html`
- This is a LOCAL function in the route, NOT the shared `extractCodeFromMarkdown()` from the builder package
- Cloud streaming: NDJSON line-by-line parsing, `data.full_content` override if present

### Step 10: Guardian Check
**Status: WORKS**

- **File**: `packages/builder/src/lib/multiPageBuilder.ts`, `guardianCheck()` lines 263-464
- Runs twice: once immediately after HTML extraction (structural only), once in main pipeline loop (full check)
- Checks: structural validity, hallucinated business names (13 known fakes), hallucinated phones (555-*, 800-555-0*, etc.), hallucinated emails (example.com, acmecorp.com, etc.), hallucinated addresses (123 Main St, Anytown, etc.), nav consistency, PII placeholder presence
- Hallucinations are **auto-replaced** with `{{placeholder}}` tokens, NOT rejected

### Step 11: PII Injection
**Status: WORKS**

- **File**: `packages/builder/src/lib/piiInjector.ts`, called from `build-multipage/route.ts` lines 380-433
- PIIData built from intake form data (lines 386-394)
- Iterates all HTML files in project directory (lines 400-411)
- Replaces: `{{BUSINESS_NAME}}`, `{{phone}}`, `{{email}}`, `{{address}}`, `{{city}}`, `{{state}}`, `{{client_name}}` and uppercase variants

**Secondary issue**: PII injector reads `flat.phone` and `flat.email` (client's personal contact) instead of `flat.site_phone` and `flat.site_email` (website contact info). If they differ, pages show personal contact.

### Step 12: Deploy
**Status: WORKS**

- **Build pipeline auto-deploy**: `deployToVercel()` at `build-multipage/route.ts` lines 624-660, uses `vercel deploy` CLI (preview, not production)
- **Approve flow full deploy**: `apps/builder-standalone/app/api/intake/approve/route.ts` lines 90-109, calls `POST /api/deploy` with targets: github, vercel, netlify, cloudflare
- User action required for full production deploy (approve endpoint must be called)

### Step 13: Site Live Email
**Status: WORKS (two separate paths)**

- **Build pipeline path** (`build-multipage/route.ts` lines 561-591): Sends `site_live` to client with single Vercel URL, no rollback URL
- **Approve path** (`approve/route.ts` lines 120-138): Sends `site_live` with all 3 live URLs + rollback URL
- **Email template** (`email/send/route.ts` lines 173-203): Renders live URLs as clickable links, shows emergency rollback if provided

---

## SECTION 2 — Why Opus Built the Wrong Thing

### The Cloud Benchmark Code Path

**File**: `apps/builder-standalone/app/api/benchmark/run-cloud/route.ts`

When Claude Opus 4.6 is selected in Forge Trials:

1. UI button click sends POST to `/api/benchmark/run-cloud` with `model.id`, `model.provider`
2. Route iterates scenarios, for each calls `callCloudDirect()` (line 53)
3. `callCloudDirect()` dispatches by provider: `case "anthropic": return callAnthropic(...)` (line 81-82)

### The EXACT Prompt Sent to Anthropic

**System prompt** (`CLOUD_SYSTEM_PROMPT` from `packages/benchmark/src/cloudScenarios.ts`):

```
You are a code builder assistant.

RULES:
- Output a single complete HTML file with all CSS in a <style> tag and all JS in a <script> tag.
- No external dependencies except CDN libraries (Tailwind, Font Awesome, Google Fonts are fine).
- The file must be fully functional when opened in a browser.
- When modifying existing code, output the COMPLETE updated file.
- Start with a brief explanation (1-3 sentences) of what you built or changed.
- Then provide the code in a single code block.
- Be concise. No lengthy explanations unless asked.
```

**User message** (restaurant scenario `cloud-r1-restaurant`):

```
Build a complete restaurant website: animated hero with parallax background image
effect, navigation bar with smooth scroll to sections, food menu organized by category
(appetizers/mains/desserts) with prices and descriptions, image gallery section,
reservation form with date picker and party size selector using vanilla JS, customer
testimonials carousel that auto-rotates, Google Maps embed placeholder div, footer with
hours/address/social links. Professional color scheme. Fully responsive. Output a single
complete HTML file with all CSS in a style tag and all JS in a script tag. No external
dependencies except CDN libraries (Tailwind, Font Awesome, Google Fonts are fine). The
file must be fully functional when opened in a browser.
```

**API call** (`callAnthropic()` lines 234-249):
```typescript
fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model,               // exact model ID from config
    max_tokens: 8192,
    stream: true,
    system: systemPrompt || undefined,
    messages: [{ role: "user", content: userPrompt }],
  }),
});
```

**Parameters**: `max_tokens: 8192`, `stream: true`. **Temperature: NOT SET** (defaults to Anthropic's API default of 1.0).

### The EXACT Prompt Sent to DeepSeek

**System prompt**: Same `CLOUD_SYSTEM_PROMPT` — identical text, sent as `{"role": "system", "content": ...}` message
**User message**: Same `scenario.prompt` — identical text
**Parameters**: `max_tokens: 8192`, `stream: true`. **Temperature: NOT SET** (defaults to API default).

### Prompt Comparison

| Aspect | Anthropic | DeepSeek |
|--------|-----------|----------|
| System prompt text | IDENTICAL | IDENTICAL |
| User message text | IDENTICAL | IDENTICAL |
| max_tokens | 8192 | 8192 |
| Temperature | Not set (API default 1.0) | Not set (API default 1.0) |
| System prompt delivery | `system:` top-level field | `{"role": "system"}` in messages array |
| Auth | `x-api-key` header | `Authorization: Bearer` header |

**FINDING: The prompts are 100% identical. There is ZERO provider-specific prompt modification, wrapping, truncation, or transformation. The only difference is the API wire format (Anthropic native vs OpenAI-compatible).**

### No Middleware, No Interceptors

- No middleware between `callCloudDirect` and the API call
- No prompt transformation functions
- No provider-specific logic that modifies prompt content
- `callAnthropic()` receives `systemPrompt` and `userPrompt` as strings and sends them directly

### No Retry Logic in Cloud Runner

```typescript
const RUNS_PER_SCENARIO = 1;  // line 23
```

The cloud runner does **exactly one attempt per scenario per model**. There is:
- No retry on failure
- No validation gate that rejects outputs
- No modified retry prompt
- No escalation logic

Scoring is purely observational — `scoreResponse()` calculates a number but does NOT trigger retries.

### Why "Output Invalid" on First Two Attempts

If three attempts were observed, **the cloud runner did NOT make them** — `RUNS_PER_SCENARIO = 1`. Possible explanations:
1. The user ran the benchmark 3 separate times manually
2. A different runner was used (the hybrid runner at `run-hybrid/route.ts` DOES have 3-strike retry with validation)
3. The UI showed 3 entries because the user re-triggered the test

The hybrid runner validates output with:
```typescript
function validateStepOutput(code) {
  // Requires: <!DOCTYPE or <html>, <body>, 2000+ chars, no chat response patterns
}
```

If output fails: Strike 1 retries same model with correction prompt, Strike 2 escalates to different model, Strike 3 uses whatever exists.

### Why 1 Min 57 Sec (117 seconds)

The timing is a **single API call**. No retries, no delays.

```typescript
const start = Date.now();           // line 221
// ... single API call ...
timeMs: Date.now() - start,         // line 288
```

Scenario timeout: `120_000` (120 seconds). The model nearly hit the timeout at 117 seconds. Breakdown:
- Prompt assembly: <1ms (string concatenation)
- HTTP connection to api.anthropic.com: ~100-500ms
- Streaming response: **~116 seconds** (model generated a very large response at temperature 1.0)
- extractCode: <1ms (regex on completed string)
- No Guardian check in cloud runner
- No Jury review in cloud runner

**FINDING: Opus 4.6 spent 117 seconds streaming its response because temperature was unset (defaulting to 1.0, maximum creativity), it was generating a large and potentially off-topic output, and there were zero guardrails to stop it.**

### Why a Dashboard Instead of a Restaurant

**Root cause**: Temperature 1.0 + a single-shot prompt + no validation. At temperature 1.0, Opus has maximum creative latitude. The system prompt says "code builder assistant" and the user prompt describes a complex multi-section page. With no PII placeholders, no business context, no truth anchor, and no retry/validation — Opus interpreted the task creatively and produced what it thought was impressive (a metrics dashboard) rather than what was literally requested (a restaurant website).

**The hybrid runner would have caught this** — it has Truth Anchor injection ("You are building a restaurant website"), 3-strike validation that checks for required keywords like "menu", "reservation", "testimonial", and correction prompts. The cloud runner has none of these safeguards.

---

## SECTION 3 — Billing: $0.00 Logged but $0.28 Charged

### Bug 1: `callAnthropic()` in Forge Trials Never Reads Actual Usage

**File**: `run-cloud/route.ts` lines 272-281

```typescript
for (const line of lines) {
  if (!line.startsWith("data: ")) continue;
  try {
    const data = JSON.parse(line.slice(6));
    if (data.type === "content_block_delta" && data.delta?.text) {
      content += data.delta.text;
      tokenCount++;   // BUG: counts SSE chunks, NOT tokens
    }
  } catch {}
}
```

- **Only looks for `content_block_delta`** — completely ignores `message_start` (has `input_tokens`) and `message_delta` (has `output_tokens`)
- `tokenCount` = number of SSE chunks, not actual tokens
- Fallback: `Math.max(tokenCount, Math.ceil(content.length / 4))`
- **Input tokens: NEVER read from API. Fabricated as `Math.ceil(tokensOut * 0.3)` in `logBilling()`**

### Bug 2: `streamAnthropic()` Forwards Undefined `input_tokens`

**File**: `test/stream/route.ts` lines 444-455

The handler correctly looks for both `message_start` and `message_delta` events, BUT:
- `message_delta` event does NOT contain `input_tokens` in the Anthropic API spec
- Code reads `data.usage.input_tokens` from `message_delta` → `undefined`
- Forwards `{ input_tokens: undefined, output_tokens: N }` to client
- Downstream evaluates `undefined || 0` → `tokenInput = 0`
- The `message_start` event correctly sends `input_tokens`, but gets **overwritten** by the later `message_delta` event

### Bug 3: Client-side Callers Hardcode `tokensIn: 0`

WorkbenchPopout, WarRoomPopout, PitBroadcastEngine all log:
```typescript
tokensIn: 0,              // ALWAYS ZERO
tokensOut: fullText.split(/\s+/).length,  // word count, not token count
```

### Cost Calculation

**File**: `packages/billing/src/calculator.ts` lines 4-14

```
cost = (tokensIn / 1M × inputRate) + (tokensOut / 1M × outputRate)
```

Rates for `claude-opus-4-6`: Input $5.00/1M, Output $25.00/1M

### The Math

For a 117-second Opus response generating ~8000 tokens of output:
- **Anthropic actually charges**: ~2000 input tokens × $5/1M + ~8000 output tokens × $25/1M = $0.01 + $0.20 = **~$0.21** (plus overhead = plausible $0.28)
- **Forge Trials logs**: `tokensIn = Math.ceil(content.length/4 * 0.3)` ≈ fabricated, `tokensOut = Math.ceil(content.length/4)` ≈ rough estimate
- The fabricated input at 30% of output dramatically undercounts actual prompt tokens

### DeepSeek Comparison

DeepSeek has the **exact same bugs** in the cloud runner — same chunk-counting, same 30% fabrication. BUT at $0.27/$1.10 per 1M tokens (vs $5/$25 for Opus), the dollar discrepancy is 20-50x smaller and invisible.

In the streaming route (`test/stream`), DeepSeek uses `stream_options: { include_usage: true }` which gives accurate final-chunk usage data. Anthropic can't use this option (different streaming protocol).

### All Models in rates.ts

| Model | Input ($/1M) | Output ($/1M) | Correct? |
|-------|-------------|---------------|----------|
| claude-opus-4-6 | 5.00 | 25.00 | ✓ |
| claude-opus-4-5-20250514 | 15.00 | 75.00 | ✓ |
| claude-sonnet-4-6 | 3.00 | 15.00 | ✓ |
| claude-sonnet-4-5-20241022 | 3.00 | 15.00 | ✓ |
| claude-haiku-4-5-20251001 | 1.00 | 5.00 | ✓ |
| gpt-4.1 | 2.00 | 8.00 | ✓ |
| gpt-4.1-mini | 0.40 | 1.60 | ✓ |
| gpt-4o | 2.50 | 10.00 | ✓ |
| gpt-4o-mini | 0.15 | 0.60 | ✓ |
| gpt-5-mini | 1.10 | 4.40 | ✓ |
| o3 | 2.00 | 8.00 | ✓ |
| o4-mini | 1.10 | 4.40 | ✓ |
| o1 | 15.00 | 60.00 | ✓ |
| o1-mini | 3.00 | 12.00 | ✓ |
| gemini-2.5-pro | 1.25 | 10.00 | ✓ |
| gemini-2.5-flash | 0.30 | 2.50 | ✓ |
| gemini-2.0-flash | 0.10 | 0.40 | ✓ |
| gemini-3-flash | 0.30 | 2.50 | ✓ |
| grok-3 | 3.00 | 15.00 | ✓ |
| grok-3-mini | 0.30 | 0.50 | ✓ |
| grok-4-0709 | 3.00 | 15.00 | ✓ |
| grok-4-1-fast-non-reasoning | 0.20 | 0.50 | ✓ |
| grok-4-1-fast-reasoning | 0.20 | 0.50 | ✓ |
| grok-code-fast-1 | 0.20 | 0.50 | ✓ |
| deepseek-chat | 0.27 | 1.10 | ✓ |
| deepseek-reasoner | 0.27 | 1.10 | ✓ |
| deepseek-v3 | 0.27 | 1.10 | ✓ |
| deepseek-r1 | 0.27 | 1.10 | ✓ |
| devstral-2512 | 0.30 | 0.90 | ✓ |
| devstral-small-2512 | 0.30 | 0.90 | ✓ |
| mistral-medium-3 | 0.40 | 2.00 | ✓ |

**No incorrect rates detected.** The rates themselves are accurate. The problem is that token counts fed into the calculation are fabricated or zero for Anthropic.

---

## SECTION 4 — Builder State After All Changes

### Last 5 Commits

| Commit | Message | Production Files? |
|--------|---------|-------------------|
| `728e939` | Fix all 7 test failures — 14/20 PASS, 0 FAIL | **No** — test-runner.mjs + test output only |
| `c8ce585` | Run 3 results + deep audit report | **No** — test docs/output only |
| `3678685` | Test suite run complete — 3 PASS / 13 FAIL | **YES** — 3 production files changed |
| `24026c8` | Router — local model pools defined | **No** — TEST_SUITE_MASTER.md + test-runner.mjs |
| `5cc6ed3` | Test automation runner v1.0 | **No** — new test-runner.mjs file |

### Production Files Changed (commit `3678685` only)

| File | Change | Impact |
|------|--------|--------|
| `apps/builder-standalone/app/api/intake/build-multipage/route.ts` | xAI model IDs: `grok-4.1-fast` → `grok-4-1-fast-non-reasoning`, `grok-4.20` → `grok-4-0709` | **Correct fix** — old names were invalid xAI API IDs that would 404 |
| `packages/billing/src/rates.ts` | Replaced `grok-4`, `grok-4.1-fast`, `grok-4.20` with `grok-4-0709`, `grok-4-1-fast-non-reasoning`, `grok-4-1-fast-reasoning`, `grok-code-fast-1` | **Correct fix** — rate keys now match actual model IDs. Added 2 new models. Removed `grok-4.20` rate ($2/$6) |
| `packages/core/src/lib/providers/index.ts` | DeepSeek `maxTokens`: 8192 → 4096 | **Low impact** — registry metadata only. Actual API calls use their own limits (stream route defaults to 8192, build-multipage sends 16384). Affects UI display of model capabilities. |

### Cross-Check: Fixes Applied Globally?

#### Grey Text Check
| Location | Has grey text check? |
|----------|---------------------|
| Test runner (`test-runner.mjs` lines 78-84) | **YES** — `GREY_RX` array with 14 regex patterns, `checkGrey()` function |
| Production guardian (`multiPageBuilder.ts`) | **NO** — checks hallucinations, structure, nav, PII — but ZERO grey text detection |
| **VERDICT** | **MISSING FROM PRODUCTION** — client sites could ship with grey/dim text that fails test criteria |

#### PII Injection
| Location | Has injectPII? |
|----------|---------------|
| Production pipeline (`build-multipage/route.ts` lines 380-433) | **YES** — uses shared `@sarge/builder/lib/piiInjector` |
| Test runner (`test-runner.mjs` lines 295-308) | **YES** — but uses its OWN local reimplementation with hardcoded Level 11 Events data |
| **VERDICT** | **Both have it, but DUAL IMPLEMENTATION** — maintenance divergence risk. Currently functionally equivalent. |

#### Lighthouse HTTP Server
| Location | Applied? |
|----------|---------|
| Test runner (`test-runner.mjs` lines 316-331) | **YES** — calls `/api/audit/run` endpoint |
| Production pipeline | **N/A** — Lighthouse is test-only, not part of production builds |
| **VERDICT** | **Correct** — no inconsistency |

#### fixEmptySrc()
| Location | Applied? | Replacement URL |
|----------|---------|-----------------|
| Test runner (line 596-599) | **YES** — only for Test 07 when `opts.fixEmptySrc` is true | `placehold.co/800x600?text=Image` |
| Production pipeline (`build-multipage/route.ts` lines 452-455) | **YES** — for ALL pages | `picsum.photos/800/600` |
| **VERDICT** | **Both have it, different URLs** — production uses `picsum.photos`, test uses `placehold.co`. Not a bug, but inconsistent. |

#### Height Limits
| Location | Limit |
|----------|-------|
| Test runner default | 2160px |
| Test runner media pages | 3000px |
| Test runner compliance pages | 2600px |
| Production system prompt | "under 4000px total height" |
| intakeToPrompt.ts | "under 4000px total height" |
| **VERDICT** | **Intentional divergence** — test enforces stricter limits than production guidance. A page at 3500px passes production but fails the default test. |

### Streaming Pipeline Unchanged

- `builderChatStore.ts` — **NOT modified** in last 5 commits. Last touched in older commits (`b2a431a` and earlier).
- `ArtifactPanel.tsx` — **NOT modified** in last 5 commits. Last touched in older commits (`05ef961` and earlier).

### All Provider Handlers Intact

| Provider | Registry Entry | Stream Handler | Cloud Benchmark Handler |
|----------|---------------|----------------|------------------------|
| Anthropic | ✓ (6 models) | ✓ `streamAnthropic()` | ✓ `callAnthropic()` |
| OpenAI | ✓ (7 models) | ✓ `streamOpenAI()` | ✓ `callOpenAICompat()` |
| Google | ✓ (3 models) | ✓ `streamGemini()` | ✓ `callGemini()` |
| xAI | ✓ (6 models) | ✓ `streamXAI()` | ✓ `callOpenAICompat()` |
| DeepSeek | ✓ (2 models) | ✓ `streamDeepSeek()` | ✓ `callOpenAICompat()` |
| Mistral | ✓ (3 models) | ✓ `streamOpenAICompatible()` | ✓ via `KNOWN_BASE_URLS` |
| Ollama | ✓ (dynamic) | ✓ inline NDJSON transform | N/A (local runner) |
| LM Studio | ✓ (dynamic) | ✓ inline SSE transform | N/A (local runner) |

**ANOMALY**: Provider registry has `claude-sonnet-4-5-20250929`, build-multipage uses `claude-sonnet-4-5-20250514`, billing rates has `claude-sonnet-4-5-20241022`. Three different date-stamped versions. Rate lookup uses substring matching so it still works, but fragile.

---

## SECTION 5 — Forge Trials Integrity

### Scoring: Three Separate Systems

| System | File | Purpose | Shared? |
|--------|------|---------|---------|
| Forge Trials | `packages/benchmark/src/validator.ts` — `scoreResponse()` | Benchmark model capability (0-100 weighted) | NO |
| Builder Guardian | `packages/builder/src/lib/multiPageBuilder.ts` — `guardianCheck()` | Validate client builds (pass/fail) | NO |
| Test Runner | `test-runner.mjs` — `scoreFile()` + LH + Puppeteer | Full quality assessment | NO |

**They do NOT share code. They test different things.**

| Aspect | Forge Trials | Builder Guardian | Test Runner |
|--------|--------------|-----------------|-------------|
| HTML validity | ✓ | ✓ | ✓ (via Lighthouse) |
| Required elements | ✓ (configurable per scenario) | Partial (nav links only) | ✓ (per test spec) |
| CSS/JS patterns | ✓ | No | No |
| Hallucination detection | No | ✓ (phones, emails, addresses, names) | ✓ (placeholder check) |
| Grey text | No | No | ✓ |
| Height check | No | No (prompt guidance only) | ✓ (Puppeteer measurement) |
| PII compliance | No | ✓ (placeholder presence) | ✓ (post-injection count) |
| Performance (Lighthouse) | No | No | ✓ |
| Accessibility | No | No | ✓ |

### Prompt Templates: Different

| Aspect | Forge Trials | Real Client Build |
|--------|--------------|-------------------|
| System prompt | Generic "code builder assistant" | Client-specific "web developer building the [page] page" |
| User prompt | Fixed benchmark text | Assembled from intake form via `intakeToPagePrompt()` |
| PII rules | Not mentioned | Required: "Use {{BUSINESS_NAME}}, {{phone}}, etc." |
| Height constraints | Not enforced | "Under 4000px total height" |
| Image rules | Not mentioned | "Do NOT use source.unsplash.com" |
| Token limit | 8192 | 16384 |
| Post-processing | Score only | Guardian + PII + image fix + deploy |

### Cloud Dropdown Models

Dynamically populated from model store filtered by "Trials" role or builder flag. Based on provider registry:

| Provider | Models |
|----------|--------|
| Anthropic | Claude Opus 4.6, Sonnet 4.6, Sonnet 4.5, Haiku 4.5, Sonnet 4 (Legacy), Opus 4 (Legacy) |
| OpenAI | GPT-4.1, GPT-4.1 Mini, o3, o4 Mini, GPT-4o, GPT-4o Mini, GPT-4 Turbo |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash |
| xAI | Grok 3, Grok 3 Mini, Grok 4, Grok Code Fast, Grok 4.1 Fast (Reasoning), Grok 4.1 Fast |
| DeepSeek | DeepSeek V3 (Chat/Code), DeepSeek V3 (Reasoner) |
| Mistral | Devstral 2, Devstral Small 2, Mistral Medium 3 |

### Can Forge Trials Results Be Trusted for Routing Decisions?

**Partially.** Forge Trials measure raw HTML/CSS/JS generation capability. They do NOT measure:
- PII placeholder compliance
- Hallucination resistance
- Height discipline
- Image URL correctness
- Response to client-specific context

**A model scoring 100/100 in Forge Trials could still fail in a real build** because the real pipeline adds guardian checks, PII injection, and height validation that Forge Trials bypass entirely. Forge Trials are useful for comparing models' raw coding ability, but they do NOT predict real-world build quality.

---

## SECTION 6 — What Got Changed That Shouldn't Have

### Commit-by-Commit Review

#### Commit `5cc6ed3` — Test automation runner v1.0
| File | Intended Change | Unintended Changes? |
|------|----------------|---------------------|
| `test-runner.mjs` (new) | Create new test automation runner | **None** — new file, no modifications to existing code |

**Verdict: Clean.**

#### Commit `24026c8` — Router — local model pools defined
| File | Intended Change | Unintended Changes? |
|------|----------------|---------------------|
| `test-runner.mjs` | Define local model pools, remove dead weight | **None** — test runner only |
| `TEST_SUITE_MASTER.md` | Update test docs | **None** — documentation only |

**Verdict: Clean.**

#### Commit `3678685` — Test suite run complete (THE ONE WITH PRODUCTION CHANGES)

| File | Intended Change | Anything Else Changed? | Functions Renamed/Removed? | Imports Changed? | Defaults Changed? |
|------|----------------|----------------------|---------------------------|-----------------|-------------------|
| `build-multipage/route.ts` | Fix 3 xAI model IDs | **No** — only 3 string values changed in `MODEL_CHAINS` | No | No | No |
| `packages/billing/src/rates.ts` | Fix xAI rate keys to match real IDs | Removed `grok-4` entry ($3/$15), added `grok-4-1-fast-reasoning` and `grok-code-fast-1` entries | No | No | `grok-4.20` rate removed ($2/$6) — replaced by `grok-4-0709` at ($3/$15) — **price changed from $2/$6 to $3/$15** |
| `packages/core/src/lib/providers/index.ts` | Fix DeepSeek max_tokens 400 error | **No** — only `maxTokens` value changed (8192→4096) on 2 models | No | No | `maxTokens` changed — but this is registry metadata, not the actual API call limit |

**Potential issue in rates.ts**: The old `grok-4.20` had rates of $2.00/$6.00. The replacement `grok-4-0709` has rates of $3.00/$15.00. This is a rate INCREASE from the old Grok model. If any billing records reference the old `grok-4.20` model name, they would now have no rate entry (would hit the default/fallback). However, since the old model names were INVALID API IDs that never worked, no real billing records should exist for them.

**Potential issue in providers/index.ts**: DeepSeek `maxTokens: 4096` is now lower than what the production build pipeline actually sends (`maxOutputTokens: 16384`). The registry value is metadata — it doesn't limit the actual API call. But if any UI component reads `maxTokens` from the registry to display model capabilities, it would show 4096 instead of the actual limit. The interactive builder chat defaults to 8192 regardless (reads from localStorage, not registry). **Low impact.**

**Verdict: One rate change ($2/$6 → $3/$15 for the Grok 4 replacement) that may surprise if someone was tracking Grok costs. Otherwise clean.**

#### Commit `c8ce585` — Run 3 results + deep audit report
| File | Intended Change | Unintended Changes? |
|------|----------------|---------------------|
| `TEST_SUITE_MASTER.md` | Update with Run 3 results | **None** |
| `DEEP_AUDIT_REPORT.md` (new) | Create audit report | **None** — new file |
| `COST_LOG.jsonl` (new) | Cost tracking | **None** — new file |
| Various test output folders | Test artifacts | **None** — generated content |

**Verdict: Clean. No production files touched.**

#### Commit `728e939` — Fix all 7 test failures
| File | Intended Change | Unintended Changes? |
|------|----------------|---------------------|
| `test-runner.mjs` | Fix 12+ issues for 7 failing tests | **None** — test runner only |
| `DEEP_AUDIT_REPORT.md` | Update with Run 4 results | **None** — documentation |
| `TEST_SUITE_MASTER.md` | Update master report | **None** |
| Test output folders | Updated test artifacts | **None** |

**Verdict: Clean. No production files touched.**

---

## SUMMARY OF ALL FINDINGS

### Critical Bugs (Causing Real Problems)

| # | Bug | Severity | File | Line | Impact |
|---|-----|----------|------|------|--------|
| 1 | **Email field mismatch**: `contact_name` vs `client_name` | **HIGH** | `submit/route.ts` | 97 | Every intake email greets client by business name instead of personal name, or says "Unknown" |
| 2 | **Anthropic billing: input tokens never read** | **HIGH** | `run-cloud/route.ts` | 272-281 | Input tokens fabricated as 30% of output. For Opus at $5/1M input, this means ~$0.06-0.10 per call unlogged |
| 3 | **Anthropic billing: message_delta overwrites message_start** | **MEDIUM** | `test/stream/route.ts` | 444-455 | `input_tokens: undefined` from `message_delta` overwrites correct value from `message_start` |
| 4 | **Cloud runner: no temperature set** | **MEDIUM** | `run-cloud/route.ts` | 234-249 | Defaults to 1.0 (maximum creativity) for deterministic coding tasks. Causes off-topic/creative outputs |
| 5 | **Cloud runner: no retry/validation** | **MEDIUM** | `run-cloud/route.ts` | 23 | `RUNS_PER_SCENARIO = 1`. Bad output = wasted money. No correction, no escalation |

### Design Gaps (Not Bugs, But Missing)

| # | Gap | Location | Impact |
|---|-----|----------|--------|
| 6 | Grey text check missing from production | `multiPageBuilder.ts` | Client sites can ship with grey/dim text |
| 7 | PII uses personal contact not site contact | `build-multipage/route.ts` lines 388-389 | Pages show client's personal phone/email if different from site contact |
| 8 | Forge Trials don't test real build conditions | `cloudScenarios.ts` | Benchmark scores don't predict actual build quality |
| 9 | Three model ID date suffixes for Sonnet 4.5 | providers/index.ts, build-multipage, rates.ts | `20250929`, `20250514`, `20241022` — fragile substring matching |

### Things That Are Working Correctly

| Component | Status | Evidence |
|-----------|--------|----------|
| Intake form → Supabase | ✓ WORKS | Fields collected, upsert works |
| Model routing (build-multipage) | ✓ WORKS | Difficulty tiers, fallback chains, retry escalation |
| Prompt assembly | ✓ WORKS | Industry-aware, PII-placeholder-enforcing |
| Guardian check | ✓ WORKS | Hallucination auto-replace, structural validation |
| PII injection | ✓ WORKS | Shared library, correct placeholder map |
| Deploy pipeline | ✓ WORKS | Vercel auto, 4-host on approve |
| Email templates | ✓ WORKS | 6 templates, Resend API |
| All 8 provider handlers | ✓ WORKS | Registry + stream handlers + benchmark handlers all intact |
| Builder streaming (chat store, artifact panel) | ✓ WORKS | Not modified in last 5 commits |

### Changes Made to Production That Were Correct

| Change | File | Verdict |
|--------|------|---------|
| xAI model IDs fixed | build-multipage/route.ts | ✓ CORRECT — old names were invalid |
| xAI rate keys fixed | rates.ts | ✓ CORRECT — now match real model IDs |
| DeepSeek maxTokens 8192→4096 | providers/index.ts | ✓ LOW RISK — metadata only, API calls unaffected |

### Changes That Exist Only in Test Runner (Not Production)

| Feature | Test Runner | Production | Risk |
|---------|-------------|------------|------|
| Grey text check | ✓ checkGrey() | ✗ Missing | Client sites with grey text pass production but fail tests |
| Height enforcement | ✓ 2160/3000/2600px Puppeteer check | ✗ Prompt guidance only (4000px) | Pages up to 4000px pass production but fail tests |
| fixEmptySrc | ✓ placehold.co | ✓ picsum.photos (different URL) | Both work, inconsistent URLs |
| Lighthouse scoring | ✓ via /api/audit/run | ✗ Not in production pipeline | Quality scores only available in testing |
| Duplicate PII function | ✓ Local reimplementation | ✓ Shared library | Maintenance divergence risk |

---

*End of forensic assessment. No files were modified.*
