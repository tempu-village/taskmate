# Internal design

Read the relevant [product specification](../specifications/README.md) before changing user-observable behavior.

- [Architecture](architecture.md): components and dependency boundaries.
- [Data model](data-model.md): canonical formats and ownership.
- [Security](security.md): trust boundaries and data access.
- [Testing](testing.md): evidence, commands, manual scenarios and known gaps.
- [Source import](features/source-import.md) and [edit conflicts](features/edit-conflicts.md): feature-specific mechanics.
- [ADR](adr/README.md): accepted choices and trade-offs.

These records are shared by human developers and AI. Create another feature design when invariants, concurrency, failure handling or migration need explanation; the product specification remains the home of external guarantees.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

利用者から見える挙動を変更する前に[製品仕様](../specifications/README.md)を読みます。構成は[architecture](architecture.md)、保存形式は[data model](data-model.md)、信頼境界は[security](security.md)、検証と不足は[testing](testing.md)、機能ごとの仕組みは[Source import](features/source-import.md)と[edit conflicts](features/edit-conflicts.md)、採用理由は[ADR](adr/README.md)へ進みます。人間とAIは同じ設計資料を使い、外部保証は製品仕様へリンクします。
