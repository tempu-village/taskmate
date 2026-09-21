# P2: Use one focus ring for the Task editor Label input

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Show one clear focus indicator when the chip-based Label input is active instead of two nested rounded outlines.

## Background

Issue #25 introduced a bordered chip editor containing the text input. The editor applies a focus indicator through `:focus-within`, while the focused native input can also receive a theme or browser focus outline. On the observed desktop screen, these two focus treatments appear as nested rounded outlines. The Label workflow is otherwise accepted and should be closed independently.

## Requirements

- When the Label text input is focused, show exactly one visible focus indicator for the editable Label area.
- Keep the focus indicator sufficiently clear; do not remove all visible keyboard-focus feedback.
- Treat the chip editor as the visual focus boundary while its nested input is active, unless device verification shows a more reliable single-boundary approach.
- Preserve Add, Enter, ASCII-comma confirmation, IME composition protection, chip removal, overflow disclosure, and existing-Label selection.
- Preserve the adjacent input/Add layout adopted in Issue #25.
- Preserve desktop and mobile keyboard behavior.

## Acceptance criteria

- The inactive Label editor has one normal border.
- Focusing the Label text input produces one focus ring rather than two nested rounded outlines.
- The focused state remains visually distinguishable from the inactive state.
- Keyboard users can still identify which control is active.
- Add/Edit Task behavior and Label values do not change.

## Verification

- Inspect the computed focus styles from Obsidian, the active theme, and TaskMate before choosing which nested decoration to suppress.
- Add source or style regression coverage ensuring the input and its `:focus-within` container cannot both draw visible focus rings.
- Verify Add and Edit Task on desktop and Android, including keyboard navigation where available.
- Verify the default light and dark Obsidian themes.
- Run the repository typecheck, tests, build, Python behavior tests, localization validation, release validation, and Skill validation.

## Out of scope

- Changing the chip editor layout or the position of Add and Choose.
- Changing Label entry, persistence, filtering, or picker behavior.
- Removing visible focus feedback.

Related: #25.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

チップ式ラベル入力を選択したときに、角の丸い枠が二重に表示されず、明確なフォーカス表示を一つだけ表示します。

## 背景

> 対応範囲：英語版「Background」の要約

Issue #25で、入力欄を内包する枠付きチップ編集を追加しました。外側は`:focus-within`でフォーカスを示しますが、内側の入力欄にもObsidianテーマまたはブラウザーのフォーカス枠が付く可能性があります。確認したPC画面では、この二つが角の丸い二重枠に見えます。ラベル入力機能そのものは承認済みとして、別に完了できます。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- ラベル入力欄へフォーカスしたとき、編集可能なラベル領域に見えるフォーカス表示を正確に一つだけ表示する。
- フォーカス表示を十分明確に保ち、キーボードフォーカスの見える手掛かりをすべて消さない。
- 端末確認でより確実な一重表示が判明しない限り、内側の入力欄が有効な間はチップ編集全体を見えるフォーカス境界として扱う。
- 追加、Enter、半角カンマによる確定、IME変換の保護、チップ削除、省略表示、既存ラベル選択を維持する。
- Issue #25で採用した入力欄と追加の横並びを維持する。
- PCとスマホのキーボード動作を維持する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 非アクティブなラベル編集には通常の枠を一つ表示する。
- ラベル入力欄へフォーカスすると、角の丸い二重枠ではなく一つのフォーカス枠を表示する。
- フォーカス状態を非アクティブ状態と目で区別できる。
- キーボード利用者が、どの操作へフォーカスしているか判断できる。
- タスク追加・編集の動作とラベルの値を変更しない。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 抑制する内側の装飾を決める前に、Obsidian、利用中テーマ、TaskMateが適用するフォーカススタイルを開発者ツールで確認する。
- 入力欄と`:focus-within`の外側領域が同時に見えるフォーカス枠を描かないことを、ソースまたはスタイルの回帰テストで確認する。
- PCとAndroidのタスク追加・編集で確認し、利用可能な環境ではキーボード操作も確認する。
- Obsidian標準のライト・ダークテーマで確認する。
- リポジトリの型検査、テスト、ビルド、Python動作テスト、ローカライズ検証、Release検証、Skill検証を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- チップ編集の配置または追加・選択の位置を変更すること。
- ラベル入力、保存、フィルター、選択画面の動作を変更すること。
- 見えるフォーカス表示を削除すること。

関連：#25。

</details>
