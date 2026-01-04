# shitty-extensions

Custom hooks for [pi coding agent](https://github.com/badlogic/pi-mono).

## Table of Contents

- [Available Hooks](#available-hooks)
  - [memory-mode.ts](#memory-modets) - Save instructions to AGENTS.md
  - [plan-mode.ts](#plan-modets) - Read-only exploration mode
  - [handoff.ts](#handoffts) - Transfer context to new sessions
  - [usage-bar.ts](#usage-barts) - AI provider usage statistics
- [Installation](#installation)
- [License](#license)

---

## Available Hooks

### memory-mode.ts

Save instructions to AGENTS.md files with AI-assisted integration.

#### Commands

| Command | Description |
|---------|-------------|
| `/mem <instruction>` | Save an instruction to AGENTS.md |
| `/remember <instruction>` | Alias for `/mem` |

#### Features

- **Location selector**: Choose where to save:

  | Location | File | Use Case |
  |----------|------|----------|
  | Project Local | `./AGENTS.local.md` | Personal preferences, auto-added to `.gitignore` |
  | Project | `./AGENTS.md` | Shared with team |
  | Global | `~/.pi/agent/AGENTS.md` | All your projects |

- **AI-assisted integration**: The current model intelligently integrates instructions:
  - Groups related instructions under appropriate headings
  - Avoids duplicating rules (updates existing ones instead)
  - Maintains consistent formatting with existing content

- **Preview before save**: Review proposed changes before committing

#### Example

```
/mem Never use git commands directly
/mem Always use TypeScript strict mode
/mem Prefer async/await over callbacks
```

---

### plan-mode.ts

Claude Code-style "plan mode" for safe code exploration.

#### Commands

| Command | Description |
|---------|-------------|
| `/plan` | Toggle plan mode on/off |
| `/todos` | Show current plan todo list |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+P` | Toggle plan mode |

#### CLI Flags

| Flag | Description |
|------|-------------|
| `--plan` | Start session in plan mode |

#### Features

- **Read-only mode**: In plan mode, only these tools are available:
  - `read` - Read file contents
  - `bash` (read-only commands only)
  - `grep` - Search file contents
  - `find` - Find files
  - `ls` - List directories

- **Destructive command blocking**: Blocks commands like `rm`, `mv`, `git commit`, `npm install`, etc.

- **Plan execution flow**:
  1. Enable plan mode with `/plan`
  2. Agent explores code in read-only mode
  3. Agent creates a plan with numbered steps
  4. After each response, prompts: "Execute plan?" or "Continue planning?"
  5. When executing, tracks progress with visual checkboxes

- **Todo tracking**: View progress with `/todos` or watch the sidebar widget

- **Visual indicator**: Shows "⏸ plan" in footer when active, "📋 X/Y" during execution

#### Example

```
/plan
> Analyze the codebase and create a plan to refactor the authentication module

# Agent explores in read-only mode, creates numbered plan
# Prompts to execute or continue planning
# During execution, shows progress: ☑ Step 1, ☐ Step 2, etc.
```

---

### handoff.ts

Transfer context to a new focused session. Instead of compacting (which is lossy), handoff extracts what matters for your next task and creates a new session with a generated prompt.

#### Commands

| Command | Description |
|---------|-------------|
| `/handoff <goal>` | Generate a context-aware prompt for a new session |

#### Features

- **AI-generated context transfer**: Automatically summarizes:
  - Key decisions made in the conversation
  - Approaches taken and findings discovered
  - Relevant files that were discussed or modified
  - Clear next steps based on your goal

- **Editable draft**: The generated prompt appears in the editor for review and editing before submitting

- **Session linking**: New sessions track their parent session for reference

#### Use Cases

- Long conversations approaching context limits
- Switching focus to a related but distinct task
- Breaking large tasks into focused sub-sessions
- Handing off partial work to continue later

#### Example

```
/handoff now implement this for teams as well
/handoff execute phase one of the plan
/handoff check other places that need this fix
```

---

### usage-bar.ts

Display AI provider usage statistics for Claude, GitHub Copilot, and Google Gemini.

#### Commands

| Command | Description |
|---------|-------------|
| `/usage` | Show usage statistics popup |

#### Supported Providers

| Provider | Metrics Shown |
|----------|---------------|
| **Claude** | 5-hour window, 7-day window, model-specific (Sonnet/Opus) |
| **Copilot** | Premium interactions, Chat usage |
| **Gemini** | Pro quota, Flash quota |

#### Features

- **Multi-provider support**: See all your AI usage in one view
- **Visual progress bars**: Color-coded remaining quota (green → yellow → red)
- **Reset timers**: Shows when rate limits will reset
- **Auto-detection**: Finds credentials from pi auth, Claude CLI keychain, gh CLI, and Gemini config

#### Credential Sources

| Provider | Locations Checked |
|----------|-------------------|
| Claude | `~/.pi/agent/auth.json`, macOS Keychain (Claude Code) |
| Copilot | `~/.pi/agent/auth.json`, `gh auth token` |
| Gemini | `~/.gemini/oauth_creds.json` |

#### Example Output

```
╭─────────────────────────────────────────────╮
│ AI Usage                                    │
├─────────────────────────────────────────────┤
│ Claude                                      │
│   5h      ████████░░░░  33%  (2h)          │
│   Week    ██░░░░░░░░░░  85%                │
│                                             │
│ Copilot (pro)                               │
│   Premium ████░░░░░░░░  67%                │
│   Chat    ░░░░░░░░░░░░ 100%                │
│                                             │
│ Gemini                                      │
│   Pro     ██████░░░░░░  50%                │
│   Flash   ░░░░░░░░░░░░ 100%                │
├─────────────────────────────────────────────┤
│ Press any key to close                      │
╰─────────────────────────────────────────────╯
```

---

## Installation

### Option 1: Copy to hooks directory

```bash
# Global hooks (all projects)
cp *.ts ~/.pi/agent/hooks/

# Or project-local hooks
mkdir -p .pi/hooks
cp *.ts .pi/hooks/
```

### Option 2: Add to settings.json

Add to `~/.pi/agent/settings.json`:

```json
{
  "hooks": [
    "/path/to/shitty-extensions/memory-mode.ts",
    "/path/to/shitty-extensions/plan-mode.ts",
    "/path/to/shitty-extensions/handoff.ts",
    "/path/to/shitty-extensions/usage-bar.ts"
  ]
}
```

### Option 3: Use --hook flag

```bash
pi --hook /path/to/shitty-extensions/memory-mode.ts \
   --hook /path/to/shitty-extensions/plan-mode.ts \
   --hook /path/to/shitty-extensions/handoff.ts \
   --hook /path/to/shitty-extensions/usage-bar.ts
```

---

## License

MIT
