# TaskMate agent map

TaskMate contains an Obsidian plugin and its companion portable Agent Skill.

Read [docs/DOCUMENTATION_ARCHITECTURE.md](docs/DOCUMENTATION_ARCHITECTURE.md) before changing product behavior, documentation structure, or a cross-cutting rule. It maps the product specifications, user guides, internal designs, RFCs, and operations material without duplicating them here.

For every task, read the smallest relevant record first:

- Product behavior or feature-specific processing (read its approval, implementation and evidence): [docs/engineering/features/](docs/engineering/features/).
- Strict formats, schemas, limits, transitions or compatibility contracts: [docs/engineering/specifications/](docs/engineering/specifications/).
- User-facing wording or workflow: [docs/user/](docs/user/).
- Cross-cutting architecture, security or test strategy: [docs/engineering/design/](docs/engineering/design/). Hard-to-reverse accepted trade-offs: [ADR](docs/engineering/adr/).
- Planned large change: [docs/engineering/rfcs/](docs/engineering/rfcs/) and its tracking Issue.
- Release or recovery work: [docs/operations/](docs/operations/).

Keep the Obsidian plugin mobile-compatible by using public Obsidian and browser APIs. Keep task Markdown compatible with [the task schema](skills/taskmate/references/task-schema.md). Preserve one global manual rank; automatic sorting is display-only. Treat source folders and `taskmate-source` as a strict allowlist, and complete a coverage review before any candidate is excluded.

Record domain terms only in [CONTEXT.md](CONTEXT.md). Record hard-to-reverse trade-offs in [ADRs](docs/engineering/adr/). Before an ADR-worthy UI or navigation decision, establish the user's goal or constraint and record the accepted rationale. Use the `write-taskmate-github-issues` repository skill for Issue work.

Before finishing a change, run `npm run typecheck`, `npm test`, `npm run build`, the Python behavior tests, `python3 scripts/validate_skills.py`, `npm run validate:localization`, and `python3 scripts/validate_docs.py`.
