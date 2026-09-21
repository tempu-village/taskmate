# ADR 0021: Use a chip editor and the indexed Label picker in the Task editor

Status: Accepted

## Context

The shared Add/Edit Task editor permanently displayed recently used Label chips below a comma-separated Label input. This consumed scarce vertical space on phones while exposing only a small subset of existing Labels. Users who did not remember an exact Label name still lacked a complete discovery path from the editor.

Free-form entry must remain available because creating a new Label is a normal part of editing a Task. However, repeatedly entering Japanese Labels with the original text field required switching to a half-width comma between values. That interruption is inconvenient with both desktop Japanese IMEs and mobile Japanese keyboards. A control that depends only on the comma therefore does not provide an efficient continuous-entry path for Japanese Labels.

## Decision

Remove the permanently visible recent-Label section and replace the plain Label text field with a chip editor. Selected Labels appear as individually removable chips followed by a persistent text input. The user can commit the pending text as a Label in three ways:

1. activate the visible `Add` / `追加` button;
2. press Enter while an IME composition is not active; or
3. type an ASCII comma, preserving compatibility with the previous delimiter.

IME conversion confirmation must not accidentally create a Label. Composition events and `KeyboardEvent.isComposing` guard Enter and comma processing. After committing a Label, the input remains focused and the software keyboard remains open so another Japanese Label can be entered immediately. The Add action is touch-sized and remains available on mobile. Saving the Task commits any non-empty pending text so a user cannot lose the final Label by omitting an explicit intermediate commit.

Place the Label input and the visible `Add` / `追加` button in separate bordered controls on the same row. They form one consecutive entry flow: type a Label, then activate the adjacent Add action. On narrow mobile screens, the visible `Choose` / `選択` button moves to a full-width second row, while the input and Add remain side by side. Choose opens the same indexed `LabelPickerModal` used by Filter, including search, recent and favorite suggestions, the populated-initial index, multi-selection, inline favorite stars, Cancel, and explicit confirmation. Pending text remains intact while the picker is open.

This is the compared B layout. Keeping input and Add horizontally adjacent makes their sequence visible and preserves the natural type-then-add motion. The rejected A layout placed Add on a separate action row, weakening that sequence. The rejected C layout embedded an icon-only plus inside the input; on a narrow phone it risked crowding or clipping the editable area, and the plus alone did not explain the action as clearly as the localized Add label. Choose is a different operation for discovering existing Labels, so allowing it to wrap below the entry row does not interrupt the continuous-entry flow.

The picker lists Labels attached to any current Task. Newly typed draft Labels remain selected even when they are not yet part of that candidate set. Confirming the picker updates only the unsaved Task draft; the Task itself changes only when Save is activated. Favorite changes continue to use the picker's explicit confirmation behavior and are saved independently as interface preferences.

This supersedes the permanently visible recent-Label chips and plain comma-only editor portions of ADR 0008. ADR 0008's date shortcuts and rule that recent Label history changes only after a Task is saved remain in effect. ADR 0018 remains the canonical design for the shared picker.

## Consequences

- Japanese Labels can be entered continuously on desktop and mobile without repeatedly finding a half-width comma.
- Add/Edit Task and Filter use one Label discovery and multi-selection interaction.
- The Task editor recovers the vertical space previously occupied by recent Label chips.
- The editor needs explicit IME-composition handling, chip removal, duplicate prevention, and pending-text handling at Save.
- The input and Add must fit side by side at mobile width, so the input may shrink while the localized Add button retains a touch-sized target.
- Choose consumes a second row on narrow screens, trading a small amount of height for an unambiguous input-and-commit sequence.
- New Labels can still be typed without first creating or managing a Label elsewhere.
- Picker cancellation cannot alter the Task draft, pending text, or favorite preferences.

Related: GitHub Issue #25.
