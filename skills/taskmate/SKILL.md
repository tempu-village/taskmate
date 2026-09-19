---
name: taskmate
description: Turn explicitly selected Obsidian notes into complete, reviewable TaskMate tasks and manage the resulting task Markdown. Use when the user wants to extract, add, update, complete, search, or reorganize TaskMate tasks without silently dropping source content.
license: MIT
metadata:
  author: Masashi
  version: "0.4.1"
---

# TaskMate

Manage a local-first task store while keeping the user in control of source scope and omissions.

## Choose the workflow

- For direct task operations, read [references/task-schema.md](references/task-schema.md).
- For creating, renaming, or deleting projects, read [references/project-schema.md](references/project-schema.md).
- For turning existing notes into tasks, read [references/import-workflow.md](references/import-workflow.md) before inspecting source content.
- For staging and approving import proposals, also read [references/proposal-workflow.md](references/proposal-workflow.md).

Use `scripts/todo_store.py` for deterministic direct task operations and `scripts/proposal_store.py` for staged imports when Python is available. Otherwise follow the same schemas with the environment's ordinary file tools. Obtain vault and managed-folder paths from user scope or the TaskMate plugin settings; never invent or search outside that scope.

## Preserve control

Treat selected source folders and `taskmate-source` properties as an allowlist, not as hints. Stage a coverage review before importing: every candidate must be accounted for as a new task, a merge into an existing task, or an exclusion that requires the user's confirmation. Default to creating a task. Never silently omit a candidate because it looks informational, redundant, trivial, or difficult to schedule.

Re-read every file immediately before modifying it. Preserve unrelated frontmatter and prose in source notes. Use recoverable deletion when the environment supports it, and request confirmation immediately before deletion or another destructive bulk change.

## Completion criteria

Finish an import when every eligible changed source note has a coverage review, every approved task has one valid Markdown file and a source link, every exclusion was explicitly approved, source processing metadata names all created task IDs, and `scripts/todo_store.py validate` reports no duplicate IDs or invalid task files. Preserve existing priority, labels, and project assignments unless the user asks to change them.
