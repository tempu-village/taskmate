# P2: Make the Task editor fields compact and visually distinguishable

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Reduce vertical space consumed by redundant external field labels in the Add/Edit Task editor. Use distinct leading icons as visual landmarks and keep meaning available through placeholders, accessible names, or compact embedded labels.

## Background

The current editor gives Title, Date, Project, Priority, Labels, and Notes separate external text labels. On a phone these labels consume rows that could otherwise show more editable content. Title, Date shortcuts, Labels, and Notes can communicate their purpose through their controls, while icons provide faster shape-based scanning and clearer section boundaries than text differences alone.

Project and Priority are different: after the user selects a value such as `Work` or `None`, the value alone may not identify which property it represents. They therefore retain a small persistent label inside their control. Project and Priority remain on separate rows so narrow screens do not compress either selector.

## Requirements

- Use the icon-led compact layout in the shared Add/Edit Task editor.
- Remove the visible external Title label and use the localized title placeholder inside the full-width input.
- Remove the visible external Date label; retain the date shortcuts and custom date input, preceded by a calendar icon.
- Show Project on its own row with a folder icon and a small persistent `Project` label inside the selector.
- Show Priority on its own row with a flag icon and a small persistent `Priority` label inside the selector.
- Present Labels with a distinct labels icon and an in-control localized prompt instead of a separate external label row.
- Present Notes with a distinct notes icon and an in-control localized prompt instead of a separate external label row.
- Preserve accessible names for every input even when the visible external label is removed.
- Preserve all values, validation, suggestions, label overflow disclosure, save behavior, and deletion behavior.
- On mobile, do not automatically focus Title when the editor opens. Desktop may retain automatic Title focus.

## Acceptance criteria

- The Task editor shows recognizable icons for Title, Date, Project, Priority, Labels, and Notes.
- Title and Date no longer consume separate visible label rows.
- Project and Priority appear on separate rows and retain their small property names after a value is selected.
- Labels and Notes remain understandable without external label rows.
- Opening Add Task on mobile does not open the software keyboard until the user selects an editable field.
- Screen readers can identify every input by its field meaning.
- Add and Edit preserve the same Task data and behavior as before.

## Verification

- Add source/layout tests for the icon-led field structure, embedded Project/Priority labels, separate rows, and mobile autofocus rule.
- Verify Add and Edit on desktop and Android in English and Japanese.
- On Android, open Add Task and confirm the keyboard remains closed until an input is tapped.
- Select Project and Priority values and confirm their property names remain visible.
- Run the repository typecheck, unit tests, build, Python behavior tests, localization validation, release validation, and Skill validation.

## Out of scope

- Changing Task fields or Markdown storage.
- Combining Project and Priority into one row.
- Changing the date shortcuts or recent-label behavior.
- Redesigning the editor as multiple steps.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

タスク追加・編集画面で外側の説明ラベルが消費している縦幅を減らします。形の異なるアイコンを目印にし、入力欄内の文言とアクセシブルな名前で各項目の意味を維持します。

## 背景

> 対応範囲：英語版「Background」の要約

現在はタイトル、日付、プロジェクト、優先度、ラベル、メモの説明文字が別の行を使い、スマホの編集領域を狭くしています。アイコンは文字の違いより形で素早く区別でき、区切りも分かりやすくなります。ただし、選択後の値だけでは意味が分かりにくいプロジェクトと優先度には小さい項目名を残し、狭い画面で圧縮しないよう別々の行にします。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 追加・編集で共有する画面へ、アイコンを先頭に置くコンパクト構成を適用する。
- 外側の「タイトル」を非表示にし、全幅入力欄内のローカライズ済みプレースホルダーを使う。
- 外側の「日付」を非表示にし、カレンダーアイコン、日付候補、任意の日付入力を残す。
- プロジェクトを単独行にし、フォルダーアイコンと選択欄内の小さい「プロジェクト」を常に表示する。
- 優先度を単独行にし、旗アイコンと選択欄内の小さい「優先度」を常に表示する。
- ラベルは専用アイコンと入力欄内のローカライズ済み案内を使い、外側の説明行を使わない。
- メモは専用アイコンと入力欄内のローカライズ済み案内を使い、外側の説明行を使わない。
- 見える外側ラベルを消しても、すべての入力欄のアクセシブルな名前を維持する。
- 値、検証、候補、ラベルの追加表示、保存、削除の動作を維持する。
- モバイルでは画面を開いた直後にタイトルへ自動フォーカスしない。デスクトップでは自動フォーカスを維持してよい。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- タイトル、日付、プロジェクト、優先度、ラベル、メモに識別可能なアイコンがある。
- タイトルと日付が別の見える説明行を消費しない。
- プロジェクトと優先度が別々の行にあり、値を選んだ後も小さい項目名が見える。
- 外側の説明行がなくてもラベルとメモの意味が分かる。
- Androidで追加画面を開いただけではキーボードが出ず、入力欄を選んだ時に出る。
- スクリーンリーダーが全入力欄の意味を識別できる。
- 追加・編集のデータと動作が以前と同じである。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- アイコン付き構造、プロジェクト・優先度の内部ラベル、別行表示、モバイルの自動フォーカス規則をソース／レイアウトテストで確認する。
- デスクトップとAndroid、日本語と英語で追加・編集を確認する。
- Androidで追加画面を開き、入力欄をタップするまでキーボードが出ないことを確認する。
- プロジェクトと優先度を選び、項目名が残ることを確認する。
- 型検査、単体テスト、ビルド、Python動作テスト、ローカライズ、リリース、Skill検証を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- タスク項目またはMarkdown保存形式の変更。
- プロジェクトと優先度を同じ行へまとめること。
- 日付候補または最近使ったラベルの動作変更。
- 複数ステップ画面への再設計。

</details>
