# P1: Bound Task-list title display without layout measurement

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

The rendered-height approach introduced for Issue #28 and refined in Issue #31 still shows `Show full title` for one-line titles on Android and for titles of any rendered height on desktop. Replace that layout-dependent disclosure with deterministic list presentation:

- Task lists show at most the first 100 user-perceived characters of a title.
- A title longer than 100 characters ends with a visible ellipsis.
- The Task editor and stored Markdown retain and show the complete title.

## Background

DOM height comparison is affected by Obsidian button styles, font metrics, layout timing, and platform differences. Unit tests that supplied synthetic element heights verified the comparison helper but did not reproduce the real Obsidian rendering path, so they could not catch the reported false disclosure.

The selected design keeps Variant A's naturally variable row height but gives it a deterministic upper bound. One hundred visible characters provides enough context for normal Task titles while preventing an exceptionally long title from making the list row grow without limit. An ellipsis communicates that the editor contains more text. The list no longer needs a line-count calculation, rendered-height measurement, ResizeObserver, or an inline expansion control.

## Requirements

- In Date, Search, and Project Task lists, display the first 100 user-perceived characters of each title.
- If and only if the complete title exceeds 100 user-perceived characters, append one ellipsis character (`…`) to the list text.
- Do not split an emoji or another extended grapheme cluster when truncating.
- Let the visible list title wrap naturally and let its row height grow with the displayed text; do not impose a fixed line count.
- Remove `Show full title`, `Collapse title`, rendered-height comparison, and resize-based title disclosure.
- Keep the title action rectangular and prevent title or metadata from creating horizontal list scrolling or overlapping each other.
- Keep the complete title unchanged in Task Markdown, search data, actions, and accessible names.
- Selecting the list title continues to open the Task editor.
- In Add Task and Edit Task, show the complete title in the existing auto-growing multi-line field without list truncation.

## Acceptance criteria

- A title of 100 user-perceived characters is displayed completely without an ellipsis.
- A title of 101 user-perceived characters displays the first 100 followed by `…` in every Task-list surface.
- A title ending near a multi-code-point emoji is truncated without displaying a broken character.
- List titles use natural variable height and no title-disclosure button is rendered.
- Opening the truncated title shows the complete unchanged title in the editor.
- Saving without changing the title does not persist the ellipsis or discard hidden characters.
- Long Japanese titles and unbroken Latin titles do not overlap metadata or make a 360 px Task list scroll horizontally.
- Automated tests cover the 100- and 101-character boundaries, grapheme-safe truncation, absence of disclosure controls, and complete editor data.

## Verification

- Create titles containing 99, 100, and 101 Japanese characters and inspect Date, Search, and Project Task lists.
- Repeat with an emoji at the truncation boundary and with an unbroken Latin title.
- Confirm only titles beyond the limit end with `…`.
- Open a truncated title and confirm that the editor shows the complete title.
- Confirm the list has no `Show full title` or `Collapse title` action on desktop or Android.
- Run the repository's required typecheck, unit tests, build, Python behavior tests, Skill validation, and `git diff --check`.

## Implementation status

- Implemented in the Issue #28 working branch.
- Automated tests cover the 100- and 101-character boundaries, an extended emoji grapheme at the boundary, complete accessible text, and removal of disclosure CSS and controls.
- Desktop and Android visual verification remains required before closing the Issue.

## Out of scope

- Limiting the number of characters a user may enter or store in a Task title.
- Making the 100-character list limit configurable.
- Expanding the full title inline from the Task list.
- Changing the Task Markdown schema, date views, sorting, metadata, or manual order.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

Issue #28で導入しIssue #31で調整した高さ測定方式は、Androidでは1行のタイトルにも、PCでは表示行数にかかわらず「全文を見る」を出す問題が残りました。そこで、一覧は見た目上の先頭100文字までを表示し、超過時は末尾へ`…`を付けます。編集画面とMarkdownには全文を維持します。

## 背景

> 対応範囲：英語版「Background」の要約

DOMの高さ比較はObsidianのボタンスタイル、フォント、レイアウト確定時期、端末差の影響を受けます。要素の高さを人工的に指定したテストでは実際のObsidian描画を再現できず、誤表示を検出できませんでした。採用案は、一覧の高さを文字の折り返しに応じて変えながら、表示を100文字までに制限して無制限な縦方向の拡大を防ぎます。省略記号で続きがあることを示し、行数や描画高さの測定、ResizeObserver、一覧内の展開操作を不要にします。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 日付、検索、プロジェクトの各タスク一覧では、タイトルの見た目上の先頭100文字を表示する。
- 完全なタイトルが見た目上の100文字を超える場合に限り、一覧表示の末尾へ省略記号（`…`）を1個付ける。
- 省略時に絵文字などの拡張書記素クラスタを途中で分割しない。
- 表示対象のタイトルは自然に折り返し、文字数に応じて行の高さを変える。固定行数にはしない。
- 「全文を見る」「折りたたむ」、描画高さの比較、サイズ変更を利用したタイトル展開判定を削除する。
- タイトル操作は矩形のままにし、タイトルとメタ情報の横スクロールや重なりを防ぐ。
- Markdown、検索用データ、操作、アクセシブル名では、省略しない完全なタイトルを維持する。
- 一覧のタイトルを選ぶと、従来どおりタスク編集画面を開く。
- タスク追加・編集画面では、一覧用の省略を適用せず、既存の自動拡張する複数行欄に完全なタイトルを表示する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 見た目上の100文字のタイトルは、省略記号なしで全文表示される。
- 見た目上の101文字のタイトルは、すべてのタスク一覧で先頭100文字と`…`を表示する。
- 複数コードポイントで構成される絵文字が境界付近にあっても、壊れた文字を表示しない。
- 一覧タイトルは自然な可変高さを使い、タイトル展開ボタンを描画しない。
- 省略されたタイトルを開くと、編集画面に変更されていない全文を表示する。
- タイトルを変更せずに保存しても、省略記号を保存したり、隠れた文字を失ったりしない。
- 長い日本語タイトルと空白のない英数字タイトルが、メタ情報と重ならず、360px幅の一覧を横スクロールさせない。
- 100文字と101文字の境界、書記素単位の安全な省略、展開操作がないこと、編集データが完全であることを自動テストで確認する。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 99文字、100文字、101文字の日本語タイトルを作り、日付、検索、プロジェクトの各一覧で確認する。
- 省略境界に絵文字があるタイトルと、空白のない長い英数字タイトルでも確認する。
- 上限を超えるタイトルだけが`…`で終わることを確認する。
- 省略されたタイトルを開き、編集画面に全文が表示されることを確認する。
- PCとAndroidの一覧に「全文を見る」や「折りたたむ」が存在しないことを確認する。
- リポジトリ指定の型チェック、ユニットテスト、ビルド、Python動作テスト、Skill検証、`git diff --check`を実行する。

## 実装状況

> 対応範囲：英語版「Implementation status」の全項目

- Issue #28の作業ブランチへ実装済み。
- 100文字と101文字の境界、境界上の拡張絵文字書記素、完全なアクセシブル文字列、展開用CSSと操作の削除を自動テストで確認する。
- Issueを閉じる前にPCとAndroidでの目視確認が必要。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- ユーザーが入力または保存できるタスク名の文字数を制限すること。
- 一覧の100文字制限を設定可能にすること。
- タスク一覧の中でタイトル全文を展開すること。
- タスクMarkdownスキーマ、日付ビュー、並べ替え、メタ情報、手動順序を変更すること。

</details>
