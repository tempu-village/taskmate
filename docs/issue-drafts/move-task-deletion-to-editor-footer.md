# P2: Move task deletion into the editor action footer

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Remove the redundant task-row overflow menu and move single-task deletion into the existing-task editor. Use the approved footer layout from ADR 0015: an outlined Delete action with a trash icon and visible text on the left, with Cancel and Save grouped on the right.

## Background

Selecting a task title already opens the editor, so the overflow menu's Edit item duplicates an existing action. Deletion currently requires opening that menu, while the editor footer is already the natural location for task-level actions. Three placements were compared. The footer option was selected because it keeps actions together without consuming an additional form section; a header trash icon beside Close was rejected as less intuitive and less discoverable.

## Requirements

- Remove the right-side overflow button from every task row.
- Continue opening the task editor when the task title is selected.
- Show Delete only when editing an existing task; do not show it when creating a task.
- Place Delete on the left side of the editor action footer.
- Keep Cancel and Save grouped on the right side of that footer.
- Render Delete with a trash icon, the visible localized Delete label, a destructive text color, and a visible outline.
- Do not rely on color alone to identify Delete.
- Keep the Delete touch target suitable for Android and other coarse pointers.
- When Delete is activated, show the existing localized confirmation message before changing data.
- On confirmation, use the existing repository deletion behavior so the task Markdown file moves to Obsidian's trash.
- After deletion, close the editor, refresh the visible task list, and show the existing deletion notice.
- Keep repository access and view refresh outside the modal by passing the existing-task editor a deletion callback.
- Update English and Japanese UI catalogs together if a new accessible label or message is required.

## Acceptance criteria

- Task rows have no overflow button and no duplicate Edit command.
- Selecting a task title still opens the editor.
- An existing-task editor shows the outlined trash-icon-and-text Delete action on the footer's left side.
- A new-task editor does not show Delete.
- Cancel and Save remain together on the footer's right side.
- Canceling the confirmation leaves the task unchanged and the editor open.
- Confirming deletion moves the task file to Obsidian's trash, closes the editor, refreshes the list, and shows a notice.
- The footer remains usable without clipping or overlap at desktop and Android widths in English and Japanese.
- Task IDs, Project IDs, Markdown properties, task schema, and deletion semantics remain unchanged.

## Verification

- Verify the task-row title opens the editor and the former overflow button is absent.
- Verify Delete appears for an existing task but not for a new task.
- Verify the icon, visible label, outline, destructive styling, focus state, and touch target in English and Japanese.
- Verify canceling deletion preserves the task.
- Verify confirming deletion moves the Markdown file to Obsidian's trash and refreshes Date, Search, Project, and filtered task results.
- Verify the editor footer on desktop and Android widths.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run the Python behavior tests.
- Run `python3 scripts/validate_skills.py`.
- Run `python3 scripts/validate_localization.py`.
- Run `git diff --check`.

## Out of scope

- Multi-select mode and bulk deletion.
- Moving Filter out of the main navigation.
- Bulk editing of date, labels, Project, or Priority.
- Changing Obsidian trash behavior or permanently deleting task files.
- Changing the rest of the task editor layout.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

重複しているタスク行の3点メニューを削除し、単一タスクの削除を既存タスクの編集画面へ移します。ADR 0015で採用したA案として、フッター左側にゴミ箱アイコン、表示文字、枠を持つ削除操作を置き、右側にキャンセルと保存をまとめます。

## 背景

> 対応範囲：英語版「Background」の要約

タスク名から既に編集画面を開けるため、3点メニューの編集は重複しています。編集画面のフッターはタスク操作を置く既存領域であり、追加の縦領域を使いません。閉じるボタン横のゴミ箱は意味の異なる操作が並び、直感性と発見性が低いため採用しません。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- すべてのタスク行から右側の3点メニューボタンを削除する。
- タスク名を選択すると引き続き編集画面を開く。
- 削除は既存タスクの編集時だけ表示し、新規タスク作成時には表示しない。
- 削除を編集画面の操作フッター左側に置く。
- キャンセルと保存はフッター右側にまとめたままにする。
- 削除にはゴミ箱アイコン、ローカライズされた表示文字、破壊的操作を示す文字色、見える枠を付ける。
- 削除の識別を色だけに依存させない。
- Androidなど粗いポインターでも操作できるタッチ領域を維持する。
- 削除を押したら、データを変更する前に既存のローカライズ済み確認文を表示する。
- 確認後は既存のリポジトリ削除処理を使い、タスクのMarkdownファイルをObsidianのゴミ箱へ移動する。
- 削除後は編集画面を閉じ、表示中のタスク一覧を更新し、既存の削除通知を表示する。
- リポジトリアクセスと画面更新はモーダルの外に保ち、既存タスクの編集画面へ削除コールバックを渡す。
- 新しいアクセシビリティ文言またはメッセージが必要な場合は、英語・日本語UI辞書を同時に更新する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- タスク行に3点メニューがなく、重複した編集操作がない。
- タスク名を選択すると引き続き編集画面が開く。
- 既存タスクの編集画面では、フッター左側に枠付きのゴミ箱アイコン＋文字の削除操作が表示される。
- 新規タスクの編集画面には削除が表示されない。
- キャンセルと保存はフッター右側にまとまっている。
- 削除確認をキャンセルすると、タスクは変更されず編集画面も開いたままになる。
- 削除を確定すると、タスクファイルがObsidianのゴミ箱へ移動し、編集画面が閉じ、一覧が更新され、通知が表示される。
- 英語・日本語のデスクトップ幅とAndroid幅で、フッターに欠けや重なりがなく操作できる。
- Task ID、Project ID、Markdownプロパティ、タスクスキーマ、削除の意味は変わらない。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- タスク名から編集画面を開け、以前の3点メニューがないことを確認する。
- 既存タスクでは削除が表示され、新規タスクでは表示されないことを確認する。
- 英語・日本語で、アイコン、表示文字、枠、破壊的スタイル、フォーカス状態、タッチ領域を確認する。
- 削除確認をキャンセルするとタスクが維持されることを確認する。
- 削除確定でMarkdownファイルがObsidianのゴミ箱へ移動し、日付、検索、プロジェクト、フィルター結果が更新されることを確認する。
- デスクトップ幅とAndroid幅で編集画面のフッターを確認する。
- `npm run typecheck`を実行する。
- `npm test`を実行する。
- `npm run build`を実行する。
- Pythonの振る舞いテストを実行する。
- `python3 scripts/validate_skills.py`を実行する。
- `python3 scripts/validate_localization.py`を実行する。
- `git diff --check`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- 複数選択モードと一括削除。
- フィルターをメインナビゲーションから移動すること。
- 日付、ラベル、Project、Priorityの一括編集。
- Obsidianのゴミ箱動作を変更すること、またはタスクファイルを完全削除すること。
- タスク編集画面のその他のレイアウトを変更すること。

</details>
