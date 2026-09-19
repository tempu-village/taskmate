# ADR 0015: Place task deletion in the editor action footer

Status: Accepted

## Context

Task rows currently expose an overflow button containing Edit and Delete. Edit duplicates the existing behavior of opening the editor by selecting the task title, while Delete requires opening the overflow menu before reaching the destructive action. Task deletion still needs a discoverable location that does not compete with the primary Save action or appear as an unrelated application-level control.

Three editor placements were considered: a Delete action on the left side of the existing footer, a dedicated danger section below the form, and a trash icon beside the header Close button.

## Decision

Remove the task-row overflow button. Selecting the task title remains the way to open the editor. For an existing task, place Delete on the left side of the editor footer and keep Cancel and Save together on the right.

Delete uses a trash icon, the visible label `Delete`, a destructive text color, and a visible outline. It must remain distinguishable without relying on color alone and must retain a mobile-sized touch target. Activating it opens a confirmation dialog before the task is moved to Obsidian's trash. The add-task editor does not show Delete.

The footer is already the modal's action region, so placing Delete there keeps all task-level actions in one predictable location. The separation between Delete on the left and Cancel / Save on the right also distinguishes the destructive action from ordinary completion actions.

## Considered options

- A dedicated danger section below the form was rejected because it consumes additional vertical space and creates a second action region in an already scroll-sensitive mobile editor.
- A trash icon beside the header Close button was rejected because Close and Delete have unrelated meanings, the icon-only action is less discoverable, and destructive editing controls in the title bar are not a natural fit for this modal.
- Keeping Edit and Delete in the row overflow menu was rejected because Edit is redundant and single-task deletion belongs with the other operations on that task in its editor.

## Consequences

- Task rows no longer need the right-side overflow button.
- Existing-task editors use a split footer: Delete on the left, Cancel and Save on the right.
- New-task editors continue to show only Cancel and Save.
- Deletion semantics do not change: confirmation is required and the Markdown file is moved to Obsidian's trash.
- Multi-select and bulk deletion remain separate future work.

Related: GitHub Issue #17.
