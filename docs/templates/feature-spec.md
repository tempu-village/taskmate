# <Feature name>

Approval: Proposed — link the decision or review that changes this state.
Implementation: Not implemented — identify branch/release scope and known gaps.

## Purpose and scope

State the user problem, intended outcome and non-goals.

## Current contract

Describe independently verifiable guarantees, normal behavior and relevant empty/error/cancel/retry cases. For a new unimplemented feature, label this section Target contract instead.

## Pending changes

Include only when changing an existing contract: describe the proposed delta, approval state and tracking Issue. Keep current guarantees intact until implementation lands.

## Acceptance and evidence

Give stable local IDs where useful, expected outcomes, linked test evidence and manual scenarios. Distinguish implemented, tested, untested and blocked conditions. Passing tests do not establish product approval.

## Related records

Link the implementation design, applicable ADRs, schema, user guide and tracking Issue without copying their contents.

## Authoring notes

Remove instructional placeholders before publication. Start as one Markdown file; split into a same-named folder with a README when independent sections become hard to navigate. Add data/privacy/release details only when relevant. Follow the [documentation policy](../DOCUMENTATION_ARCHITECTURE.md).
