# Features

Feature documents in `docs/engineering/features/` are standalone current references for each product capability. Their readers are future implementers and maintainers, plus users who need exact behavior. They keep user-visible What and feature-specific How together: available functionality, rules, guarantees, constraints, persisted representation, relationships to other features, processing flow, failure behavior, acceptance criteria, evidence and known gaps.

Do not narrate source code line by line. Put strict contracts shared by multiple features—such as formats, schemas, limits, transitions, compatibility and security constraints—in [specifications](../specifications/README.md), and link rather than duplicate them. Put RFC discussion, rejected alternatives, provisional hypotheses and future plans in [RFCs](../rfcs/README.md), not in the current Feature. Preserve important hard-to-reverse rationale in [ADRs](../adr/README.md). Each related RFC links to its current authority, and the Feature's `Related RFCs` section links back as background/design history. When code changes feature behavior or internal processing, update its Feature document in the same change.

| Feature | Approval | Implementation |
| --- | --- | --- |
| [Overview](overview.md) | Current product scope | Current |
| [Task editing](task-editing.md) | Accepted | Implemented |
| [Task Steps](task-steps.md) | Accepted | Implemented |
| [Projects](projects.md) | Accepted | Implemented |
| [Labels](labels.md) | Accepted | Implemented |
| [Navigation, filtering and sorting](filtering-and-sorting.md) | Accepted | Implemented |
| [Mobile layout](mobile-layout.md) | Accepted | Implemented |
| [Localization](localization.md) | Accepted | Implemented |
| [Source-note import](source-import.md) | Accepted | Implemented |
| [Edit conflicts](edit-conflicts.md) | Accepted | Implemented with a known Step equality gap |
| [Storage and privacy](storage-and-privacy.md) | Accepted | Implemented |
| [Agent Vault setup](agent-vault-setup.md) | Proposed | Not implemented |
| [Source note index](source-note-index.md) | Proposed | Not implemented |

Use the [Feature template](../../templates/feature-spec.md) and [documentation policy](../../DOCUMENTATION_ARCHITECTURE.md). Feature documents have no line limit: use the length required by the capability's complexity, keep short Features short and omit empty headings. For every implemented product RFC, create or update the applicable Feature from implementation, tests and review—not by copying the proposal—and add reciprocal links.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

Feature文書は機能ごとの単独で理解できる現行リファレンスです。将来の実装者・保守者と正確な挙動を知りたい利用者に向けて、利用可能な機能、保証、ルール、制約、保存形式、他機能との関係、処理、失敗時の挙動、根拠を記録します。行数上限は設けません。RFCの議論、却下案、仮説、実装予定は転記せず、背景・設計判断としてリンクします。実装済みの製品RFCごとに該当Featureを作成または更新し、相互リンクします。
