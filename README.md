# shitty-extensions

Custom hooks for [pi coding agent](https://github.com/badlogic/pi-mono).

## Table of Contents

- [Available Hooks](#available-hooks)
  - [memory-mode.ts](#memory-modets)
  - [plan-mode.ts](#plan-modets)
- [Installation](#installation)
  - [Option 1: Copy to hooks directory](#option-1-copy-to-hooks-directory)
  - [Option 2: Add to settings.json](#option-2-add-to-settingsjson)
  - [Option 3: Use --hook flag](#option-3-use---hook-flag)
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
  5. When executing, tracks progress with `[DONE:id]` markers

- **Todo tracking**: View progress with `/todos`

- **Visual indicator**: Shows "plan" in footer when active

#### Example

```
/plan
> Analyze the codebase and create a plan to refactor the authentication module

# Agent explores in read-only mode, creates numbered plan
# Prompts to execute or continue planning
# During execution, marks steps [DONE:1], [DONE:2], etc.
```

---

## Installation

### Option 1: Copy to hooks directory

```bash
# Global hooks (all projects)
cp memory-mode.ts ~/.pi/agent/hooks/
cp plan-mode.ts ~/.pi/agent/hooks/

# Project-local hooks
mkdir -p .pi/hooks
cp memory-mode.ts .pi/hooks/
cp plan-mode.ts .pi/hooks/
```

### Option 2: Add to settings.json

Add to `~/.pi/agent/settings.json`:

```json
{
  "hooks": [
    "/path/to/shitty-extensions/memory-mode.ts",
    "/path/to/shitty-extensions/plan-mode.ts"
  ]
}
```

### Option 3: Use --hook flag

```bash
# Single hook
pi --hook /path/to/shitty-extensions/memory-mode.ts

# Multiple hooks
pi --hook /path/to/shitty-extensions/memory-mode.ts \
   --hook /path/to/shitty-extensions/plan-mode.ts
```

---

## License

MIT
