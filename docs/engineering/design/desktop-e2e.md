# Desktop E2E tests

Status: Current. These tests drive the real Obsidian desktop app with the built plugin. They are evidence for the exercised desktop cases only.

## What runs

`npm run test:e2e` runs WebdriverIO specs in `test/e2e/specs/*.e2e.ts` through [`wdio-obsidian-service`](https://github.com/jesse-r-s-hines/wdio-obsidian-service), configured in [wdio.conf.mts](../../../wdio.conf.mts). Each run:

1. Resolves the Obsidian version from `OBSIDIAN_VERSIONS` (default `latest/latest`, meaning app/installer).
2. Downloads that Obsidian build into `.obsidian-cache/` if it is not already there.
3. Installs this checkout's `main.js`, `manifest.json` and `styles.css` as a plugin.
4. Opens a sandboxed copy of [the test Vault](../../../test/e2e/vaults/basic) and runs the specs.

The first spec opens the TaskMate list, clicks the All tab by position (so it does not depend on UI language), and checks that the Vault's sample Task is shown.

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
- Specs are typechecked by `npm run typecheck` through [test/e2e/tsconfig.json](../../../test/e2e/tsconfig.json).

## Not covered

- **Mobile:** not tested. Desktop mobile emulation does not reproduce the real mobile app, which runs on Capacitor rather than Electron, so it is not used as evidence. Mobile remains a manual check in [Testing](testing.md).
- Windows and macOS are not in CI; macOS has been run locally.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

`npm run test:e2e`は、ビルド済みプラグインを入れた本物のObsidianデスクトップ版をWebdriverIOで操作します。最初のテストは一覧を開き、「すべて」タブを位置で選んでクリックし、テスト用Vaultのタスクが表示されることを確かめます。実行前に`npm run build`が必要です。

インストール済みのObsidianは使わず、テスト用のObsidianを`.obsidian-cache/`へダウンロードします。こうすると、バージョンを固定して手元とCIで同じものを使え、普段のVault一覧・Syncのログイン・他のVaultに触れない独立した設定で起動できます。毎回ダウンロードし直さないよう保存しておき、このフォルダはGit管理外で、CIではキャッシュします。

CIの`e2e`ジョブはUbuntuで動き、画面がないため仮想ディスプレイ（Xvfb）とウィンドウマネージャーを起動してから実行します。モバイルは対象外です。デスクトップでのモバイル表示の再現は実際のモバイル版（Capacitor）の代わりにならないため、根拠として使いません。
