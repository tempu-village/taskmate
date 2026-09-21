# P1: Fix title disclosure eligibility and two-line clipping

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

After the Issue #28 Variant A implementation, two title-display defects remain on mobile:

- `Show full title` can appear even when a title fits without hidden content.
- A title that occupies two lines can look clipped at the bottom, and the title control has a pill-like rounded appearance that makes it look like an input box.

The implementation measures a dedicated inner title-text element, reserves two complete line boxes, and resets the outer title action to an explicit rectangular shape.

## Background

Variant A should disclose extra text only when the two-line collapsed layout actually hides content. A title's character count is not a reliable proxy because wrapping depends on viewport width, font metrics, and language. The current visual clipping suggests that the collapsed height, line-height, or button styles are not aligned with the two-line layout. The title action should read as a rectangular task-title control, not as a rounded text field.

## Requirements

- Show `Show full title` only when the rendered title has content hidden beyond the two-line collapsed layout.
- Do not show the disclosure for a one-line title or a fully visible two-line title.
- Ensure both visible title lines have enough computed height and line-height that their glyphs are not clipped.
- Keep the title action rectangular and clearly separate from the metadata; do not use an oval or pill-shaped text-box appearance.
- Keep the disclosure control separate from the title action and make it available by touch and keyboard.
- Preserve in-place expand/collapse, title-to-editor activation, metadata placement, horizontal-overflow prevention, and the multi-line editor from Issue #28.
- Apply the correction consistently to Date, Search, and Project Task lists.

## Acceptance criteria

- A one-line title has no disclosure control and no clipped glyphs.
- A title that fits exactly within two lines has no disclosure control and both lines are fully readable.
- A title that exceeds two lines has a disclosure control, and expanding it reveals the complete title without overlap.
- The title control has a rectangular, non-pill shape at 360 px mobile width.
- Japanese and unbroken Latin titles behave consistently.
- The task list does not become horizontally scrollable.
- Automated tests cover disclosure eligibility and the title's two-line layout rules.

## Verification

- Create short one-line, exactly-two-line, and three-or-more-line Japanese titles.
- Repeat with a long unbroken Latin title.
- Check Scheduled, All, No date, Search, and Project Task lists at mobile width.
- Confirm only titles with hidden content show `Show full title`.
- Confirm both lines of a two-line title are completely visible and the title control is rectangular.
- Expand and collapse a long title by touch and keyboard, then open the editor from the title.
- Run the repository's required typecheck, unit tests, build, Python behavior tests, skill validation, and `git diff --check`.

## Implementation status

- Implemented in the Issue #28 working branch.
- Automated tests cover one-line, exactly-two-line, and overflowing title measurements as separate states.
- Android visual verification remains required before closing the Issue.

## Out of scope

- Changing Task title contents or the Markdown schema.
- Replacing Variant A with a different list-density strategy.
- Redesigning Date tabs, sorting, metadata, or manual drag ordering.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

Issue #28のA案実装後、モバイル表示に2つの問題が残っています。本文が1行に収まる場合にも「全文を見る」が表示されること、2行のタイトルが下端で切れて見えること、さらにタイトル操作が楕円形の入力欄のように見えることです。実装では内側のタイトル文字列を測定対象として分離し、完全な2行分の高さと矩形の外側操作を設けます。

## 背景

「全文を見る」は、2行に折りたたんだ表示で実際に隠れる内容がある場合だけ必要です。文字数だけでは画面幅、フォント、言語による折り返しを判断できません。現在の切れ方は、折りたたみ時の高さ、行の高さ、ボタンのスタイルが2行表示と一致していない可能性があります。タイトル操作は丸い入力欄ではなく、矩形のタスク名操作として見えるべきです。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 2行に折りたたんだ表示より後ろに実際に隠れた内容がある場合だけ「全文を見る」を表示する。
- 1行のタイトルや、2行に完全に収まるタイトルには展開操作を表示しない。
- 表示中の2行が文字の下端で切れないよう、高さと行の高さを調整する。
- タイトル操作は矩形にし、メタ情報と分離する。楕円やピル状の入力欄にはしない。
- 展開操作はタイトル操作と分離し、タッチとキーボードで使えるようにする。
- その場での展開・折りたたみ、タイトルから編集画面を開く操作、メタ情報の位置、横スクロール防止、Issue #28の複数行編集欄を維持する。
- 日付、検索、プロジェクトの各タスク一覧へ一貫して適用する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 1行のタイトルに展開操作が表示されず、文字も切れない。
- 2行に完全に収まるタイトルに展開操作が表示されず、2行とも全文を読める。
- 2行を超えるタイトルには展開操作が表示され、展開すると重なりなく全文を読める。
- 360px幅でタイトル操作が矩形になり、楕円やピル状に見えない。
- 日本語と空白のない英数字で同じように動作する。
- タスク一覧が横スクロールしない。
- 展開の判定と2行表示の規則を自動テストで確認する。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 1行、ちょうど2行、3行以上になる日本語タイトルを作成する。
- 空白のない長い英数字でも繰り返す。
- モバイル幅で予定、すべて、日付なし、検索、プロジェクトの一覧を確認する。
- 隠れた内容があるタイトルだけに「全文を見る」が表示されることを確認する。
- 2行タイトルの文字が欠けず、タイトル操作が矩形であることを確認する。
- 長いタイトルをタッチとキーボードで展開・折りたたみし、タイトル操作から編集画面を開く。
- リポジトリ指定の型チェック、ユニットテスト、ビルド、Python動作テスト、Skill検証、`git diff --check`を実行する。

## 実装状況

> 対応範囲：英語版「Implementation status」の全項目

- Issue #28の作業ブランチへ実装済み。
- 1行、ちょうど2行、はみ出すタイトルの測定状態を個別に自動テストで確認する。
- Issueを閉じる前にAndroidでの目視確認が必要。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- タスク名の内容やMarkdownスキーマの変更。
- A案とは別の一覧密度の方式へ変更すること。
- 日付タブ、並べ替え、メタ情報、手動ドラッグ順序の再設計。

</details>
