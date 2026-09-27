# Source-note import

Approval: Accepted — [allowlist ADR](../adr/0004-opt-in-source-notes.md), [staging ADR](../adr/0011-stage-source-imports-before-promotion.md), and [coverage ADR](../adr/0017-require-a-candidate-manifest-for-coverage-review.md).
Implementation: Staging and promotion implemented; indexed discovery is not implemented.

## Contract

Only folder-selected notes or notes with `taskmate-source: true` are eligible for task extraction. `taskmate-source: false` overrides folder inclusion. Managed Task, Project, Proposal folders and Obsidian configuration are excluded. Scope remains independent of the proposal output location.

Inventory every possible action before proposing create, merge, or exclude. Every candidate belongs to exactly one coverage mapping, including candidates the agent considers informational or redundant. Source identity is part of candidate identity; identical text in two notes cannot cover each other. An exclusion needs an explicit user decision and reason.

A multi-note review stages proposals under the configured proposal folder's Active area. Staging creates no canonical Tasks. Approval/revision promotes only the selected proposals; unspecified proposals remain pending. Partial review stays active. Once all decisions are recorded, source provenance is updated and the session moves to Archive. Archives remain until explicitly removed.

Recheck source snapshots and pending merge targets before promotion. Changed content requires renewed review. Repeating an already recorded decision must not duplicate the promoted Task. Preserve unrelated source prose/properties and existing task associations. Do not invent dates, priorities, labels or projects without source/request authority.

## Current discovery limitation

The Python helper currently enumerates Vault Markdown and reads non-managed notes to determine their eligibility. The allowlist limits extraction, but this implementation does **not** guarantee that unrelated note content is never read during discovery. The stricter no-unrelated-read guarantee is proposed in [Source note index](source-note-index.md); do not describe it as shipped. [Vault registration](agent-vault-setup.md) is also proposed, so current use still needs a known Vault/workspace.

## Acceptance and evidence

- IMPORT-01: Two notes produce one review with every candidate accounted for; staging creates zero Tasks.
- IMPORT-02: Approve one proposal, defer others, then complete review; retries do not duplicate Tasks.
- IMPORT-03: Exclusions require decisions; changed sources block promotion.
- IMPORT-04: Final provenance retains IDs from earlier imports and from all approved proposals.

Evidence: [proposal behavior tests](../../../skills/taskmate/tests/test_proposal_store.py), [store behavior tests](../../../skills/taskmate/tests/test_todo_store.py). These deterministic tests do not prove an agent extracted every semantic action; review actual notes against the coverage inventory.

## Processing flow and internal design

The agent inventories semantic action candidates and writes the review plan. [todo_store.py](../../../skills/taskmate/scripts/todo_store.py) discovers eligible notes and computes provenance hashes. [proposal_store.py](../../../skills/taskmate/scripts/proposal_store.py) validates the manifest, stages review/proposal files, and applies explicit decisions. Exact plan and decision formats live in the portable [proposal workflow](../../../skills/taskmate/references/proposal-workflow.md).

Stage validates candidate coverage before writing the session. Snapshots bind the plan to Source content and pending merge targets. Promote rechecks snapshots, processes each submitted decision, and records its resulting Task ID. Remaining pending decisions keep the session Active. After all decisions, provenance combines prior IDs and promoted IDs, then the session moves to Archive.

## Failure handling and limitations

Individual helper writes use temporary-file replacement, but multiple Tasks, decision records, source metadata and archive moves do not form one transaction. A normal retry after recorded decisions is idempotent. A crash between Task creation and recording its promoted ID may require manual reconciliation; do not promise exactly-once crash recovery or automatic rollback. Inspect the session and actual Tasks before retrying uncertain writes.

Manifest validation checks declared candidates, not whether the agent understood all actions in prose. Human coverage review remains necessary. Indexed discovery and automatic Vault setup are separate proposed features, not alternate current implementations.

## Related RFCs

- [RFC 0004: Add coverage-review examples and omission failure cases](../rfcs/0004-add-coverage-review-examples-and-failure-cases.md) — implemented history for candidate-manifest validation and examples.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：許可リスト・ステージ・coverageの既存ADRで決定済み。提案と反映は実装済み、索引探索は未実装です。

フォルダーで選択したノート、または`taskmate-source: true`だけが抽出対象です。`false`はフォルダー許可より優先し、Task・Project・Proposal・Obsidian設定は対象外です。

すべての行動候補を棚卸しし、作成・統合・除外のいずれかへ正確に一度割り当てます。別ノートの同じ文は別候補です。情報的・重複と判断した候補も黙って落とさず、除外は理由と明示判断を必要とします。

複数メモを一つのcoverage reviewにまとめ、Activeへステージします。この段階では正式タスクを作りません。承認・修正されたものだけを反映し、未指定は保留、部分判断はActiveのまま、全件判断後にprovenanceを更新してArchiveへ移します。Archiveは明示削除まで残ります。反映前にSourceと未判断の統合先を再確認し、変更があれば再レビューします。再実行で二重作成せず、本文、無関係なProperty、以前の関連Task IDを保ちます。根拠のない日付・優先度・ラベル・所属は付けません。

現在のPython探索は管理領域以外のMarkdownを読み、適格性を判定します。「対象外を一切読まない」は現在の保証ではありません。[索引](source-note-index.md)と[Vault登録](agent-vault-setup.md)は提案・未実装です。

Agentが候補一覧とreview planを作り、todo storeが対象探索とprovenance hash、proposal storeがcoverage検証・stage・明示判断の反映を担当します。個別writeは一時ファイル置換を使いますが、複数Task、判断記録、Source metadata、Archive移動は一つのtransactionではありません。Task作成と反映ID記録の間で中断した場合は手動照合が必要になり得るため、完全な一度限り実行や自動rollbackは保証しません。

IMPORT-01：複数メモの全候補を一つのレビューへまとめ、ステージではTaskを作らない。IMPORT-02：部分承認と残りの判断、再実行で重複しない。IMPORT-03：除外判断とSource変更検出を必須にする。IMPORT-04：過去と今回の関連IDを保つ。自動テストだけではAIの意味的な抽出漏れを証明できず、元メモとの照合も必要です。
