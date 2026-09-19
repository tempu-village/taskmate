# P2: Add an explicit multi-select mode for bulk task actions

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Add a deliberate multi-select mode to task-result lists, with bulk Edit and Delete actions that remain distinct from normal task completion.

## Background

TaskMate must preserve one-tap completion and mobile-sized touch targets. Selection therefore cannot reuse the completion checkbox or remain active while the user navigates to another list. The selected scope must also stay stable while preparing a destructive action.

## Requirements

- Add Select tasks to the task-list Adjust menu.
- Replace the main navigation with Exit, selected count, Select all, Edit, and Delete while selection mode is active.
- Freeze the selection scope to tasks visible when selection mode starts. Select all affects only that scope.
- Replace drag handles with selection checkboxes, hide completion checkboxes, and let the whole task row toggle selection.
- Disable navigation and list-changing controls until selection mode exits.
- Open the existing task editor when exactly one task is selected.
- Open a bulk editor when multiple tasks are selected.
- Let bulk editing preserve, clear, or replace Date, Project, and Priority independently.
- Let bulk editing add and remove Labels without replacing every existing label.
- Confirm bulk deletion with the selected task count and move selected Markdown files to Obsidian's trash.
- Exit selection mode after a successful action. If some files fail, report the partial failure and keep only failed tasks selected.

## Acceptance criteria

- Normal mode still completes a task with one tap and supports manual drag ordering.
- Selection mode is visually distinct and never changes completion accidentally.
- One-item and multi-item Edit follow the specified editors.
- “No change” differs from clearing Date, Project, or Priority.
- Bulk Delete requires confirmation and uses Obsidian trash.
- Select all never includes tasks hidden by the current tab, project, search, or filters.
- Desktop and Android layouts retain usable touch targets and do not overflow.

## Verification

- Test renderer actions for normal and selection modes.
- Test bulk patch construction, especially preserve versus clear and label add/remove.
- Test full success and partial failure for bulk updates and deletion.
- Manually verify Date, Search, and Project detail selection on desktop and Android.
- Run the repository's full validation suite.

## Out of scope

- Bulk Complete / Reopen actions.
- Selection that persists across navigation destinations.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

通常の完了操作と混同しない明示的な複数選択モードを追加し、一括編集と一括削除を提供します。

## 背景

ワンタップ完了とモバイルの操作性を維持するため、選択は完了チェックと分離します。破壊的操作の準備中に対象が消えないよう、選択開始時の表示結果を対象範囲として固定します。

## 要件

- 調整メニューから選択モードを開始する。
- 選択中は上部を解除、件数、すべて選択、編集、削除へ置き換える。
- すべて選択は開始時に表示されていたタスクだけを対象にする。
- ドラッグを選択チェックへ置き換え、完了チェックを隠し、行全体で選択を切り替える。
- 1件は通常編集、複数件は一括編集を使う。
- 日付・プロジェクト・優先度で維持、削除、変更を区別する。
- ラベルは全置換せず追加・削除を指定する。
- 一括削除は件数付き確認後にObsidianのゴミ箱へ移動する。
- 一部失敗時は通知し、失敗対象だけを選択状態に残す。

## 受け入れ条件

- 通常時の完了と手動並べ替えを維持する。
- 選択中に誤って完了状態が変わらない。
- 値の「変更しない」と「消す」が区別される。
- 非表示のタスクをすべて選択へ含めない。
- PCとAndroidで操作領域が崩れない。

## 検証方法

- 通常・選択モード、一括変更、部分失敗をテストする。
- PCとAndroidで日付・検索・プロジェクト内を目視確認する。
- リポジトリの全検証を実行する。

## 対象外

- 一括完了・未完了。
- 画面移動後も選択を維持する機能。

</details>
