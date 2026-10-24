---
name: taskpilot
description: Turn explicitly selected Obsidian notes into complete, reviewable TaskMate tasks and manage the resulting task Markdown. Use when the user wants to extract, add, update, complete, search, or reorganize TaskMate tasks without silently dropping source content.
license: MIT
metadata:
  author: Masashi
  version: "0.7.0"
---

# Task Pilot

Manage a local-first task store while keeping the user in control of source scope and omissions.

## Choose the workflow

- For direct task operations, read [references/task-schema.md](references/task-schema.md).
- For creating, renaming, or deleting projects, read [references/project-schema.md](references/project-schema.md).
- For turning existing notes into tasks, read [references/import-workflow.md](references/import-workflow.md) before inspecting source content.
- For staging and approving import proposals, also read [references/proposal-workflow.md](references/proposal-workflow.md).
- When the user asks to review extracted candidates in TaskMate instead of the conversation, read [references/source-review-workflow.md](references/source-review-workflow.md) after the import workflow and use it in place of the proposal workflow.
- For backlog review, effort estimation, Context-label suggestions, capacity planning, or rolling plans, read [references/planning-workflow.md](references/planning-workflow.md).

Use `scripts/todo_store.py` for deterministic direct task operations, `scripts/proposal_store.py` for staged imports, `scripts/source_review.py` for Source candidate reviews in TaskMate, `scripts/rolling_plan.py` for rolling-plan artifacts, and `scripts/planning_store.py` for review snapshots, persisted Task change Proposals, and capacity packing when Python is available. Otherwise follow the same schemas with the environment's ordinary file tools. Obtain vault and managed-folder paths from user scope or the TaskMate plugin settings; never invent or search outside that scope. Write text you store in the vault, such as reasons, summaries and exclusion reasons, in the language reported by `python3 scripts/todo_store.py --vault <vault> language`, which follows TaskMate's language setting.

## Preserve control

Treat selected source folders and `taskmate-source` properties as an allowlist, not as hints. Stage a coverage review before importing: every candidate must be accounted for as a new task, a merge into an existing task, or an exclusion that requires the user's confirmation. Default to creating a task. Never silently omit a candidate because it looks informational, redundant, trivial, or difficult to schedule.

Re-read every file immediately before modifying it. Preserve unrelated frontmatter and prose in source notes. Use recoverable deletion when the environment supports it, and request confirmation immediately before deletion or another destructive bulk change.

Keep backlog review and capacity planning distinct. Planning is read-only. Apply date, Priority, or Context-label changes only through a separately visible review whose affected Tasks and exact changes the user approved. “Do later” removes the date and does not create a Pending or Waiting state. Never use age alone to invent a date or Priority.

Estimate active effort as a visible range with a stated basis. Prefer the user's current estimate, then explicit Task text, then a coarse inference. Ask or mark the Task for breakdown when the boundary is too vague. Use the visible, user-adjustable 20% default buffer and upper estimate bounds for a bounded plan. Compare candidates through must-consider evidence, feasibility, and explained multi-signal judgment rather than a hidden fixed precedence.

## Completion criteria

Finish an import when every eligible changed source note has a coverage review, every approved task has one valid Markdown file and a source link, every exclusion was explicitly approved, source processing metadata names all created task IDs, and `scripts/todo_store.py validate` reports no duplicate IDs or invalid task files. Preserve existing priority, labels, and project assignments unless the user asks to change them.

Finish a Source candidate review handoff when its review is staged with every Source statement mapped and opened in TaskMate, or its review ID is reported when opening fails; decisions, edits, formal apply and provenance happen in TaskMate. Finish a backlog review when a Proposal containing complete before/after Markdown evidence is visible in TaskMate, every approved change was rechecked and validated, every failed or stale Task is identified, and every unapproved or clarification Task remains unchanged. On macOS, Windows, and Linux, use the `propose --open-review` handoff so Task Pilot invokes the TaskMate URI directly through the operating system; if launch fails, report the saved Proposal ID for the pending-review list. Finish a capacity plan when its upper-bound total fits the displayed capacity, every estimate and selection has a visible reason, near matches are separate, and no Task Markdown changed merely because the plan was accepted.
