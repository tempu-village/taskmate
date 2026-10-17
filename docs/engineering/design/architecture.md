# Architecture

Status: Current implementation map.

## Components

[main.ts](../../../src/main.ts) owns plugin startup, settings, commands and Vault event subscriptions. It constructs Task/Project repositories and refreshes views when managed files change. [settings.ts](../../../src/settings.ts) owns plugin settings; source indexing and machine-local Vault registration are not implemented.

[view.ts](../../../src/view.ts) is the Obsidian ItemView adapter. It loads domain data, owns navigation/filter/selection state, opens modals and dispatches persistence actions. [task-list-model.ts](../../../src/task-list-model.ts) builds pure display sections; [task-list-renderer.ts](../../../src/task-list-renderer.ts) renders DOM and owns listeners/Sortable cleanup. Rendering emits intent; repository writes remain in the adapter/repositories.

[domain.ts](../../../src/domain.ts) owns Task/Project types and pure filtering, grouping and sorting. [repository.ts](../../../src/repository.ts) and [project-repository.ts](../../../src/project-repository.ts) use public Obsidian APIs; [markdown.ts](../../../src/markdown.ts), [task-body.ts](../../../src/task-body.ts) and [project-markdown.ts](../../../src/project-markdown.ts) handle portable representation.

`src/reviews/task-change/` is the Task change review feature Module. [proposal.ts](../../../src/reviews/task-change/proposal.ts) is its pure Domain implementation: it validates evidence, derives TaskMate-owned jsdiff hunks, checks exact patch replay and calculates approved writes and follow-up Proposals. Its stale guard compares complete Markdown, so a concurrent `rank` update from Manual order is preserved by returning a regenerated follow-up rather than merging a write against the old snapshot. [proposal-repository.ts](../../../src/reviews/task-change/proposal-repository.ts) is the Persistence Adapter for pending/history Vault storage and stale-checked writes. [review-renderer.ts](../../../src/reviews/task-change/review-renderer.ts) owns DOM rendering and emits review intent without persistence; [review-scroll.ts](../../../src/reviews/task-change/review-scroll.ts) preserves list position; [review-view.ts](../../../src/reviews/task-change/review-view.ts) is the Obsidian UI Adapter and coordinates the concrete repository, renderer and ItemView lifecycle on desktop and mobile. The protocol handler in `main.ts` accepts stable identifiers and can reveal a review but cannot approve or write.

The dependency direction is `main.ts → review-view.ts → proposal-repository.ts / review-renderer.ts / review-scroll.ts`, with the repository and renderer depending on `proposal.ts`. The pure Proposal Domain depends on the existing Task/Markdown Domain but not on Obsidian, DOM, or Vault. The type-only `review-view.ts → main.ts` reference is erased at runtime. No `reviews/shared` Module exists because only one implemented review kind currently proves common semantics; a future review kind can be added as a sibling without changing the Task change Proposal Domain. [Module boundaries](module-boundaries.md) owns the dependency and Interface rules that this map applies.

Task Pilot, the [portable agent skill](../../../skills/taskpilot/SKILL.md), runs separately in an agent host. Its Python helpers operate on the same Markdown contract; they are not bundled plugin runtime dependencies.

## Change boundaries

Use browser/public Obsidian APIs in plugin runtime; Node/Python belong to build and external tooling. Preserve renderer teardown on rerender/close. Update both Markdown writers when changing a format, using [data ownership](data-model.md). Consult [source import](../features/source-import.md) or [edit conflicts](../features/edit-conflicts.md) when changing those flows.

## Evidence

[Model tests](../../../test/task-list-model.test.ts), [renderer tests](../../../test/task-list-renderer.test.ts) and [mobile layout tests](../../../test/mobile-layout.test.ts) cover selected boundaries. Device verification remains separate.

[Proposal tests](../../../test/reviews/task-change/proposal.test.ts), [Proposal repository tests](../../../test/reviews/task-change/proposal-repository.test.ts), [review renderer tests](../../../test/reviews/task-change/review-renderer.test.ts), and [Module boundary tests](../../../test/reviews/review-module-boundaries.test.ts) cover deterministic evidence, partial approval, isolated stale/write failures, history/follow-up persistence, DOM intent, import cycles and forbidden shared-to-feature dependencies. Task Pilot tests cover macOS, Windows, and Linux URI dispatch without invoking a shell. The macOS direct-URI spike is manual evidence; fresh Windows/Linux URI delivery and mobile visual verification remain gaps.

## Related RFCs

- [Establish a minimal presentation seam for TaskMate views](../rfcs/establish-minimal-view-presentation-seam.md) — implemented historical rationale for the model/renderer boundary.
- [Use jsdiff as the diff engine for Task change previews](../rfcs/0032-use-jsdiff-for-task-change-preview.md) — implemented rationale for Task change Proposal review.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

現在の構成を記録します。mainは起動、設定、コマンド、Vaultイベントを管理し、viewは画面状態、データ取得、操作と保存を調整します。task-list-modelは表示モデル、task-list-rendererはDOMとSortableの後片付けを担います。domainは型と純粋な絞り込み・並べ替え、repositoryは公開Obsidian APIを使った保存、Markdown関連モジュールは表現を扱います。

Task変更Reviewは`src/reviews/task-change/`へ集約します。`proposal.ts`は純粋Domain、`proposal-repository.ts`はVault Persistence Adapter、`review-renderer.ts`と`review-scroll.ts`はDOM表示と位置保持、`review-view.ts`はObsidian UI Adapterです。依存はUIとPersistence AdapterからDomainへ向け、DomainからObsidian、DOM、Vaultへは向けません。実装済みReviewが一種類だけなので、推測による`reviews/shared`や共通interfaceは作りません。依存方向とInterfaceの規則は[module boundaries](module-boundaries.md)を正本とします。

Task PilotとPython helperは別のホストで同じMarkdown契約を操作します。Proposalのstale判定はMarkdown全体を比較するため、Manual orderによる`rank`の並行更新も古い書き込みと混ぜず、現在の内容を基準にしたfollow-upへ戻します。プラグイン実行時へNode/Pythonを持ち込まず、描画の破棄処理を保ち、形式変更時は双方のwriterを更新します。型・モデル・DOMテストと実機検証の範囲は[testing](testing.md)で区別します。
