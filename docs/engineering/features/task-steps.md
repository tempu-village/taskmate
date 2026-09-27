# Task Steps

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

Steps use a compact list matching the information density of Task rows: a completion checkbox, title with smaller date metadata beneath it, and edit disclosure. Thin dividers separate white rows without surrounding each title in a wide button surface. Completion changes directly in the list, and dragging the content area reorders the whole Step; touch dragging starts after a 250 ms hold. Adding a Step or selecting its title opens a separate editor containing only Step title and date; deletion is available only when editing an existing Step. The Step editor does not duplicate completion or ordering controls.

Steps remain ordered inside their parent Task. Completing the parent and completing a Step are independent. Steps have no independent Task ID, Project, or manual rank.

## Acceptance and evidence

- STEP-01: Save and reload preserve Step text, dates, order and completion.
- STEP-02: Reordering moves the whole Step; parent completion does not complete Steps.

Automated evidence: [task-steps.test.ts](../../../test/task-steps.test.ts), [domain.test.ts](../../../test/domain.test.ts). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task schema](../../../skills/taskmate/references/task-schema.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

ステップはタスク行と同程度の密度を持つコンパクトな一覧として表示し、完了チェック、件名、その下の小さい日付情報、編集を示す表示を持ちます。白い行を細い区切り線で分け、件名を横長のボタン面で囲みません。完了状態は一覧で直接変更し、本文領域のドラッグでステップ全体を並べ替えます。タッチ操作では250ミリ秒の長押し後にドラッグを開始します。ステップの追加または件名の選択で、ステップ名と日付だけを扱う専用編集画面を開きます。削除は既存ステップの編集時だけ利用でき、専用編集画面には完了や並べ替えの操作を重複して置きません。

ステップは親タスク内で順序を保持します。親とステップの完了は独立し、ステップ固有のTask ID、Project、手動順位は持ちません。

### 受け入れ条件

- STEP-01: 保存と再読込で本文、日付、順序、完了を保つ。
- STEP-02: 並べ替えはステップ全体を移動し、親の完了でステップを完了にしない。
