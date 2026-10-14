# Backlog review and capacity-planning workflow

Use this workflow for on-demand Task review and planning. It does not replace the Source-note coverage workflow. A normal review or plan reads canonical Tasks only; invoke Source-note import separately and plan with promoted Tasks only.

When the user explicitly requests Source-note import, resolve only eligible notes under the requested bounded rule, show their Vault-relative paths before reading them for candidate extraction, and let the user remove notes from the run without changing the long-term allowlist. Then follow [import-workflow.md](import-workflow.md) and [proposal-workflow.md](proposal-workflow.md).

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

## Context-label interpretation

Task Pilot initially understands `context/break`, `context/phone`, `context/pc`, `context/home`, `context/outside`, `context/low-energy`, and `context/errand`. They express positive suitability, not exclusive requirements. Missing labels mean unknown.

An unfamiliar `context/*` label can exact-match a requested Context name. Ask for an explanation before broader or synonymous interpretation. A content-based match must be declared in `inferredContexts` and shown as inference. Never add or remove a Context label without a separate approved backlog-change proposal.
