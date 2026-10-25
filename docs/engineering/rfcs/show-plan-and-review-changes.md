---
status: implemented
tracking-issue: 82
current-authority: [../features/task-pilot-planning.md, ../features/task-change-review/README.md, ../specifications/task-change-proposal-format.md]
related-features: []
---

# RFC: Show what plans and reviews change, in the user's language

> English is canonical. The Japanese section is an AI-generated reference translation.

## Summary

Rolling plans and the Task change reviews generated from them now say which Tasks change and how, in English or Japanese according to TaskMate's language setting. Task Pilot writes a short report-style summary of each working plan and one line per Task in the generated Proposal; TaskMate shows both above the changes. This RFC keeps the alternatives compared in an interactive mockup and the decisions taken. The requirements live in [Issue #82](https://github.com/tempu-village/taskmate/issues/82).

## Background / Problem

The manual check for [Issue #60](https://github.com/tempu-village/taskmate/issues/60) showed that a rolling plan and its Proposal worked but were hard to read: the plan did not say which items would change, only an `in proposal-…` note hinted at the review, and a Japanese user saw English headings, units and generated reasons. Issue #82 records the observations in full.

## Goals

- Let the user judge a plan like a short report from a colleague before approving any change.
- Use one language rule for every text Task Pilot writes, including when it runs outside Obsidian.
- Keep approval and application based only on typed changes.

## Non-goals

- Languages other than English and Japanese.
- Changing how plans schedule Tasks, or showing plans in a TaskMate view.
- Summaries for Import reviews.

## Alternatives considered

The [interactive mockup](assets/plan-review-change-display.html) shows the current plan and review next to the improved version with the same six Tasks as the test Vault, and switches between the options below. On 2026-10-24 the user chose the combination the mockup now opens with.

| Question | Options compared | Decision and reason |
| --- | --- | --- |
| Who writes the summary? | A fixed sentence TaskMate builds from the typed changes; an explanation Task Pilot writes; both | Task Pilot writes it. A generated sentence repeats the counts the plan already shows, while an explanation can say why, which is what makes the plan read like a report. |
| Which plan items are listed? | Every item; only changed items | Every item, with unchanged ones marked. Hiding unchanged items made it hard to confirm that nothing was lost, which the coverage principle of the plan depends on. |
| How are plan items grouped? | By date; by kind of change | By date. A plan is used day by day; the kind of change is shown on each item instead. |
| Which language? | English only; TaskMate's language setting | TaskMate's setting, so a Japanese user sees no English interface text other than IDs, titles, labels and code identifiers. |

For the language source, Task Pilot cannot ask Obsidian for its language. Reading Obsidian's own configuration from outside was rejected as an undocumented internal format; asking in every conversation was rejected as repetitive. The desktop app records the language Auto resolves to as `desktopLanguage`, which landed separately in [PR #83](https://github.com/tempu-village/taskmate/pull/83); the mobile app never records it so a phone in another language cannot change it.

## Proposed design

The plan renderer takes every heading and fixed phrase from a per-language table and stores the language it used, so re-reading a plan reproduces the file exactly. Each planned item states its change, derived from the Task as captured when the plan was made, and the Proposal status is stated per item. Proposals gain optional summary fields that only explain. Current behavior is described in [Task Pilot review and capacity planning](../features/task-pilot-planning.md#maintaining-a-rolling-plan), [Task change review](../features/task-change-review/README.md) and the [Task change Proposal format](../specifications/task-change-proposal-format.md).

## Implementation notes

- The plan schema version became 2 because the visible rendering and the stored item data changed. A plan written by an earlier Task Pilot is refused with guidance to create a new plan, instead of being treated as edited outside Task Pilot.
- Each write follows the language setting current at that time, so a plan switches language at its next write.
- The rolling-plan helper requires the working-plan summary for `select-base` and `revise`, and a line for every included item for `proposal`, so the explanation cannot be forgotten.
- The Review View heading is "What this plan changes", the same as in the plan, because the Proposal carries the plan's summary even when it covers only part of the plan.
- A follow-up Proposal after partial approval keeps each Task's line but omits the plan summary, which described the original set of changes.

## Open questions

- None.

## Decision / status

Implemented. The user chose the options above on 2026-10-24.

## Links

- Tracking Issue: [#82](https://github.com/tempu-village/taskmate/issues/82)
- Current feature: [Task Pilot review and capacity planning](../features/task-pilot-planning.md), [Task change review](../features/task-change-review/README.md)
- Current specification: [Task change Proposal format](../specifications/task-change-proposal-format.md)
- Mockup: [Plan and review change display](assets/plan-review-change-display.html)
- Implementation pull request: pending
- Verification evidence: [rolling-plan tests](../../../skills/taskpilot/tests/test_rolling_plan.py), [Proposal tests](../../../test/reviews/task-change/proposal.test.ts), [Review renderer tests](../../../test/reviews/task-change/review-renderer.test.ts)

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

### 概要

rolling planと、そこから作るTask変更レビューで、どのTaskがどう変わるかを、TaskMateの言語設定に合わせて英語か日本語で示すようにしました。Task Pilotが作業計画の短い要約と、ProposalのTaskごとの1行を書き、TaskMateが変更の上に表示します。このRFCには、試作で比べた選択肢と決定を残します。要件は[Issue #82](https://github.com/tempu-village/taskmate/issues/82)にあります。

### 検討した選択肢

[試作](assets/plan-review-change-display.html)では、今の計画とレビューを改善案と並べ、テスト用Vaultと同じ6件のTaskで次の選択肢を切り替えました。2026年10月24日に利用者が選んだ組み合わせで、試作は最初に表示されます。

| 問い | 比べた案 | 決定と理由 |
| --- | --- | --- |
| 要約を書くのは誰か | TaskMateが型付きの変更から作る定型文／Task Pilotが書く説明文／両方 | Task Pilotが書く。定型文は計画にある件数の繰り返しになり、説明文なら理由まで書けるため、報告のように読める。 |
| 計画に出す項目 | すべて／変わるものだけ | すべて出し、変わらない項目にはそう示す。変わらない項目を隠すと、何も漏れていないことを確かめにくい。 |
| 項目の並べ方 | 日付ごと／変わり方ごと | 日付ごと。計画は日ごとに使い、変わり方は各項目に示す。 |
| 言語 | 英語のみ／TaskMateの言語設定 | TaskMateの言語設定。日本語の利用者には、ID、タイトル、ラベル、コード上の識別子以外の英語を出さない。 |

Task PilotはObsidianに言語を聞けません。Obsidianの設定ファイルを外から読む案は非公開の内部形式に頼るため、毎回会話で聞く案は手間がかかるため採りませんでした。パソコン版が「自動」で決まる言語を`desktopLanguage`として記録する仕組みは[PR #83](https://github.com/tempu-village/taskmate/pull/83)で入りました。スマホ版は記録しません。

### 実装時の判断

- 表示と保存する項目の内容が変わったため、計画の形式をversion 2にしました。以前のTask Pilotで作った計画は、外部で編集されたものとしてではなく、作り直すよう案内して読み込みを断ります。
- 書き込むたびにその時点の言語設定に従うため、設定を変えると次の書き込みで計画の言語も変わります。
- 作業計画の要約は`select-base`と`revise`で、含めるTaskごとの1行は`proposal`で必須にし、説明を書き忘れないようにしました。
- ProposalはTask変更レビューが計画の一部だけを含む場合も計画の要約を持つため、Review Viewの見出しは計画と同じ「この計画で変わること」にしました。
- 一部だけ承認した後のProposalでは、Taskごとの1行は残し、元の変更全体を説明していた計画の要約は外します。

### 状態

実装済みです。利用者は2026年10月24日に上の選択肢を選びました。
