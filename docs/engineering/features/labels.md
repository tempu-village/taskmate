# Labels

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

A Label is a user-defined cross-project classification attached directly to a Task. TaskMate supports up to 500 distinct Labels.

Choosing Labels from Filter opens a picker with Recent & Favorites and All labels tabs.

- Recent & Favorites shows up to ten favorite Labels.
- A favorite is excluded from the recent section.
- The recent section is filled with up to ten other recently used Labels when available.
- The tab therefore presents up to twenty distinct suggestions without duplicates.
- Favorites are ordered by most recently favorited, limited to ten, and are never evicted automatically.
- A row selects or deselects a Label for the filter. Selection uses both styling and a check mark.
- A separate star changes the draft favorite state without changing filter selection.
- Confirm selection commits both drafts to the parent Filter dialog. Closing or cancelling the picker discards both kinds of pending change.

All labels provides search and a fixed top index. The index contains only groups that have results: populated Latin initials, Japanese, and numbers-and-symbols. Only the Label results scroll; the index remains available.

With completed Tasks excluded, the picker shows only Labels assigned to at least one incomplete Task. When completed Tasks are included, Labels used only by completed Tasks can also appear. Hidden history and favorites remain stored and can reappear when they become eligible again.

Manage labels in the Adjust menu searches the union of Labels attached to Tasks, recent Labels, and favorites. Each Label shows its Task count; a value kept only by recent or favorite storage is marked Stored only.

Renaming replaces the Label on every affected Task, including completed Tasks, and updates recent Labels, favorites, and active filters. Renaming into an existing Label merges the two without creating duplicates. Deleting requires confirmation with the affected count, removes the Label from Tasks and saved UI state, and never deletes a Task. A partial file-write failure identifies the failed Task files instead of reporting complete success.

The editor uses a chip-based Label input instead of permanently displaying recent-Label suggestions. Selected Labels are removable chips followed by a persistent text input. Pending text becomes a Label through the visible Add action, Enter after IME composition has ended, or an ASCII comma; confirmation keeps the input focused when possible so Japanese Labels can be entered continuously on desktop and mobile. The input and labeled Add action are separate bordered controls on one row, making the type-then-add sequence visible even before focus. On narrow screens, the labeled Choose action moves to a full-width row below them. Save also commits non-empty pending text. At most three chips are initially visible, with the localized overflow control revealing the rest. Choose opens the same indexed multi-select Label picker used by Filter and offers Labels attached to any current Task. Pending text and newly typed draft Labels survive picker use. Confirming the picker updates only the editor draft, while closing or canceling it discards picker changes. Saving a Task updates recent Label history.

Task rows and the editor initially show up to three selected Labels. If more exist, a localized N more control reveals every remaining Label by click, tap, or keyboard and can collapse the expanded set again. Expanding this summary changes presentation only and never saves the Task.

## Acceptance and evidence

- LABEL-01: Confirm commits picker drafts; cancel discards them.
- LABEL-02: Renaming into an existing label merges membership; deletion keeps Tasks.
- LABEL-03: Favorite/recent suggestions contain no duplicate labels; input survives picker use.

Automated evidence: [label-picker-model.test.ts](../../../test/label-picker-model.test.ts), [label-chip-input.test.ts](../../../test/label-chip-input.test.ts), [label-management.test.ts](../../../test/label-management.test.ts), [label-summary.test.ts](../../../test/label-summary.test.ts). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task schema](../../../skills/taskmate/references/task-schema.md).

## Related RFCs

- [RFC 0025: Reuse the Label picker in the Task editor](../rfcs/0025-reuse-label-picker-in-task-editor.md) — implemented.
- [RFC 0026: Use one focus ring for the Label input](../rfcs/0026-use-one-focus-ring-for-task-editor-label-input.md) — superseded in detail by the current chip-input boundary; retained as history.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

ラベルは、タスクへ直接付ける、プロジェクトをまたいだユーザー定義の分類です。TaskMateは最大500種類のラベルに対応します。

フィルターでラベルを選ぶと、「最近・お気に入り」と「すべてのラベル」のタブを持つ選択画面を開きます。

- 「最近・お気に入り」には、お気に入りラベルを最大10件表示します。
- お気に入りラベルは、最近使用したラベル欄から除外します。
- 最近使用したラベル欄は、利用可能であれば別のラベルで最大10件まで補います。
- したがって、このタブには重複なしで最大20件の候補を表示します。
- お気に入りは、直近にお気に入り登録した順に並べ、最大10件とし、自動では追い出しません。
- 行を操作すると、フィルター対象のラベルを選択または選択解除します。選択状態は、色だけでなくチェックマークでも示します。
- 独立した星を操作すると、フィルター選択を変えずにお気に入りの下書き状態を切り替えます。
- 「選択を確定」で両方の下書きを親のフィルターダイアログへ反映します。ラベル選択画面を閉じるかキャンセルすると、どちらの未確定変更も破棄します。

「すべてのラベル」には、検索と上部固定の索引を設けます。索引には、結果が存在するラテン文字の頭文字、日本語、数字・記号のグループだけを表示します。ラベル結果だけをスクロールし、索引は利用できる状態を保ちます。

完了済みタスクを除外している場合、少なくとも一つの未完了タスクに付いているラベルだけを表示します。完了済みタスクを含める場合は、完了済みタスクだけに使われているラベルも表示できます。非表示の履歴とお気に入りは保存したままとし、再び対象になれば表示します。

「調整」メニューの「ラベル管理」では、タスクに付いたラベル、最近使ったラベル、お気に入りの和集合を検索できます。各ラベルには対象タスク件数を表示し、履歴またはお気に入りだけに残る値は「保存のみ」と示します。

名前変更は完了済みを含むすべての対象タスクでラベルを置き換え、履歴、お気に入り、有効なフィルターも更新します。既存ラベルへの名前変更は重複させずに統合します。削除は対象件数を示して確認し、タスクと保存済みUI状態からラベルを外しますが、タスク自体は削除しません。一部のファイル書き込みに失敗した場合、完全成功として扱わず、失敗したタスクファイルを示します。

編集画面では、最近使ったラベルを常時並べる代わりに、チップ方式でラベルを入力します。選択済みラベルは個別に削除できるチップになり、その末尾に入力欄を常設します。入力途中の文字は、文字付きの追加操作、IME変換終了後のEnter、または半角カンマで確定します。可能な場合は確定後もフォーカスを維持するため、PCとスマホの両方で日本語ラベルを続けて入力できます。入力欄と文字付きの追加操作は、別の枠として同じ行へ並べ、フォーカス前でも入力してから追加する流れと境界が分かるようにします。幅の狭い画面では、文字付きの選択操作をその下の全幅行へ移します。保存時には空でない入力途中の文字も確定します。最初は最大3個のチップを表示し、残りは既存の省略表示から展開します。選択操作は、フィルターと同じ索引付き複数選択画面を開きます。この画面には、現在のいずれかのタスクに設定されたラベルを提示します。入力途中の文字と保存前に手入力した新規ラベルは、ピッカーを利用しても維持します。ピッカーの確定は編集中の内容だけを更新し、×またはキャンセルでは変更を破棄します。タスクを保存すると、最近使ったラベルの履歴を更新します。

タスク一覧と編集画面では、選択済みラベルを最初に最大3件表示します。残りがある場合、ローカライズされた「ほかN件」をクリック、タップ、またはキーボードで操作すると、残りをすべて表示し、再び折りたためます。この概要の開閉は表示だけを変更し、タスクを保存しません。

### 受け入れ条件

- LABEL-01: 選択確定で下書きを反映し、キャンセルで破棄する。
- LABEL-02: 既存ラベルへの改名は所属を統合し、削除してもタスクを残す。
- LABEL-03: 履歴とお気に入りに重複を出さず、ピッカー利用時も入力を保つ。
