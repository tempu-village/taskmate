> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

The first Android correction stopped Task lists from scrolling horizontally, but long Task titles are still not presented safely. In the list, two lines render correctly; when a third line appears, the title overlaps the date, Labels, and other metadata. In Add Task and Edit Task, Title is still a single-line field, so a long title can only be reviewed by horizontally scrolling inside the field.

Three operable mobile UI approaches were compared. Variant A was selected: show at most two title lines in the list, reveal an explicit Show full title control only when text is hidden, expand the title in place, and use a visually multi-line auto-growing Title field in Add Task and Edit Task.

## Background

Issue #28 originally addressed a Date-screen Task list that could move sideways when a title exceeded the mobile width. Wrapping and horizontal containment fixed that symptom. Android verification then exposed two follow-up problems:

- A wrapped list title is not height-safe beyond two lines and can overlap the metadata row.
- The Task editor technically preserves the title but does not make a long value readable as a whole because Title uses a one-line input.

The design goal is to preserve a compact list while making hidden text explicit and recoverable. Variant A was selected because two lines keep the list compact, the adjacent disclosure makes hidden content visible and recoverable without leaving the list, and an auto-growing multi-line editor removes horizontal panning while retaining the existing editing flow.

## Requirements

- Keep Task-result regions free from horizontal scrolling caused by Task-row content.
- Never allow a Task title to overlap its date, Labels, Priority, Project, or other metadata, regardless of title length.
- Initially show at most two lines of each Task title.
- Show a localized Show full title control only when text is hidden; do not rely on hover, because the same interaction must work on mobile.
- Expand and collapse the complete title in place by click, tap, and keyboard without opening another surface or navigating horizontally through the text.
- Keep selecting the title itself as the action that opens the Task editor.
- In Add Task and Edit Task, use a visually multi-line auto-growing Title field so a long title is readable and editable without horizontal panning.
- Keep the stored Task title logically single-line by preventing or normalizing entered line breaks; visual wrapping must not change the Markdown schema.
- Preserve Task-title editing, drag, completion, metadata wrapping, and vertical scrolling behavior.
- Apply the final list behavior consistently to Date, Search, and Project Task lists.

## Acceptance criteria

- At a 360 px viewport width, a title of at least three lines never overlaps its metadata.
- At a 360 px viewport width, a long Japanese title and a long unbroken Latin title do not make the Task list horizontally scrollable.
- A title that fits within two lines has no disclosure control; a longer title has Show full title and Collapse title controls that work by touch and keyboard.
- Add Task and Edit Task grow the Title field across visible lines so the complete title can be reviewed and edited without horizontal panning.
- Pressing Enter or pasting multi-line text does not store line breaks in the Task title.
- Date, Search, and Project Task lists use the same title-overflow behavior.
- Automated regression coverage records the selected line, overflow, metadata-separation, and editor rules.

## Verification

- Create one Task with a Japanese title longer than three mobile lines and another with a long string containing no spaces.
- Check the collapsed and expanded list states in Scheduled, All, No date, Search, and a Project Task list at 360 px width.
- Confirm that title text never covers the metadata row and that the list cannot be dragged horizontally.
- Open the same Tasks in Add Task and Edit Task and review/edit the complete title without horizontal panning.
- Verify the chosen reveal control by touch and keyboard.
- Run the repository's required typecheck, unit tests, build, Python behavior tests, skill validation, and `git diff --check`.

## Out of scope

- Changing Task title contents or the Markdown schema.
- Adding a separate full-title dialog or full-screen title editor.
- Redesigning Date tabs, Sort controls, or manual drag ordering.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

最初のAndroid向け修正で横スクロールは解消しましたが、一覧の3行目がメタ情報と重なり、追加・編集画面では長いタイトルを横へ動かさないと読めない問題が残りました。3案を比較した結果、一覧は2行まで表示して必要な場合だけ「全文を見る」でその場に展開し、追加・編集画面は自動で高さが広がる複数行表示のA案を採用しました。

## 背景

> 対応範囲：英語版「Background」の要約

Issue #28は当初、モバイル幅を超えるタスク名によって一覧が横へ動く問題を扱っていました。折り返しと横幅制限後に残った2件を比較検討し、一覧の密度、隠れた内容の分かりやすさ、既存の編集操作との連続性のバランスからA案を選びました。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- タスク行の内容が原因でタスク結果領域が横スクロールしない状態を維持する。
- タスク名の長さにかかわらず、日付、ラベル、優先度、プロジェクトなどのメタ情報と重ならないようにする。
- 各タスク名は最初に最大2行まで表示する。
- 文章が隠れる場合だけ「全文を見る」を表示し、モバイルで使えないホバーに依存しない。
- クリック、タップ、キーボードで別画面へ移らず、その場で全文を展開・折りたたみできるようにする。
- タスク名自体を選ぶ操作は、引き続きタスク編集画面を開く操作とする。
- タスク追加・編集画面では、自動で高さが広がる複数行表示のタイトル欄を使い、横方向の移動を不要にする。
- 入力された改行は禁止または空白へ正規化し、見た目の折り返しによってMarkdown上のタイトル形式を変更しない。
- タスク名からの編集、ドラッグ、完了、メタ情報折り返し、縦スクロールの既存動作を維持する。
- 最終的な一覧動作を日付、検索、プロジェクトの各タスク一覧へ一貫して適用する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 360px幅で3行以上になるタイトルがメタ情報と重ならない。
- 360px幅で長い日本語タイトルと空白のない長い英数字タイトルを表示しても、一覧が横スクロールしない。
- 2行以内のタスク名には展開操作を表示せず、2行を超える場合は「全文を見る」と「折りたたむ」をタッチとキーボードで操作できる。
- タスク追加・編集画面のタイトル欄が見える複数行へ広がり、横へ動かさずに全文を確認・編集できる。
- Enterや複数行の貼り付けによって、タスク名へ改行を保存しない。
- 日付、検索、プロジェクトのタスク一覧が同じタイトル表示規則を使う。
- 採用した行数、続きの表示、メタ情報との分離、編集欄の規則を自動回帰テストへ記録する。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- モバイルで3行を超える日本語タイトルと、空白のない長い文字列のタスクを作成する。
- 360px幅で予定、すべて、日付なし、検索、プロジェクトの折りたたみ・展開状態を確認する。
- タスク名がメタ情報を覆わず、一覧を横へ動かせないことを確認する。
- 同じタスクを追加・編集画面で開き、横方向に移動せずタイトル全文を確認・編集する。
- 採用した全文表示操作をタッチとキーボードで確認する。
- リポジトリ指定の型チェック、ユニットテスト、ビルド、Python動作テスト、Skill検証、`git diff --check`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- タスク名の内容やMarkdownスキーマの変更。
- タイトル全文専用のダイアログや全画面編集画面を追加すること。
- 日付タブ、並べ替え操作、手動ドラッグ順序の再設計。

</details>
