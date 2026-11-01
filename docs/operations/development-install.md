# Install a development build

This procedure is for contributors who run an unpublished TaskMate build. Users should install a GitHub Release as described in the [README](../../README.md#install).

## Build and install locally

Build TaskMate from this repository:

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

To use a working copy of Task Pilot, link it into the agent client's skills folder:

```bash
mkdir -p "$HOME/.agents/skills"
ln -s "$(pwd)/skills/taskpilot" "$HOME/.agents/skills/taskpilot"
```

## Use a development build on desktop and Android with Obsidian Sync

This procedure uses the official paid Obsidian Sync service; TaskMate itself does not provide or charge for synchronization.

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

Waiting for synchronization alone may update the plugin files without reloading the TaskMate code that is already running. The verified Android procedure keeps Obsidian open and reloads TaskMate by disabling and re-enabling the plugin after synchronization. A full restart of Android Obsidian is not required.

### 4. Update both devices

On the first run, pass the absolute path to the synchronized vault:

```bash
npm run deploy -- /absolute/path/to/synced-vault
```

The path is stored in a Git-ignored local file. Later updates require one command:

```bash
npm run deploy
```

The command runs type checking, tests, and a production build before replacing `main.js`, `manifest.json`, and `styles.css` in the desktop vault. After desktop and Android both report **Fully Synced**, open the Android installed-plugin list, disable TaskMate, and enable it again. Synchronization updates the files, while this plugin reload activates the new code.

This procedure has been confirmed with desktop Obsidian, Android Obsidian, official Obsidian Sync, and an unpublished TaskMate build. iOS has not yet been tested.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

未公開のTaskMateビルドを動かす開発者向けの手順です。利用者は[README](../../README.ja.md#インストール)に従ってGitHub Releaseを入れてください。

### ローカルでビルドして入れる

上記の`npm install`から`npm run build`までを実行し、`main.js`、`manifest.json`、`styles.css`を`<vault>/.obsidian/plugins/taskmate/`へコピーします。Obsidianを再起動し、**設定 → コミュニティプラグイン**でTaskMateを有効にします。作業中のTask Pilotを使う場合は、上記の`ln -s`でエージェントクライアントのskillsフォルダへリンクします。

### Obsidian SyncでPCとAndroidから開発ビルドを使う

公式の有料サービスであるObsidian Syncを使います。TaskMate自体は同期機能を提供しません。

1. PCとAndroidの両方で**設定 → Sync → 保管庫設定の同期**を開き、`Installed community plugin list`と`Active community plugin list`を有効にします。後者はTaskMate以外のプラグインの有効・無効状態も同期します。
2. Syncに接続している実際のVaultの`.obsidian/plugins/taskmate/`直下に3ファイルを置き（`taskmate/taskmate/`のように入れ子にしない）、PC版Obsidianを再起動してTaskMateを有効にします。
3. PCとAndroidの両方が**Fully Synced**になったら、Androidで**設定 → コミュニティプラグイン → インストール済みプラグイン**を開き、TaskMateを有効にします。すでに有効なら一度無効にしてから有効にします。同期だけでは実行中のコードが再読み込みされない場合があります。Androidの完全再起動は不要です。
4. 更新は、初回に`npm run deploy -- /absolute/path/to/synced-vault`、以降は`npm run deploy`を実行します。型チェック、テスト、本番ビルドの後にPC側の3ファイルを置き換えます。両端末が**Fully Synced**になった後、Androidで手順3と同じくTaskMateを無効化・再有効化します。

この手順はPC版・Android版Obsidian、公式Obsidian Sync、未公開ビルドの組み合わせで確認済みです。iOSは未確認です。
