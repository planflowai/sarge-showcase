import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { model, prompt, systemPrompt, source } = body;

  console.log('[API/test/stream] Received request:', {
    model,
    source,
    hasSystemPrompt: !!systemPrompt,
    sourceType: typeof source,
    sourceExact: source === 'local' ? 'YES local' : `NO: "${source}"`,
    willRouteToOllama: source === 'local'
  });

  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  // Build messages
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // Ollama streaming
  if (source === 'local') {
    const ollamaPayload = {
      model,
      messages,
      stream: true,
    };
    console.log('[API/test/stream] Routing to Ollama:', {
      model,
      ollamaUrl,
      endpoint: `${ollamaUrl}/api/chat`,
      payload: JSON.stringify(ollamaPayload)
    });
    try {
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return NextResponse.json({ error: `Ollama error (${res.status}): ${errText || res.statusText}. Make sure Ollama is running and the model "${model}" is available.` }, { status: 500 });
      }

      // Forward the stream
      return new Response(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
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
      return await streamAnthropic(model, prompt, systemPrompt);
    }
    if (model.includes('gpt')) {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamOpenAI(model, messages);
    }
    if (model.includes('gemini')) {
      if (!process.env.GOOGLE_API_KEY) {
        return NextResponse.json({ error: 'Google API key not configured. Please add GOOGLE_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamGemini(model, prompt, systemPrompt);
    }
    if (model.includes('grok')) {
      if (!process.env.XAI_API_KEY) {
        return NextResponse.json({ error: 'xAI API key not configured. Please add XAI_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamXAI(model, messages);
    }
    if (model.includes('deepseek')) {
      if (!process.env.DEEPSEEK_API_KEY) {
        return NextResponse.json({ error: 'DeepSeek API key not configured. Please add DEEPSEEK_API_KEY to your .env file.' }, { status: 500 });
      }
      return await streamDeepSeek(model, messages);
    }
    return NextResponse.json({ error: 'Unknown model provider' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Anthropic (Claude) — native SSE streaming ──────────────────────────
async function streamAnthropic(model: string, prompt: string, systemPrompt?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }],
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

// ── OpenAI (GPT) — native SSE streaming ─────────────────────────────────
async function streamOpenAI(model: string, messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 1024, stream: true }),
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

// ── xAI (Grok) — OpenAI-compatible SSE streaming ──────────────────────
async function streamXAI(model: string, messages: { role: string; content: string }[]) {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 1024, stream: true }),
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

// ── Google (Gemini) — streamGenerateContent ─────────────────────────────
async function streamGemini(model: string, prompt: string, systemPrompt?: string) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
  const contents = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

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

// ── DeepSeek — OpenAI-compatible SSE streaming ──────────────────────────
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
