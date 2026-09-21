# P2: Scheduled view date sorting does not reorder the overdue section

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

The Scheduled view keeps the overdue section at the top even after the user selects Date sorting and toggles its direction. The All view sorts the same tasks by date as expected.

## Background

The Scheduled view currently groups tasks into fixed `overdue`, `today`, and `later` sections before sorting each section. As a result, Date sorting is applied only inside each section, while the section order remains fixed. This differs from the flat list used by All and makes the Date sort direction appear ineffective when overdue tasks exist.

## Requirements

- Confirm whether Date sorting in Scheduled is intended to order all scheduled tasks globally or only tasks within the existing sections.
- If global sorting is intended, make the selected Date direction determine the order of every scheduled task, including overdue tasks.
- If the sections are intentionally fixed, make the UI and documentation explain that Date sorting applies only within each section and add a regression test for that contract.
- Keep the Scheduled view definition unchanged: it includes every incomplete task with a date, including overdue, today, and future tasks.
- Do not change manual rank or persist automatic sorting changes to task files.

## Acceptance criteria

- Repeatedly activating Date in Scheduled produces an observable ascending/descending change according to the confirmed contract.
- The same task set in All continues to sort by Date in both directions.
- Overdue tasks do not appear permanently first unless the confirmed design explicitly requires fixed section order.
- A regression test covers a Scheduled list containing overdue, today, and future tasks.

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

予定ビューでは、日付順と昇順・降順を切り替えても期限切れセクションが常に先頭に残ります。すべてビューでは同じタスクが日付順に並ぶため、予定ビューだけ並べ替えが効いていないように見えます。

## 背景

> 対応範囲：英語版「Background」の要約

現在の予定ビューは、期限切れ・今日・明日以降へ分けた後、それぞれのセクション内だけを並べ替えています。そのためセクションの順番は固定され、日付順の方向を変えても期限切れが先頭に残ります。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 予定ビューの日付順が、すべての予定タスクを横断して並べ替える仕様か、各セクション内だけを並べ替える仕様かを確認する。
- 全体の日付順が仕様なら、期限切れ・今日・未来を含むすべての予定タスクの順番を日付順の方向に従わせる。
- セクション順を固定する仕様なら、日付順はセクション内だけに適用されることをUIと文書で説明し、その契約を回帰テストにする。
- 予定ビューの定義（期限切れ・今日・未来を含む、日付付き未完了タスク）を変更しない。
- 手動順位を変更せず、自動並べ替えをタスクファイルへ保存しない。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 予定ビューで日付順を繰り返し押すと、確定した仕様に従って昇順・降順の変化が目視できる。
- すべてビューでは、これまでどおり日付順の両方向が動作する。
- 確定した設計で固定セクションが必要でない限り、期限切れタスクが常に先頭へ固定されない。
- 期限切れ・今日・未来を含む予定ビューの回帰テストがある。

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
