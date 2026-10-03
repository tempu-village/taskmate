# ADR 0027: Keep bulk Label editing chip-based with partial-assignment state

Status: Accepted

## Context

TaskMate already uses a chip editor with free-form entry and an indexed Label picker for single-Task editing. Bulk editing previously split Label changes into comma-separated add and remove inputs, which diverged from that workflow and obscured the focused input behind mobile keyboards. A list with tri-state controls represents mixed assignment clearly, but making it the primary editor would make routine Label entry and removal different from single-Task editing.

## Decision

Use the same chip editor and indexed picker as the normal Task editor for bulk Label editing. Show the union of Labels from the selected Tasks. A Label assigned to only a subset is a visually distinct `Some` / `一部` chip, without a numeric count. Its `…` control opens an action sheet with explicit text actions: add the Label to every selected Task, or remove it from every selected Task that has it. This keeps a mixed set of normal and partial Labels visually compact, even when many partial Labels are present. Reuse the Task editor's mobile keyboard scroller so the active label input remains visible.

## Considered options

- A primary tri-state list was rejected because it makes free-form Label creation and day-to-day single-Task editing needlessly different.
- Treating the union as a replacement set was rejected because it silently assigns partially present Labels to every selected Task.
- Separate add and remove text fields were rejected because they split one Label workflow, do not show starting assignments, and leave the active input vulnerable to keyboard occlusion.

## Consequences

- Bulk editing preserves the familiar chip entry flow while making mixed Label state visible and safe by default.
- Partial-assignment counts are deliberately omitted because the useful decision is whether the Label is on all selected Tasks, not how many currently have it; the action sheet avoids repeating long action labels on every partial chip.
- The picker remains the scalable list-based discovery path for large Label collections.
- The bulk editor must retain explicit add/remove operations internally rather than storing a replacement Label set.

Related: [Task editing Feature](../features/task-editing.md), [ADR 0021](0021-reuse-the-indexed-label-picker-in-the-task-editor.md).
