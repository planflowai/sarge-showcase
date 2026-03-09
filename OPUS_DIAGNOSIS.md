# Opus Prompt Diagnosis — Cloud Forge Trials

**Date**: 2026-03-08
**Issue**: Claude Opus 4.6 builds interactive dashboards when asked for restaurant websites
**Method**: Code trace only — no test runs executed

---

## 1. Exact Prompts Logged — Anthropic vs DeepSeek

### Both providers receive identical text

**System prompt** (all providers, all scenarios):
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

**User prompt** for R1 Restaurant (all providers):
```
Build a complete restaurant website: animated hero with parallax background image effect, navigation bar
with smooth scroll to sections, food menu organized by category (appetizers/mains/desserts) with prices
and descriptions, image gallery section, reservation form with date picker and party size selector using
vanilla JS, customer testimonials carousel that auto-rotates, Google Maps embed placeholder div, footer
with hours/address/social links. Professional color scheme. Fully responsive. Output a single complete
HTML file with all CSS in a style tag and all JS in a script tag. No external dependencies except CDN
libraries (Tailwind, Font Awesome, Google Fonts are fine). The file must be fully functional when opened
in a browser.
```

**Confirmed at**: `run-cloud/route.ts` lines 624-634 — debug logging emits provider, model, scenario, temperature, system prompt (first 500 chars), and user prompt (first 500 chars) before every `callCloudDirect()` call.

---

## 2. How Each Provider Receives the Prompt

### Anthropic (Claude Opus)
**File**: `apps/builder-standalone/app/api/benchmark/run-cloud/route.ts` lines 215-324

```
POST https://api.anthropic.com/v1/messages
Headers:
  Content-Type: application/json
  x-api-key: <ANTHROPIC_API_KEY>
  anthropic-version: 2023-06-01

Body:
{
  "model": "claude-opus-4-6",
  "max_tokens": 8192,
  "stream": true,
  "temperature": 0.3,
  "system": "<system prompt text>",        ← top-level field
  "messages": [
    { "role": "user", "content": "<user prompt text>" }
  ]
}
```

**Key**: System prompt is a top-level `system` field. Single user message. No `top_p`. No `tools`. No conversation history. Temperature hardcoded at 0.3 (line 248).

### DeepSeek (via OpenAI-compat handler)
**File**: `apps/builder-standalone/app/api/benchmark/run-cloud/route.ts` lines 108-211

```
POST https://api.deepseek.com/chat/completions
Headers:
  Content-Type: application/json
  Authorization: Bearer <DEEPSEEK_API_KEY>

Body:
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "<system prompt text>" },   ← in messages array
    { "role": "user", "content": "<user prompt text>" }
  ],
  "max_tokens": 8192,
  "stream": true,
  "temperature": 0.3
}
```

**Key**: System prompt is in the messages array as `role: "system"`. Temperature identical at 0.3 (line 145). Same max_tokens.

### Structural Difference
| Aspect | Anthropic | DeepSeek |
|--------|-----------|----------|
| System prompt | Top-level `system` field | `{role:"system"}` in messages array |
| Auth header | `x-api-key` | `Authorization: Bearer` |
| Temperature | 0.3 (hardcoded line 248) | 0.3 (hardcoded line 145) |
| max_tokens | 8192 (hardcoded line 246) | 8192 (passed as TOKEN_LIMIT, line 62) |
| top_p | Not sent | Not sent |
| tools | Not sent | Not sent |
| stream_options | Not sent | Not sent |

**These are API format differences per each provider's spec. The actual text content is byte-for-byte identical.**

---

## 3. Retry Logic — DOES NOT EXIST

### In the cloud benchmark runner:
```
for each model:
  for each scenario:
    for run in 1..3:                       // RUNS_PER_SCENARIO = 3 (line 23)
      debug_log(provider, model, prompt)   // lines 624-634
      result = callCloudDirect(...)        // line 636-643 — single call, no retry
      if result.error → push score 0
      else → score the result
    take median of 3 run scores
```

**There is no retry on failure, no prompt modification between runs, no temperature escalation.** The 3 runs exist for statistical smoothing (median), not for retries. Each run sends the exact same prompt at the exact same temperature.

**File**: `run-cloud/route.ts` line 589 — the inner loop `for (let run = 0; run < RUNS_PER_SCENARIO; run++)`.

### In the Builder streaming route:
**File**: `apps/builder-standalone/app/api/test/stream/route.ts`

The Builder streaming route (`/api/test/stream`) has **zero retry logic**. If the Anthropic call at line 410 returns an error, it's returned directly to the client (line 427-428). No fallback, no retry, no prompt modification.

### Fallback system exists but is NOT used:
The `packages/core/src/lib/fallback/` directory contains a full retry/fallback framework:
- `fallbackService.ts` — retry loop with exponential backoff
- `errorClassification.ts` — error type detection
- `retry.ts` — backoff calculation with jitter
- `config.ts` — fallback chains (Opus → Sonnet → GPT-4o → Gemini Flash)
- `circuitBreaker.ts` — failure threshold tracking

**This system is only used by `chatWithFallback()` in the Beast monolith (port 5000).** The builder-standalone app (port 3101) does NOT use it. Both the benchmark runner and the Builder streaming route make direct API calls with no fallback wrapper.

---

## 4. Builder Streaming — Different Code Path

The interactive Builder chat uses a **different streaming endpoint** than Forge Trials:

**File**: `apps/builder-standalone/app/api/test/stream/route.ts` lines 379-464

### Anthropic streaming handler (`streamAnthropic`):
```typescript
streamAnthropic(model, prompt, systemPrompt, images, history, tokenLimit)

// Line 410-423:
fetch('https://api.anthropic.com/v1/messages', {
  body: JSON.stringify({
    model,
    max_tokens: tokenLimit,     // default 8192
    stream: true,
    system: systemPrompt || undefined,
    messages: anthropicMessages, // history + current user message with images
  })
})
```

**Notable differences from benchmark runner**:
| Aspect | Builder Stream | Benchmark Runner |
|--------|---------------|-----------------|
| Temperature | **NOT SENT** (API default) | 0.3 (hardcoded) |
| Images | Supported (base64 vision) | Not supported |
| History | Included (conversation) | Not included |
| System prompt | From `builderChatStore` | From scenario definition |
| max_tokens | Configurable (default 8192) | Hardcoded 8192 |

**The Builder stream does NOT send a `temperature` parameter.** This means Anthropic uses its API default temperature, which is typically 1.0. This is a significant difference from the benchmark's 0.3.

### DeepSeek streaming handler (`streamDeepSeek`):
```typescript
streamDeepSeek(model, messages, tokenLimit)

// Line 663-669:
fetch('https://api.deepseek.com/chat/completions', {
  body: JSON.stringify({
    model,
    messages,
    max_tokens: tokenLimit,
    stream: true,
    stream_options: { include_usage: true }
  })
})
```

**DeepSeek also does NOT send temperature** in the Builder stream. Both providers use API defaults for interactive Builder chat.

---

## 5. SSE Response Parsing Differences

### Anthropic SSE format (lines 432-459):
```
event: message_start
data: {"type":"message_start","message":{"usage":{"input_tokens":N}}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"text":"chunk"}}

event: message_delta
data: {"type":"message_delta","usage":{"output_tokens":N}}
```
Parsed as: `data.delta.text` for content, `data.message.usage.input_tokens` for input, `data.usage.output_tokens` for output.

### DeepSeek SSE format (lines 677-706):
```
data: {"choices":[{"delta":{"content":"chunk"}}]}
data: {"choices":[{"delta":{"reasoning_content":"thinking..."}}]}
data: {"usage":{"prompt_tokens":N,"completion_tokens":N}}
data: [DONE]
```
Parsed as: `data.choices[0].delta.content` for content, `data.choices[0].delta.reasoning_content` for reasoning, `data.usage.prompt_tokens`/`completion_tokens` for tokens.

**Both are correctly transformed into the same NDJSON format**: `{ message: { content: "..." } }` + `{ usage: { input_tokens: N, output_tokens: N } }`.

---

## 6. Core Provider — Separate Code Path (Not Used by Builder)

**File**: `packages/core/src/lib/providers/anthropic.ts` lines 19-114

This is a **third code path** used only by the Beast monolith's `chatWithFallback()`:

```typescript
const isNewModel = model.includes('4-5') || model.includes('4-6')
  || model.includes('4.5') || model.includes('4.6');

const response = await client.messages.create({
  model,
  max_tokens: options?.maxTokens ?? 4096,
  temperature: options?.temperature ?? 0.7,
  ...(isNewModel ? {} : { top_p: options?.topP ?? 1 }),  // ← new models skip top_p
  ...(systemPrompt ? { system: systemPrompt } : {}),
  messages: formatted,
  tools: [webSearchTool],  // web_search_20250305, max_uses: 5
});
```

**This path has three differences**:
1. Temperature defaults to 0.7 (not 0.3 like trials, not omitted like Builder stream)
2. New models (4.5+, 4.6) skip `top_p` to avoid API rejection
3. Web search tool is automatically included

**The builder-standalone app at port 3101 does NOT use this code path.** It's only relevant for Beast (port 5000), which is currently stopped.

---

## 7. Root Cause Analysis

### Why Opus builds dashboards instead of restaurant websites:

1. **The prompts are identical across all providers.** Confirmed by reading all handler functions and the debug logging at lines 624-634. No conditional prompt modification by provider.

2. **Temperature 0.3 is low but not deterministic.** At 0.3, Opus has enough freedom to express strong training priors. If Opus's training data heavily featured dashboard/SPA patterns, it may default to that architecture for complex multi-feature pages.

3. **The system prompt is generic.** It says "You are a code builder assistant" — it never says "build a website for a real business" or "this must look like a customer-facing website, not a dashboard." The production Builder prompt (in `builderChatStore.ts`) includes PII placeholders, responsive layout rules, and explicit "this is a client's website" framing. The Forge Trials prompt lacks all of that context.

4. **Scoring doesn't validate content type.** `scoreResponse()` checks for required HTML elements and keywords but doesn't verify "is this actually a restaurant website?" A dashboard with `nav`, `form`, `section`, and the word "menu" could score well even if it looks nothing like a restaurant site.

5. **No feedback between runs.** The 3 runs per scenario send identical prompts. If run 1 produces a dashboard, runs 2 and 3 will likely produce the same thing at temperature 0.3.

---

## 8. Recommendations

1. **Temperature 0.0 for Forge Trials** — make benchmark runs deterministic
2. **Enhance system prompt** — add "You are building a client-facing WEBSITE, not a dashboard or admin panel"
3. **Content-type scoring penalty** — if the prompt says "restaurant website" and the output looks like a dashboard (no hero image, no food photos, data-table-heavy), penalize heavily
4. **Add Builder stream temperature** — the Builder streaming route omits temperature entirely. Consider adding `temperature: 0.7` explicitly for consistency with the core provider defaults
5. **Capture output samples** — debug logging now captures first 200 chars of output (`run-cloud/route.ts` line 187). Run a single Opus trial and compare the opening pattern against DeepSeek

---

## 9. File Map

| File | Lines | What It Does |
|------|-------|-------------|
| `apps/builder-standalone/app/api/benchmark/run-cloud/route.ts` | 54-104 | `callCloudDirect()` — dispatches to provider handlers |
| Same | 108-211 | `callOpenAICompat()` — DeepSeek/OpenAI/xAI calls (temp 0.3, max_tokens 8192) |
| Same | 215-324 | `callAnthropic()` — Claude calls (temp 0.3, max_tokens 8192) |
| Same | 624-634 | Debug logging before each trial |
| `apps/builder-standalone/app/api/test/stream/route.ts` | 379-464 | `streamAnthropic()` — Builder chat (NO temperature sent, NO tools) |
| Same | 660-711 | `streamDeepSeek()` — Builder chat (NO temperature sent) |
| Same | 228-232 | Model routing: `model.includes('claude')` → streamAnthropic |
| Same | 252-256 | Model routing: `model.includes('deepseek')` → streamDeepSeek |
| `packages/core/src/lib/providers/anthropic.ts` | 19-114 | Core Anthropic (Beast only, temp 0.7, web search, top_p logic) |
| `packages/core/src/lib/providers/deepseek.ts` | 85-158 | Core DeepSeek (Beast only, temp 0.7, Tavily search, no vision) |
| `packages/core/src/lib/fallback/fallbackService.ts` | 54-232 | Retry/fallback loop (Beast only, NOT used by builder-standalone) |

---

## 10. Key Finding

**The prompts are byte-for-byte identical across all providers.** If Opus builds dashboards instead of restaurant websites, it's a model behavior issue at temperature 0.3, not a prompt construction bug. The fix is prompt engineering (be more explicit) or temperature adjustment (use 0.0 for benchmarks).

No test run was executed. This diagnosis is based entirely on code trace.
