---
status: draft
tracking-issue: 107
current-authority: ../design/desktop-e2e.md
related-features: []
---

# RFC: Capture TaskMate screens and extend E2E in the existing Obsidian harness

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

[Desktop E2E tests](../design/desktop-e2e.md) already drive a downloaded, sandboxed Obsidian with `wdio-obsidian-service` (`npm run test:e2e`, one spec, one test vault, an `e2e` CI job). This RFC builds on that harness. It adds an on-demand command that opens a named TaskMate screen with prepared data and saves a screenshot, fixture vaults for the review screens, and E2E specs for the release smoke test and the Import review flow. It does not replace or reconfigure the existing harness, and it keeps the existing decision that desktop mobile emulation is not evidence for mobile behavior.

## Background / Problem

The existing E2E suite proves that the built plugin loads in real Obsidian and shows a Task. It does not yet help with the checks that cost the most during the 0.7.0 cycle:

- The maintainer took every screenshot of the Task list, Import review, and Task change review by hand and sent them to the agent to check card order, Japanese labels, and statement toggles. The agent cannot open a screen itself.
- Related screens drift apart. The Task change review has bulk "select all" controls and the Import review has none; comparing the two requires manual screenshots in the same state.
- The release smoke test (open the view, add, edit, complete, and delete a Task) and the Import review checks were repeated by hand.
- APIs newer than `minAppVersion` (`getLanguage`, `Workspace.revealLeaf`, flagged by the Community directory lint) were found only by lint, not by running the declared minimum version.

The only test vault, `test/e2e/vaults/basic`, contains one Task, so no review screen can be opened today.

## Use cases

1. **Inspect a screen on demand.** A contributor or agent runs one command to open a named TaskMate screen (Task list, Task editor, bulk edit, Open reviews, Import review, Task change review, apply confirmation, settings) with fixture data and saves a screenshot. Example: check that an Import review card shows the Task, the decisions, and then the sources, in Japanese.
2. **Compare similar screens.** Capture the Import review and the Task change review in the same state, in light and dark themes, and place the screenshots side by side to align toolbars, bulk actions, buttons, and wording.
3. **Release smoke test.** Run the smoke steps from [Releasing](../../operations/releasing.md) as a spec against the production build.
4. **Compatibility with `minAppVersion`.** Run the smoke spec with `OBSIDIAN_VERSIONS` set to the `minAppVersion` from `manifest.json` and to `latest`.
5. **Regression check for the Import review.** Open a staged Import review fixture, decide some candidates, apply them, and check the created Tasks, Source-note provenance, and the move to History.

## Goals

- One command that opens a registered screen with fixture data in the existing sandboxed Obsidian and saves a screenshot to a Git-ignored folder.
- Committed, non-personal fixture vaults that contain review data.
- Smoke and Import review specs that run in the existing `npm run test:e2e` and CI job.
- No change to how Obsidian is downloaded, cached, sandboxed, or pinned.

## Non-goals

- Replacing the harness, its dependencies, or its CI job.
- Using desktop mobile emulation as evidence for mobile behavior, including the Android apply-button overlap. Mobile stays a manual check, as stated in [Desktop E2E tests](../design/desktop-e2e.md).
- Android emulators, iOS, or replacing the real-device check before a release.
- Pixel-perfect visual regression with stored baseline images.
- Testing Task Pilot's language understanding; fixtures are produced deterministically by the existing Python helpers.
- Driving the user's own Obsidian application or using personal vaults.

## Proposed design

### What already exists (unchanged)

| Item | Current value |
| --- | --- |
| Tool | `wdio-obsidian-service` 3.5 with WebdriverIO 9 and Mocha, `wdio-obsidian-reporter`; all development dependencies, MIT |
| Config | [wdio.conf.mts](../../../wdio.conf.mts), specs `test/e2e/specs/**/*.e2e.ts`, vault `test/e2e/vaults/basic` |
| Obsidian | Downloaded into `.obsidian-cache/` (Git-ignored), version from `OBSIDIAN_VERSIONS` (default `latest/latest`), no beta or Insider account |
| CI | `e2e` job on Ubuntu with Xvfb and herbstluftwm |
| Type checks | `npm run typecheck` includes `test/e2e/tsconfig.json` |

### Additions

- **Screen capture command.** `npm run e2e:screens -- [<screen>...] [--theme dark] [--lang ja]` runs a dedicated spec, `test/e2e/screens/capture.e2e.ts`, that is excluded from `npm run test:e2e`. Without a screen name it captures a standard comparison set. Options are passed through environment variables because WebdriverIO does not forward arbitrary arguments to specs.
- **Screen registry.** `test/e2e/screens.ts` maps each screen name to its fixture vault and the steps that open it, using `browser.executeObsidianCommand("taskmate:<command-id>")` and stable selectors, as [Writing specs](../design/desktop-e2e.md#writing-specs) requires.
- **Output.** Screenshots go to `test-results/e2e/screens/` (Git-ignored). Each file name includes the screen, theme, language, and Obsidian version. Nothing is uploaded; CI does not run the capture command.
- **Fixture vaults.** New vaults under `test/e2e/vaults/` (for example `reviews`) with invented English and Japanese data: Tasks with Steps, Projects, Labels, source notes, an Import review JSON, and a Task change Proposal JSON. Review JSON is generated with `import_review.py` and `rolling_plan.py` and committed. TaskMate's `data.json` sets the language explicitly.
- **Specs.** `smoke.e2e.ts` and `import-review.e2e.ts` in `test/e2e/specs/`, run by the existing command and CI job. Each spec selects its vault through the service's per-spec vault switching, so `basic` stays as it is.
- **Documentation.** Extend [Desktop E2E tests](../design/desktop-e2e.md) with the capture command, the fixture vaults, and the output folder.

### Safety and privacy (points to watch)

1. **No new external hosts.** The capture command reuses the cached Obsidian and the hosts the harness already contacts. No Obsidian account or credentials are used, and no TaskMate data leaves the machine.
2. **Only repository test vaults.** The registry accepts only folders under `test/e2e/vaults/`. Personal vaults, including the maintainer's sandbox vaults, are never used as fixtures or opened by the command.
3. **Screenshots stay local.** They are written only to the Git-ignored output folder and are not attached to CI artifacts unless a later decision says so.
4. **Agent use.** An agent may run the command and read the screenshots. The command launches only the sandboxed Obsidian and grants no control of other applications.
5. **Mobile limits.** A phone-width capture, if added, is labeled as a layout aid only and is not recorded as mobile evidence.

### Acceptance conditions

- `npm run e2e:screens` opens each registered screen with fixture data and saves light and dark screenshots.
- The smoke spec and the Import review spec (partial apply, hold, second apply, provenance, History) pass in `npm run test:e2e` locally and in the `e2e` CI job.
- The smoke spec passes with `OBSIDIAN_VERSIONS` set to `minAppVersion` and to `latest`, or the failures are recorded as Issues.
- `npm test`, `npm run typecheck`, and `npm run build` behave as before and do not download Obsidian.
- [Desktop E2E tests](../design/desktop-e2e.md) describes the command, fixtures, and output folder.

## Open questions

- Should a phone-width capture with `emulateMobile` be offered as a labeled layout aid, given that [Desktop E2E tests](../design/desktop-e2e.md) excludes mobile emulation as evidence?
- Which screens belong in the standard comparison set, and should side-by-side images be generated automatically?
- How to reach screens that need prior state (for example, the apply confirmation after decisions) reliably: through UI steps only, or through test-only setup that is excluded from the production build.
- Should the `minAppVersion` run be part of the CI job or only a pre-release step?

## Decision / status

Draft. Proposed by the maintainer on 2026-11-03 after the 0.7.0 release checks. Rewritten the same day to build on the harness added in [#104](https://github.com/tempu-village/taskmate/pull/104) instead of proposing a new one.

## Links

- Tracking Issue: [#107](https://github.com/tempu-village/taskmate/issues/107)
- Current feature: none (engineering tooling)
- Current design: [Desktop E2E tests](../design/desktop-e2e.md), [Testing design](../design/testing.md)
- Related RFC: [Document the reproducible development environment](document-reproducible-development-environment.md)
- Operations: [Releasing](../../operations/releasing.md)
- Tool: [wdio-obsidian-service](https://github.com/jesse-r-s-hines/wdio-obsidian-service)

## 日本語参考

<!-- translation-status: ai-translated -->

> この日本語版は英語版を原本としてAIで翻訳されています。人間による全文確認は完了していません。英語版が正本です。

### 概要

[デスクトップE2Eテスト](../design/desktop-e2e.md)では、すでに`wdio-obsidian-service`でダウンロードした隔離済みのObsidianを動かしている（`npm run test:e2e`、テスト1つ、テスト用Vault1つ、CIの`e2e`ジョブ）。このRFCはその仕組みの上に、指定したTaskMateの画面を準備したデータで開いてスクリーンショットを保存するコマンド、レビュー画面用のテスト用Vault、リリース前の動作確認と取り込みレビューのE2Eテストを足す。今の仕組みは置き換えも設定変更もしない。デスクトップでのモバイル表示はモバイルの根拠にしない、という今の判断も変えない。

### 背景・問題

今のE2Eは、ビルドしたプラグインが本物のObsidianで読み込まれ、Taskが表示されることを確かめるだけである。0.7.0で手間がかかった次の確認には、まだ役立っていない。

- Task一覧、取り込みレビュー、Task変更レビューのスクリーンショットを毎回メンテナーが手で撮り、エージェントに送って確認した。エージェントは自分で画面を開けない。
- 似た画面の差が広がる。Task変更レビューには一括選択があり、取り込みレビューにはない。同じ状態で並べて比べるには手作業のスクリーンショットが要る。
- リリース前の動作確認と取り込みレビューの確認を手作業で繰り返した。
- `minAppVersion`より新しいAPI（`getLanguage`、`Workspace.revealLeaf`）は、lintでしか見つからず、宣言した最低版で実際に動かして見つけたものではない。

テスト用Vaultは`test/e2e/vaults/basic`だけで、Taskが1件しかないため、今はレビュー画面を開けない。

### ユースケース

1. 1つのコマンドで、指定した画面（Task一覧、Task編集、一括編集、Open reviews、取り込みレビュー、Task変更レビュー、反映の確認画面、設定）を準備したデータで開き、スクリーンショットを保存する。
2. 取り込みレビューとTask変更レビューを同じ状態、ライトとダークで撮って並べ、ツールバー、一括操作、ボタン、文言をそろえる。
3. [リリース](../../operations/releasing.md)の動作確認の手順を、本番ビルドに対するテストとして動かす。
4. `OBSIDIAN_VERSIONS`を`manifest.json`の`minAppVersion`と`latest`にして、同じ確認を動かす。
5. 取り込みレビューのデータを開き、一部を判断して適用し、作られたTask、ノートのプロパティ、Historyへの移動を確かめる。

### 目的

- 今の隔離済みのObsidianで、登録した画面を準備したデータで開き、Gitで無視するフォルダへスクリーンショットを保存するコマンドを用意する。
- レビューのデータを含む、個人情報のないテスト用Vaultをコミットする。
- 動作確認と取り込みレビューのテストを、今の`npm run test:e2e`とCIのジョブで動かす。
- Obsidianのダウンロード、キャッシュ、隔離、版の固定の仕方は変えない。

### 非目標

- 今の仕組み、その依存、CIのジョブの置き換え。
- デスクトップのモバイル表示を、モバイルの動作の根拠にすること（Androidで反映ボタンが重なる問題を含む）。モバイルは[デスクトップE2Eテスト](../design/desktop-e2e.md)のとおり手作業の確認のまま。
- Androidエミュレータ、iOS、リリース前の実機確認の置き換え。
- 基準画像と比べる画素単位の回帰テスト。
- Task Pilotの言語理解のテスト（データは既存のPythonヘルパーで決まった形に作る）。
- 利用者のObsidianの操作や、個人のVaultの利用。

### 提案設計

**今あるもの（変えない）**

| 項目 | 今の値 |
| --- | --- |
| ツール | `wdio-obsidian-service` 3.5、WebdriverIO 9とMocha、`wdio-obsidian-reporter`。すべて開発用の依存でMIT |
| 設定 | [wdio.conf.mts](../../../wdio.conf.mts)、テストは`test/e2e/specs/**/*.e2e.ts`、Vaultは`test/e2e/vaults/basic` |
| Obsidian | `.obsidian-cache/`（Gitで無視）へダウンロード。版は`OBSIDIAN_VERSIONS`（既定は`latest/latest`）。ベータ版やInsiderのアカウントは使わない |
| CI | Ubuntuの`e2e`ジョブ（Xvfbとherbstluftwm） |
| 型チェック | `npm run typecheck`が`test/e2e/tsconfig.json`も確かめる |

**足すもの**

- **画面を撮るコマンド**：`npm run e2e:screens -- [<画面名>...] [--theme dark] [--lang ja]`。専用のテスト`test/e2e/screens/capture.e2e.ts`を動かし、`npm run test:e2e`には含めない。画面名がなければ比較用の標準セットを撮る。WebdriverIOはテストへ任意の引数を渡さないため、オプションは環境変数で渡す。
- **画面の一覧**：`test/e2e/screens.ts`に、画面名と、使うテスト用Vault、開く手順を対応させる。手順は`browser.executeObsidianCommand("taskmate:<command-id>")`と変わりにくいセレクタを使い、[テストの書き方](../design/desktop-e2e.md#writing-specs)に従う。
- **保存先**：`test-results/e2e/screens/`（Gitで無視）。ファイル名に画面、テーマ、言語、Obsidianの版を含める。アップロードはせず、CIではこのコマンドを動かさない。
- **テスト用Vault**：`test/e2e/vaults/`の下に新しいVault（例：`reviews`）を作り、英語と日本語の架空のデータを入れる（Steps付きのTask、Project、ラベル、元のノート、取り込みレビューのJSON、Task変更ProposalのJSON）。レビューのJSONは`import_review.py`と`rolling_plan.py`で作ってコミットする。TaskMateの`data.json`で言語を明示する。
- **テスト**：`test/e2e/specs/`に`smoke.e2e.ts`と`import-review.e2e.ts`を足し、今のコマンドとCIのジョブで動かす。各テストはサービスのテストごとのVault切り替えで自分のVaultを選び、`basic`はそのままにする。
- **文書**：[デスクトップE2Eテスト](../design/desktop-e2e.md)に、コマンド、テスト用Vault、保存先を書き足す。

**安全とプライバシー（気をつけること）**

1. **新しい接続先はない**：画面を撮るコマンドは、キャッシュ済みのObsidianと、今の仕組みが使う接続先だけを使う。Obsidianのアカウントや認証情報は使わず、TaskMateのデータはマシンの外に出ない。
2. **リポジトリのテスト用Vaultだけ**：画面の一覧は`test/e2e/vaults/`の下のフォルダだけを受け付ける。メンテナーのサンドボックスVaultを含め、個人のVaultはテスト用データに使わず、コマンドでも開かない。
3. **スクリーンショットは手元だけ**：Gitで無視する保存先にだけ書き、後で決めない限りCIの成果物にも添付しない。
4. **エージェントの利用**：エージェントはコマンドを実行してスクリーンショットを読める。コマンドは隔離したObsidianを起動するだけで、他のアプリの操作権限は与えない。
5. **モバイルの限界**：スマホ幅の撮影を足す場合も、見た目の参考と明記し、モバイルの根拠として記録しない。

**受け入れ条件**

- `npm run e2e:screens`で、登録した各画面を準備したデータで開き、ライトとダークのスクリーンショットを保存できる。
- 動作確認と取り込みレビュー（一部の適用、保留、2回目の適用、ノートのプロパティ、History）のテストが、手元の`npm run test:e2e`とCIの`e2e`ジョブで通る。
- 動作確認のテストが、`OBSIDIAN_VERSIONS`を`minAppVersion`と`latest`にして通る。通らなければその失敗をIssueに記録する。
- `npm test`、`npm run typecheck`、`npm run build`は今までどおりで、Obsidianをダウンロードしない。
- [デスクトップE2Eテスト](../design/desktop-e2e.md)に、コマンド、テスト用Vault、保存先が書かれている。

### 未解決の点

- [デスクトップE2Eテスト](../design/desktop-e2e.md)ではモバイル表示を根拠にしないが、`emulateMobile`でのスマホ幅の撮影を、見た目の参考として用意するか。
- 比較用の標準セットにどの画面を入れるか。並べた画像を自動で作るか。
- 前の状態が必要な画面（判断した後の反映の確認画面など）を安定して開く方法。UIの操作だけで開くか、本番ビルドに含まれないテスト専用の準備を使うか。
- `minAppVersion`での実行を、CIのジョブに入れるか、リリース前の手順だけにするか。

### 判断・状態

下書き。0.7.0のリリース確認の後、2026-11-03にメンテナーが提案。同日、新しい仕組みを提案する形から、[#104](https://github.com/tempu-village/taskmate/pull/104)で入った仕組みの上に足す形へ書き直した。

### リンク

- 追跡Issue：[#107](https://github.com/tempu-village/taskmate/issues/107)
- 現在のFeature：なし（開発用の道具）
- 現在の設計：[デスクトップE2Eテスト](../design/desktop-e2e.md)、[テスト設計](../design/testing.md)
- 関連RFC：[再現可能な開発環境の文書化](document-reproducible-development-environment.md)
- 運用：[リリース](../../operations/releasing.md)
- ツール：[wdio-obsidian-service](https://github.com/jesse-r-s-hines/wdio-obsidian-service)
