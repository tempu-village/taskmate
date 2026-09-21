# P1: Prevent long Task titles from scrolling mobile lists horizontally

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

On Android, the Date screen's Task list can scroll horizontally when a Task title is wider than the available mobile content width. The Date tabs and Sort controls remain within the viewport, but the Task rows can move sideways.

## Background

This problem was found while verifying Issue #6 at mobile width. Task titles are rendered as full-width buttons inside flexible Task rows, but the title does not explicitly allow normal or unbroken-text wrapping. The vertically scrolling result region also lacks an explicit horizontal-overflow guard. A long title can therefore widen a row and make the result region horizontally scrollable.

The primary correction is to make Task titles wrap within the available row width. Suppressing horizontal overflow is a final containment guard, not a substitute for displaying the complete title.

## Requirements

- Wrap long Task titles within the available Task-row width instead of keeping the title on one line.
- Allow a long string without spaces to break when necessary.
- Keep the Task row, Task body, and result list constrained to the available content width.
- Prevent task-result regions from becoming horizontally scrollable because of Task-row content.
- Preserve the full title; do not truncate it or hide the overflow as the primary behavior.
- Preserve the existing drag handle, completion checkbox, metadata wrapping, title activation, and vertical scrolling behavior.
- Apply the Task-row protection consistently wherever the shared Task list is rendered, not only to the Date screen.

## Acceptance criteria

- At a 360 px viewport width, a long Japanese Task title wraps without horizontal scrolling.
- At a 360 px viewport width, a long unbroken Latin string wraps without horizontal scrolling.
- Date tabs and Sort controls remain within the viewport.
- Drag, complete, open, and vertical-scroll interactions continue to work.
- A regression test records the required wrapping and horizontal-containment rules.

## Verification

- Create a Task with a long Japanese title and another with a long string containing no spaces.
- Open Scheduled, All, and No date in Android Obsidian and attempt to drag the Task list sideways.
- Confirm the same titles in Search results and a Project Task list.
- Confirm the complete title remains readable over multiple lines.
- Run the repository's required typecheck, unit tests, build, Python behavior tests, skill validation, and `git diff --check`.

## Out of scope

- Changing Task title contents or the Markdown schema.
- Truncating titles to one line.
- Redesigning Date tabs or Sort controls.
- Changing manual drag ordering.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

Androidの日付画面で、利用可能な横幅より長いタスク名があると、タスク一覧だけが横スクロールできてしまいます。日付タブと並べ替え操作は画面内に収まっています。

## 背景

> 対応範囲：英語版「Background」の要約

Issue #6のモバイル幅検証中に発見されました。タスク名には折り返しが明示されておらず、縦スクロール領域にも横方向の最終的なはみ出し防止がありません。本修正ではタスク名を画面内で折り返し、横方向の制限は最後の安全策として使用します。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 長いタスク名を1行のまま保持せず、利用可能なタスク行の横幅内で折り返す。
- 空白のない長い文字列も必要な位置で折り返せるようにする。
- タスク行、タスク本文、結果一覧を利用可能なコンテンツ幅以内に収める。
- タスク行の内容が原因でタスク結果領域が横スクロールしないようにする。
- タスク名を省略したり、はみ出した部分を隠したりすることを主要動作にせず、全文を保持する。
- 既存のドラッグハンドル、完了チェック、メタデータ折り返し、タスク名からの編集、縦スクロールを維持する。
- 日付画面だけでなく、共通タスク一覧を使うすべての画面へタスク行の保護を適用する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 360px幅で長い日本語タスク名が折り返され、横スクロールしない。
- 360px幅で空白のない長い英数字が折り返され、横スクロールしない。
- 日付タブと並べ替え操作が画面内に収まる。
- ドラッグ、完了、編集画面を開く操作、縦スクロールが引き続き動作する。
- 必要な折り返しと横方向の制限を回帰テストへ記録する。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 長い日本語タスク名と、空白を含まない長い文字列のタスクを作成する。
- Android版Obsidianの予定・すべて・日付なしを開き、タスク一覧を横へ動かせないことを確認する。
- 検索結果とプロジェクトのタスク一覧でも同じタスク名を確認する。
- タスク名の全文が複数行で読めることを確認する。
- リポジトリ指定の型チェック、ユニットテスト、ビルド、Python動作テスト、Skill検証、`git diff --check`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- タスク名の内容やMarkdownスキーマの変更。
- タスク名を1行へ省略すること。
- 日付タブや並べ替え操作の再設計。
- 手動ドラッグ順序の変更。

</details>
