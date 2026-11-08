# Desktop E2E tests

Status: Current. These tests drive the real Obsidian desktop app with the built plugin. They are evidence for the exercised desktop cases only.

## What runs

`npm run test:e2e` runs WebdriverIO specs in `test/e2e/specs/*.e2e.ts` through [`wdio-obsidian-service`](https://github.com/jesse-r-s-hines/wdio-obsidian-service), configured in [wdio.conf.mts](../../../wdio.conf.mts). Each run:

1. Resolves the Obsidian version from `OBSIDIAN_VERSIONS` (default `latest/latest`, meaning app/installer).
2. Downloads that Obsidian build into `.obsidian-cache/` if it is not already there.
3. Installs this checkout's `main.js`, `manifest.json` and `styles.css` as a plugin.
4. Opens a sandboxed copy of [the test Vault](../../../test/e2e/vaults/basic) and runs the specs.

`task-list.e2e.ts` opens the TaskMate list, clicks the All tab by position (so it does not depend on UI language), and checks that the Vault's sample Task is shown. `schedule.e2e.ts` covers regressions for time and repeat: both are disabled with a hint while a Task has no date, completing a weekly Task advances its date and deadline by seven days and reopens its Steps, and date sort orders same-day Tasks untimed first, then by time. `obsidian-ui.e2e.ts` reads computed styles where Obsidian's own view, button and input rules compete with TaskMate's (list padding, task titles, the Label input and Step rows), and the review padding of a Proposal. It also checks that deleting a Task, deleting selected Tasks, deleting a label, deleting a project (whose Tasks keep their files with `project: null`) and rejecting a Proposal each ask in an Obsidian modal, keep the data on Cancel and go ahead on confirm, and that a deleted Task follows Obsidian's Deleted files setting (the `.trash` folder and permanent deletion; the system trash is not used so tests do not touch the host's trash). It also opens the list in a popout window and checks that the confirmation opens there. Obsidian's `Menu` does not open from WebDriver clicks, so the selection and label tests call the list view's handler for the Adjust menu item directly. WebDriver cannot drive a real IME either, so the label input test replays a Japanese IME's events, including Safari's confirming Enter with `keyCode` 229, and checks that only a later plain Enter adds the label.

## Vault safety

E2E runs must never read, change or delete files in a real Vault, including the Vaults of other developers who run them. Each spec file opens a fresh temporary copy of the fixture Vault, and `wdio-obsidian-service` removes it afterwards, so test code never needs to delete files. Code enforces this in [test/e2e/vault-guard.ts](../../../test/e2e/vault-guard.ts):

1. **Before Obsidian starts**, `wdio.conf.mts` calls `assertFixtureVault`. The Vault path is fixed in code (no environment variable can change it), must stay inside `test/e2e/vaults/` after `realpath` (so a symbolic link cannot lead outside), and must contain the `.taskmate-e2e-fixture` marker. Otherwise the run stops.
2. **After Obsidian opens the Vault**, the `before` hook in `wdio.conf.mts` calls `assertSandboxVault()` from [test/e2e/sandbox-vault.ts](../../../test/e2e/sandbox-vault.ts) once per spec file, before any test runs. It resolves the opened Vault's `getBasePath()` with `realpath` and requires it to be inside `os.tmpdir()`, not the fixture Vault itself, and marked. The opened Vault does not change during a run, so one check per launch is enough, and no spec can forget it.
3. **In `npm run lint`**, an ESLint block in [eslint.config.mjs](../../../eslint.config.mjs) applies to `test/e2e/specs/**` only. It rejects direct access to `app.vault` or its `adapter`, imports of `fs`, `fs/promises` and `child_process`, and deletion calls such as `.delete(`, `.trash(`, `trashFile(`, `.remove(`, `rm(` and `rmdir(`. It checks syntax, not words, so UI selectors and setting names such as `.taskmate-delete-task` or `trashOption` in strings and comments are allowed. Specs work with Vault files only through `helpers.ts`, which has no delete helper. CI runs `npm run lint` in the `verify` job. The block turns off the Obsidian Community scorecard rules for specs, because those rules review shipped plugin code, not tests. Its ignore list leaves `test/` ignored except `test/e2e/specs/`; ESLint cannot re-include a file whose parent folder is ignored, so the list ignores each level with `/*` and un-ignores the next folder on the path. Do not collapse it into `test/**`, which would silently stop linting the specs.
4. **In `npm test`**, [test/e2e-vault-guard.test.ts](../../../test/e2e-vault-guard.test.ts) checks that both guards reject a Vault outside the fixture folder, a symbolic link leading outside, a Vault without the marker, a Vault outside the temporary folder and the fixture Vault itself.

Tests of TaskMate's own delete features run the deletion through the TaskMate UI rather than from test code. They change Obsidian's Deleted files setting only through `setTrashOption`, which accepts `local` and `none` but not `system`, so a run never fills the host's trash.

## Why Obsidian is downloaded into the cache

The test does not use the installed `/Applications/Obsidian.app`. A separately downloaded copy lets the test pin an exact Obsidian version, run the same version on every machine and in CI, and start with its own settings instead of the user's Vault list, Sync sign-in or other Vaults. Keeping the download in `.obsidian-cache/` avoids downloading it again on every run; the folder is ignored by Git and cached by CI.

## Running locally

```bash
npm run build
npm run test:e2e
```

Build first: the test installs the current `main.js`. Use `OBSIDIAN_VERSIONS="1.14.5/1.14.5"` to pick a version, or `"earliest/earliest latest/latest"` to test several. `latest-beta` needs an Obsidian Insider account and is not used.

## CI

The `e2e` job in [CI](../../../.github/workflows/ci.yml) runs on Ubuntu. Linux runners have no screen, so the job starts a virtual display (Xvfb) and a small window manager (herbstluftwm) before running the tests. The cache key comes from the resolved Obsidian versions, so a new Obsidian release downloads once and is then reused.

## Writing specs

- Import `browser`/`expect` from `@wdio/globals` and `describe`/`it` from `mocha`; globals are not injected.
- Use `browser.executeObsidianCommand("taskmate:<command-id>")` to open UI, and `browser.executeObsidian(({ app }) => ...)` to read state. Functions passed to `executeObsidian` are serialized, so pass values as arguments instead of capturing them.
- Select by stable class, role or attribute, not by translated text. WebdriverIO's `*=text` selector matches links only; assert on an element's text instead.
- Never touch `app.vault` or delete files from a spec; `npm run lint` rejects both (see [Vault safety](#vault-safety)).
- Prefer the shared helpers in [test/e2e/helpers.ts](../../../test/e2e/helpers.ts) over writing `executeObsidian` calls in each spec:
  - `taskMarkdown(fixture)` builds schema-valid task Markdown; `writeTask(fixture)` writes it to `TaskMate/Tasks/<id>.md` and returns the path.
  - `writeVaultFile(path, content)` creates or overwrites any Vault file and its missing parent folders, and `readVaultFile(path)` reads one, through the Obsidian vault API.
  - `vaultFileExists(path)` checks a file on disk, including hidden folders such as `.trash`; `setTrashOption(option)` sets Obsidian's Deleted files setting to `local` or `none`.
  - `writePriorityProposal(proposalId, taskId, taskFile)` writes a pending Proposal that changes a Task's priority; `closeModals()` closes modals left open.
  - `openAllTab()` opens the TaskMate list and selects the All tab by position; `taskListView()` returns the list view.
  - `taskRow(id)` finds a row by `data-task-id`, and `taskRowIds(prefix)` returns the displayed order of rows whose id starts with `prefix`.
- When a new spec needs a setup, read or navigation step that other specs could reuse, add it to `helpers.ts` (and to the list above) instead of writing it inside the spec. Keep one-off assertions in the spec.
- Each spec file starts from a fresh copy of the test Vault, but tests in one file share it, so give each test's Tasks distinct ids.
- Specs are typechecked by `npm run typecheck` through [test/e2e/tsconfig.json](../../../test/e2e/tsconfig.json).

The plugin names, internal members and DOM markers the specs depend on are listed in [Desktop E2E test surface](../specifications/desktop-e2e-test-surface.md). Keep it current when a spec starts depending on a new one.

## Not covered

- **Mobile:** not tested. Desktop mobile emulation does not reproduce the real mobile app, which runs on Capacitor rather than Electron, so it is not used as evidence. Mobile remains a manual check in [Testing](testing.md).
- Windows and macOS are not in CI; macOS has been run locally.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

`npm run test:e2e`は、ビルド済みプラグインを入れた本物のObsidianデスクトップ版をWebdriverIOで操作します。`task-list.e2e.ts`は一覧を開き、「すべて」タブを位置で選んでクリックし、テスト用Vaultのタスクが表示されることを確かめます。`schedule.e2e.ts`は時刻と繰り返しの回帰テストで、日付なしでは両方が無効で案内が出ること、毎週タスクの完了で予定日と締切が7日進みStepが未完了に戻ること、日付ソートで同じ日のタスクが時刻なし→時刻順に並ぶことを確かめます。`obsidian-ui.e2e.ts`は、Obsidian本体のビュー・ボタン・入力欄のスタイルとTaskMateのスタイルが競合する箇所（一覧の余白、タスクのタイトル、ラベル入力欄、ステップ行）とProposalレビューの余白の計算済みスタイルを確かめます。さらに、タスク削除、選択タスクの一括削除、ラベル削除、プロジェクト削除（タスクのファイルは残り`project: null`になる）、Proposalの却下でObsidianのモーダルによる確認が出て、キャンセルでは何も変わらず、確定で実行されること、削除したタスクがObsidianの削除の設定に従うこと（`.trash`フォルダと完全に削除。実行するPCのゴミ箱に触れないよう、システムのゴミ箱は使いません）を確かめます。一覧を別ウィンドウで開き、確認ダイアログがそのウィンドウに出ることも確かめます。Obsidianの`Menu`はWebDriverのクリックでは開かないため、選択とラベルのテストは「表示とタスクの操作」メニュー項目の処理を一覧ビューから直接呼びます。specが頼っているプラグイン名、内部メンバー、DOMの目印は[Desktop E2E test surface](../specifications/desktop-e2e-test-surface.md)に一覧があります。WebDriverは本物のIMEも操作できないため、ラベル入力欄のテストは日本語IMEが出すイベント（Safariの確定EnterのkeyCode 229を含む）を再現し、その後の通常のEnterでだけラベルが追加されることを確かめます。

specを書くときは、各specで`executeObsidian`を直接書かず、`test/e2e/helpers.ts`の共通処理を使います。

- `taskMarkdown(fixture)`はスキーマに沿ったタスクMarkdownを作り、`writeTask(fixture)`はそれを`TaskMate/Tasks/<id>.md`に書き込んでパスを返します。
- `writeVaultFile(path, content)`はVaultのファイルを作成または上書きし（親フォルダがなければ作ります）、`readVaultFile(path)`は読み取ります。どちらもObsidianのVault APIを使います。
- `vaultFileExists(path)`は`.trash`のような隠しフォルダを含めてディスク上のファイルの有無を確かめ、`setTrashOption(option)`はObsidianの削除の設定を`local`か`none`にします。
- `writePriorityProposal(proposalId, taskId, taskFile)`はタスクの優先度を変える保留中のProposalを書き込み、`closeModals()`は開いたままのモーダルを閉じます。
- `openAllTab()`は一覧を開いて「すべて」タブを位置で選び、`taskListView()`は一覧のビューを返します。
- `taskRow(id)`は`data-task-id`で行を探し、`taskRowIds(prefix)`は`prefix`で始まるIDの行を表示順で返します。

specでは`app.vault`を直接使わず、ファイルを削除しません。どちらも`npm run lint`が拒否します。

新しいspecで、ほかのspecでも使えそうな準備・読み取り・画面操作が必要になったら、spec内に書かず`helpers.ts`に追加し、上の一覧にも加えます。そのspecだけの確認はspec内に残します。

テスト用Vaultはspecファイルごとに新しく複製されますが、同じファイル内のテストでは共有されるため、テストごとにタスクIDを変えてください。実行前に`npm run build`が必要です。

### Vaultの安全性

E2Eは、他の開発者のものを含め、実際のVaultのファイルを読み書き・削除してはいけません。specファイルごとにテスト用Vaultの一時コピーが作られ、実行後は`wdio-obsidian-service`が片付けるため、テストコードがファイルを削除する場面はありません。これを[test/e2e/vault-guard.ts](../../../test/e2e/vault-guard.ts)のコードで強制します。

1. **Obsidianの起動前**：`wdio.conf.mts`が`assertFixtureVault`を呼びます。Vaultのパスはコードに固定し（環境変数では変えられません）、`realpath`で解決したあとも`test/e2e/vaults/`の下にあり、目印ファイル`.taskmate-e2e-fixture`があることを確かめます。満たさなければ実行を止めます。
2. **ObsidianがVaultを開いた後**：`wdio.conf.mts`の`before`フックが、specファイルごとに1回、テストより先に[test/e2e/sandbox-vault.ts](../../../test/e2e/sandbox-vault.ts)の`assertSandboxVault()`を呼びます。開いているVaultの`getBasePath()`を`realpath`で正規化し、`os.tmpdir()`の下にあること、元のテスト用Vaultそのものではないこと、目印ファイルがあることを確かめます。1回の起動のあいだVaultは変わらないので起動直後の1回で足り、specが呼び忘れることもありません。
3. **`npm run lint`**：[eslint.config.mjs](../../../eslint.config.mjs)の`test/e2e/specs/**`だけを対象とする設定が、`app.vault`やその`adapter`への直接アクセス、`fs`・`fs/promises`・`child_process`の読み込み、`.delete(`・`.trash(`・`trashFile(`・`.remove(`・`rm(`・`rmdir(`などの削除の呼び出しを拒否します。単語ではなく構文を検査するため、文字列やコメント中の`.taskmate-delete-task`や`trashOption`のようなUIのセレクタや設定名は許可されます。specは`helpers.ts`だけでVaultのファイルを扱い、`helpers.ts`に削除用の処理はありません。CIは`verify`ジョブで`npm run lint`を実行します。この設定は、specに対してObsidian Community scorecardのルールを無効にします。これらのルールは配布されるプラグイン本体のコードを審査するためのもので、テストには当てはまらないためです。また、除外の一覧は`test/`を除外したまま`test/e2e/specs/`だけを検査対象に戻します。ESLintは親フォルダが除外されたファイルを戻せないため、階層ごとに`/*`で除外し、次のフォルダの除外を解除しています。`test/**`にまとめると、specが黙って検査されなくなるので変えないでください。
4. **`npm test`**：[test/e2e-vault-guard.test.ts](../../../test/e2e-vault-guard.test.ts)が、2つの守りがテスト用フォルダの外のVault、外を指すシンボリックリンク、目印のないVault、一時フォルダの外のVault、元のテスト用Vaultそのものを拒否することを確かめます。

TaskMateの削除機能のテストは、テストコードで消さず、TaskMateのUIから削除を実行します。Obsidianの削除の設定は`setTrashOption`でだけ切り替えます。`local`と`none`だけを受け付け、`system`は受け付けないため、実行するPCのゴミ箱にファイルが溜まりません。

インストール済みのObsidianは使わず、テスト用のObsidianを`.obsidian-cache/`へダウンロードします。こうすると、バージョンを固定して手元とCIで同じものを使え、普段のVault一覧・Syncのログイン・他のVaultに触れない独立した設定で起動できます。毎回ダウンロードし直さないよう保存しておき、このフォルダはGit管理外で、CIではキャッシュします。

CIの`e2e`ジョブはUbuntuで動き、画面がないため仮想ディスプレイ（Xvfb）とウィンドウマネージャーを起動してから実行します。モバイルは対象外です。デスクトップでのモバイル表示の再現は実際のモバイル版（Capacitor）の代わりにならないため、根拠として使いません。
