# Agent Configuration

## Skills

### Wiener Linien

Vienna public transport real-time data skill published to ClawdHub.

**Slug:** `wienerlinien`

#### Update from ClawdHub

```bash
clawdhub update wienerlinien --dir ~/.pi/skills
```

#### Publish new version

```bash
clawdhub publish ~/.pi/skills/wienerlinien \
  --slug wienerlinien \
  --name "Wiener Linien" \
  --version <NEW_VERSION> \
  --changelog "<DESCRIPTION OF CHANGES>" \
  --tags "latest,vienna,transit,austria"
```

---

### ÖBB Scotty

Austrian rail travel planner skill (from [mitsuhiko/agent-stuff](https://github.com/mitsuhiko/agent-stuff)).

**Slug:** `oebb-scotty`

#### Update from ClawdHub

```bash
clawdhub update oebb-scotty --dir ~/.pi/skills
```

#### Publish new version

```bash
clawdhub publish ~/.pi/skills/oebb-scotty \
  --slug oebb-scotty \
  --name "ÖBB Scotty" \
  --version <NEW_VERSION> \
  --changelog "<DESCRIPTION OF CHANGES>" \
  --tags "latest,austria,transit,trains,oebb"
```
