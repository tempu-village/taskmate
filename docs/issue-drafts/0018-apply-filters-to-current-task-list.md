# P1: Apply filters to the current task list

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Replace the standalone Filter navigation destination with a modal that narrows the task list currently being viewed and composes with its sorting.

## Background

A filter is a modifier of existing results, not a separate destination. The current Filter screen loses the Date, Search, or Project context and cannot naturally combine its result with the list's sort controls. Moving Filter into a sliders-style Adjust menu also simplifies the main navigation to three destinations.

## Requirements

- Remove Filter from the main navigation, leaving Date, Search, and Projects.
- Add a sliders-style Adjust control to Date, Search, and Project detail headers; do not use a gear icon.
- Add Filter and Select tasks entries to the Adjust menu.
- Open Priority, Label, and Completion state controls in a modal with Clear all and Apply actions.
- Resolve the current list, apply filters, apply sorting, and then render.
- Preserve filter state across Date, Search, and Project detail until cleared.
- Show the active-criterion count on the Adjust control.
- When criteria are active, rename the menu action to Change filters and show a separate Clear filters action; hide Clear filters when no criteria are active.
- Clear filters immediately without confirmation, refresh the current list, and show a notice because it changes only reversible view state.
- Apply Include completed consistently to Scheduled, All, No date, Search, and Project results.
- Keep the Projects index unchanged because it is not a task-result list.

## Acceptance criteria

- A user can filter Scheduled tasks to P1 and still sort the result by Created date.
- Search and Project detail results use the same active filter state.
- Active filters are never invisible.
- Clearing all criteria restores the unfiltered current list.
- Active filters can be cleared directly from the Adjust menu without opening the filter modal.
- Clear filters is absent when there is nothing to clear.
- The main navigation contains exactly three destinations.
- Existing mobile keyboard and independent-scroll fixes remain intact.

## Verification

- Test filter semantics for scheduled, unplanned, search, project, and completed tasks.
- Test active-filter counting and persistence across task-result screens.
- Test the conditional Change filters and Clear filters menu actions and the cleared-state notice.
- Manually verify the modal and adjusted lists on desktop and Android.
- Run the repository's full validation suite.

## Out of scope

- Saving named filter presets.
- Different filter state for every navigation destination.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

独立したフィルター画面を廃止し、現在表示中のタスク一覧を絞り込み、既存の並べ替えと組み合わせられるモーダルへ変更します。

## 背景

フィルターは移動先ではなく既存結果への操作です。現在の画面では日付・検索・プロジェクトの文脈が失われます。スライダー型の調整メニューへ移すことで、メインナビゲーションも3項目に簡素化できます。

## 要件

- メインナビゲーションを日付・検索・プロジェクトの3つにする。
- タスク結果画面に歯車ではなくスライダー型の調整ボタンを置く。
- 調整メニューにフィルターとタスク選択を置く。
- 優先度、ラベル、完了状態をモーダルで編集し、すべて解除と適用を提供する。
- 現在の一覧、フィルター、並べ替え、描画の順で処理する。
- 解除まで条件を各タスク結果画面で共有する。
- 有効条件数を調整ボタンに表示する。
- 条件が有効な場合はメニュー項目を「フィルタを変更」にし、別に「フィルタを解除」を表示する。条件がない場合は「フィルタを解除」を表示しない。
- 「フィルタを解除」は確認なしで即時実行し、現在の一覧を更新して通知する。変更するのは元に戻せる表示状態だけとする。
- 完了済み表示を各一覧で一貫して扱う。

## 受け入れ条件

- 予定をP1へ絞り込み、作成日順へ並べ替えられる。
- 検索とプロジェクト詳細にも同じ条件が適用される。
- 条件が有効なことを常に確認できる。
- フィルターモーダルを開かず、調整メニューから有効な条件を直接解除できる。
- 解除する条件がない場合は「フィルタを解除」が表示されない。
- メインナビゲーションが3項目になる。
- Androidのキーボード・スクロール修正を壊さない。

## 検証方法

- 各一覧と完了状態のフィルターをテストする。
- 条件に応じた「フィルタを変更」「フィルタを解除」の表示と、解除後の通知をテストする。
- PCとAndroidでモーダルと一覧を目視確認する。
- リポジトリの全検証を実行する。

## 対象外

- 名前付きフィルタープリセット。
- 画面ごとに別のフィルター状態を保存すること。

</details>
