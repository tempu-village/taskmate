# Source-note import

Approval: Accepted — [allowlist ADR](../adr/0004-opt-in-source-notes.md), [staging ADR](../adr/0011-stage-source-imports-before-promotion.md), [coverage ADR](../adr/0017-require-a-candidate-manifest-for-coverage-review.md), and [RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md) for the Source candidate review.
Implementation: Staging in Task Pilot and review, editing and formal apply in TaskMate are implemented; indexed discovery is not implemented.

## Contract

The review file and its lifecycle follow [Source candidate Proposal format](../specifications/source-candidate-proposal-format.md). Source selection and provenance properties follow [Source note property format](../specifications/source-note-properties.md). Canonical Tasks created or updated by formal apply follow [Task file format](../specifications/task-file-format.md); these are different property classes stored on different document roles.

Only folder-selected notes or notes with `taskmate-source: true` are eligible for task extraction. `taskmate-source: false` overrides folder inclusion. Managed Task, Project, Proposal and rolling-plan folders and Obsidian configuration are excluded. Scope remains independent of the proposal output location.

Inventory every statement that could imply an action before proposing create, merge, or exclude. Every statement belongs to exactly one candidate, including statements the agent considers informational or redundant. Source identity is part of statement identity; identical text in two notes cannot cover each other. An exclusion needs a reason and the user's decision in TaskMate.

Task Pilot stages one Source candidate review JSON under the configured proposal folder for each review. Staging creates no canonical Tasks, candidate Markdown or `Review.md`. The user reads, edits and decides every candidate in TaskMate's Source candidate Review View, opened from the shared review list or the review URI, and applies approved candidates through a separate confirmation. Held and undecided candidates remain pending, and a partly applied review stays in the pending list. Provenance is written once per Source note when every candidate from that note is applied, and a fully applied review moves to the proposal folder's `History` area, where it remains until the user removes it.

Formal apply rechecks Source snapshots and merge targets. A changed Source or target blocks only its own candidates, which then need renewed review. Retrying never duplicates a created Task or a merge. Preserve unrelated source prose and properties and existing Task associations. Do not invent dates, priorities, labels or projects without source or request authority.

Reviews staged by earlier versions as Markdown under the proposal folder's `Active` and `Archive` areas are retired. TaskMate does not list them, and Task Pilot no longer reads, promotes or writes them. They are never migrated, moved or deleted; the user can read them as ordinary notes or stage a new review from their source notes.

## Current discovery limitation

The Python helper currently enumerates Vault Markdown and reads non-managed notes to determine their eligibility. The allowlist limits extraction, but this implementation does **not** guarantee that unrelated note content is never read during discovery. The stricter no-unrelated-read guarantee is proposed in [Source note index](source-note-index.md); do not describe it as shipped. [Vault registration](agent-vault-setup.md) is also proposed, so current use still needs a known Vault/workspace.

## Acceptance and evidence

- IMPORT-01: Two notes produce one review with every statement mapped to exactly one candidate; staging creates zero Tasks and no Markdown review files.
- IMPORT-02: Applying one candidate while others are held keeps the review pending; applying the rest moves it to History; retries do not duplicate Tasks or merges.
- IMPORT-03: Exclusions require the user's decision; a changed Source or merge target blocks only its own candidates.
- IMPORT-04: Provenance is written once per completed note with its created and merge-target Task IDs, keeping IDs from earlier imports.
- IMPORT-05: Reviews from earlier versions under `Active` and `Archive` stay byte-for-byte unchanged and are not listed.

Evidence: Task Pilot [staging tests](../../../skills/taskpilot/tests/test_source_review.py) and [store tests](../../../skills/taskpilot/tests/test_todo_store.py); TaskMate [Source candidate tests](../../../test/reviews/source-candidate/) for the Domain, formal apply, provenance parity, editing and the Review View; and the [Review Catalog tests](../../../test/reviews/shared/review-catalog.test.ts). These deterministic tests do not prove an agent extracted every semantic action; review actual notes against the statement inventory.

## Processing flow and internal design

Task Pilot inventories semantic action candidates and writes the staging request. [todo_store.py](../../../skills/taskpilot/scripts/todo_store.py) discovers eligible notes. [source_review.py](../../../skills/taskpilot/scripts/source_review.py) checks that every inventory statement occurs in its Source and is mapped exactly once, snapshots Sources and merge targets, and writes the review JSON. The exact request format lives in Task Pilot's [Source candidate review reference](../../../skills/taskpilot/references/source-review-workflow.md).

In TaskMate, the [Source candidate Module](../design/architecture.md) validates the review, records edits and decisions, and formally applies approved candidates, then writes provenance and moves complete reviews to History. The shared review list classifies the file through the Review Catalog and opens it in the Source candidate Review View.

## Failure handling and limitations

Formal apply saves the review after each candidate and stops if a save fails. Created Tasks use an ID derived from the review, candidate and revision, and a merge whose target already equals its result counts as applied, so a retry after an interrupted apply neither duplicates nor re-merges. A provenance write that fails is retried on the next apply. A note that changed after all its candidates were applied receives no provenance and is reported.

Statement validation checks the declared inventory, not whether the agent understood all actions in prose, so human review in TaskMate remains necessary. Indexed discovery and automatic Vault setup are separate proposed features, not alternate current implementations.

## Related RFCs

- [RFC 0004: Add coverage-review examples and omission failure cases](../rfcs/0004-add-coverage-review-examples-and-failure-cases.md) — implemented history for candidate-manifest validation and examples.
- [RFC 0033: Reviewable rolling plans and Source candidate reviews](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md) — implemented history of the current workflow; its contract now lives in [Source candidate Proposal format](../specifications/source-candidate-proposal-format.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：許可リスト・ステージ・coverageの既存ADRと、Source候補レビューについての[RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md)（実装済み）で決定済み。Task Pilotでのステージと、TaskMateでのレビュー・編集・正式反映は実装済みで、索引探索は未実装です。

レビューのファイルとその流れは[Source candidate Proposal format](../specifications/source-candidate-proposal-format.md)、ソース選択と取り込み履歴のPropertyは[Source note property format](../specifications/source-note-properties.md)、正式反映されるTaskは[Task file format](../specifications/task-file-format.md)に従います。両者は異なる文書役割のPropertyです。

フォルダーで選択したノート、または`taskmate-source: true`だけが抽出対象です。`false`はフォルダー許可より優先し、Task・Project・Proposal・rolling planのフォルダーとObsidian設定は対象外です。

行動になり得る文をすべて棚卸しし、作成・統合・除外のいずれかの候補へ正確に一度割り当てます。別ノートの同じ文は別の文として扱います。情報的・重複と判断した文も黙って落とさず、除外には理由と、TaskMateでの利用者の判断が必要です。

Task Pilotは、レビューごとに1つのSource候補レビューJSONを提案フォルダーへステージします。ステージでは正式なTask、候補のMarkdown、`Review.md`を作りません。利用者は、共通のレビュー一覧かレビューのURIから開くTaskMateのSource候補Review Viewで、すべての候補を読み、編集し、判断し、別の確認を経て承認した候補を反映します。保留と未決の候補は未処理のまま残り、一部だけ反映したレビューは未レビューの一覧に残ります。取り込み履歴は、そのノートの候補がすべて反映された時点でノートごとに1回だけ書き、全候補を反映したレビューは提案フォルダーの`History`へ移り、利用者が消すまで残ります。

正式反映ではSourceと統合先のスナップショットを確かめ直します。Sourceや統合先が変わっていれば、その候補だけを止め、再レビューが必要になります。やり直しても、作成したTaskや統合が二重になることはありません。本文、無関係なProperty、既存の関連Taskを保ち、根拠のない日付・優先度・ラベル・所属は付けません。

以前のバージョンが提案フォルダーの`Active`と`Archive`にMarkdownでステージしたレビューは廃止しました。TaskMateは一覧に出さず、Task Pilotも読み込み・反映・書き込みをしません。移行・移動・削除は一切せず、利用者は普通のノートとして読むか、元のノートから新しいレビューをステージできます。

現在のPython探索は管理領域以外のMarkdownを読み、適格性を判定します。「対象外を一切読まない」は現在の保証ではありません。[索引](source-note-index.md)と[Vault登録](agent-vault-setup.md)は提案・未実装です。

Agentが文の棚卸しとステージ用の依頼を作り、todo storeが対象を探し、`source_review.py`が棚卸しの文がSourceにあり正確に一度割り当てられていることを確かめ、Sourceと統合先のスナップショットを取ってレビューJSONを書きます。TaskMateのSource候補Moduleがレビューを検証し、編集と判断を記録し、承認した候補を正式反映して、取り込み履歴を書き、完了したレビューをHistoryへ移します。共通のレビュー一覧はReview Catalogでファイルを分類し、Source候補Review Viewで開きます。

正式反映は候補ごとにレビューを保存し、保存に失敗したらそこで止まります。作るTaskのIDはレビュー・候補・版番号から決まり、統合先が既に結果と同じなら反映済みとみなすため、中断後のやり直しでも二重作成や二重統合は起きません。取り込み履歴の書き込みに失敗した場合は、次の反映でやり直します。全候補の反映後にノートが変わっていた場合は、取り込み履歴を書かずに報告します。棚卸しの検証は宣言された文を確かめるだけで、Agentが文中の行動をすべて理解したかは証明しないため、TaskMateでの人のレビューが必要です。

IMPORT-01：2つのノートから、すべての文を正確に一度候補へ割り当てた1つのレビューを作り、ステージではTaskもMarkdownのレビューファイルも作らない。IMPORT-02：一部の候補だけを反映して他を保留するとレビューは未処理のまま残り、残りを反映するとHistoryへ移り、やり直してもTaskや統合が二重にならない。IMPORT-03：除外には利用者の判断が必要で、Sourceや統合先の変更はその候補だけを止める。IMPORT-04：取り込み履歴は完了したノートごとに1回だけ書き、作成したTaskと統合先のIDを含め、以前の取り込みのIDも保つ。IMPORT-05：`Active`と`Archive`にある以前のバージョンのレビューは1バイトも変わらず、一覧にも出ない。自動テストだけではAIの意味的な抽出漏れを証明できず、元メモとの照合も必要です。
