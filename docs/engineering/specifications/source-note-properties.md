# Source note property format

Status: Current normative contract. This specification covers properties stored on ordinary source notes. It does not turn a source note into a Task; canonical Task properties are defined by [Task file format](task-file-format.md).

## Property ownership classes

Implementations MUST distinguish these property classes and MUST NOT interpret one class as another.

| Class | Properties | Owner | Meaning |
| --- | --- | --- | --- |
| Source selection | `taskmate-source` | User or TaskMate source-selection command | Whether this ordinary note is eligible for Task Pilot extraction |
| Import provenance | `taskmate-import-status`, `taskmate-imported-at`, `taskmate-imported-hash`, `taskmate-task-ids` | Task Pilot import workflow | What source version was processed and which canonical Tasks are associated with it |
| TaskMate-unowned | Any other property, such as `type: meeting-note`, `owner`, or `scenario` | User, another plugin, or the note's own convention | Ordinary note metadata that TaskMate does not define |

Properties in this specification belong on source notes. A source note MUST NOT be treated as a canonical Task unless it independently satisfies [Task file format](task-file-format.md), including `type: todo` and a stable Task `id` in the configured Task folder.

## Source selection property

`taskmate-source` accepts a YAML boolean:

- `true` explicitly includes the note even when its folder is not selected;
- `false` explicitly excludes the note even when its folder is selected; and
- absence inherits the configured source-folder rule.

Selecting a note only changes eligibility. It MUST NOT create a Proposal, create a Task, or mark the source processed.

## Import provenance properties

After every candidate in a staged source review has an explicit decision and promotion completes, Task Pilot writes:

```yaml
taskmate-import-status: "processed"
taskmate-imported-at: "2026-10-16T11:54:31.690152Z"
taskmate-imported-hash: "sha256-content-hash"
taskmate-task-ids:
  - "stable-task-id"
```

- `taskmate-import-status` MUST be `processed` when written by the current workflow.
- `taskmate-imported-at` MUST be an ISO timestamp for the completed promotion.
- `taskmate-imported-hash` MUST identify the processed source content while excluding these provenance fields themselves.
- `taskmate-task-ids` MUST contain stable IDs for Tasks associated with the source, including created Tasks and approved merge targets. It MUST preserve prior valid associations across later imports.
- Excluded candidates MUST NOT add a Task ID.

These properties are workflow state, not Task scheduling fields. They MUST NOT be used as `date`, `priority`, `labels`, completion, or manual order.

## Preservation and compatibility

Task Pilot MUST preserve source prose and TaskMate-unowned properties when recording provenance. It MUST NOT redefine values such as `type: meeting-note`, `owner`, or `scenario`. Unknown source properties remain owned by their original user or plugin.

Changing source content after staging invalidates the staged snapshot and requires renewed review before promotion. Writing provenance alone MUST NOT make the source appear semantically changed because the import hash excludes provenance fields.

## Example with mixed ownership

```yaml
---
type: meeting-note               # TaskMate-unowned note convention
owner: test-user                 # TaskMate-unowned
scenario: jtbd-today-plan        # TaskMate-unowned test metadata
taskmate-source: true            # Source selection
taskmate-import-status: processed # Import provenance
taskmate-imported-at: "2026-10-16T11:54:31.690152Z"
taskmate-imported-hash: "sha256-content-hash"
taskmate-task-ids:
  - "stable-task-id"
---
```

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

このSpecificationは通常のソースノートに保存されるPropertyを定義します。ソースノートを正式Taskにするものではありません。正式TaskのPropertyは[Task file format](task-file-format.md)で定義します。

| 種類 | Property | 管理者 | 意味 |
| --- | --- | --- | --- |
| ソース選択 | `taskmate-source` | 利用者またはTaskMateコマンド | AIによる候補抽出の対象にできるか |
| 取り込み履歴 | `taskmate-import-status`、`taskmate-imported-at`、`taskmate-imported-hash`、`taskmate-task-ids` | Task Pilot | 処理済みのソース版と関連する正式Task |
| TaskMate管理外 | `type: meeting-note`、`owner`、`scenario`など | 利用者、他プラグイン、ノート規約 | TaskMateが意味を定義しない通常のメタデータ |

`taskmate-source: true`はフォルダー指定外でも対象、`false`はフォルダー指定内でも対象外、未指定はソースフォルダー設定を継承します。対象指定だけではProposalもTaskも作らず、処理済みにもしません。

全候補の判断と正式反映が完了すると、Task Pilotは`processed`、処理日時、ソース内容hash、関連Task IDを記録します。これらは取り込み履歴であり、Taskの日付、Priority、Label、完了、並び順ではありません。除外候補はTask IDを追加しません。

Task Pilotは本文とTaskMate管理外Propertyを保持し、`meeting-note`、`owner`、`scenario`などの意味を再定義しません。正式Taskとして扱うには、設定されたTaskフォルダー内で`type: todo`と安定した`id`を含む[Task形式](task-file-format.md)を別途満たす必要があります。
