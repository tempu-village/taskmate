# Verification and known gaps

Status: Current verification map. Test success is evidence for the exercised cases, not approval of product intent or proof of all platform behavior.

## Required checks

From the repository root after installing dependencies with `npm ci`:

```bash
npm run typecheck
npm test
npm run build
python3 -m unittest discover -s skills/taskpilot/tests -v
python3 scripts/validate_skills.py
npm run validate:localization
python3 scripts/validate_docs.py
npm run validate:release
git diff --check
```

[package.json](../../../package.json) owns scripts and dependencies; [CI](../../../.github/workflows/ci.yml) selects Node 22 and Python 3.11. These are CI choices, not a newly declared minimum runtime policy. Builds produce `main.js`; never edit it manually. For manual installation into a disposable Vault, follow [README](../../../README.md#install-from-a-local-build); install Task Pilot separately as described there. UI automation is optional evidence, not a plugin dependency.

## Acceptance map

| Contract | Automated evidence | Additional manual evidence |
| --- | --- | --- |
| [EDIT-01/02/03](../features/task-editing.md) | title, renderer, bulk action, scroll tests | Create/cancel/delete and long-title editing on desktop/Android |
| [STEP-01/02](../features/task-steps.md) | domain round trip and task-steps tests | Nested Step editor save/cancel and touch reorder |
| [PROJECT-01/02](../features/projects.md) | domain Project format tests only | Rename/delete Project and check Task membership |
| [LABEL-01/02/03](../features/labels.md) | picker, chip input, label management/summary tests | Japanese IME and mobile picker cancellation |
| [LIST-01/02/03](../features/filtering-and-sorting.md) | domain, filter-state and list-model tests | Navigation retains filters; changing sort retains global rank |
| [MOBILE-01/02](../features/mobile-layout.md) | static layout and keyboard calculation tests | Real keyboard and touch checks; DOM tests do not emulate WebView |
| [I18N-01/02](../features/localization.md) | dictionary/fallback tests | Command/ribbon reload and narrow translated controls |
| [CONFLICT-01/02/03/04](../features/edit-conflicts.md) | merge and repository tests, including Step value equality | Two-device synchronization |
| [IMPORT-01/02/03/04](../features/source-import.md) | Python proposal/store tests | Actual agent's coverage inventory versus all source statements |
| [STORE-01/02](../features/storage-and-privacy.md) | settings/repository inspection | Uninstall retention and folder-setting change |

Use stable acceptance IDs in specs and link meaningful tests here or in the spec. An evidence link does not imply every condition is automated. Keep untested expectations visible. Source-index and Vault-setup acceptance scenarios are targets, not passing current tests.

## Known gaps

- **Source read scope:** current discovery reads unrelated non-managed Markdown while checking opt-in. [Source index](../features/source-note-index.md) proposes the tighter read boundary; it is not shipped.
- **Device verification:** this documentation change inspects source and runs automated checks, but does not execute fresh desktop/Android UI sessions. Existing repository documentation records Android experience; iOS remains unverified.
- **Crash recovery:** multi-file proposal promotion has no atomic transaction. Retry after an unrecorded Task creation needs reconciliation; no crash-exactly-once guarantee is claimed.

## Reconciliation record

During the documentation split, the generic claim that lists show the complete title was corrected using [ADR 0023](../adr/0023-bound-task-list-titles-by-character-count.md), renderer code and renderer tests: lists show the 100-grapheme prefix; the editor shows the complete title. Search documentation now includes Step text, matching the domain implementation and test. Date views are incomplete-only by default, with explicit include-completed support. These corrections change documentation, not product behavior.

## Manual scenario

In a disposable Vault, follow [getting started](../../user/getting-started.md), then [source import](../../user/how-to/import-source-notes.md). Include two notes with independent actions and one informational statement. Verify zero Tasks after staging, one Task after partial approval, retained pending proposals, explicit exclusion, final archival, provenance and repeat-run counts. Keep sanitized results with the PR and distinguish observed behavior from expected behavior.

## Related RFCs

- [Document the reproducible development environment](../rfcs/document-reproducible-development-environment.md) — proposed; the current verification guide is authoritative only for the checks it already documents.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

テスト成功は実行したケースの根拠であり、製品判断の承認や全端末の保証ではありません。上のコマンドで型、TypeScript、Python、build、Skill、翻訳、文書、releaseを検証します。依存はpackage.json、CI環境はNode 22/Python 3.11を参照し、最小対応版と混同しません。使い捨てVaultへの導入はREADMEへリンクし、UI自動操作は任意です。

受け入れIDとテスト・手動確認の対応は表を正本にします。Project削除、実キーボード、同期など、自動テストだけでは確認できない範囲を明記します。

既知の不足：Source探索の対象外読み取り、複数ファイル反映のクラッシュ復旧、今回未実施の実機確認を区別します。iOSは未検証です。CONFLICT-04は、Stepを追加して保存した後の未変更再保存を対象とするrepository回帰テストで確認します。

今回の文書整合では、ADR 0023と実装・テストに従い一覧の100書記素上限を統一し、検索のStep本文対象、完了済み表示の選択を補いました。コードの挙動は変更していません。

使い捨てVaultで初回体験後、複数メモからステージ・部分承認・保留・除外・全件判断・再実行を確認し、期待値と実測をPRに残します。
