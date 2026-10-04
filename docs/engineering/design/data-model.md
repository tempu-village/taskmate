# Data model and ownership

Status: Current. Domain vocabulary is defined in [CONTEXT.md](../../../CONTEXT.md).

| Record | Permanent home | Writers |
| --- | --- | --- |
| Task Markdown and Steps syntax | [Task file format](../specifications/task-file-format.md), mirrored by Task Pilot's [Task schema](../../../skills/taskpilot/references/task-schema.md) | Plugin repository and Python todo store |
| Project Markdown | [Project schema](../../../skills/taskpilot/references/project-schema.md) | Plugin project repository and Python todo store |
| Proposal session, decisions and provenance | [Proposal workflow](../../../skills/taskpilot/references/proposal-workflow.md) | Python proposal store / compatible agent file tools |
| Plugin settings | [settings.ts](../../../src/settings.ts) | Obsidian plugin settings |

Schema references remain inside Task Pilot so an installed skill works without this repository's docs. The normative repository contract is [Task file format](../specifications/task-file-format.md); this page explains concepts and ownership without duplicating its field catalogue. TypeScript types and parsers implement those contracts; a parser discrepancy is not permission to redefine the format silently.

Task identity survives filename changes. Project references use IDs. Rank is a single global sequence. Steps are ordered values inside a parent Task and have independent completion flags but no separate identity. Task updates preserve unknown frontmatter; source provenance updates preserve unrelated source properties and prose.

Settings select managed folders; settings edits do not migrate stored files. Future [Vault registry](../features/agent-vault-setup.md) and [source index](../features/source-note-index.md) must not be treated as existing records.

Format changes require compatibility/migration decisions, TypeScript and Python round-trip checks, and linked product acceptance criteria. See [verification](testing.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

用語は[CONTEXT.md](../../../CONTEXT.md)、Task形式は[Task file format](../specifications/task-file-format.md)とTask Pilotの[task schema](../../../skills/taskpilot/references/task-schema.md)、Project形式は[project schema](../../../skills/taskpilot/references/project-schema.md)、提案形式は[proposal workflow](../../../skills/taskpilot/references/proposal-workflow.md)を正本にします。Task Pilotを単独配布できるようschemaの配置を維持し、この文書でフィールド一覧を複製しません。

IDは改名で変えず、Project参照はID、手動順位は全体で一つです。Stepsは親の中の順序付き値です。Taskの未知のfrontmatter、Sourceの無関係なPropertyと本文を保ちます。設定変更は自動移行ではありません。Vault登録とSource索引は将来仕様です。形式変更時は移行と互換性を明記し、TypeScript・Python双方を検証します。
