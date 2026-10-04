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

### Sorting

Task lists support Manual, Date, Priority, and Created sorting. Selecting an already active automatic sort toggles ascending and descending order; the active button displays the direction.

Task rows do not reserve horizontal space for visible drag handles. In Manual sorting, dragging the Task content reorders it directly, with a 250 ms hold required on touch devices. Checkbox and auxiliary controls retain their own actions. Multiple selection begins through the explicit Select Tasks action rather than a long press, and automatic sorting disables Task dragging.

Scheduled keeps its section order fixed as Overdue, Today, and Later. Date sorting changes the task order within each section, and the interface explains this scope while Date sorting is active.

Manual order is one global sequence shared across Smart views and other Task lists. Dragging changes that sequence only in Manual sorting. Date, Priority, and Created sorting are display-only and do not rewrite the stored manual rank.

## Acceptance and evidence

- LIST-01: Clear filters changes view state only; include-completed can expose completed Tasks.
- LIST-02: Automatic sorting leaves manual ranks unchanged; Scheduled section order stays fixed.
- LIST-03: Search includes Step text and returns full-title matches beyond the displayed prefix.

Automated evidence: [domain.test.ts](../../../test/domain.test.ts), [task-filter-state.test.ts](../../../test/task-filter-state.test.ts), [task-list-model.test.ts](../../../test/task-list-model.test.ts). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md).

## Related RFCs

- [RFC 0015: Simplify date views and add completed-task filtering](../rfcs/0015-simplify-date-views-and-filter-completed-tasks.md) — implemented.
- [RFC 0018: Apply filters to the current task list](../rfcs/0018-apply-filters-to-current-task-list.md) — implemented.
- [RFC 0027: Explain Scheduled view date-sort scope](../rfcs/0027-scheduled-date-sort-ignores-section-order.md) — implemented.
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

### 並べ替え

タスク一覧は、手動、日付、優先度、作成日の並べ替えに対応します。有効な自動並べ替えをもう一度選ぶと昇順と降順が切り替わり、有効なボタンに方向を表示します。

タスク行には、横幅を消費する見えるドラッグハンドルを置きません。手動順ではタスク本文を直接ドラッグして並べ替え、タッチ端末では250ミリ秒の長押しを必要とします。チェックボックスと補助操作はそれぞれ固有の操作を維持します。複数選択は長押しではなく、明示的な「タスクを選択」操作から開始し、自動並べ替え中はタスクのドラッグを無効にします。

予定ビューでは、期限切れ、今日、明日以降のセクション順を固定します。日付順は各セクション内のタスク順を変更し、日付順が有効な間は画面にこの適用範囲を説明します。

手動順は、スマートビューや他のタスク一覧をまたいで共有する一つの並びです。ドラッグは手動並べ替えのときだけ、この並びを変更します。日付、優先度、作成日の並べ替えは表示だけに作用し、保存済みの手動順位を書き換えません。

### 受け入れ条件

- LIST-01: フィルター解除は表示状態だけを変え、完了済みも表示できる。
- LIST-02: 自動並べ替えで手動順位を書き換えず、予定のセクション順を固定する。
- LIST-03: ステップ本文と省略部分を含む全文タイトルで検索できる。
