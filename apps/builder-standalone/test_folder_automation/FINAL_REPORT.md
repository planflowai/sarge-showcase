# S.A.R.G.E. BUILDER — FINAL TEST REPORT
Generated: 2026-03-08T20:14:02.158Z

## Results

| # | Test | Status | Median | Model | Cost |
|---|------|--------|--------|-------|------|
| 01 | Basic Page | ✅ PASS | 97 | deepseek:deepseek-chat | $0.0070 |
| 02 | Cards + Accordion/Tabs | ✅ PASS | 97 | deepseek:deepseek-chat | $0.0117 |
| 03 | Stock Images + Video | ❌ FAIL | 88 | deepseek:deepseek-chat | $0.0092 |
| 04 | Asset Management | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 05 | Forms + Newsletter | ✅ PASS | 97 | ollama:qwen2.5-coder:7b | $0.0071 |
| 06 | Conversion Elements | ✅ PASS | 97 | deepseek:deepseek-chat | $0.0169 |
| 07 | Gallery + Maps + Social | ❌ FAIL | 93 | deepseek:deepseek-chat | $0.0074 |
| 08 | PII + Guardian | ❌ FAIL | 97 | deepseek:deepseek-chat | $0.0035 |
| 09 | Email Suite | ❌ FAIL | 67 | — | $0.0000 |
| 10 | Chatbot | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 11 | Voice | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 12 | Generative Media | 🔧 NEEDS BUILD | 0 | — | $0.0000 |
| 13 | Compliance + A11y | ❌ FAIL | 97 | deepseek:deepseek-chat | $0.0089 |
| 14 | Dark/Light Toggle | ✅ PASS | 97 | deepseek:deepseek-chat | $0.0057 |
| 15 | Multi-Page | ✅ PASS | 97 | deepseek:deepseek-chat | $0.0091 |
| 16 | Blog Layout | ✅ PASS | 97 | ollama:qwen2.5-coder:7b | $0.0000 |
| 17 | Multi-Language | ✅ PASS | 93 | deepseek:deepseek-chat | $0.0110 |
| 18 | Visual Review | ❌ FAIL | 97 | deepseek:deepseek-chat | $0.0023 |
| 19 | Billing | ✅ PASS | 100 | — | $0.0000 |
| 20 | Full Site Build | ❌ FAIL | 0 | — | $0.0000 |

**9 PASS / 7 FAIL / 4 NEEDS BUILD**
**Total cost: $0.1000**
**Total time: 146.2 minutes**

## NEEDS BUILD

- **Test 04 — Asset Management**: Asset upload endpoints exist but intake-section-based folder routing (logo/, hero/, services/, team/, gallery/) not verified. Need: logo upload accepted, assets routed to correct subfolder by intake section.
- **Test 10 — Chatbot**: Chatbot widget not in builder pipeline. Need: static FAQ widget, live AI API call, provider switching (2+ providers).
- **Test 11 — Voice**: Voice in chat module, not builder pipeline. Need: TTS output, STT input, 3+ male/female voices as embeddable widget.
- **Test 12 — Generative Media**: API calls attempted. Pipeline integration (auto-embed in built pages) not implemented. Need: generation during page build, branded assets in output HTML.

## NEEDS FIX

- **Test 03 — Stock Images + Video**: LH P:75 A:92 S:91 BP:93; height 2710px
- **Test 07 — Gallery + Maps + Social**: assets(empty src)
- **Test 08 — PII + Guardian**: hallucinations: example.com
- **Test 09 — Email Suite**: site_live: not sent
- **Test 13 — Compliance + A11y**: height 2217px
- **Test 18 — Visual Review**: review failed
- **Test 20 — Full Site Build**: Pipeline: The operation was aborted due to timeout

## Per-Test Details

### Test 01 — Basic Page
Status: PASS | Median: 97 | Cost: $0.0070 | Model: deepseek:deepseek-chat
Reason: All criteria met. Median: 97
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0023
    ✓ lighthouse, height, grey, placeholders, assets, nav, hero, footer, no-images
  Run 2: score=97 model=deepseek:deepseek-chat cost=$0.0025
    ✓ lighthouse, height, grey, placeholders, assets, nav, hero, footer, no-images
  Run 3: score=97 model=deepseek:deepseek-chat cost=$0.0023
    ✓ lighthouse, height, grey, placeholders, assets, nav, hero, footer, no-images

### Test 02 — Cards + Accordion/Tabs
Status: PASS | Median: 97 | Cost: $0.0117 | Model: deepseek:deepseek-chat
Reason: All criteria met. Median: 97
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0037
    ✓ lighthouse, height, grey, placeholders, assets, 9 cards, accordion, tabs, JS
  Run 2: score=95 model=deepseek:deepseek-chat cost=$0.0042
    ✓ lighthouse, height, grey, placeholders, assets, 9 cards, accordion, tabs, JS
  Run 3: score=97 model=deepseek:deepseek-chat cost=$0.0038
    ✓ lighthouse, height, grey, placeholders, assets, 9 cards, accordion, tabs, JS

### Test 03 — Stock Images + Video
Status: FAIL | Median: 88 | Cost: $0.0092 | Model: deepseek:deepseek-chat
Reason: LH P:75 A:92 S:91 BP:93; height 2710px
  Run 1: score=89 model=deepseek:deepseek-chat cost=$0.0033
    ✓ grey, placeholders, assets, picsum images, youtube, no unsplash
    ✗ LH P:72 A:100 S:91 BP:93, height 2689px
  Run 2: score=87 model=deepseek:deepseek-chat cost=$0.0030
    ✓ grey, placeholders, assets, picsum images, youtube, no unsplash
    ✗ LH P:72 A:92 S:91 BP:93, height 2598px
  Run 3: score=88 model=deepseek:deepseek-chat cost=$0.0029
    ✓ grey, placeholders, assets, picsum images, youtube, no unsplash
    ✗ LH P:75 A:92 S:91 BP:93, height 2710px

### Test 04 — Asset Management
Status: NEEDS BUILD | Median: 0 | Cost: $0.0000 | Model: —
Reason: Asset upload endpoints exist but intake-section-based folder routing (logo/, hero/, services/, team/, gallery/) not verified. Need: logo upload accepted, assets routed to correct subfolder by intake section.

### Test 05 — Forms + Newsletter
Status: PASS | Median: 97 | Cost: $0.0071 | Model: ollama:qwen2.5-coder:7b
Reason: All criteria met. Median: 97
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0036
    ✓ lighthouse, height, grey, placeholders, assets, form, validation, newsletter
  Run 2: score=97 model=deepseek:deepseek-chat cost=$0.0035
    ✓ lighthouse, height, grey, placeholders, assets, form, newsletter
    ✗ no validation
  Run 3: score=92 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, placeholders, assets, form, validation, newsletter

### Test 06 — Conversion Elements
Status: PASS | Median: 97 | Cost: $0.0169 | Model: deepseek:deepseek-chat
Reason: All criteria met. Median: 97
  Run 1: score=96 model=deepseek:deepseek-chat cost=$0.0054
    ✓ lighthouse, grey, placeholders, assets, calendar, countdown, pricing, pdf link
    ✗ height 3622px
  Run 2: score=97 model=deepseek:deepseek-chat cost=$0.0063
    ✓ lighthouse, grey, placeholders, assets, calendar, countdown, pricing, pdf link
    ✗ height 2764px
  Run 3: score=97 model=deepseek:deepseek-chat cost=$0.0052
    ✓ lighthouse, height, grey, placeholders, assets, calendar, countdown, pricing, pdf link

### Test 07 — Gallery + Maps + Social
Status: FAIL | Median: 93 | Cost: $0.0074 | Model: deepseek:deepseek-chat
Reason: assets(empty src)
  Run 1: score=90 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, placeholders, assets, lightbox, map, social
  Run 2: score=93 model=deepseek:deepseek-chat cost=$0.0034
    ✓ lighthouse, height, grey, placeholders, lightbox, map, social
    ✗ assets(empty src)
  Run 3: score=94 model=deepseek:deepseek-chat cost=$0.0040
    ✓ lighthouse, height, grey, placeholders, lightbox, map, social
    ✗ assets(empty src)

### Test 08 — PII + Guardian
Status: FAIL | Median: 97 | Cost: $0.0035 | Model: deepseek:deepseek-chat
Reason: hallucinations: example.com
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0035
    ✓ zero-placeholders, lighthouse, grey
    ✗ hallucinations: example.com

### Test 09 — Email Suite
Status: FAIL | Median: 67 | Cost: $0.0000 | Model: —
Reason: site_live: not sent
  Run 1: score=67 model=api cost=$0.0000
    ✓ welcome, intake_received
    ✗ site_live: not sent

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
Status: FAIL | Median: 97 | Cost: $0.0089 | Model: deepseek:deepseek-chat
Reason: height 2217px
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0048
    ✓ lighthouse, grey, placeholders, assets, tabindex, cookie consent, privacy, terms, main
    ✗ height 2384px
  Run 2: score=97 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, assets, tabindex, cookie consent, privacy, terms, main
    ✗ ph(1)
  Run 3: score=97 model=deepseek:deepseek-chat cost=$0.0041
    ✓ lighthouse, grey, placeholders, assets, tabindex, cookie consent, privacy, terms, main
    ✗ height 2217px

### Test 14 — Dark/Light Toggle
Status: PASS | Median: 97 | Cost: $0.0057 | Model: deepseek:deepseek-chat
Reason: All criteria met. Median: 97
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0026
    ✓ lighthouse, height, grey, placeholders, assets, toggle, dark bg, light bg, JS toggle
  Run 2: score=74 model=ollama:starcoder2:7b cost=$0.0000
    ✓ height, grey, placeholders, assets, toggle, dark bg, light bg, JS toggle
    ✗ LH P:100 A:33 S:80 BP:82
  Run 3: score=97 model=deepseek:deepseek-chat cost=$0.0031
    ✓ lighthouse, height, grey, placeholders, assets, toggle, dark bg, light bg, JS toggle

### Test 15 — Multi-Page
Status: PASS | Median: 97 | Cost: $0.0091 | Model: deepseek:deepseek-chat
Reason: 3 pages, nav works, consistent headers/footers
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0091
    ✓ Home built, Services built, Contact built, link→index.html, link→services.html, link→contact.html, link→index.html, link→services.html, link→contact.html, link→index.html, link→services.html, link→contact.html, consistent headers, consistent footers, lighthouse

### Test 16 — Blog Layout
Status: PASS | Median: 97 | Cost: $0.0000 | Model: ollama:qwen2.5-coder:7b
Reason: All criteria met. Median: 97
  Run 1: score=97 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, assets, posts, categories, pagination
    ✗ ph(4)
  Run 2: score=97 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, placeholders, assets, posts, categories, pagination
  Run 3: score=97 model=ollama:qwen2.5-coder:7b cost=$0.0000
    ✓ lighthouse, height, grey, placeholders, assets, posts, categories, pagination

### Test 17 — Multi-Language
Status: PASS | Median: 93 | Cost: $0.0110 | Model: deepseek:deepseek-chat
Reason: All criteria met. Median: 93
  Run 1: score=94 model=deepseek:deepseek-chat cost=$0.0032
    ✓ lighthouse, height, grey, placeholders, assets, lang switcher, spanish content
  Run 2: score=91 model=deepseek:deepseek-chat cost=$0.0042
    ✓ height, grey, placeholders, assets, lang switcher, spanish content
    ✗ LH P:100 A:77 S:90 BP:96
  Run 3: score=93 model=deepseek:deepseek-chat cost=$0.0037
    ✓ lighthouse, height, grey, placeholders, assets, lang switcher, spanish content

### Test 18 — Visual Review
Status: FAIL | Median: 97 | Cost: $0.0023 | Model: deepseek:deepseek-chat
Reason: review failed
  Run 1: score=97 model=deepseek:deepseek-chat cost=$0.0023
    ✓ screenshots, lighthouse
    ✗ review failed

### Test 19 — Billing
Status: PASS | Median: 100 | Cost: $0.0000 | Model: —
Reason: 79 calls logged, $0.1665 total
  Run 1: score=100 model=audit cost=$0.0000
    ✓ 79 calls logged, $0.1665 tracked

### Test 20 — Full Site Build
Status: FAIL | Median: 0 | Cost: $0.0000 | Model: —
Reason: Pipeline: The operation was aborted due to timeout
  Run 1: score=0 model=pipeline cost=$0.0000
    ✗ Pipeline: The operation was aborted due to timeout
