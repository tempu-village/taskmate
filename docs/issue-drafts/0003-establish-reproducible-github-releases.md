# P1: Establish a reproducible GitHub Release pipeline

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Create a reproducible release process that validates TaskMate, synchronizes version metadata, builds the plugin from a version tag, and attaches the exact files required by Obsidian to a GitHub Release. This prepares the repository for a public beta without publishing a release or submitting to the Obsidian Community directory as part of this Issue.

## Background

Obsidian installs a community plugin from `main.js`, `manifest.json`, and optional `styles.css` attached to the GitHub Release whose tag exactly matches the manifest version. TaskMate already has CI and local deployment, but it does not yet reject version drift or create release assets from a tagged, verified build. Manual assembly could mix versions or upload a stale generated file.

The release workflow must rebuild `main.js` from the tagged source and validate the result rather than trusting a local artifact. The generated `main.js` remains tracked for the current local-development workflow, but the GitHub Release must use the workflow build.

## Requirements

- Add one command that updates `manifest.json`, `package.json`, `package-lock.json`, and the current `versions.json` mapping to the same `x.y.z` version.
- Add a deterministic release validator that:
  - requires non-empty `README.md`, `LICENSE`, `main.js`, `manifest.json`, `styles.css`, and `versions.json`;
  - requires exact version agreement across `manifest.json`, `package.json`, `package-lock.json`, and the current `versions.json` mapping;
  - validates the release tag, when supplied, as an exact match for the manifest version without a `v` prefix;
  - checks the manifest fields needed by the current Obsidian Community directory requirements.
- Run localization and release validation in the existing CI workflow.
- Add a tag-triggered GitHub Actions workflow that runs all required TypeScript, JavaScript, Python Skill, localization, build, and release checks before publishing.
- Build `main.js` in the tagged workflow and attach `main.js`, `manifest.json`, and `styles.css` as separate GitHub Release assets.
- Document version preparation, verification, exact tag creation, release inspection, clean-vault installation, and failed-release recovery.
- Document manual installation and update from one internally consistent GitHub Release in both README languages.
- Keep English canonical and update the AI-translated Japanese documentation in the same change.

## Acceptance criteria

- `npm run version:bump -- <x.y.z>` synchronizes all maintained version metadata.
- `npm run validate:release` succeeds for the current repository state and fails for mismatched metadata, missing or empty required files, invalid manifest release fields, or a mismatched supplied tag.
- CI runs type checking, tests, production build, Python behavior tests, Skill validation, localization validation, and release validation.
- Pushing an exact `x.y.z` tag runs the release workflow; the workflow stops before Release creation if any validation fails.
- A successful tag workflow creates a GitHub Release containing separate `main.js`, `manifest.json`, and `styles.css` assets built from that tag.
- English and Japanese installation instructions warn against mixing assets from different versions.
- Maintainer documentation explains how to install the three downloaded assets into a clean test vault and verify the installed version.
- No release, repository visibility change, or Community directory submission occurs while implementing this Issue.

## Verification

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.
- Run `python3 -m unittest discover -s skills/taskmate/tests -v`.
- Run `python3 scripts/validate_skills.py`.
- Run `npm run validate:localization`.
- Run `npm run validate:release`.
- Run `npm run validate:release -- --tag 0.6.0` and confirm the current exact version is accepted.
- Run the validator against controlled mismatched-tag and mismatched-metadata cases without leaving repository changes.
- Run `git diff --check`.
- After a future authorized release, install only the three Release assets into a clean vault and complete the documented smoke test.

## Out of scope

- Creating or publishing a GitHub Release during implementation.
- Creating or pushing a version tag during implementation.
- Changing repository visibility.
- Submitting to or publishing in the Obsidian Community directory.
- Changing the Task Markdown schema, Task ID, Project ID, or manual rank behavior.
- Removing generated `main.js` from source history.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

TaskMateを検証し、バージョン情報を同期し、バージョンタグからプラグインをビルドして、Obsidianが必要とするファイルをGitHub Releaseへ添付する再現可能なリリース工程を作ります。このIssueでは公開ベータの準備までを行い、Releaseの公開やObsidian Community directoryへの申請は行いません。

## 背景

> 対応範囲：英語版「Background」の要約

Obsidianは、manifestのバージョンと完全に一致するGitHub Releaseタグから`main.js`、`manifest.json`、任意の`styles.css`を取得します。TaskMateにはCIとローカル配布がありますが、バージョンずれの拒否と、検証済みタグからのRelease作成がありません。タグのソースから`main.js`を再ビルドし、ローカルの古い成果物を誤って配布しない工程にします。現在のローカル開発用として`main.js`の追跡は維持します。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- `manifest.json`、`package.json`、`package-lock.json`、現在の`versions.json`の対応を同じ`x.y.z`へ更新する1つのコマンドを追加する。
- 次を行う決定的なRelease検証を追加する。
  - 空ではない`README.md`、`LICENSE`、`main.js`、`manifest.json`、`styles.css`、`versions.json`を必須にする。
  - `manifest.json`、`package.json`、`package-lock.json`、現在の`versions.json`の対応でバージョンが完全に一致することを必須にする。
  - Releaseタグが渡された場合、`v`接頭辞なしでmanifestのバージョンと完全に一致することを検査する。
  - 現在のObsidian Community directory要件に必要なmanifest項目を検査する。
- 既存CIでローカライズ検証とRelease検証を実行する。
- Release公開前に必要なTypeScript、JavaScript、Python Skill、ローカライズ、ビルド、Releaseの全検査を実行するタグ起動のGitHub Actionsワークフローを追加する。
- タグのワークフローで`main.js`をビルドし、`main.js`、`manifest.json`、`styles.css`を個別のGitHub Release成果物として添付する。
- バージョン準備、検証、正確なタグ作成、Release確認、新規Vaultへの導入、失敗したReleaseからの復旧を文書化する。
- 1つの内部的に整合したGitHub Releaseから手動でインストール・更新する方法をREADMEの両言語へ記載する。
- 英語を原本とし、AI翻訳の日本語文書を同じ変更内で更新する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- `npm run version:bump -- <x.y.z>`ですべての管理対象バージョン情報が同期する。
- `npm run validate:release`が現在のリポジトリで成功し、情報の不一致、必須ファイルの欠落または空ファイル、無効なmanifestのRelease項目、指定タグの不一致で失敗する。
- CIが型チェック、テスト、本番ビルド、Python動作テスト、Skill検証、ローカライズ検証、Release検証を実行する。
- 正確な`x.y.z`タグをpushするとReleaseワークフローが動き、検証が1つでも失敗すればRelease作成前に停止する。
- 成功したタグワークフローが、そのタグからビルドした`main.js`、`manifest.json`、`styles.css`を個別に含むGitHub Releaseを作成する。
- 英語・日本語のインストール手順が、異なるバージョンの成果物を混在させないよう警告する。
- 保守担当者向け文書が、3つの成果物を空のテストVaultへ導入し、インストール済みバージョンを確認する方法を説明する。
- このIssueの実装中は、Release公開、リポジトリ公開範囲の変更、Community directoryへの申請を行わない。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- `npm run typecheck`を実行する。
- `npm test`を実行する。
- `npm run build`を実行する。
- `python3 -m unittest discover -s skills/taskmate/tests -v`を実行する。
- `python3 scripts/validate_skills.py`を実行する。
- `npm run validate:localization`を実行する。
- `npm run validate:release`を実行する。
- `npm run validate:release -- --tag 0.6.0`を実行し、現在の正確なバージョンが受理されることを確認する。
- リポジトリの変更を残さず、制御したタグ不一致・メタデータ不一致に対して検証を実行する。
- `git diff --check`を実行する。
- 将来、許可されたReleaseの後に、3つのRelease成果物だけを空のVaultへ導入し、文書化したスモークテストを完了する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- 実装中にGitHub Releaseを作成または公開すること。
- 実装中にバージョンタグを作成またはpushすること。
- リポジトリの公開範囲を変更すること。
- Obsidian Community directoryへ申請または公開すること。
- Task Markdownスキーマ、Task ID、Project ID、手動rankの動作を変更すること。
- 生成された`main.js`をソース履歴から削除すること。

</details>
