# P2: Improve sorting controls and task editor field sizing

GitHub Issue: https://github.com/tempu-village/taskmate/issues/14

## Goal

Reduce common sorting to one tap, make the active sort state understandable at a glance, and provide more practical writing space in the task add/edit modal.

## Sorting controls

- Replace the current sort select with a compact horizontal button group.
- Add a visible `Sort` / `並べ替え` label so the control's purpose is clear.
- Provide Manual, Date, Priority, and Created buttons.
- Keep the controls usable at supported Android widths; horizontal overflow is acceptable only if all controls cannot remain legible.
- Manual has no ascending/descending direction.
- Date, Priority, and Created support ascending and descending order.
- Make the active sort key and direction visible without opening another control.
- Use the integrated-arrow design selected in ADR 0014:
  - Selecting an inactive automatic-sort button starts in ascending order.
  - Selecting the active automatic-sort button again reverses its direction.
  - Only the active automatic-sort button shows `↑` or `↓`.
  - Manual shows no arrow because it has no direction.

This uses the same interaction model as a sortable table-column heading. Keeping the sort target and direction in the same button is easier to understand than a detached direction button.

### Direction semantics

| Sort key | Ascending | Descending |
| --- | --- | --- |
| Date | Earliest date first; tasks without a date last | Latest date first; tasks without a date last |
| Priority | P1, P2, P3, then no priority | P3, P2, P1, then no priority |
| Created | Oldest first | Newest first |

The no-value group remains last in both directions so reversing a list does not unexpectedly promote undated or unprioritized tasks.

## Task add/edit modal

- Make the title input substantially wider, preferably using the available content width.
- Increase the usable notes area in both width and height.
- Preserve the compact one-row date shortcuts and initial visibility of Save.
- Keep the form responsive on desktop and Android, including when the software keyboard is visible.
- Apply the same sizing to add and edit modes.

## Acceptance criteria

- A user can choose any sort key with one tap.
- The active sort key is visually distinct.
- Date, Priority, and Created direction can be changed without opening a select menu.
- The active direction is visually clear and follows the table above.
- Switching to Manual hides or disables direction selection and preserves manual drag order.
- The title input uses the practical available width at desktop and mobile sizes.
- The notes field is visibly larger and remains reachable with the Android keyboard open.
- Save remains reachable without regressing the modal improvements from Issue #13.
- English and Japanese labels are provided.
- Existing task schema and rank semantics do not change.

## Verification

- Test all four sort keys and both supported directions.
- Test missing date and missing priority placement in both directions.
- Test switching between Manual and automatic sort modes.
- Verify title and notes sizing at desktop and supported Android widths.
- Verify the modal with the Android keyboard open.
- Run typecheck, tests, build, localization checks, and `git diff --check`.

## Out of scope

- Multi-select task actions (tracked separately in Issue #12)
- Changes to the Markdown task schema
- Public release or Obsidian Community directory submission
