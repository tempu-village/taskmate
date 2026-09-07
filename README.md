# TaskMate

TaskMate is a simple, local-first Todoist-style task list for Obsidian, paired with an Agent Skill that turns explicitly selected notes into reviewable tasks.

Tasks stay in your vault as readable Markdown. There is no TaskMate account, hosted database, or synchronization server.

## Current MVP

- Today, Next 7 days, Upcoming, All, Unplanned, and Completed smart views
- Manual drag ordering shared by every view
- Date, importance, and creation-date sorting without destroying manual order
- Importance, no-date, and text filters
- Desktop and mobile Obsidian support
- One readable Markdown file per task, with a stable ID in frontmatter
- Explicit AI source folders with per-note include and exclude overrides
- Coverage review before an agent may omit a possible action

Calendar, Kanban, recurrence, reminders, and a hosted sync service are intentionally outside the MVP.

## Install the Obsidian plugin for development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/taskmate/`, restart Obsidian, and enable **TaskMate** under Community plugins.

Open TaskMate from its ribbon icon or run **TaskMate: タスク一覧を開く** from the command palette.

## Select notes for the agent

Run **TaskMate: 現在のフォルダをAI対象にする**, or add one vault-relative folder per line under **Settings → TaskMate → AI source folders**.

Individual notes override their folder rule:

```yaml
taskmate-source: true  # include this note anywhere
taskmate-source: false # exclude this note from an included folder
```

Processed source notes receive `taskmate-import-*` provenance properties. A content hash lets the skill detect a later edit without treating its own metadata as a change.

## Install and invoke the Agent Skill

Install `skills/taskmate` using an Agent Skills-compatible client. During local development, link it into the user skill directory:

```bash
mkdir -p "$HOME/.agents/skills"
ln -s "$(pwd)/skills/taskmate" "$HOME/.agents/skills/taskmate"
```

Then open the vault as the Codex project and ask:

```text
$taskmate Review the selected source notes and propose every Todo candidate.
```

The skill presents a coverage review before writing. Every candidate is added, merged, or explicitly excluded with user approval.

## Repository structure

```text
src/                 Obsidian plugin source
test/                Plugin domain tests
skills/taskmate/     Portable Agent Skill and deterministic helper
docs/adr/            Accepted architectural decisions
CONTEXT.md            Domain vocabulary
```

## Verify

```bash
npm run typecheck
npm test
npm run build
python3 -m unittest discover -s skills/taskmate/tests -v
python3 scripts/validate_skills.py
```

## License

[MIT](./LICENSE)
