# Edit conflicts

Approval: Accepted — existing contract and [ADR 0022](../adr/0022-prevent-stale-task-overwrites-with-three-way-comparison.md).
Implementation: Implemented on the current branch; verification scope is recorded below.

## Contract

Synchronization is provided by the user's chosen vault synchronization service, not TaskMate. Users should wait for synchronization to finish before editing the same Task on another device. Simultaneous or offline edits to the same file can become provider-managed conflicts. TaskMate does not replace the synchronization provider's remote conflict handling.

When Obsidian Sync is used and the user wants to reduce the risk of one concurrent edit being silently lost, TaskMate recommends selecting **Create conflict file** under Obsidian Sync's conflict-resolution setting on every device. This setting is device-specific. When Obsidian Sync detects a conflict, it retains a separate conflicted copy instead of relying only on automatic merging, allowing both versions to be reviewed. TaskMate treats copies carrying the same stable Task ID as an identity conflict and stops their normal processing until the user resolves them. This setting preserves reviewable copies for conflicts detected by Obsidian Sync; it does not prevent concurrent editing or guarantee that every timing race will be detected.

The Task editor retains its opening state as an in-memory baseline. At Save, TaskMate compares the opening state, the user's draft, and the latest file that has reached the local vault. Changes to different fields are preserved together. Different changes to the same field leave the file unchanged and open conflict review so the user can choose between the current value and their draft. A field containing a collection or another compound value is compared as one complete value rather than merged element by element. Fields the editor did not change and properties TaskMate does not recognize retain their latest file values.

Conflict review also retains the exact file content shown to the user as a temporary baseline. If another device, Codex, another plugin, or another view changes the file again while review is open, TaskMate does not apply the obsolete decision and instead refreshes review against the latest content. Multiple files carrying the same stable Task ID are hidden from normal Task processing and reported as an identity conflict. These safeguards protect writes after versions reach the local vault; they do not replace Obsidian Sync's automatic merge or conflict-copy behavior.

## Acceptance and evidence

- CONFLICT-01: Disjoint edits survive; conflicting same-field edits await explicit choice.
- CONFLICT-02: A second write during review invalidates the earlier choice.
- CONFLICT-03: Duplicate IDs block normal processing; a deleted Task is not recreated.
- CONFLICT-04: Equal compound values should compare equal by value, including Steps.

Evidence: [merge tests](../../../test/task-edit-merge.test.ts), [repository tests](../../../test/repository-conflicts.test.ts). The repository regression test covers saving an unchanged Task after a prior Step save.

## Processing flow and internal design

[repository.ts](../../../src/repository.ts) captures an edit-session baseline and resolves the current Task by ID, with its path as a fast-path hint. Inside `Vault.process()`, [task-edit-merge.ts](../../../src/task-edit-merge.ts) compares baseline, draft and current values. The repository preserves unknown properties and leaves content unchanged when review is required. Renames use Obsidian's file manager after a successful content save.

Conflict review carries the exact displayed file content. Resolving a choice performs another guarded write and rejects a changed baseline. Duplicate identities and missing files return explicit outcomes. Content save and subsequent rename are separate operations; this is not a distributed transaction.

## Failure handling and limitations

Each Labels or Steps collection is one conflict field; no per-element merge is intended. Arrays and plain objects from TaskMate's persisted data compare by value, so independently parsed but equal Steps do not become a conflict.

The guard sees only changes already in the local Vault. It cannot lock another device or replace provider-managed remote conflict resolution.

## Related RFCs

- [RFC 0005: Prevent stale Task overwrites](../rfcs/0005-prevent-stale-task-overwrites.md) — implemented history.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存契約とADR 0022で承認済み。実装：現在のブランチに実装済みで、検証範囲は以下に記録しています。

同期はTaskMateではなく、ユーザーが選んだVault同期サービスが提供します。別の端末で同じタスクを編集する前に、同期完了を待つ必要があります。同じファイルを複数端末で同時またはオフライン編集すると、同期サービス側が扱う競合になる場合があります。TaskMateは同期サービスのリモート競合処理を置き換えません。

Obsidian Syncを使い、同時編集の片方が黙って失われる危険を減らしたい場合、TaskMateはObsidian Syncの競合解決設定で**競合ファイルを作成**をすべての端末に設定することを推奨します。この設定は端末ごとに行う必要があります。Obsidian Syncが競合を検出すると、自動統合だけに任せず別の競合コピーを残すため、両方の内容を確認できます。同じ安定タスクIDを持つコピーをTaskMateが検出した場合は識別競合として扱い、ユーザーが解決するまで通常処理を止めます。この設定はObsidian Syncが検出した競合を確認可能な形で残すものであり、同時編集そのものを禁止したり、すべてのタイミング競合の検出を保証したりするものではありません。

TaskMateのタスク編集画面は、開いた時点の内容をメモリ上の基準として保持します。保存時には編集開始時、ユーザーの編集内容、ローカルVaultへ届いている最新ファイルを3方向比較し、異なる項目への変更は両方維持します。同じ項目に異なる変更がある場合はファイルを書き換えず、現在の値と自分の編集を比較して選ぶ競合確認を表示します。複数値または複合値を持つ項目は、その項目全体を一つの値として比較し、要素単位では自動統合しません。編集画面で変更していない項目とTaskMateが認識しないプロパティは、最新ファイルの値を維持します。

競合確認を表示した時点のファイル内容も一時的な基準として保持します。確認中に別端末、Codex、別プラグインなどが再びファイルを変更した場合、以前の判断をそのまま適用せず、最新内容に対する確認へ更新します。同じ安定タスクIDを持つ複数ファイルは通常タスクとして表示せず、識別競合として通知します。これらはローカルVaultへ届いた内容を安全に保存するための機能であり、Obsidian Sync自身が行う自動マージや競合コピー作成を代替するものではありません。

受け入れ条件は、CONFLICT-01：別項目の変更を保ち、同一項目の競合は判断を待つ、CONFLICT-02：確認中の再変更で判断を無効化する、CONFLICT-03：ID重複を止め、削除済みを再作成しない、CONFLICT-04：Stepsを含む複合値を値で比較する、です。repository回帰テストは、Stepを追加して保存した後に未変更で再保存するケースを確認します。
