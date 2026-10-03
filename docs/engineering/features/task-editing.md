# Task editing

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

Each Task is stored as one Markdown file. Its frontmatter contains a stable UUID, completion state, optional date, optional Priority from 1 through 3, Labels, optional Project ID, one global manual rank, and creation and update timestamps. The Markdown body contains the Task title, optional ordered Steps, and optional notes. A Step is part of its parent Task and has text, completion state, and an optional date, but no independent identity or lifecycle.

Task filenames are readable and derived from the title. The stable ID is not exposed in the filename. Renaming a Task title may rename its file without changing its identity.

The Task editor supports title, date, Project, Priority, Labels, ordered Steps, and notes. It uses distinct leading icons as compact visual landmarks instead of separate external text-label rows. Title is a visually multi-line, auto-growing field so a long value can be reviewed and edited without horizontal panning; visual wrapping does not add line breaks to the stored Task title. Project and Priority remain on separate rows and keep small persistent property names inside their selectors. Date shortcuts provide Today, Tomorrow, 7 days later, and No date, followed by a custom date field. The primary save action is visible when the editor opens on mobile, and opening Add Task on mobile does not automatically focus Title or open the keyboard.

Selecting a Task title opens its editor. Completion is available in the Task row. Single-task deletion is in the editor footer and requires confirmation.

Select Tasks replaces the main navigation with an explicit selection mode. The selectable set is frozen to the Tasks visible when selection begins, and Select all affects only that set.

Selection-only renders preserve the active Task list's vertical scroll position when entering selection mode, selecting or deselecting Tasks, selecting all, and leaving selection mode. Navigation to another screen does not inherit that position.

A single selected Task opens the normal editor. Multiple selected Tasks can change date, Project, Priority, and Labels together. Bulk Date uses the same shortcuts and custom date field as the Task editor; Project and Priority use the same compact selectors with an additional `No change` option. A chosen Date, Project, or Priority replaces that property for every selected Task, even when their starting values differ. Bulk Labels use the same chip editor and indexed picker as the Task editor. The initial chips are the union of Labels on the selected Tasks. A Label present on only some selected Tasks is marked `Some` without a numeric count and remains unchanged unless the user explicitly acts: `+` assigns it to every selected Task, while removal removes it from every selected Task that has it. A newly added Label is also added to every selected Task. Bulk deletion moves the selected Task files to the Obsidian trash after confirmation and reports partial failures.

Task-list titles use a rectangular, non-pill title action and naturally wrap to variable height. The list displays at most the first 100 user-perceived characters and appends `…` only when the complete title exceeds that boundary. This deterministic presentation does not measure rendered height or offer an inline title-disclosure control. The complete title remains unchanged in Markdown, search data, actions, and accessible names; selecting the displayed title opens the Task editor, where the existing auto-growing multi-line field shows the complete title. Metadata remains in normal document flow below the title and never overlaps it.

## Acceptance and evidence

- EDIT-01: A title longer than 100 graphemes is abbreviated only in the list; editing and storage retain it.
- EDIT-02: Bulk selection is limited to the visible set captured on entry; selection-only rendering retains scroll.
- EDIT-03: Cancelling the editor leaves stored Task data unchanged; deletion requires confirmation.
- EDIT-04: Bulk editing marks partially assigned Labels without a numeric count and keeps them unchanged by default; `+` assigns the Label to every selected Task, while explicit removal removes it from every selected Task that has it.

Automated evidence: [task-title.test.ts](../../../test/task-title.test.ts), [task-list-renderer.test.ts](../../../test/task-list-renderer.test.ts), [bulk-task-actions.test.ts](../../../test/bulk-task-actions.test.ts), [scroll-position.test.ts](../../../test/scroll-position.test.ts). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task schema](../../../skills/taskmate/references/task-schema.md).

## Related RFCs

- [RFC 0012: Explicit multi-select mode](../rfcs/0012-add-explicit-multi-select-mode.md) — implemented.
- [RFC 0024: Compact Task editor fields](../rfcs/0024-compact-task-editor-fields.md) — implemented.
- [RFC 0028: Prevent long titles from scrolling mobile lists](../rfcs/0028-prevent-long-task-titles-from-scrolling-mobile-lists-horizontally.md) — superseded by the deterministic 100-grapheme contract.
- [RFC 0030: Preserve list scroll during multi-selection](../rfcs/0030-preserve-task-list-scroll-position-during-multi-selection.md) — implemented.
- [RFC 0031: Bound Task-list title display](../rfcs/0031-fix-title-disclosure-and-two-line-clipping.md) — implemented.
- [Move task deletion into the editor footer](../rfcs/move-task-deletion-to-editor-footer.md) — implemented.
- [Improve sorting controls and task editor sizing](../rfcs/improve-sorting-and-task-editor-sizing.md) — historical editor-sizing rationale; current sorting authority is maintained separately.

## Related ADRs

- [ADR 0027: Keep bulk Label editing chip-based with partial-assignment state](../adr/0027-keep-bulk-label-editing-chip-based-with-partial-assignment-state.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

各タスクは、一つのMarkdownファイルとして保存します。フロントマターには、安定したUUID、完了状態、任意の日付、1から3の任意の優先度、ラベル、任意のプロジェクトID、全体で一つの手動順位、作成・更新日時を保存します。Markdown本文には、タスク名、任意の順序付きステップ、任意のメモを保存します。ステップは親タスクの一部であり、本文、完了状態、任意の日付を持ちますが、独立した識別子やライフサイクルは持ちません。

タスクのファイル名は読みやすく、タスク名から生成します。安定IDはファイル名に出しません。タスク名を変更してファイル名が変わっても、タスクの同一性は変わりません。

タスク編集画面では、タスク名、日付、プロジェクト、優先度、ラベル、順序付きステップ、メモを扱います。外側の説明文字を行ごとに置く代わりに、形の異なる先頭アイコンをコンパクトな目印として使います。プロジェクトと優先度は別々の行にし、選択欄内へ小さい項目名を常に表示します。日付の候補として、今日、明日、7日後、日付なしを表示し、その下に任意の日付欄を設けます。モバイルで編集画面を開いた時点から主要な保存操作を利用でき、追加画面を開いただけではタイトルへ自動フォーカスせず、キーボードも表示しません。

タスク名の入力欄は複数行へ自動拡張しますが、保存するタイトルは一行です。タスク名から編集し、行のチェックで完了にします。単一タスクの削除は編集フッターにあり、確認が必要です。

「タスクを選択」は、メインナビゲーションを明示的な選択モードへ置き換えます。選択可能な集合は選択開始時に表示されていたタスクへ固定し、「すべて選択」はその集合だけを対象にします。

選択が1件なら通常の編集画面を開きます。複数件では、日付、プロジェクト、優先度、ラベルをまとめて変更できます。一括編集の日付は通常編集と同じ候補と任意の日付欄を使い、プロジェクトと優先度は同じコンパクトな選択欄へ「変更しない」を追加します。日付、プロジェクト、優先度を選ぶと、開始時の値が異なっていても選択中の全タスクへ同じ値を設定します。ラベルは通常編集と同じチップ入力とインデックス付きピッカーを使います。初期チップは選択したタスクに付くラベルの和です。一部のタスクだけにあるラベルは数字を出さず「一部」と示し、明示的に操作するまで変更しません。＋を押すと選択中の全タスクへ追加し、外すと保持している選択中の全タスクから削除します。新しく追加したラベルも全タスクへ追加します。一括削除は、確認後に選択したタスクファイルをObsidianのゴミ箱へ移動し、部分的な失敗を報告します。

タスク一覧のタイトルは、矩形で楕円形ではないタイトル操作の中で、文字数に応じて自然に折り返し、高さを変えます。一覧には見た目上の先頭100文字までを表示し、完全なタイトルがその境界を超える場合だけ末尾へ`…`を付けます。この表示では描画高さを測定せず、一覧内のタイトル展開操作も設けません。Markdown、検索用データ、操作、アクセシブル名には省略しない完全なタイトルを維持します。一覧のタイトルを選ぶと編集画面を開き、既存の自動拡張する複数行欄で全文を表示します。メタ情報はタイトルの下の通常フローに置き、重ねません。

選択モードへの出入り、個別選択、すべて選択による再描画では、現在の一覧の縦スクロール位置を保持します。別画面への移動ではその位置を引き継ぎません。

### 受け入れ条件

- EDIT-01: 100書記素を超えるタイトルは一覧だけを省略し、編集と保存では全文を保持する。
- EDIT-02: 一括選択は開始時の表示対象に限り、選択だけの再描画ではスクロールを保つ。
- EDIT-03: キャンセルでは保存済みデータを変更せず、削除には確認を必要とする。
- EDIT-04: 一部のタスクだけに付くラベルは数字を出さず「一部」と示し、初期状態では変更しない。＋を押すと選択中の全タスクへ追加し、明示的に外すと、そのラベルを持つ選択中の全タスクから削除する。
