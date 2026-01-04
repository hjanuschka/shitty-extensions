# pfuschhooks

Custom hooks for [pi coding agent](https://github.com/badlogic/pi-mono).

## Available Hooks

### memory-mode.ts

Save instructions to AGENTS.md files with AI-assisted integration.

**Commands:**
- `/mem <instruction>` - Save an instruction
- `/remember <instruction>` - Alias for `/mem`

**Features:**
- Choose save location: Project Local, Project, or Global
- AI integrates instruction into existing file structure intelligently
- Groups related instructions under appropriate headings
- Avoids duplicating rules (updates existing ones instead)
- Preview changes before saving
- AGENTS.local.md auto-added to .gitignore

**Example:**
```
/mem Never use git commands directly
/mem Always use TypeScript strict mode
/mem Prefer async/await over callbacks
```

### usage-bar.ts

Shows AI provider usage statistics like [CodexBar](https://github.com/steipete/CodexBar), but as a pi hook.

**Commands:**
- `/usage` - Show usage statistics for all configured providers

**Supported Providers:**
- **Claude/Anthropic** - 5h window, weekly limit, model-specific (Sonnet/Opus)
- **GitHub Copilot** - Premium interactions, chat quota
- **Google Gemini** - Pro/Flash model quotas

**Credential Sources:**
- Claude: `~/.pi/agent/auth.json` (pi login) or Claude CLI keychain
- Copilot: `~/.pi/agent/auth.json` or `gh auth token`
- Gemini: `~/.gemini/oauth_creds.json`

**Example Output:**
```
╭─────────────────────────────────────────────────────╮
│ AI Usage                                            │
├─────────────────────────────────────────────────────┤
│ Claude                                              │
│   5h      █░░░░░░░░░░░  96% (43m)                  │
│   Week    ██░░░░░░░░░░  81% (Jan 8)                │
│   Sonnet  ░░░░░░░░░░░░  99%                        │
│                                                     │
│ Copilot                                             │
│   HTTP 404                                          │
│                                                     │
│ Gemini                                              │
│   HTTP 401                                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Press any key to close                              │
╰─────────────────────────────────────────────────────╯
```

## Installation

### Option 1: Copy to hooks directory

```bash
# Global hooks (all projects)
cp memory-mode.ts ~/.pi/agent/hooks/

# Project-local hooks
cp memory-mode.ts .pi/hooks/
```

### Option 2: Add to settings.json

```json
{
  "hooks": ["/path/to/pfuschhooks/memory-mode.ts"]
}
```

### Option 3: Use --hook flag

```bash
pi --hook /path/to/pfuschhooks/memory-mode.ts
```

## License

MIT
