# Features

Feature documents are the current authority for each product capability. They keep user-visible What and feature-specific How together: purpose, behavior, guarantees, constraints, processing flow, failure behavior, acceptance criteria, evidence and known gaps.

Do not narrate source code line by line. Put strict contracts shared by multiple features—such as formats, schemas, limits, transitions, compatibility and security constraints—in [specifications](../specifications/README.md), and link rather than duplicate them. Put unsettled changes in [RFCs](../rfcs/README.md), and preserve the rationale for important hard-to-reverse decisions in [ADRs](../adr/README.md). Each related RFC links to its current authority, and the Feature's `Related RFCs` section links back to that history. When code changes feature behavior or internal processing, update its Feature document in the same change.

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

Use the [Feature template](../../templates/feature-spec.md) and [documentation policy](../../DOCUMENTATION_ARCHITECTURE.md). Keep short Features short and omit empty headings.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

Feature文書は機能ごとの現在の正本であり、利用者から見たWhatと機能固有のHowを一つにまとめます。保証、制約、処理フロー、失敗時の挙動、受入条件、根拠、既知の不足を記録し、コードを逐語的に説明しません。複数機能が参照する厳密な契約は[Specification](../specifications/README.md)、未確定案は[RFC](../rfcs/README.md)、長期的に理由を残す判断は[ADR](../adr/README.md)へ置きます。RFCは現在の正本へリンクし、Featureの`Related RFCs`から履歴へ戻れるようにします。挙動や内部処理を変えるコード変更では同じ変更でFeature文書を更新します。
