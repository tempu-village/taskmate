# Agent Vault setup

Approval: Proposed — no product approval is inferred from this documentation migration.
Implementation: Not implemented.

Tracking: Not assigned. User-facing guides are tracked separately by [#40](https://github.com/tempu-village/taskmate/issues/40).

> English is canonical. The Japanese reference below is AI-generated and has not been fully reviewed by a human.

## Purpose

After one-time setup, a user can request “Turn my TaskMate source notes into tasks” without repeating a Vault path, shell command, JSON plan, or review instruction. The agent resolves the selected Vault, stages a Coverage review, and waits for explicit Review decisions before creating Tasks.

Setup records a location; it does not grant permission to read every note. An empty source allowlist remains empty until the user selects folders or opts notes in. The feature does not search the whole computer to discover Vaults.

## Configuration ownership

| Record | Proposed location | Owner and purpose |
| --- | --- | --- |
| Local Vault registry | `~/.taskmate/agent.json` | Agent-managed, machine-specific registry of `schemaVersion`, `defaultVaultId`, and Vault ID, display name, and absolute path. It is not stored in the synced Vault or installed Skill. |
| Vault settings | `<vault>/.obsidian/plugins/taskmate/data.json` | Plugin-owned settings. Extend the existing settings with `schemaVersion`, `vaultId`, and `defaultImportLabels`; existing managed folders and source settings remain authoritative. |
| Source index | `<vault>/.obsidian/plugins/taskmate/agent-index.json` | Regenerable plugin-owned state defined by [Source note index](source-note-index.md). |

The plugin generates a stable `vaultId` during setup/migration using public Obsidian/browser capabilities. The agent registers its local path. Invalid or unsupported configuration gives an actionable error rather than being overwritten. Re-running setup preserves existing values and unknown settings. A moved Vault can be rebound after the user supplies its new path; duplicate IDs at different locations require disambiguation.

`defaultImportLabels` defaults to `[]` and applies to newly proposed Tasks. Current-request instructions override it. Existing labels on a merge target remain unchanged unless the user asks to change them. Dates, Priority, and Project remain unset when neither the source nor the user establishes them.

Coverage review, explicit approval, allowlist enforcement, and preservation of unrelated source content are fixed behavior, not configuration switches. Processing hashes, task IDs, and proposal decisions remain in their existing Markdown records.

## Vault selection

Resolve a Vault in this order: explicit request → workspace located inside a recognized Vault → registered default → sole registered Vault → ask once. “Workspace” means the agent's working context, not the foreground Obsidian window. A selected but missing or invalid Vault stops resolution; do not silently use another Vault. Display the selected Vault name at the start of the operation.

Initial setup may make a sole registered Vault the default. Registering another Vault does not silently change the default. Changing the default is an explicit user action and never bypasses agent-client filesystem permissions.

## Acceptance scenarios

1. First use registers an identified Vault without manual JSON editing. Subsequent use needs neither its path nor shell commands.
2. Repeat setup preserves settings; multiple, missing, moved, and copied Vaults resolve as specified.
3. Default labels appear on new proposals, current-request instructions override them, and existing merge-target labels remain unchanged unless requested.
4. A short request stages proposals without creating Tasks. Partial decisions remain active, all decisions archive the session, and source changes before promotion require renewed review.

## Related records

- [Source note index](source-note-index.md)
- [Product overview](overview.md), [domain terms](../../../CONTEXT.md)
- [Proposal staging ADR](../design/adr/0011-stage-source-imports-before-promotion.md), [coverage manifest ADR](../design/adr/0017-require-a-candidate-manifest-for-coverage-review.md)

## 日本語参考訳

**状態：提案・未実装。** 実装Issueは未割り当てです。利用者向けガイドは [#40](https://github.com/tempu-village/taskmate/issues/40) で追跡します。

### 目的

初回設定後は「TaskMate対象メモをタスク化して」だけで、Vaultパス、コマンド、JSON、レビュー指示を繰り返さずにCoverage reviewのステージまで進みます。正式Taskの作成は明示的なReview decision後です。

設定は所在地を記録するだけで、全ノートの読み取り許可を与えません。空の許可リストはユーザーがフォルダーや個別メモを選ぶまで空のままです。コンピューター全体からVaultを探索しません。

### 設定の責務

- `~/.taskmate/agent.json`：Agentが管理する端末固有の登録簿。形式、既定Vault ID、Vault ID・表示名・絶対パスを保存します。同期Vaultやインストール済みSkillには置きません。
- `<vault>/.obsidian/plugins/taskmate/data.json`：pluginが管理する設定の正本。既存設定を維持し、`schemaVersion`、`vaultId`、`defaultImportLabels`を追加します。
- `<vault>/.obsidian/plugins/taskmate/agent-index.json`：[Source note index](source-note-index.md)で定義する、pluginが再構築可能な状態です。

pluginは公開Obsidian/browser機能で安定した`vaultId`を生成し、Agentがローカルパスを登録します。不正・未対応の設定は上書きせず、対処方法を示します。再設定では既存値と未知の値を保持します。移動したVaultはユーザー指定の新パスへ再登録でき、同じIDが複数の場所にあれば区別を求めます。

`defaultImportLabels`は空配列を既定とし、新規提案へ適用します。その回の明示指示が優先し、merge先の既存ラベルは変更依頼がなければ保持します。根拠のない日付・Priority・Projectは未設定です。

Coverage review、明示承認、許可リスト、無関係な本文の保持は固定ルールです。処理ハッシュ、Task ID、提案判断は既存Markdownに残します。

### Vaultの選択

今回の明示指定 → 実際の作業場所が属するVault → 登録済み既定Vault → 唯一の登録Vault → 初回質問、の順に解決します。前面のObsidian画面ではなくAgentの作業コンテキストを使います。選択Vaultが消失・無効なら停止し、別Vaultへ自動切り替えしません。開始時に使用Vault名を表示します。

初回の唯一の登録Vaultは既定にできますが、追加登録で既定を変えません。既定の変更は明示操作とし、Agentクライアントのファイル権限を迂回しません。

### 受け入れシナリオ

1. 初回はJSON手編集なしで特定Vaultを登録でき、次回からパス・コマンド不要。
2. 再設定は値を保持し、複数・消失・移動・コピーされたVaultを規定どおり扱う。
3. 既定ラベルを新規提案へ適用し、今回の明示指示を優先する。merge先の既存ラベルは依頼がなければ保持する。
4. 短い依頼では提案までとし、部分承認はActive、全件判断後はArchive。反映前のSource変更は再レビューする。
