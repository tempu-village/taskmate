# Desktop E2E tests

Status: Current. These tests drive the real Obsidian desktop app with the built plugin. They are evidence for the exercised desktop cases only.

## What runs

`npm run test:e2e` runs WebdriverIO specs in `test/e2e/specs/*.e2e.ts` through [`wdio-obsidian-service`](https://github.com/jesse-r-s-hines/wdio-obsidian-service), configured in [wdio.conf.mts](../../../wdio.conf.mts). Each run:

1. Resolves the Obsidian version from `OBSIDIAN_VERSIONS` (default `latest/latest`, meaning app/installer).
2. Downloads that Obsidian build into `.obsidian-cache/` if it is not already there.
3. Installs this checkout's `main.js`, `manifest.json` and `styles.css` as a plugin.
4. Opens a sandboxed copy of [the test Vault](../../../test/e2e/vaults/basic) and runs the specs.

`task-list.e2e.ts` opens the TaskMate list, clicks the All tab by position (so it does not depend on UI language), and checks that the Vault's sample Task is shown. `schedule.e2e.ts` covers regressions for time and repeat: both are disabled with a hint while a Task has no date, completing a weekly Task advances its date and deadline by seven days and reopens its Steps, and date sort orders same-day Tasks untimed first, then by time. `obsidian-ui.e2e.ts` reads computed styles where Obsidian's own view, button and input rules compete with TaskMate's (list padding, task titles, the Label input and Step rows), and the review padding of a Proposal. It also checks that deleting a Task, deleting selected Tasks, deleting a label and rejecting a Proposal each ask in an Obsidian modal, keep the data on Cancel and go ahead on confirm, and that a deleted Task follows Obsidian's trash setting. Obsidian's `Menu` does not open from WebDriver clicks, so the selection and label tests call the list view's handler for the Adjust menu item directly.

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
- Prefer the shared helpers in [test/e2e/helpers.ts](../../../test/e2e/helpers.ts) over writing `executeObsidian` calls in each spec:
  - `taskMarkdown(fixture)` builds schema-valid task Markdown; `writeTask(fixture)` writes it to `TaskMate/Tasks/<id>.md` and returns the path.
  - `writeVaultFile(path, content)` creates or overwrites any Vault file, and `readVaultFile(path)` reads one, through the Obsidian vault API.
  - `openAllTab()` opens the TaskMate list and selects the All tab by position; `taskListView()` returns the list view.
  - `taskRow(id)` finds a row by `data-task-id`, and `taskRowIds(prefix)` returns the displayed order of rows whose id starts with `prefix`.
- When a new spec needs a setup, read or navigation step that other specs could reuse, add it to `helpers.ts` (and to the list above) instead of writing it inside the spec. Keep one-off assertions in the spec.
- Each spec file starts from a fresh copy of the test Vault, but tests in one file share it, so give each test's Tasks distinct ids.
- Specs are typechecked by `npm run typecheck` through [test/e2e/tsconfig.json](../../../test/e2e/tsconfig.json).

## Not covered

- **Mobile:** not tested. Desktop mobile emulation does not reproduce the real mobile app, which runs on Capacitor rather than Electron, so it is not used as evidence. Mobile remains a manual check in [Testing](testing.md).
- Windows and macOS are not in CI; macOS has been run locally.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

`npm run test:e2e`は、ビルド済みプラグインを入れた本物のObsidianデスクトップ版をWebdriverIOで操作します。`task-list.e2e.ts`は一覧を開き、「すべて」タブを位置で選んでクリックし、テスト用Vaultのタスクが表示されることを確かめます。`schedule.e2e.ts`は時刻と繰り返しの回帰テストで、日付なしでは両方が無効で案内が出ること、毎週タスクの完了で予定日と締切が7日進みStepが未完了に戻ること、日付ソートで同じ日のタスクが時刻なし→時刻順に並ぶことを確かめます。`obsidian-ui.e2e.ts`は、Obsidian本体のビュー・ボタン・入力欄のスタイルとTaskMateのスタイルが競合する箇所（一覧の余白、タスクのタイトル、ラベル入力欄、ステップ行）とProposalレビューの余白の計算済みスタイルを確かめます。さらに、タスク削除、選択タスクの一括削除、ラベル削除、Proposalの却下でObsidianのモーダルによる確認が出て、キャンセルでは何も変わらず、確定で実行されること、削除したタスクがObsidianのゴミ箱設定に従うことを確かめます。Obsidianの`Menu`はWebDriverのクリックでは開かないため、選択とラベルのテストは「表示とタスクの操作」メニュー項目の処理を一覧ビューから直接呼びます。

specを書くときは、各specで`executeObsidian`を直接書かず、`test/e2e/helpers.ts`の共通処理を使います。

- `taskMarkdown(fixture)`はスキーマに沿ったタスクMarkdownを作り、`writeTask(fixture)`はそれを`TaskMate/Tasks/<id>.md`に書き込んでパスを返します。
- `writeVaultFile(path, content)`はVaultのファイルを作成または上書きし、`readVaultFile(path)`は読み取ります。どちらもObsidianのVault APIを使います。
- `openAllTab()`は一覧を開いて「すべて」タブを位置で選び、`taskListView()`は一覧のビューを返します。
- `taskRow(id)`は`data-task-id`で行を探し、`taskRowIds(prefix)`は`prefix`で始まるIDの行を表示順で返します。

新しいspecで、ほかのspecでも使えそうな準備・読み取り・画面操作が必要になったら、spec内に書かず`helpers.ts`に追加し、上の一覧にも加えます。そのspecだけの確認はspec内に残します。

テスト用Vaultはspecファイルごとに新しく複製されますが、同じファイル内のテストでは共有されるため、テストごとにタスクIDを変えてください。実行前に`npm run build`が必要です。

インストール済みのObsidianは使わず、テスト用のObsidianを`.obsidian-cache/`へダウンロードします。こうすると、バージョンを固定して手元とCIで同じものを使え、普段のVault一覧・Syncのログイン・他のVaultに触れない独立した設定で起動できます。毎回ダウンロードし直さないよう保存しておき、このフォルダはGit管理外で、CIではキャッシュします。

CIの`e2e`ジョブはUbuntuで動き、画面がないため仮想ディスプレイ（Xvfb）とウィンドウマネージャーを起動してから実行します。モバイルは対象外です。デスクトップでのモバイル表示の再現は実際のモバイル版（Capacitor）の代わりにならないため、根拠として使いません。
