# P2: Document the reproducible development environment

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Create one contributor-facing development-environment guide for TaskMate. It must make the Node.js/JavaScript and Obsidian-plugin workflow reproducible, while distinguishing required repository tooling from optional direct-operation and UI-automation tooling.

## Background

TaskMate's README explains how to build and manually install the plugin, and its scripts already encode the supported checks. However, the complete development setup, the relationship between the Obsidian plugin and the companion Agent Skill, and the appropriate place for direct-operation tooling are not documented as one onboarding path. Contributors should be able to set up, verify, and test the project without relying on a maintainer's local configuration, credentials, or installed personal plugins.

## Requirements

- Add a canonical development-environment document under `docs/` and link to it from the contributor-facing README.
- State the supported runtime and package-manager prerequisites, including the exact version source when the repository pins one. Do not invent a runtime-version policy where the repository has not defined one.
- Document the required local workflow for the JavaScript/TypeScript plugin: dependency installation, `npm run typecheck`, `npm test`, `npm run build`, Python behavior tests, and `python3 scripts/validate_skills.py`.
- Document how to prepare a disposable Obsidian test vault, install the local build into `.obsidian/plugins/taskmate/`, enable the plugin, and perform desktop and Android verification within the public Obsidian and browser API compatibility constraint.
- Document companion Agent Skill development separately from plugin development, including the local `skills/taskmate` link/install workflow and the source-folder allowlist and proposal-review boundaries that apply during testing.
- Define direct-operation and UI-automation tooling as optional verification aids. The document must state their intended use, what evidence they should record, and that they must not become a required runtime dependency or require secrets, private vault contents, or personal local configuration.
- Include a concise tool inventory that distinguishes repository dependencies from host applications and optional tooling. Use repository-managed files such as `package.json`, lockfiles, and scripts as the source of truth for dependency versions and commands.
- Include troubleshooting for the common local-install and reload failures already described in `README.md`, without copying a second, divergent installation procedure.
- Keep the guide English-first and add a Japanese counterpart or a folded Japanese reference translation following the repository's documentation-localization policy.

## Acceptance criteria

- A new contributor can follow the guide from a clean supported machine to a successful local build and enabled TaskMate plugin in a disposable vault.
- The guide identifies every required verification command and explains which checks cover plugin code versus the companion Skill.
- The guide makes the desktop/Android test boundary and the optional status of direct-operation tooling explicit.
- No credentials, tokens, personal paths, private vault contents, or instructions using private Obsidian or Electron APIs appear in the guide.
- Commands, paths, and dependency descriptions agree with the repository's scripts and manifests at the time the documentation is added.
- The README links to the new guide without duplicating its full procedure.

## Verification

- Review the guide against `package.json`, the lockfile, `scripts/`, `skills/taskmate/`, `README.md`, and `AGENTS.md`.
- Execute the documented required checks in a clean local dependency installation.
- Follow the local-build and disposable-vault procedure on desktop Obsidian; perform the documented Android validation when an Android test device is available.
- Verify the English and Japanese document structures, protected literals, and links with the repository's documentation/localization validation workflow.

## Out of scope

- Changing TaskMate runtime behavior, its task Markdown schema, or the public plugin API surface.
- Adding telemetry, a hosted service, credentials, or a mandatory UI-automation framework.
- Publishing a release, submitting to the Obsidian Community directory, or documenting a production deployment runbook.
- Treating a maintainer's personal editor extensions, Codex configuration, or private test vault as a contributor prerequisite.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

TaskMate の開発環境を、Node.js／JavaScript と Obsidian プラグインの再現可能な手順として一つにまとめます。直接操作・UI 自動操作のツールは必須環境ではなく、任意の検証支援として区別します。

## 背景

> 対応範囲：英語版「Background」の要約

README とスクリプトにはビルドや手動導入の情報がありますが、プラグイン、Agent Skill、直接操作ツールの関係を含めた一貫したオンボーディングはありません。個人の設定、認証情報、個人用プラグインに依存せず、開発・検証できるようにします。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- `docs/` に開発環境の正本ドキュメントを追加し、コントリビューター向け README からリンクする。
- 対応するランタイムとパッケージマネージャーの前提条件を、リポジトリが固定している場合はその正確なバージョン情報源とともに記載する。リポジトリで定義していないランタイムのバージョン方針は作らない。
- JavaScript/TypeScript プラグインに必要なローカル手順として、依存関係の導入、`npm run typecheck`、`npm test`、`npm run build`、Python の振る舞いテスト、`python3 scripts/validate_skills.py` を記載する。
- 使い捨ての Obsidian テスト用 Vault の準備、`.obsidian/plugins/taskmate/` へのローカルビルドの導入、プラグインの有効化、公開 Obsidian API とブラウザ API の互換性制約内でのデスクトップ・Android 検証を記載する。
- コンパニオン Agent Skill の開発をプラグイン開発と分けて記載し、ローカルの `skills/taskmate` のリンク／導入手順と、テスト時にも適用されるソースフォルダーの許可リストおよび提案レビューの境界を含める。
- 直接操作・UI 自動操作ツールを任意の検証支援として定義する。意図した用途、記録すべき証拠、必須ランタイム依存にしてはならないこと、秘密情報・非公開 Vault 内容・個人固有のローカル設定を必要としてはならないことを記載する。
- リポジトリ依存関係、ホストアプリ、任意ツールを区別する簡潔なツール一覧を含める。依存関係のバージョンとコマンドは、`package.json`、ロックファイル、スクリプトなどのリポジトリ管理ファイルを正本として扱う。
- `README.md` にある一般的なローカル導入・再読み込み失敗の対処を、二つ目の食い違う導入手順を複製せずに記載する。
- ドキュメントは英語を先にし、リポジトリのドキュメント翻訳方針に従って日本語版または折りたたみ式の日本語参考訳を追加する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 新しいコントリビューターが、対応するクリーンなマシンでガイドに従い、ローカルビルドを成功させ、使い捨て Vault で TaskMate プラグインを有効化できる。
- ガイドが必要な検証コマンドをすべて示し、プラグインコードとコンパニオン Skill のどちらを各検査が対象にするか説明している。
- デスクトップ／Android のテスト境界と、直接操作ツールが任意であることを明確にしている。
- ドキュメントに認証情報、トークン、個人用パス、非公開 Vault 内容、非公開の Obsidian API または Electron API を使う指示が含まれない。
- コマンド、パス、依存関係の説明が、ドキュメント追加時点のリポジトリのスクリプトとマニフェストに一致する。
- README が新しいガイドにリンクし、その手順全体を重複掲載していない。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- `package.json`、ロックファイル、`scripts/`、`skills/taskmate/`、`README.md`、`AGENTS.md` と照合してガイドをレビューする。
- クリーンなローカル依存関係導入環境で、記載された必須検査を実行する。
- デスクトップ Obsidian でローカルビルドと使い捨て Vault の手順に従う。Android のテスト端末が利用できる場合は、記載した Android 検証を実施する。
- リポジトリのドキュメント／ローカライズ検証手順により、英語・日本語のドキュメント構造、保護されたリテラル、リンクを検証する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- TaskMate の実行時の振る舞い、タスク Markdown スキーマ、公開プラグイン API 表面の変更。
- テレメトリー、ホスト型サービス、認証情報、必須の UI 自動操作フレームワークの追加。
- Release の公開、Obsidian Community directory への申請、プロダクションデプロイの手順書作成。
- メンテナー個人のエディター拡張、Codex 設定、非公開テスト Vault をコントリビューターの前提条件として扱うこと。

</details>
