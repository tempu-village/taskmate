# ADR 0006: Unassign tasks when deleting projects

## Status

Accepted

## Decision

Deleting a project removes only the project file. Every task assigned to it is preserved and rewritten with `project: null`.

## Consequences

- Project cleanup cannot silently destroy tasks.
- Deletion may rewrite multiple task files and therefore requires explicit confirmation in the UI.
- Those tasks appear in the unassigned project view and can be reassigned later.
