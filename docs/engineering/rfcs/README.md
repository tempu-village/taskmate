# RFCs

RFCs are Git-managed reviews and decision history for substantial changes, from proposal through the implementation decision. They may contain the problem, goals, non-goals, proposed behavior, design decisions, alternatives, constraints, migration and acceptance conditions. An RFC is never the current product or implementation authority.

Issue, RFC, Specification, Design and ADR have distinct responsibilities:

| Record | Owns |
| --- | --- |
| GitHub Issue | Change entry point, scope, priority, discussion, progress and pull-request links; the source of truth for work tracking |
| RFC | Unsettled proposal, alternatives, migration and decision history for a substantial change |
| Feature | Current feature What and feature-specific How |
| Specification | Strict normative technical contracts shared across features |
| Design | Cross-cutting internal structure and engineering policy |
| ADR | Important, hard-to-reverse design decisions and their rationale |

RFCs do not duplicate Issue requirements, work tasks, progress checklists or status tracking. Link the tracking Issue when one exists. `accepted` means agreement on direction; it does not guarantee implementation, release or exact agreement with the final design. During implementation, make material departures traceable in an RFC amendment, a follow-up RFC or the implementation pull request. Do not silently rewrite the accepted proposal.

When product behavior is implemented, create or update its [Feature](../features/README.md) from the behavior confirmed by implementation, tests and review, then link both directions and move the RFC to `implemented`. Put shared strict contracts in [Specifications](../specifications/README.md), cross-cutting structure in [Design](../design/README.md), operational behavior in [Operations](../../operations/README.md), and durable rationale in an [ADR](../adr/README.md) when needed. Keep the RFC substantially unchanged as decision-process history after implementation.

## RFC lifecycle

1. **Write the proposal in an RFC.** Record the problem, proposed design, alternatives and comparison, open questions and acceptance conditions. Keep the RFC in `draft` while these points are under review.
2. **Review and decide.** Resolve the open questions and move the RFC from `draft` to `accepted` once the direction is agreed. `accepted` authorizes implementation; it does not claim that implementation is complete.
3. **Implement the accepted design.** Keep material departures from the accepted design traceable in an RFC amendment, a follow-up RFC or the implementation pull request. Do not silently rewrite the accepted proposal.
4. **Update the current authorities from the implemented result.** Describe confirmed user-visible behavior and feature-specific processing in a Feature; strict schemas, state transitions and compatibility contracts in a Specification; cross-cutting current structure in Design; and only hard-to-reverse, consequential decisions in an ADR. Derive these records from code, tests and review, not from the proposal alone.
5. **Mark the RFC `implemented`.** Add reciprocal links to the current authorities and link the implementation pull request or verified release when available. Preserve the RFC as the history of why the design was chosen.

Do not move an RFC directly from proposal to current authority. For example, RFC 0032 remains the home for its proposal, alternatives and decision history until agreement and implementation; only the confirmed current behavior and contracts are promoted to Feature, Specification or Design afterward.

| RFC | Status | Current authority |
| --- | --- | --- |
| [0003 Establish reproducible GitHub releases](0003-establish-reproducible-github-releases.md) | implemented | [Releasing](../../operations/releasing.md) |
| [0004 Coverage review examples](0004-add-coverage-review-examples-and-failure-cases.md) | implemented | [Source import](../features/source-import.md) |
| [0005 Prevent stale task overwrites](0005-prevent-stale-task-overwrites.md) | implemented | [Edit conflicts](../features/edit-conflicts.md) |
| [0012 Explicit multi-select mode](0012-add-explicit-multi-select-mode.md) | implemented | [Task editing](../features/task-editing.md) |
| [0015 Simplify date views](0015-simplify-date-views-and-filter-completed-tasks.md) | implemented | [Filtering and sorting](../features/filtering-and-sorting.md) |
| [0018 Apply filters to current list](0018-apply-filters-to-current-task-list.md) | implemented | [Filtering and sorting](../features/filtering-and-sorting.md) |
| [0023 Mobile editor keyboard](0023-mobile-task-editor-keyboard.md) | implemented | [Mobile layout](../features/mobile-layout.md) |
| [0024 Compact editor fields](0024-compact-task-editor-fields.md) | implemented | [Task editing](../features/task-editing.md) |
| [0025 Reuse label picker](0025-reuse-label-picker-in-task-editor.md) | implemented | [Labels](../features/labels.md) |
| [0026 Focus ring](0026-use-one-focus-ring-for-task-editor-label-input.md) | superseded | [Labels](../features/labels.md) |
| [0027 Scheduled-date sorting](0027-scheduled-date-sort-ignores-section-order.md) | implemented | [Filtering and sorting](../features/filtering-and-sorting.md) |
| [0028 Long task titles](0028-prevent-long-task-titles-from-scrolling-mobile-lists-horizontally.md) | superseded | [Task editing](../features/task-editing.md) |
| [0030 Preserve list scroll](0030-preserve-task-list-scroll-position-during-multi-selection.md) | implemented | [Task editing](../features/task-editing.md) |
| [0031 Title disclosure](0031-fix-title-disclosure-and-two-line-clipping.md) | implemented | [Task editing](../features/task-editing.md) |
| [0032 Task change preview diff engine](0032-use-jsdiff-for-task-change-preview.md) | implemented | [Task change review](../features/task-change-review/README.md) |
| [0033 Reviewable rolling plans and Source candidate reviews](0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md) | accepted | — (not implemented) |
| [Reproducible development environment](document-reproducible-development-environment.md) | draft | [Testing design](../design/testing.md) |
| [Minimal view presentation seam](establish-minimal-view-presentation-seam.md) | implemented | [Architecture design](../design/architecture.md) |
| [Sorting and editor sizing](improve-sorting-and-task-editor-sizing.md) | implemented | [Filtering and sorting](../features/filtering-and-sorting.md) |
| [Task deletion in editor footer](move-task-deletion-to-editor-footer.md) | implemented | [Task editing](../features/task-editing.md) |

Every RFC uses YAML frontmatter with these fields:

```yaml
status: draft # draft | accepted | implemented | rejected | superseded
tracking-issue: 39
current-authority: ../features/example.md
```

Status is one of `draft`, `accepted`, `implemented`, `rejected` or `superseded`. `draft` is under review. `accepted` records agreement on direction but claims neither implementation nor release and may differ from the final design. `implemented` means the adopted change landed; `rejected` and `superseded` retain non-current history. `current-authority` points to the maintained Feature, Specification, Operations record or cross-cutting Design and is required for `implemented`. Use `related-features` for every affected Feature not already named by `current-authority`. The documentation validator checks status values, authority paths and Feature backlinks. Do not leave adopted current guarantees or internal design only in an RFC.

## From implemented RFC to current Feature

1. Confirm the current behavior in implementation, tests and review; do not infer it only from the accepted proposal.
2. Create or update the Feature with available capabilities, rules, constraints, persisted representation and relationships to other features.
3. Keep RFC-specific background, alternatives and migration history in the RFC and link to it as background/design history.
4. Add the implemented Feature, implementation pull request and release information (when verified) to the RFC. Add the RFC backlink to the Feature.
5. Set the RFC status to `implemented`. Preserve later material corrections as explicit amendments or follow-up records rather than rewriting history.

This Feature step is required for RFCs that change product capabilities. Purely operational or cross-cutting engineering RFCs instead link to their maintained Operations or Design authority; they do not create a misleading product Feature.

## RFC template

Use [the lightweight RFC template](../../templates/rfc.md). At minimum, include Summary, Background / Problem, Goals, Non-goals, Alternatives considered, Proposed design, Open questions, Decision / status and Links. The Links section should cover the Tracking Issue, Current specification, Current design, ADRs and Verification evidence where applicable.

## 日本語参考

<!-- translation-status: ai-translated -->

RFCは大きな変更の提案から実装判断まで、背景、目的、非目標、提案設計、制約、代替案、移行、受け入れ条件、判断理由を残す履歴です。状態は`draft`、`accepted`、`implemented`、`rejected`、`superseded`です。`accepted`は方針への合意であり、実装・リリース・最終設計との完全一致を保証しません。実装中の重要な差分はRFC追記、後続RFC、または実装PRで追跡可能にします。Issueの作業管理を複製せず、実装後は確定した現行動作をFeatureへ反映して相互リンクし、RFC自体は大きく書き換えず判断履歴として残します。運用・横断設計だけを扱うRFCは、Featureを無理に作らずOperationsまたはDesignを現在の正本にします。

### RFCの進行手順

1. **RFCに提案を書く。** 解決する問題、提案設計、選択肢と比較、未決事項、受け入れ条件を記録し、レビュー中は`draft`にします。
2. **レビューして決める。** 未決事項について合意し、方針が決まったら`accepted`にします。`accepted`は実装開始の合意であり、実装完了を意味しません。
3. **合意した設計を実装する。** 実装中の重要な変更はRFCの追記、後続RFC、または実装PRに記録し、合意済みの提案を黙って書き換えません。
4. **実装結果を現在仕様の正本へ反映する。** コード、テスト、レビューで確認した結果を基に、ユーザーから見た挙動と機能固有の処理はFeature、schema・状態遷移・互換性などの厳密な契約はSpecification、横断的な現在構造はDesignへ反映します。戻しにくい重要判断だけ、必要に応じてADRへ残します。
5. **RFCを`implemented`にする。** 現在仕様の正本と相互リンクし、利用可能なら実装PRまたは確認済みreleaseもリンクします。RFCは「なぜその設計を選んだか」という判断履歴として残します。

たとえばRFC 0032では、合意と実装までは提案・比較・判断履歴をRFC 0032へ統合します。実装後に確定した現在の挙動と契約だけをFeature、Specification、Designへ反映します。
