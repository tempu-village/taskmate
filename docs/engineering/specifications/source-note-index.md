# Source note index

Approval: Proposed — no product approval is inferred from this documentation migration.
Implementation: Not implemented.

Tracking: [#39](https://github.com/tempu-village/taskmate/issues/39)

> English is canonical. The Japanese reference below is AI-generated and has not been fully reviewed by a human.

## Purpose

Routine Agent Skill imports find eligible Source notes without enumerating and opening every Markdown file in a Vault. The index is a regenerable plugin-managed snapshot of the existing allowlist; it is not a second allowlist or a task database.

## Index behavior

The plugin stores a format version, Vault identity, generation state, source-setting identity, and eligible vault-relative paths in `<vault>/.obsidian/plugins/taskmate/agent-index.json`. It creates the index after metadata is ready, reconciles it at startup, and updates it after Markdown creation, modification, renaming, deletion, or relevant settings changes. A complete generation is published atomically.

The existing rules stay unchanged: selected source folders include notes by default, `taskmate-source: false` excludes a note, and `taskmate-source: true` includes a note outside selected folders. Task, Project, Proposal, and Obsidian configuration folders remain excluded. An index path must stay inside its Vault, and being indexed never overrides the note's current allowlist status.

Routine discovery consumes a valid index and may read indexed Source notes to recheck eligibility and calculate processing state and content hash. It must not enumerate or open unrelated Markdown merely to find candidates. The `sources` result continues to return `path`, `state`, `hash`, and `taskIds`.

## Freshness and recovery

An index is a snapshot. It cannot establish that no eligible note changed while the plugin was stopped. Startup reconciliation incorporates those changes. Initial construction and explicit reconstruction may enumerate Markdown; this cost is separate from routine discovery.

Missing, unreadable, incompatible, rebuilding, wrong-Vault, or known-stale indexes stop discovery with an actionable recovery message. Settings mismatch and missing indexed files invalidate an index. Discovery never silently falls back to a Vault-wide scan or expands source scope. Recovery is to open the Vault with TaskMate, let startup reconciliation or an explicit rebuild finish, then retry.

## Acceptance scenarios

1. In a Vault with many unrelated notes, routine discovery opens only indexed eligible notes and returns the existing JSON shape.
2. Folder inheritance, individual opt-in/out, and managed-folder exclusion remain correct in the index and discovery.
3. Settings changes and file create/modify/rename/delete events converge to a complete index. Startup reconciliation incorporates edits made while Obsidian was closed, and readers never see a partial generation.
4. Missing, invalid, incompatible, rebuilding, or known-stale indexes produce recovery guidance without an implicit full scan or broader scope.
5. Existing direct task operations and proposal staging/promotion behavior continue to pass their tests.

## Related records

- [Agent Vault setup](agent-vault-setup.md)
- [Source allowlist ADR](../design/adr/0004-opt-in-source-notes.md), [proposal staging ADR](../design/adr/0011-stage-source-imports-before-promotion.md)
- [TaskMate Skill](../../../skills/taskmate/SKILL.md)

## 日本語参考訳

**状態：提案・未実装。** 関連Issueは [#39](https://github.com/tempu-village/taskmate/issues/39) です。

### 目的

通常のAgent Skillインポートで、Vault内の全Markdownを列挙・読み込みせずに対象Source noteを見つけます。索引は既存の許可リストからpluginが再構築できるスナップショットであり、別の許可リストやタスクDBではありません。

### 索引の動作

pluginは`<vault>/.obsidian/plugins/taskmate/agent-index.json`へ、形式バージョン、Vault ID、世代状態、対象設定の識別情報、対象のVault相対パスを保存します。メタデータ準備後に構築し、起動時に再照合します。Markdownの作成・変更・改名・削除、関連設定の変更で更新し、完了した世代だけを一括公開します。

選択フォルダーの継承、`taskmate-source: false`による除外、フォルダー外の`true`による許可を維持します。Task・Project・Proposal・Obsidian設定領域は除外します。索引パスはVault内に制限し、索引に載っていても現在の許可規則より優先しません。

通常探索は有効な索引を使い、対象メモだけを読んで適格性・処理状態・ハッシュを確認します。候補発見のために無関係なMarkdownを列挙・読み込みしません。`sources`の`path`、`state`、`hash`、`taskIds`を維持します。

### 最新性と復旧

索引はスナップショットです。plugin停止中の対象変更は証明できず、起動時再照合で反映します。初回構築と明示的な再構築ではMarkdown列挙があり得ますが、通常探索とは分けます。

索引の欠落・読み取り不能・未対応形式・構築中・別Vault・判明している古さでは探索を止め、復旧手順を示します。設定不一致や索引内ファイルの消失も無効化します。全Vault走査や対象範囲の拡大へ黙って切り替えません。VaultをTaskMateで開き、起動時再照合または再構築を完了してから再試行します。

### 受け入れシナリオ

1. 大量の対象外ノートがあっても、通常探索は索引内の対象だけを開き、既存JSON形式を返す。
2. フォルダー継承、個別の許可・除外、管理フォルダー除外を索引と探索で維持する。
3. 設定変更と作成・変更・改名・削除で完全な索引へ収束する。停止中の変更は起動時に取り込み、途中世代は読ませない。
4. 索引の欠落・不正・未対応・構築中・古さでは、暗黙の全体走査や範囲拡大なしに復旧を案内する。
5. 既存の直接Task操作と提案のstage/promotionが引き続きテストに通る。
