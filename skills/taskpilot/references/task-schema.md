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
deadline: "2026-09-15"
time: "09:30"
repeat: "weekly"
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

`date` is the optional scheduled date: the day the user plans to work on the Task. `deadline` is the optional hard deadline: an external or consequential due date. Both use `YYYY-MM-DD` and are independent; a Task may have neither, either, or both. Rescheduling changes only `date` and never changes or clears `deadline`; change `deadline` only when the user explicitly asks. Never infer a `deadline` from an existing `date`. Files without `deadline` are valid and read as `null`. Use `--date` and `--deadline` with `create` or `update`; `none` clears either value.

`time` and `repeat` are optional and omitted when unset. `time` is a 24-hour local `HH:MM` evaluated in the device's current time zone and requires `date`. `repeat` is `daily`, `weekly`, `monthly`, `yearly`, or `every N days|weeks|months|years` with N from 1 to 99; a monthly rule may end with `on day D` (1–31) or `on last day`, and requires `date`. Writers record the day of a monthly rule from `date` (`monthly` on 30 January is written `monthly on day 30`), and `update --date` moves that day with the date. A monthly rule lands on its day, or on the last day of a shorter month, so a 30th returns to the 30th after February; `on last day` always lands on the month end. Preserve unreadable values as written. Use `--time` and `--repeat` with `create` or `update`; `none` clears a value on `update`. Running `complete` on a recurring task does not complete it: it advances `date` by the rule from the current `date` (keeping a month-end date on the month end and clamping other days to shorter months), moves `deadline` by the same number of days, and reopens Steps. Run it once per occurrence. `priority` is `1`, `2`, `3`, or `null`; 1 is highest. `labels` is an inline JSON string array with no more than 500 distinct labels exposed by the plugin. `project` is a project ID or `null`, never a display name. `completed-at` is an ISO timestamp when completed and `null` otherwise. `rank` is the single global manual order; automatic sorting is display-only and must not rewrite it.

Older files with `important: true` are read as priority 1 for migration compatibility. New writes must use `priority`.

## Steps and Notes

A Step is part of its parent Task, not a child Task. Keep Step order exactly as written. Use `- [ ] text` or `- [x] text`; an optional date is a calendar-valid trailing `<!-- due: YYYY-MM-DD -->` comment. Treat any other comment as visible Step text and preserve it. Parent completion and Step completion stay independent. Use `--steps-json` with `create` or `update` to pass an ordered array of `{ "text": string, "completed": boolean, "date": "YYYY-MM-DD" | null }` objects.

## Task boundaries

Combine source statements when they contribute to one outcome and share one completion condition. Put supporting details in the task body. Split them when either can be completed independently, they have different dates, or completing one leaves meaningful work in the other.

## Deterministic helper

Run `python3 scripts/todo_store.py --help` for exact commands. Prefer it for `list`, `create`, `update`, `complete`, and `validate`. Pass vault-relative paths for task and source files. Inspect the JSON result and the changed Markdown before reporting success.
