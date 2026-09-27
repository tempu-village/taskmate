# Projects

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

Each Project is stored as one Markdown file with a stable ID and name. A Task refers to a Project by ID. A Project groups Tasks but does not own their lifecycle.

Renaming a Project preserves its identity. Deleting a Project does not delete its Tasks; affected Tasks become unassigned.

The Projects screen shows up to five recently used Projects and the complete Project list. Users can add, rename, open, and delete Projects. Opening a Project shows its Task list with the same filter and sorting capabilities used by other Task-result screens.

## Acceptance and evidence

- PROJECT-01: Renaming preserves identity and Task membership.
- PROJECT-02: Deleting a Project leaves its Tasks present and unassigned.

Automated evidence: [domain.test.ts](../../../test/domain.test.ts) checks Project Markdown round trips. PROJECT-01/02 also need manual membership checks; these are not covered by that format test. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Project schema](../../../skills/taskmate/references/project-schema.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

各プロジェクトは、安定IDと名称を持つ一つのMarkdownファイルとして保存します。タスクはプロジェクトIDを参照します。プロジェクトはタスクをまとめますが、タスクのライフサイクルを所有しません。

プロジェクト名を変更しても同一性は保たれます。プロジェクトを削除してもタスクは削除せず、対象タスクを未所属にします。

プロジェクト画面には最近使った最大5件と全一覧を表示します。追加、改名、表示、削除ができ、所属タスクの一覧にも共通のフィルターと並べ替えを適用します。

### 受け入れ条件

- PROJECT-01: 改名してもIDとタスクの所属を保つ。
- PROJECT-02: プロジェクトを削除してもタスクは残り、未所属になる。
