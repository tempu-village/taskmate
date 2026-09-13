# Source-note import

Read this reference whenever existing Obsidian notes should become TaskMate tasks.

## Discover eligible notes

Use `python3 scripts/todo_store.py sources --vault <vault>` when available. It reads the plugin's explicit `sourceFolders` allowlist. A note property overrides the folder rule:

- `taskmate-source: true` includes a note anywhere in the vault.
- `taskmate-source: false` excludes a note inside a selected folder.
- no property inherits the selected-folder rule.

The folder setting may include subfolders. Exclude the task, project, proposal, and `.obsidian` folders. Discovery may inspect frontmatter to apply these deterministic rules; it does not authorize interpreting unrelated notes.

## Build a coverage review

Read each eligible new or changed note completely. Produce two sections:

1. **Add or merge** — the tasks that will be created, including the source statements covered by each.
2. **Possible exclusions** — every source statement that could reasonably imply action but that you propose not to add, with a concise reason and an explicit confirmation request.

Default every ambiguous action to **Add**. Pure headings and connective prose need not become candidates, but background facts, decisions, promises, questions, and dependencies must be accounted for whenever they could imply follow-up work.

Write the complete review to a proposal session before asking for a decision. Do not create or change canonical task files during staging. Follow [proposal-workflow.md](proposal-workflow.md) to obtain explicit decisions and promote approved or revised proposals. Apply the task-boundary rules in [task-schema.md](task-schema.md); the agent may decide whether related statements become one task or several.

## Record provenance

Every created task sets `source-note` to the source note's vault-relative path. After approved tasks are written, run `mark-source` or equivalently update the source note with:

```yaml
taskmate-import-status: processed
taskmate-imported-at: "ISO timestamp"
taskmate-imported-hash: "content hash"
taskmate-task-ids:
  - "task-id"
```

The content hash excludes these processing fields so recording the import does not make the note appear changed. When the current hash differs later, present a new coverage review and propose changes; preserve existing tasks until the user approves the diff.
