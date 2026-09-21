# ADR 0022: Prevent stale Task overwrites with guarded three-way comparison

Status: Accepted

## Context

A Task can remain open in the Add/Edit Task editor while Obsidian Sync, Codex, another plugin, or another Obsidian view changes the same Task file. `Vault.process()` protects the short read-modify-write operation, but it does not by itself protect the longer interval between opening the editor and activating Save. Writing the editor's stale full draft would therefore risk silently replacing newer values. Sync conflicts can also create multiple files carrying the same stable Task ID.

## Decision

Treat a Task edit as an in-memory edit session. Capture the Task state and source content when the editor opens, then perform one guarded three-way comparison inside `Vault.process()` for each save attempt:

1. the edit session's opening state;
2. the user's draft; and
3. the current file state supplied to the guarded write.

For each TaskMate-managed field, retain a change made by only one side and accept an identical result produced by both sides. If the draft and current file changed the same field to different values, do not write and present a conflict for explicit user review. Any field whose value is a collection or other compound value is compared as one complete field, not merged element by element. This applies consistently to Labels and to every other present or future multi-value field unless a later ADR defines field-specific merge semantics.

Resolve the file by stable Task ID rather than trusting only the path captured when the editor opened. If multiple files have the same Task ID, stop normal Task processing and notify the user of an identity conflict. If the Task was deleted, report that state instead of recreating it implicitly.

Preserve the latest values of fields the editor did not change. Preserve properties that TaskMate does not recognize instead of removing or replacing them during a TaskMate edit. Immutable identity fields are not editable merge candidates.

When the first comparison finds a conflict, retain the exact current file state shown by the conflict UI as a conflict-review baseline. A later user action such as `Save my version` is a new save attempt and must compare the then-current file state with that conflict-review baseline inside a new guarded write. If another actor changed the file while the conflict UI was open, do not apply the earlier decision; refresh the conflict information and require a decision against the new current state. This second validation prevents a user decision based on an obsolete conflict screen from overwriting a newer change.

TaskMate cannot compare a remote version that has not yet reached the local Vault. When Obsidian Sync is used and preserving both sides of a detected remote conflict is preferred, recommend enabling **Create conflict file** in Obsidian Sync's conflict-resolution setting on every device. The setting is device-specific. A conflicted copy can carry the same stable Task ID as the original, so the duplicate-ID rule above stops normal processing until the user resolves the copies.

Do not add a TaskMate-managed distributed edit lock, persisted editing-presence record, or post-sync conflict monitor. A lock synchronized as an ordinary Vault file can arrive late, split while devices are offline, become stale after a crash, and be ignored by Codex, other plugins, or external editors. A strong exclusive lock would require an online coordinating authority through which every writer must pass, contradicting TaskMate's portable Markdown and offline-first constraints. Obsidian Sync's conflict copies and version history remain the recovery layer for changes that were not locally visible at save time.

## Considered Options

- Rejecting every save after any external change is safe but unnecessarily discards or blocks edits to unrelated fields.
- Last-writer-wins is simple but permits silent data loss and therefore does not meet the release requirement.
- Persisting a revision counter changes the portable Task schema, requires every writer to maintain it, and does not by itself solve concurrent offline increments. An in-memory baseline plus the exact current file content provides the required guard without a schema migration.
- A synchronized lock or editing-status file can reduce accidental overlap but cannot guarantee exclusion across delayed or offline replicas, and writers outside TaskMate would not honor it.
- A server-coordinated lease could provide stronger exclusion, but would add an online dependency, identity, lease expiry, and stale-writer fencing to a product that intentionally has no TaskMate account or synchronization server.

## Consequences

- Normal saves read and compare only the edited Task, so the guard does not require comparing the entire Task collection.
- Edit-session and conflict-review baselines exist only in memory and are discarded when their UI closes.
- A conflict requires an explicit user decision; the file remains unchanged until that decision is validated against the latest state.
- Compound values favor safety over automatic element-level merging.
- Obsidian Sync's own remote conflict resolution remains outside TaskMate's guarantee. TaskMate guards writes after versions reach the local Vault and detects duplicate Task identities instead of treating them as ordinary Tasks.
- Users who want detected Sync conflicts preserved as separate reviewable files must enable **Create conflict file** on each Obsidian device.
- TaskMate does not add a second background notification or lock system for remote changes that have not yet reached the local Vault.

Related: GitHub Issue #5.
