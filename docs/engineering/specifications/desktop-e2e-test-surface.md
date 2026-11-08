# Desktop E2E test surface

Status: Current normative contract. This specification lists the plugin names, internal members and DOM markers that the desktop E2E specs in `test/e2e/` depend on. TaskMate has no feature, setting or code path that exists only for E2E tests; the specs drive the shipped plugin through the members below. How the tests run is described in [Desktop E2E tests](../design/desktop-e2e.md).

A change that renames or removes an item in this list MUST update the E2E specs and this specification in the same change.

## Plugin and Obsidian API surface

| Item | Used for |
| --- | --- |
| Plugin id `taskmate`, reached as `plugins.taskmate` in `executeObsidian` | Calling plugin methods |
| Command `taskmate:open-todo-list` | Opening the Task list |
| View types `taskmate-list` and `taskmate-change-review` | Finding views; `app.workspace.openPopoutLeaf()` with `setViewState({ type: "taskmate-list" })` opens the list in a popout window |
| `plugin.openProposalReview(proposalId)` | Opening a Task change Proposal review |
| Vault config `trashOption` (`"local"` or `"none"`) via `app.vault.setConfig` | Choosing Obsidian's Deleted files option; `"system"` is not set because it would move test files into the host's system trash |

## Internal list view members

Obsidian's `Menu` does not open from WebDriver clicks in the E2E window. The specs therefore call the members that the list's Adjust menu items call. These members are TypeScript-private and MUST keep these names and effects:

| Member of the `taskmate-list` view | Effect |
| --- | --- |
| `selection.start(taskIds)` followed by `requestRender()` | Enters selection mode with those Tasks in scope |
| `openLabelManager()` | Opens Manage labels |

## DOM markers

Specs MUST select by these classes, roles and attributes and MUST NOT select by translated text.

| Marker | Meaning |
| --- | --- |
| `.taskmate-smart-views [role='tab']` in the order Scheduled, All, Undated | List tabs |
| `.taskmate-navigation button` in the order Date, Search, Projects | Main navigation |
| `[data-task-id='<id>']` and its `.taskmate-title` | Task row and the control that opens the editor |
| `.taskmate-delete-task` | Delete in the Task editor |
| `.taskmate-selection-toolbar` and its `.mod-warning` button | Selection mode and bulk Delete |
| `.taskmate-label-chip-input`, `[data-taskmate-label-chip]`, `.taskmate-step-body` | Label input, Label chips and Step rows in the editor |
| `.taskmate-label-manager-delete` with an `aria-label` containing the Label | Label delete in Manage labels |
| `.taskmate-project-row`, `.taskmate-project-edit`, `.taskmate-project-editor .mod-warning` | Project list, edit and delete |
| `.taskmate-review`, `.taskmate-review-reject` | Proposal review and Reject |
| A `.modal` whose `.taskmate-modal-actions` holds Cancel first and a `.mod-warning` confirm button second | The shared confirmation modal |

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

この仕様は、`test/e2e/`のデスクトップE2Eが頼っているプラグイン名、内部メンバー、DOMの目印を定めます。TaskMateにはE2Eのためだけの機能・設定・処理はなく、E2Eは出荷するプラグインを下記のメンバー経由で操作します。一覧の項目の名前を変えたり削除したりする変更では、同じ変更でE2Eとこの仕様を更新しなければなりません。

- **プラグインとObsidian API**：プラグインID`taskmate`、コマンド`taskmate:open-todo-list`、ビュー種別`taskmate-list`と`taskmate-change-review`（`openPopoutLeaf()`で別ウィンドウにも開く）、`plugin.openProposalReview(proposalId)`、削除の設定を切り替えるVault設定`trashOption`（`"local"`と`"none"`だけを使います。`"system"`は実行するPCのゴミ箱にテスト用ファイルが入るため使いません）。
- **一覧ビューの内部メンバー**：Obsidianの`Menu`はWebDriverのクリックでは開かないため、「表示とタスクの操作」メニュー項目が呼ぶ`selection.start(taskIds)`と`requestRender()`（選択モード開始）、`openLabelManager()`（ラベル管理）を直接呼びます。TypeScript上はprivateですが、この名前と効果を保たなければなりません。
- **DOMの目印**：タブ（予定・すべて・日付なしの順）、メインナビ（日付・検索・プロジェクトの順）、`data-task-id`、削除ボタン、選択ツールバー、ラベル入力欄とチップ、ステップ行、ラベル管理の削除、プロジェクトの行・編集・削除、レビューと却下、確認モーダル（キャンセルが先、`.mod-warning`の確定が後）。翻訳された文字列では選びません。
