# S.A.R.G.E. User Manual

**Synthetic Adversarial Reasoning & Guarding Engine**

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Dashboard](#dashboard)
4. [Features](#features)
   - [Chat](#chat)
   - [AI Builder](#ai-builder)
   - [Debate Arena](#debate-arena)
   - [Batch Processing](#batch-processing)
   - [Test Mode](#test-mode)
   - [Prompt Journal](#prompt-journal)
   - [Prompt Optimizer](#prompt-optimizer)
   - [Live Checker](#live-checker)
   - [Real World](#real-world)
   - [Review](#review)
   - [Forensic Log](#forensic-log)
   - [Prompt Library](#prompt-library)
   - [Diagnostics](#diagnostics)
   - [AI Analysis](#ai-analysis)
5. [Settings](#settings)
6. [Providers & Models](#providers--models)
7. [Component Library](#component-library)
8. [Air Gap Mode](#air-gap-mode)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Troubleshooting](#troubleshooting)

---

## Overview

S.A.R.G.E. is a comprehensive AI development and testing platform that replaces multiple paid tools with a single, free, model-agnostic application. It supports both cloud providers (Anthropic, OpenAI, Google, xAI, DeepSeek) and local models via Ollama.

### What S.A.R.G.E. Replaces

| Paid Tool | S.A.R.G.E. Feature | Benefit |
|-----------|-------------------|---------|
| Pinegrow | AI Builder + local models | Design pages with AI for free |
| Claude.ai Artifacts | Live preview + artifact cards | See code render in real-time |
| Claude Code Extension | AI file operations + terminal | AI edits real project files, you approve |

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Ollama** (optional, for local models) - runs at `127.0.0.1:11434`
- **API Keys** (optional, for cloud providers)

### Installation

```bash
# Clone or download the project
cd ai_builderv2

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app runs at `http://localhost:5000` by default.

### First-Time Setup

1. Navigate to **Settings** from the sidebar
2. Add your API keys for cloud providers (optional)
3. Install Ollama and download models for local AI (optional)
4. Configure your preferred models in the **Models** section

---

## Dashboard

The dashboard is your command center, showing:

- **S.A.R.G.E.** title with gradient styling
- **Stat Pills** - Quick stats showing:
  - Total models available
  - Connected providers
  - Number of features
  - Session uptime
- **Feature Cards** - 14 clickable cards for quick access to all features
- **Available Models** - Real-time view of all available models:
  - **Cloud Providers**: Claude, GPT, Gemini, Grok, DeepSeek (with connection status)
  - **Local Models**: Ollama models (with running status)
- **Status Bar** - Bottom bar showing connection status for all providers and Air Gap mode

---

## Features

### Chat

The main conversational interface for interacting with AI models.

**Key Features:**
- Multi-model support (switch between any configured model)
- Conversation history with auto-save
- Context file attachments
- Voice input support
- Code syntax highlighting in responses
- Markdown rendering
- Export conversations

**How to Use:**
1. Select a provider and model from the dropdowns
2. Type your message in the input area
3. Press Enter or click Send
4. View AI responses with full formatting

---

### AI Builder

A visual code generation environment with live preview capabilities.

**Key Features:**
- **3-Panel Layout**: Sidebar | Chat | Artifact Panel
- **Live Preview**: Watch code render in real-time as AI generates it
- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **Artifact Cards**: Compact cards in chat showing generated code
- **File Explorer**: Browse and manage project files
- **Terminal**: Built-in terminal for running commands
- **Component Library**: Save and reuse generated components

**How to Use:**
1. Navigate to **AI Builder** from the dashboard or sidebar
2. Select a builder-enabled model from the dropdown
3. Describe what you want to build (e.g., "Create a dark mode toggle button")
4. Watch the AI generate code with live preview
5. Use the artifact panel to view/edit code, preview results, or see diffs
6. Save useful components to your library for reuse

**Builder Workflow:**
1. **Design** - Use AI to generate pages, components, layouts
2. **Wire** - Run `npm install`, `npm run dev` in the terminal
3. **Iterate** - Tell AI to modify code ("move the button", "change colors")
4. **Escalate** - Switch to cloud models for complex tasks

---

### Debate Arena

AI vs AI debate system for comparing model responses and reasoning.

**Key Features:**
- Multiple models debate a topic simultaneously
- Round-based discussion format
- Side-by-side response comparison
- Executive summary generation
- Debate history tracking

**How to Use:**
1. Click **Debate Arena** or use the keyboard shortcut
2. Enter a debate topic or question
3. Select 2+ models to participate
4. Set the number of rounds
5. Watch models argue different perspectives
6. Review the executive summary

---

### Batch Processing

Run the same prompt against multiple models in parallel.

**Key Features:**
- Test one prompt across many models simultaneously
- Compare response quality, speed, and token usage
- Export results for analysis
- History of batch runs

**How to Use:**
1. Select **Batch Processing** from the dashboard
2. Enter your test prompt
3. Select multiple models to test
4. Run the batch
5. Compare results side-by-side

---

### Test Mode

A/B testing for AI responses with detailed comparison.

**Key Features:**
- Compare two models head-to-head
- Multiple test rounds
- Response timing metrics
- Quality scoring
- Live console output

**How to Use:**
1. Open **Test Mode**
2. Select Model A and Model B
3. Enter your test prompt
4. Run the test
5. Review and compare responses

---

### Prompt Journal

Track and annotate your prompting experiments.

**Key Features:**
- Save prompts with notes
- Tag and categorize prompts
- Track what worked and what didn't
- AI-powered analysis of prompt effectiveness
- Search and filter history

**How to Use:**
1. Navigate to **Prompt Journal**
2. Create new entries with prompts and notes
3. Use the AI analyzer to get improvement suggestions
4. Build a library of effective prompts

---

### Prompt Optimizer

AI-powered prompt refinement and improvement.

**Key Features:**
- Analyze prompt quality
- Get AI suggestions for improvements
- Test optimized versions
- Compare original vs optimized results

**How to Use:**
1. Open **Prompt Optimizer**
2. Paste your original prompt
3. Select an AI model for analysis
4. Review improvement suggestions
5. Test the optimized prompt

---

### Live Checker

Real-time monitoring and validation of AI outputs.

**Key Features:**
- Monitor AI responses as they stream
- Set validation rules and checks
- Alert on unexpected outputs
- Track response patterns over time

---

### Real World

Edge case and real-world scenario testing.

**Key Features:**
- Test AI with challenging scenarios
- Edge case libraries
- Adversarial prompt testing
- Response robustness analysis

---

### Review

Analyze and review conversation history.

**Key Features:**
- Browse all past conversations
- Filter by model, date, or content
- Batch comparison views
- Verdict panels for quality assessment
- AI-assisted review

---

### Forensic Log

Deep debugging and investigation tools.

**Key Features:**
- **Timeline View**: Chronological event tracking
- **Investigation View**: Detailed analysis of specific sessions
- **Replay View**: Step through conversations
- **Export View**: Export data for external analysis
- Session recording and playback

**How to Use:**
1. Open **Forensic Log**
2. Select a session to investigate
3. Use the timeline to navigate events
4. Drill down into specific interactions
5. Export findings as needed

---

### Prompt Library

Reusable prompt templates and collections.

**Key Features:**
- Pre-built prompt templates
- Custom prompt creation
- Category organization
- Quick insert into chat
- Share and import prompts

**How to Use:**
1. Navigate to **Prompt Library**
2. Browse existing templates
3. Create custom prompts
4. Click to insert into active chat

---

### Diagnostics

System health and performance monitoring.

**Key Features:**
- Provider connection status
- API key validation
- Model availability checks
- Performance metrics
- Error logging

**How to Use:**
1. Open **Diagnostics**
2. Review connection status for all providers
3. Run health checks
4. View error logs if issues arise

---

### AI Analysis

Multi-tool AI analysis combining multiple features.

**Key Features:**
- Chat interface for analysis
- Debate view for comparing analyses
- Test view for validation
- Batch history for tracking
- Forensic deep-dive

---

## Settings

Access settings via the **Settings** link in the sidebar.

### Available Settings

- **API Keys**: Configure keys for each cloud provider
- **Models**: Enable/disable models, set builder tags
- **Theme**: Light/dark mode toggle
- **Air Gap**: Enable/disable local-only mode
- **Ollama**: Configure Ollama connection
- **Custom Models**: Add custom model configurations

### Model Configuration

Each model can be configured with:
- **Enabled/Disabled** toggle
- **Builder** tag (hammer icon) - marks model for use in AI Builder
- Custom parameters (temperature, max tokens, etc.)

---

## Providers & Models

### Cloud Providers

| Provider | Models | API Key Required |
|----------|--------|------------------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku, etc. | Yes |
| **OpenAI** | GPT-4o, GPT-4 Turbo, GPT-3.5, etc. | Yes |
| **Google** | Gemini 1.5 Pro, Gemini 1.5 Flash, etc. | Yes |
| **xAI** | Grok-2, Grok-2 Vision, etc. | Yes |
| **DeepSeek** | DeepSeek V3, DeepSeek Coder, etc. | Yes |

### Local Models (Ollama)

S.A.R.G.E. supports any model available through Ollama:

- **Code Models**: qwen2.5-coder, deepseek-coder, codellama, starcoder
- **General Models**: llama3, mistral, mixtral, phi, gemma
- **Specialized**: neural-chat, dolphin, orca, etc.

**Setting up Ollama:**
1. Install Ollama from https://ollama.ai
2. Pull models: `ollama pull llama3`
3. Ollama runs automatically at `127.0.0.1:11434`
4. S.A.R.G.E. detects available models automatically

---

## Component Library

Save and reuse code components generated in AI Builder.

### Saving Components

1. Generate code in AI Builder
2. Click **Save to Library** in the artifact panel
3. Add a name, description, and tags
4. Component is saved for future use

### Using Saved Components

1. Open the Component Library from the Builder sidebar
2. Browse or search components
3. Click to insert into current chat
4. AI can modify the component as needed

### Full Library Browser

Access the full-screen component library at `/component-library` for:
- Grid view of all components
- Preview and code view
- Edit metadata
- Delete components

---

## Air Gap Mode

Air Gap mode restricts the app to local models only, preventing any cloud API calls.

### Enabling Air Gap Mode

1. Go to **Settings**
2. Toggle **Air Gap Mode** on
3. All cloud providers will be disabled
4. Only Ollama models will be available

### Use Cases

- **Privacy**: Keep all data local
- **Offline Work**: Work without internet
- **Cost Control**: Avoid API charges
- **Security**: Sensitive data never leaves your machine

### Status Indicator

The dashboard status bar shows Air Gap status:
- **Air Gap: ON** - Local only (amber icon)
- **Air Gap: OFF** - All providers enabled

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Send message |
| `Ctrl/Cmd + N` | New conversation |
| `Ctrl/Cmd + K` | Quick command palette |
| `Escape` | Close modal/panel |
| `Ctrl/Cmd + B` | Toggle sidebar |
| `Ctrl/Cmd + /` | Focus chat input |

---

## Troubleshooting

### Common Issues

**Provider shows "Not Connected"**
- Verify API key is correct in Settings
- Check internet connection
- Ensure provider service is not down

**Ollama models not showing**
- Verify Ollama is running: `ollama serve`
- Check Ollama is at `127.0.0.1:11434`
- Pull at least one model: `ollama pull llama3`

**Preview not rendering in Builder**
- Ensure code is complete HTML with `<html>`, `<head>`, `<body>` tags
- Check browser console for iframe errors
- Try refreshing the preview

**Slow responses**
- Local models depend on your hardware (GPU recommended)
- Cloud models may have rate limits
- Check network connectivity for cloud providers

**Conversation not saving**
- Check Supabase connection in Diagnostics
- Verify browser localStorage is enabled
- Check for console errors

### Getting Help

- Check the **Diagnostics** page for system status
- Review **Forensic Log** for error details
- Check browser console for JavaScript errors

---

## Technical Details

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React + Tailwind CSS + shadcn/ui
- **State**: Zustand stores
- **Editor**: Monaco Editor
- **Database**: Supabase (optional)
- **Local AI**: Ollama integration

### File Structure

```
app/                    # Next.js app router pages
├── dashboard/          # Main dashboard
├── builder/            # AI Builder
├── settings/           # Settings page
├── journal/            # Prompt Journal
├── library/            # Prompt Library
├── diagnostics/        # System diagnostics
└── ...                 # Other feature pages

components/
├── Builder/            # AI Builder components
├── chat/               # Chat components
├── debate/             # Debate Arena components
├── forensic/           # Forensic Log components
├── test/               # Test Mode components
├── layout/             # Layout components
└── ui/                 # Shared UI components

lib/
├── providers.ts        # Provider configurations
├── stores/             # Zustand state stores
└── supabase/           # Supabase integration
```

### Environment Variables

```env
# Supabase (optional)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Keys (can also be set in Settings UI)
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
GOOGLE_API_KEY=your-key
XAI_API_KEY=your-key
DEEPSEEK_API_KEY=your-key
```

---

## Version History

- **v2.0** - Complete rebuild with AI Builder, Component Library, enhanced Dashboard
- **v1.0** - Initial release with Chat, Debate, Test Mode

---

*S.A.R.G.E. - Synthetic Adversarial Reasoning & Guarding Engine*
