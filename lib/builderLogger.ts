/**
 * Builder Logger - Auto-changelog system for BUILDER_LOG.md
 *
 * Manages the BUILDER_LOG.md file in project roots:
 * - Auto-appends entries after file changes
 * - Generates session summaries
 * - Preserves project history for AI context
 * - Syncs to Supabase for persistence
 */

import { useSyncStatusStore, shouldSync } from "@/lib/stores/syncStatusStore";
import { useUIStore } from "@/lib/stores/uiStore";

export interface ChangeEntry {
  timestamp: Date;
  filePath: string;
  action: 'created' | 'modified' | 'deleted';
  summary: string;
  model: string;
  provider: string;
}

export interface SessionLog {
  date: string;
  changes: ChangeEntry[];
  currentPlan?: string;
  nextSteps?: string[];
}

/**
 * Format a single change entry as markdown
 */
function formatChangeEntry(entry: ChangeEntry): string {
  const time = entry.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const actionEmoji = entry.action === 'created' ? '✨' : entry.action === 'modified' ? '✏️' : '🗑️';
  return `- ${actionEmoji} \`${entry.filePath}\` — ${entry.summary} *(${time}, ${entry.model})*`;
}

/**
 * Format a date for session headers
 */
function formatSessionDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get today's date string for session grouping
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse existing BUILDER_LOG.md content
 */
export function parseBuilderLog(content: string): {
  projectName: string;
  currentState: string;
  sessions: Map<string, string[]>;
} {
  const lines = content.split('\n');
  let projectName = 'Unknown Project';
  let currentState = '';
  const sessions = new Map<string, string[]>();

  let currentSection = '';
  let currentDate = '';
  let sectionContent: string[] = [];

  for (const line of lines) {
    // Extract project name from title
    if (line.startsWith('# Builder Log')) {
      const match = line.match(/# Builder Log — (.+)/);
      if (match) projectName = match[1];
      continue;
    }

    // Detect section headers
    if (line.startsWith('## Current State')) {
      if (currentSection && currentDate) {
        sessions.set(currentDate, sectionContent);
      }
      currentSection = 'state';
      sectionContent = [];
      continue;
    }

    if (line.startsWith('## Session:')) {
      if (currentSection === 'state') {
        currentState = sectionContent.join('\n').trim();
      } else if (currentDate) {
        sessions.set(currentDate, sectionContent);
      }
      currentSection = 'session';
      // Extract date from "## Session: Monday, January 15, 2024"
      const dateMatch = line.match(/## Session: (.+)/);
      currentDate = dateMatch ? dateMatch[1] : getTodayKey();
      sectionContent = [];
      continue;
    }

    // Collect section content
    if (currentSection) {
      sectionContent.push(line);
    }
  }

  // Save last section
  if (currentSection === 'state') {
    currentState = sectionContent.join('\n').trim();
  } else if (currentDate) {
    sessions.set(currentDate, sectionContent);
  }

  return { projectName, currentState, sessions };
}

/**
 * Generate a new BUILDER_LOG.md file
 */
export function generateNewLog(projectName: string): string {
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return `# Builder Log — ${projectName}
Last updated: ${timestamp}

## Current State
*Project initialized. No changes recorded yet.*

## Session: ${formatSessionDate(now)}
### Changes Made
*No changes yet.*

### Current Plan
*No plan set.*

### Next Steps
- [ ] Start building!
`;
}

/**
 * Append a change entry to existing log content
 */
export function appendChangeEntry(
  existingContent: string,
  entry: ChangeEntry,
  projectName: string
): string {
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // If no existing content, create new log
  if (!existingContent.trim()) {
    const newLog = generateNewLog(projectName);
    return appendChangeEntry(newLog, entry, projectName);
  }

  const todayHeader = `## Session: ${formatSessionDate(now)}`;
  const entryLine = formatChangeEntry(entry);

  // Update "Last updated" timestamp
  let content = existingContent.replace(
    /Last updated: .+/,
    `Last updated: ${timestamp}`
  );

  // Check if today's session exists
  if (content.includes(todayHeader)) {
    // Find the "### Changes Made" section for today and append
    const sessionStart = content.indexOf(todayHeader);
    const changesStart = content.indexOf('### Changes Made', sessionStart);

    if (changesStart !== -1) {
      // Find the next section or end of content
      const nextSectionMatch = content.slice(changesStart + 20).match(/\n### /);
      const insertPoint = nextSectionMatch
        ? changesStart + 20 + nextSectionMatch.index!
        : content.indexOf('\n\n### Current Plan', changesStart);

      if (insertPoint !== -1) {
        // Remove placeholder if it exists
        const beforeInsert = content.slice(0, insertPoint);
        const afterInsert = content.slice(insertPoint);

        const cleanedBefore = beforeInsert.replace(/\n\*No changes yet\.\*\n?/, '\n');
        content = cleanedBefore + entryLine + '\n' + afterInsert;
      } else {
        // Append after "### Changes Made"
        const afterChanges = content.slice(changesStart);
        const lineEnd = afterChanges.indexOf('\n', 17);
        const insertAt = changesStart + lineEnd + 1;

        content = content.slice(0, insertAt) +
          content.slice(insertAt).replace(/^\*No changes yet\.\*\n?/, '') +
          entryLine + '\n';
      }
    }
  } else {
    // Create new session for today
    const newSession = `
${todayHeader}
### Changes Made
${entryLine}

### Current Plan
*Continuing development.*

### Next Steps
- [ ] Continue with current task

`;

    // Insert before the first existing session or at end
    const firstSessionMatch = content.match(/\n## Session:/);
    if (firstSessionMatch && firstSessionMatch.index) {
      content = content.slice(0, firstSessionMatch.index) + newSession + content.slice(firstSessionMatch.index);
    } else {
      content += newSession;
    }
  }

  return content;
}

/**
 * Generate a full session summary (for "Save Progress" button)
 */
export function generateSessionSummary(
  existingContent: string,
  projectName: string,
  recentChanges: ChangeEntry[],
  currentState: string,
  nextSteps: string[]
): string {
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Start with new log if empty
  if (!existingContent.trim()) {
    existingContent = generateNewLog(projectName);
  }

  const todayHeader = `## Session: ${formatSessionDate(now)}`;

  // Build changes section
  const changesSection = recentChanges.length > 0
    ? recentChanges.map(formatChangeEntry).join('\n')
    : '*No changes in this session.*';

  // Build next steps checklist
  const nextStepsSection = nextSteps.length > 0
    ? nextSteps.map(step => `- [ ] ${step}`).join('\n')
    : '- [ ] Continue development';

  // Update current state section
  let content = existingContent.replace(
    /## Current State[\s\S]*?(?=\n## Session:|$)/,
    `## Current State\n${currentState || '*No state summary available.*'}\n\n`
  );

  // Update timestamp
  content = content.replace(
    /Last updated: .+/,
    `Last updated: ${timestamp}`
  );

  // Update or create today's session
  if (content.includes(todayHeader)) {
    // Replace today's session content
    const sessionRegex = new RegExp(
      `${todayHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n## Session:|$)`
    );
    content = content.replace(sessionRegex, `${todayHeader}
### Changes Made
${changesSection}

### Current Plan
${currentState || '*Continuing development.*'}

### Next Steps
${nextStepsSection}

`);
  } else {
    // Add new session at the top (after Current State)
    const newSession = `${todayHeader}
### Changes Made
${changesSection}

### Current Plan
${currentState || '*Continuing development.*'}

### Next Steps
${nextStepsSection}

`;

    const currentStateEnd = content.indexOf('\n## Session:');
    if (currentStateEnd !== -1) {
      content = content.slice(0, currentStateEnd) + '\n' + newSession + content.slice(currentStateEnd);
    } else {
      content += '\n' + newSession;
    }
  }

  return content;
}

/**
 * Extract a brief summary from AI response for changelog
 * Looks for the first sentence or first line before code blocks
 */
export function extractSummaryFromResponse(aiResponse: string): string {
  // Remove code blocks
  const withoutCode = aiResponse.replace(/```[\s\S]*?```/g, '').trim();

  // Get first meaningful line
  const lines = withoutCode.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'Updated file';

  let summary = lines[0].trim();

  // Clean up common prefixes
  summary = summary.replace(/^(I'll|I've|I will|Let me|Here's|Here is|I'm going to)\s+/i, '');
  summary = summary.replace(/^(the\s+)?file\s+(has been\s+)?/i, '');

  // Truncate if too long
  if (summary.length > 100) {
    summary = summary.substring(0, 97) + '...';
  }

  // Capitalize first letter
  summary = summary.charAt(0).toUpperCase() + summary.slice(1);

  // Remove trailing punctuation for consistency
  summary = summary.replace(/[.!?]+$/, '');

  return summary || 'Updated file';
}

/**
 * Sync BUILDER_LOG.md content to Supabase
 * Call this after any log update
 */
export async function syncBuilderLogToSupabase(
  projectName: string,
  content: string
): Promise<void> {
  if (!shouldSync()) {
    useSyncStatusStore.getState().setStatus("airgap");
    return;
  }

  try {
    const { processQueuedItem } = await import("@/lib/supabase/syncQueue");
    const success = await processQueuedItem({
      id: `log_${Date.now()}`,
      type: "builderLog",
      operation: "update",
      data: { projectName, content },
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });

    if (success) {
      useSyncStatusStore.getState().setLastSync("builderLog");
    } else {
      // Queue for retry
      useSyncStatusStore.getState().addToQueue({
        type: "builderLog",
        operation: "update",
        data: { projectName, content },
      });
    }
  } catch (err) {
    console.warn("[BuilderLog] Failed to sync to Supabase:", err);
    useSyncStatusStore.getState().addToQueue({
      type: "builderLog",
      operation: "update",
      data: { projectName, content },
    });
    useUIStore.getState().showToast({
      message: "Log sync failed — saved locally",
      type: "warning",
      duration: 4000,
    });
  }
}

/**
 * Fetch BUILDER_LOG.md from Supabase (for project restoration)
 */
export async function fetchBuilderLogFromSupabase(
  projectName: string
): Promise<string | null> {
  if (!shouldSync()) {
    return null;
  }

  try {
    const { fetchSupabaseBuilderLog } = await import("@/lib/supabase/syncQueue");
    return await fetchSupabaseBuilderLog(projectName);
  } catch (err) {
    console.warn("[BuilderLog] Failed to fetch from Supabase:", err);
    return null;
  }
}
