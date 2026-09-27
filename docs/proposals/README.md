# Proposals

Large-change proposals retain motivation, alternatives and historical scope. Current product guarantees live in [specifications](../engineering/specifications/README.md); internal mechanics live in [design](../engineering/design/README.md). A historical implementation summary does not assert every original checkbox or device scenario was verified. Follow each record's current-authority link.

| Record | Status | Current authority |
| --- | --- | --- |
| [0003-establish-reproducible-github-releases](0003-establish-reproducible-github-releases.md) | Historical — release workflow implemented; no publication implied | [Current record](../operations/releasing.md) |
| [0004-add-coverage-review-examples-and-failure-cases](0004-add-coverage-review-examples-and-failure-cases.md) | Historical — manifest validation and examples implemented | [Current record](../engineering/specifications/source-import.md) |
| [0005-prevent-stale-task-overwrites](0005-prevent-stale-task-overwrites.md) | Historical — core guard implemented, known Step equality gap remains | [Current record](../engineering/specifications/edit-conflicts.md) |
| [0012-add-explicit-multi-select-mode](0012-add-explicit-multi-select-mode.md) | Historical — selection workflow implemented | [Current record](../engineering/specifications/task-editing.md) |
| [0015-simplify-date-views-and-filter-completed-tasks](0015-simplify-date-views-and-filter-completed-tasks.md) | Historical — current navigation implemented | [Current record](../engineering/specifications/filtering-and-sorting.md) |
| [0018-apply-filters-to-current-task-list](0018-apply-filters-to-current-task-list.md) | Historical — current-list filtering implemented | [Current record](../engineering/specifications/filtering-and-sorting.md) |
| [0023-mobile-task-editor-keyboard](0023-mobile-task-editor-keyboard.md) | Historical — keyboard handling implemented; fresh device verification pending | [Current record](../engineering/specifications/mobile-layout.md) |
| [0024-compact-task-editor-fields](0024-compact-task-editor-fields.md) | Historical — compact editor implemented | [Current record](../engineering/specifications/task-editing.md) |
| [0025-reuse-label-picker-in-task-editor](0025-reuse-label-picker-in-task-editor.md) | Historical — picker and chip entry implemented | [Current record](../engineering/specifications/labels.md) |
| [0026-use-one-focus-ring-for-task-editor-label-input](0026-use-one-focus-ring-for-task-editor-label-input.md) | Historical — later chip-input boundaries supersede earlier styling details | [Current record](../engineering/specifications/labels.md) |
| [0027-scheduled-date-sort-ignores-section-order](0027-scheduled-date-sort-ignores-section-order.md) | Historical — section-scope explanation implemented | [Current record](../engineering/specifications/filtering-and-sorting.md) |
| [0028-prevent-long-task-titles-from-scrolling-mobile-lists-horizontally](0028-prevent-long-task-titles-from-scrolling-mobile-lists-horizontally.md) | Superseded — inline disclosure replaced by the 100-grapheme contract | [Current record](../engineering/specifications/task-editing.md) |
| [0030-preserve-task-list-scroll-position-during-multi-selection](0030-preserve-task-list-scroll-position-during-multi-selection.md) | Historical — selection scroll preservation implemented | [Current record](../engineering/specifications/task-editing.md) |
| [0031-fix-title-disclosure-and-two-line-clipping](0031-fix-title-disclosure-and-two-line-clipping.md) | Historical — deterministic title presentation implemented | [Current record](../engineering/specifications/task-editing.md) |
| [document-reproducible-development-environment](document-reproducible-development-environment.md) | Pending — verification guide exists; full environment onboarding not yet delivered | [Current record](../engineering/design/testing.md) |
| [establish-minimal-view-presentation-seam](establish-minimal-view-presentation-seam.md) | Historical — model/renderer separation implemented; illustrative interfaces may differ | [Current record](../engineering/design/architecture.md) |
| [improve-sorting-and-task-editor-sizing](improve-sorting-and-task-editor-sizing.md) | Historical — controls implemented; later editor changes refine sizing | [Current record](../engineering/specifications/filtering-and-sorting.md) |
| [move-task-deletion-to-editor-footer](move-task-deletion-to-editor-footer.md) | Historical — footer deletion implemented | [Current record](../engineering/specifications/task-editing.md) |

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

Proposalは目的・代替案・検討範囲の履歴を残します。現在の保証は[仕様](../engineering/specifications/README.md)、内部構造は[設計](../engineering/design/README.md)へリンクします。Historicalは中心的な変更が実装された記録、Supersededは後の判断で置換された記録、Pendingは未完了です。過去のすべての受け入れ条件や実機検証が完了したという意味ではありません。環境オンボーディングは検証案内を追加しただけで、完全なガイドの完了扱いにはしません。
