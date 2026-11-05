# Navigation, filtering and sorting

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

The main navigation has three destinations: Date, Search, and Projects. Filter is not a destination; it modifies the Task list currently being viewed.

### Date

The Date screen has three Smart views in this order:

1. Scheduled: every Task (incomplete by default) with a date.
2. All: every Task (incomplete by default), whether or not it has a date.
3. No date: every Task (incomplete by default) without a date.

Scheduled includes overdue Tasks and divides the list into Overdue, Today, and Later. Today receives a visible accent so immediate work is easy to recognize without requiring a separate Today view.

### Search

Search matches Task titles, notes, Step text, and Labels. Project names are also available as a search path to their Tasks. Up to ten recent search terms are offered for reuse and can be cleared.

### Filter

Filter narrows the currently displayed Date, Search, or Project Task set by any combination of Priority, Label, and completion state. The processing order is:

1. Resolve the current screen's Task set.
2. Apply the shared active filters.
3. Apply the selected sort order.
4. Render the result.

Active filters remain in effect while navigating between Task-result screens. The Adjust control shows their count. When filters are active, Clear filters is available directly in the Adjust menu and removes only view state; it never changes Task data.

Selected Labels match any selected label; Priority and Label filters combine. Priority is optional: P1 is highest, followed by P2 and P3.

### Deadlines

Scheduled, Unplanned, Date sorting and the Overdue/Today/Later sections follow only the scheduled `date`. A Task with only a `deadline` therefore appears in Unplanned. Every Task row with a deadline shows it as a separate `Deadline` item; while the Task is incomplete and the deadline is before today, the item reads `Deadline passed` and is emphasized, regardless of the scheduled date. A deadline due today is also emphasized.

### Sorting

Task lists support Manual, Date, Priority, and Created sorting. Selecting an already active automatic sort toggles ascending and descending order; the active button displays the direction.

Task rows do not reserve horizontal space for visible drag handles. In Manual sorting, dragging the Task content reorders it directly, with a 250 ms hold required on touch devices. Checkbox and auxiliary controls retain their own actions. Multiple selection begins through the explicit Select Tasks action rather than a long press, and automatic sorting disables Task dragging.

While a Task is being dragged in Manual sorting, holding the pointer near the top or bottom edge of the Task result region scrolls that region vertically. Each edge zone is 30% of the region height, up to 192 CSS px. Speed starts at 200 CSS px/s on entry, grows linearly toward the edge, and reaches its 1000 CSS px/s cap 20 px before the edge. Movement is based on elapsed time, continues while the pointer stays still in a zone, and stops in the neutral middle, at the scroll limit, or when the drag ends. The page outside the Task result region does not scroll. After the drop is saved, the list keeps the scroll position at which the Task was dropped. Releasing the Task outside the Task result region cancels the move and returns it to its original position.

Scheduled keeps its section order fixed as Overdue, Today, and Later. Sections come from Task dates and Manual dragging changes only the manual rank, so a Task can be dragged only within its own section; a drop in another section returns it to its original position. Date sorting changes the task order within each section, and the interface explains this scope while Date sorting is active.

Manual order is one global sequence shared across Smart views and other Task lists. Dragging changes that sequence only in Manual sorting. Within one date, Date sorting puts untimed Tasks first and timed Tasks by time ([Timed and recurring Tasks](timed-and-recurring-tasks.md)). Date, Priority, and Created sorting are display-only and do not rewrite the stored manual rank.

## Acceptance and evidence

- LIST-01: Clear filters changes view state only; include-completed can expose completed Tasks.
- LIST-02: Automatic sorting leaves manual ranks unchanged; Scheduled section order stays fixed.
- LIST-03: Search includes Step text and returns full-title matches beyond the displayed prefix.
- LIST-04: Manual-sort dragging auto-scrolls the Task result region only inside its edge zones, with capped, elapsed-time-based speed and cleanup on drop.
- LIST-05: Scheduled grouping follows `date`; missed-deadline state follows `deadline` and survives rescheduling.

Automated evidence: [domain.test.ts](../../../test/tasks/domain.test.ts), [task-filter-state.test.ts](../../../test/task-list/task-filter-state.test.ts), [task-list-model.test.ts](../../../test/task-list/task-list-model.test.ts), [drag-auto-scroll.test.ts](../../../test/task-list/drag-auto-scroll.test.ts), [task-list-renderer.test.ts](../../../test/task-list/task-list-renderer.test.ts). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md).

## Related RFCs

- [RFC 0015: Simplify date views and add completed-task filtering](../rfcs/0015-simplify-date-views-and-filter-completed-tasks.md) — implemented.
- [RFC 0018: Apply filters to the current task list](../rfcs/0018-apply-filters-to-current-task-list.md) — implemented.
- [RFC 0027: Explain Scheduled view date-sort scope](../rfcs/0027-scheduled-date-sort-ignores-section-order.md) — implemented.
- [Add edge auto-scroll to Manual Task reordering](../rfcs/add-edge-auto-scroll-to-manual-task-reordering.md) — implemented; Android calibration pending.
- [Improve sorting controls and task editor sizing](../rfcs/improve-sorting-and-task-editor-sizing.md) — implemented historical design.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

メインナビゲーションには、日付、検索、プロジェクトの三つがあります。フィルターは移動先ではなく、現在表示中のタスク一覧を修飾します。

### 日付

日付画面には、次の順序で三つのスマートビューがあります。

1. 予定：日付があるタスク（初期状態では未完了のみ）。
2. すべて：日付の有無を問わないタスク（初期状態では未完了のみ）。
3. 日付なし：日付がないタスク（初期状態では未完了のみ）。

予定には期限切れタスクも含め、一覧を期限切れ、今日、今後に分けます。独立した「今日」ビューを設けなくても直近の作業を認識しやすいよう、今日には明確なアクセントを付けます。

### 検索

検索は、タスク名、メモ、ステップ本文、ラベルを対象にします。プロジェクト名から、そのタスクへたどることもできます。最近使った検索語を最大10件再利用でき、履歴は消去できます。

### フィルター

フィルターは、現在表示中の日付、検索、プロジェクトのタスク集合を、優先度、ラベル、完了状態の任意の組み合わせで絞り込みます。処理順は次のとおりです。

1. 現在の画面が対象とするタスク集合を求めます。
2. 共有中の有効なフィルターを適用します。
3. 選択中の並べ替えを適用します。
4. 結果を描画します。

有効なフィルターは、タスク結果画面の間を移動しても保持します。「調整」には有効条件数を表示します。フィルターが有効な場合、「フィルターを解除」を調整メニューから直接利用でき、表示状態だけを解除します。タスクデータは変更しません。

選択ラベルのいずれかに一致するタスクを表示し、優先度条件とは組み合わせます。優先度は任意でP1、P2、P3の順です。

### 締め切り

予定・未計画・日付の並べ替え・期限切れ/今日/明日以降の区分は、予定日`date`だけに従います。そのため`deadline`だけを持つタスクは未計画に表示されます。締め切りのあるタスク行には、予定日とは別の「締め切り」項目を表示します。未完了で締め切りが今日より前なら、予定日に関係なく「締め切り超過」と強調表示します。今日が締め切りの場合も強調します。

### 並べ替え

タスク一覧は、手動、日付、優先度、作成日の並べ替えに対応します。有効な自動並べ替えをもう一度選ぶと昇順と降順が切り替わり、有効なボタンに方向を表示します。

タスク行には、横幅を消費する見えるドラッグハンドルを置きません。手動順ではタスク本文を直接ドラッグして並べ替え、タッチ端末では250ミリ秒の長押しを必要とします。チェックボックスと補助操作はそれぞれ固有の操作を維持します。複数選択は長押しではなく、明示的な「タスクを選択」操作から開始し、自動並べ替え中はタスクのドラッグを無効にします。

手動順でタスクをドラッグ中に、指やポインターをタスク結果領域の上端・下端付近に置くと、その領域が縦にスクロールします。端の感知領域は領域の高さの30%（最大192 CSS px）です。入った直後は200 CSS px/sで動き出し、端に近づくほど直線的に速くなり、端の20px手前で最大1000 CSS px/sに達します。移動量は経過時間で計算し、感知領域内で指を止めても続き、中央へ戻す、スクロール端に達する、ドラッグを終えると止まります。タスク結果領域の外側の画面はスクロールしません。ドロップを保存した後も、ドロップした時点のスクロール位置を保ちます。タスク結果領域の外で離すと移動を取り消し、元の位置に戻します。

予定ビューでは、期限切れ、今日、明日以降のセクション順を固定します。日付順は各セクション内のタスク順を変更し、日付順が有効な間は画面にこの適用範囲を説明します。セクションはタスクの日付で決まり、手動のドラッグで変わるのは手動順位だけなので、タスクは自分のセクションの中でだけドラッグできます。別のセクションでドロップすると元の位置に戻します。

手動順は、スマートビューや他のタスク一覧をまたいで共有する一つの並びです。ドラッグは手動並べ替えのときだけ、この並びを変更します。日付の並べ替えでは、同じ日の中で時刻なしを先に、時刻ありを時刻順に並べます。日付、優先度、作成日の並べ替えは表示だけに作用し、保存済みの手動順位を書き換えません。

### 受け入れ条件

- LIST-01: フィルター解除は表示状態だけを変え、完了済みも表示できる。
- LIST-02: 自動並べ替えで手動順位を書き換えず、予定のセクション順を固定する。
- LIST-03: ステップ本文と省略部分を含む全文タイトルで検索できる。
- LIST-04: 手動順のドラッグ中、タスク結果領域の端の感知領域内だけで、上限付き・経過時間ベースの自動スクロールを行い、ドロップで停止する。
- LIST-05: 予定の区分は`date`、締め切り超過の状態は`deadline`に従い、予定日を変えても超過表示は消えない。
