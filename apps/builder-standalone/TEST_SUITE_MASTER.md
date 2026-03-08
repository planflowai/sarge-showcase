# S.A.R.G.E. BUILDER — TEST SUITE MASTER
**Last Updated:** March 8, 2026  
**Location:** `L:\ai_builder\ai_builderv2\apps\builder-standalone\test_folder_automation\TEST_SUITE_MASTER.md`  
**Purpose:** Track all builder unit tests. One test at a time. Each test is isolated. Do not combine into full builds until all individual tests pass.

---

## RULES (Read Before Every Test)
- Read `BUILDER_RULES.md` before every test
- Each test lives in its own subfolder: `test-XX-name/`
- Claude Code does NOT edit HTML files directly — the builder pipeline does it
- No deploys, no GitHub pushes, no emails unless the test specifically requires it
- Log everything in `BUILD_LOG.txt` inside each test folder
- A test is PASS only when: scores 80+, no grey text, no broken assets, no placeholders remaining, page under 2160px
- Fix the test until it passes before moving to the next one
- The auto-router picks models per `BUILDER_RULES.md` — never hardcode a model in a prompt

---

## TEST STATUS TRACKER

| # | Test Name | Folder | Status | Score | Notes |
|---|-----------|--------|--------|-------|-------|
| 01 | Basic Page | `test-01-basic` | ✅ PASS | 97 | Nav, hero, footer. No images. Dark mode. |
| 02 | Cards + Accordion/Tabs | `test-02-cards-tabs` | ✅ PASS | 97 | Grid layout + interactive JS. No scroll. |
| 03 | Stock Images + Video Embed | `test-03-media` | ✅ PASS | 87 | picsum.photos only. YouTube iframe. |
| 04 | Asset Management | `test-04-assets` | 🔧 NEEDS BUILD | — | Logo upload, service images, folder structure by intake section. |
| 05 | Forms + Newsletter | `test-05-forms` | ✅ PASS | 97 | Contact form + newsletter signup. Validation. Submission. |
| 06 | Booking + Timer + Pricing + PDF | `test-06-conversion` | ✅ PASS | 97 | Calendar widget, countdown, pricing table, PDF download. |
| 07 | Gallery + Maps + Social | `test-07-display` | ✅ PASS | 93 | Lightbox gallery, maps embed, social media embeds. |
| 08 | PII Injection + Guardian | `test-08-pii` | ⚠️ NEEDS REVIEW | 97 | Full placeholder → real data flow. Guardian catches and auto-fixes hallucinations. Zero placeholders remaining. |
| 09 | Email Suite | `test-09-emails` | ✅ PASS | 100 | Welcome, build complete, PlanFlowAI branded templates. Correct recipient. Real data. No raw placeholders. |
| 10 | Basic Chatbot + AI Chatbot + Multi-Model | `test-10-chatbot` | 🔧 NEEDS BUILD | — | Static FAQ → live API → provider switching. |
| 11 | Voice — Full Suite | `test-11-voice` | 🔧 NEEDS BUILD | — | TTS output, STT input, full voice chatbot (speak in/speak back). Min 3 male + 3 female voices. |
| 12 | AI Video + AI Music | `test-12-generative-media` | 🔧 NEEDS BUILD | — | UNBLOCKED — grok-imagine-video and grok-imagine-image available natively through xAI. No external API needed. |
| 13 | Compliance + Accessibility | `test-13-compliance` | ✅ PASS | 97 | WCAG, axe-core, keyboard nav, screen reader, disability rules, cookie consent, legal pages (privacy/terms auto-generated), no-scroll enforcement. |
| 14 | Dark/Light Mode | `test-14-darklight` | ✅ PASS | 97 | Toggle works. Contrast correct on both modes. No grey on either. |
| 15 | Multi-Page Site | `test-15-multipage` | ✅ PASS | 97 | 3 pages. Nav works between them. Consistent header/footer. |
| 16 | Blog Layout | `test-16-blog` | ✅ PASS | 97 | Posts, categories, pagination. |
| 17 | Multi-Language | `test-17-multilang` | ✅ PASS | 93 | Language switcher. At least EN + ES. |
| 18 | Visual Review Pipeline | `test-18-visual-review` | ✅ PASS | 97 | qwen3.5:9b local (60s timeout) → Gemini fallback. Screenshots logged. Findings fixed. |
| 19 | Billing Accuracy | `test-19-billing` | ✅ PASS | 100 | Every API call logged with provider, model, tokens, calculated cost. Dashboard shows accurate totals across all providers. |
| 20 | Full Site Build | `test-20-full-site` | ✅ PASS | 100 | Everything combined. Use Level 11 Events intake data. Builder does ALL work. No Claude Code HTML edits. Certificate generated. Deploy. Emails. |

**Status Key:** 🔲 PENDING &nbsp;|&nbsp; 🔄 IN PROGRESS &nbsp;|&nbsp; ✅ PASS &nbsp;|&nbsp; ❌ FAIL &nbsp;|&nbsp; 🔧 FIXING

---

## CURRENT TEST
**TEST 01 — Basic Page**  
Folder: `test-01-basic`  
Goal: Prove the auto-router selects models correctly and a basic page compiles clean.  
Pass criteria: Lighthouse 80+ all 4 categories, page under 2160px, no grey text, no broken assets.

---

## LOCAL MODEL POOLS (Confirmed March 8, 2026)

### Page Building Pool (try in order, 60s timeout each)
| # | Model | Purpose | Notes |
|---|-------|---------|-------|
| 1 | `qwen2.5-coder:7b` | Primary local coder | Best code quality at 7B |
| 2 | `deepseek-coder:6.7b` | Fallback coder | Good at HTML/CSS |
| 3 | `codellama:7b` | Fallback coder | Meta's code model |
| 4 | `starcoder2:7b` | Last local resort | StarCoder v2 |

Cloud fallback order: DeepSeek Chat → Grok 4.1 Fast → Gemini Flash → GPT-4.1 → Grok 4.20 → Claude Sonnet

### Visual Review Pool (60s timeout each)
| # | Model | Purpose | Notes |
|---|-------|---------|-------|
| 1 | `qwen3.5:9b` | Primary reviewer | Vision-capable, good at spotting issues |
| 2 | `qwen3-vl:latest` | Fallback reviewer | Dedicated vision-language model |

No cloud fallback — visual review is local-only.

### Dead Weight Removed
`smollm:360m`, `llama3.2:1b`, `llama3.2:3b`, `gemma2:2b`, `phi3:mini`, `deepseek-r1:7b`, `deepseek-r1:8b`, `cogito:8b`, `rnj-1:8b`, `qwen2:7b`, `qwen3:8b`, `gemma3:4b`, `minicpm-v` variants, `llava-phi3`

---

## CONFIRMED WORKING CLOUD MODELS

All provider model names confirmed correct as of March 8, 2026.

### xAI (Grok)
| Model ID | Status | Notes |
|----------|--------|-------|
| `grok-4-1-fast-non-reasoning` | ✅ confirmed | Cheap fast tier ($0.20 input) |
| `grok-4.20-experimental-beta-0304-non-reasoning` | ✅ confirmed | Premium tier ($2.00 input) |
| `grok-code-fast-1` | ✅ confirmed | Code-specialized |
| `grok-imagine-image` | — | Image generation |
| `grok-imagine-image-pro` | — | Premium image generation |
| `grok-imagine-video` | — | Video generation |
| `grok-4.20-multi-agent-experimental-beta-0304` | — | Multi-agent |

Full catalog: `grok-3`, `grok-3-mini`, `grok-4-0709`, `grok-4-fast-non-reasoning`, `grok-4-fast-reasoning`, `grok-4-1-fast-reasoning`, `grok-4.20-experimental-beta-0304-reasoning`

### DeepSeek
| Model ID | Status | Notes |
|----------|--------|-------|
| `deepseek-chat` | ✅ confirmed | V3 chat ($0.27 input) |
| `deepseek-reasoner` | — | R1 reasoning model |

---

## KNOWN BROKEN THINGS (Fix as Tests Hit Them)
- Ollama local models timing out for full page generation (8GB VRAM limit — will improve with GPU upgrade)
- Visual review subprocess can't access env vars (pass `{ env: { ...process.env } }` on spawn)
- Email sending to client email instead of planflowai@outlook.com
- Vercel deploy returning 401
- Guardian logs hallucinations but doesn't always auto-fix

---

## ASSET MANAGEMENT SPEC (Test 04)
When a client uploads assets, the folder structure should be:
```
/projects/{ref-code}/assets/
  /logo/              ← brand logo
  /hero/              ← hero/banner images
  /services/          ← one subfolder per service
    /service-name/
  /team/              ← staff/team photos
  /gallery/           ← event/portfolio photos
  /documents/         ← PDFs, menus, brochures
```
Accepted formats: JPG, PNG, WebP, SVG (logo only), GIF  
Size limits: Logo 2MB, all others 10MB  
The builder prompt must reference the correct asset path per page section.

---

## EMAIL SPEC (Test 09)
All emails send to: `planflowai@outlook.com` (builder notification)  
NOT to the client email from intake data.  
Three templates to fix and test:
1. **Welcome** — fires on intake submission
2. **Build Started** — fires when pipeline begins
3. **Site Live** — fires after deploy succeeds. Must include: business name, scores, certificate tier, deploy URL. No raw `{{placeholders}}`.  

PlanFlowAI branding: match the site colors. Clean, professional. Would you send this to a paying client?

---

## VOICE SPEC (Test 11)
Minimum voices available to the client:
- 3 male voices
- 3 female voices  

Source from existing implementation in: `L:\AI_PHONE_APP\ai_workbench`  
The chatbot voice must actually work — not the face-sitting kind that doesn't.  
Voice is an add-on upsell: "Want a voice-enabled chatbot? Yes. Pick your voice."

---

## CONTEXT FOR FUTURE CLAUDE SESSIONS
If you are reading this in a new chat, here is where things stand:

**What works:** Core builder pipeline (intake → pages → PII injection → compile → certificate). Proven on PlanFlowAI (7 pages, Perf 93/A11y 99/SEO 100/BP 96) and Level 11 Events (partial).

**What doesn't work yet:** Local Ollama too slow for full page generation on 8GB GPU. Deploy, emails, and visual review are half-wired. All cloud provider model names are now confirmed correct (March 8, 2026).

**The plan:** Run all 20 unit tests in order. Fix each one before moving to the next. Do not rebuild full sites until all tests pass. Then rebuild Level 11 Events as Test 20 — the final proof.

**Journeyman Journals** is a real client (Sarah) — simple 3-5 page bookkeeping site. Goes through the builder after Test 20 passes. Free site, test client.

**BUILDER_RULES.md** is law. Read it before every task.
