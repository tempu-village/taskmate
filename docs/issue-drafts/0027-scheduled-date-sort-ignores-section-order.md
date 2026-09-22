# P2: Explain Scheduled view date-sort scope

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

The Scheduled view intentionally keeps Overdue, Today, and Later in a fixed order, but it does not explain that Date sorting applies only within each section. This can make the direction control appear ineffective when each section contains only one task.

## Background

The Scheduled view currently groups tasks into fixed `overdue`, `today`, and `later` sections before sorting each section. As a result, Date sorting is applied only inside each section, while the section order remains fixed. This differs from the flat list used by All and makes the Date sort direction appear ineffective when overdue tasks exist.

## Requirements

- Keep the Scheduled sections in the fixed Overdue, Today, and Later order.
- While Date sorting is active in Scheduled, explain that it applies within each section.
- Add a regression test for the fixed section order and the selected direction within each section.
- Keep the Scheduled view definition unchanged: it includes every incomplete task with a date, including overdue, today, and future tasks.
- Do not change manual rank or persist automatic sorting changes to task files.

## Acceptance criteria

- Repeatedly activating Date in Scheduled changes the task order within sections that contain multiple dates.
- The same task set in All continues to sort by Date in both directions.
- Overdue, Today, and Later remain in their fixed order.
- A persistent, mobile-safe explanation of the Date-sort scope appears while Date sorting is active in Scheduled.
- A regression test covers multiple overdue and future tasks as well as a task due today.

## Verification

- Create at least one overdue, one today, and one future incomplete task.
- Open Scheduled and activate Date repeatedly, recording the visible order and direction indicator.
- Open All and perform the same actions.
- Repeat with no overdue task and with multiple tasks in each date category.
- Run the repository's required typecheck, unit tests, build, Python behavior tests, skill validation, and `git diff --check` after implementation.

## Out of scope

- Changing the definitions of Scheduled, All, or No date.
- Changing task dates, manual ranks, or the storage schema.
- Implementing a new grouping feature before the intended sorting contract is confirmed.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

予定ビューは意図どおり期限切れ、今日、明日以降の順を固定していますが、日付順が各セクション内だけに適用されることを説明していません。各セクションにタスクが1件しかない場合、方向の切り替えが効いていないように見えます。

## 背景

> 対応範囲：英語版「Background」の要約

現在の予定ビューは、期限切れ・今日・明日以降へ分けた後、それぞれのセクション内だけを並べ替えています。そのためセクションの順番は固定され、日付順の方向を変えても期限切れが先頭に残ります。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 予定ビューのセクションを、期限切れ、今日、明日以降の固定順に保つ。
- 予定ビューで日付順が有効な間、各セクション内に適用されることを説明する。
- 固定セクション順と、各セクション内で選択した方向が反映されることを回帰テストにする。
- 予定ビューの定義（期限切れ・今日・未来を含む、日付付き未完了タスク）を変更しない。
- 手動順位を変更せず、自動並べ替えをタスクファイルへ保存しない。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 予定ビューで日付順を繰り返し押すと、複数の日付を含むセクション内のタスク順が変化する。
- すべてビューでは、これまでどおり日付順の両方向が動作する。
- 期限切れ、今日、明日以降は固定順を保つ。
- 予定ビューで日付順が有効な間、日付順の適用範囲を説明する常設のモバイル対応表示がある。
- 複数の期限切れ・未来タスクと、今日のタスクを含む回帰テストがある。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 期限切れ、今日、未来の日付を持つ未完了タスクを各1件以上作る。
- 予定ビューで日付順を繰り返し押し、表示順と方向表示を記録する。
- すべてビューでも同じ操作を行う。
- 期限切れタスクがない場合と、各カテゴリに複数タスクがある場合も確認する。
- 実装後に、型チェック、ユニットテスト、ビルド、Python動作テスト、Skill検証、`git diff --check`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- 予定・すべて・日付なしの定義変更。
- タスクの日付、手動順位、保存スキーマの変更。
- 日付順の契約を確定する前の新しいグループ化機能の実装。

</details>
