# Task Pilot review and capacity planning

Approval: Accepted — product review confirmed on 2026-10-11.
Implementation: Implemented on the current branch — tracked by [Issue #52](https://github.com/tempu-village/taskmate/issues/52); not yet identified with a release.

> English is canonical. Japanese is an AI-translated reference.

## Purpose and scope

Task Pilot helps a user regain trust in a large, stale task list and choose a realistic next set of work. It reviews existing incomplete Tasks, incorporates approved Tasks extracted from selected Source notes, proposes safe changes with reasons, and builds a plan that fits the user's actual available time and circumstances.

The product outcome is not a fixed “top three.” A useful plan may contain zero, one, three, or more Tasks. Its size follows available capacity, estimated effort, relevant context, and the user's priorities.

This feature keeps TaskMate's visible lifecycle simple. A Task is incomplete or completed; an incomplete Task is Scheduled when it has a date and Unplanned when it does not. Task Pilot does not introduce Active, Pending, Waiting, or similar Task statuses.

## User stories

- As a user with many old or past-scheduled Tasks, I want to see the size and shape of the backlog before anything changes, so I can regain control without losing work.
- As a user who no longer knows when a Task should happen, I want Task Pilot to propose removing its date, so “later” does not pretend to be a commitment.
- As a user with limited time today, I want a plan sized to that time, with selection reasons and effort ranges, so I can start without reviewing the entire backlog myself.
- As a user with a short break or a particular device, place, or energy level, I want suitable Tasks suggested from both explicit context labels and clearly identified inferences.
- As a user whose plans and notes change, I want every Task mutation presented for review and rechecked before saving, so the Markdown remains trustworthy.

## Target user-visible behavior

### Starting a review

The user may make a natural-language request such as:

- “Review my Tasks.”
- “Review past-scheduled Tasks.”
- “Plan today; I have two hours.”
- “Find something I can do in 30 minutes.”

Task Pilot first summarizes the relevant incomplete Task set. Depending on the request, the summary may include counts for Scheduled, past-scheduled, today, Unplanned, and Tasks that need user clarification. A zero-result review reports that no applicable Tasks were found and performs no write.

The review asks only for constraints that materially affect the result and are not already known. These can include available time, fixed commitments, desired planning buffer, current energy or concentration, available device or place, and a project the user wants to favor. Population averages for leisure time are not a substitute for the user's stated capacity.

A backlog review and a capacity plan are separate operations that may be requested together. A backlog review proposes changes to canonical Tasks. A capacity plan selects from the current canonical Tasks and is read-only. Approving or following a plan does not by itself set Task dates, priorities, labels, or completion. Those changes require separately visible Task-change proposals.

### Reviewing existing Tasks

For each Task that may change, Task Pilot shows the current value, proposed value, and a concise reason. The first iteration may propose only these canonical Task changes:

- keep the date;
- change the date;
- remove the date;
- keep, change, or clear priority;
- add or remove Context labels;
- make no change;
- ask the user to clarify.

These actions describe a proposal session. They are not stored as Task statuses or displayed as a new status system in TaskMate.

Task Pilot may point out a possible duplicate, unclear title, oversized Task, or Task that may already be complete, but the first iteration does not merge, split, rename, complete, or delete it automatically or through a bulk review action. The user may still perform those operations through existing TaskMate behavior. Completion is allowed through Task Pilot only when the user directly instructs it to complete a named Task; it is not inferred from age, wording, or missing activity.

“Do later” means removing the date unless the user supplies another date. The Task remains incomplete, remains available in All and No date, and receives no automatic `pending` or `waiting` label. Task Pilot must not invent a replacement date or priority merely to make the list look organized.

A large backlog review starts with counts and groups proposals by exact action and reason, such as “remove unsupported past date” or “needs clarification.” The user can inspect every affected Task before approving a group. A group approval cannot include hidden Tasks or mixed changes. Clarification items remain separate and unchanged.

The review does not distribute every Task across future dates merely to clear the backlog. Adding or changing a date requires a user-supplied planning horizon or other date authority and shows each resulting date. Without enough future-capacity information, an unsupported old date is a candidate for removal, not arbitrary rescheduling.

Priority changes require evidence such as an explicit user focus, hard deadline, commitment, dependency, or blocker. Task age by itself is not evidence. When the evidence does not distinguish priorities, Task Pilot leaves the priority unchanged or asks the user rather than inventing a ranking.

A Task date remains the date on which the user plans to work on the Task; this proposal does not add a separate deadline field. When a Source note or the user explicitly identifies a hard deadline, Task Pilot preserves that fact in the review and asks before making a conflicting date change. It must not silently discard an explicit deadline.

### Incorporating Source notes

An eligible Source note is an ordinary note in a folder selected in TaskMate settings or a note with `taskmate-source: true`. `taskmate-source: false` excludes a note even inside a selected folder. Task, Project, Proposal, and Obsidian configuration folders remain excluded, as defined by [Source-note import](source-import.md).

A normal backlog review or capacity plan reads canonical Tasks only. It does not silently scan or import recently edited notes. Source-note import runs only when the user names eligible notes, explicitly asks to include Source notes under a bounded rule such as a named folder or recent period, or continues an existing coverage review. Before extraction, Task Pilot shows the selected note paths; the user may remove notes from that run without changing their long-term eligibility.

For selected Source notes, Task Pilot uses the existing coverage review. Every action candidate is accounted for as a proposed Task, merge, or explicit exclusion. Only approved proposals become canonical Tasks. The planning step uses existing Tasks plus newly approved Tasks; unapproved proposals do not enter the plan. Automatically discovering and importing recent notes without an explicit request is outside this iteration.

### Estimating active effort

An effort estimate is the Task Pilot's session-only range for active work time. It excludes elapsed waiting time, such as waiting for a reply or delivery. It is not a deadline, a measured duration, or a new Task property.

Task Pilot estimates in this evidence order:

1. Use a duration the user gives for the Task in the current request.
2. Otherwise use explicit duration evidence in the Task title, Notes, or Steps.
3. Otherwise estimate the next independently completable action from its described scope and Steps.
4. If the Task boundary is too vague to support a credible range, ask one focused question or mark it “needs breakdown” instead of pretending to know.

Inferred estimates use coarse ranges such as 5–15, 15–30, 30–60, or 60–120 minutes. Work expected to exceed two hours is marked large and is included as one block only when the user explicitly accepts it; otherwise Task Pilot recommends breaking it down. Setup and transition time that are inherent to doing the Task are included in the range.

Every displayed estimate identifies its basis as user-provided, Task-text evidence, or Task Pilot inference. A user correction overrides the estimate for the current planning session. This iteration does not write estimates back to Task Markdown or remember corrections across sessions.

### Building a capacity-based plan

If the user gives a net duration such as “I have two hours,” Task Pilot uses it directly. If the user gives a clock interval such as “13:00–17:00,” it subtracts fixed commitments inside that interval once. It then reserves a planning buffer. The default buffer is 20% of the remaining window, rounded down to a whole minute, is shown to the user, and may be changed or removed by the user. It does not use population-average leisure time.

A Task fits the capacity plan only when the sum of the selected Tasks' upper estimate bounds does not exceed the buffered planning capacity. Tasks that only fit under optimistic lower bounds appear separately as near matches, not inside the committed plan. Task Pilot does not force a fixed number of Tasks.

Each planned Task shows:

- an estimated effort range, clearly marked as an estimate;
- the reason it was selected now;
- the relevant date, priority, project, or context evidence;
- whether any context judgment was inferred rather than explicitly labeled.

The plan may group work as “start first,” “next,” and “short free-time options.” These are presentation groups, not persisted Task states. The plan does not rewrite Manual order.

Task Pilot may propose a plan even when some effort estimates are uncertain, but it must expose that uncertainty. If it cannot form a credible plan from the available information, it asks for the smallest missing constraint instead of manufacturing precision.

Task Pilot chooses work in three stages rather than applying one rigid global ranking.

1. **Must consider first:** honor an explicit Task or focus in the current request, then protect an explicitly stated hard deadline that would otherwise be missed.
2. **Check feasibility:** exclude work that does not fit the available time or contradicts an explicit device, place, or energy constraint. Prefer explicit Context-label matches to content-based inferences.
3. **Compare feasible candidates:** consider Scheduled dates, Priority, Project focus, dependencies, blockers, Context evidence, and Manual order together. Manual order is the final stable tie-breaker when the other evidence does not distinguish candidates.

No single signal in stage three always wins. When an old Scheduled date conflicts with a high-priority Unplanned Task, Task Pilot shows the trade-off and its reason; if the evidence does not support a safe choice, it asks the user. Task age alone does not make a Task important and does not justify increasing its priority.

### Finding Tasks for available moments

The user can supply a duration and optionally a device, place, situation, or energy level. Task Pilot prioritizes Tasks whose context labels match those constraints. It may also suggest an unlabeled Task when its content clearly appears suitable, but it marks that match as an inference.

Missing context labels do not automatically exclude a Task. A free-time request returns as many credible options as fit the capacity; it is not fixed to three. An explicit contradiction in the Task text, such as “requires PC” during a phone-only request, excludes it from the plan. Task Pilot does not interrupt the user or automatically detect breaks in this iteration.

## Context label vocabulary

A Context label is an ordinary, user-editable Label whose name begins with `context/`. It describes circumstances in which a Task is practical to perform. It is neither a Task status nor required metadata. Multiple Context labels may be attached to one Task.

Task Pilot initially understands the following vocabulary:

| Label | Meaning used during planning |
| --- | --- |
| `context/break` | Suitable for a short break or small free-time window. |
| `context/phone` | Suitable while using a phone. |
| `context/pc` | Suitable while using a personal computer. |
| `context/home` | Suitable while at home. |
| `context/outside` | Suitable while away from home. |
| `context/low-energy` | Suitable when concentration or energy is low. |
| `context/errand` | Can be combined with shopping, travel, or other errands. |

These values are not silently attached to Tasks and are not pre-created as hidden system records. Task Pilot offers them when relevant, and they become ordinary Task labels only after user approval and saving.

Context labels express positive suitability, not exclusive requirements. Multiple labels therefore mean that more than one situation may be suitable. Absence of `context/phone`, for example, does not prove that a Task cannot be done by phone.

Users may create additional labels under the same prefix, such as `context/train`, `context/office`, `context/morning`, or `context/weekend`. TaskMate stores and edits them like any other Label. Task Pilot may exact-match an unfamiliar label when the user requests the same context name. Broader interpretation or synonym matching requires an explanation in the current interaction; this iteration does not persist a separate dictionary of custom label meanings.

Adding, removing, renaming, or deleting a Context label follows the existing [Labels](labels.md) behavior. A Context label does not itself change completion, date, priority, project, or Manual order.

## Target contract and safety guarantees

- No canonical Task changes until the user approves the applicable proposals.
- Similar low-risk changes may be approved as a batch only when the affected Tasks and exact changes are visible.
- Task Pilot rechecks relevant Task content before applying an approved proposal. A changed Task blocks that write and returns it for renewed review.
- Source-derived changes retain the Source-note import snapshot and coverage safeguards.
- After writing, Task Pilot reloads and validates the affected Markdown instead of reporting success from an attempted write alone.
- Unrelated Task content and properties are preserved.
- Task Pilot never changes Manual order as a side effect of review or planning.
- An effort estimate is advisory. This iteration does not store actual duration, learn personal velocity, or present an estimate as measured fact.
- Accepting a capacity plan is read-only and does not imply approval of any Task-change proposal.
- Context labels remain user-controlled Labels. TaskMate does not reserve the entire `context/` namespace or prevent manual edits.

If some writes in an approved batch fail, Task Pilot identifies which Tasks succeeded and failed and does not claim atomic success or silently retry destructive changes. A retry must recheck current files and avoid duplicating an already applied change.

## Processing flow

1. Distinguish a backlog review, a read-only capacity plan, and an explicitly requested Source-note import; resolve the scope of each.
2. When Source notes are requested, show the selected eligible paths, then complete coverage review and approval.
3. Load the canonical incomplete Tasks and summarize the review population without changing it.
4. Collect only missing planning constraints and derive evidence-labeled effort ranges.
5. Generate reasoned date, priority, and Context-label proposals for a requested backlog review.
6. Let the user revise, approve, reject, or defer proposals, including safe batch decisions.
7. Recheck current files, apply only approved changes, and validate the saved Markdown.
8. Build a read-only capacity plan from the current canonical Tasks and display the capacity calculation, reasons, estimates, and inferences.

Backlog-review mutations use persisted, reviewable [Task change Proposals](task-change-review/README.md) containing typed ChangeSets and complete before/after Markdown evidence. Capacity plans remain conversation output and read-only. Source-note imports continue to use their distinct persisted Proposal sessions. Canonical Task Markdown remains the only Task master data.

## Failure handling and limitations

- If available time is missing for a capacity plan, Task Pilot asks for it or clearly labels a plan as unbounded.
- If estimates exceed the available time, Task Pilot reduces the plan or asks which constraint to relax; it does not hide the overflow.
- If a Task has no credible estimate, it remains visible as needing clarification but is not silently packed into a bounded plan.
- If no Task credibly matches a requested context, Task Pilot reports that result and may offer clearly marked near matches.
- If two proposals conflict, neither is written until the conflict is resolved.
- A changed or unreadable Task is reported and omitted from mutation; other independent proposals may continue after the user sees the partial scope.
- Semantic completeness of AI-generated suggestions cannot be proven by file validation. The user review remains authoritative.

## Acceptance and verification

All criteria below are implemented on the current branch. Semantic judgment still requires user review; automated evidence covers the deterministic interfaces and safeguards.

- PLAN-01: A review of many incomplete Tasks reports the population before any write and offers reasoned changes without creating new Task statuses.
- PLAN-02: Choosing “do later” removes the date after approval, keeps the Task incomplete, and adds no automatic holding label.
- PLAN-03: A two-hour plan selects a variable number of Tasks whose estimated ranges fit the stated capacity with visible headroom and reasons.
- PLAN-03A: With the default buffer, a two-hour window displays 96 minutes of planning capacity; changing the buffer recalculates the plan.
- PLAN-03B: The sum of upper estimate bounds does not exceed planning capacity; lower-bound-only fits are shown separately.
- PLAN-04: A 30-minute phone request prioritizes `context/phone` Tasks and marks unlabeled content-based matches as inferences.
- PLAN-05: Task Pilot recognizes all seven initial Context labels, proposes label changes for approval, and never applies them silently.
- PLAN-06: A user-created `context/train` label remains editable in TaskMate and can influence planning once its meaning is explicit.
- PLAN-07: A Task changed after proposal generation is not overwritten and returns for renewed review.
- PLAN-08: Source-note candidates enter planning only after the existing coverage review promotes them to canonical Tasks.
- PLAN-09: Planning and review leave Manual order unchanged.
- PLAN-10: Zero matches and partial write failures are reported accurately without fabricated success.
- PLAN-11: A normal planning request does not scan or import Source notes; an explicit Source-note request shows the selected eligible paths before extraction.
- PLAN-12: Accepting a capacity plan changes no Task fields; date, priority, and Context-label changes require separate approval.
- PLAN-13: Every effort range exposes its evidence basis, and an unestimable Task is not silently included in a bounded plan.
- PLAN-14: A 50-Task review groups only identical visible changes, lets the user inspect every member, and leaves clarification items unchanged.
- PLAN-15: Without future-capacity evidence, the review does not assign arbitrary future dates or priorities to clear an old backlog.
- PLAN-16: Candidate selection follows must-consider, feasibility, and multi-signal comparison stages; a conflict between schedule and Priority is explained or returned to the user instead of resolved by a hidden fixed precedence.

Automated evidence: [planning behavior tests](../../../skills/taskpilot/tests/test_planning_store.py), [Source-note proposal tests](../../../skills/taskpilot/tests/test_proposal_store.py), and [Task store tests](../../../skills/taskpilot/tests/test_todo_store.py). The deterministic planning tests cover 50-Task grouping, stale and partial writes, 20% capacity arithmetic, upper-bound packing, Context evidence, read-only plans, estimate clarification, and schedule/Priority conflict disclosure. They cannot prove that an agent's semantic estimates or reasons are good; the visible user review remains required.

## Out of scope for this iteration

- Active, Pending, Waiting, or another multi-state Task lifecycle;
- an automatically added `pending` or `waiting` label;
- a dedicated TaskMate status-management screen;
- a separate stored deadline field or deadline/date migration;
- calendar integration or automatic free-time detection;
- scheduled morning planning or unsolicited break notifications;
- persistence of actual duration or automatic learning from completion history;
- persisted capacity plans, effort estimates, or custom Context-label dictionaries;
- automatic discovery and import of recently edited Source notes without an explicit request;
- fully automatic Task mutation without review;
- bulk merge, split, rename, completion, or deletion during backlog review;
- changing the user's Manual order;
- a second database or non-Markdown source of truth.

## Pending changes

[RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md), tracked by [Issue #62](https://github.com/tempu-village/taskmate/issues/62) with the rolling-plan slice in [Issue #60](https://github.com/tempu-village/taskmate/issues/60), is accepted but not implemented. It proposes replacing conversation-only capacity-plan output with one Obsidian rolling-plan Markdown that covers every canonical incomplete Task as planned, `GAP`, or `CONFLICT`. The user would compare a recommended base with an evidence-only base, choose one working plan, revise it through Codex by stable IDs, and explicitly generate an existing Task change Proposal from all dates by default or from a narrower requested range.

The proposed plan remains read-only: creating, choosing, or editing it would not change Tasks. Future placement would require a user-confirmed capacity profile, and plan-derived changes would be limited to date, Context labels, Steps, and Notes. This paragraph records accepted future direction only; the current conversation capacity-plan behavior above remains authoritative until implementation is verified.

Implementation progress: Task Pilot can create, select a base for, revise, close, and supersede the plan artifact with `scripts/rolling_plan.py`, writing to `planFolder` (default `TaskMate/Plans`). Generating a Task change Proposal from the working plan is not implemented, so Issue #60 remains open.

## Related specifications and features

- [Task schema](../../../skills/taskpilot/references/task-schema.md)
- [Source-note import](source-import.md)
- [Labels](labels.md)
- [Navigation, filtering and sorting](filtering-and-sorting.md)
- [Task editing](task-editing.md)
- [Storage and privacy](storage-and-privacy.md)
- [Task change review](task-change-review/README.md)
- [RFC 0033: Reviewable rolling plans and Source candidate reviews](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md)

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：2026年10月11日の製品レビューで採用済み。実装：現在のブランチへ実装済みで、[Issue #52](https://github.com/tempu-village/taskmate/issues/52)で追跡します。対応リリースはまだ特定していません。

### 目的と範囲

Task Pilotは、古いTaskや予定日を過ぎたTaskが大量にある利用者が一覧への信頼を取り戻し、現実的な次の作業を選べるよう支援します。既存の未完了Taskを見直し、対象Source noteから承認済みのTaskを加え、理由付きの安全な変更案を提示し、実際の空き時間と状況に収まる計画を作ります。

目的は固定の「上位3件」を選ぶことではありません。有用な計画は0件、1件、3件、それ以上のいずれにもなり得ます。件数は、利用可能時間、推定作業量、実行状況、利用者の優先事項から決めます。

TaskMateの見える状態管理は単純なままにします。Taskは未完了または完了であり、未完了Taskは日付があればScheduled、なければUnplannedです。Active、Pending、Waitingなどの状態は追加しません。

### ユーザーストーリー

- 古いTaskや予定日を過ぎたTaskが多い利用者として、何かを変更する前に全体量と内訳を確認し、作業を失わずに立て直したい。
- いつ実行するか決められないTaskについて、Task Pilotから日付を外す提案を受け、「後で」を偽の約束にしたくない。
- 今日使える時間が限られる利用者として、その時間に収まる件数の計画と、選定理由・所要時間の幅を確認し、全Taskを自分で見直さずに着手したい。
- 短い休憩、特定の端末・場所・体力に合うTaskを、明示ラベルと明確に区別された推測の両方から見つけたい。
- 計画やメモが変わる利用者として、Task変更をすべてレビュー対象として提示し、保存前に再確認して、Markdownを信頼できる状態に保ちたい。

### 対象となる利用者体験

利用者は「Taskを整理して」「予定日を過ぎたTaskを見直して」「今日は2時間使えるので計画して」「30分でできることを探して」のように依頼できます。

Task Pilotは最初に、対象となる未完了Taskを要約します。依頼に応じて、Scheduled、予定日超過、今日、Unplanned、要確認の件数を示します。対象が0件なら、該当Taskがないことを伝え、書き込みません。

結果に実質的な影響があり、まだ分からない制約だけを質問します。利用可能時間、固定予定、余白、現在の体力・集中力、使える端末や場所、優先したいProjectなどです。一般人口の平均余暇時間を本人の空き時間の代わりには使いません。

バックログ見直しと時間ベース計画は別の操作で、同時に依頼することもできます。バックログ見直しは正式Taskの変更案を作ります。時間ベース計画は現在の正式Taskから候補を選ぶ読み取り専用の操作です。計画の承認や実行だけでは、Taskの日付、優先度、ラベル、完了状態を変更しません。変更には、別に見えるTask変更案への承認が必要です。

### 既存Taskの見直し

変更対象ごとに、現在値、変更後の値、短い理由を示します。初回イテレーションで正式Taskへ提案できる変更は、日付の維持・変更・削除、優先度の維持・変更・解除、Context labelの追加・削除、変更なし、利用者への確認に限定します。これらはレビュー用の処理区分であり、Taskの状態として保存せず、TaskMateへ新しい状態管理を追加しません。

重複の可能性、不明確なタイトル、大きすぎるTask、完了済みの可能性を指摘できますが、初回イテレーションでは一括見直しによる統合、分割、改名、完了、削除を行いません。既存のTaskMate操作では引き続き実行できます。Task Pilotからの完了操作は、利用者が名前を指定して直接完了を指示した場合だけ許可し、古さ、文面、活動がないことから完了を推測しません。

「後でやる」は、利用者が別の日付を指定しない限り日付を外すことを意味します。Taskは未完了のままAllとNo dateに残り、`pending`や`waiting`は自動付与しません。一覧を整って見せるためだけに日付や優先度を捏造しません。

大量のバックログ見直しでは、最初に件数を示し、「根拠のない過去日付を外す」「要確認」のように、同じ変更内容と理由ごとに提案をまとめます。グループ承認前に対象Taskをすべて確認できます。見えないTaskや異なる変更を同じ承認へ含めません。要確認項目は分離し、変更しません。

バックログを空に見せるために、すべてのTaskへ将来日付を機械的に配りません。日付の追加・変更には、利用者が示した計画期間などの日付根拠が必要で、変更後の日付をTaskごとに表示します。将来の作業容量が不足している場合、根拠のない古い日付は任意の日への再予定ではなく、日付削除の候補にします。

優先度の変更には、利用者が明示した重点、本当の締切、約束、依存関係、ブロッカーなどの根拠が必要です。古いことだけは根拠になりません。根拠から優先度を区別できなければ、変更しないか利用者へ確認し、順位を捏造しません。

Taskの日付は実行予定日です。この提案では別の締切フィールドを追加しません。Source noteまたは利用者が本当の締切を明示した場合、その事実をレビューに残し、矛盾する日付変更の前に確認します。明示された締切を黙って捨てません。

### Source noteの取り込み

取り込み対象にできるSource noteは、TaskMate設定で選ばれたフォルダー内の通常ノート、または`taskmate-source: true`を持つノートです。選択フォルダー内でも`taskmate-source: false`なら除外します。Task、Project、Proposal、Obsidian設定フォルダーは、[Source-note import](source-import.md)の定義どおり対象外です。

通常のバックログ見直しと時間ベース計画は、正式Taskだけを読みます。最近編集したノートを黙って探索・取り込みしません。Source noteの取り込みは、利用者が対象ノートを名前で指定した場合、名前付きフォルダーや最近の期間などの範囲を明示してSource noteを含めるよう依頼した場合、または既存のcoverage reviewを続ける場合だけ実行します。抽出前に対象ノートのパスを示し、利用者は長期的な対象設定を変えずに今回の対象から外せます。

選ばれたSource noteには既存のcoverage reviewを使います。すべての行動候補をTask作成、統合、明示除外のいずれかへ割り当て、承認された提案だけを正式Taskにします。計画には既存Taskと新しく承認されたTaskを使い、未承認提案は含めません。明示依頼なしで最近編集したノートを自動発見・取り込みする機能は今回の対象外です。

### 実作業時間の見積もり

Effort estimateは、Task Pilotが現在のセッションで使う実作業時間の幅です。返信待ちや配送待ちなどの経過待ち時間は含めません。締切、実測時間、新しいTask Propertyのいずれでもありません。

次の根拠順で見積もります。

1. 現在の依頼で利用者がそのTaskの時間を示していれば、それを使う。
2. なければTaskのタイトル、Notes、Stepsに明示された時間根拠を使う。
3. なければ、記載された範囲とStepsから、次に独立して完了できる行動を見積もる。
4. Taskの境界が曖昧で信頼できる幅を出せなければ、一つに絞った質問をするか「分解が必要」と示し、分かったふりをしない。

AI推測では、5〜15分、15〜30分、30〜60分、60〜120分のような粗い幅を使います。2時間を超える見込みの作業は「大」と示し、利用者が一つの作業枠として明示的に認めた場合だけ含めます。それ以外は分解を勧めます。Taskの実行に必須の準備時間や切り替え時間は範囲に含めます。

各見積もりには、利用者指定、Task本文の根拠、Task Pilotの推測のどれかを表示します。利用者による修正は現在の計画セッションで優先します。今回は見積もりをTask Markdownへ保存せず、セッションをまたいで修正値を記憶しません。

### 利用可能時間に基づく計画

「2時間使える」のように正味時間が示された場合は、そのまま使います。「13:00〜17:00」のように時刻範囲が示された場合は、その中の固定予定を一度だけ差し引きます。その後、計画用の余白を確保します。初期値は残り時間の20%を1分単位で切り捨てた値で、利用者へ表示し、変更または解除できます。一般人口の平均余暇時間は使いません。

選んだTaskの見積もり上限の合計が、余白を引いた計画可能時間を超えない場合だけ、正式な計画内に含めます。楽観的な下限なら入るTaskは、計画内ではなく「近い候補」として分けて表示します。Task件数は固定しません。

各Taskには、推定であることを明記した所要時間の幅、今選んだ理由、根拠となる日付・優先度・Project・Context、Context判断が推測かどうかを示します。「最初に着手」「次に着手」「短い空き時間向け」のように表示できますが、これらは保存状態ではありません。Manual orderは変更しません。

不確実な見積もりを含む計画も提示できますが、不確実性を見せます。信頼できる計画を作れなければ、精密さを捏造せず、必要最小限の制約を確認します。

Task Pilotは一つの固定順位ではなく、三段階で作業を選びます。

1. **最初に必ず考慮する：** 現在の依頼で明示されたTaskまたは重点を尊重し、次に見逃すと間に合わない明示された本当の締切を守る。
2. **実行可能性を確認する：** 利用可能時間に収まらない作業や、明示された端末・場所・体力条件に反する作業を除外する。本文推測より、明示Context labelとの一致を優先する。
3. **実行可能な候補を比較する：** Scheduledの日付、Priority、重点Project、依存関係、ブロッカー、Contextの根拠、Manual orderをまとめて考慮する。他の根拠で区別できない場合だけ、Manual orderを最後の安定した同順位判定に使う。

第三段階では、一つの情報が常に勝つわけではありません。古いScheduled日付と高優先度のUnplanned Taskが競合したら、Task Pilotはトレードオフと選定理由を示します。安全に選べる根拠がなければ利用者へ確認します。古いという理由だけでTaskを重要とみなしたり、優先度を上げたりしません。

### 空き時間に合うTaskを探す

利用者は時間に加え、必要なら端末、場所、状況、体力を指定できます。Task Pilotは一致するContext labelを優先します。ラベルがないTaskでも、内容から明らかに適していれば候補にできますが、推測であることを示します。

Context labelがないだけでTaskを除外しません。固定3件ではなく、時間内で信頼できる件数を返します。ただし「PC必須」と書かれたTaskに対するphone-only依頼のように、Task本文と明確に矛盾する場合は計画から除外します。今回のイテレーションでは、休憩を自動検出したり利用者へ割り込んだりしません。

### Context labelの語彙

Context labelは、名前が`context/`で始まる通常のユーザー編集可能なLabelです。Taskを実行しやすい状況を表し、Taskの状態でも必須情報でもありません。一つのTaskへ複数付けられます。

Task Pilotは最初から次の語彙を理解します。

| Label | 計画時の意味 |
| --- | --- |
| `context/break` | 短い休憩や小さな空き時間に向く。 |
| `context/phone` | スマートフォンを使う状況に向く。 |
| `context/pc` | パソコンを使う状況に向く。 |
| `context/home` | 自宅にいる状況に向く。 |
| `context/outside` | 外出中の状況に向く。 |
| `context/low-energy` | 集中力や体力が低いときにも向く。 |
| `context/errand` | 買い物、移動、その他の用事とまとめられる。 |

これらをTaskへ黙って付けたり、非表示のシステムレコードとして事前登録したりしません。必要に応じて候補として提示し、利用者の承認後に通常のTaskラベルとして保存します。

Context labelは排他的な必須条件ではなく、「その状況に向く」という肯定的な適合性を表します。複数ラベルは複数の状況に向くことを意味します。たとえば`context/phone`がないことだけでは、スマートフォンで実行できないとは判断しません。

利用者は`context/train`、`context/office`、`context/morning`、`context/weekend`などを追加できます。TaskMateは他のLabelと同じように保存・編集します。利用者が同じContext名を指定した場合、Task Pilotは未知のラベルでも名前を完全一致させて利用できます。類義語や広い意味で解釈するには現在の対話内での説明が必要です。今回はカスタムラベルの意味辞書を別に保存しません。

Context labelの追加、削除、改名は既存の[Labels](labels.md)に従います。Context labelだけで完了状態、日付、優先度、Project、Manual orderは変わりません。

### 安全性の対象契約

- 利用者が該当提案を承認するまで正式Taskを変更しません。
- 同種の低リスク変更は、対象Taskと正確な変更内容が見える場合だけまとめて承認できます。
- 反映前に対象Taskを再確認し、変更されていれば書き込まず再レビューへ戻します。
- Source由来の変更には既存のsnapshotとcoverageの安全策を使います。
- 書き込み後に対象Markdownを再読み込みして検証します。
- 無関係な本文とPropertyを保持します。
- 見直しや計画の副作用でManual orderを変更しません。
- 所要時間は助言用の推定です。今回は実績時間の保存、個人速度の学習、実測値のような表示を行いません。
- 時間ベース計画の承認は読み取り専用で、Task変更案への承認を意味しません。
- Context labelは利用者が管理するLabelです。TaskMateが`context/`名前空間全体を予約したり、手編集を禁止したりしません。

一括変更の一部に失敗した場合は、成功・失敗したTaskを区別し、全体成功と報告しません。再試行時は現在のファイルを再確認し、適用済み変更を重複させません。

### 処理の流れ

1. バックログ見直し、読み取り専用の時間ベース計画、明示依頼されたSource note取り込みを区別し、それぞれの範囲を決める。
2. Source noteが指定された場合は対象となる適格なパスを示し、coverage reviewと承認を完了する。
3. 正式な未完了Taskを読み、変更前に全体を要約する。
4. 不足している計画制約だけを集め、根拠を示した所要時間幅を作る。
5. バックログ見直しが依頼された場合、理由付きの日付、優先度、Context label変更案を作る。
6. 利用者が修正、承認、却下、先送りし、安全な一括判断も行えるようにする。
7. 現在のファイルを再確認し、承認分だけ反映してMarkdownを検証する。
8. 現在の正式Taskから読み取り専用の時間ベース計画を作り、時間計算、理由、見積もり、推測を表示する。

バックログ変更は、型付きChangeSetと変更前後Markdown全文を含む永続化されたレビュー可能な[Task change Proposal](task-change-review/README.md)を使います。時間ベース計画は引き続き対話内だけの読み取り専用です。Source note取り込みは別の永続Proposal sessionを使い続け、正式なTask MarkdownだけをTaskの正本とします。

### 失敗時と制限

- 時間ベース計画に利用可能時間がなければ質問するか、上限なしの計画であることを明示します。
- 見積もりが利用可能時間を超えたらTaskを減らすか、緩める制約を確認し、超過を隠しません。
- 信頼できる見積もりを作れないTaskは要確認として表示に残しますが、時間上限のある計画へ黙って詰め込みません。
- 指定Contextに確実に合うTaskがなければ、その結果を伝え、必要なら近い候補を明確に区別します。
- 提案同士が競合したら解決まで書き込みません。
- 変更済みまたは読めないTaskは変更対象から外して報告します。利用者が部分範囲を確認した後、独立した他の提案は続行できます。
- AI提案の意味的な完全性はファイル検証では証明できないため、利用者レビューを正本とします。

### 受け入れ条件

以下は現在のブランチへ実装済みです。意味上の判断には引き続き利用者レビューが必要で、自動テストは決定的なInterfaceと安全策を検証します。

- PLAN-01：変更前に大量の未完了Taskの内訳を示し、新しいTask状態を作らずに理由付き変更案を出す。
- PLAN-02：「後でやる」の承認で日付を外し、未完了のまま保ち、自動保留ラベルを付けない。
- PLAN-03：2時間の計画で、見える余白と理由を示しながら、推定時間内に収まる可変件数のTaskを選ぶ。
- PLAN-03A：初期余白では2時間のうち96分を計画可能時間として表示し、余白変更時に再計算する。
- PLAN-03B：見積もり上限の合計が計画可能時間を超えず、下限なら入るだけのTaskは別に表示する。
- PLAN-04：30分・phoneの依頼で`context/phone`を優先し、本文から判断した無ラベルTaskは推測と示す。
- PLAN-05：7個の初期Context labelを理解し、ラベル変更を承認対象として提示し、黙って反映しない。
- PLAN-06：利用者作成の`context/train`をTaskMateで編集でき、意味が明らかになれば計画へ利用できる。
- PLAN-07：提案後に変更されたTaskを上書きせず、再レビューへ戻す。
- PLAN-08：Source note候補はcoverage review後に正式Taskとなったものだけを計画へ含める。
- PLAN-09：計画と見直しでManual orderを変えない。
- PLAN-10：対象0件と一部書き込み失敗を正確に報告し、成功を捏造しない。
- PLAN-11：通常の計画依頼ではSource noteを探索・取り込みせず、Source noteを明示依頼した場合は抽出前に対象となる適格なパスを示す。
- PLAN-12：時間ベース計画の承認ではTaskの項目を変更せず、日付、優先度、Context labelの変更には別の承認を必要とする。
- PLAN-13：すべての見積もり幅に根拠種別を表示し、見積もれないTaskを時間上限のある計画へ黙って含めない。
- PLAN-14：50件の見直しでは同じ変更だけを見える形でまとめ、全対象を確認でき、要確認項目は変更しない。
- PLAN-15：将来の作業容量を示す根拠がなければ、古いバックログを片付けるためだけの将来日付や優先度を付けない。
- PLAN-16：候補選択を「最初に必ず考慮・実行可能性・複数情報の比較」の三段階で行い、予定日とPriorityの競合を非表示の固定順位で解決せず、説明または利用者確認へ戻す。

自動根拠は[planning挙動テスト](../../../skills/taskpilot/tests/test_planning_store.py)、[Source-note proposalテスト](../../../skills/taskpilot/tests/test_proposal_store.py)、[Task storeテスト](../../../skills/taskpilot/tests/test_todo_store.py)です。50件のグループ化、変更競合と一部失敗、20%余白、上限による容量判定、Context根拠、読み取り専用計画、見積もり要確認、予定日とPriorityの競合表示を検証します。Agentによる意味上の見積もりや理由の品質は決定的テストだけでは証明できないため、見える利用者レビューを必須とします。

### 今回のイテレーションの対象外

- Active、Pending、Waitingなどの多状態Task管理
- `pending`や`waiting`ラベルの自動付与
- TaskMate専用の状態管理画面
- 別の締切保存項目や日付移行
- カレンダー連携や空き時間の自動検出
- 朝の自動計画や休憩中の自動通知
- 実績時間の保存や完了履歴からの自動学習
- 時間ベース計画、所要時間見積もり、カスタムContext label意味辞書の永続化
- 明示依頼なしで最近編集したSource noteを自動発見・取り込みすること
- レビューなしの完全自動Task変更
- バックログ見直しでの一括統合、分割、改名、完了、削除
- Manual orderの変更
- 第二のデータベースやMarkdown以外の正本

### 保留中の変更

[RFC 0033](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md)は[Issue #62](https://github.com/tempu-village/taskmate/issues/62)で追跡し、計画部分は[Issue #60](https://github.com/tempu-village/taskmate/issues/60)で実装します。合意済みですが未実装です。会話だけの計画出力を、すべての正式な未完了Taskを計画済み・`GAP`・`CONFLICT`のいずれかへ割り当てる1つのObsidian Markdownへ置き換える提案です。推奨ベース案と既存Task根拠ベース案の一方を選び、Codexとの会話で識別番号を使って修正し、明示依頼によって既存のTask変更Proposalを作ります。範囲省略時は全日程、指定時は今日分または指定項目だけが対象です。

計画の作成・選択・修正だけではTaskを変更しません。将来配置には利用者が確認した容量が必要で、提案可能な変更は日付、Context label、Steps、Notesに限定します。実装確認までは、上に記載した現在の会話ベース計画が正本です。

実装の進み具合：Task Pilotは`scripts/rolling_plan.py`で、計画ファイルの作成、ベース案の選択、修正、終了、置き換えができます。保存先は`planFolder`（既定は`TaskMate/Plans`）です。作業中の計画からTask変更Proposalを作る処理は未実装のため、Issue #60は未完了です。

### 関連仕様と機能

- [Task schema](../../../skills/taskpilot/references/task-schema.md)
- [Source-note import](source-import.md)
- [Labels](labels.md)
- [Navigation, filtering and sorting](filtering-and-sorting.md)
- [Task editing](task-editing.md)
- [Storage and privacy](storage-and-privacy.md)
- [Task change review](task-change-review/README.md)
- [RFC 0033: Reviewable rolling plans and Source candidate reviews](../rfcs/0033-add-reviewable-rolling-plans-and-source-candidate-reviews.md)
