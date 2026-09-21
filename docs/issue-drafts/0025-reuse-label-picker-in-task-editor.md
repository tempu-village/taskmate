# P1: Add continuous chip-based Label entry and reuse the existing Label picker

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Replace the Task editor's comma-only Label field with a chip editor that supports Add, Enter, and ASCII comma confirmation, and retain the compact action that opens Filter's indexed multi-select picker.

## Background

The permanent recent-Label section consumed vertical space without exposing every existing Label, so option A placed a labeled chooser beside the editor. Free-form entry still required a half-width comma between Labels. Repeatedly switching to that punctuation is cumbersome when entering Japanese Labels with a desktop IME or a mobile Japanese keyboard.

The chip editor provides an explicit Add action and Enter support while retaining comma compatibility. Its purpose is to let users enter several Japanese Labels continuously on both desktop and mobile. The input remains active after each addition so the next Label can be typed without reopening the keyboard. The compared B layout keeps the input and the labeled Add action as separate, adjacent controls because typing and committing are one consecutive flow. On narrow screens, the existing-Label chooser moves below that row instead of forcing Add into the input border.

## Requirements

- Apply the change to the shared Add Task and Edit Task editor.
- Remove the permanently visible `Recently used labels` heading and chips from the editor.
- Replace the plain comma-only input with a chip editor that shows selected Labels as individually removable chips followed by a persistent text input.
- Keep the maximum of 500 unique normalized Labels and prevent duplicate chips.
- Provide three ways to commit pending text: the visible localized `Add` / `追加` button, Enter, and an ASCII comma.
- Ignore Enter and comma as Label delimiters while IME composition is active, including when `KeyboardEvent.isComposing` is true.
- Keep the input focused and the software keyboard open after Add, Enter, or comma confirmation when possible.
- Disable Add when the pending input is empty after trimming.
- Commit non-empty pending text before Save so the last typed Label cannot be lost.
- Preserve pending text when opening, confirming, canceling, or closing the existing-Label picker.
- Parse comma-separated pasted or entered text into completed Labels while retaining the final unfinished segment until it is explicitly committed or the Task is saved.
- Keep selected Label overflow compact: initially show at most three chips, expose the existing localized `N more` control when needed, and allow expansion and collapse.
- Place the Label input and visible localized `Add` / `追加` button in separate bordered controls on the same row.
- On narrow mobile screens, keep the input and Add side by side and move the visible localized `Choose` / `選択` button to a full-width row below them.
- Give both Add and Choose mobile-sized pointer targets and accessible names.
- Do not place Add inside the chip editor's border or replace its localized text with an icon-only plus.
- Open the existing `LabelPickerModal`; do not create a second picker implementation.
- Preserve the picker's search, Recent & Favorites and All Labels tabs, populated group index, multi-selection, favorite stars, Cancel, and Confirm selection behavior.
- Offer Labels attached to any current Task, including completed Tasks, as existing Label candidates.
- Initialize the picker from the editor's committed draft Labels and preserve newly typed draft Labels outside the existing candidate set.
- On picker confirmation, update the committed draft chips without saving the Task.
- On picker close or Cancel, discard selection and favorite changes made in that picker session.
- Persist confirmed favorite changes through the existing TaskMate settings path.
- Continue updating recent Label history only after the Task itself is successfully saved.
- Preserve the existing Add/Edit keyboard avoidance, scrolling, deletion, and Save/Cancel behavior.

## Acceptance criteria

- Add/Edit Task no longer displays a permanent recent-Label section or a plain comma-only field.
- A user can add consecutive Japanese Labels with Add while focus and the mobile keyboard remain available.
- A user can add a Label with Enter after Japanese IME conversion has finished, without the conversion-confirmation Enter creating a premature chip.
- Typing an ASCII comma commits the completed segment, and pasting multiple comma-separated values creates the expected chips.
- Duplicate and empty Labels are not created.
- Backspace in an empty pending input does not silently delete a chip; chips are removed with their visible remove controls.
- Save includes non-empty pending text even if Add, Enter, or comma was not used.
- The chooser opens the same Label picker class used by Filter.
- Multiple existing Labels can be added or removed and appear as chips after confirmation.
- Pending text survives picker confirmation and cancellation.
- Canceling the picker leaves committed editor Labels and favorites unchanged.
- Confirming the picker does not persist Task changes before Save.
- Favorite changes confirmed in the picker persist and appear the next time the picker opens.
- English and Japanese labels and accessible names are present.
- The input boundary remains visible when it is not focused, and Add is visibly a separate adjacent button.
- At narrow Android width, input and Add remain on one row without clipping, while Choose appears below them.
- The chip editor, Add, and Choose remain usable on a narrow Android screen without regressing keyboard avoidance.

## Verification

- Add deterministic tests for Add/Enter/comma tokenization, IME guards, normalization, duplicate prevention, pending-text Save, and candidate-set preservation.
- Add source/layout coverage for the shared picker, removal of permanent recent chips, chip removal, the three confirmation paths, the adjacent input/Add row, the mobile Choose row, and touch-sized Add/Choose actions.
- Verify Add and Edit manually on desktop and Android with a Japanese IME: consecutive entry, conversion Enter, Add, ASCII comma, pasted values, removal, overflow, pending-text Save, picker Cancel/Confirm, favorites, keyboard display, and Save.
- Run `npm run typecheck`, `npm test`, `npm run build`, the Python behavior tests, `python3 scripts/validate_skills.py`, and `git diff --check`.

## Out of scope

- Removing recent Label history from settings or from the shared picker's suggestions.
- Creating a separate Label registry or allowing empty Labels.
- Changing Filter matching semantics.
- Automatically saving the Task when a chip or picker selection is confirmed.
- Treating Japanese punctuation other than the ASCII comma as a delimiter.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

タスク編集画面のカンマだけに依存したラベル入力をチップ方式へ変更し、追加ボタン、Enter、半角カンマの3通りで確定できるようにします。フィルターと同じ索引付き複数選択画面を開く省スペースな操作も維持します。

## 背景

> 対応範囲：英語版「Background」の要約

常設の最近使ったラベルは縦領域を使う一方、既存ラベル全体を探せないため、文字付きの選択操作を残します。しかし自由入力ではラベルの間に半角カンマが必要で、日本語IMEやスマホの日本語キーボードから連続入力する際に負担となります。追加ボタンとEnterへ対応し、追加後も入力状態を維持します。比較したB案を採用し、入力欄と文字付きの追加ボタンを別枠で横に並べることで、入力してすぐ追加する一連の流れを分かりやすくします。スマホでは既存ラベルの選択操作を次の行へ移します。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- タスク追加・編集で共有する画面へ適用する。
- 常時表示していた「最近使ったラベル」の見出しとボタンを削除する。
- カンマだけに依存した入力欄を、選択済みラベルを個別に削除できるチップとして表示し、その末尾に入力欄を常設するチップ編集へ置き換える。
- 正規化した重複のないラベルを最大500件とし、重複チップを作らない。
- 入力途中の文字を確定する方法として、文字付きの`Add`／`追加`ボタン、Enter、半角カンマの3つを用意する。
- IME変換中および`KeyboardEvent.isComposing`がtrueの間は、Enterとカンマをラベル区切りとして扱わない。
- 可能な限り、追加ボタン、Enter、カンマで確定した後も入力欄へフォーカスを残し、ソフトウェアキーボードを閉じない。
- 入力途中の文字が空白を除いて空なら、追加ボタンを無効にする。
- 最後に入力したラベルが失われないよう、保存前に空でない入力途中の文字を確定する。
- 既存ラベル選択画面を開く、確定する、キャンセルする、×で閉じる操作で、入力途中の文字を失わない。
- カンマ区切りで入力または貼り付けた文字は完成したラベルへ分割し、最後の未完成部分は明示的に確定するかタスクを保存するまで入力欄へ残す。
- 選択済みラベルの表示を省スペースに保ち、最初は最大3個のチップを表示し、必要な場合は既存の「ほかN件」を表示して展開・折りたたみできるようにする。
- ラベル入力欄と文字付きの`Add`／`追加`ボタンを別の枠にし、同じ行へ横に並べる。
- 幅の狭いスマホでは、入力欄と追加を同じ行に保ち、文字付きの`Choose`／`選択`ボタンをその下の全幅行へ移す。
- 追加と選択の両方に、スマホで押せる大きさとアクセシブル名を設ける。
- 追加をチップ入力欄と同じ枠内へ入れず、文字付きボタンを意味の曖昧な「＋」だけの操作へ置き換えない。
- 別の選択画面を作らず、既存の`LabelPickerModal`を開く。
- 検索、「履歴・お気に入り」と「すべてのラベル」のタブ、存在するグループだけの索引、複数選択、お気に入りの星、キャンセル、「選択を確定」を維持する。
- 完了状態を問わず、現在のいずれかのタスクに設定されているラベルを既存候補として表示する。
- 編集画面で確定済みのラベルをピッカーの初期選択にし、既存候補にない新規ラベルも維持する。
- ピッカーで確定したら、タスクを保存せず、編集中の確定済みラベルチップだけを更新する。
- ピッカーを×またはキャンセルで閉じたら、そのピッカー内での選択とお気に入り変更を破棄する。
- 確定したお気に入り変更は、既存のTaskMate設定保存処理で永続化する。
- 最近使ったラベルの履歴は、引き続きタスク保存成功後だけ更新する。
- 既存の追加・編集画面におけるキーボード回避、スクロール、削除、保存・キャンセルの動作を維持する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- タスク追加・編集に常設の「最近使ったラベル」やカンマだけに依存した入力欄が表示されない。
- 追加ボタンで日本語ラベルを続けて追加でき、フォーカスとスマホのキーボードを利用し続けられる。
- 日本語IMEの変換確定が終わった後にEnterでラベルを追加でき、変換確定用のEnterでチップが早く作られない。
- 半角カンマで完成した部分を確定でき、カンマ区切りの複数項目を貼り付けると想定したチップになる。
- 重複ラベルと空ラベルを作らない。
- 空の入力欄でBackspaceを押してもチップを暗黙に削除せず、表示された削除操作でチップを外す。
- 追加、Enter、カンマを使わずに保存しても、空でない入力途中の文字を保存対象へ含める。
- フィルターと同じラベルピッカークラスが開く。
- 複数の既存ラベルを追加・解除し、確定後にチップとして表示できる。
- 入力途中の文字が、ピッカーの確定とキャンセルのどちらでも残る。
- ピッカーのキャンセルでは、編集中の確定済みラベルとお気に入りが変わらない。
- ピッカーの確定だけでは、保存前のタスクを永続化しない。
- ピッカーで確定したお気に入り変更は保存され、次に開いた際も表示される。
- 英語・日本語の表示名とアクセシブル名が存在する。
- 入力欄を選択していない状態でも境界が見え、追加が隣接する別のボタンだと分かる。
- 幅の狭いAndroidで入力欄と追加が切れずに同じ行へ収まり、選択はその下に表示される。
- 幅の狭いAndroid画面でもチップ入力、追加、選択を操作でき、キーボード回避を壊さない。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 追加、Enter、カンマによる分割、IME保護、正規化、重複防止、入力途中の文字を含む保存、候補外選択の維持について決定的テストを追加する。
- 共通ピッカー、常設履歴の削除、チップ削除、3つの確定経路、入力欄と追加の横並び、スマホでの選択行、スマホ向けの追加・選択操作をソース・レイアウトテストで確認する。
- デスクトップとAndroidの日本語IMEで、連続入力、変換Enter、追加、半角カンマ、貼り付け、削除、省略表示、未確定文字の保存、ピッカーのキャンセル・確定、お気に入り、キーボード表示、保存を目視確認する。
- `npm run typecheck`、`npm test`、`npm run build`、Python behavior tests、`python3 scripts/validate_skills.py`、`git diff --check`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- 最近使ったラベル履歴を設定または共通ピッカーの候補から削除すること。
- 独立したラベル台帳または空ラベルを作ること。
- フィルターの一致条件を変えること。
- チップまたはピッカーの確定と同時にタスクを自動保存すること。
- 半角カンマ以外の日本語句読点を区切り文字として扱うこと。

</details>
