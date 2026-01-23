# Agent Configuration

This is an npm package for pi coding agent extensions.

## Package Structure

- `package.json` contains the `"pi"` field that declares extensions
- Extensions are in `./extensions/*.ts`
- Skills are in `./skills/*/` (must be symlinked manually after install)

## Installation

```bash
npm install -g shitty-extensions
```

Then add to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["shitty-extensions"]
}
```

## Skills

### A nach B

Universal journey planning skill for transit and routing (from [manmal](https://github.com/manmal)).

**Slug:** `a-nach-b`




The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.

<available_skills>
  <skill>
    <name>a-nach-b</name>
    <description>Austrian public transport (VOR AnachB) for all of Austria. Query real-time departures, search stations/stops, plan routes between locations, and check service disruptions. Use when asking about Austrian trains, buses, trams, metro (U-Bahn), or directions involving public transport in Austria.</description>
    <location>/Users/hjanuschka/.codex/skills/a-nach-b/SKILL.md</location>
  </skill>
  <skill>
    <name>blog-post</name>
    <description>Writing and managing blog posts for januschka.com. Use when creating, editing, or building blog posts with Markdown and YAML front matter.</description>
    <location>/Users/hjanuschka/.codex/skills/blog-post/SKILL.md</location>
  </skill>
  <skill>
    <name>chromium-dev</name>
    <description>Chromium development workflow using the &quot;ch&quot; CLI for Gerrit, code search, and tooling. Use when working on Chromium contributions, navigating the codebase, building, testing, or interacting with Gerrit.</description>
    <location>/Users/hjanuschka/.codex/skills/chromium-dev/SKILL.md</location>
  </skill>
  <skill>
    <name>chromium-gerrit-review</name>
    <description>Chromium Gerrit code review workflow for addressing reviewer comments on CLs. Use when processing review feedback on a Chromium CL, responding to Gerrit comments, or iterating on code review.</description>
    <location>/Users/hjanuschka/.codex/skills/chromium-gerrit-review/SKILL.md</location>
  </skill>
  <skill>
    <name>clusterfuzz-issue-workflow</name>
    <description>Triage and fix Chromium ClusterFuzz issues for the JXL decoder, deciding between Chromium C++ and jxl-rs fixes. Use when a user mentions ClusterFuzz, Chromium issue 475313100, or JXL decoder fuzzer reports.</description>
    <location>/Users/hjanuschka/.codex/skills/clusterfuzz-issue-workflow/SKILL.md</location>
  </skill>
  <skill>
    <name>github-pr-review</name>
    <description>GitHub pull request code review workflow for addressing reviewer comments. Use when processing review feedback on a GitHub PR, responding to review comments, or iterating on PR feedback using the gh CLI.</description>
    <location>/Users/hjanuschka/.codex/skills/github-pr-review/SKILL.md</location>
  </skill>
  <skill>
    <name>gitlab-issue-debug</name>
    <description>Workflow for investigating and debugging GitLab issues, particularly for WordPress plugins at krone.at infrastructure. Use when working with GitLab issues, WordPress plugin debugging, or krone.at projects.</description>
    <location>/Users/hjanuschka/.codex/skills/gitlab-issue-debug/SKILL.md</location>
  </skill>
</available_skills>
