# shitty-extensions

Custom extensions and skills for [pi coding agent](https://github.com/badlogic/pi-mono).

## Table of Contents

- [Installation](#installation)
- [Available Extensions](#available-extensions)
  - [oracle.ts](#oraclets) - Get second opinions from other AI models
  - [memory-mode.ts](#memory-modets) - Save instructions to AGENTS.md
  - [plan-mode.ts](#plan-modets) - Read-only exploration mode
  - [handoff.ts](#handoffts) - Transfer context to new sessions
  - [usage-bar.ts](#usage-barts) - AI provider usage statistics
  - [ultrathink.ts](#ultrathinkts) - Rainbow animated "ultrathink" effect
  - [status-widget.ts](#status-widgetts) - Provider status in footer
  - [cost-tracker.ts](#cost-trackerts) - Session spending analysis
  - [funny-working-message.ts](#funny-working-messagets) - Randomized spinner "Working..." text
  - [speedreading.ts](#speedreadingts) - RSVP speed reader (Spritz-style)
  - [loop.ts](#loopts) - Conditional loops by mitsuhiko
  - [flicker-corp.ts](#flicker-corpts) - Authentic fullscreen flicker experience
- [Available Skills](#available-skills)
  - [a-nach-b](#a-nach-b) - Austrian public transport (VOR AnachB)
- [License](#license)

---

## Installation

### Via npm (recommended)

Install globally to make all extensions available to pi:

```bash
npm install -g shitty-extensions
```

Then add to your `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["shitty-extensions"]
}
```

Or reference individual extensions:

```json
{
  "extensions": [
    "shitty-extensions/extensions/oracle.ts",
    "shitty-extensions/extensions/usage-bar.ts"
  ]
}
```

### Via CLI flag

Load extensions for a single session:

```bash
pi -e shitty-extensions
```

Or load specific extensions:

```bash
pi -e shitty-extensions/extensions/oracle.ts
```

### Skills Installation

Skills are discovered from specific directories. After installing the npm package, symlink the skills:

```bash
# Find where npm installed the package
SHITTY_EXT=$(npm root -g)/shitty-extensions

# Symlink skills for pi
ln -s $SHITTY_EXT/skills/a-nach-b ~/.pi/agent/skills/

# Optional: Also for Claude Code and Codex CLI
ln -s $SHITTY_EXT/skills/a-nach-b ~/.claude/skills/
ln -s $SHITTY_EXT/skills/a-nach-b ~/.codex/skills/
```

Or add the package's skills directory to your settings.json:

```json
{
  "skills": {
    "customDirectories": ["<path-to-global-node-modules>/shitty-extensions/skills"]
  }
}
```

### Manual installation

Clone the repo and reference directly:

```bash
git clone https://github.com/hjanuschka/shitty-extensions.git ~/shitty-extensions

# In settings.json
{
  "extensions": ["~/shitty-extensions"]
}

# Or via CLI
pi -e ~/shitty-extensions
```

---

## Available Extensions

Extensions are located in the `extensions/` directory.

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

### speedreading.ts

RSVP (Rapid Serial Visual Presentation) speed reader using Spritz-style technique. Displays words one at a time with the ORP (Optimal Recognition Point) highlighted for faster reading.

#### Commands

| Command | Description |
|---------|-------------|
| `/speedread` | Speed read the last AI response (default) |
| `/speedread <text>` | Speed read provided text |
| `/speedread -c` | Speed read from clipboard |
| `/speedread -l` | Speed read last AI response (explicit) |
| `/speedread -wpm 500` | Set words per minute (default: 400) |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | Speed read last AI response |

#### Controls (in reader)

| Key | Action |
|-----|--------|
| `SPACE` | Play/pause |
| `←` / `→` | Seek ±1 word |
| `[` / `]` | Jump ±10 words |
| `↑` / `↓` | Adjust speed (±25 WPM) |
| `B` | Toggle big ASCII art font |
| `R` | Restart |
| `Q` / `ESC` | Quit |

#### Features

- **ORP highlighting**: The optimal recognition point (roughly 1/3 into each word) is highlighted in red
- **Adaptive timing**: Longer words and punctuation get extra display time
- **Big font mode**: Toggle ASCII art block letters for larger display
- **Progress tracking**: Shows word count, actual WPM, and ETA

#### Example

```
  ╭──────────────────────────────────────────────────────────────────────────────────────╮
  │                                                                                      │
  │                                           │                                          │
  ├───────────────────────────────────────────┼──────────────────────────────────────────┤
  │                                       reading                                        │
  ├───────────────────────────────────────────┼──────────────────────────────────────────┤
  │                                           │                                          │
  │                                                                                      │
  │  ────────────────────────────────────────────────────────────────────────────400 wpm │
  ╰──────────────────────────────────────────────────────────────────────────────────────╯

  ▶ 42/128

  SPACE play/pause  ←→ ±1  [] ±10  ↑↓ speed  B big font  R restart  Q quit
```

The `a` in "reading" would be highlighted in red as the ORP.

---

### loop.ts

**Author:** [mitsuhiko](https://github.com/mitsuhiko) ([@mitsuhiko](https://twitter.com/mitsuhiko)) | **Origin:** [agent-stuff](https://github.com/mitsuhiko/agent-stuff/blob/main/pi-extensions/loop.ts)

Start a follow-up loop until a breakout condition is met.

#### Commands

| Command | Description |
|---------|-------------|
| `/loop` | Open loop mode selector |
| `/loop tests` | Loop until tests pass |
| `/loop custom <condition>` | Loop until custom condition met |
| `/loop self` | Agent decides when to stop |

#### Features

- **Breakout conditions**: Define when the loop should stop (tests pass, custom condition, etc.)
- **Status widget**: Shows active loop state and turn count
- **Compaction**: Preserves loop state during context compaction
- **Auto-continue**: Automatically triggers follow-up prompts until done

---

### flicker-corp.ts

**Authentic FULLSCREEN FLICKER experience.**

Randomly glitches your screen with intense colors and noise to keep you on your toes. "Just be annoying!"

#### Commands

| Command | Description |
|---------|-------------|
| `/flicker-corp` | Toggle the flicker experience |
| `/signature-flicker` | Alias for flicker-corp |

---

## Available Skills

Skills are located in the `skills/` directory. They provide domain-specific knowledge that agents automatically load when relevant tasks are detected.

### a-nach-b

🚇 Austrian public transport (VOR AnachB) for all of Austria.

Query real-time departures, search stations/stops, plan routes between locations, and check service disruptions for Austrian trains, buses, trams, and metro (U-Bahn).

#### What it does

- **Real-time departures** at any stop
- **Route planning** between any two locations
- **Service disruptions** and alerts
- **Station search** by name to find station IDs

#### Example queries

- "How do I get from Vienna to Salzburg?"
- "When is the next U1 from Stephansplatz?"
- "Are there any train disruptions today?"
- "Find stop ID for Karlsplatz"

#### Included scripts

| Script | Description |
|--------|-------------|
| `search.sh` | Find stations/stops by name |
| `departures.sh` | Get real-time departures |
| `route.sh` | Plan a trip between locations |
| `disruptions.sh` | List service disruptions |

See [skills/a-nach-b/SKILL.md](skills/a-nach-b/SKILL.md) for full API documentation.

---

## Directory Structure

```
shitty-extensions/
├── package.json         # npm package config with pi extensions field
├── extensions/          # Pi agent extensions (.ts files)
│   ├── oracle.ts
│   ├── memory-mode.ts
│   ├── plan-mode.ts
│   ├── handoff.ts
│   ├── usage-bar.ts
│   ├── ultrathink.ts
│   ├── status-widget.ts
│   ├── cost-tracker.ts
│   ├── funny-working-message.ts
│   ├── speedreading.ts
│   ├── loop.ts
│   └── flicker-corp.ts
├── skills/              # Agent skills (symlink after install)
│   └── a-nach-b/
│       ├── SKILL.md     # Skill definition & API docs
│       ├── search.sh
│       ├── departures.sh
│       ├── route.sh
│       └── disruptions.sh
└── README.md
```

---

## License

MIT
