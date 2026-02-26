/**
 * Edit Block Parser
 * Parses AI responses for EDIT blocks and applies them surgically to code
 */

export interface EditBlock {
  startLine: number;
  endLine: number;
  newCode: string;
  language?: string;
}

export interface ParsedEditResponse {
  hasEditBlocks: boolean;
  editBlocks: EditBlock[];
  explanation: string;
  fullFileCode: string | null; // If AI returned full file instead of edit blocks
}

/**
 * Parse AI response for EDIT blocks
 * Format: EDIT lines [start]-[end]:\n```[lang]\n[code]\n```
 */
export function parseEditBlocks(response: string): ParsedEditResponse {
  const result: ParsedEditResponse = {
    hasEditBlocks: false,
    editBlocks: [],
    explanation: "",
    fullFileCode: null,
  };

  // Extract explanation (text before first EDIT block or code block)
  const firstEditMatch = response.match(/EDIT\s+lines?\s+\d+/i);
  const firstCodeMatch = response.match(/```/);

  if (firstEditMatch) {
    result.explanation = response.substring(0, firstEditMatch.index).trim();
  } else if (firstCodeMatch) {
    result.explanation = response.substring(0, firstCodeMatch.index).trim();
  } else {
    result.explanation = response.trim();
    return result;
  }

  // Look for EDIT blocks
  // Format: EDIT lines 45-48:\n```lang\ncode\n```
  const editBlockRegex = /EDIT\s+lines?\s+(\d+)(?:\s*[-–—to]\s*(\d+))?:\s*\n?```(\w*)\n([\s\S]*?)```/gi;
  let match;

  while ((match = editBlockRegex.exec(response)) !== null) {
    const startLine = parseInt(match[1], 10);
    const endLine = match[2] ? parseInt(match[2], 10) : startLine;
    const language = match[3] || undefined;
    const newCode = match[4];

    result.editBlocks.push({
      startLine,
      endLine,
      newCode,
      language,
    });
  }

  if (result.editBlocks.length > 0) {
    result.hasEditBlocks = true;
    return result;
  }

  // No EDIT blocks found - check if there's a full code block (regenerated file)
  const fullCodeRegex = /```(\w*)\n([\s\S]*?)```/g;
  const codeMatches = [...response.matchAll(fullCodeRegex)];

  if (codeMatches.length > 0) {
    // Use the last (or largest) code block as the full file
    const largestBlock = codeMatches.reduce((a, b) =>
      (b[2]?.length || 0) > (a[2]?.length || 0) ? b : a
    );
    result.fullFileCode = largestBlock[2]?.trim() || null;
  }

  return result;
}

/**
 * Apply EDIT blocks to existing code
 * Returns the modified code
 */
export function applyEditBlocks(originalCode: string, editBlocks: EditBlock[]): string {
  if (editBlocks.length === 0) return originalCode;

  const lines = originalCode.split('\n');

  // Sort edit blocks by start line in REVERSE order
  // This way we apply from bottom to top, so line numbers don't shift
  const sortedBlocks = [...editBlocks].sort((a, b) => b.startLine - a.startLine);

  for (const block of sortedBlocks) {
    // Convert to 0-indexed
    const startIdx = block.startLine - 1;
    const endIdx = block.endLine - 1;

    // Validate indices
    if (startIdx < 0 || startIdx >= lines.length) {
      console.warn(`[EditBlockParser] Invalid start line ${block.startLine}, skipping`);
      continue;
    }

    const newLines = block.newCode.split('\n');

    // Replace lines from startIdx to endIdx (inclusive) with new code
    const deleteCount = Math.max(0, endIdx - startIdx + 1);
    lines.splice(startIdx, deleteCount, ...newLines);
  }

  return lines.join('\n');
}

/**
 * Check if a response looks like it contains edit blocks
 */
export function hasEditBlocks(response: string): boolean {
  return /EDIT\s+lines?\s+\d+/i.test(response);
}

/**
 * Calculate a simple diff summary
 */
export function getDiffSummary(original: string, modified: string): { added: number; removed: number } {
  const origLines = original.split('\n').length;
  const modLines = modified.split('\n').length;

  return {
    added: Math.max(0, modLines - origLines),
    removed: Math.max(0, origLines - modLines),
  };
}
