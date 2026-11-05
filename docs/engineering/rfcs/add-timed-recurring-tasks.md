---
status: implemented
tracking-issue: 34
current-authority: ../features/timed-and-recurring-tasks.md
related-features:
  - ../features/task-editing.md
  - ../features/filtering-and-sorting.md
---

# RFC: Add timed, recurring Tasks

> Record status: Historical — implemented for [#34](https://github.com/tempu-village/taskmate/issues/34). Desktop and mobile device verification is still pending.
> Current authority: [Timed and recurring Tasks](../features/timed-and-recurring-tasks.md). The proposal below preserves the decision history.
>
> 記録の状態：#34で実装済みです。デスクトップとモバイルの実機確認は未完了です。現在の正本は[Timed and recurring Tasks](../features/timed-and-recurring-tasks.md)で、以下は検討当時の記録として残します。

## Summary

Add two optional Task properties — a local `time` and a `repeat` rule — to the portable Task Markdown, the plugin and Task Pilot. Completing a recurring Task advances the same Task to its next occurrence. Local reminders, also requested in #34, are deferred to [#123](https://github.com/tempu-village/taskmate/issues/123).

## Background / Problem

A Task stores only a calendar `date` (and, since #51, an independent `deadline`). It cannot say "at 09:00", "every two weeks" or "remind me 15 minutes before". Obsidian plugins cannot run in the background, and desktop and mobile hosts differ in notification support, so a reminder design must be honest about delivery.

## Goals

- One readable, unambiguous Markdown representation for each new property that round-trips through the plugin, direct editing and Task Pilot.
- Date-only Tasks stay byte-for-byte unchanged.
- Completing a recurring Task never duplicates it or loses its non-schedule metadata, and a repeated completion request advances it only once.

## Non-goals

- Background or remote push delivery, cross-device deduplication, calendar synchronization, accounts, telemetry.
- Electron, Node or private Obsidian APIs.
- Weekday sets, "last day of month" rules, end dates or occurrence counts.
- Reminders, and recurrence on Steps.

## Alternatives considered

### Create a new Task file for each occurrence

Rejected. It duplicates identity, makes the global manual rank ambiguous, and leaves completed history files that every reader must understand. Advancing the same Task keeps the ID, rank, Project, Labels, Priority, notes and source link without copying them.

### Store a combined ISO date-time or a time zone

Rejected. `date` keeps its existing `YYYY-MM-DD` meaning. A floating local `time` beside it follows the device's current time zone, which is what a person means by "09:00" when travelling. A stored time zone would require conversion rules the portable schema does not need.

### iCalendar RRULE

Rejected for the first version. RRULE is expressive but hard to edit by hand and would need a parser on both sides. A small grammar (`daily`, `weekly`, `monthly`, `yearly`, `every N days|weeks|months|years`) covers the Issue's bounded set and stays readable.

### Include local reminders in this change

Deferred to [#123](https://github.com/tempu-village/taskmate/issues/123). A first implementation in #114 delivered reminders with `Notice` and the browser `Notification` API while Obsidian ran, with per-device delivered state and missed-reminder reporting. It was removed before merge because:

- TaskMate's intended use rarely needs a reminder. The scheduled time is an approximate guide, and working from it is enough to keep to the plan.
- Obsidian delivers reminders only while it runs, and mobile Obsidian has no system notification, so a reminder cannot be relied on to finish work by a fixed time.
- Reminders were the heaviest and least verifiable part of the change.

## Proposed design

### Representation

- `time: "HH:MM"` — 24-hour local wall-clock time. Requires `date`. It is a guide for planning, not an alarm.
- `repeat: "weekly"` or `repeat: "every 2 weeks"` — interval 1–99 of day, week, month or year. Requires `date`. Writers use the canonical spelling (`daily`, `weekly`, `monthly`, `yearly` for interval 1).
- Each property is omitted when unset, so date-only Tasks are unchanged. An unreadable value is ignored for behavior and kept as written; clearing a readable value removes its line.

### Recurrence

The next occurrence adds the interval to the current `date`, not to the completion day. Months and years keep the day of month and clamp to the month's last day. A date on the last day of its month stays on the month end (31 January → 28 February → 31 March), so month-end work such as invoicing does not drift. The maintainer chose this during review over continuing from the clamped day (28 March). Only the current `date` is stored, so a 29th or 30th clamped to 28 February is treated as month-end afterwards. Calendar arithmetic is date-only, so daylight-saving changes do not move dates. When a deadline exists, it moves by the same number of days. Steps are reopened. Completing writes the next occurrence instead of `completed: true`. The plugin only advances when the stored `date` still equals the date the caller saw, so a repeated completion is a no-op.

### Ordering

Date sorting compares `date`, then places untimed Tasks before timed Tasks of the same date, then by `time`. Manual order is unchanged and stays the user's rank.

## Open questions

- Weekday-set recurrence (for example Monday and Wednesday) is deferred to [#125](https://github.com/tempu-village/taskmate/issues/125).
- Should a recurring Task record its last completion time?

## Decision / status

Implemented in the pull request linked below. The maintainer delegated the open design choices to the implementation; they are listed in the pull request for review. During review the maintainer removed reminders from the change and recorded them in #123.

## Links

- Tracking Issue: [#34](https://github.com/tempu-village/taskmate/issues/34)
- Current feature: [Timed and recurring Tasks](../features/timed-and-recurring-tasks.md)
- Current specification: [Task file format](../specifications/task-file-format.md), [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md)
- Current design: [Architecture](../design/architecture.md)
- ADRs: None
- Implementation pull request: [#114](https://github.com/tempu-village/taskmate/pull/114)
- Release: None
- Verification evidence: [schedule tests](../../../test/tasks/schedule.test.ts), [repository tests](../../../test/tasks/repository-conflicts.test.ts), [Task Pilot store tests](../../../skills/taskpilot/tests/test_todo_store.py); device verification pending

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

タスクに任意の`time`（端末のローカル時刻`HH:MM`）と`repeat`（`daily`〜`yearly`または`every N days|weeks|months|years`、Nは1〜99）を追加します。時刻は計画の目安で、通知ではありません。未設定の項目は書かないため、日付だけのタスクは変わりません。読めない値は動作に使わず、書かれたまま残します。

繰り返しタスクを完了すると、同じタスクを次の回へ進めます。次の日付は完了した日ではなく現在の`date`から計算し、月末の日付は次も月末にし（1月31日→2月28日→3月31日）、それ以外の日は短い月の末日に丸めます。締め切りも同じ日数だけ動かし、ステップは未完了に戻します。プラグインは呼び出し側が見た日付と保存済みの日付が一致するときだけ進めるため、二重に完了しても一度しか進みません。

日付の並べ替えでは、同じ日の中で時刻なしのタスクを先に、時刻ありのタスクを時刻順に並べます。手動順は変えません。

通知（リマインダー）は#114で一度実装しましたが、マージ前に外して[#123](https://github.com/tempu-village/taskmate/issues/123)に分けました。今回の用途では通知が必要な場面が少なく、予定時刻を目安にすれば十分に予定どおり作業できること、Obsidianが動いている間しか届かずモバイルではシステム通知もないため頼りにできないこと、変更の中で最も重く確認しにくい部分だったことが理由です。

却下した案は、回ごとに新しいファイルを作る方式、日時とタイムゾーンを一緒に保存する方式、iCalendar RRULEです。
