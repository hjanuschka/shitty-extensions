# shitty-extensions

Custom extensions for [pi coding agent](https://github.com/badlogic/pi-mono).

## Table of Contents

- [Available Extensions](#available-extensions)
  - [oracle.ts](#oraclets) - Get second opinions from other AI models
  - [memory-mode.ts](#memory-modets) - Save instructions to AGENTS.md
  - [plan-mode.ts](#plan-modets) - Read-only exploration mode
  - [handoff.ts](#handoffts) - Transfer context to new sessions
  - [usage-bar.ts](#usage-barts) - AI provider usage statistics
  - [ultrathink.ts](#ultrathinkts) - Rainbow animated "ultrathink" effect
  - [status-widget.ts](#status-widgetts) - Provider status in footer
  - [cost-tracker.ts](#cost-trackerts) - Session spending analysis
- [data-harvest.ts](#data-harvestts) - Joke "data collection" prompts
- [Installation](#installation)
- [License](#license)

---

## Available Extensions

### oracle.ts

🔮 Get a second opinion from another AI model without switching contexts.

#### Commands

| Command | Description |
|---------|-------------|
| `/oracle <prompt>` | Ask for a second opinion with model picker |
| `/oracle -m gpt-4o <prompt>` | Direct query to specific model |
| `/oracle -f file.ts <prompt>` | Include file(s) in context |

#### Features

- **Inherits conversation context**: Oracle sees your full conversation with the primary AI
- **Model picker UI**: Choose from available models (only shows authenticated ones)
- **Quick keys**: Press 1-9 to quickly select a model
- **Add to context option**: After response, choose whether to add Oracle's answer to your conversation
- **Excludes current model**: Only shows alternative models for true second opinions

#### Supported Models

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o1, o1-mini, o3-mini |
| **OpenAI Codex** | gpt-5.2-codex, codex-mini |
| **Google** | gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro |
| **Anthropic** | claude-sonnet-4-5, claude-opus-4, claude-haiku-3-5 |

#### Example Flow

```
/oracle Is this the right approach for the API design?

╭────────────────────────────────────────────────────────────╮
│ 🔮 Oracle - Second Opinion                                 │
├────────────────────────────────────────────────────────────┤
│ Prompt: Is this the right approach for the API design?     │
├────────────────────────────────────────────────────────────┤
│ ↑↓/jk navigate • 1-9 quick select • Enter send             │
│                                                            │
│ ❯ 1. GPT-4o (openai)                                       │
│   2. Gemini 2.5 Pro (google)                               │
│   3. Claude Sonnet 4.5 (anthropic)                         │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Esc cancel                                                 │
╰────────────────────────────────────────────────────────────╯

[After response...]

╭────────────────────────────────────────────────────────────╮
│ 🔮 Oracle Response (GPT-4o)                                │
├────────────────────────────────────────────────────────────┤
│ Q: Is this the right approach for the API design?          │
├────────────────────────────────────────────────────────────┤
│ Based on the conversation, I see you're building a REST    │
│ API with nested resources. A few thoughts:                 │
│                                                            │
│ 1. The approach looks solid for simple cases...            │
│ ...                                                        │
├────────────────────────────────────────────────────────────┤
│ Add to current conversation context?                       │
│                                                            │
│        [ YES ]           NO                                │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ ←→/Tab switch  Enter confirm  Y/N quick                    │
╰────────────────────────────────────────────────────────────╯
```

---

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

- **AI-assisted integration**: The current model intelligently integrates instructions
- **Preview before save**: Review proposed changes before committing

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

---

### handoff.ts

Transfer context to a new focused session.

#### Commands

| Command | Description |
|---------|-------------|
| `/handoff <goal>` | Generate a context-aware prompt for a new session |

---

### usage-bar.ts

Display AI provider usage statistics with status polling and reset countdowns.

#### Commands

| Command | Description |
|---------|-------------|
| `/usage` | Show usage statistics popup |

#### Supported Providers

| Provider | Metrics Shown | Auth Source |
|----------|---------------|-------------|
| **Claude** | 5h window, Week, Sonnet/Opus | pi auth, macOS Keychain |
| **Copilot** | Premium, Chat | pi auth, `gh auth token` |
| **Gemini** | Pro quota, Flash quota | pi auth (`google-gemini-cli`) |
| **Codex** | 5h window, Day, Credits | pi auth (`openai-codex`) |
| **Kiro** | Credits, Bonus credits | `kiro-cli` |
| **z.ai** | Token limits, Monthly | `Z_AI_API_KEY` env or pi auth |

#### Features

- **Provider status polling**: Shows outage/incident status
- **Reset countdowns**: Shows when limits reset
- **Visual progress bars**: Color-coded remaining quota

---

### ultrathink.ts

Rainbow animated "ultrathink" text effect with Knight Rider shimmer.

#### Commands

| Command | Description |
|---------|-------------|
| `/ultrathink` | Trigger the rainbow animation |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+U` | Trigger ultrathink |

---

### status-widget.ts

Persistent provider status indicator in the footer.

#### Commands

| Command | Description |
|---------|-------------|
| `/status` | Toggle status widget on/off |
| `/status-refresh` | Force refresh status now |

---

### cost-tracker.ts

Analyze spending from pi session logs.

#### Commands

| Command | Description |
|---------|-------------|
| `/cost` | Show spending for last 30 days |
| `/cost <days>` | Show spending for last N days |

---

### data-harvest.ts

🎭 A joke extension that parodies Claude's feedback prompts. Shows creepy-looking "data collection" prompts that do absolutely nothing.

#### Commands

| Command | Description |
|---------|-------------|
| `/harvest` | Manually trigger a creepy prompt (for testing) |

#### Features

- **Auto-triggers**: Shows after 3-8 random messages or 2-5 minutes
- **Creepy prompts**: Parodies data collection with absurd options
- **Keyboard response**: Press 0-3 while prompt is showing to respond
- **Complete no-op**: All responses do nothing except show a joke notification
- **Auto-dismiss**: Goes away after 15 seconds if ignored

#### Example Prompts

```
● Upload ~/.ssh to improve suggestions? (optional)
    1: Yes    2: Also .env    3: Everything    0: Dismiss

● Mining crypto in background... Allow more CPU?
    1: 50%    2: 100%    3: Overclock    0: Dismiss

● Enable keystroke logging for better UX?
    1: Okay    2: Also mouse    3: And webcam    0: Dismiss

● How is Claude doing this session? (mandatory)
    1: Bad    2: Fine    3: Good    0: Nice try
```

#### Response Messages

| Key | Message |
|-----|---------|
| 0 | *(silently dismisses)* |
| 1 | 📡 Data transmission initiated... just kidding! 😄 |
| 2 | 🔓 Access granted... not really! 🎭 |
| 3 | 💾 Exfiltrating everything... lol nope! 🃏 |

---

## Installation

### Option 1: Symlink to extensions directory

```bash
# This repo IS the extensions directory
ln -s /path/to/shitty-extensions ~/.pi/agent/extensions
```

### Option 2: Copy individual files

```bash
cp oracle.ts ~/.pi/agent/extensions/
cp usage-bar.ts ~/.pi/agent/extensions/
# etc.
```

### Option 3: Use -e flag

```bash
pi -e /path/to/shitty-extensions/oracle.ts
```

---

## License

MIT
