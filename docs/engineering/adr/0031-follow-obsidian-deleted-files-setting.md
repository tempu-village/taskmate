# ADR 0031: Delete Task and Project files through Obsidian's Deleted files setting

Status: Accepted

## Context

Before this decision, TaskMate deleted Task and Project files with `Vault.trash(file, true)`, which always moves them to the system trash, and its confirmations said "Move … to the trash?". The Obsidian Community directory review recommends `FileManager.trashFile()`, which follows the user's **Deleted files** setting (system trash, the vault's `.trash` folder, or permanent deletion) (#122). The change was dropped once for 0.7.1 because that setting can delete files permanently, which contradicted the confirmation wording.

## Decision

- Delete Task and Project files with `FileManager.trashFile()`, so TaskMate respects the deletion behavior the user chose for the whole vault.
- Word the Task and bulk deletion confirmations as "Delete …?" and state that the file follows Obsidian's Deleted files setting and may be deleted permanently. The success notices say "deleted" rather than "moved to the trash".

## Considered options

- Keeping `Vault.trash()` would always keep deleted Tasks recoverable, but it ignores the user's vault-wide choice: a user who keeps deletions inside the vault's `.trash` folder, for example to sync them, would find TaskMate files in the system trash instead.

## Consequences

- Users whose setting is **Permanently delete** cannot recover Tasks deleted in TaskMate. The confirmation says so before the deletion.
- The desktop E2E test checks the `.trash` folder and permanent deletion options. The system trash option and mobile are checked manually.
- Deleting a Project still unassigns its Tasks and keeps their files ([ADR 0006](0006-unassign-tasks-when-deleting-projects.md)).

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

この判断の前は、TaskMateはタスクとプロジェクトのファイルを`Vault.trash(file, true)`で常にシステムのゴミ箱へ移し、確認文も「ゴミ箱へ移動しますか？」でした。この判断の後は、`FileManager.trashFile()`を使い、Obsidianの削除の設定（システムのゴミ箱、Vaultの`.trash`フォルダ、完全に削除）に従います。確認文は「削除しますか？」とし、設定によっては完全に削除されることを明記します。完了の通知も「削除しました」にします。

常に元に戻せる`Vault.trash()`を残す案は、Vault全体に対するユーザーの選択を無視するため採りませんでした。設定が「完全に削除」のユーザーはTaskMateで削除したタスクを元に戻せませんが、その点は削除前の確認文で伝えます。
