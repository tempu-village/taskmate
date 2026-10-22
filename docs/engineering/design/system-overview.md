# System overview diagrams

Status: Current visual overview. [Architecture](architecture.md) owns the component map, [Module boundaries](module-boundaries.md) owns the dependency rules, and each [Feature](../features/README.md) owns its behavior. This page draws those records so a reader can explain TaskMate quickly. When it disagrees with them or with the code, they win and this page needs fixing.

## TaskMate in four sentences

1. Every Task and Project is a plain Markdown file in the Obsidian Vault; there is no database or hosted account.
2. The TaskMate plugin is the human interface: it lists, filters, edits and reorders those files on desktop and mobile.
3. Task Pilot is an optional agent skill whose Python helpers read and write the same files from an agent host such as Claude Code.
4. Whenever Task Pilot wants to change Tasks, it first stages a Proposal file that the user reviews before anything canonical changes.

## 1. System context

Who touches which files. Folder names are the defaults from [settings.ts](../../../src/settings.ts).

```mermaid
flowchart TB
  user(["User"])

  subgraph obsidian["Obsidian"]
    plugin["TaskMate plugin<br/>desktop and mobile<br/>list · edit · review"]
  end

  subgraph host["Agent host"]
    helpers["Task Pilot skill<br/>Python helpers<br/>in Codex, Claude Code, ..."]
  end

  subgraph vault["Vault · source of truth"]
    settings[("Plugin settings<br/>data.json")]
    sources[("Source notes<br/>allowlisted ordinary notes")]
    canonical[("TaskMate/Tasks and TaskMate/Projects<br/>one Markdown file each")]
    proposals[("TaskMate/Proposals<br/>proposal-ID.json<br/>source-review-ID.json<br/>Active · Archive · History")]
    plans[("TaskMate/Plans<br/>rolling plans")]
  end

  user -->|"browse, edit, approve"| plugin
  user -->|"ask to import, review, plan"| helpers
  helpers -.->|"obsidian://taskmate-review<br/>obsidian://taskmate-source-review"| plugin

  plugin <-->|"load / save"| settings
  plugin -->|"mark taskmate-source;<br/>write import provenance"| sources
  plugin <-->|"read / write"| canonical
  plugin -->|"read, record decisions, archive"| proposals

  helpers -->|"read folder settings"| settings
  helpers -->|"read; write import provenance"| sources
  helpers <-->|"read / write"| canonical
  helpers -->|"stage"| proposals
  helpers -->|"write"| plans
```

- Task Pilot's helpers are `todo_store` (direct Task and Project operations), `proposal_store` (current Source-note import), `planning_store` (backlog review, Task change Proposals and capacity plans), `rolling_plan` (rolling plans) and `source_review` (Source candidate Proposals).
- The plugin and Task Pilot never call each other's code. They share the file formats in [Specifications](../specifications/README.md) and Task Pilot's [Task schema](../../../skills/taskpilot/references/task-schema.md). The only direct handoffs are the URIs that open a Task change review or a Source candidate review.
- Task Pilot reads the plugin's `data.json` to find the managed folders, so both sides agree on where Tasks live.
- The plugin's Source candidate review also writes import provenance on a Source note once all of that note's candidates are applied.

## 2. Module map

Folders under `src/`, arranged by dependency level, with arrows drawn from the actual imports. Solid arrows are runtime imports and dashed arrows are type-only imports.

```mermaid
flowchart TB
  main["main.ts<br/>composition root:<br/>startup, commands, Vault events"]
  settings["settings.ts<br/>settings and settings tab"]

  tasklist["task-list/<br/>TaskMate list view, filters, sorting,<br/>drag reorder, selection, bulk edit"]

  subgraph reviews["reviews/"]
    tcr["task-change/<br/>Task change review<br/>Domain, storage and UI"]
    scr["source-candidate/<br/>Source candidate review<br/>Domain, storage and UI"]
  end

  editor["task-editor/<br/>Task, Step and conflict modals,<br/>editing flow"]

  labels["labels/<br/>Label rules, picker,<br/>rename and remove across Tasks"]
  projects["projects/<br/>Project Markdown, storage, modal"]

  tasks["tasks/<br/>Task model, Markdown format,<br/>edit merge, TaskRepository"]

  subgraph cross["Usable from any folder"]
    i18n["i18n/<br/>English and Japanese UI text"]
    shared["shared/<br/>mobile keyboard layout, SHA-256"]
  end

  main --> settings
  main --> tasklist
  main --> tcr
  main --> scr
  main --> projects
  main --> tasks
  tasklist --> editor
  tasklist --> labels
  tasklist --> projects
  tasklist --> tasks
  editor --> labels
  editor -.->|"type only"| projects
  editor --> tasks
  labels --> tasks
  projects -.->|"type only"| tasks
  tcr --> tasks
  scr --> tasks
  tasks ~~~ cross
```

- Dependencies only point downward: `task-list → task-editor → labels / projects → tasks`, plus `reviews → tasks`. `tasks/` depends on no other feature folder. The [Module boundary test](../../../test/module-boundaries.test.ts) enforces this.
- `reviews/` holds one sibling Module per review kind, and review kinds never import each other.
- `task-list/view.ts`, `reviews/task-change/review-view.ts`, `reviews/source-candidate/review-view.ts` and `settings.ts` refer back to `main.ts` with type-only imports. Those references are erased at runtime and are omitted from the diagram.

## 3. Layers inside the folders

Each folder mixes the four roles from [Module boundaries](module-boundaries.md). The stereotype on each box names its role:

| Role | Responsibility | Must not |
| --- | --- | --- |
| UI Adapter | Obsidian views, modals, DOM, screen state | Contain persistence rules |
| Application | Coordinate one use case across screens and repositories | Hold rules that belong in Domain |
| Domain | Pure validation, calculation, filtering, sorting, diffing | Depend on Obsidian, DOM or the Vault |
| Persistence Adapter | Read and write Vault files, guarded writes | Be depended on by Domain |

### 3a. Task list and editing

```mermaid
classDiagram
  direction TB

  class TaskMatePlugin {
    <<composition root>>
    +onload() wire repositories and views
    +refreshViews() after Vault file changes
  }

  class TodoListView {
    <<UI Adapter>>
    smart views, search, filters, sort
    drag reorder, multi-select
  }
  class TaskListRenderer {
    <<UI Adapter>>
    +renderTaskList() DOM and Sortable
  }
  class TaskModal {
    <<UI Adapter>>
    title, date, Priority, Labels
    Project, Steps, Notes
  }
  class TaskConflictModal {
    <<UI Adapter>>
    pick current or draft per field
  }

  class TaskEditingFlow {
    <<Application>>
    +openCreate()
    +openEdit()
  }
  class BulkTaskActions {
    <<Application>>
    +applyBulkTaskChanges()
  }
  class LabelMaintenance {
    <<Application>>
    +renameLabelAcrossTasks()
    +removeLabelAcrossTasks()
  }

  class TaskListModel {
    <<Domain>>
    +buildTaskListModel() sections and rows
  }
  class TaskDomain {
    <<Domain>>
    Task and Project types
    +filterTasks()
    +groupScheduledTasks()
    +sortTasks()
  }
  class TaskEditMerge {
    <<Domain>>
    +compareTaskEdit() three-way
  }
  class TaskMarkdown {
    <<Domain>>
    +parseTaskMarkdown()
    +encodeTaskPreservingProperties()
  }

  class TaskRepository {
    <<Persistence Adapter>>
    +list() +create() +update()
    +beginEdit() +saveEditedTask()
    +reorder() +remove()
  }
  class ProjectRepository {
    <<Persistence Adapter>>
    +list() +create() +update() +remove()
  }

  TaskMatePlugin --> TodoListView : registers
  TaskMatePlugin --> TaskRepository : creates
  TaskMatePlugin --> ProjectRepository : creates

  TodoListView --> TaskListModel : builds display
  TodoListView --> TaskListRenderer : renders
  TodoListView --> TaskEditingFlow : create and edit
  TodoListView --> BulkTaskActions : bulk edit
  TodoListView --> LabelMaintenance : rename or remove Label
  TodoListView --> TaskRepository : list, complete, reorder

  TaskEditingFlow --> TaskModal : opens
  TaskEditingFlow --> TaskConflictModal : opens on conflict
  TaskEditingFlow --> TaskRepository : beginEdit, saveEditedTask
  TaskEditingFlow --> ProjectRepository : touch
  BulkTaskActions --> TaskRepository : update
  LabelMaintenance --> TaskRepository : update

  TaskListModel --> TaskDomain : filter, group, sort
  TaskRepository --> TaskMarkdown : parse and encode
  TaskRepository --> TaskEditMerge : detect conflicts
```

The list view owns screen state and dispatches intent. Rules such as "which Tasks are Overdue" or "did someone else change this field" live in Domain code, so they are unit-tested without Obsidian.

### 3b. Reviews

```mermaid
classDiagram
  direction TB

  class TaskMatePlugin {
    <<composition root>>
    taskmate-review URI handler
    taskmate-source-review URI handler
  }

  class TaskChangeReviewView {
    <<UI Adapter>>
    pending and history lists
    +openProposal()
  }
  class ReviewRenderer {
    <<UI Adapter>>
    Items and Full text diffs
    approve selection
  }

  class SourceCandidateReviewView {
    <<UI Adapter>>
    pending and history lists
    +openReview()
  }
  class SourceReviewRenderer {
    <<UI Adapter>>
    candidate cards, edit form
    formal-apply confirmation
  }
  class CandidateEditForm {
    <<Domain>>
    +candidateEditFromForm() field errors
    +saveCandidateEdit() conflict check
  }

  class TaskChangeProposalDomain {
    <<Domain>>
    +buildProposalReview() hash check, jsdiff
    +applyProposalDecision() stale check, follow-up
  }
  class SourceCandidateDomain {
    <<Domain>>
    +editCandidate() +decideCandidate()
    +planFormalApply()
    +noteSourceCompletion()
  }

  class TaskChangeProposalRepository {
    <<Persistence Adapter>>
    +listPending() +listHistory()
    +review() +apply() +reject()
  }
  class SourceCandidateReviewRepository {
    <<Persistence Adapter>>
    +listPending() +listHistory()
    +load() +save() +formalApply()
  }
  class SourceNoteProvenance {
    <<Domain>>
    Task Pilot compatible hash
    +withSourceNoteProvenance()
  }
  class TaskRepository {
    <<Persistence Adapter>>
    +readReviewedTask()
    +writeReviewedTask()
    +create()
  }

  TaskMatePlugin --> TaskChangeReviewView : registers and opens
  TaskMatePlugin --> TaskChangeProposalRepository : creates
  TaskChangeReviewView --> ReviewRenderer : renders
  TaskChangeReviewView --> TaskChangeProposalRepository : review, apply, reject
  TaskChangeProposalRepository --> TaskChangeProposalDomain : validate and decide
  TaskChangeProposalRepository --> TaskRepository : guarded write

  TaskMatePlugin --> SourceCandidateReviewView : registers and opens
  TaskMatePlugin --> SourceCandidateReviewRepository : creates
  SourceCandidateReviewView --> SourceReviewRenderer : renders
  SourceCandidateReviewView --> CandidateEditForm : save edits
  SourceCandidateReviewView --> SourceCandidateReviewRepository : load, save, formalApply
  CandidateEditForm --> SourceCandidateDomain : editCandidate
  SourceCandidateReviewRepository --> SourceCandidateDomain : validate and plan
  SourceCandidateReviewRepository --> SourceNoteProvenance : mark completed notes
  SourceCandidateReviewRepository --> TaskRepository : create or merge Tasks
```

Both review kinds follow the same shape (Domain decides, Persistence Adapter writes) but keep separate schemas and code. No `reviews/shared` Module exists until a contract is proven common.

## 4. Data model

### 4a. Canonical records

```mermaid
classDiagram
  direction LR

  class Task {
    <<Markdown file>>
    id
    title
    completed
    date
    priority 1 to 3
    labels
    projectId
    rank, one global Manual order
    sourceNote
    steps
    notes
  }
  class Step {
    <<inside the Task body>>
    text
    completed
    date
  }
  class Project {
    <<Markdown file>>
    id
    name
    lastUsedAt
  }
  class Label {
    <<string value>>
    name, e.g. context/break
  }
  class SourceNote {
    <<ordinary note>>
    taskmate-source
    import status, hash, Task IDs
  }
  class TaskMateSettings {
    <<plugin data.json>>
    task, project, proposal folders
    sourceFolders
    language
    recent and favorite Labels
  }

  Task "1" *-- "0..*" Step : contains
  Task "0..*" --> "0..1" Project : projectId
  Task "0..*" --> "0..*" Label : labels
  Task "0..*" ..> "0..1" SourceNote : source-note link
  TaskMateSettings ..> Task : taskFolder locates
  TaskMateSettings ..> SourceNote : sourceFolders select
```

- A Task is identified by `id`, not by its file name. A Project groups Tasks by ID but does not own them; deleting a Project unassigns its Tasks.
- Steps are checklist entries inside one Task and have no identity of their own.
- `rank` is one global order. Sorting by date or Priority only changes what is displayed.
- The exact fields are owned by [Task file format](../specifications/task-file-format.md) and [Source note property format](../specifications/source-note-properties.md).

### 4b. Review records

```mermaid
classDiagram
  direction LR

  class TaskChangeProposal {
    <<proposal-*.json>>
    id
    status
    decision and apply result
    originProposalId
  }
  class ProposalTask {
    taskId
    beforeMarkdown
    afterMarkdown
    beforeSha256
  }
  class ProposalChange {
    id such as C-01
    field
    before, after, reason
  }

  class SourceCandidateProposal {
    <<source-review-*.json>>
    reviewId
    status, health, revision
  }
  class ReviewSource {
    note or conversation
    sha256 snapshot
  }
  class SourceCandidate {
    operation create, merge or exclude
    decision pending, approved or hold
    application result
  }

  class Task {
    <<canonical Markdown>>
  }

  TaskChangeProposal "1" *-- "1..*" ProposalTask
  ProposalTask "1" *-- "1..*" ProposalChange
  ProposalTask ..> Task : changes one existing Task

  SourceCandidateProposal "1" *-- "1..*" ReviewSource
  SourceCandidateProposal "1" *-- "1..*" SourceCandidate
  SourceCandidate --> ReviewSource : sourceRefs
  SourceCandidate ..> Task : creates or merges into
```

- A Task change Proposal edits existing Tasks only. It stores complete before/after Markdown so the diff can be regenerated and a stale Task can be detected. When some writes fail or go stale, apply produces a follow-up Proposal linked by `originProposalId`. See [Task change Proposal format](../specifications/task-change-proposal-format.md).
- A Source candidate Proposal accounts for every candidate found in its sources as create, merge or exclude. Its schema is defined by [RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md), and the user reviews it in the Source candidate Review View.

## 5. Key flows

### 5a. Edit a Task without overwriting someone else's change

```mermaid
sequenceDiagram
  actor User
  participant View as TodoListView
  participant Flow as TaskEditingFlow
  participant Modal as TaskModal
  participant Repo as TaskRepository
  participant Merge as TaskEditMerge
  participant Vault

  User->>View: open a Task
  View->>Flow: openEdit(task)
  Flow->>Repo: beginEdit(task)
  Repo->>Vault: read file
  Repo-->>Flow: edit session with base snapshot
  Flow->>Modal: open
  User->>Modal: change fields and save
  Modal->>Flow: draft
  Flow->>Repo: saveEditedTask(session, draft)
  Repo->>Vault: re-read current file
  Repo->>Merge: compareTaskEdit(base, draft, current)
  alt no field changed on both sides
    Repo->>Vault: write merged Markdown, keep unknown properties
    Repo-->>Flow: saved
  else the same field changed elsewhere
    Repo-->>Flow: conflict
    Flow->>User: TaskConflictModal, choose per field
    User->>Flow: choices
    Flow->>Repo: resolveEditConflict(choices)
  end
  Note over Vault,View: The Vault change event makes TaskMatePlugin re-render open views
```

Details: [Edit conflicts](../features/edit-conflicts.md) and [ADR 0022](../adr/0022-prevent-stale-task-overwrites-with-three-way-comparison.md).

### 5b. Review changes suggested by Task Pilot

```mermaid
sequenceDiagram
  actor User
  participant Agent as Agent with Task Pilot
  participant Vault
  participant Plugin as TaskMatePlugin
  participant View as TaskChangeReviewView
  participant Repo as TaskChangeProposalRepository
  participant Domain as TaskChangeProposalDomain
  participant Tasks as TaskRepository

  User->>Agent: review my backlog
  Agent->>Vault: planning_store propose writes proposal-*.json
  Note right of Agent: Task Markdown is not changed
  Agent->>Plugin: open obsidian://taskmate-review
  Plugin->>View: openProposal(id)
  View->>Repo: review(id)
  Repo->>Domain: buildProposalReview, verify hash and derive diff
  View-->>User: semantic and full-text diffs
  User->>View: approve selected changes
  View->>Repo: apply(id, approvedChangeIds)
  Repo->>Tasks: readReviewedTask for current Markdown
  Repo->>Domain: applyProposalDecision, stale check
  Repo->>Tasks: writeReviewedTask only if still unchanged
  Repo->>Vault: save follow-up Proposal if needed, move original to History
```

Details: [Task change review](../features/task-change-review/README.md).

### 5c. Turn Source notes into Tasks

The current import path runs entirely in Task Pilot. The plugin only marks which notes are in scope.

```mermaid
sequenceDiagram
  actor User
  participant Plugin as TaskMate plugin
  participant Agent as Agent with Task Pilot
  participant Vault

  User->>Plugin: include this note or folder as a Source
  Plugin->>Vault: set taskmate-source or add to sourceFolders
  User->>Agent: turn my notes into Tasks
  Agent->>Vault: todo_store finds eligible Source notes
  Agent->>Agent: list every candidate as a coverage manifest
  Agent->>Vault: proposal_store stage writes Active/session/Review.md
  Note right of Vault: No canonical Task exists yet
  User->>Agent: approve, revise or exclude each candidate
  Agent->>Vault: proposal_store promote creates or merges Tasks
  Agent->>Vault: write provenance on Source notes, move session to Archive
```

Under RFC 0033 this path is being replaced: `source_review.py` stages one `source-review-*.json`, and the user edits, decides and formally applies its candidates in the plugin's Source candidate Review View. Task Pilot takes that path when the user asks for a TaskMate review; the path above stays the default until [#62](https://github.com/tempu-village/taskmate/issues/62) retires it. Details: [Source-note import](../features/source-import.md).

## 6. Where each feature lives

| Feature | What the user gets | Main code |
| --- | --- | --- |
| [Navigation, filtering and sorting](../features/filtering-and-sorting.md) | Scheduled, Unplanned and All views; search, Priority and Label filters; sort; drag to reorder | `task-list/`, `tasks/domain.ts` |
| [Task editing](../features/task-editing.md) | Create, edit, complete and delete a Task | `task-editor/`, `tasks/` |
| [Task Steps](../features/task-steps.md) | Optionally dated checklist inside a Task | `task-editor/step-modal.ts`, `tasks/task-steps.ts`, `tasks/task-body.ts` |
| [Edit conflicts](../features/edit-conflicts.md) | No silent overwrite when the file changed meanwhile | `tasks/task-edit-merge.ts`, `tasks/repository.ts`, `task-editor/task-conflict-modal.ts` |
| [Projects](../features/projects.md) | Group Tasks into named Projects | `projects/` |
| [Labels](../features/labels.md) | Label picker, favorites, rename and remove | `labels/` |
| [Mobile layout](../features/mobile-layout.md) | Usable editors and lists on phones | `shared/mobile-keyboard-layout.ts`, `styles.css` |
| [Localization](../features/localization.md) | English and Japanese UI | `i18n/` |
| [Storage and privacy](../features/storage-and-privacy.md) | Plain Markdown in the user's Vault | `tasks/repository.ts`, `projects/project-repository.ts` |
| [Task change review](../features/task-change-review/README.md) | Approve AI-suggested changes field by field | `reviews/task-change/`, Task Pilot `planning_store.py` |
| [Source-note import](../features/source-import.md) | Turn selected notes into Tasks with nothing silently dropped | Task Pilot `todo_store.py`, `proposal_store.py`; next: `reviews/source-candidate/`, `source_review.py` |
| [Task Pilot review and capacity planning](../features/task-pilot-planning.md) | Backlog review and plans sized to available time | Task Pilot `planning_store.py`, `rolling_plan.py` |

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

TaskMateを説明するための図をまとめたページです。正本は[Architecture](architecture.md)、[Module boundaries](module-boundaries.md)、各[Feature](../features/README.md)で、このページはそれらを図にしたものです。内容が食い違う場合は正本とコードを優先し、このページを直します。

### 4文で言うと

1. TaskとProjectは、どちらもVault内の普通のMarkdownファイルです。データベースやアカウントは要りません。
2. TaskMateプラグインは人が使う画面です。PCとスマホで、そのファイルを一覧・絞り込み・編集・並べ替えします。
3. Task Pilotは任意のエージェントスキルです。Claude Codeなどの中でPythonの補助スクリプトが同じファイルを読み書きします。
4. Task PilotがTaskを変えたいときは、まずProposal（提案）ファイルを置きます。正本のTaskが変わるのは、利用者がレビューして承認したあとだけです。

### 図の読み方

- **1. System context**：誰がどのファイルに触るかを示します。プラグインとTask Pilotはお互いのコードを呼ばず、同じファイル形式を共有して連携します。直接の受け渡しは、Task変更レビューを開く`obsidian://taskmate-review`と、Source候補レビューを開く`obsidian://taskmate-source-review`のURIだけです。Task Pilotはプラグインの`data.json`を読み、管理フォルダーの場所を合わせます。
- **2. Module map**：`src/`のフォルダーを依存の段ごとに並べた図です。矢印は実際のimportから描いています。依存は下向きだけで、`task-list → task-editor → labels / projects → tasks`、`reviews → tasks`です。`tasks/`はほかの機能フォルダーに依存しません。この規則はModule boundary testで自動確認しています。`i18n/`と`shared/`はどこからでも使えます。
- **3. Layers**：各フォルダーの中身を4つの役割で示します。UI Adapterは画面、Applicationは操作の段取り、Domainは純粋なルール（Obsidianに依存しない）、Persistence Adapterはファイルの読み書きです。3aは一覧と編集、3bはレビューの主要クラスです。2種類のレビューは同じ形をしていますが、スキーマとコードは別々に保っています。
- **4. Data model**：4aは正本のデータです。TaskはStepを中に持ち、IDでProjectを参照し、Labelは文字列です。`rank`は全体で一つの手動順です。4bはレビュー用のデータです。Task変更Proposalは既存Taskの変更前後のMarkdownを丸ごと持ち、Source候補Proposalは元ノートから見つけた候補をすべて作成・統合・除外のいずれかに振り分けます。
- **5. Key flows**：5aは編集保存の流れです。開いたときの内容・自分の編集・今のファイルを3方向で比べ、同じ項目が両方で変わっていれば項目ごとに選んでもらいます。5bはTask Pilotの変更提案を承認する流れです。承認した変更だけを、元の内容から変わっていない場合に書き込みます。5cはメモからTaskを作る今の流れで、Task Pilotの中で完結します。RFC 0033で、プラグイン側のSource候補レビューに置き換える作業が進んでいます。Review Viewで候補の編集・判断・正式反映ができ、Task PilotはTaskMateでのレビューを頼まれたときにこちらを使います。古い流れは#62で廃止するまで既定のままです。
- **6. Where each feature lives**：機能ごとに、利用者が得られることと主なコードの場所を対応させた表です。
