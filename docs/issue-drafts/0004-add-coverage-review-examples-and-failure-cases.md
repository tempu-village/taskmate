# P0: Add coverage-review examples and omission failure cases

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Make source-note imports auditable by adding representative coverage-review examples and requiring a candidate manifest that deterministic staging validation can compare with create, merge, and exclude proposals.

## Background

The Skill already says not to silently omit actionable content, but the staging tool previously validated proposals individually. A plan could omit an ambiguous candidate completely and still pass. The tool cannot discover natural-language implications by itself, but it can ensure that every candidate inventoried by the agent remains accounted for through staging.

## Requirements

- Add a coverage-review example reference reached from the import workflow.
- Include a meeting-note example containing explicit actions, a promise, a decision with follow-up, an open question, and non-actionable connective prose.
- Include an ambiguous background-versus-action example and show the safe default.
- Include a merge example for statements serving the same independently completable outcome.
- Include a split example for statements with different dates or independently completable outcomes.
- Require every stage plan to declare `candidates`, each with an eligible `sourceNote` and an exact `statement` copied from one complete non-empty source line, ignoring only leading and trailing whitespace.
- Reject duplicate candidates, candidates not present in their source, proposal coverage not declared as a candidate, candidates covered more than once, and candidates not covered by any proposal.
- Treat create, merge, and exclude proposals equally for coverage accounting.
- Keep existing staged sessions promotable; the new validation applies when staging new plans.
- Add a behavior test in which a plan inventories a possible exclusion but silently omits it from proposals, and verify that staging fails before writing proposal files.

## Acceptance criteria

- The reference examples cover every scenario listed above and preserve the default-to-create rule.
- A complete candidate manifest stages successfully.
- An omitted exclusion candidate produces a non-zero result with an actionable error.
- Invalid coverage produces no proposal session and no canonical task files.
- Existing approval, partial-promotion, archive, and source-change behavior still passes.

## Verification

- Run the Python behavior tests, including complete coverage and each invalid manifest condition.
- Run `python3 scripts/validate_skills.py`.
- Run the repository's TypeScript checks, tests, build, localization validation, and `git diff --check`.

## Out of scope

- Automatic NLP extraction of the candidate manifest.
- Treating headings and connective prose as mandatory candidates.
- Changing canonical task Markdown or proposal-session Markdown schemas.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

> 対応範囲：英語版「Summary」の要約

代表的なCoverage review例を追加し、エージェントが列挙した候補を作成・統合・除外の提案と機械的に照合できる候補一覧を必須化します。

## 背景

> 対応範囲：英語版「Background」の要約

従来は各提案にcoverageがあることだけを検証していたため、曖昧な候補を計画から完全に省略しても検出できませんでした。自然言語から候補を見つける判断はエージェントが行いますが、列挙後に候補が消えることはステージ処理で防止します。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- import workflowから参照するCoverage review例を追加する。
- 会議メモ例に明示的行動、約束、後続作業を伴う決定、未解決の質問、行動を伴わない接続文を含める。
- 背景情報と行動が曖昧な例、および安全な既定動作を示す。
- 同じ独立完了可能な成果に属する文の統合例を示す。
- 日付または独立完了可能な成果が異なる文の分割例を示す。
- 新規stage計画に、対象`sourceNote`と、前後の空白だけを無視して原文の空でない1行全体から正確に写した`statement`を持つ`candidates`を必須化する。
- 重複候補、原文に存在しない候補、未宣言coverage、複数回coverage、未coverage候補を拒否する。
- create、merge、excludeを同じcoverageとして数える。
- 既存のステージ済みセッションはpromote可能なままにする。
- 除外候補を列挙しながら提案から黙って省いた計画が、ファイル作成前に失敗する動作テストを追加する。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- 例が指定シナリオをすべて扱い、迷った場合は作成する規則を維持する。
- 完全な候補一覧は正常にstageできる。
- 省略された除外候補は、対処可能なエラーと非ゼロ終了になる。
- 無効なcoverageでは提案セッションも正式タスクも作られない。
- 既存の承認、部分promote、Archive、source変更検出が引き続き成功する。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 完全coverageと無効な候補一覧条件を含むPython動作テストを実行する。
- `python3 scripts/validate_skills.py`を実行する。
- TypeScript検査、テスト、build、翻訳検証、`git diff --check`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- 候補一覧を自動生成するNLP処理。
- 見出しや接続文を必須候補として扱うこと。
- 正式Task MarkdownまたはProposal session Markdownのスキーマ変更。

</details>
