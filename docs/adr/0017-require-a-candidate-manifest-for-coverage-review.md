# ADR 0017: Require a candidate manifest for coverage review

Status: Accepted

## Context

TaskMate's import instructions require every source statement that could reasonably imply follow-up work to be accounted for as a create, merge, or explicit exclusion proposal. The staging tool previously checked only that each proposal named at least one covered statement. A plan could therefore omit an inconvenient or ambiguous candidate entirely and still pass deterministic validation.

Natural-language analysis is required to identify candidates, so a file tool cannot prove that an agent noticed every possible implication. It can, however, prevent an identified candidate from disappearing between inventory and proposal staging.

## Decision

Every staged import plan must include a candidate manifest. Each candidate contains an eligible `sourceNote` and one exact non-empty `statement` copied from that source. A statement matches one complete non-empty source line after ignoring leading and trailing whitespace; matching only a substring is rejected.

Before writing proposal files, the staging tool verifies that:

1. Every candidate belongs to a source listed in the plan.
2. Every candidate statement occurs in that source note.
3. A source statement is not declared more than once.
4. Every proposal coverage statement refers to a declared candidate from the same source.
5. Every declared candidate is covered exactly once across create, merge, and exclude proposals.

The agent first inventories candidates, then classifies every candidate. Ambiguous background, decisions, promises, questions, and dependencies default to a create proposal unless the user is shown an explicit exclusion proposal. Pure headings and connective prose do not require candidate entries.

## Considered options

- Rely only on Skill prose: rejected because the staging boundary could not detect a silently omitted candidate.
- Automatically split every source sentence into a candidate: rejected because sentence boundaries do not reliably represent actions, and headings or connective prose would create noisy false requirements.
- Allow one candidate to appear in multiple proposals: rejected because duplicated coverage makes the review ambiguous and can produce duplicate tasks.

## Consequences

- New stage plans have a required `candidates` field.
- The manifest is review scaffolding, not a new persisted Task or Markdown property.
- Existing staged proposal sessions remain readable and promotable because validation happens only when staging a new plan.
- The deterministic check guarantees inventory-to-proposal coverage, but the quality of the initial candidate inventory still depends on the agent following the Skill instructions.

Related: GitHub Issue #4.
