# ADR 0013: Simplify date views and filter completed tasks

Status: Accepted; the standalone Filter-screen placement is superseded by ADR 0016

## Context

The date screen currently presents six primary choices across two rows. On mobile, those controls consume vertical space that should remain available for tasks. Several choices also overlap: the seven-day and future views are subsets of a broader dated-task view, while a separate Today view duplicates tasks that belong in that same dated view.

Today still deserves strong visual treatment because today's tasks often represent the user's immediate goal. Overdue tasks must remain visible rather than disappearing merely because their date is before today.

Completion is a task state, not a date rule. Presenting Completed beside date-based views mixes two concepts. Priority, Label, and completion state belong together as filter criteria.

The Android keyboard incident recorded by ADR 0009 also showed that controls which must remain available should not be simulated with `position: fixed` or `position: sticky`. The stable structure is to place controls outside the scrolling results region.

## Decision

### Date views

Replace the six date controls with one row containing three controls. Counts are not shown.

| UI concept | Exact rule |
| --- | --- |
| Scheduled | Every incomplete task with a date, including overdue, today, and future tasks |
| All | Every incomplete task, whether or not it has a date |
| No date | Every incomplete task without a date |

Use `Scheduled` as the English label instead of `Upcoming`, because `Upcoming` would incorrectly imply that overdue tasks are excluded. Use `予定` in Japanese. Keep the internal `Unplanned` domain term and Markdown schema unchanged; `No date` / `日付なし` is the user-facing label.

Within Scheduled, divide the list into these sections in this order:

1. Overdue
2. Today
3. Later

Give Today a consistent accent marker or badge. This preserves daily focus without restoring Today as a separate primary view.

### Completed tasks

Remove Completed from the date controls. Add an off-by-default `Include completed tasks` control to the Filter screen, after Priority and Labels. Enabling it includes completed tasks in the results while retaining the other active filter criteria.

### Fixed controls and scrolling results

Follow ADR 0009 by structuring both screens as siblings rather than positioning controls over content:

```text
Date screen
├─ Non-scrolling date controls
└─ Scrolling task results

Filter screen
├─ Non-scrolling filter controls
│  ├─ Priority
│  ├─ Label input
│  └─ Completion state
└─ Scrolling filter results
```

Do not use viewport-fixed or sticky positioning for these controls. This avoids depending on keyboard-sensitive viewport calculations and prevents results from being hidden behind controls.

## Alternatives considered

- Keep all six date controls: rejected because they consume two rows and include overlapping categories.
- Keep Seven days: rejected because it substantially overlaps Scheduled, and users can scan the near-term portion of Scheduled.
- Keep Today as a primary view: rejected because it duplicates Scheduled; a prominent Today section preserves its importance with less navigation.
- Name the dated view Upcoming: rejected because the view intentionally contains overdue tasks.
- Keep Completed as a fourth date control: rejected because completion is a state filter rather than a date category.
- Use `position: sticky` or `position: fixed`: rejected because the controls and results can instead be separated structurally, consistent with ADR 0009.

## Consequences

- The primary date controls use one row and remain available while task results scroll.
- Scheduled requires grouped rendering and a clear Today marker.
- Completed tasks require one additional interaction through Filter.
- The Filter screen gains a results region and may show completed tasks together with incomplete tasks when explicitly enabled.
- No Task ID, Project ID, Markdown property, or persisted task schema changes.
- The detailed focus and suggestion behavior of the compact label picker remains an Issue-level UI decision because it is inexpensive to revise.

## Related records

- ADR 0009: Separate fixed mobile controls from scrollable content
- GitHub Issue #15: Simplify date views and add completed-task filtering
