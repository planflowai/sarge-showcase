# BUILDER RULES — READ BEFORE EVERY COMMIT

## MODELS
- NEVER default everything to Gemini or GPT
- Local models FIRST for easy pages (qwen2.5-coder:7b, qwen2.5-coder:14b, codellama via Ollama)
- Cheapest cloud SECOND (DeepSeek $0.27, Grok 4.1 Fast $0.20)
- Mid-tier THIRD (Gemini Flash, GPT-4.1)
- Expensive models LAST and only for hard pages or retries (Grok 4.20, Claude)
- The auto-router must check what's available, not hardcode 3 models

## TEXT AND UI
- Dark mode: ALL text #FFFFFF or #F0F2F5. NO GREY. NO DIM.
- Light mode: ALL text #1A1A2E or #111111. NO GREY.
- NO zinc-500, zinc-600, zinc-700, slate-400, slate-500 EVER
- Min font size 14px body, 12px labels
- Font weight 500+ body, 700+ headings

## BUILDS
- Claude Code NEVER edits HTML site files directly
- All site changes go through the builder pipeline
- PII injection runs AFTER every build automatically
- No source.unsplash.com URLs — use picsum.photos
- Every page fits in 1-2 viewport heights max
- No scrolling hellscapes

## API KEYS
- NEVER hardcode API keys in any file
- Always read from process.env or .env.local
- Pre-commit check: block if API key pattern detected

## EMAILS
- All email templates use real client data from Supabase
- No raw {{placeholders}} in any email subject or body
- Test: would you send this email to a paying client?

## BILLING
- Log every API call with provider, model, tokens, cost
- Use actual token counts × provider pricing
- Track across ALL providers, not just one

## BEFORE EVERY COMMIT — CHECK:
1. Did I use local/cheap models first?
2. Is there any grey text anywhere?
3. Are there any hardcoded API keys?
4. Did I edit site HTML directly instead of through the pipeline?
5. Are there any raw {{placeholders}} in emails or site files?
6. Is any page over 2160px tall?
7. Did I log the cost of every API call?
