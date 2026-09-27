# RFCs

RFCs are Git-managed reviews for unsettled substantial changes. They may contain background, goals, non-goals, proposed behavior, detailed internal design, alternatives, migration and test plans. An RFC is never the current product or implementation authority.

Issue, RFC, Specification, Design and ADR have distinct responsibilities:

| Record | Owns |
| --- | --- |
| GitHub Issue | Change entry point, scope, priority, discussion, progress and pull-request links; the source of truth for work tracking |
| RFC | Unsettled proposal, alternatives, migration and decision history for a substantial change |
| Feature | Current feature What and feature-specific How |
| Specification | Strict normative technical contracts shared across features |
| Design | Cross-cutting internal structure and engineering policy |
| ADR | Important, hard-to-reverse design decisions and their rationale |

RFCs do not duplicate Issue requirements, work tasks, progress checklists or status tracking. Link the tracking Issue when one exists. When an RFC is accepted or implemented, reflect current What and How in [Features](../features/README.md), shared strict contracts in [Specifications](../specifications/README.md), and durable rationale in an [ADR](../adr/README.md) when needed. Keep the RFC as decision-process history.

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
| [Reproducible development environment](document-reproducible-development-environment.md) | proposed | [Testing design](../design/testing.md) |
| [Minimal view presentation seam](establish-minimal-view-presentation-seam.md) | implemented | [Architecture design](../design/architecture.md) |
| [Sorting and editor sizing](improve-sorting-and-task-editor-sizing.md) | implemented | [Filtering and sorting](../features/filtering-and-sorting.md) |
| [Task deletion in editor footer](move-task-deletion-to-editor-footer.md) | implemented | [Task editing](../features/task-editing.md) |

Every RFC uses YAML frontmatter with these fields:

```yaml
status: proposed # proposed | accepted | implemented | rejected | superseded
tracking-issue: 39
current-authority: ../features/example.md
```

Status is one of `proposed`, `accepted`, `implemented`, `rejected` or `superseded`. `accepted` means the design was agreed but does not claim implementation; `implemented` means the adopted change landed; `rejected` and `superseded` retain non-current history. `current-authority` points to the maintained Feature, Specification, operations record or cross-cutting Design. Use `related-features` when more than one Feature is relevant. The documentation validator checks status values, authority paths and Feature backlinks. Do not leave adopted current guarantees or internal design only in an RFC.

## RFC template

Use [the lightweight RFC template](../../templates/rfc.md). At minimum, include Summary, Background / Problem, Goals, Non-goals, Alternatives considered, Proposed design, Open questions, Decision / status and Links. The Links section should cover the Tracking Issue, Current specification, Current design, ADRs and Verification evidence where applicable.

## 日本語参考

<!-- translation-status: ai-translated -->

RFCは未確定の大きな変更について、背景、目的、非目標、提案設計、内部設計、代替案、移行、テスト計画、判断理由を残すレビュー文書です。各RFCはYAML frontmatterで`proposed`、`accepted`、`implemented`、`rejected`、`superseded`の状態と現在の正本を示します。Issueが変更の入口・範囲・優先順位・議論・進捗・PR連携の正本であり、作業タスクや進捗を二重管理しません。採用・実装後は現在のWhatとHowをFeature、横断的な厳密契約をSpecification、長期的な理由を必要に応じてADRへ反映し、RFC自体は履歴として残します。
