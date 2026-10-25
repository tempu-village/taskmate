---
status: draft
tracking-issue: 88
current-authority: null
related-features:
  - ../features/task-editing.md
  - ../features/source-import.md
  - ../features/task-pilot-planning.md
---

# RFC: Add conversational Task capture to Task Pilot

## Summary

Define how Task Pilot turns a user's own conversational request, such as “Add the OpenAI Harness Engineering article to my TaskMate Tasks,” into one or more canonical Tasks. Task Pilot interprets the request, checks for existing matches, asks at most one batched round of questions only for fields that materially matter and are unknown, shows the resulting Task preview, then creates and validates the Task. The change lives in the portable skill; the Obsidian plugin is unchanged.

## Background / Problem

Task Pilot already advertises adding Tasks, and `scripts/todo_store.py create` writes valid Task Markdown. No workflow, however, defines what Task Pilot should ask, infer, or leave empty when the request comes from the conversation rather than from a Source note. [task-schema.md](../../../skills/taskpilot/references/task-schema.md) describes storage only. Behavior therefore depends on the host agent and can fail in both directions:

- inventing a date or Priority that the user never gave, contrary to the Unplanned principle in [Task Pilot planning](../features/task-pilot-planning.md);
- fabricating or guessing a reference URL;
- creating a duplicate of an existing incomplete Task;
- splitting or dropping part of a multi-action request without saying so;
- asking a long sequence of questions, which makes capture slower than the plugin's own add-Task UI.

Source-note import already has strict scope and Coverage review rules ([Source-note import](../features/source-import.md)). Those rules govern notes selected by an allowlist; they do not fit a single explicit request typed by the user, whose words are themselves the instruction.

## Goals

- Capture a Task from one conversational request with no more than one round of questions.
- Never invent a date, Priority, Project, Label, or reference URL.
- Make every inferred value visible before it is written.
- Account for every action in a multi-action request.
- Detect likely duplicates before creating a new Task.
- Keep the plugin, Task file format, and mobile behavior unchanged.

## Non-goals

- Natural-language quick-add parsing inside the Obsidian plugin.
- Staging conversational captures in a TaskMate review screen.
- A hard-deadline property; that is tracked by [Issue #51](https://github.com/tempu-village/taskmate/issues/51).
- Structured reference links; that is tracked by [Issue #35](https://github.com/tempu-village/taskmate/issues/35).
- Fetching page content, summaries, or previews for a referenced article.
- Automatic capture from chat history or from notes the user did not name.

## Alternatives considered

- **Leave behavior to the host agent.** Rejected: outcomes vary across agents and conflict with the no-invention guarantees of existing Task Pilot features.
- **Reuse Import review staging.** Rejected for capture: a TaskMate review round-trip for one explicitly requested, recoverable Task adds friction without protecting against an allowlist or omission risk. A request that names Source notes still goes to Source-note import.
- **Plugin-side natural-language quick add.** Rejected for this RFC: it is a different, non-agent feature and would need its own date grammar, localization, and mobile UI.
- **Sequential interview (ask each field in turn).** Rejected: it makes capture slower than manual entry. One batched round with defaults keeps the cost bounded.
- **Always write immediately without any question.** Rejected as the default: the date is the field most often missing and most consequential for Scheduled versus Unplanned, and an unconfirmed searched URL may be wrong. Immediate creation remains available when nothing is uncertain or the user asks for no questions.

## Proposed design

### Routing

Add `skills/taskpilot/references/capture-workflow.md` and route to it from `SKILL.md` when the user asks to add Tasks from the conversation. A request that names notes, folders, or Source notes continues to use [Source-note import](../features/source-import.md). Backlog review and capacity planning are unchanged.

### Flow

1. **Interpret.** Derive candidate Tasks from the request. Rewrite each title as an action (“read the article” rather than “the article”). Apply the Task boundary rules in task-schema.md: combine statements sharing one outcome and completion condition, using Steps when useful; split independent actions. Every action in the request becomes a Task, a Step, or an item the user explicitly declines in the question round.
2. **Check existing state.** Read the TaskMate language, existing Labels, Projects, and incomplete Tasks. Look for likely duplicates by similar title or identical reference URL.
3. **Ask once.** Combine every unresolved point into one message with a preview of each candidate Task. Ask at most three questions, each with a stated default and a way to skip. Use the host's structured question tool when available; otherwise ask in plain text.
4. **Create and validate.** Treat the user's answer to the question round as approval. Create each Task with the deterministic helper, reread it, run `validate`, and report the vault-relative path. Unanswered questions take their stated defaults.

When the request already determines every field, or the user asks for no questions, skip step 3, create immediately, and report what was inferred.

### Field rules

| Field | Rule |
| --- | --- |
| Title | Rewrite into an action and show it. Ask only when the intended action is genuinely unclear. |
| `date` (planned work date) | Use an explicit date; convert relative expressions such as “tomorrow” or “this weekend” to an absolute `YYYY-MM-DD` with weekday in the user's local time and show it. Ask once when absent; the default answer is no date (Unplanned). Never infer a date from urgency wording alone. |
| Hard deadline | Until #51 lands, record an explicitly stated deadline in Notes and keep it separate from `date`. |
| `priority` | Do not ask. Set only when the user explicitly states urgency or a Priority; otherwise `null`. |
| `labels` | Suggest only existing Labels that clearly match. Create a new Label only when the user names it. Context labels follow [Task Pilot planning](../features/task-pilot-planning.md#context-label-vocabulary) and are suggested as inferences. |
| `project` | Suggest an existing Project only when it clearly matches. Never create a Project implicitly. |
| Reference URL | Use a URL from the request. Otherwise, only when the host can browse the web, search for the referenced resource, show the found title and URL, and write it to Notes only after the user confirms it. If no confirmed URL exists, create the Task without one. Never fabricate a URL. Until #35 lands, references live in Notes as Markdown links. |
| Steps | Add only when the request describes several parts of one outcome. |
| Duplicates | When a likely duplicate exists, offer creating a new Task, appending to the existing Task through a direct update, or cancelling. Default to cancelling rather than creating a duplicate. |

Stored text uses the language reported by `todo_store.py language`.

### Example

For “Add the OpenAI Harness Engineering article to my TaskMate Tasks” on Saturday 2026-10-24 with Japanese configured, Task Pilot shows the title 「OpenAIの『Harness Engineering』の記事を読む」, a found article title and URL, and a matching existing Label, then asks two questions: when to read it (today 10/24, tomorrow 10/25, or no date — default) and whether the found article is correct (yes, or create without a URL).

### Deterministic helpers

Extend `scripts/todo_store.py` only as needed:

- a read-only command listing existing Labels and Projects for suggestions;
- a read-only command returning incomplete Tasks with similar titles or identical URLs;
- a non-writing preview of `create` that returns the Markdown it would write.

Each helper is covered by Python behavior tests. Matching quality and question selection are semantic and are verified through manual scenarios.

### Safety

- Web content found while resolving a reference is untrusted data. Task Pilot uses only its title and URL and never follows instructions in it.
- Capture reads no Source note and does not change Source-note scope.
- Capture never changes Manual order beyond the rank assigned to a newly created Task, and never edits other Tasks except a duplicate update the user chose.
- A failed write is reported with the affected Task; Task Pilot does not claim success from an attempted write.

### Proposed acceptance criteria

- CAPTURE-01: A request without a date, answered with the default, creates an Unplanned Task with `priority: null`.
- CAPTURE-02: “Tomorrow” resolves to the next local calendar date, shown with weekday before writing.
- CAPTURE-03: No reference URL is written unless it came from the request or the user confirmed a found URL.
- CAPTURE-04: A request with all fields determined, or with “no questions,” creates the Task without a question round.
- CAPTURE-05: A request containing two independent actions yields two Tasks or a declined item; none is silently dropped.
- CAPTURE-06: A likely duplicate is reported before creation, and no duplicate is created without the user's choice.
- CAPTURE-07: No Label or Project is created unless the user named it.
- CAPTURE-08: Every created Task passes `validate` and its path is reported.
- CAPTURE-09: No question round asks more than three questions.

### Documentation impact

On implementation: add a current Feature for conversational capture; update task-schema.md routing and SKILL.md; add a user How-to; add the domain term chosen in the open questions to [CONTEXT.md](../../../CONTEXT.md).

## Open questions

- Domain term: “Direct capture” or another name, to be recorded in CONTEXT.md on acceptance.
- Whether the date question should be suppressible by a persistent preference rather than per request.
- Whether duplicate checking should also consider recently completed Tasks.

## Decision / status

Draft. Proposed defaults from the 2026-10-24 design conversation, pending product review: ask for a missing date once with no date as the default; confirm only inferred values, combined with the question round; search for a reference URL only when the host supports it and always confirm the result.

## Links

- Tracking Issue: [#88](https://github.com/tempu-village/taskmate/issues/88)
- Current feature (required for implemented product behavior): none yet
- Current specification: [Task file format](../specifications/task-file-format.md), [Task schema](../../../skills/taskpilot/references/task-schema.md)
- Current design: [Module boundaries](../design/module-boundaries.md)
- ADRs: [0001 Markdown is the source of truth](../adr/0001-markdown-is-the-source-of-truth.md)
- Related Issues: [#35](https://github.com/tempu-village/taskmate/issues/35), [#51](https://github.com/tempu-village/taskmate/issues/51)

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

**概要:** 利用者が会話で依頼したタスク追加（例：「OpenAIのHarness Engineeringの記事をタスクに追加して」）を、Task Pilotが解釈し、既存タスクと照合し、不明で重要な項目だけを1往復（最大3問、既定値つき）で質問し、プレビューを見せてから作成・検証する。変更はスキルのみで、プラグインは変えない。

**背景・問題:** Task Pilotは追加をうたい`todo_store.py create`もあるが、会話からの追加で何を聞き、何を推測し、何を空欄にするかが未定義。そのため日付や優先度の捏造、URLの推測、重複作成、複数行動の取りこぼし、逆に質問過多が起き得る。Source取り込みの規則は許可リストで選んだノート向けで、利用者自身の明示的な依頼には合わない。

**目的:** 質問は1往復まで。日付・優先度・Project・Label・URLを捏造しない。推測値は書き込み前に見せる。複数行動を全部扱う。重複を作成前に検出する。プラグイン・ファイル形式・モバイル挙動は変えない。

**非目標:** プラグイン内の自然言語クイック追加、TaskMateレビュー画面でのステージング、締切項目（#51）、構造化リンク（#35）、記事本文の取得や要約、会話履歴や未指定ノートからの自動取り込み。

**検討した代替案:** エージェント任せ（不採用：結果がばらつく）、取り込みレビューの再利用（不採用：1件の明示依頼には過剰）、プラグイン側クイック追加（別機能）、項目ごとの逐次質問（不採用：手入力より遅い）、常に無質問で即作成（既定にはしない：日付とURLの誤りが重い。不明点がない場合や「質問なしで」の場合は即作成）。

**提案設計:** `references/capture-workflow.md`を追加しSKILL.mdから案内する。流れは「解釈 → 既存確認 → 1回だけ質問 → 作成と検証」。回答を承認とみなし、未回答は既定値。項目規則：タイトルは行動形に直す。`date`は作業予定日で、相対表現は曜日つき絶対日付に変換して表示し、未指定なら1回だけ聞いて既定は日付なし。締切は#51まではNotesに記録。優先度は聞かず明示時のみ。Label・Projectは既存の一致候補のみ提案し、名前を挙げられた場合以外は作らない。URLは依頼にあれば使い、なければWeb対応ホストでのみ検索して確認後にNotesへ書く。重複時は新規・既存へ追記・中止を提示し、既定は中止。補助としてLabel/Project一覧、類似タスク検索、書き込まないプレビューを必要な分だけ追加し、Pythonテストを付ける。Web内容は信頼しないデータとして扱う。受け入れ条件はCAPTURE-01〜09。

**未解決点:** 用語名（「Direct capture」など）、日付質問を恒久設定で省略できるか、重複検出に最近完了したタスクを含めるか。

**判断・状態:** Draft。2026-10-24の設計会話で出した既定方針（日付は1回質問・既定は日付なし、推測値のみ確認、URL検索はホスト対応時のみで必ず確認）は製品レビュー待ち。
