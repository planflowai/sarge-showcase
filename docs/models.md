# AI Providers & Models Reference — SARGE Platform

All cloud and local providers with models, context windows, and capabilities.

---

## Cloud Providers

### Anthropic
- **ID:** `anthropic`
- **API Key:** ANTHROPIC_API_KEY (sk-ant-...)
- **Env Variable:** ANTHROPIC_API_KEY
- **Rate Limit:** 50,000 tokens/min
- **Image Gen:** No

#### Models

| Model | Context | Cost Tier | Builder | Judge | Use Case |
|-------|---------|-----------|---------|-------|----------|
| claude-opus-4-6 | 200k tokens | Premium | ✅ | ✅ | Complex reasoning, debate judge |
| claude-sonnet-4-6 | 200k tokens | Mid | ✅ | ✅ | General purpose, fast |
| claude-haiku-4-5 | 200k tokens | Budget | ✅ | ✅ | Quick responses, fallback |
| claude-3-5-sonnet | 200k tokens | Mid | ✅ | ✅ | Legacy, phased out |

**Default:** claude-opus-4-6 (Anthropic provider)

---

### OpenAI
- **ID:** `openai`
- **API Key:** OPENAI_API_KEY (sk-...)
- **Env Variable:** OPENAI_API_KEY
- **Rate Limit:** Varies by model, typically 90k tokens/min
- **Image Gen:** Yes (DALL-E 3)

#### Models

| Model | Context | Cost Tier | Builder | Judge | Use Case |
|-------|---------|-----------|---------|-------|----------|
| gpt-4o | 128k tokens | Premium | ✅ | ✅ | Latest flagship, multimodal |
| gpt-4o-mini | 128k tokens | Budget | ✅ | ✅ | Fast, cost-effective |
| gpt-4-turbo | 128k tokens | Premium | ✅ | ✅ | Reasoning, long context |
| gpt-3.5-turbo | 16k tokens | Budget | ✅ | — | Legacy, not recommended |
| o1 | 128k tokens | Premium | ✅ | ✅ | Complex reasoning, slow |
| o1-mini | 128k tokens | Budget | ✅ | ✅ | Fast reasoning |

**Default Model for OpenAI:** gpt-4o

---

### Google
- **ID:** `google`
- **API Key:** GOOGLE_API_KEY (AIza...)
- **Env Variable:** GOOGLE_API_KEY
- **Rate Limit:** 50,000 requests/day
- **Image Gen:** Yes (Imagen 3.0)

#### Models

| Model | Context | Cost Tier | Builder | Judge | Use Case |
|-------|---------|-----------|---------|-------|----------|
| gemini-2.0-flash | 1M tokens | Mid | ✅ | ✅ | Latest, ultra-fast |
| gemini-1.5-pro | 2M tokens | Premium | ✅ | ✅ | Long context, complex |
| gemini-1.5-flash | 1M tokens | Budget | ✅ | ✅ | Fast, cheap |
| gemini-2.0-flash-thinking | 1M tokens | Premium | ✅ | ✅ | Extended reasoning |

**Default Model for Google:** gemini-2.0-flash

---

### xAI (Grok)
- **ID:** `xai`
- **API Key:** XAI_API_KEY (xai-...)
- **Env Variable:** XAI_API_KEY
- **Rate Limit:** Not documented (typically lenient)
- **Image Gen:** Yes (grok-2-image)

#### Models

| Model | Context | Cost Tier | Builder | Judge | Use Case |
|-------|---------|-----------|---------|-------|----------|
| grok-2 | 128k tokens | Mid | ✅ | ✅ | Latest Grok, edgy humor |
| grok-2-mini | 128k tokens | Budget | ✅ | ✅ | Fast, lightweight |
| grok-beta | 128k tokens | Mid | ✅ | ✅ | Beta features |

**Default Model for xAI:** grok-2

---

### DeepSeek
- **ID:** `deepseek`
- **API Key:** DEEPSEEK_API_KEY
- **Env Variable:** DEEPSEEK_API_KEY
- **Rate Limit:** Not enforced (local-first provider)
- **Image Gen:** No

#### Models

| Model | Context | Cost Tier | Builder | Judge | Use Case |
|-------|---------|-----------|---------|-------|----------|
| deepseek-chat | 128k tokens | Budget | ✅ | ✅ | General purpose |
| deepseek-coder | 128k tokens | Budget | ✅ | — | Code generation |
| deepseek-reasoner | 128k tokens | Mid | ✅ | ✅ | Complex reasoning |

**Default Model for DeepSeek:** deepseek-chat

---

## Local Providers

### Ollama
- **ID:** `ollama`
- **Discovery:** Live /api/tags query to localhost:11434
- **Default Port:** 11434
- **Override Env:** NEXT_PUBLIC_OLLAMA_URL
- **Image Gen:** No
- **Air-gap:** ✅ Fully supported
- **Rate Limit:** None (local)

#### Popular Models (Community-curated)

| Model | Size | Context | Speed | Builder | Judge | Notes |
|-------|------|---------|-------|---------|-------|-------|
| llama3.2:3b | 2GB | 8k | Fast | ✅ | — | Default fallback |
| llama3.2:8b | 5GB | 8k | Medium | ✅ | ✅ | Fast reasoning |
| qwen2.5-coder | 7GB | 32k | Medium | ✅ | — | Code-specialized |
| deepseek-coder | 7GB | 4k | Medium | ✅ | — | Code generation |
| mistral:latest | 4GB | 32k | Fast | ✅ | — | General purpose |
| neural-chat:latest | 4GB | 8k | Fast | ✅ | — | Conversational |
| codellama:7b | 4GB | 2k | Fast | ✅ | — | Code-focused |
| starcoder:3b | 2GB | 8k | Very Fast | ✅ | — | Code completion |
| phi-2 | 1.5GB | 2k | Very Fast | — | — | Lightweight reasoning |

**Default Fallback:** llama3.2:3b

**Discovery:** On app startup, /api/models/scan queries Ollama and populates modelStore.

---

### LM Studio
- **ID:** `lmstudio`
- **Discovery:** Live /v1/models query to localhost:1234 (via `/api/lmstudio/models`)
- **Default Port:** 1234
- **Override Env:** NEXT_PUBLIC_LM_STUDIO_URL
- **Image Gen:** No
- **Air-gap:** ✅ Fully supported
- **Rate Limit:** None (local)
- **Streaming:** OpenAI-compatible SSE (same protocol as OpenAI/xAI/DeepSeek)
- **Dashboard:** Live status card with connectivity check

#### Supported Models (OpenAI-compatible API)
Same models as Ollama, loaded via LM Studio GUI instead of CLI. Any model loaded in LM Studio's model manager appears automatically in SARGE's model dropdown.

**Advantages over Ollama:**
- GUI model manager with download/load/unload
- Presets for context/temperature per model
- Better performance tuning and GPU layer configuration
- Visual VRAM/RAM usage monitoring
- Compatible with OpenAI API format (same routing as cloud providers)

---

## Builder-Eligible Models (auto-tagged)

All cloud models + these local code specialists:
- `qwen2.5-coder`
- `deepseek-coder`
- `codellama`
- `starcoder`
- `llama3.2:*` (any variant)

Users can manually tag/untag models in Settings → Models.

---

## Air-Gap Compatibility

| Provider | Air-Gap Blocked? | Alternative |
|----------|-----------------|-------------|
| Anthropic | ✅ Yes | Ollama/LM Studio |
| OpenAI | ✅ Yes | Ollama/LM Studio |
| Google | ✅ Yes | Ollama/LM Studio |
| xAI | ✅ Yes | Ollama/LM Studio |
| DeepSeek | ✅ Yes | Ollama/LM Studio |
| Ollama | ❌ No (allowed) | — |
| LM Studio | ❌ No (allowed) | — |
| Tavily Search | ✅ Yes | SearXNG (local) |
| Brave Search | ✅ Yes | Google Custom (fallback) |
| Supabase | ✅ Yes | localStorage only |

---

## Fallback Chain (Priority Order)

When user submits message and current model is unavailable:

```
1. User-selected model (if available + enabled)
2. Default model for selected provider
3. Anthropic (fallback provider)
4. OpenAI
5. Google
6. xAI
7. DeepSeek
8. Ollama (any available model)
9. LM Studio (if running)
10. llama3.2:3b (hardcoded final fallback)
```

**Air-gap override:** If `SARGE_AIR_GAP=1`, skip all cloud, jump directly to step 8.

---

## Model Capability Mapping

### Builder-capable
All cloud models + qwen2.5-coder, deepseek-coder, codellama, starcoder, llama3.2:*

### Judge-capable (Debate/Test Mode)
- Recommended: claude-opus-4-6, gpt-4o, gemini-1.5-pro, grok-2
- Acceptable: claude-sonnet-4-6, gpt-4o-mini, gemini-2.0-flash
- Not recommended: haiku-level models (insufficient reasoning)

### Analyzer-capable (AI Analysis tab)
- Recommended: claude-opus-4-6, gpt-4o, gemini-1.5-pro
- Acceptable: claude-sonnet-4-6, gpt-4o-mini

---

## Cost Tiers (Approximate)

### Ultra-Premium ($)
- claude-opus-4-6
- gpt-4-turbo
- gpt-4o
- gemini-1.5-pro

### Premium ($$)
- claude-sonnet-4-6
- gpt-4o-mini
- gemini-1.5-flash
- grok-2
- o1

### Mid ($$)
- gemini-2.0-flash
- deepseek-chat
- gpt-3.5-turbo (legacy)

### Budget ($)
- claude-haiku-4-5
- grok-2-mini
- deepseek-coder

### Free
- Ollama (local)
- LM Studio (local)

---

## Temperature & Token Settings

### Defaults (from modelStore)
```typescript
temperature: 0.7                  // Standard creativity
maxTokens: 2048                   // Default response length
topP: 1.0                         // Full nucleus sampling
topK: 0                           // No top-K filtering
frequencyPenalty: 0               // No penalty
presencePenalty: 0                // No penalty
```

### Mode-specific Overrides
- **Test Mode:** temperature 0.0 (deterministic)
- **Debate:** temperature 0.7 (balanced)
- **Journal:** temperature 0.8 (creative)
- **Research:** temperature 0.5 (focused)

---

## Model Selection Algorithm

1. **User selects model in dropdown** → modelStore.currentModel
2. **Route to /api/chat with model ID**
3. **Server checks availability:**
   - Can reach provider API?
   - Model listed in provider models?
4. **If available:** Use user-selected
5. **If unavailable:** Walk fallback chain
6. **If all cloud fail:** Jump to Ollama
7. **If Ollama empty:** Use llama3.2:3b hardcoded

---

## Performance Benchmarks

| Model | Latency (p95) | Tokens/sec | Quality Score |
|-------|---------------|-----------|---------------|
| claude-opus-4-6 | 2-3s | 30-40 | 9.5/10 |
| gpt-4o | 1-2s | 40-50 | 9.2/10 |
| gemini-2.0-flash | 0.5-1s | 50-80 | 8.8/10 |
| claude-sonnet-4-6 | 1-2s | 40-50 | 8.9/10 |
| gpt-4o-mini | 0.5-1s | 50-60 | 8.2/10 |
| llama3.2:8b | 0.3-0.5s | 80-100 | 7.5/10 |
| qwen2.5-coder | 0.3-0.5s | 80-100 | 8.1/10 |
| llama3.2:3b | 0.2-0.3s | 100-120 | 6.8/10 |

(Benchmarks are approximate and vary by hardware/network)

---

## Recommended Models by Use Case

### General Chat
- **Best:** claude-opus-4-6, gpt-4o, gemini-1.5-pro
- **Fast:** gpt-4o-mini, gemini-2.0-flash
- **Local:** llama3.2:8b, qwen2.5-coder

### Code Generation (Builder)
- **Best:** claude-opus-4-6, gpt-4o, deepseek-coder
- **Fast:** qwen2.5-coder, codellama
- **Local:** llama3.2:8b + qwen2.5-coder

### Debate Judge
- **Best:** claude-opus-4-6 (highest reasoning)
- **Good:** gpt-4o, gemini-1.5-pro
- **Fallback:** claude-sonnet-4-6

### Fact Checking (Live Checker)
- **Best:** claude-opus-4-6, gpt-4o
- **Fast:** gemini-2.0-flash, claude-sonnet-4-6

### Test Mode (Poison Pill)
- **Best:** claude-opus-4-6, gpt-4o, gemini-1.5-pro
- **Good:** gpt-4o-mini, claude-sonnet-4-6

---

Generated from SARGE_PLATFORM.md and provider documentation
Last updated: 2026-02-25
