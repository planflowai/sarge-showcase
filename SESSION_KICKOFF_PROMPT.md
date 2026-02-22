# SESSION KICKOFF PROMPT
# Paste this at the start of each Claude Code session

---

STOP. Print your current working directory. If it is NOT L:\ai_builder\ai_builderv2, do NOT proceed.

Re-read CLAUDE.md — it has the full spec with Phases 2-5.

CRITICAL RULES:
1. ONLY modify files in: L:\ai_builder\ai_builderv2
2. Do NOT break existing features.
3. Port 5000. Ollama at 127.0.0.1:11434.

CURRENT STATUS: Phase 1 complete. Phase 2 in progress — Claude.ai artifact UX. Several fixes still needed.

What's the next task?

---

# IMMEDIATE FIXES (paste one at a time):

# Fix 1: "Context injection text [CONTEXT — AUTO-INJECTED] is showing in chat. It must be invisible. The user message in chat should only show what they typed. The context is injected silently into the API request. Fix builderChatStore.ts and BuilderChat.tsx."

# Fix 2: "The layout must be: [Sidebar 200px] [Chat 400px] [Artifact Panel rest-of-screen]. Artifact panel always visible on the right, taking the majority of width. Verify with DevTools that all three panels render with correct widths."

# Fix 3: "Preview iframe is blank. Debug the srcdoc — log what it receives, check sandbox and CSP settings. The iframe must render HTML visually. This is a blocker."

# Fix 4: "Add live streaming preview. As AI streams code, pipe tokens into preview iframe every 100ms. User sees the page build live. Add pulsing Live indicator."

# Fix 5: "Artifact cards must show ZERO lines of code. Only icon, title, language badge, Open Code and Preview buttons. Remove any code thumbnails."
