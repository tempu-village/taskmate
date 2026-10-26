# Import review format

Status: Current contract for the implemented Import review. User-visible behavior is described in [Source-note import](../features/source-import.md). Promoted from [RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md); the RFC keeps the decision history.

The complete shape of schema version 2, the version writers MUST produce, is defined by the [JSON Schema](import-review.schema.json) (Draft 2020-12), with one [complete example](import-review-example.json). This page states the rules a writer and a reader MUST follow beyond that shape, and how readers handle the two earlier formats.

## Storage and identity

A pending Import review MUST be UTF-8 JSON at `<proposalFolder>/<reviewId>.json`. The default folder is `TaskMate/Proposals`. A review in History MUST be at `<proposalFolder>/History/<reviewId>.json`; History MUST NOT be deleted automatically. The file name MUST equal `reviewId`.

A new review MUST have `schemaVersion` `2` and `reviewType` `import`. `reviewId` MUST match `import-review-[A-Za-z0-9._-]+`. A reader that classifies review files MUST require both the `reviewType` and the `import-review-*` name to agree; a file where they disagree, or with an unsupported version, MUST NOT be opened or applied.

`contentLanguage` is `ja` or `en`, the language of every generated text in the review: candidate and Task titles, Notes, Steps, Source summaries, merge reasons and exclusion reasons. `languageSource` records how it was decided: `setting` (TaskMate's explicit language), `desktop` (the desktop Obsidian language TaskMate recorded under Auto), `source` (clearly single-language Sources) or `user` (the user chose). Statements, file names, code and proper nouns stay as written in the Source.

Source IDs MUST match `SRC-[0-9]{2,}` and candidate IDs MUST match `IC-[0-9]{2,}`; both MUST be unique inside one review. Writers MUST serialize the review with two-space indentation and a final newline. Unknown properties MUST be rejected.

## Sources

A note Source records its Vault-relative `path`, the Source-note hash `sha256` defined by [Source note property format](source-note-properties.md), and `capturedAt`. A conversation Source records a `localSourceId`, the exact selected `snapshot`, its SHA-256 `sha256`, `capturedAt` and the `selectionInstruction` that selected it. `threadId` and `turnRefs` are optional supplementary metadata; their absence MUST NOT make the Source unreviewable.

Every Source MUST be referenced by at least one candidate. Every `(sourceId, statement)` pair MUST be referenced by exactly one candidate, and each statement MUST occur in its note body or conversation snapshot when the review is staged.

## Candidates

Each candidate has an `operation` of `create`, `merge` or `exclude`, the `originalOperation` it was staged with, a positive `revision`, a `title`, one or more `sourceRefs`, and `sourceSummaries`.

`sourceSummaries` MUST contain exactly one entry for each distinct Source the candidate's `sourceRefs` reference, and none for any other Source. Each `summary` is a non-empty string of at most 1000 characters that summarizes, in one to three sentences, only the statements the candidate maps from that Source; it is the writer's interpretation and never replaces the statements. Writers order the entries by the first `sourceRef` of each Source; readers display Sources in that first-reference order and each Source's statements in `sourceRefs` order. Editing a candidate keeps its `sourceRefs` and `sourceSummaries` unchanged.

- `create` MUST carry a `taskDraft` with every Task field: `title`, `date` (`YYYY-MM-DD` or null), `priority` (1, 2, 3 or null), unique non-empty `labels`, `project` (a Project ID or null), `steps` and `notes`.
- `merge` MUST carry a `mergeTarget` with the canonical Task `taskId`, its Vault-relative `path` (not absolute and without `..`), its `title`, the complete `beforeMarkdown` and `afterMarkdown`, `beforeSha256` equal to the SHA-256 of `beforeMarkdown`, and one or more `changes`. Each change names a `field` among `title`, `date`, `priority`, `labels`, `project`, `steps` and `notes`, its `before` and `after` values and a `reason`. Changes MUST match the Markdown evidence: every changed field is represented exactly once, no unchanged field is represented, and the Task ID, completion, rank, creation and completion times, Source note and unrecognized Step-section content are unchanged.
- `exclude` MUST carry a non-empty `exclusionReason`.

A candidate MAY keep the payload of an earlier operation after the user switches operations; only the payload of its current `operation` is used.

`decision` is `pending`, `approved` or `hold`. `decisionRevision` and `decidedAt` MUST be set exactly when the decision is not `pending`, and `decisionRevision` MUST NOT exceed `revision`. `diffViewedRevision` MAY be set only on a merge and MUST NOT exceed `revision`. `health` is `ok`, `stale` or `failed`, with an optional `healthReason`.

`application.status` is `not-applied`, `applied` or `failed`. `appliedAt` MUST be set exactly when applied and `error` exactly when failed. `promotedTaskId` MUST be set exactly for an applied create or merge, and for a merge it MUST equal `mergeTarget.taskId`. An exclusion records no Task ID.

## Derived review status and health

Outside History, `status` MUST equal the value derived from the candidates:

1. `applied` when every candidate is applied;
2. `partially-applied` when some candidates are applied;
3. `ready-to-apply` when every candidate is approved at its current revision with health `ok`;
4. otherwise `pending`.

`status` is `history` exactly when `archivedAt` is set, and only a review whose candidates are all applied may be in History. Review `health` MUST be `failed` when an unapplied candidate failed, otherwise `stale` when an unapplied candidate is stale, otherwise `ok`.

## Transitions

Every transition MUST increment the review `revision`, set `updatedAt`, and recompute `status` and `health`. A review in History MUST NOT change. An applied candidate MUST NOT be edited, decided or applied again.

- Editing a candidate MUST increment its `revision`, return its decision to `pending`, clear `decisionRevision`, `decidedAt` and `diffViewedRevision`, reset `health` to `ok` and `application` to not applied. Editing a merge regenerates `afterMarkdown` and `changes` from the stored evidence; a field whose result is unchanged keeps its earlier reason, and the merge MUST still change at least one field. A merge target cannot be replaced by editing.
- Deciding sets `decisionRevision` to the candidate's current `revision`. A decision for an older revision is outdated and is never applied.
- Opening a merge diff records `diffViewedRevision` at the current revision.

## Staging

Before writing anything, the staging writer MUST confirm that the Vault's TaskMate reads the format it writes: the installed plugin manifest (`.obsidian/plugins/taskmate/manifest.json`) MUST have at least the minimum version the writer requires (0.7.0 for schema version 2), and the plugin settings MUST hold an `agentCompatibility` record whose `pluginVersion` equals the manifest version and whose `importReviewSchemaVersions` include the written version. TaskMate writes that record each time Obsidian loads it, so a mismatch means the updated plugin has not been reloaded. When any check fails the writer MUST stop without writing and tell the user to update TaskMate and reload it. A change to this format MUST raise `schemaVersion`, the plugin version and the writer's minimum version together.

The staging writer MUST write only the review file. It MUST NOT create or change canonical Tasks, Source notes or Markdown review files. It MUST refuse a review whose statements are missing, unmapped or mapped twice; a note that is ineligible, already imported and unchanged, or already part of another pending Import review; and a merge target that is completed, changed since inspection, or would not change. Every new candidate starts `pending`, `ok` and not applied.

## Formal apply

Formal apply MUST be a separate, explicitly confirmed action. Opening, editing or deciding MUST NOT write canonical Tasks.

1. Eligible candidates are unapplied, not stale, and approved at their current revision. Held, undecided, stale and outdated candidates are reported and left unchanged.
2. When an eligible merge has no `diffViewedRevision` at its current revision, apply MUST be refused before any write unless the user explicitly acknowledged the unviewed merges.
3. Each note Source referenced by an eligible candidate MUST be rechecked against its recorded hash, and each conversation snapshot against its own hash. A changed or missing Source marks its unapplied candidates `stale` and returns their decisions to `pending`.
4. Eligible candidates MUST be applied in ID order, and the review MUST be saved after each one. If a save fails, apply MUST stop.
   - A create writes a new Task whose ID is the version 8 UUID derived from the SHA-256 of `reviewId`, candidate ID and candidate revision, separated by newlines. An existing Task with that ID counts as applied. The Task records as its Source note the path of the first note Source, in the review's Source order, that the candidate references.
   - A merge writes `afterMarkdown` only while the current Task Markdown still equals `beforeMarkdown`. A Task that already equals `afterMarkdown` counts as applied; a Task that changed otherwise makes the candidate `stale`.
   - An exclusion is recorded as applied without writing a Task.
   - Any other failure records `failed` with its error, and the candidate stays eligible for retry.
5. After the candidates, every Source note whose candidates are all applied and whose provenance is not yet recorded MUST receive provenance as defined by [Source note property format](source-note-properties.md). The provenance carries the Source's recorded hash and the IDs of its applied creates and merge targets. A note that changed since staging receives no provenance and is reported. A failed provenance write is retried on the next apply.
6. A review whose candidates are all applied, with no failed provenance write, MUST be set to `history` with `archivedAt` and moved to History.

## URI handoff

`obsidian://taskmate-import-review?vault=<vault>&review=<reviewId>` opens a review in TaskMate. TaskMate MUST accept only a `review` value that matches an Import review ID pattern, including the earlier `source-review-*` pattern, and the URI MUST NOT decide, edit or apply anything.

## Compatibility and verification

Readers MUST reject unknown schema versions and malformed reviews rather than guessing, and such a file MUST NOT trigger any write; TaskMate shows why the file could not be read and how to recover.

Readers MUST also read two earlier formats, which have no `contentLanguage`, `languageSource` or `sourceSummaries` and MUST NOT contain them:

| Format | `reviewId` / file name | `reviewType` | Candidate IDs | `schemaVersion` |
| --- | --- | --- | --- | --- |
| Source candidate review (unreleased predecessor) | `source-review-*` | `source-candidate` | `SC-[0-9]{2,}` | 1 |
| First Import review format | `import-review-*` | `import` | `IC-[0-9]{2,}` | 1 |

Such a review MUST stay in its own format: deciding, editing, applying and moving it to History keep its `reviewId`, file name, candidate IDs, `reviewType` and `schemaVersion`, and no reader or writer converts it to version 2 or invents summaries for it. Every other rule on this page applies unchanged. TaskMate marks such a review as an earlier format and, in place of each summary, asks the user to read the statements. Task change Proposals are a separate review kind defined by [Task change Proposal format](task-change-proposal-format.md); they have no `reviewType` and are recognized by their `proposal-*` name.

The TypeScript Domain, Schema, formal-apply, provenance-parity, edit-form and Review View tests and the Task Pilot staging tests provide automated evidence for selected cases. Every written state in those tests is also validated against the JSON Schema.
