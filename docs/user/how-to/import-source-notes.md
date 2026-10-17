# Review source notes and create Tasks

Use this workflow to turn actions in notes into TaskMate Tasks without changing canonical Tasks before approval.

| Where | What happens there |
| --- | --- |
| Obsidian | Select source notes; inspect the staged review and final Tasks. |
| Codex | Request the review; approve, revise, or exclude proposals; apply explicit decisions. |

TaskMate does not run AI by itself. The current source-note review has no approval button in Obsidian: type decisions in Codex.

## Before you start

You need TaskMate in the Vault, [Task Pilot in Codex](../../../README.md#install-and-use-task-pilot), and a Codex workspace authorized to read and write that Vault. Open the Vault as the workspace or include its absolute path in the request. Automatic Vault registration is [not implemented](../../engineering/features/agent-vault-setup.md).

## Complete flow

| Step | Where | Input | Output |
| --- | --- | --- | --- |
| 1. Select | Obsidian | Run the TaskMate AI-source command on intended notes. | Notes become eligible; no review or Task exists yet. |
| 2. Confirm scope | Codex | Ask for eligible paths before extraction. | Codex lists the intended Vault-relative paths. |
| 3. Stage | Codex | Ask for create, merge, and exclusion proposals without promotion. | An Active review appears; canonical Tasks remain unchanged. |
| 4. Inspect | Obsidian | Compare every proposal with its source. | You can identify omissions or incorrect grouping. |
| 5. Decide | Codex | Approve, revise, exclude, or leave proposals pending. | Only explicit decisions are promoted. |
| 6. Verify | Obsidian | Inspect Tasks, source links, and review status. | Approved results exist; pending proposals remain unchanged. |

## 1. Select notes in Obsidian

Open each intended note, open the Command palette, and run **TaskMate: Include current note as an AI source**. For a folder, run **Include current folder as an AI source** or configure a source folder. The note command records `taskmate-source: true`; `taskmate-source: false` overrides folder inclusion.

Selection only grants eligibility. It does not create a review or Task.

The source note may later contain `taskmate-import-*` and `taskmate-task-ids`. These are import-history properties, not Task fields. Properties such as `type: meeting-note`, `owner`, and `scenario` are not owned by TaskMate and are preserved. See [Source note property format](../../engineering/specifications/source-note-properties.md).

## 2. Confirm the scope in Codex

Paste this into Codex:

```text
このVaultでTaskMateのAI対象になっているソースノートを確認してください。
レビューはまだ作らず、今回レビューするノートのVault相対パスだけを先に表示してください。
```

If needed, begin with `Vaultは /absolute/path/to/my-vault です。` Check the returned paths and tell Codex to remove any unintended note from this run.

## 3. Create the review from Codex

Paste this after confirming the paths:

```text
表示したノートだけを対象に、行動候補を漏れなく確認してください。
各候補を「新規Taskを作成」「既存Taskへ統合」「除外候補」のどれかに分類し、
TaskMateのActiveレビューへ提案をステージしてください。
まだTaskへの正式反映はしないでください。
```

Codex reads the selected notes, inventories candidates, checks existing Tasks for merges, and stages:

```text
TaskMate/Proposals/Active/<session-id>/Review.md
TaskMate/Proposals/Active/<session-id>/Tasks/<proposal>.md
```

`Review.md` is an index. The files under its `Tasks` folder are proposals, not canonical Tasks. `create` proposes a new Task, `merge` proposes an update to one existing Task, and `exclude` proposes no Task with a reason. All begin as `pending`. You do not type the Python helper commands.

## 4. Inspect in Obsidian

Open `Review.md`, then every linked proposal. Compare **Covered source statements** with the original notes. Check for omitted actions, the target of every merge, and the reason for every exclusion. Do not edit proposal frontmatter to approve it.

## 5. Decide in Codex

Approval happens in the Codex conversation.

Approve all as proposed:

```text
Activeの候補レビューを全件提案どおり承認し、正式反映してください。
新規作成、既存Taskへの統合、除外案をそれぞれ提案どおり処理してください。
```

Approve one and leave the rest pending:

```text
「田中さんへ見積書を送る」だけ承認して正式反映してください。
ほかはpendingのまま残してください。
```

Revise and approve:

```text
「検索フィルターを確認する」はタイトルを
「検索フィルターの主要3条件を確認する」に変更して承認してください。
日付は変更せず、ほかはpendingのままにしてください。
```

Confirm an exclusion:

```text
「分析画面をいつか試したい」の除外案を承認し、Taskを作らないでください。
```

Turn an exclusion into a Task:

```text
「分析画面をいつか試したい」は除外しません。
「分析画面を30分試す」という新規Taskに変更して承認してください。
日付とPriorityは設定しないでください。
```

Use the proposal title or ID when names are ambiguous. Silence is not approval. Before promotion, Codex rechecks the source and merge target; changed content requires a renewed review.

## 6. Verify in Obsidian

- Approved `create`: one new file appears under `TaskMate/Tasks` with a source link.
- Approved `merge`: the identified existing Task changes and no duplicate is created.
- Approved `exclude`: no Task is created; the decision and reason remain as evidence.
- Pending proposals keep the session in `Active`.
- After every proposal is decided, source provenance is recorded and the session moves to `TaskMate/Proposals/Archive`.

Opening `Review.md` does not approve anything, and selecting a source does not create a review. For exact behavior and retry limits, see [Source-note import](../../engineering/features/source-import.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

この機能は、日報や会議メモの行動事項を、承認前に正式Taskを変更せず確認してからTaskMateへ取り込むためのものです。

### どの画面で何をするか

| 操作する場所 | すること |
| --- | --- |
| Obsidian | 対象ノートを指定する。作られたレビューと反映後のTaskを確認する |
| Codex | レビュー作成を依頼する。承認・修正・除外を文章で入力する |

TaskMateプラグイン単体ではAIを実行しません。現在の候補レビューにはObsidian上の承認ボタンがないため、判断はCodexへ入力します。

### 全体の流れ

| 手順 | 場所 | 入力 | 出力 |
| --- | --- | --- | --- |
| 1. 対象指定 | Obsidian | AI対象コマンドを実行 | 対象資格だけが付く。レビューもTaskもまだない |
| 2. 対象確認 | Codex | 対象パスを先に表示するよう依頼 | 今回読むノートの一覧 |
| 3. レビュー作成 | Codex | 正式反映せずステージするよう依頼 | `Proposals/Active` にレビュー |
| 4. 内容確認 | Obsidian | 元ノートと全提案を比較 | 作成・統合・除外案を確認できる |
| 5. 判断 | Codex | 承認・修正・除外・保留を文章で入力 | 明示した判断だけが反映される |
| 6. 結果確認 | Obsidian | Taskとレビュー状態を確認 | 承認済みだけ反映、保留は不変 |

### 1：Obsidianでノートを対象にする

1. 対象ノートを開く
2. コマンドパレットを開く
3. **TaskMate: 現在のノートをAI対象にする**を実行する
4. 複数ノートなら繰り返す

フォルダー単位なら **現在のフォルダーをAI対象にする** またはTaskMate設定のソースフォルダーを使います。ノートには `taskmate-source: true` が記録されます。`false` はフォルダー指定より優先します。

この操作だけではレビューもTaskも作られません。「後でCodexが扱ってよいノート」にする操作です。

正式反映後にソースノートへ追加される`taskmate-import-*`と`taskmate-task-ids`は取り込み履歴であり、TaskのPropertyではありません。`type: meeting-note`、`owner`、`scenario`などはTaskMate管理外で、そのまま保持されます。分類は[Source note property format](../../engineering/specifications/source-note-properties.md)を参照してください。

### 2：Codexで対象を確認する

Vaultを開いているCodexのメッセージ欄へ、次を貼り付けて送信します。

```text
このVaultでTaskMateのAI対象になっているソースノートを確認してください。
レビューはまだ作らず、今回レビューするノートのVault相対パスだけを先に表示してください。
```

別のワークスペースなら、先頭に `Vaultは /絶対パス/です。` と追記します。Codexが返したパスを確認し、不要なものは「今回は○○を外して」と伝えます。

### 3：Codexでレビューを作る

対象が正しければ、同じCodexタスクへ次を送ります。

```text
表示したノートだけを対象に、行動候補を漏れなく確認してください。
各候補を「新規Taskを作成」「既存Taskへ統合」「除外候補」のどれかに分類し、
TaskMateのActiveレビューへ提案をステージしてください。
まだTaskへの正式反映はしないでください。
```

Obsidianに次が作られます。

```text
TaskMate/Proposals/Active/<session-id>/Review.md
TaskMate/Proposals/Active/<session-id>/Tasks/<提案>.md
```

`Review.md`は目次、`Tasks`内は提案書です。まだ正式Taskではありません。利用者がPythonコマンドを入力する必要はありません。

### 4：Obsidianでレビューを読む

`Review.md`から全提案を開き、**Covered source statements**を元ノートと照合します。候補漏れ、誤った統合先、除外理由を確認します。frontmatterを直接編集して承認しないでください。

### 5：Codexへ判断を入力する

全件を提案どおり反映する例：

```text
Activeの候補レビューを全件提案どおり承認し、正式反映してください。
新規作成、既存Taskへの統合、除外案をそれぞれ提案どおり処理してください。
```

1件だけ承認する例：

```text
「田中さんへ見積書を送る」だけ承認して正式反映してください。
ほかはpendingのまま残してください。
```

修正する例：

```text
「検索フィルターを確認する」はタイトルを
「検索フィルターの主要3条件を確認する」に変更して承認してください。
日付は変更しないでください。
```

除外案を承認する例：

```text
「分析画面をいつか試したい」の除外案を承認し、Taskを作らないでください。
```

除外せずTask化する例：

```text
「分析画面をいつか試したい」は除外しません。
「分析画面を30分試す」という新規Taskに変更して承認してください。
日付とPriorityは設定しないでください。
```

何も指定しなかった提案はpendingのままです。Codexは反映前にソースと統合先を再確認し、レビュー後に変更されていれば上書きせず再レビューします。

### 6：Obsidianで結果を確認する

- `create` 承認：`TaskMate/Tasks` にSource付きの新規Taskができる
- `merge` 承認：指定した既存Taskが更新され、重複Taskはできない
- `exclude` 承認：Taskはできず、判断と理由が証跡に残る
- pendingがある：レビューは `Active` に残る
- 全件判断済み：ソースへ処理情報を記録し、レビューは `Archive` へ移る

AI対象にしただけではレビューは作られません。`Review.md`を開いただけでも承認されません。正確な挙動と再試行時の制約は[ソース取り込みFeature](../../engineering/features/source-import.md)を参照してください。
