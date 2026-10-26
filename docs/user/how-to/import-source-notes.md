# Review source notes and create Tasks

Use this workflow to turn actions in notes into TaskMate Tasks. Nothing changes in your Tasks until you apply candidates in TaskMate.

| Where | What happens there |
| --- | --- |
| Obsidian | Select source notes; review, edit, decide and apply candidates in TaskMate; check the resulting Tasks. |
| Codex | Ask Task Pilot to read the notes and stage a review. |

TaskMate does not run AI by itself. Task Pilot in Codex reads the notes and prepares the candidates; every decision is made in TaskMate.

## Before you start

You need TaskMate in the Vault, [Task Pilot in Codex](../../../README.md#install-and-use-task-pilot), and a Codex workspace authorized to read and write that Vault. Open the Vault as the workspace or include its absolute path in the request. Automatic Vault registration is [not implemented](../../engineering/features/agent-vault-setup.md).

## Complete flow

| Step | Where | Input | Output |
| --- | --- | --- | --- |
| 1. Select | Obsidian | Run the TaskMate AI-source command on intended notes. | Notes become eligible; no review or Task exists yet. |
| 2. Confirm scope | Codex | Ask for eligible paths before extraction. | Codex lists the intended Vault-relative paths. |
| 3. Stage | Codex | Ask for a review of every candidate without applying it. | A review opens in TaskMate; your Tasks remain unchanged. |
| 4. Review | TaskMate | Read every card against its source, open merge diffs, and edit cards. | Each candidate says what you intend. |
| 5. Decide and apply | TaskMate | Choose create, merge, exclude, or hold, then confirm. | Only approved candidates are written; the rest stay pending. |
| 6. Verify | Obsidian | Inspect Tasks, source note properties, and the review history. | Applied results exist; pending candidates remain in the review. |

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

## 3. Stage the review from Codex

Paste this after confirming the paths:

```text
表示したノートだけを対象に、行動候補を漏れなく確認してください。
各候補を「新規Taskを作成」「既存Taskへ統合」「除外候補」のどれかに分類し、
TaskMateの取り込みレビューとしてステージして開いてください。
まだTaskへの正式反映はしないでください。
```

Codex reads the selected notes, inventories every statement that could imply an action, checks existing Tasks for merges, and saves one review file:

```text
TaskMate/Proposals/import-review-<id>.json
```

The review opens in TaskMate. If it does not, run **TaskMate: Open reviews** and open it from the pending list. You do not type the Python helper commands, and the review file is not a Task.

## 4. Review the candidates in TaskMate

Each candidate is a card. It quotes the source statements it covers and shows what would happen:

- **Create Task** shows the Task draft: title, date, priority, labels, project, Steps, and Notes.
- **Merge into Task** names the existing Task and summarizes each change; **Show diff** opens the exact change inside the card.
- **Exclude** shows why no Task is proposed.

Compare every card with its source. Check for omitted actions, the target of every merge, and the reason for every exclusion. Select **Edit** to change a card's fields or its operation; an edited card returns to undecided. Merging into a different Task needs a new review from Codex.

## 5. Decide and apply in TaskMate

On each card, choose its operation (**Create**, **Merge**, or **Exclude**), **Hold** to keep it for later, or **Undecide**. Choosing a decision writes nothing yet.

Select **Apply decisions…** to see how many candidates will be created, merged, and excluded, which candidates will not be applied now, and any merge whose diff you have not opened. Applying such a merge requires ticking an extra confirmation. Select **Apply** to write the approved candidates. Before writing, TaskMate rechecks each source note and merge target; a candidate whose source or target changed is marked stale and needs a new look.

## 6. Verify in Obsidian

- Applied **Create**: one new file appears under `TaskMate/Tasks` with a source link.
- Applied **Merge**: the identified existing Task changes and no duplicate is created.
- Applied **Exclude**: no Task is created; the decision and reason remain in the review.
- Candidates you held or left undecided keep the review in the pending list.
- When every candidate from a note is applied, that note receives its import history. When every candidate in the review is applied, the review moves to the History tab of **TaskMate: Open reviews**.

Opening a review applies nothing, and selecting a source does not create a review. For exact behavior and retry limits, see [Source-note import](../../engineering/features/source-import.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

この機能は、日報や会議メモの行動事項をTaskMateのTaskにするためのものです。TaskMateで候補を反映するまで、Taskは何も変わりません。

### どの画面で何をするか

| 操作する場所 | すること |
| --- | --- |
| Obsidian | 対象ノートを指定する。TaskMateで候補を確認・編集・判断・反映する。反映後のTaskを確認する |
| Codex | Task Pilotにノートを読んでレビューを作るよう依頼する |

TaskMateプラグイン単体ではAIを実行しません。CodexのTask Pilotがノートを読んで候補を用意し、判断はすべてTaskMateで行います。

### 全体の流れ

| 手順 | 場所 | 入力 | 出力 |
| --- | --- | --- | --- |
| 1. 対象指定 | Obsidian | AI対象コマンドを実行 | 対象資格だけが付く。レビューもTaskもまだない |
| 2. 対象確認 | Codex | 対象パスを先に表示するよう依頼 | 今回読むノートの一覧 |
| 3. レビュー作成 | Codex | 反映せずにすべての候補をレビューにするよう依頼 | TaskMateでレビューが開く。Taskは変わらない |
| 4. 確認 | TaskMate | 各カードを元ノートと比べ、統合の差分を開き、カードを編集 | 各候補が意図どおりになる |
| 5. 判断と反映 | TaskMate | 作成・統合・除外・保留を選び、確認する | 承認した候補だけが書き込まれ、残りは未処理のまま |
| 6. 結果確認 | Obsidian | Task、元ノートのProperty、レビューの履歴を確認 | 反映した結果がある。未処理の候補はレビューに残る |

### 1：Obsidianでノートを対象にする

1. 対象ノートを開く
2. コマンドパレットを開く
3. **TaskMate: 現在のノートをAI対象にする**を実行する
4. 複数ノートなら繰り返す

フォルダー単位なら **現在のフォルダーをAI対象にする** またはTaskMate設定のソースフォルダーを使います。ノートには `taskmate-source: true` が記録されます。`false` はフォルダー指定より優先します。

この操作だけではレビューもTaskも作られません。「後でCodexが扱ってよいノート」にする操作です。

反映後にソースノートへ追加される`taskmate-import-*`と`taskmate-task-ids`は取り込み履歴であり、TaskのPropertyではありません。`type: meeting-note`、`owner`、`scenario`などはTaskMate管理外で、そのまま保持されます。分類は[Source note property format](../../engineering/specifications/source-note-properties.md)を参照してください。

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
TaskMateの取り込みレビューとしてステージして開いてください。
まだTaskへの正式反映はしないでください。
```

Codexは対象ノートを読み、行動になり得る文をすべて棚卸しし、既存Taskへの統合先を確認して、レビューのファイルを1つ保存します。

```text
TaskMate/Proposals/import-review-<id>.json
```

レビューはTaskMateで開きます。開かない場合は **TaskMate: レビューを開く** を実行し、未レビューの一覧から開きます。利用者がPythonコマンドを入力する必要はなく、レビューのファイルはTaskではありません。

### 4：TaskMateで候補を確認する

候補はそれぞれカードになり、対応する元の文を引用して、何が起きるかを示します。

- **Taskを作成**：Taskの下書き（タイトル、日付、優先度、ラベル、プロジェクト、Steps、Notes）を示す。
- **Taskへ統合**：統合先の既存Taskと、変更ごとの要約を示す。**差分を表示**でカードの中に正確な変更が開く。
- **除外**：Taskを作らない理由を示す。

各カードを元ノートと比べ、候補漏れ、統合先、除外理由を確認します。**編集**でカードの項目や操作を変えられ、編集したカードは未決に戻ります。別のTaskへ統合したい場合は、Codexでレビューを作り直します。

### 5：TaskMateで判断して反映する

各カードで操作（**作成する**・**統合する**・**除外する**）か、後回しにする**保留する**、または**未決に戻す**を選びます。選んだだけでは何も書き込まれません。

**判断を反映…** を選ぶと、作成・統合・除外の件数、今は反映しない候補、差分を開いていない統合が表示されます。差分を開いていない統合を反映するには、追加の確認にチェックが必要です。**反映する**で、承認した候補が書き込まれます。書き込む前にTaskMateは元ノートと統合先を確かめ直し、変わっていた候補は古くなったものとして止め、もう一度の確認を求めます。

### 6：Obsidianで結果を確認する

- **作成**を反映：`TaskMate/Tasks` にSource付きの新規Taskができる
- **統合**を反映：指定した既存Taskが更新され、重複Taskはできない
- **除外**を反映：Taskはできず、判断と理由がレビューに残る
- 保留または未決の候補があれば、レビューは未レビューの一覧に残る
- ノートの候補がすべて反映されると、そのノートに取り込み履歴が付く。レビューの候補がすべて反映されると、レビューは **TaskMate: レビューを開く** の履歴タブへ移る

レビューを開いただけでは何も反映されず、AI対象にしただけではレビューは作られません。正確な挙動と再試行時の制約は[ソース取り込みFeature](../../engineering/features/source-import.md)を参照してください。
