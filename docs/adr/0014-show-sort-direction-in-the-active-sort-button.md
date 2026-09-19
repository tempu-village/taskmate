# ADR 0014: Show sort direction in the active sort button

Status: Accepted

TaskMate uses a horizontal row of sort buttons and shows the ascending or descending arrow inside the active automatic-sort button. Tapping an inactive button selects that sort in ascending order; tapping the active Date, Priority, or Created button again reverses its direction. Manual has no direction and therefore shows no arrow.

This follows the same interaction model as clicking a sortable table-column heading to alternate between ascending and descending order. Keeping the sort target and its direction in one button makes the available operation easier to understand than a detached direction button whose target must be inferred.

## Considered options

- A separate direction button was rejected because its relationship to the selected sort key is not obvious, especially on mobile.
- Arrows on every button were rejected because they imply that several sort orders may be active at once and add visual noise.
- A separate ascending/descending two-state control was rejected because it uses more space and separates the direction from the sort key.

## Consequences

- Only the active Date, Priority, or Created button displays an arrow.
- Repeated activation of the selected automatic sort reverses the order.
- Tasks without a date or priority remain last in both directions instead of being promoted when the order is reversed.
- Manual order continues to use the single global rank defined by ADR 0003; automatic sorting remains display-only.

Related: GitHub Issue #14.
