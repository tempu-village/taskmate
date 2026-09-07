# Task schema

Read this reference for adding, editing, completing, listing, or reordering tasks.

## Canonical storage

The vault-relative task folder comes from `.obsidian/plugins/taskmate/data.json` under `taskFolder`; use `TaskMate/Tasks` only when the setting is absent. Each task is one Markdown file named `<readable-title>--<short-id>.md`. Keep the full stable identity in frontmatter and rename the file when its title changes.

```markdown
---
type: todo
id: "stable-id"
completed: false
date: "2026-09-12"
important: false
rank: 1024
created-at: "2026-09-06T10:00:00+09:00"
updated-at: "2026-09-06T10:00:00+09:00"
completed-at: null
source-note: "Notes/meeting.md"
---

# Independently completable action

Optional context, acceptance details, or steps.
```

Use one `date` with `YYYY-MM-DD` semantics. `completed-at` is an ISO timestamp when completed and `null` otherwise. `rank` is the single global manual order; automatic sorting is display-only and must not rewrite it.

## Task boundaries

Combine source statements when they contribute to one outcome and share one completion condition. Put supporting details in the task body. Split them when either can be completed independently, they have different dates, or completing one leaves meaningful work in the other.

## Deterministic helper

Run `python3 scripts/todo_store.py --help` for exact commands. Prefer it for `list`, `create`, `update`, `complete`, and `validate`. Pass vault-relative paths for task and source files. Inspect the JSON result and the changed Markdown before reporting success.
