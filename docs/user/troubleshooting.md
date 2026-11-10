# Troubleshooting

## TaskMate does not appear on Android after synchronization

Confirm that the desktop and Android devices have enabled both the installed and active community-plugin lists, and that the plugin files are synchronized in the same Vault at `.obsidian/plugins/taskmate/`. The folder must contain `main.js`, `manifest.json`, and `styles.css` directly. Wait for both devices to report fully synchronized, then open the installed-plugin list on Android and disable and re-enable TaskMate.

For release installation and recovery, see [Release TaskMate](../operations/releasing.md).

## A review does not appear on another device

Reviews are JSON files in the proposal folder (`TaskMate/Proposals` by default). Obsidian Sync skips JSON files unless **Settings → Sync → Selective sync → Sync all other types** is on. Turn it on on every device, wait until both report fully synchronized, and then run **TaskMate: Open reviews** again.

## Agent-assisted import does not find a note

Only selected source folders and notes explicitly marked `taskmate-source: true` are eligible. A `taskmate-source: false` property excludes a note inside a selected folder. Review the source configuration before changing scope.

## 日本語参考

## 同期後にAndroidでTaskMateが表示されない

PCとAndroidの両方で、インストール済み・有効なコミュニティプラグインの一覧を有効にしてください。同じVaultの`.obsidian/plugins/taskmate/`へプラグインファイルが同期され、直下に`main.js`、`manifest.json`、`styles.css`がある必要があります。両端末で完全同期を確認してから、Androidのインストール済みプラグイン一覧を開き、TaskMateを無効化して再度有効化します。

Releaseの導入と復旧は[TaskMateをリリースする](../operations/releasing.md)を参照してください。

## レビューが別の端末に表示されない

レビューは提案フォルダ（初期値は`TaskMate/Proposals`）内のJSONファイルです。**設定 → 同期 → 選択的同期 → 他のすべてのタイプのファイルを同期**がオフだと、Obsidian SyncはJSONファイルを同期しません。すべての端末でオンにし、両方が完全同期になってから、もう一度**TaskMate: レビューを開く**を実行してください。

## Task Pilotがメモを見つけない

選択済みのsource folder、または`taskmate-source: true`を明示したノートだけが対象です。`taskmate-source: false`は、選択フォルダー内のノートも除外します。対象範囲を変える前にsource設定を確認してください。
