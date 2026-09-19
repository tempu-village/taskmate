# TaskMate

English | [日本語](README.ja.md)

TaskMate is a simple, local-first task manager for Obsidian. It provides a focused Todoist-style interface while keeping every task and project in readable Markdown inside your vault.

TaskMate also includes an optional portable Agent Skill. The Skill turns explicitly selected notes into reviewable proposals and creates or updates tasks only after you decide what to accept.

## Why TaskMate

- Use the same task interface in desktop and mobile Obsidian.
- Reorder tasks manually without losing that order in other built-in views.
- Keep tasks inspectable, portable, and editable as Markdown.
- Use the plugin without creating a TaskMate account or hosted database.
- Review AI-generated proposals before they become canonical tasks.

## Current features

- Three focused destinations: Date, Search, and Projects
- Scheduled, All, and No date views, with overdue, today, and later sections in Scheduled
- An Adjust menu that filters the current list and provides explicit task selection
- Single-task deletion in the editor and bulk editing or deletion from selection mode
- Search with up to 10 recent search terms
- Markdown-backed projects with five recent projects, rename, and safe deletion
- Priority 1–3 and up to 500 labels, with filters for priority, label, and completion state
- One-tap Today, Tomorrow, 7 days later, and No date suggestions
- Up to 10 recently saved label suggestions
- One global manual drag order plus date, priority, and creation sorting
- Auto, English, and 日本語 language settings with English fallback
- Desktop and mobile Obsidian support
- One readable Markdown file per task with a stable ID in frontmatter
- Explicit AI source folders with per-note include and exclude overrides
- Staged proposal review before an agent may create, merge, or exclude an action

## Quick start

1. Install and enable TaskMate.
2. Open the command palette and run **TaskMate: Open task list**.
3. Select **+ Add**, enter a title, and save the task.
4. Use the Date screen to view Scheduled, All, or No date tasks. Use Adjust to filter or select the current list.
5. Select **Settings → TaskMate → Language** to choose Auto, English, or 日本語.

The language change updates TaskMate views and settings immediately. Reload the plugin to update command names and the ribbon tooltip.

## Install from a local build

TaskMate is not yet listed in the Obsidian Community directory. Build it from this repository:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Copy these files into `<vault>/.obsidian/plugins/taskmate/`:

```text
main.js
manifest.json
styles.css
```

Restart Obsidian, open **Settings → Community plugins**, and enable TaskMate. Open it from the ribbon icon or run **TaskMate: Open task list** from the command palette.

## Use TaskMate on desktop and Android with Obsidian Sync

TaskMate can run on desktop and Android before it is listed in the Community directory. This procedure uses the official paid Obsidian Sync service; TaskMate itself does not provide or charge for synchronization.

### 1. Enable plugin synchronization

On both desktop and Android:

1. Open **Settings → Sync**.
2. Open **Vault configuration sync**.
3. Enable `Installed community plugin list`.
4. Enable `Active community plugin list`.

Enabling `Active community plugin list` also synchronizes the enabled or disabled state of community plugins other than TaskMate.

### 2. Place TaskMate in the desktop vault

Put the local build in the actual vault connected to Obsidian Sync:

```text
Synced vault/
└─ .obsidian/
   └─ plugins/
      └─ taskmate/
         ├─ main.js
         ├─ manifest.json
         └─ styles.css
```

Keep all three files directly inside the same `taskmate` folder:

```text
Correct:   .obsidian/plugins/taskmate/manifest.json
Incorrect: .obsidian/plugins/taskmate/taskmate/manifest.json
```

Restart desktop Obsidian and enable TaskMate under **Settings → Community plugins**.

### 3. Load the synchronized plugin on Android

1. Wait until desktop Obsidian reports **Fully Synced**.
2. Open the same remote vault on Android.
3. Wait until Android Obsidian reports **Fully Synced**.
4. Open **Settings → Community plugins**.
5. Select **Installed plugins** to make Android load the synchronized plugin list.
6. If TaskMate is disabled, enable it. If it is already enabled, disable it once and then enable it again.

Waiting for synchronization alone may update the plugin files without reloading the TaskMate code that is already running. The verified Android procedure keeps Obsidian open and reloads TaskMate by disabling and re-enabling the plugin after synchronization. A full restart of Android Obsidian is not required for this procedure.

### 4. Update both devices

For development installs, the repository provides a local deployment command. On the first run, pass the absolute path to the synchronized vault:

```bash
npm run deploy -- /absolute/path/to/synced-vault
```

The path is stored in a Git-ignored local file. Later updates require one command:

```bash
npm run deploy
```

The command runs type checking, tests, and a production build before replacing `main.js`, `manifest.json`, and `styles.css` in the desktop vault. After desktop and Android both report **Fully Synced**, open the Android installed-plugin list, disable TaskMate, and enable it again. Synchronization updates the files, while this plugin reload activates the new code.

This synchronization procedure has been confirmed with desktop Obsidian, Android Obsidian, official Obsidian Sync, and an unpublished TaskMate build. iOS has not yet been tested.

## Select notes for the Agent Skill

Run **TaskMate: Include current folder as an AI source**, or add one vault-relative folder per line under **Settings → TaskMate → AI source folders**.

Individual notes can override their folder rule:

```yaml
taskmate-source: true  # include this note anywhere
taskmate-source: false # exclude this note from an included folder
```

Processed source notes receive `taskmate-import-*` provenance properties. A content hash lets the Skill detect a later edit without treating its own metadata as a user change.

## Install and use the Agent Skill

The plugin works without the Agent Skill. To use AI-assisted task extraction, install `skills/taskmate` in an Agent Skills-compatible client. During local development:

```bash
mkdir -p "$HOME/.agents/skills"
ln -s "$(pwd)/skills/taskmate" "$HOME/.agents/skills/taskmate"
```

Open the vault as the agent workspace and ask:

```text
$taskmate Review the selected source notes and propose every Todo candidate.
```

The Skill writes proposals under `TaskMate/Proposals/Active` and does not create canonical tasks at this stage. Review every candidate in the conversation and explicitly approve, revise, or exclude it. Approved and revised proposals become tasks. The completed review moves to `TaskMate/Proposals/Archive` with visible and machine-readable decision markers and remains there until you delete it manually.

Change the proposal location under **Settings → TaskMate → Proposal folder** when needed. The proposal folder is an approval boundary, not a security sandbox, and does not expand the source-note allowlist.

## Storage, privacy, and permissions

- Tasks are stored under `TaskMate/Tasks` by default.
- Projects are stored under `TaskMate/Projects` by default.
- Proposal sessions are stored under `TaskMate/Proposals` by default.
- Folder locations can be changed in TaskMate settings.
- The plugin uses Obsidian's vault and file-management APIs to read and write TaskMate-managed Markdown.
- The plugin contains no telemetry, hosted TaskMate account, runtime AI, translation service, or TaskMate synchronization server.
- The plugin does not send task content to an external translation service.
- The optional Agent Skill runs with the permissions of the agent client and is separate from the Obsidian plugin.
- Uninstalling the plugin leaves task, project, and proposal Markdown in the vault.

Review these claims against the release build before public release. Back up the vault and understand the synchronization provider's conflict behavior before using TaskMate with important data.

## Known limitations

- Calendar, Kanban, recurrence, and reminders are not included in the current release.
- TaskMate does not provide its own free synchronization service.
- Simultaneous offline edits on multiple devices may be handled as conflicts by the vault synchronization provider.
- The Android workflow has been tested; iOS has not yet been tested.
- Command names and the ribbon tooltip require a plugin reload after changing the TaskMate language.
- TaskMate is not yet distributed through the Obsidian Community directory.

## Troubleshooting

If tasks synchronize but TaskMate does not appear on Android, confirm all of the following:

- Both devices enable `Installed community plugin list` and `Active community plugin list`.
- The desktop plugin folder is inside the same vault connected to Obsidian Sync.
- The path is `.obsidian/plugins/taskmate/`, without a duplicated `taskmate` folder.
- `main.js`, `manifest.json`, and `styles.css` are present.
- Both devices report **Fully Synced**.
- **Settings → Community plugins → Installed plugins** was opened on Android.
- TaskMate was disabled and then enabled again after synchronization, even if it was already enabled.

When reporting a bug, include the TaskMate version, Obsidian version, operating system, reproduction steps, and a sanitized example task when relevant. Do not publish private vault content.

## Translation workflow

English is the canonical source and fallback for TaskMate UI and user documentation.

1. Finalize changes in `src/i18n/en.ts` and English documentation.
2. Update `src/i18n/ja.ts` and Japanese documentation in the same change.
3. Check catalog keys, placeholders, Markdown structure, protected literals, and links.
4. Keep AI-created or AI-updated translations marked `ai-translated`.
5. Change the status to `human-reviewed` only after a person compares the complete current English and Japanese content.
6. Check both languages in real desktop and mobile Obsidian before release.

Do not add a feature specification only to Japanese. Update English first, then translate it. Keep code, commands, paths, property names, IDs, and URLs unchanged unless the localized UI intentionally uses a translated command label.

## Development and verification

```bash
npm run typecheck
npm test
npm run build
python3 -m unittest discover -s skills/taskmate/tests -v
python3 scripts/validate_skills.py
npm run validate:localization
git diff --check
```

The generated `main.js` is a build artifact. Do not edit it by hand.

## License

TaskMate is available under the [MIT License](LICENSE).

Copyright (c) 2026 Masashi (Tempu Village)

## Official Obsidian documentation

- [Obsidian Sync settings and selective sync](https://obsidian.md/help/sync/settings)
- [Community plugins](https://obsidian.md/help/community-plugins)
