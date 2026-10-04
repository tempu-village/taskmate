# Task file format

Status: Current normative contract. Task Pilot's [Task schema](../../../skills/taskpilot/references/task-schema.md) remains the canonical contract used by an installed skill; this repository specification records the same implementation-facing requirements without replacing it.

## File and identity

- A Task MUST be stored as one Markdown file in the configured Task folder.
- Frontmatter `type` MUST be `todo` and `id` MUST contain the Task's stable identity.
- Identity MUST survive title and filename changes. Readers MUST continue accepting legacy `<readable-title>--<short-id>.md` names.
- New filenames use a readable title and a numeric collision suffix such as ` (2)` when needed. The filename MUST NOT be treated as the stable identity.

## Properties and values

- `completed` is boolean.
- `date` is `YYYY-MM-DD` or absent/null according to the parser model.
- `priority` is `1`, `2`, `3` or null; new writes MUST use `priority`. Readers MUST treat legacy `important: true` as priority 1.
- `labels` is an inline JSON string array. The UI exposes at most 500 distinct labels.
- `project` is a stable Project ID or null, never a display name.
- `rank` is the single global manual-order value. Automatic sorting MUST NOT rewrite it.
- `created-at`, `updated-at` and non-null `completed-at` use ISO timestamps; `completed-at` is null while incomplete.
- Task updates MUST preserve frontmatter properties they do not recognize.

## Body ownership

The first heading is the Task title. `## Steps` contains ordered Step values and `## Notes` contains optional supporting prose. A Step uses `- [ ] text` or `- [x] text`; an optional due date is a trailing `<!-- due: YYYY-MM-DD -->` comment. Other comments are visible Step text and MUST be preserved. Step order MUST be preserved. Parent and Step completion are independent.

## Write and compatibility guarantees

TypeScript and Python readers/writers MUST round-trip the supported Task properties, body sections and unknown frontmatter without silently redefining the format. Format changes require an explicit compatibility or migration decision and matching TypeScript and Python tests. Atomicity across a content save and a subsequent filename rename is not specified; they are separate operations.

The precise treatment of arbitrary Markdown outside the owned title, Steps and Notes regions is not otherwise specified here. Implementations MUST NOT claim stronger preservation than their tests establish.

## Verification

See [domain round-trip tests](../../../test/domain.test.ts), [repository tests](../../../test/repository-conflicts.test.ts), [Task Step tests](../../../test/task-steps.test.ts) and [Task Pilot store tests](../../../skills/taskpilot/tests/test_todo_store.py). Conceptual ownership remains in [data model](../design/data-model.md); user-visible editing behavior remains in [Task editing](../features/task-editing.md) and [Task Steps](../features/task-steps.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

Taskは設定されたフォルダーのMarkdown一ファイルで、`type: todo`と安定した`id`を持ちます。IDはタイトルやファイル名の変更で変えず、旧`--<short-id>`形式も読み取ります。日付、priority、labels、project、rank、timestampは上記形式に従い、未知のfrontmatterを保持します。Stepsは親Task内の順序付き値で、親とは独立して完了できます。形式変更には互換性または移行判断とTypeScript・Python双方の検証が必要です。未確認のMarkdown保持保証は追加しません。
