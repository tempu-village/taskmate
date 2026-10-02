# <Feature name>

## Status

Approval: Proposed — link the decision or review that changes this state.

Implementation: Not implemented — identify branch/release scope and known gaps.

## Purpose and scope

State the user problem, intended outcome, supported scope and non-goals so a reader can understand this capability without reading its RFC history.

## User-visible behavior

Describe observable operation, results and state changes.

## Requirements and guarantees

Describe independently verifiable current guarantees, rules and constraints, including relevant normal, empty, error, cancel and retry cases. For a new unimplemented feature, label this section Target contract instead.

## Processing flow

Describe only the feature-specific major processing stages that are supported by current code or records.

## Internal design

Name responsible components, persisted representation, relationships to other features, data updates and important invariants without narrating source code line by line.

## Failure handling and limitations

Describe relevant failure, retry, conflict and known-gap behavior.

## Pending changes

Include only when changing an existing contract: describe the proposed delta, approval state and tracking Issue. Keep current guarantees intact until implementation lands.

## Acceptance and verification

Give stable local IDs where useful, expected outcomes, linked test evidence and manual scenarios. Distinguish implemented, tested, untested and blocked conditions. Passing tests do not establish product approval.

## Related specifications, ADRs, and RFCs

Link strict shared Specifications, applicable ADRs, user guides and tracking Issues without copying their contents. Link RFCs as background and design-decision history only; do not copy their discussion, rejected alternatives, provisional hypotheses, migration history or future plans into this current reference.

## Authoring notes

Remove instructional placeholders and empty headings before publication. There is no line limit: use the length needed to explain the current capability accurately, but do not pad the Feature with RFC history. Start as one Markdown file; split into a same-named folder with a README when independent sections become hard to navigate. Add data/privacy/release details only when relevant. Follow the [documentation policy](../DOCUMENTATION_ARCHITECTURE.md).
