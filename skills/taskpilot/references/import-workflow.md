# Source-note import

Read this reference whenever existing Obsidian notes should become TaskMate tasks. Task Pilot discovers the notes, builds the coverage review and stages it with [import-review-workflow.md](import-review-workflow.md). The user then edits, decides and applies every candidate in TaskMate; Task Pilot never creates or changes canonical tasks for an import.

## Discover eligible notes

Use `python3 scripts/todo_store.py sources --vault <vault>` when available. It reads the plugin's explicit `sourceFolders` allowlist. A note property overrides the folder rule:

- `taskmate-source: true` includes a note anywhere in the vault.
- `taskmate-source: false` excludes a note inside a selected folder.
- no property inherits the selected-folder rule.

The folder setting may include subfolders. Exclude the task, project, proposal, rolling-plan, and `.obsidian` folders. Discovery may inspect frontmatter to apply these deterministic rules; it does not authorize interpreting unrelated notes.

## Build a coverage review

Read each eligible new or changed note completely. First inventory every source statement that could reasonably imply follow-up, copied exactly from the note body; this is the statement inventory. Then map every statement to exactly one candidate:

1. **create** — a new task, with the statements it covers;
2. **merge** — a change to one existing task, with the statements it covers;
3. **exclude** — a statement that could reasonably imply action but that you propose not to add, with a concise reason. The user confirms or changes every exclusion in TaskMate.

Default every ambiguous action to **create**. Pure headings and connective prose need not enter the inventory, but background facts, decisions, promises, questions, and dependencies must be accounted for whenever they could imply follow-up work.

Read [coverage-review-examples.md](coverage-review-examples.md) when building the inventory. It shows meeting notes, ambiguous background, task merging, task splitting, and explicit exclusions.

Stage the complete review with [import-review-workflow.md](import-review-workflow.md) before the user decides anything. Do not create or change canonical task files. Apply the task-boundary rules in [task-schema.md](task-schema.md); the agent may decide whether related statements become one task or several.

## Provenance

TaskMate records the import on a source note once every candidate from that note has been applied in TaskMate:

```yaml
taskmate-import-status: processed
taskmate-imported-at: "ISO timestamp"
taskmate-imported-hash: "content hash"
taskmate-task-ids:
  - "task-id"
```

Do not write these properties yourself for a staged review. The content hash excludes these processing fields, so recording the import does not make the note appear changed. When a processed note changes later, its current hash differs from `taskmate-imported-hash`; stage a new review for it and leave existing tasks unchanged until the user applies the new candidates.

## Reviews from earlier versions

Earlier versions staged reviews as Markdown under `<proposal folder>/Active/<session>/` and moved finished ones to `Archive`. Those files are no longer read or written. Never move, edit, promote or delete them. If the user asks about one, explain that it can be read as an ordinary note. To finish its remaining candidates, stage a new review from its source notes and treat tasks it already created as merge targets or exclusions.
