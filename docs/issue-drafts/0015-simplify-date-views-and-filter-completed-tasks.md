# P1: Simplify date views and add completed-task filtering

GitHub Issue: https://github.com/tempu-village/taskmate/issues/15

## Goal

Reduce mobile navigation noise, keep important controls available while results scroll, and move completion into Filter without changing the Markdown task schema.

## Date screen

- Replace the six primary controls with one row: `Scheduled`, `All`, and `No date` (`予定`, `すべて`, `日付なし`).
- Define Scheduled exactly as every incomplete task with a date, including overdue, today, and future tasks.
- Divide Scheduled into `Overdue`, `Today`, and `Later`, in that order.
- Give Today a visible accent marker or badge.
- Remove Today, Next 7 days, Upcoming, and Completed as primary controls.
- Remove counts from primary controls.
- Keep the one-row controls outside the scrolling results region. Do not use `position: fixed` or `position: sticky`.

## Filter screen

- Keep Priority, Labels, and Completion state above the results.
- Add an off-by-default `Include completed tasks` checkbox or equivalent two-state control.
- Enabling it includes completed tasks while retaining active priority and label filters.
- Put only the results in the scrollable region, following ADR 0009.
- When no filter is active, retain the existing empty guidance rather than rendering every task.

## Compact label picker on Filter

This scope applies only to the Filter screen. It does not change the separate task add/edit history-persistence behavior.

- When inactive, show the label input and any selected label tokens; do not show a permanent label list.
- On focus with an empty query, show up to ten recently used labels.
- On focus with existing text, show up to ten labels matching that text.
- Keep suggestions available when labels have already been selected.
- Selecting a suggestion appends a selected-label token, clears only the search query, and updates results immediately.
- Selecting a label must not replace other selected labels.
- Removing a selected token updates results immediately.
- Do not introduce a save step or change recent-label persistence from the Filter screen.
- Search across the existing label set; do not change the current maximum-label constraint.

## Rationale

The current date controls occupy two rows and expose overlapping categories. Seven days and Today are subsets of the dated-task list. Today remains prominent inside Scheduled, while overdue tasks remain visible. Completion is a state and therefore belongs with Priority and Labels. The compact label picker removes the permanently visible label list while preserving quick access to recent and matching labels.

## Acceptance criteria

- The three date controls fit on one row at supported mobile widths and remain visible while results scroll.
- Scheduled contains every dated incomplete task and no undated or completed task.
- Scheduled groups tasks as Overdue, Today, and Later; empty groups may be omitted.
- Today has a consistent visible marker in English and Japanese.
- No date-control count is displayed.
- Filter controls remain outside the result scroller.
- Include completed tasks is off by default and combines with active priority and label filters.
- With no active filter, the current empty guidance remains.
- The Filter label picker follows the focus, matching, append, remove, and immediate-result behavior above.
- The task add/edit label history continues to update only when a task is saved.
- English and Japanese UI dictionaries remain key-compatible.
- Desktop and Android remain compatible with ADR 0009.
- No Markdown property, Task ID, Project ID, or persisted task schema changes.

## Verification

- Unit-test the exact three view rules, including overdue and date-boundary cases.
- Unit-test completed inclusion combined with priority and label filtering.
- Unit-test Scheduled grouping and sort behavior.
- Verify the three controls at narrow Android width.
- Verify long Date and Filter result lists scroll without hiding their controls or final row.
- Verify the Filter label picker with an empty query, a non-empty query, existing selected tokens, selection, and removal.
- Verify task add/edit recent labels still persist only on save.
- Verify English, Japanese, and Auto language modes.
- Run `npm run typecheck`, `npm test`, `npm run build`, Python Skill tests, `python3 scripts/validate_skills.py`, and `git diff --check`.

## Related decision

- ADR 0013: Simplify date views and filter completed tasks
- ADR 0009: Separate fixed mobile controls from scrollable content

## Out of scope

- Markdown schema changes
- Changes to Task ID or Project ID
- Public release or Obsidian Community directory submission
