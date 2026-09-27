# Product specifications

[Overview](overview.md) owns purpose and scope. This index owns navigation/status summaries; each feature file owns its guarantees. For implementation mechanics use [design](../design/README.md).

| Specification | Approval | Implementation |
| --- | --- | --- |
| [Task editing](task-editing.md) | Accepted (existing contract) | Implemented; see evidence |
| [Task Steps](task-steps.md) | Accepted (existing contract) | Implemented; see evidence |
| [Projects](projects.md) | Accepted (existing contract) | Implemented; see evidence |
| [Labels](labels.md) | Accepted (existing contract) | Implemented; see evidence |
| [Navigation, filtering and sorting](filtering-and-sorting.md) | Accepted (existing contract) | Implemented; see evidence |
| [Mobile layout](mobile-layout.md) | Accepted (existing contract) | Implemented; see evidence |
| [Localization](localization.md) | Accepted (existing contract) | Implemented; see evidence |
| [Source-note import](source-import.md) | Accepted (existing contract) | Implemented; see evidence |
| [Edit conflicts](edit-conflicts.md) | Accepted (existing contract) | Implemented with known Step equality gap |
| [Storage and privacy](storage-and-privacy.md) | Accepted (existing contract) | Implemented; see evidence |
| [Agent Vault setup](agent-vault-setup.md) | Proposed | Not implemented |
| [Source note index](source-note-index.md) | Proposed | Not implemented |

Add a specification using [the template](../../templates/feature-spec.md) and [the lifecycle rules](../../DOCUMENTATION_ARCHITECTURE.md). Keep one feature file until splitting it into a same-named folder improves navigation. [Verification](../design/testing.md) distinguishes test evidence from manual checks and known gaps.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

[概要](overview.md)は目的と範囲、この一覧は状態と案内、各機能ファイルは保証を所有します。実装方法は[内部設計](../design/README.md)へ進みます。表のAcceptedは既存契約から継承した決定、Implementedは現行branchの実装を示し、全検証完了を意味しません。Vault登録とSource索引はProposed・未実装です。編集競合はStep等価判定に不足があります。

追加時は[template](../../templates/feature-spec.md)と[保守ルール](../../DOCUMENTATION_ARCHITECTURE.md)を使い、長くなった機能だけ同名フォルダーへ分割します。[検証表](../design/testing.md)で根拠と不足を確認します。
