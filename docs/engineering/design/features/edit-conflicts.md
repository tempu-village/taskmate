# Task editor conflict design

Status: Current design with a known Step equality gap. Product authority: [Edit conflicts](../../specifications/edit-conflicts.md).

## Save boundary

[repository.ts](../../../../src/repository.ts) captures an edit-session baseline and resolves the current Task by ID, with its path as a fast-path hint. Inside `Vault.process()`, [task-edit-merge.ts](../../../../src/task-edit-merge.ts) compares baseline, draft and current values. The repository preserves unknown properties and leaves content unchanged when review is required. Renames use Obsidian's file manager after a successful content save.

Conflict review carries the exact displayed file content. Resolving a choice performs another guarded write and rejects a changed baseline. Duplicate identities and missing files return explicit outcomes. Content save and subsequent rename are separate operations; this is not a distributed transaction.

## Compound values and limitations

Each Labels/Steps collection is one conflict field; no per-element merge is intended. However, the current equality helper recursively compares arrays and uses reference equality for objects. Independently parsed but equal Step objects may be classified as conflicting. Keep CONFLICT-04 as the accepted target; track this implementation gap in [testing](../testing.md#known-gaps) rather than weakening the contract.

The guard sees only changes already in the local Vault. It cannot lock another device or replace provider-managed remote conflict resolution. Rationale: [ADR 0022](../adr/0022-prevent-stale-task-overwrites-with-three-way-comparison.md).

## Verification

[Comparison tests](../../../../test/task-edit-merge.test.ts) cover scalar/Label values and disjoint edits. [Repository tests](../../../../test/repository-conflicts.test.ts) cover stale review, deletion and identity conflicts. Add object-valued Step acceptance coverage when fixing the known gap; no runtime fix is included in this documentation change.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

製品の正本は[編集競合仕様](../../specifications/edit-conflicts.md)です。repositoryは編集開始時の基準を持ち、IDで最新Taskを解決してVault.process内で基準・下書き・最新値を比較します。競合時は書き換えず、未知のPropertyを保ちます。判断を反映する際にも表示時のファイル内容と再照合し、削除・ID重複を明示します。内容保存と改名は別操作です。

LabelsとStepsは項目全体で比較し、要素単位で統合しません。ただし現在の等価判定はオブジェクトを参照で比較するため、同内容の別Stepオブジェクトで余分な競合が起き得ます。CONFLICT-04を変更せず[検証不足](../testing.md#known-gaps)に記録します。保護対象はローカルVaultへ届いた変更であり、別端末のロックではありません。この文書変更では実行時修正を行いません。
