# Storage and privacy

Approval: Accepted — existing product contract.
Implementation: Implemented; code review and schema tests, not an independent privacy audit.

## Contract

Tasks, Projects, and reviews (Task change Proposals and Source candidate reviews) are stored in configurable folders under `TaskMate` by default. Task Pilot writes rolling plans to `planFolder`, which defaults to `TaskMate/Plans` and is set only in the plugin data file, not in the settings screen. TaskMate uses Obsidian's vault and file-management APIs and has no telemetry, hosted TaskMate account, runtime AI, translation service, or TaskMate synchronization server. Uninstalling the plugin leaves its Markdown data and review files in the vault.

Task Pilot runs in a separate host with that host's filesystem and model-service permissions. Plugin privacy claims do not describe the agent client's data handling. [Source discovery limitations](source-import.md#current-discovery-limitation) also apply.

Changing a managed-folder setting selects another storage location; it does not automatically migrate existing files. Back up and move files deliberately when changing locations.

## Acceptance and evidence

- STORE-01: Task and Project Markdown remains after plugin removal.
- STORE-02: Changing the configured folder does not silently migrate or delete files.

Review [settings](../../../src/settings.ts), [repositories](../../../src/tasks/repository.ts), and [schema ownership](../design/data-model.md). STORE-01 and STORE-02 require a disposable-Vault manual check.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

タスク、プロジェクト、レビュー（Task変更ProposalとSource候補レビュー）は、初期状態では`TaskMate`配下の設定可能なフォルダーへ保存します。Task Pilotは計画ファイルを`planFolder`（既定は`TaskMate/Plans`）へ保存します。この値はプラグインのデータファイルだけで設定し、設定画面にはありません。TaskMateはObsidianのVault APIとファイル管理APIを使い、テレメトリー、TaskMateのホスト型アカウント、実行時AI、翻訳サービス、TaskMate独自の同期サーバーを持ちません。プラグインをアンインストールしても、MarkdownデータとレビューのファイルはVaultに残ります。

承認：既存契約から継承。実装済みですが、独立したプライバシー監査は行っていません。

Task Pilotは実行元クライアントのファイル権限・モデルサービスの条件で動作します。プラグインのプライバシー保証と区別し、[Source探索の制約](source-import.md#current-discovery-limitation)も確認してください。

管理フォルダーの設定変更は参照先を変えるだけで、自動移行ではありません。STORE-01：削除後もデータを残す、STORE-02：設定変更で移行・削除しない、を使い捨てVaultで手動確認します。
