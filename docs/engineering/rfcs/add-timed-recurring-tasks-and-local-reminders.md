---
status: implemented
tracking-issue: 34
current-authority: ../features/schedules-and-reminders.md
related-features:
  - ../features/task-editing.md
  - ../features/filtering-and-sorting.md
---

# RFC: Add timed, recurring Task schedules and local reminders

> Record status: Historical — implemented for [#34](https://github.com/tempu-village/taskmate/issues/34). Desktop and mobile device verification is still pending.
> Current authority: [Schedules and reminders](../features/schedules-and-reminders.md). The proposal below preserves the decision history.
>
> 記録の状態：#34で実装済みです。デスクトップとモバイルの実機確認は未完了です。現在の正本は[Schedules and reminders](../features/schedules-and-reminders.md)で、以下は検討当時の記録として残します。

## Summary

Add three optional Task properties — a local `time`, a `repeat` rule and a `reminder` offset — to the portable Task Markdown, the plugin and Task Pilot. Completing a recurring Task advances the same Task to its next occurrence. Reminders are evaluated on each device while Obsidian runs and use only `Notice` and, where granted, the browser `Notification` API.

## Background / Problem

A Task stores only a calendar `date` (and, since #51, an independent `deadline`). It cannot say "at 09:00", "every two weeks" or "remind me 15 minutes before". Obsidian plugins cannot run in the background, and desktop and mobile hosts differ in notification support, so a reminder design must be honest about delivery.

## Goals

- One readable, unambiguous Markdown representation for each new property that round-trips through the plugin, direct editing and Task Pilot.
- Date-only Tasks stay byte-for-byte unchanged.
- Completing a recurring Task never duplicates it or loses its non-schedule metadata, and a repeated completion request advances it only once.
- Reminders never promise background delivery; missed reminders are shown when TaskMate runs again.

## Non-goals

- Background or remote push delivery, cross-device deduplication, calendar synchronization, accounts, telemetry.
- Electron, Node or private Obsidian APIs.
- Weekday sets, "last day of month" rules, end dates or occurrence counts.
- Recurrence or reminders on Steps.

## Alternatives considered

### Create a new Task file for each occurrence

Rejected. It duplicates identity, makes the global manual rank ambiguous, and leaves completed history files that every reader must understand. Advancing the same Task keeps the ID, rank, Project, Labels, Priority, notes and source link without copying them.

### Store a combined ISO date-time or a time zone

Rejected. `date` keeps its existing `YYYY-MM-DD` meaning. A floating local `time` beside it follows the device's current time zone, which is what a person means by "09:00" when travelling. A stored time zone would require conversion rules the portable schema does not need.

### iCalendar RRULE

Rejected for the first version. RRULE is expressive but hard to edit by hand and would need a parser on both sides. A small grammar (`daily`, `weekly`, `monthly`, `yearly`, `every N days|weeks|months|years`) covers the Issue's bounded set and stays readable.

### Arbitrary reminder offsets or absolute reminder times

Rejected. A fixed list (at the time, 5, 15, 30 and 60 minutes, and 1 day before) is consistent across platforms and simple to choose on touch devices.

### Synchronized delivery state

Rejected. Recording delivered reminders in the Vault would synchronize across devices and could hide a reminder on the device the user is holding. The record is kept per device with `App.saveLocalStorage`.

## Proposed design

### Representation

- `time: "HH:MM"` — 24-hour local wall-clock time. Requires `date`.
- `repeat: "weekly"` or `repeat: "every 2 weeks"` — interval 1–99 of day, week, month or year. Requires `date`. Writers use the canonical spelling (`daily`, `weekly`, `monthly`, `yearly` for interval 1).
- `reminder: 15` — minutes before the scheduled time, one of 0, 5, 15, 30, 60, 1440. Requires `date` and `time`.
- Each property is omitted when unset, so date-only Tasks are unchanged. An unreadable value is ignored for behavior and kept as written; clearing a readable value removes its line.

### Recurrence

The next occurrence adds the interval to the current `date`, not to the completion day. Months and years keep the day of month and clamp to the month's last day (31 January → 28 February); later occurrences continue from the clamped day. Calendar arithmetic is date-only, so daylight-saving changes do not move dates. When a deadline exists, it moves by the same number of days. Steps are reopened. Completing writes the next occurrence instead of `completed: true`. The plugin only advances when the stored `date` still equals the date the caller saw, so a repeated completion is a no-op.

### Ordering

Date sorting compares `date`, then places untimed Tasks before timed Tasks of the same date, then by `time`. Manual order is unchanged and stays the user's rank.

### Reminders

On layout ready, every 30 seconds, when the document becomes visible and after a Task file changes, TaskMate evaluates reminders locally. A reminder whose moment passed less than two minutes ago is due: TaskMate shows a persistent `Notice` and, if the user enabled system notifications and permission is granted, a `Notification`. Older reminders were missed and are summarized in one `Notice`. A reminder whose moment had already passed when the Task was last saved is not reported. Delivered reminders are keyed by Task ID, date, time and offset in per-device local storage and pruned after 45 days. A skipped local time (spring forward) fires at the next valid instant; a repeated local time fires at its first instance.

Sound is whatever the operating system does for the notification; TaskMate does not play audio and says so in Settings.

## Open questions

- Should weekday-set recurrence (for example Monday, Wednesday, Friday) be added later?
- Should a recurring Task record its last completion time?

## Decision / status

Implemented in the pull request linked below. The maintainer delegated the open design choices to the implementation; they are listed in the pull request for review.

## Links

- Tracking Issue: [#34](https://github.com/tempu-village/taskmate/issues/34)
- Current feature: [Schedules and reminders](../features/schedules-and-reminders.md)
- Current specification: [Task file format](../specifications/task-file-format.md), [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md)
- Current design: [Architecture](../design/architecture.md)
- ADRs: None
- Implementation pull request: pending
- Release: None
- Verification evidence: [schedule tests](../../../test/tasks/schedule.test.ts), [reminder tests](../../../test/tasks/reminders.test.ts), [repository tests](../../../test/tasks/repository-conflicts.test.ts), [Task Pilot store tests](../../../skills/taskpilot/tests/test_todo_store.py); device verification pending

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

タスクに任意の`time`（端末のローカル時刻`HH:MM`）、`repeat`（`daily`〜`yearly`または`every N days|weeks|months|years`、Nは1〜99）、`reminder`（予定時刻の0・5・15・30・60・1440分前）を追加します。未設定の項目は書かないため、日付だけのタスクは変わりません。読めない値は動作に使わず、書かれたまま残します。

繰り返しタスクを完了すると、同じタスクを次の回へ進めます。次の日付は完了した日ではなく現在の`date`から計算し、月末は短い月の末日に丸めます。締め切りも同じ日数だけ動かし、ステップは未完了に戻します。プラグインは呼び出し側が見た日付と保存済みの日付が一致するときだけ進めるため、二重に完了しても一度しか進みません。

日付の並べ替えでは、同じ日の中で時刻なしのタスクを先に、時刻ありのタスクを時刻順に並べます。手動順は変えません。

通知はObsidianが動いている間だけ各端末で判定し、`Notice`と、許可された場合のシステム通知だけを使います。動いていない間に過ぎた通知は、次に動いたときにまとめて「逃した通知」として表示します。届けた通知の記録は同期しない端末ごとの保存領域に置きます。音はOSの通知設定に従い、TaskMateは音を保証しません。

却下した案は、回ごとに新しいファイルを作る方式、日時とタイムゾーンを一緒に保存する方式、iCalendar RRULE、任意の通知時刻、Vaultに同期される配信記録です。
