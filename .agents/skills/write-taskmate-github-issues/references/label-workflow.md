# TaskMate Issue label workflow

Use this workflow for every new TaskMate Issue and when the user asks to classify or add labels to an existing Issue. A new Issue has a label-preview gate before body authoring; an existing Issue has the same gate before any label mutation.

## 0. New-Issue preview gate

Before drafting a new Issue body:

1. Inspect the active repository labels and the relevant repository context.
2. Propose a label plan using the preview format in section 3. Identify the target as `New Issue — <provisional English title>` and use a one-line intent rather than a body summary.
3. State the exact selection rule and whether any new or archived label would be needed. If no label is appropriate, explicitly propose `No label` and explain why.
4. Wait for the user to confirm or revise the plan. Do not draft the Issue body or create the Issue before confirmation.

After confirmation, draft the body. Create the Issue with confirmed reusable labels; create or restore only the confirmed labels needed by the plan, then apply them. Recheck repository labels immediately before the live mutation.

## 1. Resolve the requested scope

Translate the user's condition into an explicit selection rule. Inspect the relevant Issues and active repository labels before proposing changes. Do not infer a broader repository-wide classification when the user named a narrower scope.

Archived labels are not active candidates. If an archived label exactly matches the requested meaning, present restoring it as a separate proposed action rather than creating a duplicate or restoring it automatically.

## 2. Choose labels conservatively

Prefer an existing active label when its meaning covers the requested classification. Propose a new label only when no existing label communicates the distinction accurately.

For every proposed new label, include:

- name;
- one-sentence purpose;
- color consistent with the repository's label conventions;
- why existing labels are insufficient.

Avoid synonyms, overlapping labels, and labels that encode a temporary state better represented by an existing GitHub field. A label intended only for a temporary project phase may later be archived so completed Issues retain their history without leaving it available for new assignments.

## 3. Preview before mutation

Before creating or applying any label, show a compact preview containing every target:

| Issue | One-line summary | Proposed label | Action | Reason |
| --- | --- | --- | --- | --- |
| `#123 Issue title` | Concise description of the Issue's purpose | `label-name` | Reuse existing / Create new / Restore archived | Why it matches the user's rule |

Also state:

- the exact selection rule used;
- which Issues were inspected but excluded when that distinction matters;
- every new label or archived-label restoration being proposed.

Do not mutate GitHub in the same step as this preview. Wait for the user to confirm or revise the proposed targets and labels.

## 4. Apply only the confirmed plan

After confirmation:

1. Recheck that each target Issue and label still exists and that the Issue still meets the confirmed rule.
2. Create only the confirmed missing labels or restore only the confirmed archived labels.
3. Apply the confirmed labels to the confirmed Issues.
4. Do not remove unrelated labels.
5. If the repository changed enough to make the preview inaccurate, stop and present a revised preview instead of guessing.

## 5. Report the result

List each affected Issue by number and title with a one-line summary and the label applied. Separately list labels that were created or restored. Report skipped or failed targets without claiming full completion.
