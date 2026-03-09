# Prompt Comparison — Forge Trials vs Production Builder

**Date**: 2026-03-08
**Purpose**: Documents the gap between Forge Trials benchmark prompts and production builder prompts. These are intentionally different today. Alignment is a separate decision.

---

## Forge Trials System Prompt

**File**: `packages/benchmark/src/cloudScenarios.ts` (line 9)
**Used by**: `apps/builder-standalone/app/api/benchmark/run-cloud/route.ts`

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

---

## Production Builder System Prompt

**File**: `apps/builder-standalone/app/api/intake/build-multipage/route.ts` (line 789 Ollama / line 828 Cloud)
**Used by**: Multi-page build pipeline for real client sites

```
You are a web developer building the "[pageName]" page for a client website.

OUTPUT RULES:
- Output ONLY the complete HTML file — no explanations, no markdown fences.
- Start with <!DOCTYPE html> and end with </html>.
- Include ALL CSS in <style> tags and ALL JavaScript in <script> tags.
- The page MUST be fully self-contained, responsive, and production-quality.
- Use the shared navigation HTML provided in the prompt — include it exactly as given.
- The page must be substantial — at least 200 lines of HTML with real content sections.
- Use PII placeholders: {{BUSINESS_NAME}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{client_name}}.
- Each page must fit in 2-3 viewport heights max at 1920x1080 (under 4000px total height). Do NOT create infinitely scrolling pages.
- Use tabs, accordions, expandable sections instead of stacking everything vertically. Content-heavy sections should be collapsible.
- Do NOT use source.unsplash.com URLs — this service is deprecated and returns 404. For stock images, use https://picsum.photos/{width}/{height} (e.g. https://picsum.photos/800/600). Do NOT leave any img src empty.
```

---

## Side-by-Side Differences

| Aspect | Forge Trials | Production Builder | Impact |
|--------|--------------|-------------------|--------|
| **Role** | "code builder assistant" | "web developer building the [page] page for a client website" | **DIFFERENT** — production is client-aware |
| **Output format** | "single complete HTML file" + "code block" | "Output ONLY the complete HTML file — no explanations, no markdown fences" | **DIFFERENT** — Forge expects markdown fences; production forbids them |
| **Explanations** | "Start with a brief explanation" | "no explanations" | **OPPOSITE** — Forge WANTS explanations; production FORBIDS them |
| **CDN libs** | "No external dependencies except CDN libraries" | Not mentioned | **DIFFERENT** — production doesn't restrict/allow CDN explicitly |
| **Self-contained** | Implicit | "fully self-contained, responsive, and production-quality" | **DIFFERENT** — production adds quality bar |
| **Navigation** | Not mentioned | "Use the shared navigation HTML provided in the prompt" | **MISSING from Forge** — Forge doesn't test nav integration |
| **Minimum length** | Not specified | "at least 200 lines" | **MISSING from Forge** |
| **PII placeholders** | Not mentioned | Required: {{BUSINESS_NAME}}, {{phone}}, {{email}}, etc. | **MISSING from Forge** — models not tested on placeholder compliance |
| **Height constraint** | Not mentioned | "2-3 viewport heights max (under 4000px)" | **MISSING from Forge** — models not tested on height discipline |
| **Layout guidance** | Not mentioned | "tabs, accordions, expandable sections" | **MISSING from Forge** |
| **Image URLs** | Not mentioned | "Do NOT use source.unsplash.com" + use picsum.photos | **MISSING from Forge** — models not tested on image URL compliance |
| **Empty img src** | Not mentioned | "Do NOT leave any img src empty" | **MISSING from Forge** |
| **Temperature** | 0.3 (as of fix) | 0.7 (Ollama) / default (cloud via /api/test/stream) | **DIFFERENT** — Forge is more deterministic |

---

## What This Means

A model scoring 100/100 in Forge Trials may still fail production builds because:
1. It was never asked to use PII placeholders during benchmarks
2. It was never constrained on height
3. It was never given navigation snippets to integrate
4. It was told to include explanations (which production strips/rejects)
5. It was never tested with picsum.photos image rules

Forge Trials measure **raw HTML/CSS/JS generation capability**. Production requires **compliant, client-ready pages with business data handling**.

---

## Decision Needed

Should the Forge Trials prompt be aligned to production? Options:
1. **Full alignment** — use the production prompt in Forge Trials (most accurate benchmarks, but tests become harder)
2. **Partial alignment** — add PII/height/image rules to Forge Trials but keep the generic role
3. **Keep separate** — Forge Trials measures raw coding ability, production adds business rules (current state)

This is a product decision, not a code fix. The gap is now documented.
