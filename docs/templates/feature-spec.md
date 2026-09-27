# <Feature name>

## Status

Approval: Proposed — link the decision or review that changes this state.

Implementation: Not implemented — identify branch/release scope and known gaps.

## Purpose and scope

State the user problem, intended outcome and non-goals.

## User-visible behavior

Describe observable operation, results and state changes.

## Requirements and guarantees

Describe independently verifiable guarantees, normal behavior and relevant empty/error/cancel/retry cases. For a new unimplemented feature, label this section Target contract instead.

## Processing flow

Describe only the feature-specific major processing stages that are supported by current code or records.

## Internal design

Name responsible components, data updates and important invariants without narrating source code line by line.

## Failure handling and limitations

Describe relevant failure, retry, conflict and known-gap behavior.

## Pending changes

Include only when changing an existing contract: describe the proposed delta, approval state and tracking Issue. Keep current guarantees intact until implementation lands.

## Acceptance and verification

Give stable local IDs where useful, expected outcomes, linked test evidence and manual scenarios. Distinguish implemented, tested, untested and blocked conditions. Passing tests do not establish product approval.

## Related specifications, ADRs, and RFCs

Link strict shared Specifications, applicable ADRs, RFCs, user guides and tracking Issues without copying their contents.

## Authoring notes

Remove instructional placeholders and empty headings before publication. Start as one Markdown file; split into a same-named folder with a README when independent sections become hard to navigate. Add data/privacy/release details only when relevant. Follow the [documentation policy](../DOCUMENTATION_ARCHITECTURE.md).
