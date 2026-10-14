# Task change Proposal format

Status: Current contract for the implemented Task change review flow.

## Storage and identity

A pending Task change Proposal MUST be UTF-8 JSON at `<proposalFolder>/<proposal-id>.json`. The default folder is `TaskMate/Proposals`. A closed Proposal MUST be moved to `<proposalFolder>/History/<proposal-id>.json`; history MUST NOT be deleted automatically.

`schemaVersion` MUST be `1`. A Proposal ID MUST match `proposal-[A-Za-z0-9._-]+`. `T-xx` identifies a Task within one Proposal and MUST match `T-[0-9]{2,}`. `C-xx` identifies one independently approvable change and MUST match `C-[0-9]{2,}`. Task and change identifiers MUST be unique inside one Proposal.

`T-xx` and `C-xx` are short review references intended for both UI controls and human discussion. A reference such as `T-07 / C-08`, interpreted within a named Proposal, MUST identify one Task and one independently approvable change without requiring a canonical Task UUID, file path or copied diff text. `C-xx` numbering is Proposal-wide rather than restarting for each Task. Neither identifier is valid as a permanent identity outside that Proposal; follow-up Proposal identity is governed by the origin-reference rules below.

## Version 1 shape

```json
{
  "schemaVersion": 1,
  "id": "proposal-example",
  "status": "pending",
  "createdAt": "2026-10-12T00:00:00.000Z",
  "tasks": [
    {
      "reviewId": "T-01",
      "taskId": "canonical-task-uuid",
      "path": "TaskMate/Tasks/Example.md",
      "title": "Example",
      "beforeMarkdown": "complete original Markdown",
      "afterMarkdown": "complete proposed Markdown",
      "beforeSha256": "64 lowercase hexadecimal characters",
      "changes": [
        {
          "id": "C-01",
          "field": "date",
          "before": "2026-10-10",
          "after": "2026-10-18",
          "reason": "User-approved scheduling reason"
        }
      ]
    }
  ]
}
```

`status` MUST be `pending`, `applied`, `partially-applied`, `rejected`, or `stale`. A change `field` MUST be `title`, `date`, `priority`, `labels`, `steps`, or `notes`. Values MUST use the corresponding canonical Task value shape. `reason` MUST be non-empty.

The Proposal MUST store complete `beforeMarkdown` and `afterMarkdown` for every affected Task. These strings are immutable review evidence, not Task master data. `beforeSha256` MUST equal SHA-256 over the UTF-8 bytes of `beforeMarkdown`. Raw diff hunks MUST be regenerated from these two strings through the TaskMate diff-engine adapter and MUST NOT be accepted from AI output as authoritative facts.

## Review and apply contract

Opening or rendering a Proposal MUST NOT modify a Task. Before writing an approved change, TaskMate MUST resolve the canonical Task by stable Task ID and require its complete current Markdown to equal the stored `beforeMarkdown` and hash. A mismatch MUST produce `stale` and MUST NOT be bypassed with fuzzy patching.

Only selected `C-xx` changes may be applied. Applying a subset MUST close the original Proposal with its exact decision and result, then create a new pending Proposal for unapplied changes. Follow-up changes MUST receive new `C-xx` identifiers and MUST retain `{proposalId, changeId}` origin references. An explicit rejection MUST close the Proposal without creating a follow-up.

A closed Proposal MAY contain:

- `decision.decidedAt`, `approvedChangeIds`, and `rejectedChangeIds`;
- `result.appliedAt`, `succeededChangeIds`, per-Task failures, and `followUpProposalId`;
- `originProposalId` on a follow-up Proposal and `origin` on regenerated changes.

## URI handoff

The desktop handoff is:

```text
obsidian://taskmate-review?vault=<vault-id>&proposal=<proposal-id>&task=<task-id>&change=<change-id>
```

Task Pilot MUST invoke this URI through an operating-system argument array, not shell interpolation. TaskMate MUST accept only validated identifiers, resolve the Proposal only inside the configured Proposal folder, and treat `task` and `change` as optional navigation hints. The handler MUST NOT accept a filesystem path, line number, redirect target, Task body, diff, credential, or executable action. URI handling MUST only reveal the review; it MUST NOT approve or apply changes.

## Compatibility and verification

Readers MUST reject unknown schema versions rather than guessing. Writers MUST preserve canonical Task fields and unknown Task frontmatter as required by [Task file format](task-file-format.md). The TypeScript Proposal model, repository and renderer tests and the Task Pilot planning-store tests provide automated evidence for selected cases. macOS open/closed-app delivery remains manual platform evidence; Windows and Linux direct-launch adapters are not implemented in version 1.
