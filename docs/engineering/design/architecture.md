# Architecture

Status: Current implementation map.

## Components

[main.ts](../../../src/main.ts) owns plugin startup, settings, commands and Vault event subscriptions. It constructs Task/Project repositories and refreshes views when managed files change. [settings.ts](../../../src/settings.ts) owns plugin settings; source indexing and machine-local Vault registration are not implemented.

[view.ts](../../../src/view.ts) is the Obsidian ItemView adapter. It loads domain data, owns navigation/filter/selection state, opens modals and dispatches persistence actions. [task-list-model.ts](../../../src/task-list-model.ts) builds pure display sections; [task-list-renderer.ts](../../../src/task-list-renderer.ts) renders DOM and owns listeners/Sortable cleanup. Rendering emits intent; repository writes remain in the adapter/repositories.

[domain.ts](../../../src/domain.ts) owns Task/Project types and pure filtering, grouping and sorting. [repository.ts](../../../src/repository.ts) and [project-repository.ts](../../../src/project-repository.ts) use public Obsidian APIs; [markdown.ts](../../../src/markdown.ts), [task-body.ts](../../../src/task-body.ts) and [project-markdown.ts](../../../src/project-markdown.ts) handle portable representation.

The [Agent Skill](../../../skills/taskmate/SKILL.md) runs separately in an agent host. Its Python helpers operate on the same Markdown contract; they are not bundled plugin runtime dependencies.

## Change boundaries

Use browser/public Obsidian APIs in plugin runtime; Node/Python belong to build and external tooling. Preserve renderer teardown on rerender/close. Update both Markdown writers when changing a format, using [data ownership](data-model.md). Consult [source import](../features/source-import.md) or [edit conflicts](../features/edit-conflicts.md) when changing those flows.

## Evidence

[Model tests](../../../test/task-list-model.test.ts), [renderer tests](../../../test/task-list-renderer.test.ts) and [mobile layout tests](../../../test/mobile-layout.test.ts) cover selected boundaries. Device verification remains separate.

## Related RFCs

- [Establish a minimal presentation seam for TaskMate views](../rfcs/establish-minimal-view-presentation-seam.md) — implemented historical rationale for the model/renderer boundary.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

現在の構成を記録します。mainは起動、設定、コマンド、Vaultイベントを管理し、viewは画面状態、データ取得、操作と保存を調整します。task-list-modelは表示モデル、task-list-rendererはDOMとSortableの後片付けを担います。domainは型と純粋な絞り込み・並べ替え、repositoryは公開Obsidian APIを使った保存、Markdown関連モジュールは表現を扱います。

Agent SkillとPython helperは別のホストで同じMarkdown契約を操作します。プラグイン実行時へNode/Pythonを持ち込まず、描画の破棄処理を保ち、形式変更時は双方のwriterを更新します。型・モデル・DOMテストと実機検証の範囲は[testing](testing.md)で区別します。
