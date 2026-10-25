---
status: implemented
tracking-issue: 62
current-authority: [../features/source-import.md, ../features/task-pilot-planning.md, ../features/task-change-review/README.md, ../specifications/import-review-format.md]
related-features:
  - ../features/task-pilot-planning.md
  - ../features/source-import.md
  - ../features/task-change-review/README.md
---

# RFC: Add reviewable rolling plans and Source candidate reviews

> Record status: Historical — implemented through [#60](https://github.com/tempu-village/taskmate/issues/60), [#61](https://github.com/tempu-village/taskmate/issues/61) and [#62](https://github.com/tempu-village/taskmate/issues/62).
> Current authority: [Source-note import](../features/source-import.md), [Task Pilot review and capacity planning](../features/task-pilot-planning.md), [Task change review](../features/task-change-review/README.md) and [Import review format](../specifications/import-review-format.md). The proposal below preserves the decision history; its statements that behavior is pending describe the time of acceptance.
> Renamed after implementation: the Source candidate review is now the Import review (取り込みレビュー). Its files use `import-review-*`, `reviewType: import`, candidate IDs `IC-xx` and the `obsidian://taskmate-import-review` URI; this record keeps the names used when it was decided.
>
> 記録の状態：#60、#61、#62で実装済みです。現在の正本は上記のFeatureとSpecificationで、以下は検討当時の記録として残します。「未実装」とする記述は承認時点のものです。実装後、Source候補レビューは取り込みレビュー（Import review）に改名しました。ファイルは`import-review-*`、`reviewType: import`、候補IDは`IC-xx`、URIは`obsidian://taskmate-import-review`です。以下は検討当時の名前のままです。

## Summary

Replace two hard-to-operate conversational workflows with persisted, explicitly reviewable artifacts while preserving canonical Task Markdown as the only Task master data.

1. Task Pilot writes one Obsidian Markdown rolling plan from every canonical incomplete Task. The user chooses one of two planning bases, edits the working plan with Codex, and may explicitly generate an existing Task change Proposal from it. The plan never changes a Task by itself.
2. Explicitly selected Source notes or conversation excerpts produce one Source candidate Proposal JSON. A new TaskMate Review View lets the user decide `create`, `merge`, or `exclude` per candidate and applies only explicitly selected decisions.
3. A thin Review Catalog classifies pending/history JSON and routes it to the Task change or Source candidate Review Module. The two review kinds keep separate Domain schemas, decisions, persistence behavior, and renderers.

This RFC is accepted design direction and is not implemented. The linked Features remain the authority for shipped behavior until implementation, verification, and documentation promotion are complete.

## Background / Problem

The current Source-note import creates an `Active/<session>/Review.md` plus candidate Markdown files and requires the user to express decisions in the Codex conversation. Correct use depends on remembering a detailed prompt, session ID, folder layout, and promotion vocabulary. The artifacts are visible in Obsidian, but they do not provide TaskMate-native per-candidate controls.

The current capacity plan is conversational and read-only. That protects Tasks, but it gives the user no durable plan artifact to inspect and amend by stable item ID. It also does not provide a direct, explicit path from an accepted multi-day plan to the existing Task change Review View.

The desired job is to select the notes for this run, account for every possible action, approve only wanted Task creation or integration, then plan every canonical incomplete Task across today and confirmed future capacity without silent Task writes.

The design must retain these current safety properties:

- only explicitly selected eligible Source content is imported;
- every Source statement is covered exactly once;
- no candidate or plan changes canonical Tasks before an explicit apply action in TaskMate;
- stale Source notes, merge targets, and Tasks block old writes;
- partial success remains recoverable and idempotent;
- Task change and Source candidate review semantics are not forced into one schema.

## Goals

- Make the complete path from selected Source content to reviewed canonical Tasks understandable without requiring hidden commands or file conventions.
- Give Source candidate creation, merge, and exclusion a dedicated TaskMate Review View with per-card decisions.
- Give rolling planning a durable Obsidian Markdown artifact with stable IDs that can be revised through Codex conversation.
- Account for every canonical incomplete Task as planned, `GAP`, or `CONFLICT`, extending beyond today when confirmed capacity exists.
- Reuse the implemented Task change Review View for plan-derived changes instead of creating a second existing-Task mutation UI.
- Preserve exact source and target evidence, stale checks, explicit apply, partial recovery, and provenance.
- Keep Review Modules deep and separate while sharing only the thin catalog behavior proven common to both review kinds.

## Non-goals

- Automatically collect recently changed notes or conversations.
- Include unapproved Source candidates in a plan.
- Apply Task changes merely because a plan was created, selected, edited, or followed.
- Make TaskMate parse plan Markdown or generate plan-derived Task changes in the MVP.
- Add a deadline field, calendar integration, automatic free-time discovery, automatic notifications, or automatic morning planning.
- Persist effort estimates, plan order, time blocks, or AI explanations into Task Markdown.
- Change Priority merely because a Task appears in the plan.
- Merge Task change and Source candidate persisted schemas or application semantics.
- Migrate, delete, or silently rewrite existing `Active/Archive` Source-review files.

## Terminology

- **Canonical Task:** Task Markdown accepted by the Task schema and stored in the configured Task folder.
- **Rolling plan:** a read-only Markdown artifact beginning today and covering every canonical incomplete Task across confirmed future capacity.
- **Recommended base (`R-xx`):** a plan that may use clearly displayed Task Pilot assumptions in addition to canonical Task evidence.
- **Evidence base (`E-xx`):** a plan that uses only explicit canonical Task evidence and reports missing inputs as `GAP-xx`.
- **Working plan (`PLAN-xx`):** the one selected base copied into the section that Codex may amend and convert to a Task change Proposal.
- **Source candidate Proposal:** one versioned JSON review session covering every candidate from explicitly selected Source notes or conversation excerpts.
- **Decision selection:** persisted or in-memory review intent that does not change canonical Tasks.
- **Formal apply:** the separate TaskMate action that rechecks evidence and applies selected decisions.

## Alternatives considered

### Keep both workflows in the Codex conversation

This is the smallest implementation, but it preserves the main usability problem: the user must know which session to reference, how to spell decisions, and which operation actually writes Tasks. It also offers no native visual merge evidence.

### Reuse Task change review for Source candidate merges

Rejected. A Source candidate review decides whether a candidate becomes a new Task, merges into an existing Task, or is explicitly excluded. Task change review approves field-level changes to existing Tasks. Sending merge candidates through the Task change flow would split one candidate decision across two review lifecycles and make creation and exclusion inconsistent.

### Store one Markdown file per Source candidate plus `Review.md`

Rejected for the new design. Candidate Markdown is useful for manual inspection but makes one logical review span many files and duplicates screen state. One JSON session can preserve coverage, evidence, decisions, partial results, and provenance while the Review View supplies the human interface.

### Put every plan item directly into a Task change Proposal

Rejected. A plan contains ordering, assumptions, estimates, gaps, and conflicts that are not Task mutations. Converting the comparison plans directly would make viewing or selecting a plan equivalent to requesting writes. Only the chosen working plan can produce a Proposal, and only after a separate explicit request.

### Ask for the Task change review range every time

Rejected in favor of the user-selected default. Omitting a range means the complete working plan across all dates. `today only` or explicit `PLAN-xx` IDs narrow the range.

### Add JSON Schema runtime validation or generated models

Deferred. The current Task change Proposal uses a local TypeScript validator and the plugin has no JSON Schema runtime dependency. The Source candidate Module will follow that pattern for the MVP and test it against the documented schema fixtures.

### Record partial provenance on the Source note

Rejected. Writing `taskmate-import-*` after each applied candidate, with a new partial status, would make a Source note show progress without opening TaskMate. It would also add a status value and redefine `taskmate-imported-hash` for a partly processed note. Progress would be stored twice, in the Proposal JSON and in the note, and the two could disagree. Every applied candidate would rewrite the user's own note, which raises the chance of synchronization conflicts. Pending and partial Source candidate Proposals are already visible in the Review View, so the note does not need to carry progress. A partial status can still be added later if a real need appears; removing one after release would be harder.

### Split review kinds into physical subfolders

Rejected. Both review kinds use the configured Proposal root and `History` location. A thin catalog classifies envelopes and delegates to sibling Modules; it does not merge their Domain behavior.

## Proposed design

### 1. End-to-end workflows

#### Source candidate review

1. The user explicitly identifies eligible Source notes or a bounded conversation excerpt.
2. Codex inventories every possible action and maps every source statement exactly once to `create`, `merge`, or `exclude`.
3. Codex writes one Source candidate Proposal JSON and opens the new Source candidate Review View.
4. The user may edit a card within the allowed fields. Editing increments the candidate revision, clears its decision, and regenerates merge evidence when applicable.
5. The user selects decisions on individual cards. Selection alone changes no canonical Task.
6. The user invokes the separate formal-apply action. TaskMate rechecks Source and merge-target evidence, applies independent valid candidates, and records each result.
7. A review remains pending while any candidate is undecided, held, stale, or failed. It moves to History only when every candidate has an applied create, merge, or exclude result.
8. Newly created or merged canonical Tasks can participate in a newly calculated rolling plan. The earlier plan is not silently amended.

#### Rolling plan and Task change review

1. Codex reads every canonical incomplete Task. It does not read pending Source candidates into the plan.
2. Codex gathers today's capacity and the smallest future-capacity profile needed for scheduling: usable weekdays or dates, daily capacity, buffer, fixed commitments, and exceptions.
3. If future capacity was not provided, Codex proposes one concrete profile. No Task receives a future plan date until the user approves that profile.
4. Codex writes one `TaskMate/Plans/<plan-id>.md` containing a recommended base, an evidence base, gaps/conflicts, and an initially empty or selected working plan.
5. The user selects exactly one base. Codex copies it into the working plan with `PLAN-xx` identifiers. The user may then revise only that working plan through conversation.
6. Every canonical incomplete Task appears exactly once as planned, `GAP`, or `CONFLICT`. The horizon grows until all Tasks are accounted for; it is not a fixed one- or two-week truncation.
7. A plan change does not write Tasks. The user must explicitly request `Create a Task change review from this working plan`.
8. With no range qualifier, Codex proposes changes for all dates. `today only` or explicit `PLAN-xx` IDs narrow the scope.
9. Codex writes the existing Task change Proposal JSON and opens the existing Task change Review View. TaskMate applies only changes approved there.

### 2. Rolling plan contract

One plan ID maps to one Markdown file. Revisions update the same file and monotonically increase `revision`; they do not create dated copies. The plan lifecycle is:

```text
draft → ready → proposal-created
  └────────────→ closed
  └────────────→ superseded
```

The minimum frontmatter is:

```yaml
type: taskmate-today-plan
schema-version: 1
plan-id: <stable-id>
target-date: YYYY-MM-DD
planning-scope: all-open-tasks
end-date: YYYY-MM-DD | null
status: draft | ready | proposal-created | closed | superseded
base-mode: recommended | evidence | null
future-capacity-mode: explicit | assumed | null
future-capacity-confirmed-at: <date-time> | null
revision: 1
created-at: <date-time>
updated-at: <date-time>
```

Each `R-xx`, `E-xx`, `PLAN-xx`, and `GAP-xx` record has machine-readable HTML-comment metadata. A planned Task record contains its canonical Task ID, generation-time SHA-256 snapshot, plan revision, planned date, reason codes, and proposed Task fields when any. Codex owns parsing this metadata in the MVP. TaskMate receives only a valid Task change Proposal and does not parse plan Markdown.

The recommended base may use displayed assumptions, including coarse effort and an approved future-capacity profile. The evidence base may use only explicit Task data. Missing effort, Context, or scheduling authority becomes a stable `GAP-xx`; a hard-deadline or capacity contradiction becomes `CONFLICT-xx`. Neither is assigned a fabricated precise date.

Existing Task `date` is a strong planned-work constraint. A move must display the old date and reason in the Task change Proposal. A stated hard deadline that conflicts with capacity remains a conflict for the user; it is not silently resolved.

Plan-derived Task changes are limited to:

- `date`;
- `context/*` labels;
- `steps`; and
- `notes`.

Inferred Context remains an unselected candidate until the user adopts it. Plan order, time slots, duration estimates, and AI explanation never become Task fields merely because they appear in the plan.

Before generating a Task change Proposal, Codex rereads every selected Task and compares its snapshot. Completed, missing, or stale Tasks are omitted from the old proposal and reported; unaffected Tasks may continue. TaskMate performs its existing second snapshot check during formal apply.

### 3. Source candidate Proposal contract

The physical locations are:

```text
TaskMate/Proposals/<source-review-id>.json
TaskMate/Proposals/History/<source-review-id>.json
```

The new workflow creates no candidate Markdown and no `Review.md`. One versioned envelope contains:

```text
schemaVersion / reviewId / reviewType / status / health / revision
createdAt / updatedAt / archivedAt
sources[]
candidates[]
  id / revision / operation / sourceRefs / proposed
  mergeTargetSnapshot / decision / decisionRevision / diffViewedRevision
  application / promotedTaskId / error
```

Required identities and discriminators are:

- `reviewId`: `source-review-*`;
- `reviewType`: `source-candidate`;
- Source IDs: `SRC-01`, `SRC-02`, ...;
- candidate IDs: `SC-01`, `SC-02`, ...;
- candidate operation: `create | merge | exclude`.

Review status and health are separate:

```text
status: pending | ready-to-apply | partially-applied | applied | history
health: ok | stale | failed
```

Candidate decisions are `pending`, `hold`, or `approved`; formal application separately records `not-applied`, `applied`, or `failed`. Every source statement must occur in exactly one candidate `sourceRefs` mapping. An approved decision is valid only for the same candidate revision.

The complete accepted draft is preserved as [the Source candidate Proposal JSON Schema](0033-source-candidate-proposal.schema.json) with [one complete example](0033-source-candidate-proposal-example.json). Implementation may correct a demonstrated incompatibility, but must record a material contract departure before promoting the verified schema into `docs/engineering/specifications/`.

Note Source evidence includes Vault-relative path, snapshot hash, and capture time. Conversation Source evidence requires a local Source ID, the exact selected snapshot, its SHA-256 hash, capture time, and the instruction that selected it. Thread and turn identifiers are optional supplementary metadata; their absence does not disable conversation Source review.

For merge candidates, TaskMate stores complete before/after Markdown evidence and generates the unified diff mechanically. The card always shows the target Task and short change summary. `Show diff` expands the unified diff inside the card. The user may select merge without expanding it, but formal apply then lists the unviewed merge count and affected Task names and requires an unchecked-by-default acknowledgement.

Editing a card increments its revision, returns it to pending, clears prior decision metadata, and regenerates validation and diff evidence. Validation is local to the candidate where possible: one malformed card does not prevent independent valid candidates from being applied.

Formal apply is candidate-by-candidate and saves each success before continuing. Already applied candidates are never replayed. Stale and failed candidates remain pending for renewed review or retry. Create and merge record the promoted canonical Task ID; exclude records an explicit reason and no Task ID.

Source note provenance is written once per Source note, when that note is complete:

- A Source note is complete when every candidate from it is an applied create, an applied merge, or an exclusion. A pending, held, stale or failed candidate keeps the note incomplete. Completion is evaluated per Source note, so one note in a multi-note Proposal can be completed before the others.
- Until then, the Source note is not modified. In-progress state lives only in the Source candidate Proposal JSON and is visible through the Review View.
- On completion, TaskMate writes the existing provenance properties unchanged in meaning: `taskmate-import-status: processed`, `taskmate-imported-at`, `taskmate-imported-hash`, and `taskmate-task-ids` containing created Task IDs and merge-target Task IDs, never excluded candidates.
- `taskmate-imported-hash` is the Source snapshot hash recorded in the Proposal. Immediately before writing, TaskMate checks the current note against that snapshot; if the note changed, it writes no provenance and marks the Source stale for renewed review.
- Conversation Sources have no note and receive no provenance properties; their provenance stays in the Proposal.
- Reselecting an incomplete note cannot duplicate applied work, because applied candidates keep their promoted Task IDs in the Proposal.

### 4. Review Catalog and Module design

The existing Task change Review Module and the new Source candidate Review Module are siblings. Each owns its persisted schema, Domain validation and state transitions, persistence adapter, application behavior, UI state, and renderer.

A thin Review Catalog scans the configured Proposal root and History folder, reads only enough envelope data to classify an entry, and returns a discriminated summary/reference. It routes the reference to the owning Module. For Source candidate JSON, both `reviewType: source-candidate` and the `source-review-*` ID prefix must agree. Existing Task change schema version 1 has no `reviewType`; `proposal-*` remains the compatibility discriminator until a separately versioned Task change schema introduces one.

The catalog must not parse complete feature-specific payloads, decide candidates, calculate diffs, perform stale recovery, or apply writes. Task change and Source candidate Modules must not import one another. Shared review code must not import either feature Module.

The current source layout already places Task change review in `src/reviews/task-change/`, and the [review Module boundary test](../../../test/reviews/review-module-boundaries.test.ts) rejects imports between review kinds and from `reviews/shared` into a review kind. A Source candidate Module under `src/reviews/source-candidate/` and a catalog under `src/reviews/shared/` therefore satisfy RFC33-REVIEW-02 without new rules, provided routing to the owning Module happens outside the catalog. A catalog placed anywhere else must add its folder rule to the [Module boundary test](../../../test/module-boundaries.test.ts) and [Architecture](../design/architecture.md).

The Source candidate Module uses a local TypeScript runtime validator, following the existing Task change Proposal approach and adding no runtime schema dependency. The RFC Schema and fixture are design/test authorities until implementation promotes the final strict contract into `docs/engineering/specifications/`.

### 5. Review View behavior

Source candidate cards present:

- stable candidate ID and Source references;
- proposed create, merge, or exclude result and reason;
- editable allowed fields;
- merge target and change summary;
- expandable unified diff for merge;
- `create`, `merge`, `exclude`, and `hold` decision controls as applicable;
- stale, invalid, failed, and applied status.

Selecting card decisions and formally applying them are separate actions. Formal apply summarizes selected create/merge/exclude counts, blocked items, and unviewed merge diffs. Partial application is supported. The view remains usable with keyboard navigation and screen reading; the additional unviewed-diff acknowledgement cannot be confirmed by Enter alone while unchecked.

The Task change Review View remains the only UI for mutations to already-canonical Tasks that originate from the rolling plan. It is not opened as a second step inside a Source merge card.

### 6. Migration and compatibility

- Existing `Active/Archive` Source-review files are left untouched and are never automatically moved or deleted.
- The new UI does not enumerate or parse legacy Source-review Markdown.
- The replacement removes legacy Source-review reader/writer/UI code only in the implementation change that provides the new JSON workflow and its tests.
- There is no automatic migration command or fallback reader in the MVP.
- Release and user documentation must state that legacy reviews are not shown in the new Review View and explain how to finish them before upgrading or inspect them manually afterward.
- Task change Proposal version 1 and its current history remain compatible.
- Plan Markdown is advisory and may be closed or superseded without changing Tasks.

## Acceptance conditions

### Rolling plan

- **RFC33-PLAN-01:** one Markdown artifact contains both bases, stable IDs, gaps/conflicts, and one working plan; creating or editing it changes no Task.
- **RFC33-PLAN-02:** every canonical incomplete Task appears exactly once as planned, `GAP`, or `CONFLICT`; unapproved Source candidates never appear.
- **RFC33-PLAN-03:** no future date is assigned before the user confirms usable dates/weekday rules, capacity, buffer, and exceptions.
- **RFC33-PLAN-04:** omitted Task-change range means all working-plan dates; explicit today or `PLAN-xx` selection narrows it.
- **RFC33-PLAN-05:** plan-derived changes are limited to date, Context labels, Steps, and Notes, and are not written before existing Task change review approval.
- **RFC33-PLAN-06:** stale, completed, or missing Tasks are not proposed from old snapshots; unaffected Tasks may continue.
- **RFC33-PLAN-07:** replanning reads current canonical Tasks, marks the prior plan superseded, and does not treat unapproved old plan dates as facts.

### Source candidate review

- **RFC33-SOURCE-01:** one JSON covers every selected Source statement exactly once and staging creates zero canonical Tasks.
- **RFC33-SOURCE-02:** opening, editing, or selecting decisions in the Review View changes no canonical Task.
- **RFC33-SOURCE-03:** formal apply writes only selected, valid, non-stale candidates and records a result per candidate.
- **RFC33-SOURCE-04:** create, merge, exclude, pending/hold, partial apply, retry, and History transitions are observable and idempotent for recorded successes.
- **RFC33-SOURCE-05:** merge diff is generated from stored before/after evidence; unviewed selected merges require the formal-apply acknowledgement.
- **RFC33-SOURCE-06:** changed Source or merge-target snapshots block only affected candidates and preserve independent valid work.
- **RFC33-SOURCE-07:** conversation provenance remains complete without thread/turn IDs through local ID, exact selected snapshot, selection instruction, and hash.
- **RFC33-SOURCE-08:** the new workflow writes no candidate Markdown or `Review.md`, and it does not modify existing legacy review files.
- **RFC33-SOURCE-09:** a Source note receives no `taskmate-import-*` change while any of its candidates is pending, held, stale or failed; once all are applied or excluded, provenance is written exactly once with the Proposal's snapshot hash, and a note changed since that snapshot receives no provenance.

### Review architecture

- **RFC33-REVIEW-01:** the catalog lists and routes both review kinds without asking either feature Module to parse the other's payload.
- **RFC33-REVIEW-02:** Source candidate and Task change Modules have no imports between them; shared code imports neither feature Module.
- **RFC33-REVIEW-03:** malformed or unknown review envelopes remain unapplied and do not prevent valid independent reviews from being listed.
- **RFC33-REVIEW-04:** existing Task change Proposal version 1 pending/history behavior remains compatible.

## Decision register

The product review accepted every item below. IDs remain stable for implementation review and Issue references.

### Planning decisions

| ID | Accepted decision |
| --- | --- |
| A-D01 | Codex writes and links one Obsidian plan Markdown; TaskMate has no separate plan UI in the MVP. |
| A-D02 | One artifact shows recommended and evidence bases; the user selects one and edits only the working plan. |
| A-D03 | Inferred Context is shown as an unselected candidate until adopted. |
| A-D04 | Plan order, time blocks, and explanation are not automatically stored in Steps or Notes. |
| A-D05 | All canonical incomplete Tasks are covered across today and confirmed future capacity. |
| F-D01 | Codex proposes one future-capacity profile when missing and waits for approval before future placement. |
| F-D02 | The horizon extends until every Task is planned, a gap, or a conflict. |
| F-D03 | Calendar integration is out of scope; only confirmed usable days and exceptions are used. |
| F-D04 | Existing date is a strong constraint; moves show reason and hard-deadline conflicts remain conflicts. |
| F-D05 | Task change review defaults to the complete schedule; explicit today or IDs narrow it. |
| F-D06 | Unestimable, oversized, or blocked Tasks become gaps/conflicts instead of receiving fabricated dates. |
| F-D07 | Replanning starts from current canonical Tasks and supersedes the old plan. |

### Source candidate and shared-review decisions

| ID | Accepted decision |
| --- | --- |
| B-D01 | Merge cards show target/summary and expand unified diff on request. |
| B-D02 | Diff expansion is not required for decision selection, but unviewed merges require formal-apply acknowledgement. |
| B-D03 | Allowed card editing returns the candidate to pending and regenerates validation/evidence. |
| B-D04 | Review lifecycle is pending, ready, partial/applied, and history, with stale/failed health. |
| B-D05 | New code has no legacy Markdown review reader/writer; existing files are retained. |
| B-D06 | New physical and UI terminology is Proposal root plus Pending/History. |
| B-D07 | Explicitly bounded Codex conversation content may be a Source; conversations are never auto-collected. |
| B-D08 | Source-note provenance is written once per Source note after all of its candidates are applied or excluded, using the Proposal's snapshot hash; partial progress stays only in the Proposal. Decided 2026-10-18. |
| C-D01 | Selecting decisions and formally applying them are separate; partial application is allowed. |
| C-D02 | Stable Codex command phrases identify review kind, target, and review ID. |
| C-D03 | One Source review session is one JSON; no per-candidate Markdown or `Review.md`. |
| C-D04 | `latest` is resolved by review kind, pending state, and `updatedAt`; ambiguity returns choices rather than applying. |

### Detailed contract and implementation decisions

| ID | Accepted decision |
| --- | --- |
| N-D01 | One plan ID maps to one revised-in-place Markdown with explicit lifecycle status. |
| N-D02 | The user selects one planning base; bases are never silently mixed. |
| N-D03 | Explainable eligibility and reason codes replace an opaque weighted score. |
| N-D04 | Plan and Proposal generation/apply both use snapshot protection. |
| N-D05 | Conversation provenance stores only the selected snapshot and its selection evidence. |
| N-D06 | One versioned Source JSON owns sources, candidates, decisions, and apply results. |
| N-D07 | Formal apply summarizes counts and requires acknowledgement for unviewed merge diffs. |
| N-D08 | Legacy code is removed without deleting or migrating legacy Vault files. |
| N-D09 | Card fields validate immediately and before save; invalid cards do not block independent valid cards. |
| N-D10 | Failure to open a generated plan does not regenerate it; Codex returns a link, ID, and summary. |
| T-D01 | Codex alone parses plan metadata in the MVP; TaskMate reads the resulting Task change Proposal. |
| T-D02 | Source JSON uses a local TypeScript runtime validator tested against schema fixtures. |
| T-D03 | A thin Review Catalog classifies/routes envelopes; feature-specific Domain and apply behavior remain separate. |
| T-D04 | Local Source ID, selected snapshot, and hash are required; thread/turn IDs are optional. |

## Implementation notes

Implementation is tracked in three independently reviewable value slices:

1. [#60](https://github.com/tempu-village/taskmate/issues/60): rolling plan artifact plus explicit Task change Proposal generation;
2. [#61](https://github.com/tempu-village/taskmate/issues/61): Source candidate JSON lifecycle and dedicated Review View; and
3. [#62](https://github.com/tempu-village/taskmate/issues/62): Review Catalog integration, legacy workflow removal, migration/release documentation, and cross-feature verification.

The final Source candidate JSON contract belongs in a new Specification only after implementation confirms the schema and validator. Implemented user-visible behavior must then replace the pending-change sections in the affected Features, and the RFC moves to `implemented` with PR/release evidence.

The current [Source note property format](../specifications/source-note-properties.md) remains normative for ordinary Source notes. The new workflow keeps its `taskmate-source` eligibility rule. Under B-D08 the meaning of its `taskmate-import-*` provenance does not change; only the trigger moves from a completed staged review to a completed Source note in a Source candidate Proposal. The change that replaces the staged review must update that Specification's trigger wording and the [user guide for importing Source notes](../../user/how-to/import-source-notes.md).

## Open questions

None block implementation. The Source-note provenance timing, raised after the Source note property format was published, was decided as B-D08 on 2026-10-18. Implementation pull requests and a release version remain delivery metadata rather than product-design questions.

## Decision / status

Accepted on 2026-10-17 after product review of A-D01–05, B-D01–07, C-D01–04, F-D01–07, N-D01–10, and T-D01–04. B-D08 was added on 2026-10-18. Accepted means the direction is authorized for implementation; none of the proposed behavior is claimed as shipped.

Implemented on 2026-10-24. The implementation needed no material departure from the accepted decisions. Contract details settled during implementation are recorded in the [Import review format](../specifications/import-review-format.md), including retry-safe Task IDs, stopping on a failed save, retrying provenance, and keeping the staged merge target when a candidate is edited. On 2026-10-25 the review was renamed to Import review without changing its behavior: its files, `reviewType`, candidate IDs and URI changed to the names above, and no file was migrated because none had been released.

## Links

- Tracking Issue: [#62](https://github.com/tempu-village/taskmate/issues/62)
- Implementation Issues: [#60](https://github.com/tempu-village/taskmate/issues/60), [#61](https://github.com/tempu-village/taskmate/issues/61), [#62](https://github.com/tempu-village/taskmate/issues/62)
- Current features: [Task Pilot planning](../features/task-pilot-planning.md), [Source-note import](../features/source-import.md), [Task change review](../features/task-change-review/README.md)
- Current specifications: [Import review format](../specifications/import-review-format.md), [Task change Proposal format](../specifications/task-change-proposal-format.md), [Source note property format](../specifications/source-note-properties.md); the accepted draft [Schema](0033-source-candidate-proposal.schema.json) and [example](0033-source-candidate-proposal-example.json) stay here as history
- Current design: [Module boundaries](../design/module-boundaries.md), [Architecture](../design/architecture.md)
- Current user guide: [Import Source notes](../../user/how-to/import-source-notes.md)
- ADRs: [opt-in Source notes](../adr/0004-opt-in-source-notes.md), [stage imports before promotion](../adr/0011-stage-source-imports-before-promotion.md), [candidate coverage](../adr/0017-require-a-candidate-manifest-for-coverage-review.md)
- Implementation pull requests: rolling plans [#71](https://github.com/tempu-village/taskmate/pull/71) and [#72](https://github.com/tempu-village/taskmate/pull/72); Source candidate review [#73](https://github.com/tempu-village/taskmate/pull/73), [#74](https://github.com/tempu-village/taskmate/pull/74), [#75](https://github.com/tempu-village/taskmate/pull/75), [#76](https://github.com/tempu-village/taskmate/pull/76) and [#78](https://github.com/tempu-village/taskmate/pull/78); Review Catalog and legacy retirement [#80](https://github.com/tempu-village/taskmate/pull/80) and [#84](https://github.com/tempu-village/taskmate/pull/84); and the pull request that promoted the Specification
- Release: not yet released; the latest release is `0.6.2`
- Verification evidence: the automated tests listed in the current Features and the Specification, and manual desktop checks in disposable Vaults recorded on [#60](https://github.com/tempu-village/taskmate/issues/60) and [#61](https://github.com/tempu-village/taskmate/issues/61). Phone layout of the Source candidate review has not been checked on a device.

## 日本語参考

<!-- translation-status: ai-translated -->

> 英語版が正本です。このRFCは合意済みですが未実装です。

### 概要

今回の変更は、Source候補の確認と全未完了Taskの計画を、会話だけに依存しない形へ改めます。

- 明示的に選んだSource noteまたは会話範囲から、1セッション1 JSONのSource候補レビューを作ります。
- TaskMateの新しいReview Viewで、候補ごとに作成・既存Taskへの統合・除外・保留を選びます。選択だけではTaskを変えず、別の正式反映操作で初めて書き込みます。
- 統合カードは統合先と要約を常時表示し、同じカード内でunified diffを展開できます。diffを開かずに選択できますが、正式反映直前に未確認件数と対象を示し、追加確認を必須にします。
- 新形式では候補Markdownと`Review.md`を作りません。旧Active/Archiveファイルは削除・移動しませんが、新UIでは扱いません。
- 今日の計画は、正式な未完了Taskをすべて対象にする1つのObsidian Markdownです。推奨ベース案と既存Task根拠ベース案を比較し、一方だけを作業中の計画に選びます。
- 今日に入らないTaskは、利用者が承認した将来容量に配置します。全Taskを計画済み・GAP・CONFLICTのいずれかへ一度だけ割り当てます。
- 計画を作成・選択・修正しただけではTaskを変えません。CodexへTask変更レビュー作成を明示依頼し、既存のTask変更Review Viewで承認します。範囲省略時は全日程、今日分または`PLAN-xx`指定時だけ絞り込みます。
- 計画から提案できる変更は日付、`context/*`、Steps、Notesに限定し、優先度、計画順、時間枠、見積り、AI説明は自動保存しません。

### 内部構造

Task変更ReviewとSource候補Reviewは別のModule・別schema・別状態遷移を維持します。薄いReview CatalogだけがProposal rootとHistoryの最小envelopeを読み、正しいModuleへ振り分けます。Source候補JSONは専用TypeScript validatorで検証し、新しいruntime依存は追加しません。

現在のソース構成ではTask変更Reviewは`src/reviews/task-change/`にあり、Review Module boundary testがReview種別同士と`reviews/shared`からReview種別へのimportを拒否します。Source候補Moduleを`src/reviews/source-candidate/`、Catalogを`src/reviews/shared/`に置き、正しいModuleへの振り分けをCatalogの外で行えば、RFC33-REVIEW-02は既存の規則で確認できます。別の場所に置く場合は、Module boundary testとArchitectureへフォルダー規則を追加します。

通常のSource noteには、現在の[Source note property format](../specifications/source-note-properties.md)が引き続き適用されます。新しい流れでも`taskmate-source`による対象指定は維持します。

Source noteへの取り込み履歴（`taskmate-import-*`）は、そのノートから出た候補がすべて「作成を反映済み」「統合を反映済み」「除外」のどれかになったときに、ノートごとに1回だけ書きます（B-D08）。保留・stale・失敗の候補が残る間はノートを変更せず、途中経過はProposal JSONとReview Viewだけに残します。`taskmate-imported-hash`にはProposalに記録したsnapshotのhashを使い、書く直前にノートが変わっていれば書かずにstaleにします。会話Sourceにはノートがないため、取り込み履歴はProposalにだけ残ります。途中経過をノートにも書く案は、状態の追加、hashの意味の再定義、JSONとノートの二重管理、同期の競合が増えるため採用しません。必要になれば後から追加できますが、一度入れた状態を外すのは困難です。

計画Markdownの機械可読metadataはMVPではCodexだけが読みます。会話Sourceはlocal Source ID、選択範囲snapshot、hashを必須にし、thread/turn IDは取得できる場合だけ補助情報として保存します。

### 状態

利用者との設計レビューで全決定IDを採用済みです。Source note property formatの公開後に残った取り込み履歴の時期は、2026-10-18にB-D08として決めました。未決の製品判断はありません。新しい流れがstaged reviewを置き換えるときは、同じ変更でそのSpecificationの書く時期の記述と[Source noteの取り込み手順](../../user/how-to/import-source-notes.md)を更新します。2026-10-24に、#60、#61、#62で実装しました。承認した決定から大きく外れた点はなく、実装中に決めた契約の細部は[Import review format](../specifications/import-review-format.md)に記録しています。
