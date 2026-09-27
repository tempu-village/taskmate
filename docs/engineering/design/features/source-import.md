# Source import design

Status: Current mechanics. Product authority: [Source-note import](../../specifications/source-import.md).

## Ownership and flow

The agent inventories semantic action candidates and writes the review plan. [todo_store.py](../../../../skills/taskmate/scripts/todo_store.py) discovers eligible notes and computes provenance hashes. [proposal_store.py](../../../../skills/taskmate/scripts/proposal_store.py) validates the manifest, stages review/proposal files, and applies explicit decisions. Exact plan/decision formats live in the portable [proposal workflow](../../../../skills/taskmate/references/proposal-workflow.md).

Stage validates candidate coverage before writing the session. Snapshots bind the plan to Source content and pending merge targets. Promote rechecks snapshots, processes each submitted decision, and records its resulting Task ID. Remaining pending decisions keep the session Active. After all decisions, provenance combines prior IDs and promoted IDs, then the session is moved to Archive.

## Failure boundaries

Individual helper writes use temporary-file replacement, but multiple Tasks, decision records, source metadata and archive moves do not form one transaction. A normal retry after recorded decisions is idempotent. A crash between Task creation and recording its promoted ID may require manual reconciliation; do not promise exactly-once crash recovery or automatic rollback. Inspect session and actual Tasks before retrying uncertain writes.

Manifest validation checks declared candidates, not whether the agent understood all actions in prose. Human coverage review remains necessary. Indexed discovery and automatic Vault setup are separate proposed contracts, not alternate current implementations.

## Verification

[Proposal tests](../../../../skills/taskmate/tests/test_proposal_store.py) exercise multi-note coverage, partial decisions, repeat promotion and stale-source rejection. [Store tests](../../../../skills/taskmate/tests/test_todo_store.py) cover Markdown/provenance behavior. Verify a real host-agent extraction separately using [the import guide](../../../user/how-to/import-source-notes.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

製品上の正本は[Source-note import](../../specifications/source-import.md)です。Agentが意味的候補とplanを用意し、todo_storeが探索とhash、proposal_storeがcoverage検証、ステージ、明示判断の反映を担います。形式の正本はportable Skillのproposal workflowです。

候補検証後にセッションを書き、反映前にSource・未判断の統合先snapshotを再確認します。判断ごとにTask IDを記録し、保留があればActiveを維持、全件判断で過去と今回のIDをprovenanceに統合してArchiveへ移します。

個別writeの置換はありますが、複数Task・判断記録・メタデータ・archiveは一つのtransactionではありません。記録済み判断の通常再実行は重複しませんが、Task作成とID記録の間のクラッシュは手動照合が必要になり得ます。自動rollbackや完全な一度限り実行を保証しません。宣言した候補の整合検証と、文章からの抽出漏れの確認も区別します。
