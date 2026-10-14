# Task change Proposal format

Status: Current contract for the implemented Task change review flow.

## Storage and identity

A pending Task change Proposal MUST be UTF-8 JSON at `<proposalFolder>/<proposal-id>.json`. The default folder is `TaskMate/Proposals`. A closed Proposal MUST be moved to `<proposalFolder>/History/<proposal-id>.json`; history MUST NOT be deleted automatically.

`schemaVersion` MUST be `1`. A Proposal ID MUST match `proposal-[A-Za-z0-9._-]+`. The canonical Task UUID identifies each affected Task. `C-xx` identifies one independently approvable change and MUST match `C-[0-9]{2,}`. Task UUIDs and change identifiers MUST be unique inside one Proposal.

`C-xx` is the short review reference used by UI controls and human discussion. Its numbering is Proposal-wide rather than restarting for each Task. A Task receives no additional review-only identifier: its title provides visible context, while the canonical Task UUID remains its machine identity. The stored path is not displayed in the Review View. A `C-xx` identifier is not valid outside its Proposal; follow-up Proposal identity is governed by the origin-reference rules below.

## Version 1 shape

```json
{
  "schemaVersion": 1,
  "id": "proposal-example",
  "status": "pending",
  "createdAt": "2026-10-12T00:00:00.000Z",
  "tasks": [
    {
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

The Review View MUST show every affected Task as an always-expanded section in one continuous vertical list. Each section header MUST show only the Task title and any applicable Task-level selection controls. The Review View MUST NOT add a separate Task index, collapse control, file path, per-Task change count, or overall Task count. Section spacing and header padding MUST stay compact so metadata does not displace review content vertically. Desktop and mobile review surfaces MUST use the same state-transition logic and localization mapping so selection and display-mode behavior do not diverge.

Only selected `C-xx` changes may be applied. Applying a subset MUST close the original Proposal with its exact decision and result, then create a new pending Proposal for unapplied changes. If an existing Task is stale, TaskMate MUST NOT write it from the old snapshot; it MUST regenerate every still-relevant proposed change against the current complete Markdown and include those changes in the follow-up Proposal. A proposed field that already equals its desired value is no longer relevant and MUST be omitted. A missing Task cannot be regenerated. A missing, stale, or failed Task MUST NOT suppress the follow-up changes of another Task. The closed Proposal MUST record the affected change IDs and failure reason. Follow-up changes MUST receive new `C-xx` identifiers and MUST retain `{proposalId, changeId}` origin references. An explicit rejection creates no follow-up only when no Task became stale during the decision and no unapplied changes remain.

Task Pilot MUST use one label-patch operation for Proposal generation and direct approved application. Given the same existing labels, additions, and removals, both paths MUST preserve the same order, remove the same labels, and append each new label at most once.

A closed Proposal MAY contain:

- `decision.decidedAt`, `approvedChangeIds`, and `rejectedChangeIds`;
- `result.appliedAt`, `succeededChangeIds`, per-Task failures, and `followUpProposalId`;
- `originProposalId` on a follow-up Proposal and `origin` on regenerated changes.

## URI handoff

The desktop handoff is:

```text
obsidian://taskmate-review?vault=<vault-id>&proposal=<proposal-id>&task=<task-id>&change=<change-id>
```

Task Pilot MUST invoke this URI through a platform launch adapter without shell interpolation. The supported desktop adapters MUST cover macOS, Windows, and Linux:

- macOS invokes `open` with the URI as one argument;
- Windows invokes the operating system's URI-opening API without constructing a shell command; and
- Linux invokes `xdg-open` with the URI as one argument.

An adapter failure MUST NOT remove, reject, approve, or apply the persisted Proposal. Task Pilot MUST report the launch failure and leave the Proposal discoverable from TaskMate's pending-review list. Platform dispatch MUST have automated tests that replace the operating-system call with a test double. Release verification MUST also include one manual URI-delivery check on each supported desktop platform, covering delivery to TaskMate and confirming that opening the URI performs no Task write.

TaskMate MUST accept only validated identifiers, resolve the Proposal only inside the configured Proposal folder, and treat `task` and `change` as optional navigation hints. The handler MUST NOT accept a filesystem path, line number, redirect target, Task body, diff, credential, or executable action. URI handling MUST only reveal the review; it MUST NOT approve or apply changes.

The Review View MUST expose both pending Proposals and archived Proposal history. History entries MUST show their recorded status plus succeeded and failed change counts, and MUST open the stored before/after evidence read-only. Users MUST NOT need Finder or direct JSON access to inspect review history. When an apply attempt succeeds for zero changes because selected Tasks became stale and a follow-up was generated, the notice MUST state both the stale outcome and follow-up creation rather than reporting only a zero count.

Pending and history detail views MUST provide an explicit back action to the list from which they were opened. Returning MUST discard unapplied selection state. Proposal identifiers MUST wrap rather than enlarge the review page. Proposal name, status, success/failure counts and Task/change counts MUST occupy separate rows. Names that wrap to three or more lines MUST expand their list item rather than be clipped, and the Proposal list MUST NOT create horizontal page scrolling.

## Compatibility and verification

Readers MUST reject unknown schema versions rather than guessing. Readers MAY ignore the legacy version 1 `reviewId` property so already-created Proposals remain reviewable; writers and generated follow-up Proposals MUST omit it. Writers MUST preserve canonical Task fields and unknown Task frontmatter as required by [Task file format](task-file-format.md). The TypeScript Proposal model, repository and renderer tests and the Task Pilot planning-store tests provide automated evidence for selected cases. Automated dispatch evidence covers macOS, Windows, and Linux adapters, and the macOS open/closed-app spike is existing manual delivery evidence. Windows and Linux manual delivery evidence remains required before cross-platform release verification is complete.
