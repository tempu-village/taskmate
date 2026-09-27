# Contributing to TaskMate

Thank you for improving TaskMate. Changes should keep the Obsidian plugin mobile-compatible and the portable Agent Skill safe, inspectable, and consistent with Markdown stored in the Vault.

## Start here

Read [the documentation index](docs/index.md), then the records relevant to the change. The [documentation architecture](docs/DOCUMENTATION_ARCHITECTURE.md) explains which document owns product behavior, user guidance, internal design, decisions, proposals, and operations.

For a behavior change, begin with the applicable product feature specification or Issue. For a hard-to-reverse design choice, write or update an ADR before implementation. For task Markdown changes, update the plugin, the portable Skill schema, and their tests together.

## Development loop

1. Keep the change focused and preserve unrelated working-tree changes.
2. Add or update tests that demonstrate user-observable behavior.
3. Review the documentation impact before requesting review:
   - Product contract or feature specification
   - User guide or troubleshooting
   - Development design or ADR
   - Operations material
   - Tests and generated/reference schema
4. Run the required verification:

   ```bash
   npm run typecheck
   npm test
   npm run build
   python3 -m unittest discover -s skills/taskmate/tests -v
   python3 scripts/validate_skills.py
   npm run validate:localization
   python3 scripts/validate_docs.py
   ```

5. Include the behavior change, validation, and documentation impact in the pull request description.

## Documentation and review

Markdown in this repository is the source of truth. Keep one permanent home for each fact and link to it from related material. User guides explain tasks users perform; development records explain implementation and constraints; tests specify detailed executable behavior.

English is canonical where a document provides Japanese reference text. Update both in the same change and retain the translation-status convention. Do not add a new documentation category until it contains its first real document.

Use the [specification template](docs/templates/feature-spec.md) for product guarantees and the [design template](docs/templates/design-doc.md) for internal mechanics. Keep approval separate from implementation. Link acceptance criteria to [verification evidence and gaps](docs/engineering/design/testing.md); a passing suite does not resolve a conflict with an accepted product decision.

## Security and privacy

Do not commit Vault contents, credentials, tokens, private task data, or unredacted screenshots. Treat source folders and `taskmate-source` as an allowlist. Agent-assisted imports require a staged coverage review and explicit decisions before canonical Tasks change.
