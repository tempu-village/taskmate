# Release TaskMate

> English is the canonical source for this document.

TaskMate releases are built by GitHub Actions from an exact `x.y.z` tag. The tag, `manifest.json`, `package.json`, `package-lock.json`, and current `versions.json` entry must agree before a release can be created.

## Prepare the version

Start from the commit that should become the release, then update all version metadata with one command:

```bash
npm run version:bump -- 0.6.1
```

Replace `0.6.1` with the intended version. Review the changes to `manifest.json`, `package.json`, `package-lock.json`, and `versions.json`. The script records the current `minAppVersion` for the new plugin version.

## Verify the release candidate

Run the same checks used by CI and the release workflow:

```bash
npm run typecheck
npm test
npm run build
python3 -m unittest discover -s skills/taskmate/tests -v
python3 scripts/validate_skills.py
npm run validate:localization
npm run validate:release
git diff --check
```

The release validator requires `README.md`, `LICENSE`, `main.js`, `manifest.json`, `styles.css`, and `versions.json`; checks synchronized versions and Community directory-compatible manifest fields; and rejects empty release assets.

## Commit and tag

Commit the reviewed version change and merge it into the branch from which the release should be published. Create a tag with no `v` prefix because Obsidian requires the release tag to exactly match the manifest version:

```bash
git tag 0.6.1
git push origin 0.6.1
```

Pushing the tag starts `.github/workflows/release.yml`. The workflow repeats all verification, rebuilds `main.js`, confirms the tag, and creates a GitHub Release with these individual assets:

- `main.js`
- `manifest.json`
- `styles.css`

The workflow builds `main.js` instead of trusting a previously generated file. TaskMate currently keeps the generated file in source history for local distribution and review, but the release asset always comes from the tagged workflow build.

## Inspect the GitHub Release

After the workflow succeeds:

1. Confirm the Release tag and displayed version match `manifest.json` exactly.
2. Confirm `main.js`, `manifest.json`, and `styles.css` are separate downloadable assets.
3. Download the three assets into an empty `.obsidian/plugins/taskmate/` folder in a test vault.
4. Enable TaskMate and verify opening the view, adding a task, editing it, completing it, and deleting it.
5. Confirm the installed TaskMate version in Obsidian matches the Release.

Do not submit to the Obsidian Community directory merely because the workflow succeeds. Community submission remains a separate publication decision after the public-release checks are complete.

## Recover from a failed release

Do not replace assets on an existing published version. Fix the cause, increment the patch version, rerun verification, and publish a new tag. If a tag was pushed but no Release was created, inspect the failed workflow before deciding whether the unused tag can be safely removed or whether a new version is required.

---

# TaskMateをリリースする

<!-- translation-status: ai-translated -->

> [!NOTE]
> この日本語版は英語版を原本としてAIで翻訳されています。人間による全文確認は完了していません。

TaskMateのReleaseは、正確な`x.y.z`タグからGitHub Actionsでビルドします。Releaseを作成する前に、タグ、`manifest.json`、`package.json`、`package-lock.json`、現在の`versions.json`の項目が一致している必要があります。

## バージョンを準備する

Releaseにするコミットを起点として、1つのコマンドですべてのバージョン情報を更新します。

```bash
npm run version:bump -- 0.6.1
```

`0.6.1`を予定しているバージョンへ置き換えます。`manifest.json`、`package.json`、`package-lock.json`、`versions.json`の変更を確認してください。このスクリプトは、新しいプラグインバージョンに現在の`minAppVersion`を記録します。

## Release候補を検証する

CIとReleaseワークフローで使うものと同じ検査を実行します。

```bash
npm run typecheck
npm test
npm run build
python3 -m unittest discover -s skills/taskmate/tests -v
python3 scripts/validate_skills.py
npm run validate:localization
npm run validate:release
git diff --check
```

Release検証は、`README.md`、`LICENSE`、`main.js`、`manifest.json`、`styles.css`、`versions.json`を必須とし、バージョンの同期、Community directoryと互換性のあるmanifest項目を検査し、空のRelease成果物を拒否します。

## コミットしてタグを作る

確認済みのバージョン変更をコミットし、Releaseを公開するブランチへマージします。ObsidianではReleaseタグがmanifestのバージョンと完全に一致する必要があるため、`v`接頭辞なしでタグを作成します。

```bash
git tag 0.6.1
git push origin 0.6.1
```

タグをpushすると`.github/workflows/release.yml`が開始します。ワークフローはすべての検証を繰り返し、`main.js`を再ビルドし、タグを確認して、次のファイルを個別の成果物としてGitHub Releaseを作成します。

- `main.js`
- `manifest.json`
- `styles.css`

ワークフローは、以前生成されたファイルを信用せずに`main.js`をビルドします。TaskMateは現在、ローカル配布と確認のため生成済みファイルをソース履歴に保持していますが、Release成果物には必ずタグからワークフローでビルドしたものを使います。

## GitHub Releaseを確認する

ワークフローの成功後、次を確認します。

1. Releaseタグと表示バージョンが`manifest.json`と完全に一致する。
2. `main.js`、`manifest.json`、`styles.css`を個別にダウンロードできる。
3. 3ファイルをテスト用Vaultの空の`.obsidian/plugins/taskmate/`フォルダへダウンロードする。
4. TaskMateを有効にし、画面を開く、タスクを追加する、編集する、完了する、削除する操作を確認する。
5. Obsidianに表示されるTaskMateのバージョンがReleaseと一致することを確認する。

ワークフローが成功したという理由だけで、Obsidian Community directoryへ申請しないでください。Community申請は、公開Releaseの検査が完了した後に別途判断します。

## 失敗したReleaseから復旧する

公開済みの同じバージョンの成果物を差し替えないでください。原因を修正し、パッチバージョンを増やし、検証を再実行して新しいタグを公開します。タグをpushしたもののReleaseが作成されなかった場合は、未使用タグを安全に削除できるか、新しいバージョンが必要かを判断する前に、失敗したワークフローを確認します。
