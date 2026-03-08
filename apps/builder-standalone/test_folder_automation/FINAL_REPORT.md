# S.A.R.G.E. BUILDER — FINAL TEST REPORT
Generated: 2026-03-08T17:44:20.788Z

## Results

| # | Test | Status | Median | Model | Cost |
|---|------|--------|--------|-------|------|
| 01 | Basic Page | ✅ PASS | 97 | deepseek:deepseek-chat | $0.0066 |
| 02 | Cards + Accordion/Tabs | ✅ PASS | 91 | ollama:qwen2.5-coder:7b | $0.0000 |
| 03 | Stock Images + Video | ❌ FAIL | 0 | — | $0.0000 |
| 04 | Asset Management | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 05 | Forms + Newsletter | ❌ FAIL | 0 | ollama:codellama:7b | $0.0000 |
| 06 | Conversion Elements | ❌ FAIL | 0 | ollama:qwen2.5-coder:7b | $0.0000 |
| 07 | Gallery + Maps + Social | ❌ FAIL | 0 | ollama:qwen2.5-coder:7b | $0.0000 |
| 08 | PII + Guardian | ❌ FAIL | 0 | — | $0.0000 |
| 09 | Email Suite | ❌ FAIL | 0 | — | $0.0000 |
| 10 | Chatbot | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 11 | Voice | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 12 | Generative Media | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 13 | Compliance + A11y | ❌ FAIL | 0 | — | $0.0000 |
| 14 | Dark/Light Toggle | ❌ FAIL | 0 | ollama:codellama:7b | $0.0000 |
| 15 | Multi-Page | ❌ FAIL | 0 | — | $0.0000 |
| 16 | Blog Layout | ❌ FAIL | 0 | ollama:qwen2.5-coder:7b | $0.0000 |
| 17 | Multi-Language | ❌ FAIL | 0 | — | $0.0000 |
| 18 | Visual Review | ❌ FAIL | 97 | deepseek:deepseek-chat | $0.0023 |
| 19 | Billing | ✅ PASS | 100 | — | $0.0000 |
| 20 | Full Site Build | ❌ FAIL | 0 | — | $0.0000 |

**3 PASS / 13 FAIL / 4 NEEDS BUILD**
**Total cost: $0.0090**
**Total time: 56.7 minutes**

## NEEDS BUILD

- **Test 04 — Asset Management**: Asset upload endpoints exist but intake-section-based folder routing (logo/, hero/, services/, team/, gallery/) not verified. Need: logo upload accepted, assets routed to correct subfolder by intake section.
- **Test 10 — Chatbot**: Chatbot widget not in builder pipeline. Need: static FAQ widget, live AI API call, provider switching (2+ providers).
- **Test 11 — Voice**: Voice in chat module, not builder pipeline. Need: TTS output, STT input, 3+ male/female voices as embeddable widget.
- **Test 12 — Generative Media**: API calls attempted. Pipeline integration (auto-embed in built pages) not implemented. Need: generation during page build, branded assets in output HTML.

## NEEDS FIX

- **Test 03 — Stock Images + Video**: build
- **Test 05 — Forms + Newsletter**: LH P:0 A:0 S:0 BP:0
- **Test 06 — Conversion Elements**: LH P:0 A:0 S:0 BP:0; ph(1)
- **Test 07 — Gallery + Maps + Social**: LH P:0 A:0 S:0 BP:0; assets(empty src)
- **Test 08 — PII + Guardian**: Build failed: All models exhausted
- **Test 09 — Email Suite**: welcome: Unexpected token 'I', "Internal S"... is not valid JSON; intake_received: Unexpected token 'I', "Internal S"... is not valid JSON; site_live: Unexpected token 'I', "Internal S"... is not valid JSON
- **Test 13 — Compliance + A11y**: build
- **Test 14 — Dark/Light Toggle**: LH P:0 A:0 S:0 BP:0; ph(1); no JS
- **Test 15 — Multi-Page**: Home: build failed; Services: build failed; Contact: build failed; missing headers; missing footers; LH P:0 A:0 S:0 BP:0
- **Test 16 — Blog Layout**: LH P:0 A:0 S:0 BP:0
- **Test 17 — Multi-Language**: build
- **Test 18 — Visual Review**: review failed
- **Test 20 — Full Site Build**: Pipeline: The operation was aborted due to timeout

## Per-Test Details

### Test 01 — Basic Page
Status: PASS | Median: 97 | Cost: $0.0066 | Model: deepseek:deepseek-chat
Reason: All criteria met. Median: 97
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0022
    ✓ lighthouse, height, grey, placeholders, assets, nav, hero, footer, no-images
  Run 2: score=97 model=deepseek:deepseek-chat cost=$0.0021
    ✓ lighthouse, height, grey, placeholders, assets, nav, hero, footer, no-images
  Run 3: score=97 model=deepseek:deepseek-chat cost=$0.0024
    ✓ lighthouse, height, grey, placeholders, assets, nav, hero, footer, no-images

### Test 02 — Cards + Accordion/Tabs
Status: PASS | Median: 91 | Cost: $0.0000 | Model: ollama:qwen2.5-coder:7b
Reason: All criteria met. Median: 91
  Run 1: score=91 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, placeholders, assets, 4 cards, accordion, tabs, JS
  Run 2: score=91 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, placeholders, assets, 4 cards, accordion, tabs, JS
  Run 3: score=92 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, placeholders, assets, 4 cards, accordion, tabs, JS

### Test 03 — Stock Images + Video
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: build
  Run 1: score=0 model=none cost=$0.0000
    ✗ build

### Test 04 — Asset Management
Status: NEEDS BUILD | Median: 0 | Cost: $0.0000 | Model: —
Reason: Asset upload endpoints exist but intake-section-based folder routing (logo/, hero/, services/, team/, gallery/) not verified. Need: logo upload accepted, assets routed to correct subfolder by intake section.

### Test 05 — Forms + Newsletter
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: ollama:codellama:7b
Reason: LH P:0 A:0 S:0 BP:0
  Run 1: score=0 model=ollama:codellama:7b cost=$0.0000
    ✓ height, grey, placeholders, assets, form, validation, newsletter
    ✗ LH P:0 A:0 S:0 BP:0

### Test 06 — Conversion Elements
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: ollama:qwen2.5-coder:7b
Reason: LH P:0 A:0 S:0 BP:0; ph(1)
  Run 1: score=0 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ height, grey, assets, calendar, countdown, pricing, pdf link
    ✗ LH P:0 A:0 S:0 BP:0, ph(1)

### Test 07 — Gallery + Maps + Social
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: ollama:qwen2.5-coder:7b
Reason: LH P:0 A:0 S:0 BP:0; assets(empty src)
  Run 1: score=0 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ height, grey, placeholders, lightbox, map, social
    ✗ LH P:0 A:0 S:0 BP:0, assets(empty src)

### Test 08 — PII + Guardian
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: Build failed: All models exhausted

### Test 09 — Email Suite
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: welcome: Unexpected token 'I', "Internal S"... is not valid JSON; intake_received: Unexpected token 'I', "Internal S"... is not valid JSON; site_live: Unexpected token 'I', "Internal S"... is not valid JSON
  Run 1: score=0 model=api cost=$0.0000
    ✗ welcome: Unexpected token 'I', "Internal S"... is not valid JSON, intake_received: Unexpected token 'I', "Internal S"... is not valid JSON, site_live: Unexpected token 'I', "Internal S"... is not valid JSON

### Test 10 — Chatbot
Status: NEEDS BUILD | Median: 0 | Cost: $0.0000 | Model: —
Reason: Chatbot widget not in builder pipeline. Need: static FAQ widget, live AI API call, provider switching (2+ providers).

### Test 11 — Voice
Status: NEEDS BUILD | Median: 0 | Cost: $0.0000 | Model: —
Reason: Voice in chat module, not builder pipeline. Need: TTS output, STT input, 3+ male/female voices as embeddable widget.

### Test 12 — Generative Media
Status: NEEDS BUILD | Median: 0 | Cost: $0.0000 | Model: —
Reason: API calls attempted. Pipeline integration (auto-embed in built pages) not implemented. Need: generation during page build, branded assets in output HTML.

### Test 13 — Compliance + A11y
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: build
  Run 1: score=0 model=none cost=$0.0000
    ✗ build

### Test 14 — Dark/Light Toggle
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: ollama:codellama:7b
Reason: LH P:0 A:0 S:0 BP:0; ph(1); no JS
  Run 1: score=0 model=ollama:codellama:7b cost=$0.0000
    ✓ height, grey, assets, toggle, dark bg, light bg
    ✗ LH P:0 A:0 S:0 BP:0, ph(1), no JS

### Test 15 — Multi-Page
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: Home: build failed; Services: build failed; Contact: build failed; missing headers; missing footers; LH P:0 A:0 S:0 BP:0
  Run 1: score=0 model= cost=$0.0000
    ✓ link→index.html, link→services.html, link→contact.html
    ✗ Home: build failed, Services: build failed, Contact: build failed, missing headers, missing footers, LH P:0 A:0 S:0 BP:0

### Test 16 — Blog Layout
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: ollama:qwen2.5-coder:7b
Reason: LH P:0 A:0 S:0 BP:0
  Run 1: score=0 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ height, grey, placeholders, assets, posts, categories, pagination
    ✗ LH P:0 A:0 S:0 BP:0

### Test 17 — Multi-Language
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: build
  Run 1: score=0 model=none cost=$0.0000
    ✗ build

### Test 18 — Visual Review
Status: FAIL | Median: 97 | Cost: $0.0023 | Model: deepseek:deepseek-chat
Reason: review failed
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0023
    ✓ screenshots, lighthouse
    ✗ review failed

### Test 19 — Billing
Status: PASS | Median: 100 | Cost: $0.0000 | Model: —
Reason: 44 calls logged, $0.0665 total
  Run 1: score=100 model=audit cost=$0.0000
    ✓ 44 calls logged, $0.0665 tracked

### Test 20 — Full Site Build
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: Pipeline: The operation was aborted due to timeout
  Run 1: score=0 model=pipeline cost=$0.0000
    ✗ Pipeline: The operation was aborted due to timeout
