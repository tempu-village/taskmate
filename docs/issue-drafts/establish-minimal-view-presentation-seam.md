# P2: Establish a minimal presentation seam for TaskMate views

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Problem / Goal

`TodoListView` currently owns Obsidian view lifecycle, screen state, repository access, display-data preparation, DOM rendering, task actions, and drag-and-drop cleanup. This works for the current task list, but it makes a future Kanban or calendar view harder to add or later host in a Bases view because data preparation and GUI rendering do not have a reusable boundary.

The goal is to introduce the smallest useful separation now, while the task-list behavior is understood, without creating a generic view framework for features that may never be built.

## Background / Why now

- The repository and pure task-domain operations are already separate in `repository.ts` and `domain.ts`.
- The remaining high-value seam is between the task-list presentation model and its DOM renderer.
- The current task list is rendered from multiple screens, so this seam has value even if Kanban and calendar views are never added.
- Extracting every screen or defining hypothetical Bases adapters now would add indirection without proven requirements.

## Scope

### Included

- Keep `TodoListView` as the ItemView adapter and orchestration owner.
- Extract a pure task-list presentation builder that converts filtered and sorted domain data into render-ready sections and rows.
- Extract task-list DOM rendering and Sortable lifecycle management from `TodoListView`.
- Pass user intent from the renderer through a small action dispatcher; keep repository writes, modal opening, confirmation policy, and view refresh in the orchestrator.
- Reuse the extracted task-list renderer from the existing Date, Search, Project, and Filter screens where they show task results.
- Add focused tests for presentation-model construction and renderer action dispatch.
- Preserve current PC and Android behavior.

### Excluded

- A generic framework for all TaskMate views.
- A `TaskSource` interface or Bases adapter before a second real data source exists.
- Kanban, calendar, or Bases view implementation.
- Splitting every Date, Search, Project, and Filter screen into separate modules.
- Changes to Markdown schema, Task ID, Project ID, manual rank, navigation, UI wording, CSS design, or user-visible behavior.

## Proposed Design

### Responsibility boundary

```text
TodoListView (Obsidian adapter / orchestrator)
├─ owns ItemView lifecycle and screen state
├─ loads tasks and projects from TaskRepository
├─ calls existing domain filtering and sorting
├─ builds the presentation model
├─ handles actions and persistence
└─ destroys the previous renderer before rerendering

task-list-model.ts (pure presentation model)
├─ converts domain tasks into task-list sections and rows
├─ resolves display-only metadata such as project names
└─ contains no DOM, Obsidian view, repository, or persistence access

task-list-renderer.ts (GUI rendering)
├─ renders sections, rows, menu triggers, and drag handles
├─ owns DOM listeners and Sortable instances
├─ emits typed user-intent actions, including requests for Obsidian menus
└─ returns one destroy function for all renderer resources
```

### Minimal interface

The exact type names may change during implementation, but the boundary should remain equivalent to:

```ts
type TaskListAction =
  | { type: "open"; taskId: string }
  | { type: "toggle-completed"; taskId: string; completed: boolean }
  | { type: "show-actions"; taskId: string; event: MouseEvent }
  | { type: "reorder"; taskId: string; previousId?: string; nextId?: string };

interface RenderedTaskList {
  destroy(): void;
}

function buildTaskListModel(input: TaskListModelInput): TaskListModel;

function renderTaskList(
  root: HTMLElement,
  model: TaskListModel,
  dispatch: (action: TaskListAction) => void | Promise<void>,
): RenderedTaskList;
```

The renderer uses browser DOM APIs and must not import Obsidian view classes, the repository, plugin settings, or Vault persistence APIs. The ItemView adapter remains responsible for constructing Obsidian-specific menus after receiving a `show-actions` intent.

## Why this is the minimum useful separation

- Separating only helper functions would leave the DOM and lifecycle coupling unchanged.
- Separating every screen would create many shallow modules and unnecessary movement.
- A presentation model plus one renderer creates a real testable boundary used by the current product.
- A future Kanban or calendar view can follow the same three-part shape only when it is actually introduced: adapter/orchestrator, pure presentation model, renderer.
- A future Bases integration can reuse the presentation model and renderer while replacing only the adapter, provided the requirements remain compatible.

## Migration Plan

1. Add characterization tests for current task-list ordering, grouping, labels, project names, and emitted actions.
2. Introduce `task-list-model.ts` and move only render-ready transformation into it.
3. Introduce `task-list-renderer.ts` and move task-row DOM and Sortable ownership into it.
4. Make `TodoListView` dispatch renderer actions to existing modal and repository operations.
5. Reuse the renderer from all current result screens.
6. Remove the superseded rendering code from `TodoListView` without changing visible behavior.

## Acceptance Criteria

- [ ] `TodoListView` no longer directly builds task-row DOM or owns Sortable instances.
- [ ] The presentation-model builder is pure and can be tested without Obsidian or the DOM.
- [ ] The renderer has no repository, settings, or Vault persistence dependency.
- [ ] Renderer resources are released through one `destroy()` operation when the screen rerenders or closes.
- [ ] Date, Search, Project, and Filter task results preserve their current behavior and appearance.
- [ ] Completing, editing, deleting, and manually reordering tasks still work.
- [ ] One global manual rank remains unchanged; automatic sorting remains display-only.
- [ ] PC and Android layouts remain unchanged.
- [ ] No Markdown schema or stored task data changes.

## Verification

- Unit-test presentation sections, task metadata, and action dispatch.
- Exercise add, edit, complete, delete, and manual reorder on desktop and Android.
- Confirm automatic sort does not rewrite global manual rank.
- Confirm switching screens repeatedly does not duplicate events or Sortable instances.
- Run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - Python behavior tests
  - `python3 scripts/validate_skills.py`
  - `git diff --check`

## Documentation / ADR

This is a reversible internal refactor, so the Issue is sufficient for the first extraction. Create or update an ADR only if TaskMate later adopts this three-part structure as a mandatory architecture for every complex view, or if a real Bases adapter introduces a long-term compatibility trade-off.

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 問題 / 目標

> 対応範囲：英語版「Problem / Goal」の要約

現在の `TodoListView` は、Obsidianビューのライフサイクル、画面状態、リポジトリアクセス、表示用データの準備、DOM描画、タスク操作、ドラッグ＆ドロップの後片付けを担当しています。現在のタスク一覧には機能しますが、データ準備とGUI描画の再利用可能な境界がないため、将来カンバンやカレンダービューを追加したり、後からBasesビュー上で動かしたりすることが難しくなります。

目標は、将来作らない可能性もある機能のための汎用ビュー基盤を作らず、現在のタスク一覧の動作を把握できているうちに、役に立つ最小限の分離を導入することです。

## 背景 / 今行う理由

> 対応範囲：英語版「Background / Why now」の要約

- リポジトリと純粋なタスクのドメイン処理は、すでに `repository.ts` と `domain.ts` に分離されています。
- 残る価値の高い境界は、タスク一覧の表示モデルとDOM描画の間です。
- 現在のタスク一覧は複数画面から使われるため、カンバンやカレンダーを追加しなくてもこの境界には価値があります。
- すべての画面を切り出したり、仮想的なBasesアダプターを今定義したりすると、確認済みの要件がないまま間接層だけが増えます。

## 対象範囲

> 対応範囲：英語版「Scope」の全項目

### 含むもの

- `TodoListView` をItemViewアダプター兼オーケストレーターとして維持する。
- フィルター・ソート済みのドメインデータを、描画可能なセクションと行へ変換する純粋なタスク一覧表示モデル生成処理を切り出す。
- タスク一覧のDOM描画とSortableのライフサイクル管理を `TodoListView` から切り出す。
- 描画側から小さなアクションディスパッチャーを通じてユーザーの意図を渡し、リポジトリ更新、モーダル表示、確認方針、画面更新はオーケストレーターに残す。
- 日付、検索、プロジェクト、フィルター画面でタスク結果を表示するとき、切り出したタスク一覧描画を再利用する。
- 表示モデル生成と描画アクション通知に焦点を当てたテストを追加する。
- 現在のPC・Androidでの動作を維持する。

### 含まないもの

- TaskMate全ビュー向けの汎用フレームワーク。
- 二つ目の実在するデータソースがない段階での `TaskSource` インターフェースやBasesアダプター。
- カンバン、カレンダー、Basesビューの実装。
- 日付、検索、プロジェクト、フィルターの全画面を別モジュールへ分割すること。
- Markdownスキーマ、Task ID、Project ID、手動順位、ナビゲーション、UI文言、CSSデザイン、ユーザーに見える動作の変更。

## 提案設計

> 対応範囲：英語版「Proposed Design」の全項目

### 責務の境界

> 対応範囲：英語版「Responsibility boundary」の全項目

```text
TodoListView（Obsidianアダプター / オーケストレーター）
├─ ItemViewのライフサイクルと画面状態を持つ
├─ TaskRepositoryからタスクとプロジェクトを読み込む
├─ 既存のドメインのフィルター・ソート処理を呼ぶ
├─ 表示モデルを生成する
├─ アクションと永続化を処理する
└─ 再描画前に以前の描画処理を破棄する

task-list-model.ts（純粋な表示モデル）
├─ ドメインのタスクを一覧セクションと行へ変換する
├─ プロジェクト名など表示専用情報を解決する
└─ DOM、Obsidianビュー、リポジトリ、永続化へアクセスしない

task-list-renderer.ts（GUI描画）
├─ セクション、行、メニュー起動ボタン、ドラッグハンドルを描画する
├─ DOMイベントとSortableインスタンスを管理する
├─ Obsidianメニューの表示要求を含む型付きのユーザー操作を通知する
└─ 描画側の全リソースを破棄する一つの関数を返す
```

### 最小インターフェース

> 対応範囲：英語版「Minimal interface」の全項目

正確な型名は実装時に変えて構いませんが、境界は次と同等にします。

```ts
type TaskListAction =
  | { type: "open"; taskId: string }
  | { type: "toggle-completed"; taskId: string; completed: boolean }
  | { type: "show-actions"; taskId: string; event: MouseEvent }
  | { type: "reorder"; taskId: string; previousId?: string; nextId?: string };

interface RenderedTaskList {
  destroy(): void;
}

function buildTaskListModel(input: TaskListModelInput): TaskListModel;

function renderTaskList(
  root: HTMLElement,
  model: TaskListModel,
  dispatch: (action: TaskListAction) => void | Promise<void>,
): RenderedTaskList;
```

描画処理はブラウザーのDOM APIを使用し、Obsidianのビュークラス、リポジトリ、プラグイン設定、Vault永続化APIをimportしてはいけません。ItemViewアダプターは `show-actions` 操作を受け取った後、Obsidian固有のメニューを生成する責務を持ちます。

## これが有用な最小分離である理由

> 対応範囲：英語版「Why this is the minimum useful separation」の全項目

- ヘルパー関数だけを分けても、DOMとライフサイクルの密結合は残ります。
- すべての画面を分けると、浅いモジュールが多数でき、不要な移動が増えます。
- 表示モデルと一つの描画処理を分けることで、現在の製品でも利用される実在のテスト可能な境界ができます。
- 将来カンバンやカレンダーを追加するときは、その時点で各ビューをアダプター / オーケストレーター、純粋な表示モデル、描画処理の3部分にできます。
- 将来Bases連携を行う場合も、要件が適合すればアダプターだけを置き換えて表示モデルと描画処理を再利用できます。

## 移行計画

> 対応範囲：英語版「Migration Plan」の全項目

1. 現在のタスク一覧の並び順、グループ、ラベル、プロジェクト名、通知されるアクションの特性テストを追加する。
2. `task-list-model.ts` を追加し、描画直前の変換処理だけを移す。
3. `task-list-renderer.ts` を追加し、タスク行のDOMとSortableの管理を移す。
4. `TodoListView` から描画アクションを既存のモーダル・リポジトリ操作へ接続する。
5. 現在のすべての結果画面から描画処理を再利用する。
6. 表示動作を変えずに、置き換え済みの描画コードを `TodoListView` から削除する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance Criteria」の全項目

- [ ] `TodoListView` がタスク行のDOMを直接生成せず、Sortableインスタンスを直接管理しない。
- [ ] 表示モデル生成処理をObsidianやDOMなしでテストできる。
- [ ] 描画処理がリポジトリ、設定、Vault永続化に依存しない。
- [ ] 再描画または画面終了時に、一つの `destroy()` で描画側のリソースが解放される。
- [ ] 日付、検索、プロジェクト、フィルターの結果表示が現在の外観と動作を維持する。
- [ ] 完了、編集、削除、手動並べ替えが引き続き動作する。
- [ ] 一つのグローバル手動順位を維持し、自動ソートは表示だけに作用する。
- [ ] PC・Androidのレイアウトが変わらない。
- [ ] Markdownスキーマや保存済みタスクデータを変更しない。

## 検証

> 対応範囲：英語版「Verification」の全項目

- 表示セクション、タスクの表示情報、アクション通知を単体テストする。
- PCとAndroidで、追加、編集、完了、削除、手動並べ替えを確認する。
- 自動ソートがグローバル手動順位を書き換えないことを確認する。
- 画面を繰り返し切り替えてもイベントやSortableインスタンスが重複しないことを確認する。
- 次を実行する。
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - Pythonの振る舞いテスト
  - `python3 scripts/validate_skills.py`
  - `git diff --check`

## 文書 / ADR

> 対応範囲：英語版「Documentation / ADR」の全項目

これは元に戻せる内部リファクタリングなので、最初の分離はIssueだけで十分です。将来、この3部分構造をすべての複雑なビューに必須とする場合、または実際のBasesアダプターによって長期的な互換性のトレードオフが生じる場合に、ADRを作成または更新します。

</details>
