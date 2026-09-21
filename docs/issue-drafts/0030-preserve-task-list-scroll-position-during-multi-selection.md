# P1: Preserve Task-list scroll position during multi-selection

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Selecting or deselecting a Task in multi-select mode currently rebuilds the TaskMate view and returns the Task list to the top. In a long list, selecting several Tasks near the bottom therefore requires repeatedly scrolling back to the same location.

## Background

The selection action updates `selectedTaskIds` and calls the normal full-view render path so the row state, selection count, and bulk-action availability stay synchronized. That render replaces the scroll-region element. Because its previous `scrollTop` is neither captured nor restored, the replacement starts at the top.

Selection-only state changes should preserve the current list position. Navigation, changing screens, and opening a different list should retain their existing behavior and must not inherit an unrelated scroll position.

## Requirements

- Capture the active Task-result region's vertical scroll position before a selection-only render.
- Restore that position to the replacement Task-result region after the render completes.
- Preserve position when entering selection mode, selecting or deselecting a Task, using Select all, and leaving selection mode.
- Keep the selection count, selected-row styling, and Edit/Delete availability synchronized.
- Do not persist scroll position to settings or Task files.
- Do not carry a Date-list position into Search, Projects, or another navigation destination.
- Keep existing filtering, sorting, and frozen selection-scope behavior unchanged.

## Acceptance criteria

- In a list long enough to scroll, selecting a Task near the bottom does not move the list to the top.
- Selecting and deselecting several visible Tasks keeps the same list area visible.
- Select all and leaving selection mode do not unexpectedly reset the list position.
- Moving to another main screen continues to show that screen's normal initial position.
- An automated regression test covers capture, scroll-region replacement, and restoration.

## Verification

- Create enough Tasks to require vertical scrolling.
- Scroll near the bottom, enter selection mode, and select and deselect several Tasks.
- Use Select all and then leave selection mode.
- Repeat in Date, Search results, and a Project Task list.
- Navigate between main screens and confirm a previous screen's position is not applied to another screen.
- Run the repository's required typecheck, unit tests, build, Python behavior tests, skill validation, and `git diff --check`.

## Out of scope

- Persisting scroll position across Obsidian restarts.
- Remembering separate long-term positions for every Smart view, Search query, or Project.
- Replacing the current full-view render architecture.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

複数選択モードでタスクを選択・解除するたびにTaskMate画面が再構築され、タスク一覧が先頭へ戻ります。長い一覧の下側で複数タスクを選ぶ場合、同じ場所まで何度もスクロールし直す必要があります。

## 背景

> 対応範囲：英語版「Background」の要約

選択状態、選択件数、一括操作ボタンを同期するため、現在は選択のたびに通常の画面全体再描画を実行しています。この処理でスクロール要素が置き換わりますが、以前の`scrollTop`を保存・復元していないため、新しい要素が先頭から始まります。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 選択状態だけを変更する再描画前に、現在のタスク結果領域の縦スクロール位置を取得する。
- 再描画完了後、置き換えられたタスク結果領域へ同じ位置を復元する。
- 選択モード開始、タスクの選択・解除、すべて選択、選択モード終了で位置を維持する。
- 選択件数、選択行の表示、編集・削除ボタンの有効状態を同期したままにする。
- スクロール位置を設定やタスクファイルへ永続化しない。
- 日付一覧の位置を検索、プロジェクト、別のナビゲーション先へ引き継がない。
- 既存のフィルター、並べ替え、固定された選択対象範囲の動作を変更しない。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 縦スクロールが必要な一覧の下側でタスクを選択しても、一覧の先頭へ移動しない。
- 表示中の複数タスクを選択・解除しても、同じ一覧領域が表示されたままになる。
- すべて選択と選択モード終了でも、一覧位置が意図せず先頭へ戻らない。
- 別のメイン画面へ移動した場合は、別画面へ以前の一覧位置を適用しない。
- 位置の取得、スクロール領域の置き換え、復元を回帰テストで確認する。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 縦スクロールが必要な件数のタスクを作成する。
- 一覧の下側までスクロールして選択モードへ入り、複数タスクの選択と解除を行う。
- すべて選択を使用し、その後選択モードを終了する。
- 日付、検索結果、プロジェクトのタスク一覧で繰り返す。
- メイン画面間を移動し、以前の画面の位置が別画面へ適用されないことを確認する。
- リポジトリ指定の型チェック、ユニットテスト、ビルド、Python動作テスト、Skill検証、`git diff --check`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- Obsidian再起動後までスクロール位置を保存すること。
- スマートビュー、検索語、プロジェクトごとの長期的な位置記憶。
- 現在の画面全体再描画構造を置き換えること。

</details>
