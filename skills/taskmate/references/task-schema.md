# Task schema

Read this reference for adding, editing, completing, listing, or reordering tasks.

## Canonical storage

The vault-relative task folder comes from `.obsidian/plugins/taskmate/data.json` under `taskFolder`; use `TaskMate/Tasks` only when the setting is absent. Each task is one Markdown file named `<readable-title>.md`; when that name already exists, use `<readable-title> (2).md`, then increment the number. Keep the full stable identity in frontmatter rather than the filename, and rename the file when its title changes. Continue accepting former `<readable-title>--<short-id>.md` files during migration.

```markdown
---
type: todo
id: "stable-id"
completed: false
date: "2026-09-12"
priority: 1
labels: ["仕事", "連絡"]
project: "project-stable-id"
rank: 1024
created-at: "2026-09-06T10:00:00+09:00"
updated-at: "2026-09-06T10:00:00+09:00"
completed-at: null
source-note: "Notes/meeting.md"
---

# Independently completable action

## Steps

- [ ] Reserve the hotel <!-- due: 2026-10-01 -->
- [x] Check the train schedule

## Notes

Optional context or acceptance details.
```

Use one `date` with `YYYY-MM-DD` semantics. `priority` is `1`, `2`, `3`, or `null`; 1 is highest. `labels` is an inline JSON string array with no more than 500 distinct labels exposed by the plugin. `project` is a project ID or `null`, never a display name. `completed-at` is an ISO timestamp when completed and `null` otherwise. `rank` is the single global manual order; automatic sorting is display-only and must not rewrite it.

Older files with `important: true` are read as priority 1 for migration compatibility. New writes must use `priority`.

## Steps and Notes

A Step is part of its parent Task, not a child Task. Keep Step order exactly as written. Use `- [ ] text` or `- [x] text`; an optional date is a calendar-valid trailing `<!-- due: YYYY-MM-DD -->` comment. Treat any other comment as visible Step text and preserve it. Parent completion and Step completion stay independent. Use `--steps-json` with `create` or `update` to pass an ordered array of `{ "text": string, "completed": boolean, "date": "YYYY-MM-DD" | null }` objects.

## Task boundaries

Combine source statements when they contribute to one outcome and share one completion condition. Put supporting details in the task body. Split them when either can be completed independently, they have different dates, or completing one leaves meaningful work in the other.

## Deterministic helper

Run `python3 scripts/todo_store.py --help` for exact commands. Prefer it for `list`, `create`, `update`, `complete`, and `validate`. Pass vault-relative paths for task and source files. Inspect the JSON result and the changed Markdown before reporting success.
