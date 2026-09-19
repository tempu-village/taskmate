# ADR 0016: Treat filters as modifiers of the current task list

Status: Accepted

## Context

TaskMate originally exposed Filter as a fourth main-navigation destination. That screen produced its own task list, so a user could not naturally narrow the Date, Search, or Project list already in view and then use that list's sorting controls. It was also unclear which list the filter described.

The main navigation is reserved for destinations. Filtering and multi-select are operations on the currently visible task list. A gear icon was considered for these operations, but it conventionally means application-wide settings rather than temporary view operations.

## Decision

Remove Filter from the main navigation. The main navigation contains Date, Search, and Projects.

Task-result screens expose a sliders-style Adjust control. Its menu initially contains Select tasks and Filter. A gear icon is not used because these actions modify the current list rather than TaskMate's global configuration.

Filter opens a modal and applies Priority, Label, and Completion state criteria to the task list represented by the current screen. The processing order is:

1. Resolve the current Date, Search, or Project task set.
2. Apply the shared filter state.
3. Apply the selected sort order.
4. Render the task list.

Filter state persists while navigating between task-result screens until the user clears it. The Adjust control shows the number of active criteria so filtering cannot remain invisible.

Select tasks enters an explicit selection mode. While it is active, the main navigation is replaced with selection actions and the set of selectable tasks is frozen to the currently displayed results. Normal completion controls are hidden, row selection is available from the whole task row, and manual drag handles become selection controls. Single-item editing reuses the normal editor; multi-item editing uses an explicit bulk editor that distinguishes preserving a value from clearing it.

## Considered options

- Keeping Filter as a main-navigation destination was rejected because it creates a separate result set, cannot be composed naturally with the current list's sorting, and obscures what is being filtered.
- Keeping filter controls permanently above every task list was rejected because mobile vertical space is scarce and most users do not change filters continuously.
- Using a gear icon was rejected because it suggests global settings rather than display and list operations.
- Allowing selection to follow live search or filter changes was rejected because selected tasks could disappear while a destructive action is being prepared.

## Consequences

- Date, Search, and Project detail lists share the same active filter state.
- The Projects index does not expose task-list operations because it displays projects, not tasks.
- Search and project results exclude completed tasks by default and can include them through the Completion state filter.
- Selection mode has a stable, visible scope. Select all affects only tasks displayed when selection mode begins.
- The top navigation becomes simpler, while the Adjust control gains a persistent active-filter indicator.
- Bulk editing and deletion require explicit partial-failure reporting because multiple Markdown files are updated independently.

Related: GitHub Issues #12, #17, and #18.
