# Proposal review workflow

Use this workflow after building the complete coverage review. Proposal files are review artifacts, not canonical tasks and not a security sandbox.

## Stage

Prepare a JSON plan with `language` (`ja` or `en`), the eligible `sources`, the candidate manifest in `candidates`, and `proposals`. Each candidate has a `sourceNote` and an exact non-empty `statement` copied from that source. A statement must match one complete non-empty source line, ignoring only leading and trailing whitespace; a substring is not sufficient. Each proposal has an `operation` (`create`, `merge`, or `exclude`), `sourceNote`, one or more exact `coverage` statements, and a readable `title`. Add task fields for create or merge. A merge requires `targetTaskId`; an exclusion requires `reason`.

Every candidate must appear in proposal coverage exactly once. Coverage cannot introduce statements absent from the manifest. Staging verifies the manifest against the current source and stops before writing proposal files when coverage is missing, duplicated, or undeclared.

Example plan shape:

```json
{
  "language": "en",
  "sources": ["Notes/meeting.md"],
  "candidates": [
    {"sourceNote": "Notes/meeting.md", "statement": "Send the estimate."},
    {"sourceNote": "Notes/meeting.md", "statement": "Maybe revisit the color palette."}
  ],
  "proposals": [
    {
      "operation": "create",
      "sourceNote": "Notes/meeting.md",
      "coverage": ["Send the estimate."],
      "title": "Send the estimate"
    },
    {
      "operation": "exclude",
      "sourceNote": "Notes/meeting.md",
      "coverage": ["Maybe revisit the color palette."],
      "title": "Do not create a color-palette task",
      "reason": "The meeting did not establish an owner or desired outcome; ask the user to confirm this exclusion."
    }
  ]
}
```

Run:

```bash
python3 scripts/proposal_store.py --vault <vault> stage --plan <plan.json>
```

This creates `Active/<session>/Review.md` and proposal notes under the configured proposal folder, which defaults to `TaskMate/Proposals`. It must not write the canonical task folder or mark a source processed.

## Review in conversation

Summarize every proposal in the Codex conversation and ask the user to approve, revise, or exclude it. Obsidian approval buttons are not part of the MVP. Do not infer approval from silence.

Record decisions in JSON:

```json
{
  "decisions": [
    {"proposalId": "...", "decision": "approved"},
    {"proposalId": "...", "decision": "revised", "revision": {"title": "..."}},
    {"proposalId": "...", "decision": "excluded", "reason": "..."}
  ]
}
```

Partial decisions are allowed. Run `inspect --session <id>` before continuing an older session.

## Promote

Run:

```bash
python3 scripts/proposal_store.py --vault <vault> promote --session <id> --decisions <decisions.json>
```

The command checks that source notes and merge targets have not changed since staging. If one changed, stop and rebuild the affected review; do not bypass the check. Repeating the same promotion is idempotent and must not create a duplicate task.

Approved proposals become canonical tasks. Revised proposals are updated from the explicit revision and then become tasks. Excluded proposals remain only as review evidence. When all proposals are decided, sources are marked processed and the session moves from `Active` to `Archive`.

Every decided proposal has machine-readable `decision`, `decided-at`, and `promoted-task-id` properties plus a visible decided callout. Archived sessions remain until the user manually deletes them; never delete them automatically.
