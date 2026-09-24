---
name: write-taskmate-github-issues
description: Draft, register, or classify TaskMate GitHub Issues. For every new Issue, preview a recommended label plan before writing its body; use for Issue updates and label assignment, not README or ADR localization.
---

# Write TaskMate GitHub Issues

Create an Issue that remains readable to international contributors while giving the project owner a complete Japanese implementation reference.

Before drafting or editing an Issue, read [references/issue-template.md](references/issue-template.md). Inspect the relevant TaskMate ADRs, domain terms, existing Issue, and implementation state before stating requirements.

For a new Issue, read [references/label-workflow.md](references/label-workflow.md), inspect active labels, and show the label preview before writing the Issue body. Wait for the user's confirmation or revision; then draft the body and create the Issue with the confirmed label plan. For an existing Issue, read the same reference when the user asks to classify or label it.

## Workflow

1. For a new Issue, complete the label-preview and confirmation gate in `references/label-workflow.md` first. Use a provisional English title and one-line intent only; do not write the Issue body before this gate.
2. Write the English title and canonical body. Resolve contradictions before translating.
3. Add the folded Japanese reference section after the complete English body.
4. Mark the translation coverage beneath every Japanese heading:
   - Summary and Background: `要約`. Preserve the decisions and reasons while shortening exposition.
   - Requirements, Acceptance criteria, Verification, and Out of scope: `全項目`. Preserve every normative item without adding Japanese-only requirements.
5. Keep code, commands, paths, IDs, property names, URLs, and internal domain terms unchanged unless the UI itself localizes the term.
6. Update the Japanese section whenever the English canonical specification changes. Keep the AI-translation notice until a human has actually reviewed the complete Japanese section.
7. Check that every English normative item is represented in each Japanese `全項目` section and that summarized sections do not alter the decision.

## Mutation boundary

Create or update a live GitHub Issue only when the user's request includes that external action. Otherwise, return or save a draft without changing GitHub.

Label creation, label assignment, label removal, and restoring an archived label are also live GitHub mutations. The confirmation gate in the label workflow authorizes only the label plan the user confirmed; a request to inspect, recommend, or design labels does not authorize a different mutation.

## Completion criteria

The Issue is complete when the English body is internally consistent, the Japanese coverage labels are accurate, every normative English item appears in the corresponding Japanese `全項目` section, and no requirement exists only in Japanese. A labeling task is complete when the confirmed labels have been applied to the confirmed Issues and the final report identifies every affected Issue and any label created.
