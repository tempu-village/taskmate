# TaskMate product specification

> English is canonical. Japanese is an AI-translated reference.

## Purpose

TaskMate is a local-first task manager for Obsidian. It keeps Tasks and Projects readable as Markdown while providing focused desktop and mobile task operations. The optional Agent Skill supports reviewed extraction from source notes.

## Product principles

- Markdown in the vault is the source of truth; TaskMate does not require a hosted account or database.
- The same plugin should work in desktop and mobile Obsidian through public Obsidian and browser APIs.
- Common task operations should remain fast and understandable on a narrow mobile screen.
- One global Manual order is preserved; automatic sorting changes presentation only.
- AI-assisted extraction is optional, staged, and reviewable before it may change canonical Tasks.
- English is the canonical UI and documentation source, with Japanese maintained in the same change.

## Specification map

Read the [specification index](README.md) for feature contracts, approval/implementation status and evidence. [Design](../design/README.md) describes implementation constraints; [user guides](../../user/README.md) explain operations. [CONTEXT.md](../../../CONTEXT.md) owns domain terms.

Accepted contracts describe intended guarantees; code shows observed behavior and tests provide evidence for named cases. A passing test does not approve a product decision. Record disagreements in [verification gaps](../design/testing.md#known-gaps), keep intended and observed behavior distinct, and resolve the mismatch rather than silently changing the promise.

## Supported environments and limitations

- Desktop and Android Obsidian are the verified environments. The code remains mobile-compatible, but iOS device behavior has not yet been verified.
- TaskMate is not yet listed in the Obsidian Community directory.
- Calendar, Kanban, recurrence, and reminders are not part of the current product.
- TaskMate does not provide a synchronization service or remote conflict merging. It prevents silent overwrites of changes that have reached the local vault through guarded three-way comparison in the Task editor.
- The optional Agent Skill depends on the permissions and capabilities of its host agent client.

---

# TaskMate 製品仕様

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

## 目的

TaskMateはObsidian向けのローカルファースト・タスク管理機能です。TaskとProjectを読みやすいMarkdownで保存し、PCとモバイルの操作を提供します。任意のAgent Skillはレビュー付きのメモ抽出を支援します。

## 製品原則

- Vault内のMarkdownを正本とし、TaskMate専用のホスト型アカウントやデータベースを必要としません。
- 公開Obsidian APIとブラウザーAPIを使い、同じプラグインをデスクトップ版とモバイル版Obsidianで動作させます。
- 一般的なタスク操作を、幅の狭いモバイル画面でも素早く理解しやすいものにします。
- 手動順は全体で一つだけ保持し、自動並べ替えは表示だけを変更します。
- AIによる抽出は任意機能とし、正本タスクを変更する前に段階化してレビュー可能にします。
- 英語をUIと文書の正本とし、日本語を同じ変更内で保守します。

## 仕様の案内

[仕様一覧](README.md)で機能契約、承認・実装状態、検証根拠を確認します。[内部設計](../design/README.md)は実装制約、[利用者向け文書](../../user/README.md)は操作、[CONTEXT.md](../../../CONTEXT.md)は用語の正本です。

承認済み仕様は意図した保証、コードは観測できる挙動、テストは個々のケースの根拠です。テスト成功を製品判断の承認として扱いません。不一致は[検証不足](../design/testing.md#known-gaps)に記録し、意図と現状を区別して解決します。

## 対応環境と制限

- デスクトップ版とAndroid版Obsidianが検証済み環境です。コードはモバイル互換を維持していますが、iOS実機の挙動はまだ検証していません。
- TaskMateは、まだObsidian Communityディレクトリに掲載されていません。
- カレンダー、カンバン、繰り返し、リマインダーは、現在の製品に含まれません。
- TaskMateは同期サービスやリモート競合マージを提供しません。ローカルVaultへ届いた変更については、タスク編集画面の3方向比較で黙った上書きを防ぎます。
- 任意のAgent Skillは、実行元のエージェントクライアントの権限と能力に依存します。
