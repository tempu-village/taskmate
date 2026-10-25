# Task change review

Approval: Accepted — [RFC 0032](../../rfcs/0032-use-jsdiff-for-task-change-preview.md), tracked by [Issue #52](https://github.com/tempu-village/taskmate/issues/52); rolling-plan Proposals and the shared review list follow [RFC 0033](../../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md); plan summaries follow [Show what plans and reviews change](../../rfcs/show-plan-and-review-changes.md), tracked by [Issue #82](https://github.com/tempu-village/taskmate/issues/82).

Implementation: Implemented in the current branch. Task Pilot persists version 1 Proposals, TaskMate provides the Review View and approval flow, and macOS, Windows, and Linux use platform adapters to invoke the TaskMate URI. Pending-review discovery remains the fallback when automatic launch fails.

## Purpose

Task change review lets a user inspect and approve changes to existing Tasks before TaskMate writes Markdown. It provides one Obsidian review surface, deterministic semantic and raw Markdown diffs, granular approval, and protection against stale source data.

The initial scope covers scheduled date, Priority, Labels, title, Steps, and Notes. Creating, completing, deleting, merging, and splitting Tasks are outside the initial scope.

## User-visible behavior

1. Task Pilot records a Proposal containing a ChangeSet without modifying the canonical Task files.
2. TaskMate opens the pending Proposal from an Obsidian URI handoff or the shared review list, which shows Task change reviews together with Import reviews.
3. Desktop and mobile use the same dedicated ItemView so URI handoff and pending-review selection share one tested rendering path.
4. The Review View presents a compact continuous list of proposed changes with stable change identifiers.
5. The user can switch between semantic and raw Markdown diffs and approve changes individually.
6. Opening a Proposal never applies it. TaskMate writes only the explicitly approved changes.
7. The shared review list provides pending and history tabs. Each entry is labelled with its review kind. Task change history entries show status and success/failure counts and open the original diff as read-only evidence. A Proposal file that cannot be read appears under unreadable files and cannot be opened.
8. Pending and history details both provide an in-view back action to the shared list in the same tab; returning discards any unapplied selection state. Applying a Proposal without a follow-up, or rejecting it, also returns to the list.

Affected Tasks appear directly as always-expanded sections; there is no separate Task index or collapse interaction. A section header shows the Task title but omits the stored file path and change counts. Compact section gaps and header padding prioritize the change content vertically. The review toolbar separates selection from display. Selection uses persistent select-all and clear-all buttons whose unavailable action remains visible but disabled. Display uses an `Items / Full text` segmented control. Task-level bulk controls appear only when a Task has more than one change. Selection redraws preserve numeric scroll position; switching between Items and Full text restores the nearest stable Task UUID or `C-xx` anchor.

A Proposal generated from a rolling plan carries Task Pilot's explanation, written in TaskMate's language setting. Above the toolbar, a "What this plan changes" box shows the plan's summary and a numbered list of each Task's title and one-line summary; selecting a title scrolls to that Task's section. The same line appears again below the Task's section header. The box and lines appear only when the Proposal carries them, so older Proposals and backlog-review Proposals look as before. They only explain: selection, approval and application use the typed changes alone.

Full text is a unified diff of the Proposal's recorded before/after Markdown: `-` lines are removed, `+` lines are added, and unprefixed lines are unchanged context around a change. It does not compare the live Task while the review is open. The serializer updates `updated-at` when it creates proposed Markdown and can normalize Markdown formatting, so Full text can include those generated differences in addition to the visible ChangeSet fields.

The review surface contains horizontal overflow at every level except the Full text diff itself. Long titles, reasons and controls wrap within the available width. The sticky footer remains above Task headers and reserves mobile toolbar and safe-area clearance. The sticky toolbar and footer meet the review's visible top and bottom edges so scrolled content does not show past them, and Task headers stick directly under a one-row toolbar.
Proposal identifiers in pending and history lists wrap within the available width. Review kind, Proposal name, status, success/failure counts and Task/change counts each occupy separate rows so long names cannot overlap metadata or create page-level horizontal scrolling, including when a name wraps to three or more lines on phones.

## Obsidian Sync on mobile

Task change Proposals are JSON rather than Markdown. To make pending Proposals available on a phone, enable the following Obsidian Sync option on both the computer and the phone:

`Settings → Sync → Selective sync → Sync all other types`

After synchronization finishes, run `Open reviews` in TaskMate and open the pending Proposal. TaskMate intentionally does not repeat this setup guidance in the pending-review screen.

## Target contract

- Canonical Task Markdown is not changed before approval.
- AI output expresses typed change intent; it is not the source of diff truth.
- A ChangeSet is the typed set of change instructions.
- A Proposal stores identifiers, status, complete before/after Markdown, the ChangeSet, rationale, approval decisions, and apply results.
- The before/after Markdown is immutable review evidence rather than Task master data. TaskMate uses it to regenerate exact diffs and audit the state that was reviewed.
- Semantic and raw Markdown views are derived from the same original and proposed documents.
- Applying approved changes replays typed operations rather than copying displayed text.
- TaskMate rechecks the original snapshot before writing and blocks stale changes.
- Partial approval produces an explicit result for every proposed change.
- Unrelated content and manual ordering are preserved.
- The canonical context label is `context/break`; legacy `brk` input is normalized at the boundary.
- Review text, such as titles, values, reasons and the Full text diff, can be selected and copied even though Obsidian turns off text selection elsewhere in its interface. Buttons stay unselectable, and the Import review follows the same rule.

## Processing flow

1. Read the original canonical Task and record its hash.
2. Apply a ChangeSet's typed operations to an in-memory copy to create the proposed Task.
3. Persist a Proposal containing the ChangeSet and the complete original and proposed Markdown.
4. Derive semantic and Markdown diffs mechanically from the same stored original and proposed documents.
5. Present both views for granular approval.
6. Recheck the original hash and replay only approved operations into the Vault.

[Open the interactive ChangeSet and diff flow](assets/change-set-diff-flow.html).

## Internal design

The design should keep these responsibilities separate:

- Proposal storage, evidence and lifecycle
- ChangeSet operation validation
- deterministic operation application
- semantic diff extraction
- raw Markdown diff generation through `jsdiff`
- stale-snapshot validation
- Review View state and approval controls
- Obsidian URI handoff and pending-review discovery

The strict persisted format, lifecycle and URI security contract are defined by [Task change Proposal format](../../specifications/task-change-proposal-format.md).

## Failure handling

- Missing or malformed Proposals or ChangeSets remain unapplied and show a recoverable error.
- A source hash mismatch blocks the old write, marks all affected changes stale, and regenerates still-relevant changes against the current Task in the follow-up Proposal.
- Manual order is stored in each Task's `rank` frontmatter. The approved-change writer preserves it, but a Manual-order change after Proposal creation changes the complete Markdown snapshot and therefore causes stale rather than risking an overwrite; the follow-up Proposal uses the newer order as its baseline.
- If every selected change is stale, the completion notice explains that zero changes were applied and that a new review Proposal was created.
- A stale or failed Task does not discard follow-up changes belonging to another successfully validated Task.
- An invalid operation blocks only the affected proposal unless atomicity is required by the operation group.
- URI handoff failure does not lose review data; the pending-review list remains the fallback.
- No bridge service or localhost listener is required.

## Acceptance criteria

- REVIEW-01: Creating a Proposal does not modify canonical Task Markdown.
- REVIEW-02: Opening a Proposal does not apply any proposed change.
- REVIEW-03: Semantic and raw views are derived from the same original and proposed documents.
- REVIEW-04: Raw Markdown differences are generated mechanically with `jsdiff`.
- REVIEW-05: Each proposed change has a stable identifier and explicit review state.
- REVIEW-06: Applying a subset writes only approved operations.
- REVIEW-07: A source hash mismatch prevents stale writes.
- REVIEW-08: Unrelated Task content and manual ordering survive approved changes.
- REVIEW-09: Review data remains discoverable if the automatic Obsidian handoff fails.
- REVIEW-10: Legacy `brk` input is normalized to `context/break`.
- REVIEW-11: A Proposal preserves complete before/after Markdown and can regenerate the same raw diff without consulting AI output or the current Task.
- REVIEW-12: Proposal history is retained until the user removes it.
- REVIEW-13: A partial approval closes the original Proposal with its result; any follow-up uses new `C-xx` identifiers and retains origin references.
- REVIEW-14: Every affected Task remains visible in one compact continuous list whose headers omit index navigation, collapse controls, paths and counts.
- REVIEW-15: A stale Task reappears in the follow-up Proposal with its current Markdown as the new baseline; it also does not suppress another Task's unapplied changes.
- REVIEW-16: macOS, Windows, and Linux launch the review URI without shell interpolation; launch failure preserves pending-review discovery.
- REVIEW-17: Review history is discoverable inside TaskMate without opening JSON files or Finder and is displayed read-only with its recorded result.
- REVIEW-18: A Proposal generated from a plan shows its summary and per-Task lines above the changes; a Proposal without them opens unchanged, and approving a Proposal with summaries writes only the selected typed changes.

## Rolling plans and the shared review list

Following [RFC 0033](../../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md), this Review View is the only approval surface for changes to already-canonical Tasks that originate from a rolling plan. Creating and editing a plan never writes Tasks; Codex must create a normal Task change Proposal before this view can approve anything.

The shared review list classifies minimal envelopes through the Review Catalog and opens each review in its own view. Task change and Import review schemas, decisions, stale recovery, application and UI state remain separate. Task change Proposal version 1 is still recognized by its `proposal-*` name, so its behavior and compatibility are unchanged.

## Related documents

- [Task Pilot review and capacity planning](../task-pilot-planning.md)
- [RFC 0032: Use jsdiff for Task change preview](../../rfcs/0032-use-jsdiff-for-task-change-preview.md)
- [RFC 0033: Reviewable rolling plans and Source candidate reviews](../../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md)
- [RFC: Show what plans and reviews change](../../rfcs/show-plan-and-review-changes.md)
- [Issue #52](https://github.com/tempu-village/taskmate/issues/52)
- [Task change Proposal format](../../specifications/task-change-proposal-format.md)

## Evidence

- [Proposal evidence and approval tests](../../../../test/reviews/task-change/proposal.test.ts)
- [Proposal repository lifecycle test](../../../../test/reviews/task-change/proposal-repository.test.ts)
- [Review renderer tests](../../../../test/reviews/task-change/review-renderer.test.ts)
- [Review position-preservation tests](../../../../test/reviews/task-change/review-scroll.test.ts)
- [Review Module boundary tests](../../../../test/reviews/review-module-boundaries.test.ts)
- [Task Pilot Proposal test](../../../../skills/taskpilot/tests/test_planning_store.py)
- The 2026-10-12 macOS spike verified direct URI delivery while Obsidian was open and closed, Vault selection, and Task UUID navigation. Fresh desktop/mobile visual verification remains manual evidence.
