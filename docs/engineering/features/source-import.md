# Source-note import

Approval: Accepted — [allowlist ADR](../adr/0004-opt-in-source-notes.md), [staging ADR](../adr/0011-stage-source-imports-before-promotion.md), and [coverage ADR](../adr/0017-require-a-candidate-manifest-for-coverage-review.md).
Implementation: Staging and promotion implemented; indexed discovery is not implemented.

## Contract

Source selection and provenance properties follow [Source note property format](../specifications/source-note-properties.md). Canonical Tasks created or updated by promotion follow [Task file format](../specifications/task-file-format.md); these are different property classes stored on different document roles.

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

Evidence: [Task Pilot proposal behavior tests](../../../skills/taskpilot/tests/test_proposal_store.py), [Task Pilot store behavior tests](../../../skills/taskpilot/tests/test_todo_store.py). These deterministic tests do not prove an agent extracted every semantic action; review actual notes against the coverage inventory.

## Processing flow and internal design

Task Pilot inventories semantic action candidates and writes the review plan. [todo_store.py](../../../skills/taskpilot/scripts/todo_store.py) discovers eligible notes and computes provenance hashes. [proposal_store.py](../../../skills/taskpilot/scripts/proposal_store.py) validates the manifest, stages review/proposal files, and applies explicit decisions. Exact plan and decision formats live in Task Pilot's [proposal workflow](../../../skills/taskpilot/references/proposal-workflow.md).

Stage validates candidate coverage before writing the session. Snapshots bind the plan to Source content and pending merge targets. Promote rechecks snapshots, processes each submitted decision, and records its resulting Task ID. Remaining pending decisions keep the session Active. After all decisions, provenance combines prior IDs and promoted IDs, then the session moves to Archive.

## Failure handling and limitations

Individual helper writes use temporary-file replacement, but multiple Tasks, decision records, source metadata and archive moves do not form one transaction. A normal retry after recorded decisions is idempotent. A crash between Task creation and recording its promoted ID may require manual reconciliation; do not promise exactly-once crash recovery or automatic rollback. Inspect the session and actual Tasks before retrying uncertain writes.

Manifest validation checks declared candidates, not whether the agent understood all actions in prose. Human coverage review remains necessary. Indexed discovery and automatic Vault setup are separate proposed features, not alternate current implementations.

## Pending changes

[RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md), tracked by [Issue #62](https://github.com/tempu-village/taskmate/issues/62) with the Source candidate slice in [Issue #61](https://github.com/tempu-village/taskmate/issues/61), is accepted but not implemented. It proposes replacing each new `Active/<session>/Review.md` plus candidate-note set with one versioned Source candidate Proposal JSON and a TaskMate-native Review View. The proposed UI keeps complete coverage, supports per-candidate create/merge/exclude/hold decisions, shows merge evidence inside the candidate card, and separates decision selection from formal apply.

Under the RFC, `taskmate-import-*` provenance keeps its meaning but would be written once per Source note after all of its candidates are applied or excluded; partial progress would stay in the Proposal. Existing Active/Archive files would not be migrated, moved, or deleted. The new Review View would not enumerate legacy Markdown reviews. Until the replacement is implemented and verified, the Active/Archive workflow in this Feature remains the current authority.

## Related RFCs

- [RFC 0004: Add coverage-review examples and omission failure cases](../rfcs/0004-add-coverage-review-examples-and-failure-cases.md) — implemented history for candidate-manifest validation and examples.
- [RFC 0033: Reviewable rolling plans and Source candidate reviews](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md) — accepted replacement design; not implemented.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：許可リスト・ステージ・coverageの既存ADRで決定済み。提案と反映は実装済み、索引探索は未実装です。

ソース選択と取り込み履歴のPropertyは[Source note property format](../specifications/source-note-properties.md)、正式反映されるTaskは[Task file format](../specifications/task-file-format.md)に従います。両者は異なる文書役割のPropertyです。

フォルダーで選択したノート、または`taskmate-source: true`だけが抽出対象です。`false`はフォルダー許可より優先し、Task・Project・Proposal・Obsidian設定は対象外です。

すべての行動候補を棚卸しし、作成・統合・除外のいずれかへ正確に一度割り当てます。別ノートの同じ文は別候補です。情報的・重複と判断した候補も黙って落とさず、除外は理由と明示判断を必要とします。

複数メモを一つのcoverage reviewにまとめ、Activeへステージします。この段階では正式タスクを作りません。承認・修正されたものだけを反映し、未指定は保留、部分判断はActiveのまま、全件判断後にprovenanceを更新してArchiveへ移します。Archiveは明示削除まで残ります。反映前にSourceと未判断の統合先を再確認し、変更があれば再レビューします。再実行で二重作成せず、本文、無関係なProperty、以前の関連Task IDを保ちます。根拠のない日付・優先度・ラベル・所属は付けません。

現在のPython探索は管理領域以外のMarkdownを読み、適格性を判定します。「対象外を一切読まない」は現在の保証ではありません。[索引](source-note-index.md)と[Vault登録](agent-vault-setup.md)は提案・未実装です。

Agentが候補一覧とreview planを作り、todo storeが対象探索とprovenance hash、proposal storeがcoverage検証・stage・明示判断の反映を担当します。個別writeは一時ファイル置換を使いますが、複数Task、判断記録、Source metadata、Archive移動は一つのtransactionではありません。Task作成と反映ID記録の間で中断した場合は手動照合が必要になり得るため、完全な一度限り実行や自動rollbackは保証しません。

### 保留中の変更

[RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md)は[Issue #62](https://github.com/tempu-village/taskmate/issues/62)で追跡し、Source候補部分は[Issue #61](https://github.com/tempu-village/taskmate/issues/61)で実装します。合意済みですが未実装です。新しく作るレビューを、`Active/<session>/Review.md`と候補ノートの組み合わせから、1セッション1つのSource候補Proposal JSONとTaskMate内のReview Viewへ置き換える提案です。候補ごとの作成・統合・除外・保留、カード内の統合差分、判断選択と正式反映の分離を含みます。

RFCでは、`taskmate-import-*`の意味は変えず、そのノートの候補がすべて反映済みか除外になった時点でノートごとに1回だけ書き、途中経過はProposalに残します。既存Active/Archiveファイルは移行・移動・削除せず、新UIでは列挙しません。実装と検証が完了するまでは、上記の現在のActive/Archive方式が正本です。

IMPORT-01：複数メモの全候補を一つのレビューへまとめ、ステージではTaskを作らない。IMPORT-02：部分承認と残りの判断、再実行で重複しない。IMPORT-03：除外判断とSource変更検出を必須にする。IMPORT-04：過去と今回の関連IDを保つ。自動テストだけではAIの意味的な抽出漏れを証明できず、元メモとの照合も必要です。
