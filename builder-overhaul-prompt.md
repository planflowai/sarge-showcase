# BUILDER OVERHAUL — The Seamless Experience

## THE GOAL
The Builder tab must feel like using claude.ai + Claude Code + live preview in a single UI. The user types what they want, the AI researches, plans, builds multi-file projects, shows a working preview, and accepts edits that surgically modify existing files. No context loss. No regeneration. No broken previews.

## WHAT EXISTS (DO NOT REBUILD)
- Builder tab with BuilderChat, ArtifactPanel, BuilderSidebar, FileTree
- File system APIs: `/api/builder/list-directory`, `/api/builder/read-file`, `/api/builder/write-file`, `/api/builder/create-project`
- Monaco editor in ArtifactPanel with Code/Preview/Diff tabs
- Content detection (HTML/React/snippet) in `lib/contentDetector.ts`
- Builder Auto-Router in `lib/builderAutoRouter.ts` (Tier 1/2/3 routing)
- BuilderFileTree component with project creation
- builderDocumentStore with project management
- Web search pattern detection ([SEARCH:] and [FETCH:] commands)
- Preview iframe in ArtifactPanel
- Streaming chat with token metrics
- All cloud + local model support through existing `/api/chat` route

## WHAT'S BROKEN (FIX ALL OF THESE)

### 1. PREVIEW CANNOT RENDER MULTI-FILE PROJECTS
The AI generates `index.html` that links to `styles.css` and `script.js`. The preview iframe uses `srcdoc` which cannot resolve relative file references. Result: unstyled HTML with no JS.

**FIX:** Create `/api/builder/preview/route.ts`:
- GET `/api/builder/preview?project=PROJECT_NAME&file=index.html`
- Serves the file from `BUILDER_PROJECTS_DIR/PROJECT_NAME/`
- For HTML files: before serving, inline all linked CSS and JS files from the same project directory
  - Find all `<link rel="stylesheet" href="X">` tags where X is a local file (not CDN) → read the CSS file from disk → replace the link tag with `<style>/* from X */\n{CSS content}</style>`
  - Find all `<script src="X">` tags where X is a local file → read the JS file from disk → replace the script tag with `<script>/* from X */\n{JS content}</script>`
  - Leave CDN links (anything starting with http:// or https://) untouched
- Set Content-Type: text/html
- Set appropriate CORS headers for iframe loading

Then update the preview iframe in ArtifactPanel.tsx:
- When a project is open AND files are saved to disk, load the preview from: `http://localhost:5000/api/builder/preview?project=${projectName}&file=index.html`
- Set the iframe `src` (not `srcdoc`) to this URL
- Add a refresh button next to the preview that reloads the iframe
- When files change (AI edits or user edits), auto-refresh the iframe after a 500ms debounce
- Fallback: if no project is open, continue using `srcdoc` with in-memory code (current behavior)

### 2. WEB SEARCH RETURNS NO RESULTS
The Builder detects [SEARCH: query] and [FETCH: url] patterns but the search handler either doesn't call a real backend or the backend isn't configured.

**FIX:** Create `/api/web-search/route.ts`:
- POST endpoint, body: `{ query: string, maxResults?: number }`
- Check for available search providers in order:
  1. Tavily (if TAVILY_API_KEY exists in env) — already have `/api/search/tavily`, reuse that logic
  2. Brave Search (if BRAVE_SEARCH_API_KEY exists)
  3. SearXNG (if SEARXNG_URL exists, typically http://localhost:8080)
  4. If none available, return `{ results: [], error: "No search provider configured. Add TAVILY_API_KEY to .env.local" }`
- Response format: `{ results: [{ title, url, snippet, content? }] }`

Create `/api/web-fetch/route.ts`:
- POST endpoint, body: `{ url: string }`
- Fetch the URL using Node.js fetch
- Strip all HTML tags, scripts, nav, footer — extract main content text only
- Truncate to 4000 tokens (approximately 16000 characters)
- Return: `{ url, title, content, wordCount }`

Then update the Builder chat handler (in `app/workspace/studio/page.tsx` or wherever chat messages are processed):
- After the AI response streams in, scan the COMPLETE response text for patterns:
  - `[SEARCH: "query"]` or `[SEARCH: query]`
  - `[FETCH: url]`
- For each [SEARCH:] found: call `/api/web-search` with the query, collect results
- For each [FETCH:] found: call `/api/web-fetch` with the URL, collect content
- If any search/fetch results were collected:
  - Inject them into the conversation as a system message: `[WEB RESEARCH RESULTS]\n{formatted results}`
  - Then send a follow-up message to the AI: `Here are the research results. Now continue with your plan/build using this information.`
  - The AI gets the research and continues building — this creates the research → plan → build flow

IMPORTANT: The search should happen AUTOMATICALLY when the AI outputs [SEARCH:] commands. The user should NOT have to do anything. The chat handler intercepts the pattern, does the search, injects results, and lets the AI continue.

### 3. AI LOSES CONTEXT AND REGENERATES INSTEAD OF EDITING
When the user asks for a change, the AI either:
- Builds a completely new unrelated site
- Returns a partial snippet with "... existing styles ..." placeholders
- Loses track of the project entirely

**FIX:** The Builder system prompt and context injection must be bulletproof.

In the chat handler, BEFORE sending any user message to the AI, build the context payload:

```
CONTEXT INJECTION LOGIC:
1. If a project is open:
   a. Read the file tree from disk (all filenames)
   b. Read the currently active file content from disk
   c. If no file is active, read index.html
   d. Include the content with line numbers

2. Build the system message:

---START SYSTEM CONTEXT---
PROJECT: {projectName}
FILES IN PROJECT:
{list all files with sizes}

ACTIVE FILE: {filename}
```
{file content with line numbers}
```

INSTRUCTIONS:
- You are editing an existing project. The files above are saved on disk.
- When the user asks for a change, modify the EXISTING code. Do NOT create a new site.
- Always return the COMPLETE file content — never use placeholders like "... existing styles ..." or "/* rest of code */".
- If you need to create a new file, prefix it with FILE: filename.ext
- If you need to modify an existing file, prefix it with FILE: filename.ext (this tells the system which file to update)
- After the code, briefly explain what you changed (1-3 sentences).
- For multi-file changes, output each file separately with its FILE: prefix.
---END SYSTEM CONTEXT---
```

3. The response handler must parse FILE: prefixes:
   - Extract each `FILE: filename.ext` block and its code content
   - For each file: call `/api/builder/write-file` to save to disk
   - After all files are saved: refresh the file tree and reload the preview iframe
   - Show a brief toast: "Updated 2 files: index.html, styles.css"

4. PLACEHOLDER DETECTION: After parsing the AI response, scan each code block for these patterns:
   - `/* ... existing styles ... */`
   - `/* ... existing ... */`
   - `/* rest of code */`
   - `// ... existing code ...`
   - `<!-- ... existing ... -->`
   If ANY placeholder is found:
   - Read the original file from disk
   - Send a correction message to the AI: "You used placeholder comments instead of returning the complete file. Here is the current file content. Return the COMPLETE updated file with your changes applied. No placeholders."
   - This auto-corrects lazy model outputs

### 4. UNIFIED CONVERSATION + BUILD FLOW
Right now the chat just takes commands and spits out code. There's no conversational back-and-forth like claude.ai.

**FIX:** Update the Builder system prompt to support both modes naturally:

```
BUILDER SYSTEM PROMPT (replace whatever exists):

You are an expert web developer and designer working inside AI Builder Pro. You have two modes:

CONVERSATION MODE: When the user is discussing, planning, asking questions, or hasn't given a clear build instruction, respond conversationally. Ask clarifying questions. Suggest approaches. Discuss trade-offs. Do NOT generate code unless asked.

BUILD MODE: When the user says "build", "create", "make", "code", or gives a clear build instruction, generate the code. Follow these rules:
- Generate complete, self-contained files
- For new projects: create index.html with all CSS in <style> and JS in <script> (single file) OR separate files prefixed with FILE: filename
- For existing projects: modify only what was requested, return complete files
- Start with a 1-2 sentence explanation, then the code, then a brief summary of what was built/changed
- Use modern CSS (flexbox, grid, custom properties, smooth transitions)
- Include responsive design by default
- Use Font Awesome from CDN for icons when needed
- Use Google Fonts when appropriate

You can research websites using [SEARCH: "query"] and [FETCH: https://url.com] commands. Research results will be provided automatically.

When a project already has code (provided in the system context), you are EDITING that code. Do not start over. Do not change the site topic. Modify only what the user asked for and return the complete updated file(s).
```

### 5. SMOOTH PREVIEW UPDATES
Currently the preview flashes, goes blank, or shows broken content during updates.

**FIX:** In ArtifactPanel.tsx (or wherever the preview iframe lives):
- Keep the PREVIOUS preview visible until the new one is ready
- After files are saved to disk, set a loading state (small spinner overlay on the preview, NOT blank)
- Change the iframe src to the preview API URL with a cache-busting query param: `?t=${Date.now()}`
- On iframe `load` event: remove the spinner
- This means the user always sees either the old working version or the new working version — never a blank screen

### 6. CODE PANEL IMPROVEMENTS
The code panel shows raw code without proper formatting.

**FIX:**
- Enable word wrap in Monaco editor by default: `wordWrap: 'on'`
- When the AI response comes in, automatically switch to the Preview tab (not code tab) — the user wants to SEE the result, not read code
- Add a tab for each project file: clicking a file in the FileTree opens it as a tab in Monaco
- When the AI updates a file, briefly highlight the file tab in green (1.5s fade)

## EXECUTION ORDER
Do these in exact order. Test after each one before moving to the next.

1. Fix #1 (Preview API route + iframe loading from disk) — test: create a project with separate HTML+CSS files, verify preview renders with styles
2. Fix #2 (Web search backend) — test: type a message with [SEARCH: "test query"], verify results come back
3. Fix #3 (Context injection + file parsing + placeholder detection) — test: build a site, then ask for a single change, verify it modifies not regenerates
4. Fix #4 (System prompt update) — test: start a conversation asking about design approaches before building, verify AI converses naturally
5. Fix #5 (Smooth preview transitions) — test: make several edits, verify preview never goes blank
6. Fix #6 (Code panel word wrap + auto-preview) — test: verify code wraps and preview tab is auto-selected after builds

## CRITICAL RULES
- Do NOT break existing Builder features (file tree, terminal, artifact cards, streaming)
- Do NOT break any other tabs (Chat, Debate, Test, etc.)
- Do NOT create new provider integrations — use existing `/api/chat` route for all AI calls
- Do NOT modify files outside of the Builder components and API routes
- Test each fix independently before moving to the next
- The preview MUST show a fully styled, working website — if it doesn't, that fix is not done
