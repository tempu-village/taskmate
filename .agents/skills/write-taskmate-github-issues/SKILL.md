---
name: write-taskmate-github-issues
description: Draft, revise, register, or classify TaskMate GitHub Issues, including proposing and applying labels when requested. Use for TaskMate Issue writing, Issue updates, and label assignment, not for README or ADR localization.
---

# Write TaskMate GitHub Issues

Create an Issue that remains readable to international contributors while giving the project owner a complete Japanese implementation reference.

Before drafting or editing an Issue, read [references/issue-template.md](references/issue-template.md). Inspect the relevant TaskMate ADRs, domain terms, existing Issue, and implementation state before stating requirements.

When the user asks to classify or label Issues, read [references/label-workflow.md](references/label-workflow.md) and follow its preview-and-confirm workflow before changing GitHub.

## Workflow

1. Write the English title and canonical body first. Resolve contradictions before translating.
2. Add the folded Japanese reference section after the complete English body.
3. Mark the translation coverage beneath every Japanese heading:
   - Summary and Background: `要約`. Preserve the decisions and reasons while shortening exposition.
   - Requirements, Acceptance criteria, Verification, and Out of scope: `全項目`. Preserve every normative item without adding Japanese-only requirements.
4. Keep code, commands, paths, IDs, property names, URLs, and internal domain terms unchanged unless the UI itself localizes the term.
5. Update the Japanese section whenever the English canonical specification changes. Keep the AI-translation notice until a human has actually reviewed the complete Japanese section.
6. Check that every English normative item is represented in each Japanese `全項目` section and that summarized sections do not alter the decision.

## Mutation boundary

Create or update a live GitHub Issue only when the user's request includes that external action. Otherwise, return or save a draft without changing GitHub.

Label creation, label assignment, label removal, and restoring an archived label are also live GitHub mutations. A request to inspect, recommend, or design labels does not authorize those mutations. Follow the confirmation boundary in the label workflow even when the requested classification criteria are already clear.

## Completion criteria

The Issue is complete when the English body is internally consistent, the Japanese coverage labels are accurate, every normative English item appears in the corresponding Japanese `全項目` section, and no requirement exists only in Japanese. A labeling task is complete when the confirmed labels have been applied to the confirmed Issues and the final report identifies every affected Issue and any label created.
