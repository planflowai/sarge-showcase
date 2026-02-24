/**
 * Chat Export API
 * Generates structured document data from conversation context
 * POST /api/chat/export
 * Body: { format, messages, provider, model }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Message, Provider } from '@/lib/types';
import { chatWithFallback } from '@/lib/fallback/providerWrapper';
import type { ExportFormat } from '@/lib/export/exportDetector';

// Get API key from environment based on provider
function getApiKey(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY ?? '';
    case 'openai':
      return process.env.OPENAI_API_KEY ?? '';
    case 'google':
      return process.env.GOOGLE_API_KEY ?? '';
    case 'xai':
      return process.env.XAI_API_KEY ?? '';
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY ?? '';
    case 'lmstudio':
      return process.env.LMStudio_API_KEY || process.env.LM_STUDIO_API_KEY || '';
    case 'ollama':
      return ''; // Ollama doesn't need an API key
    default:
      return '';
  }
}

const EXPORT_SCHEMAS: Record<ExportFormat, { description: string; schema: string }> = {
  pptx: {
    description: 'PowerPoint presentation',
    schema: `{
  "title": "string (presentation title)",
  "slides": [
    {
      "title": "string (slide title)",
      "content": ["string", "string"], (bullet points)
      "notes": "string?" (optional speaker notes)
    }
  ]
}`,
  },
  pdf: {
    description: 'PDF document',
    schema: `{
  "title": "string (document title)",
  "sections": [
    {
      "heading": "string?" (optional section heading),
      "content": "string" (paragraph text)
    }
  ]
}`,
  },
  docx: {
    description: 'Word document',
    schema: `{
  "title": "string (document title)",
  "sections": [
    {
      "heading": "string?" (optional section heading),
      "content": "string" (paragraph text)
    }
  ]
}`,
  },
  xlsx: {
    description: 'Excel spreadsheet',
    schema: `{
  "filename": "string",
  "sheets": [
    {
      "name": "string (sheet name)",
      "headers": ["string", "string"],
      "rows": [["string", "string"], ["string", "string"]]
    }
  ]
}`,
  },
  csv: {
    description: 'CSV data file',
    schema: `{
  "filename": "string",
  "headers": ["string", "string"],
  "rows": [["string", "string"], ["string", "string"]]
}`,
  },
  zip: {
    description: 'ZIP archive',
    schema: `{
  "filename": "string",
  "files": [
    {
      "name": "string (filename with extension)",
      "content": "string (file content)"
    }
  ]
}`,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { format, messages, provider, model } = body as {
      format: ExportFormat;
      messages: Message[];
      provider: Provider;
      model: string;
    };

    if (!format || !messages || !provider || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: format, messages, provider, model' },
        { status: 400 }
      );
    }

    if (!EXPORT_SCHEMAS[format]) {
      return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });
    }

    // Build the system prompt with export schema
    const schema = EXPORT_SCHEMAS[format];
    const systemPrompt = `You are a document generation assistant. The user is asking you to create a ${schema.description}.

Based on the conversation provided, generate the document structure ONLY as valid JSON matching this schema:

${schema.schema}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no explanation text
- Start directly with the JSON object {
- Ensure all strings are properly escaped
- Make the content comprehensive and well-structured
- Use the conversation as context for what to generate`;

    // Get conversationId from the first message
    const conversationId = messages[0]?.conversationId || 'export-' + Date.now();

    // Prepend the system instruction to the first user message instead of creating a separate message
    // This avoids issues with Message type requirements and works better with provider APIs
    const messagesForAI: Message[] =
      messages.length > 0
        ? [
            ...messages.slice(0, -1),
            {
              ...messages[messages.length - 1],
              content: `[EXPORT SCHEMA: ${systemPrompt}]\n\n${messages[messages.length - 1].content}`,
            },
          ]
        : messages;

    // Get API key
    const apiKey = getApiKey(provider);
    if (!apiKey && provider !== 'ollama') {
      return NextResponse.json(
        { error: `API key not found for provider: ${provider}` },
        { status: 401 }
      );
    }

    // Call the AI with fallback support
    const response = await chatWithFallback(messagesForAI, provider, model, apiKey);

    // Parse the response - expect JSON
    let parsedData;
    try {
      // Try to extract JSON if the response has extra text
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[Export API] JSON parse error:', parseErr, 'Response:', response.content.slice(0, 200));
      return NextResponse.json(
        {
          error: 'Failed to parse AI response as JSON',
          hint: 'Try again or adjust your request',
          raw: response.content.slice(0, 500),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: parsedData });
  } catch (err) {
    console.error('[Export API] Error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
