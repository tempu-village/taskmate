# Backlog review and capacity-planning workflow

Use this workflow for on-demand Task review and planning. It does not replace the Source-note coverage workflow. A normal review or plan reads canonical Tasks only; invoke Source-note import separately and plan with promoted Tasks only.

When the user explicitly requests Source-note import, resolve only eligible notes under the requested bounded rule, show their Vault-relative paths before reading them for candidate extraction, and let the user remove notes from the run without changing the long-term allowlist. Then follow [import-workflow.md](import-workflow.md) and [source-review-workflow.md](source-review-workflow.md).

## 1. Inspect before reasoning

Run:

```bash
python3 scripts/planning_store.py --vault <vault> inspect --today YYYY-MM-DD
```

The result contains counts and every incomplete canonical Task with a content snapshot. Do not mutate anything during inspection. Use the title, Notes, Steps, date, Priority, Labels, Project, and Manual order as evidence.

## 2. Prepare a backlog review

For each reviewed Task, choose `change`, `clarify`, or `no-change`. A change may contain only `title`, `date`, `priority`, `addLabels`, `removeLabels`, `steps`, and `notes`. Label additions are limited to `context/*`; removal also accepts legacy `brk` when visibly replacing it with `context/break`.

When an inspected Task contains legacy `brk`, include visible `removeLabels: ["brk"]` and `addLabels: ["context/break"]` instructions in that Task's next change Proposal. If `context/break` already exists, propose only removing `brk`. Never rewrite the label during inspection or capacity planning.

Adding or replacing a date requires `dateAuthority`. Changing Priority requires one of `user-focus`, `hard-deadline`, `commitment`, `dependency`, or `blocker` in `priorityEvidence`. Removing an unsupported date needs no invented replacement. Age alone is not Priority evidence.

```json
{
  "proposals": [
    {
      "taskId": "task-1",
      "snapshot": "sha256-from-inspect",
      "changes": {"date": null, "addLabels": ["context/phone"]},
      "reason": "The old date has no current authority; the call is suitable by phone."
    },
    {
      "taskId": "task-2",
      "snapshot": "sha256-from-inspect",
      "disposition": "clarify",
      "reason": "The date may represent a real external commitment."
    }
  ]
}
```

Validate and display it:

```bash
python3 scripts/planning_store.py --vault <vault> review --plan <review.json>
```

Show every group and every member in the conversation. A group contains only identical changes with the same reason. Do not treat silence as approval. Clarification and no-change entries never write Task Markdown.

## 3. Persist and open the Task change Proposal

After showing the validated inventory, create a unique safe Proposal ID and persist the exact before/after evidence:

```bash
python3 scripts/planning_store.py --vault <vault> propose --plan <review.json> --proposal-id proposal-<id> --open-review
```

`propose` stores a versioned JSON Proposal under the configured Proposal folder without changing canonical Tasks. It contains the typed ChangeSet, complete before/after Markdown, SHA-256 snapshots, stable `C-xx` IDs, and reasons. On macOS, Windows, and Linux, `--open-review` invokes the TaskMate-owned `obsidian://taskmate-review` URI directly through the operating system. It does not start a loopback bridge. If automatic opening fails, the persisted Proposal remains available from TaskMate's pending-review list.

The user approves or rejects changes inside TaskMate. Opening the URI never applies changes. TaskMate rechecks the captured Markdown, applies only selected `C-xx` changes, moves the closed Proposal to history, and creates a new Proposal with new change IDs plus origin references after partial approval. Do not run the legacy `apply` command for a Proposal reviewed in TaskMate.

## 4. Estimate active effort

For each candidate, use this evidence order:

1. a duration supplied by the user in the current interaction (`user`);
2. explicit Task title, Notes, or Steps evidence (`task-text`);
3. a coarse Task Pilot inference (`inference`);
4. `needsBreakdown: true` when no credible range exists.

Inference must use 5–15, 15–30, 30–60, or 60–120 minutes. Include inherent setup and transition work and exclude elapsed waiting. Work over 120 minutes needs `largeAccepted: true`. Estimates and corrections remain in the current interaction and are not written to Task Markdown.

## 5. Build a read-only capacity plan

Supply net available minutes. If the user gives a clock interval, subtract fixed commitments once before writing `availableMinutes`. `bufferPercent` defaults to 20 and may be changed by the user.

The caller performs the semantic three-stage comparison:

1. mark explicit user focus and protected hard deadlines as `must`;
2. record explicit constraint contradictions in `constraintConflict` and inferred Context matches in `inferredContexts`;
3. order other candidates with `comparisonRank` after comparing Scheduled date, Priority, Project focus, dependencies, blockers, Context evidence, and Manual order.

When Scheduled date and Priority conflict, provide `tradeoff`, or set `needsUserDecision: true`. Never hide that conflict behind a fixed precedence.

```json
{
  "availableMinutes": 120,
  "bufferPercent": 20,
  "requestedContexts": ["phone"],
  "candidates": [
    {
      "taskId": "task-1",
      "stage": "must",
      "estimate": {"minMinutes": 15, "maxMinutes": 30, "basis": "user"},
      "reason": "The user selected this Task."
    },
    {
      "taskId": "task-2",
      "stage": "compare",
      "comparisonRank": 1,
      "estimate": {"minMinutes": 30, "maxMinutes": 60, "basis": "inference"},
      "reason": "It is feasible by phone and is the strongest remaining candidate."
    }
  ]
}
```

Run:

```bash
python3 scripts/planning_store.py --vault <vault> plan --request <request.json>
```

The command reserves the displayed buffer, packs only upper bounds into `planned`, separates lower-bound-only fits into `nearMatches`, and leaves constraint conflicts in `omitted`. `needsBreakdown` and unresolved choices appear in `needsClarification`. It never writes Task Markdown.

## 6. Maintain a rolling plan

Use a rolling plan when the user wants every incomplete Task accounted for across today and future days. It is a separate Markdown artifact, not a Task change: creating, selecting, revising, closing, and superseding it never writes Task Markdown. Run `inspect` first and plan only canonical incomplete Tasks; never include pending Source candidates.

### Capacity

Ask for today's net available minutes. For future days, ask for usable weekdays, daily minutes, a buffer, fixed commitments, and date exceptions. If the user does not give them, propose one concrete profile with `"mode": "assumed"` and `"confirmedAt": null`. Set `confirmedAt` only after the user approves the profile; until then no Task receives a future plan date and work that does not fit today becomes a `future-capacity-unconfirmed` gap.

### Bases

Write two bases. Each lists every canonical incomplete Task exactly once with the `inspect` snapshot, a unique `order`, a reason, and reason codes:

- `recommended` may use displayed assumptions, including coarse inferred estimates and `proposedFields`;
- `evidence` may use only explicit Task data: estimates with basis `user` or `task-text`, and no `proposedFields`.

`proposedFields` may contain only `addLabels` (`context/*`), `steps`, and `notes`; the plan date comes from placement. Mark an entry with `gap` or `conflict` (`code` and `reason`) when you cannot schedule it honestly, and give `deadline` only for a stated hard deadline.

```json
{
  "targetDate": "2026-10-19",
  "capacity": {
    "today": {"availableMinutes": 120, "bufferPercent": 20},
    "future": {
      "mode": "explicit",
      "confirmedAt": "2026-10-19T08:00:00Z",
      "dailyMinutes": 90,
      "bufferPercent": 20,
      "weekdays": ["mon", "tue", "wed", "thu", "fri"],
      "exceptions": {"2026-10-22": 0},
      "commitments": [{"date": "2026-10-21", "minutes": 30, "label": "Dentist"}]
    }
  },
  "bases": {
    "recommended": [
      {"taskId": "task-1", "snapshot": "sha256-from-inspect", "order": 1, "estimate": {"minMinutes": 30, "maxMinutes": 60, "basis": "inference"}, "reason": "Unblocks the report.", "reasonCodes": ["dependency"], "proposedFields": {"addLabels": ["context/pc"]}}
    ],
    "evidence": [
      {"taskId": "task-1", "snapshot": "sha256-from-inspect", "order": 1, "estimate": null, "reason": "No explicit effort.", "reasonCodes": []}
    ]
  }
}
```

Run:

```bash
python3 scripts/rolling_plan.py --vault <vault> create --request <request.json> --plan-id plan-<id> [--supersedes plan-<old-id>] [--open]
```

The helper keeps each Task with an existing date on that date when capacity allows and records `moved-capacity` with the old date otherwise. Overdue Tasks start today with `overdue`. It extends the horizon day by day until every Task is placed, and turns the rest into gaps (`missing-effort`, `needs-breakdown`, `future-capacity-unconfirmed`, `no-usable-capacity`) or conflicts (`deadline-capacity`). It writes `<planFolder>/<plan-id>.md`; `planFolder` defaults to `TaskMate/Plans` and is excluded from Source discovery. Report the returned plan ID, counts, and path or URI. If opening fails, the plan still exists; do not regenerate it.

### Working plan

Show both bases and ask the user to choose one. Never mix them. Copy the chosen base into `PLAN-xx` items:

```bash
python3 scripts/rolling_plan.py --vault <vault> select-base --plan-id <id> --base recommended --revision <n>
```

Revise only the working plan, with a reason for every change:

```json
{"changes": [
  {"id": "PLAN-02", "operation": "move", "date": "2026-10-23", "reason": "Busy on Tuesday."},
  {"id": "PLAN-03", "operation": "unschedule", "reason": "Waiting for a reply."},
  {"id": "GAP-01", "operation": "schedule", "date": "2026-10-26", "estimate": {"minMinutes": 15, "maxMinutes": 30, "basis": "user"}, "reason": "The user estimated it."},
  {"id": "PLAN-01", "operation": "set-fields", "proposedFields": {"steps": [{"text": "Draft outline", "completed": false, "date": null}]}, "reason": "Agreed first Step."}
]}
```

```bash
python3 scripts/rolling_plan.py --vault <vault> revise --plan-id <id> --revision <n> --changes <changes.json>
```

Every write requires the current `--revision` and fails if the file was edited outside Task Pilot; run `show` and ask the user how to proceed. Close a plan with `close`. To replan, run `inspect` again and create a new plan with `--supersedes`; never treat unapproved plan dates as facts.

### Task change Proposal from the working plan

Create a Task change Proposal only when the user explicitly asks, for example "Create a Task change review from this working plan". With no range qualifier, cover every date in the working plan. Narrow it only when the user says "today only" (`--today-only`) or names `PLAN-xx` items (`--items PLAN-01,PLAN-03`):

```bash
python3 scripts/rolling_plan.py --vault <vault> proposal --plan-id <id> --revision <n> --proposal-id proposal-<id> [--today-only | --items PLAN-01,PLAN-03] --open-review
```

The helper rereads every selected Task and omits it, without blocking the others, when it is `missing`, `completed`, `stale` (changed since the plan snapshot), `no-change`, or `already-proposed` (included in an earlier Proposal and not revised since). It proposes only date, new `context/*` labels, Steps, and Notes, never Priority. Each change reason names the plan item and any move. It writes the same Proposal format as `planning_store.py propose`, marks the plan `proposal-created`, and records the Proposal and its scope in the plan. Report every included and omitted item. TaskMate's Task change Review View remains the only place where changes are approved and written; the working plan may still be revised afterwards.

## Context-label interpretation

Task Pilot initially understands `context/break`, `context/phone`, `context/pc`, `context/home`, `context/outside`, `context/low-energy`, and `context/errand`. They express positive suitability, not exclusive requirements. Missing labels mean unknown.

An unfamiliar `context/*` label can exact-match a requested Context name. Ask for an explanation before broader or synonymous interpretation. A content-based match must be declared in `inferredContexts` and shown as inference. Never add or remove a Context label without a separate approved backlog-change proposal.
