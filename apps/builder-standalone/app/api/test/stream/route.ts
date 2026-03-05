import { NextRequest, NextResponse } from 'next/server';

// ── Helpers for image handling ──────────────────────────────────────────

/** Parse a base64 data URL into { mimeType, base64Data } */
function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
}

// ── Tavily web search helper ─────────────────────────────────────────────
async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !query.trim()) return '';
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.slice(0, 400) + ' ' + new Date().getFullYear(),
        max_results: 5,
        include_raw_content: false,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const results: { title?: string; url?: string; content?: string }[] = (data.results || [])
      .filter((r: { content?: string }) => r.content && r.content.length > 20)
      .slice(0, 5);
    if (!results.length) return '';
    const lines = results.map((r, i) =>
      `${i + 1}. **${r.title || 'Result'}**\n${r.url || ''}\n${(r.content || '').slice(0, 500)}`
    );
    return `\n\n[Web Search Results for: "${query.slice(0, 80)}"]\n${lines.join('\n\n')}\n[End Web Search Results]\n`;
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { model, prompt, systemPrompt, source, provider, images, webSearch } = body;

  const hasImages = Array.isArray(images) && images.length > 0;

  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  // Optional Tavily web search — inject into system prompt before routing
  let enrichedSystemPrompt = systemPrompt || '';
  if (webSearch && prompt) {
    const searchContext = await tavilySearch(prompt);
    if (searchContext) {
      enrichedSystemPrompt = enrichedSystemPrompt
        ? enrichedSystemPrompt + searchContext
        : searchContext;
    }
  }
  const lmstudioUrl = process.env.NEXT_PUBLIC_LM_STUDIO_URL || 'http://127.0.0.1:1240/v1';
  const lmstudioApiKey = process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || '';

  // For non-vision providers, append image note to prompt
  const promptWithImageNote = hasImages
    ? `${prompt}\n\n[${images.length} image(s) attached — this model does not support vision, images cannot be displayed]`
    : prompt;

  // Build messages (text-only, for providers without vision)
  const messages: { role: string; content: string }[] = [];
  if (enrichedSystemPrompt) {
    messages.push({ role: 'system', content: enrichedSystemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // Messages with image note for non-vision providers
  const messagesWithNote: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messagesWithNote.push({ role: 'system', content: systemPrompt });
  }
  messagesWithNote.push({ role: 'user', content: promptWithImageNote });

  // LM Studio streaming (OpenAI-compatible, no vision)
  if (source === 'local' && provider === 'lmstudio') {
    console.log('[API/test/stream] Routing to LM Studio:', { model, lmstudioUrl });
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (lmstudioApiKey) headers['Authorization'] = `Bearer ${lmstudioApiKey}`;

      const res = await fetch(`${lmstudioUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: hasImages ? messagesWithNote : messages, max_tokens: 1024, stream: true }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return NextResponse.json({ error: `LM Studio error (${res.status}): ${errText || res.statusText}. Make sure LM Studio is running and a model is loaded.` }, { status: 500 });
      }

      if (!res.body) {
        return NextResponse.json({ error: 'No response body from LM Studio' }, { status: 500 });
      }

      // Transform OpenAI SSE → simple NDJSON
      const transform = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(new TextEncoder().encode(
                  JSON.stringify({ message: { content } }) + '\n'
                ));
              }
            } catch {}
          }
        }
      });

      return new Response(res.body.pipeThrough(transform), {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    } catch (fetchError: any) {
      return NextResponse.json({
        error: `Cannot connect to LM Studio at ${lmstudioUrl}. Make sure LM Studio is running. Error: ${fetchError.message}`
      }, { status: 500 });
    }
  }

  // Ollama streaming (supports vision for llava/bakllava models)
  if (source === 'local') {
    console.log('[API/test/stream] Routing to Ollama:', { model, ollamaUrl });
    try {
      // Ollama vision: send images as base64 in the message
      const ollamaMessages: any[] = [];
      if (enrichedSystemPrompt) {
        ollamaMessages.push({ role: 'system', content: enrichedSystemPrompt });
      }
      if (hasImages) {
        // Ollama expects images as base64 strings (without the data:image/... prefix)
        const ollamaImages = images
          .map((img: string) => parseDataUrl(img))
          .filter(Boolean)
          .map((parsed: any) => parsed.base64Data);
        ollamaMessages.push({ role: 'user', content: prompt, images: ollamaImages.length > 0 ? ollamaImages : undefined });
      } else {
        ollamaMessages.push({ role: 'user', content: prompt });
      }

      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        return NextResponse.json({ error: `Ollama error (${res.status}): ${errText || res.statusText}. Make sure Ollama is running and the model "${model}" is available.` }, { status: 500 });
      }

      // Normalize Ollama NDJSON → same {"message":{"content":"..."}} format as cloud handlers.
      // Piping through a TransformStream ensures the ReadableStream is Web Streams API
      // compatible when forwarded through Next.js rewrite proxies.
      const ollamaTransform = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const data = JSON.parse(trimmed);
              const content = data?.message?.content;
              if (content) {
                controller.enqueue(new TextEncoder().encode(
                  JSON.stringify({ message: { content } }) + '\n'
                ));
              }
            } catch {
              // Forward raw line if not valid JSON
              controller.enqueue(new TextEncoder().encode(trimmed + '\n'));
            }
          }
        }
      });

      return new Response(res.body.pipeThrough(ollamaTransform), {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    } catch (fetchError: any) {
      return NextResponse.json({
        error: `Cannot connect to Ollama at ${ollamaUrl}. Make sure Ollama is running (ollama serve). Error: ${fetchError.message}`
      }, { status: 500 });
    }
  }

  // ── Cloud streaming ──────────────────────────────────────────────────
  console.log('[API/test/stream] Cloud routing - checking model:', {
    model,
    includesClaude: model.includes('claude'),
    includesGpt: model.includes('gpt'),
    includesGemini: model.includes('gemini'),
    includesGrok: model.includes('grok'),
    includesDeepseek: model.includes('deepseek')
  });
  try {
    if (model.includes('claude')) {
      if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
        return NextResponse.json({ error: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamAnthropic(model, prompt, enrichedSystemPrompt, hasImages ? images : undefined);
    }
    if (model.includes('gpt') || model.startsWith('o3') || model.startsWith('o4')) {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamOpenAI(model, messages, hasImages ? images : undefined);
    }
    if (model.includes('gemini')) {
      if (!process.env.GOOGLE_API_KEY) {
        return NextResponse.json({ error: 'Google API key not configured. Please add GOOGLE_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamGemini(model, prompt, enrichedSystemPrompt, hasImages ? images : undefined);
    }
    if (model.includes('grok')) {
      if (!process.env.XAI_API_KEY) {
        return NextResponse.json({ error: 'xAI API key not configured. Please add XAI_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamXAI(model, hasImages ? messagesWithNote : messages);
    }
    if (model.includes('deepseek')) {
      if (!process.env.DEEPSEEK_API_KEY) {
        return NextResponse.json({ error: 'DeepSeek API key not configured. Please add DEEPSEEK_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamDeepSeek(model, hasImages ? messagesWithNote : messages);
    }
    // Fallback: use the `provider` field if model name pattern didn't match
    if (provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
        return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 500 });
      }
      return await streamAnthropic(model, prompt, enrichedSystemPrompt, hasImages ? images : undefined);
    }
    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 500 });
      }
      return await streamOpenAI(model, messages, hasImages ? images : undefined);
    }
    if (provider === 'google') {
      if (!process.env.GOOGLE_API_KEY) {
        return NextResponse.json({ error: 'Google API key not configured.' }, { status: 500 });
      }
      return await streamGemini(model, prompt, enrichedSystemPrompt, hasImages ? images : undefined);
    }
    if (provider === 'xai') {
      if (!process.env.XAI_API_KEY) {
        return NextResponse.json({ error: 'xAI API key not configured.' }, { status: 500 });
      }
      return await streamXAI(model, hasImages ? messagesWithNote : messages);
    }
    if (provider === 'deepseek') {
      if (!process.env.DEEPSEEK_API_KEY) {
        return NextResponse.json({ error: 'DeepSeek API key not configured.' }, { status: 500 });
      }
      return await streamDeepSeek(model, hasImages ? messagesWithNote : messages);
    }
    // ── Custom provider fallback (OpenAI-compatible) ──
    // 1. Check if explicit custom config was passed in the body
    const customBaseUrl = body.customBaseUrl;
    const customEnvKey = body.customEnvKey;
    if (customBaseUrl && customEnvKey) {
      const apiKey = process.env[customEnvKey] || '';
      if (!apiKey) {
        return NextResponse.json({ error: `API key not configured. Please add ${customEnvKey} to your .env.local file.` }, { status: 500 });
      }
      return await streamOpenAICompatible(model, messages, customBaseUrl, apiKey);
    }
    // 2. Look up by provider ID for known OpenAI-compatible providers
    const KNOWN_BASE_URLS: Record<string, string> = {
      mistral: "https://api.mistral.ai/v1",
      huggingface: "https://api-inference.huggingface.co/v1",
      perplexity: "https://api.perplexity.ai",
      together: "https://api.together.xyz/v1",
      groq: "https://api.groq.com/openai/v1",
    };
    const knownBaseUrl = KNOWN_BASE_URLS[provider];
    if (knownBaseUrl) {
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      const apiKey = process.env[envKey] || '';
      if (!apiKey) {
        return NextResponse.json({ error: `API key not configured. Please add ${envKey} to your .env.local file.` }, { status: 500 });
      }
      return await streamOpenAICompatible(model, messages, knownBaseUrl, apiKey);
    }

    return NextResponse.json({ error: `Unknown model provider: model="${model}", provider="${provider}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Generic OpenAI-compatible streaming (Mistral, Perplexity, Together, Groq, etc.) ───
async function streamOpenAICompatible(
  model: string,
  messages: { role: string; content: any }[],
  baseUrl: string,
  apiKey: string
) {
  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 8192, stream: true }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const transform = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ message: { content } }) + '\n'
            ));
          }
        } catch {}
      }
    }
  });

  return new Response(res.body.pipeThrough(transform), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

// ── Anthropic (Claude) — native SSE streaming with vision ───────────────
async function streamAnthropic(model: string, prompt: string, systemPrompt?: string, images?: string[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';

  // Build content array with images + text
  const content: any[] = [];
  if (images && images.length > 0) {
    for (const dataUrl of images) {
      const parsed = parseDataUrl(dataUrl);
      if (parsed) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: parsed.mimeType,
            data: parsed.base64Data,
          },
        });
      }
    }
  }
  content.push({ type: 'text', text: prompt });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  // Transform Anthropic SSE → simple NDJSON chunks
  const transform = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content_block_delta' && data.delta?.text) {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ message: { content: data.delta.text } }) + '\n'
            ));
          }
        } catch {}
      }
    }
  });

  return new Response(res.body.pipeThrough(transform), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

// ── OpenAI (GPT) — native SSE streaming with vision ─────────────────────
async function streamOpenAI(model: string, messages: { role: string; content: any }[], images?: string[]) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const isReasoning = model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')
    || model.includes('gpt-5') || model.includes('nano') || model.includes('reasoning');
  const tokenParam = isReasoning
    ? { max_completion_tokens: 8192 }
    : { max_tokens: 8192 };

  // If images present, convert last user message to multimodal content
  if (images && images.length > 0) {
    const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIdx !== -1) {
      const textContent = messages[lastUserIdx].content;
      const contentParts: any[] = [];
      for (const dataUrl of images) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: dataUrl },
        });
      }
      contentParts.push({ type: 'text', text: textContent });
      messages[lastUserIdx] = { ...messages[lastUserIdx], content: contentParts };
    }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, ...tokenParam, stream: true }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const transform = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ message: { content } }) + '\n'
            ));
          }
        } catch {}
      }
    }
  });

  return new Response(res.body.pipeThrough(transform), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

// ── xAI (Grok) — OpenAI-compatible SSE streaming (no vision) ───────────
async function streamXAI(model: string, messages: { role: string; content: string }[]) {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 8192, stream: true }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const transform = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ message: { content } }) + '\n'
            ));
          }
        } catch {}
      }
    }
  });

  return new Response(res.body.pipeThrough(transform), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

// ── Google (Gemini) — streamGenerateContent with vision ─────────────────
async function streamGemini(model: string, prompt: string, systemPrompt?: string, images?: string[]) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }

  // Build user message parts with images + text
  const userParts: any[] = [];
  if (images && images.length > 0) {
    for (const dataUrl of images) {
      const parsed = parseDataUrl(dataUrl);
      if (parsed) {
        userParts.push({
          inlineData: {
            mimeType: parsed.mimeType,
            data: parsed.base64Data,
          },
        });
      }
    }
  }
  userParts.push({ text: prompt });
  contents.push({ role: 'user', parts: userParts });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );

  if (!res.ok || !res.body) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const transform = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ message: { content } }) + '\n'
            ));
          }
        } catch {}
      }
    }
  });

  return new Response(res.body.pipeThrough(transform), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

// ── DeepSeek — OpenAI-compatible SSE streaming with reasoning support ───
async function streamDeepSeek(model: string, messages: { role: string; content: string }[]) {
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 8192, stream: true }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const transform = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const delta = data.choices?.[0]?.delta;
          // DeepSeek R1 sends reasoning_content for thinking tokens
          const reasoning = delta?.reasoning_content;
          if (reasoning) {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ message: { content: '', reasoning_content: reasoning } }) + '\n'
            ));
          }
          const content = delta?.content;
          if (content) {
            controller.enqueue(new TextEncoder().encode(
              JSON.stringify({ message: { content } }) + '\n'
            ));
          }
        } catch {}
      }
    }
  });

  return new Response(res.body.pipeThrough(transform), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
