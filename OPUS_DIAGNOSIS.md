# Opus Prompt Diagnosis — Cloud Forge Trials

**Date**: 2026-03-08
**Issue**: Claude Opus 4.6 builds interactive dashboards when asked for restaurant websites

---

## 1. Prompt Assembly — All Providers Get Identical Prompts

**File**: `apps/builder-standalone/app/api/benchmark/run-cloud/route.ts`

The cloud runner passes `scenario.systemPrompt` and `scenario.prompt` directly to `callCloudDirect()` at line 624-631. `callCloudDirect()` is a switch statement that dispatches to provider-specific handlers:

- `callOpenAICompat()` — DeepSeek, OpenAI, xAI, Mistral, etc.
- `callAnthropic()` — Claude
- `callGemini()` — Google

**Every provider receives the exact same `systemPrompt` and `userPrompt` strings.** There is no conditional logic that modifies the prompt based on provider. Confirmed by reading all three handler functions.

### Exact System Prompt (all providers):
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

### Exact User Prompt for R1 Restaurant (all providers):
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

### How Each Provider Receives It:

| Provider | System Prompt Method | User Message Method |
|----------|---------------------|-------------------|
| OpenAI-compat | `messages: [{role:"system", content: systemPrompt}, {role:"user", content: userPrompt}]` | In messages array |
| Anthropic | `system: systemPrompt` (top-level field) | `messages: [{role:"user", content: userPrompt}]` |
| Gemini | Injected as user/model pair before actual user message | `contents: [{role:"user", parts:[{text: userPrompt}]}]` |

**Difference**: Anthropic uses a top-level `system` field; others put it in the messages array. This is per each API's spec and should not cause behavior differences.

---

## 2. Retry Logic — DOES NOT EXIST

There is **no retry logic** in the cloud runner. The code structure is:

```
for each model:
  for each scenario:
    for run in 1..RUNS_PER_SCENARIO:   // RUNS_PER_SCENARIO = 3
      result = callCloudDirect(...)     // Single call, no retry on failure
      if result.error → push score 0, continue to next run
      else → score the result
    take median of 3 runs
```

`RUNS_PER_SCENARIO = 3` is for **median scoring** (statistical smoothing), NOT for retries. If run 1 produces a dashboard instead of a restaurant, run 2 and run 3 send the **exact same prompt** again — there is no feedback loop, no "try harder" escalation, no prompt modification between runs.

The COMPREHENSIVE_FIX_PROMPT.md stated: *"The first two attempts were flagged 'output invalid'"* — this **cannot happen** in this code. There is no output validation that flags results as "invalid" and retries. There is only scoring after the fact.

---

## 3. Why Opus Might Build a Dashboard Instead of a Restaurant

Since all providers get identical prompts and there's no retry logic, possible causes:

### 3A. Model Behavior at Temperature 0.3
Temperature 0.3 is low but not deterministic (0.0). Opus may have a strong prior toward "interactive dashboard" as a default architecture pattern. The restaurant prompt is complex (13+ features), and Opus might be interpreting the feature list (data tables, selectors, form inputs, carousel) as dashboard-like.

### 3B. System Prompt Is Generic
The system prompt says "You are a code builder assistant" — it doesn't say "you are building a WEBSITE for a REAL BUSINESS." The production builder prompt (in `build-multipage/route.ts`) includes PII placeholders, height constraints, image rules, and explicit "this is a client's website" framing. The Forge Trials prompt lacks all of that context.

### 3C. Scoring Doesn't Hard-Fail on Wrong Content Type
The `scoreResponse()` function checks for required elements and keywords but doesn't have a "is this actually a restaurant website?" check. Opus might score reasonably well on a dashboard that happens to include `nav`, `section`, `form`, `footer`, and words like "menu" and "reservation" — even if it's structured as a dashboard rather than a restaurant website.

### 3D. No Temperature 0.0 Option
If reproducibility matters more than creativity, Opus specifically might benefit from temperature 0.0 for benchmark runs. Other models may produce acceptable variety at 0.3, but Opus may have a stronger tendency to default to its training priors at low-but-nonzero temperatures.

---

## 4. Recommendations

1. **Add `temperature: 0.0`** for Forge Trials specifically (reproducible benchmarks)
2. **Enhance the system prompt** with "You are building a client-facing WEBSITE, not a dashboard or admin panel. The output must look like a real business website."
3. **Add content-type validation** in scoring: if the prompt says "restaurant website" and the output doesn't have restaurant-specific visual elements (hero image, food menu with prices, hours of operation), penalize heavily.
4. **Compare Opus output directly**: Run R1 with debug logging enabled, capture the full response from Opus vs DeepSeek, and compare what each model actually generates. Debug logging has been added to the cloud runner for this purpose.

---

## 5. Debug Logging Added

**File**: `apps/builder-standalone/app/api/benchmark/run-cloud/route.ts` (line ~624)

Before every `callCloudDirect()`, the runner now logs:
- Provider, Model, Scenario ID, Scenario name
- Temperature (confirmed 0.3)
- System prompt (first 500 chars)
- User prompt (first 500 chars)
- Timeout and run number

To capture: run a Cloud Trial with Opus selected, check the server terminal output for `=== CLOUD TRIAL REQUEST DEBUG ===` blocks.

---

## 6. Key Finding

**The prompts are identical across all providers.** If Opus builds the wrong thing, it's not because it receives different instructions — it's because Opus interprets the same instructions differently than other models. The fix is either prompt engineering (be more explicit about what NOT to build) or temperature adjustment (0.0 for benchmarks).
