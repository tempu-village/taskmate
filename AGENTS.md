# Repository guide

TaskMate contains an Obsidian plugin and its companion portable Agent Skill.

- Keep the Obsidian plugin mobile-compatible: use the public Obsidian API and browser APIs, not Electron or Node runtime APIs.
- Keep task Markdown compatible with `skills/taskmate/references/task-schema.md` and update both implementations together when the schema changes.
- Preserve one global manual rank; automatic sorting is display-only.
- Treat source folders and `taskmate-source` as a strict allowlist. Imports require a coverage review before any possible action is excluded.
- Record hard-to-reverse trade-offs in `docs/adr/` and domain terms only in `CONTEXT.md`.
- Before implementing an ADR-worthy user-interface or navigation decision, make sure the user has stated the goal or constraint behind it. If the rationale is missing, ask for it instead of inventing one, then record the accepted reasoning in `docs/adr/`.
- Run `npm run typecheck`, `npm test`, `npm run build`, the Python behavior tests, and `python3 scripts/validate_skills.py` before finishing a change.
