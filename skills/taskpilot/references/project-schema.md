# Project schema

Read this reference for creating, renaming, listing, or deleting projects.

The vault-relative project folder comes from `.obsidian/plugins/taskmate/data.json` under `projectFolder`; use `TaskMate/Projects` only when the setting is absent. Each project is one Markdown file named `<readable-name>--<short-id>.md`.

```markdown
---
type: taskmate-project
id: "stable-project-id"
name: "新製品リリース"
created-at: "2026-09-07T10:00:00+09:00"
updated-at: "2026-09-07T10:00:00+09:00"
last-used-at: "2026-09-07T10:00:00+09:00"
---
```

Task files refer to the stable project `id`; renaming a project must not rewrite its tasks. Deleting a project must preserve its tasks and set their `project` property to `null`. Touch `last-used-at` when the user opens or assigns the project so the plugin can show the five most recently used projects.
