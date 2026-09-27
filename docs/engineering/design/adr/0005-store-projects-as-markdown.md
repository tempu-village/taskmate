# ADR 0005: Store projects as Markdown

## Status

Accepted

## Decision

Store each project as one Markdown file under the configured TaskMate project folder. Tasks reference a project's stable ID rather than its name.

## Consequences

- Projects remain local-first, inspectable, syncable, and editable by agents using the same model as tasks.
- Renaming a project does not require rewriting every task.
- The plugin must resolve project IDs for display and tolerate a missing project file.
