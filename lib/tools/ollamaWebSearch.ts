/**
 * Ollama Web Search Tool
 *
 * Provides web search capability for local models via Ollama's web_search API.
 * Used during multi-pass consensus evaluation to fact-check claims.
 *
 * IMPORTANT: This is the ONLY external call allowed - air-gap preserved for all other operations.
 */

export interface WebSearchResult {
  query: string;
  results: {
    title: string;
    url: string;
    snippet: string;
  }[];
  timestamp: string;
  error?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// Regex patterns to detect tool calls in model output
const TOOL_CALL_PATTERNS = [
  // Standard Ollama tool call format
  /<tool_call>\s*{\s*"name"\s*:\s*"web_search"\s*,\s*"arguments"\s*:\s*{\s*"query"\s*:\s*"([^"]+)"\s*}\s*}\s*<\/tool_call>/i,
  // Simplified format
  /\[web_search:\s*"?([^"\]]+)"?\]/i,
  // Function call format
  /web_search\(\s*["']([^"']+)["']\s*\)/i,
  // Natural language request
  /(?:I need to|Let me|I'll|I will|I should)\s+(?:search|look up|verify|check)\s+(?:for\s+)?["']?([^"'\n.]+)["']?/i,
];

/**
 * Detects if model output contains a web_search tool call
 * @param content Model output text
 * @returns Extracted query if tool call found, null otherwise
 */
export function detectToolCall(content: string): string | null {
  for (const pattern of TOOL_CALL_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Executes web search via Ollama's web_search API
 * @param query Search query string
 * @returns Search results or error
 */
export async function executeWebSearch(query: string): Promise<WebSearchResult> {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  try {
    // Ollama web search endpoint
    const response = await fetch(`${baseUrl}/api/web_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      // Fallback: try alternative endpoint format
      const altResponse = await fetch(`${baseUrl}/v1/web_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!altResponse.ok) {
        throw new Error(`Web search failed: ${response.status}`);
      }

      const altData = await altResponse.json();
      return {
        query,
        results: altData.results || [],
        timestamp: new Date().toISOString(),
      };
    }

    const data = await response.json();
    return {
      query,
      results: data.results || [],
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WebSearch] Error:', errorMessage);
    return {
      query,
      results: [],
      timestamp: new Date().toISOString(),
      error: errorMessage,
    };
  }
}

/**
 * Formats web search results as context for the model
 * @param result Web search result object
 * @returns Formatted string for model consumption
 */
export function formatSearchResults(result: WebSearchResult): string {
  if (result.error) {
    return `[Web Search Error: ${result.error}]`;
  }

  if (result.results.length === 0) {
    return `[Web Search: No results found for "${result.query}"]`;
  }

  const formatted = result.results
    .slice(0, 5) // Limit to top 5 results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   Source: ${r.url}`)
    .join('\n\n');

  return `[Web Search Results for "${result.query}"]\n\n${formatted}\n\n[End of Search Results]`;
}

/**
 * Process model output, detect and execute tool calls, return augmented response
 * @param content Model output
 * @param maxSearches Maximum number of searches allowed (default: 2)
 * @returns Object with original content, tool results, and whether tool was called
 */
export async function processToolCalls(
  content: string,
  maxSearches: number = 2
): Promise<{
  originalContent: string;
  toolResults: string[];
  toolCalled: boolean;
}> {
  const toolResults: string[] = [];
  let searchCount = 0;

  // Check for tool calls
  const query = detectToolCall(content);

  if (query && searchCount < maxSearches) {
    const result = await executeWebSearch(query);
    toolResults.push(formatSearchResults(result));
    searchCount++;
  }

  return {
    originalContent: content,
    toolResults,
    toolCalled: toolResults.length > 0,
  };
}

/**
 * Web search tool instruction to add to agent prompts
 */
export const WEB_SEARCH_TOOL_INSTRUCTION = `
You have access to a web_search tool for real-time fact verification.

USE IT ONLY WHEN:
- The claim involves time-sensitive information (dates, current events, recent changes)
- The claim is controversial or contradicts established anchors
- You need external verification to confirm or refute a specific fact

TO USE: Output exactly: [web_search: "your query here"]

RULES:
- Maximum 2 searches per response
- Keep queries specific and factual
- Do NOT search for opinions or subjective content
- After receiving results, integrate them into your analysis
`;

/**
 * Judge-specific instruction for locking truth anchors
 */
export const JUDGE_CONSENSUS_INSTRUCTION = `
MULTI-PASS CONSENSUS PROTOCOL:

After 3-5 passes of evaluation, if ALL of these conditions are met:
1. 3+ independent sources agree on the fact
2. No contradiction with existing truth anchors
3. No agent has raised valid objections

Then output on a NEW LINE:
JUDGE LOCKED TRUTH: [exact fact statement]

If NO consensus after 5 passes, output:
UNRESOLVED: [claim] - [reason for non-consensus]

IMPORTANT: Only lock facts that are verifiable and agreed upon. Never lock opinions.
`;
