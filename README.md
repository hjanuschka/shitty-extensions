# shitty-extensions

Custom extensions and skills for [pi coding agent](https://github.com/badlogic/pi-mono).

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
  - [funny-working-message.ts](#funny-working-messagets) - Randomized spinner "Working..." text
  - [speedreading.ts](#speedreadingts) - RSVP speed reader (Spritz-style)
  - [loop.ts](#loopts) - Conditional loops by mitsuhiko
  - [flicker-corp.ts](#flicker-corpts) - Authentic fullscreen flicker experience
- [Available Skills](#available-skills)
  - [wienerlinien](#wienerlinien) - Vienna public transport real-time data
  - [oebb-scotty](#oebb-scotty) - Austrian rail travel planner (ÖBB)
- [Installation](#installation)
- [License](#license)

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

### wienerlinien

🚇 Vienna public transport (Wiener Linien) real-time data.

Query real-time departures, service disruptions, elevator outages, and stop information for Vienna's U-Bahn, trams, and buses.

#### What it does

- **Real-time departures** at any stop
- **Service disruptions** (short-term and long-term)
- **Elevator outages** at U-Bahn stations
- **Stop search** by name to find RBL stop IDs

#### Example queries

- "When is the next U1 from Stephansplatz?"
- "Are there any U-Bahn disruptions?"
- "Which elevators are out of service?"
- "Find stop ID for Karlsplatz"

#### Included scripts

| Script | Description |
|--------|-------------|
| `search-stop.sh` | Find stop IDs by name |
| `departures.sh` | Get real-time departures |
| `disruptions.sh` | List service disruptions |
| `elevators.sh` | Show elevator outages |

#### Common Stop IDs

| Stop | RBL IDs | Lines |
|------|---------|-------|
| Stephansplatz | 252, 4116, 4119 | U1, U3 |
| Karlsplatz | 143, 144, 4101, 4102 | U1, U2, U4 |
| Westbahnhof | 1346, 1350, 1368 | U3, U6 |
| Praterstern | 4205, 4210 | U1, U2 |
| Schwedenplatz | 1489, 1490, 4103 | U1, U4 |

See [skills/wienerlinien/SKILL.md](skills/wienerlinien/SKILL.md) for full API documentation.

---

### oebb-scotty

🚂 Austrian rail travel planner (ÖBB Scotty).

Plan train journeys in Austria, check departures/arrivals at stations, and get service disruptions for ÖBB trains, S-Bahn, regional trains, and connections to neighboring countries.

#### What it does

- **Trip planning** between any two stations
- **Station departures/arrivals** with real-time updates
- **Service disruptions** and alerts
- **Station search** by name

#### Example queries

- "How do I get from Vienna to Salzburg?"
- "When is the next train from Wien Hbf to Graz?"
- "Show arrivals at Linz Hbf"
- "Are there any train disruptions today?"

#### Included scripts

| Script | Description |
|--------|-------------|
| `search-station.sh` | Find stations by name |
| `departures.sh` | Get station departures |
| `arrivals.sh` | Get station arrivals |
| `trip.sh` | Plan a journey |
| `disruptions.sh` | List service alerts |

#### Common Station IDs

| Station | extId |
|---------|-------|
| Wien Hbf | 1190100 |
| Wien Meidling | 1190528 |
| Salzburg Hbf | 8100002 |
| Graz Hbf | 8100173 |
| Linz Hbf | 8100013 |
| Innsbruck Hbf | 8100108 |

See [skills/oebb-scotty/SKILL.md](skills/oebb-scotty/SKILL.md) for full API documentation.

---

## Installation

### Via agent-config (recommended)

If you use [agent-config](https://github.com/hjanuschka/agent-config), extensions and skills are installed automatically:

```bash
cd ~/agent-config && ./install.sh
```

This will:
- Clone/update this repo to `~/shitty-extensions`
- Symlink `extensions/` to `~/.pi/agent/extensions`
- Symlink skills from `skills/` to `~/.pi/agent/skills/`, `~/.claude/skills/`, `~/.codex/skills/`

### Manual installation

#### Extensions

```bash
# Option 1: Symlink extensions directory
ln -s ~/shitty-extensions/extensions ~/.pi/agent/extensions

# Option 2: Copy individual files
cp ~/shitty-extensions/extensions/oracle.ts ~/.pi/agent/extensions/

# Option 3: Use -e flag
pi -e ~/shitty-extensions/extensions/oracle.ts
```

#### Skills

```bash
# Symlink individual skills
ln -s ~/shitty-extensions/skills/wienerlinien ~/.pi/agent/skills/
ln -s ~/shitty-extensions/skills/wienerlinien ~/.claude/skills/
ln -s ~/shitty-extensions/skills/wienerlinien ~/.codex/skills/
```

---

## Directory Structure

```
shitty-extensions/
├── extensions/          # Pi agent extensions (.ts files)
│   ├── oracle.ts
│   ├── memory-mode.ts
│   ├── plan-mode.ts
│   ├── handoff.ts
│   ├── usage-bar.ts
│   ├── ultrathink.ts
│   ├── status-widget.ts
│   ├── cost-tracker.ts
│   └── speedreading.ts
├── skills/              # Agent skills (auto-loaded by task)
│   ├── wienerlinien/
│   │   ├── SKILL.md     # Skill definition & API docs
│   │   ├── README.md
│   │   ├── departures.sh
│   │   ├── disruptions.sh
│   │   ├── elevators.sh
│   │   └── search-stop.sh
│   └── oebb-scotty/
│       ├── SKILL.md     # Skill definition & API docs
│       ├── README.md
│       ├── arrivals.sh
│       ├── departures.sh
│       ├── disruptions.sh
│       ├── search-station.sh
│       └── trip.sh
└── README.md
```

---

## License

MIT
