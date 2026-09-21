# P0: Prevent stale Task overwrites across external edits and Vault sync

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Prevent TaskMate from silently overwriting newer Task data when an Add/Edit Task editor remains open while the same Task is changed by Obsidian Sync, Codex, another plugin, or another Obsidian view. Detect duplicate stable Task IDs and require explicit review for conflicting same-field edits.

## Background

The repository already uses `Vault.process()` for guarded writes, but the editor can hold a draft for much longer than one read-modify-write operation. A full stale draft can therefore replace a newer value unless TaskMate compares the opening state, the draft, and the current file at Save. A decision made in a conflict screen can also become stale while that screen remains open, so the final action needs its own guarded validation.

Obsidian Sync may merge Markdown conflicts or create a separate conflicted copy according to its per-device configuration. A conflicted copy of a Task can carry the same stable Task ID as the original, which TaskMate must treat as an identity conflict rather than as two ordinary Tasks.

TaskMate cannot inspect a remote version before it reaches the local Vault. To reduce the risk of one detected Sync edit being silently absorbed by automatic merging, the product documentation recommends enabling Obsidian Sync's **Create conflict file** setting on every device. TaskMate does not add a distributed lock or a separate post-sync conflict monitor.

## Requirements

- Represent an open Add/Edit Task editor as an in-memory edit session containing the stable Task ID, opening Task state, and opening source content.
- Resolve the current Task by stable Task ID for saving; use the opening path only as a fast-path hint.
- Perform one guarded three-way comparison inside `Vault.process()` for each save attempt, using the opening state, the user's draft, and the current file state supplied to the guarded write.
- Preserve a value changed by only one side and accept the value when both sides changed the field to the same result.
- When the draft and current file changed the same field to different values, leave the file unchanged and show an explicit conflict review.
- Compare every collection or compound field as one complete field. Apply this rule to Labels and every other present or future multi-value field unless a later accepted decision defines field-specific merge semantics.
- Preserve the latest values of fields the editor did not change.
- Preserve properties that TaskMate does not recognize.
- Do not expose immutable identity fields as editable merge candidates.
- When conflict review opens, retain the exact current file state shown to the user as the conflict-review baseline.
- Treat any action that writes from conflict review as a new guarded save attempt. Compare the then-current file state with the conflict-review baseline inside `Vault.process()` before applying the user's decision.
- If the file changed while conflict review was open, do not apply the obsolete decision. Refresh the conflict information and require a decision against the new current state.
- If more than one file has the same stable Task ID, stop normal processing for that identity and notify the user of the conflict.
- If the Task was deleted after the editor opened, report the deletion and do not recreate it implicitly.
- Use Obsidian public APIs for reads, guarded writes, and renames. Preserve Obsidian link updates when a title change renames the Task file.
- Document the boundary between TaskMate's local write guard and Obsidian Sync's own remote conflict handling.
- Document the device-specific **Create conflict file** recommendation for users who want both sides of detected Obsidian Sync conflicts retained for review.

## Acceptance criteria

- A Save with no external change writes the draft normally.
- Disjoint edits, such as a local Date change and an external Notes change, are preserved together without a conflict prompt.
- Different changes to the same scalar field leave the file unchanged until the user explicitly resolves the conflict.
- Different changes to the same compound or multi-value field are reported as one field conflict and are not merged element by element.
- An unchanged field in the editor cannot overwrite a newer external value.
- An unknown property added externally remains present after a TaskMate save.
- A second external change made while conflict review is open prevents an earlier conflict decision from being applied and refreshes the review state.
- Duplicate Task IDs are reported and are not rendered or edited as independent normal Tasks.
- An externally renamed Task can still be found by ID and saved without recreating its old path.
- An externally deleted Task is not silently recreated.
- Normal saving compares only the edited Task and does not scan all Task contents unless the path hint no longer resolves the expected ID.
- Product documentation states that **Create conflict file** must be enabled on every device, preserves reviewable copies only when Obsidian Sync detects a conflict, and does not prevent simultaneous editing.

## Verification

- Open one Task in TaskMate, edit a different field through Codex or another Obsidian instance, then Save and confirm both disjoint changes remain.
- Change the same field to different values in TaskMate and externally, then confirm that the file remains unchanged and conflict review appears.
- Repeat the test for Labels and at least one other multi-value field.
- While conflict review is open, change the Task externally again, choose a write action, and confirm that TaskMate refreshes the conflict instead of applying the obsolete decision.
- Add an unknown frontmatter property externally, Save a different TaskMate field, and confirm that the property remains.
- Rename the Task file externally, then Save the open editor and confirm that TaskMate resolves it by ID and preserves Obsidian link behavior.
- Delete the Task externally while its editor is open and confirm that Save reports the missing Task without recreation.
- Create two files with the same Task ID and confirm that TaskMate reports an identity conflict and blocks normal processing for them.
- Test the scenarios on desktop and Android after Sync has completed.
- On every test device, enable Obsidian Sync's **Create conflict file** setting, produce a Sync conflict, and confirm that TaskMate reports the duplicate stable Task ID instead of treating both copies as ordinary Tasks.

## Out of scope

- Replacing or reproducing Obsidian Sync's remote merge algorithm.
- Automatically merging individual elements of a compound or multi-value field.
- Persisting a revision counter in the portable Task schema.
- Automatically deciding which duplicate-ID file should win.
- A TaskMate-managed distributed edit lock, persisted editing-presence protocol, or post-sync conflict monitor.
- Guaranteeing detection of a remote change that has not yet reached the local Vault.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

タスク編集画面を開いている間にObsidian Sync、Codex、別プラグイン、別のObsidian画面が同じタスクを変更しても、TaskMateが新しい内容を黙って上書きしないようにします。同じタスクIDを持つ複数ファイルを競合として検出し、同じ項目に異なる変更があれば明示的な確認を求めます。

## 背景

> 対応範囲：英語版「Background」の要約

`Vault.process()`は一回の読み書きを保護しますが、編集画面を開いてから保存するまでの時間全体は保護しません。そのため編集開始時、ユーザーの編集内容、保存時の最新ファイルを比較します。また競合画面の表示中にも内容が変わり得るため、競合画面から書き込む直前にも、その画面で確認した状態から変わっていないか検証します。Obsidian Syncが作る競合コピーに元ファイルと同じタスクIDが含まれる場合は、通常の二つのタスクとして扱いません。

TaskMateは、リモート変更がローカルVaultへ到着する前にはその内容を確認できません。Obsidian Syncが検出した両方の編集を確認可能な形で残したい場合は、すべての端末で**競合ファイルを作成**を有効にすることを製品仕様で推奨します。TaskMate独自の分散ロックや同期後の追加監視は導入しません。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- 開いているタスク追加・編集画面を、安定したタスクID、編集開始時のタスク状態、開始時のソース内容を持つメモリ上の編集セッションとして表現する。
- 保存対象は安定したタスクIDで解決し、開始時のパスは高速化のための手掛かりとしてのみ使う。
- 各保存試行につき、`Vault.process()`内で、編集開始時、ユーザーの下書き、保護された書き込み処理が受け取った現在のファイル状態を用いた3方向比較を1回行う。
- 片側だけが変更した値は維持し、両側が同じ結果へ変更した場合はその値を採用する。
- 下書きと現在のファイルが同じ項目を異なる値へ変更していた場合、ファイルを変更せず明示的な競合確認を表示する。
- コレクションまたは複合値を持つ項目は、その項目全体を一まとまりとして比較する。後の承認済み判断で項目固有の統合方法を定めない限り、ラベルを含む現在および将来のすべての複数値項目に適用する。
- 編集画面で変更していない項目は最新ファイルの値を維持する。
- TaskMateが認識しないプロパティを維持する。
- 変更不能な識別項目を編集可能な統合対象として公開しない。
- 競合確認画面を開いたとき、表示した正確な現在ファイル状態を競合確認基準として保持する。
- 競合確認画面から書き込む操作は新しい保護付き保存試行として扱い、ユーザーの判断を適用する前に、`Vault.process()`内でその時点の現在状態と競合確認基準を比較する。
- 競合確認画面を表示している間にファイルが変化していた場合、古い判断を適用せず、競合情報を更新して新しい現在状態に対する判断を求める。
- 同じ安定したタスクIDを持つファイルが複数存在する場合、そのIDの通常処理を止めて競合を通知する。
- 編集画面を開いた後でタスクが削除された場合、削除済みとして通知し、暗黙に再作成しない。
- 読み取り、保護付き書き込み、改名にはObsidianの公開APIを使う。タイトル変更によるファイル名変更時はObsidianのリンク更新を維持する。
- TaskMateのローカル書き込み保護とObsidian Sync自身のリモート競合処理との境界を文書化する。
- Obsidian Syncが検出した競合の両方を確認用に残したいユーザー向けに、端末ごとの**競合ファイルを作成**設定を文書化する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 外部変更がない保存は通常どおり下書きを保存する。
- TaskMateでの日付変更と外部でのメモ変更など、異なる項目への変更は確認を出さず両方維持する。
- 同じ単一値項目への異なる変更は、ユーザーが明示的に解決するまでファイルを変更しない。
- 同じ複合値または複数値項目への異なる変更は一つの項目競合として通知し、要素単位で自動統合しない。
- 編集画面で変更していない項目が、より新しい外部の値を上書きしない。
- 外部で追加した未知のプロパティがTaskMateでの保存後も残る。
- 競合確認中に二度目の外部変更が行われた場合、以前の競合判断を適用せず確認内容を更新する。
- 重複タスクIDを通知し、それぞれを独立した通常タスクとして表示または編集しない。
- 外部で改名されたタスクをIDで発見し、古いパスへ再作成せず保存できる。
- 外部で削除されたタスクを黙って再作成しない。
- 通常保存では編集中のタスクだけを比較し、パスから期待するIDを解決できない場合を除いて全タスク内容を走査しない。
- 製品仕様に、**競合ファイルを作成**はすべての端末で有効にする必要があり、Obsidian Syncが競合を検出した場合だけ確認用コピーを残し、同時編集そのものは防がないことを記載する。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- TaskMateで一つのタスクを開き、Codexまたは別のObsidianから異なる項目を変更して保存し、両方の変更が残ることを確認する。
- TaskMateと外部で同じ項目を異なる値へ変更し、ファイルが変更されず競合確認が表示されることを確認する。
- ラベルと、ラベル以外の複数値項目を少なくとも一つ使って同じ試験を行う。
- 競合確認画面を開いたまま外部から再度変更し、書き込み操作を選んだとき、古い判断を適用せず競合情報が更新されることを確認する。
- 外部から未知のfrontmatterプロパティを追加し、TaskMateで別項目を保存して、そのプロパティが残ることを確認する。
- タスクファイルを外部で改名してから開いた編集画面を保存し、IDで解決されObsidianのリンク動作が維持されることを確認する。
- 編集画面を開いた状態で外部からタスクを削除し、再作成せず見つからないことを通知することを確認する。
- 同じタスクIDを持つファイルを二つ作り、識別競合を通知して通常処理を止めることを確認する。
- Sync完了後、デスクトップとAndroidで各シナリオを確認する。
- すべての検証端末でObsidian Syncの**競合ファイルを作成**を有効にしてSync競合を発生させ、TaskMateが両方を通常タスクとして扱わず、安定タスクIDの重複を通知することを確認する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- Obsidian Syncのリモート統合アルゴリズムを置き換えたり再実装したりすること。
- 複合値または複数値項目の個々の要素を自動統合すること。
- ポータブルなタスクスキーマへrevision番号を永続化すること。
- 重複IDを持つどちらのファイルを採用するか自動決定すること。
- TaskMate独自の分散編集ロック、永続的な編集中状態プロトコル、同期後の競合監視。
- まだローカルVaultへ届いていないリモート変更を必ず検出すること。

</details>
