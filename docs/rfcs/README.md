# RFCs

RFCs are Git-managed design-review records for substantial changes. They preserve background, goals, non-goals, alternatives, proposed design, unresolved questions and the reasons behind a decision. An RFC is not the current product specification or internal design authority.

Issue, RFC, Specification, Design and ADR have distinct responsibilities:

| Record | Owns |
| --- | --- |
| GitHub Issue | Change entry point, scope, priority, discussion, progress and pull-request links; the source of truth for work tracking |
| RFC | Design review, alternatives, proposed design and decision history for a substantial change |
| Specification | Current product guarantees and explicit proposal state |
| Design | Current internal structure, processing and failure boundaries |
| ADR | Important, hard-to-reverse design decisions and their rationale |

RFCs do not duplicate Issue requirements, work tasks, progress checklists or status tracking. Link the tracking Issue when one exists. RFCs remain as history after implementation; readers should follow the linked Specification and Design for current authority.

| RFC | Status | Current authority |
| --- | --- | --- |
| [0003 Establish reproducible GitHub releases](0003-establish-reproducible-github-releases.md) | Historical | [Releasing](../operations/releasing.md) |
| [0004 Coverage review examples](0004-add-coverage-review-examples-and-failure-cases.md) | Historical | [Source import](../engineering/specifications/source-import.md) |
| [0005 Prevent stale task overwrites](0005-prevent-stale-task-overwrites.md) | Historical | [Edit conflicts](../engineering/specifications/edit-conflicts.md) |
| [0012 Explicit multi-select mode](0012-add-explicit-multi-select-mode.md) | Historical | [Task editing](../engineering/specifications/task-editing.md) |
| [0015 Simplify date views](0015-simplify-date-views-and-filter-completed-tasks.md) | Historical | [Filtering and sorting](../engineering/specifications/filtering-and-sorting.md) |
| [0018 Apply filters to current list](0018-apply-filters-to-current-task-list.md) | Historical | [Filtering and sorting](../engineering/specifications/filtering-and-sorting.md) |
| [0023 Mobile editor keyboard](0023-mobile-task-editor-keyboard.md) | Historical | [Mobile layout](../engineering/specifications/mobile-layout.md) |
| [0024 Compact editor fields](0024-compact-task-editor-fields.md) | Historical | [Task editing](../engineering/specifications/task-editing.md) |
| [0025 Reuse label picker](0025-reuse-label-picker-in-task-editor.md) | Historical | [Labels](../engineering/specifications/labels.md) |
| [0026 Focus ring](0026-use-one-focus-ring-for-task-editor-label-input.md) | Historical | [Labels](../engineering/specifications/labels.md) |
| [0027 Scheduled-date sorting](0027-scheduled-date-sort-ignores-section-order.md) | Historical | [Filtering and sorting](../engineering/specifications/filtering-and-sorting.md) |
| [0028 Long task titles](0028-prevent-long-task-titles-from-scrolling-mobile-lists-horizontally.md) | Superseded | [Task editing](../engineering/specifications/task-editing.md) |
| [0030 Preserve list scroll](0030-preserve-task-list-scroll-position-during-multi-selection.md) | Historical | [Task editing](../engineering/specifications/task-editing.md) |
| [0031 Title disclosure](0031-fix-title-disclosure-and-two-line-clipping.md) | Historical | [Task editing](../engineering/specifications/task-editing.md) |
| [Reproducible development environment](document-reproducible-development-environment.md) | Pending | [Testing design](../engineering/design/testing.md) |
| [Minimal view presentation seam](establish-minimal-view-presentation-seam.md) | Historical | [Architecture design](../engineering/design/architecture.md) |
| [Sorting and editor sizing](improve-sorting-and-task-editor-sizing.md) | Historical | [Filtering and sorting](../engineering/specifications/filtering-and-sorting.md) |
| [Task deletion in editor footer](move-task-deletion-to-editor-footer.md) | Historical | [Task editing](../engineering/specifications/task-editing.md) |

Every RFC should make these fields explicit near the top:

```yaml
status: proposed # proposed | accepted | implemented | rejected | superseded
tracking-issue: 39
current-authority: ../engineering/specifications/example.md
```

`current-authority` points to the maintained Specification or Design. Preserve historical meanings such as `Historical`, `Pending` and `Superseded`, and update the link when current authority changes. Do not move current guarantees or internal design into an RFC merely to preserve history.

## RFC template

Use [the lightweight RFC template](../templates/rfc.md). At minimum, include Summary, Background / Problem, Goals, Non-goals, Alternatives considered, Proposed design, Open questions, Decision / status and Links. The Links section should cover the Tracking Issue, Current specification, Current design, ADRs and Verification evidence where applicable.

## 日本語参考

<!-- translation-status: ai-translated -->

RFCは、大きな変更の背景、目的、非目標、代替案、提案設計、未解決点、判断理由を残す設計レビュー文書です。Issueが変更の入口・範囲・優先順位・議論・進捗・PR連携の正本であり、RFCと作業タスクや進捗チェックリストを二重管理しません。RFCは実装後も履歴として残しますが、現行の保証は仕様、内部構造は設計、重要な固定判断はADRを参照します。各RFCには`status`、`tracking-issue`、`current-authority`を明示します。
