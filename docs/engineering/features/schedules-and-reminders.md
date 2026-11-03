# Schedules and reminders

## Status

Approval: Accepted — [#34](https://github.com/tempu-village/taskmate/issues/34).

Implementation: Implemented. Desktop and mobile device verification is pending.

## Purpose and scope

A Task can have an optional local time, repeat rule and reminder, so time-sensitive and repeating work is remembered without a hosted service. Delivery happens only while Obsidian runs on that device. Remote push, calendar synchronization, cross-device deduplication and Step reminders are out of scope.

## User-visible behavior

The Task editor shows Time, Repeat and Reminder after Date and Deadline. Time and Repeat are disabled until the Task has a Date; Reminder is disabled until it has a Date and a Time, and a hint explains why. Repeat combines an interval from 1 to 99 with Does not repeat, day, week, month or year. Reminder offers No reminder, At the time, 5, 15 and 30 minutes, 1 hour and 1 day before. Saving drops a Time or Repeat without a Date and a Reminder without a Time.

Task rows show the time after the date, the repeat rule, and a Reminder marker when one is set.

Checking a recurring Task does not complete it. It moves to its next occurrence and stays open.

While Obsidian is open, a due reminder shows a Notice that stays until dismissed. With **System notifications** enabled in Settings and permission granted, TaskMate also shows a system notification. Reminders that came due while TaskMate was not running are summarized in one Notice the next time it runs.

## Requirements and guarantees

- SCHED-01: A Task without time, repeat or reminder is written exactly as before.
- SCHED-02: Time, repeat and reminder round-trip through the plugin, direct Markdown editing and Task Pilot. Unreadable values are ignored and preserved as written.
- SCHED-03: Completing a recurring occurrence advances `date` by the interval from the current `date`, clamps month ends, shifts `deadline` by the same number of days, reopens Steps, and keeps every other field, including ID, rank, Project, Labels, Priority, notes and source note. It creates no file.
- SCHED-04: In the plugin, a completion advances the Task only if its stored `date` still equals the date shown, so a repeated request is a no-op.
- SCHED-05: Date sorting puts untimed Tasks before timed Tasks on the same date and orders timed Tasks by time. Manual rank is never rewritten.
- SCHED-06: A reminder is delivered at most once per device for a given Task, date, time and offset. Changing any of them makes a new reminder.
- SCHED-07: A reminder that came due while TaskMate was not running is reported as missed once. A reminder whose moment had already passed when the Task was last saved is not reported.
- SCHED-08: TaskMate never claims background delivery or sound. System notifications are offered only where the platform provides them and permission is granted.

## Processing flow

1. Markdown parsing reads `time`, `repeat` and `reminder` through validators; writing omits unset values and keeps unreadable lines.
2. Completion runs inside the repository's atomic file update. If the Task recurs and its date is unchanged since it was read, the next occurrence replaces the schedule fields.
3. The reminder notifier evaluates all Tasks on layout ready, every 30 seconds, when the document becomes visible, and after a Task file changes. It records delivered keys before presenting anything.

## Internal design

- [schedule.ts](../../../src/tasks/schedule.ts) owns parsing, the repeat grammar, calendar arithmetic, the next occurrence, and reminder instants and keys.
- [reminders.ts](../../../src/tasks/reminders.ts) is the pure reminder evaluator: due within two minutes, older is missed, delivered keys pruned after 45 days.
- [reminder-notifier.ts](../../../src/reminders/reminder-notifier.ts) is the Obsidian adapter: interval, visibility handling, per-device `App.saveLocalStorage`, `Notice` and `Notification`.
- [repository.ts](../../../src/tasks/repository.ts) advances recurring Tasks; [task-modal.ts](../../../src/task-editor/task-modal.ts) edits the fields.
- Task Pilot's [todo_store.py](../../../skills/taskpilot/scripts/todo_store.py) mirrors parsing, validation and the next occurrence.
- Storage format: [Task file format](../specifications/task-file-format.md).

`time` is floating local time evaluated in the device's current time zone. A skipped local time fires at the next valid instant; a repeated local time fires at its first instance. Date arithmetic is calendar-only and unaffected by daylight saving.

## Failure handling and limitations

- No delivery while Obsidian is closed, suspended or in the background on mobile. Obsidian mobile does not provide system notifications; reminders appear inside Obsidian only.
- Each device delivers its own reminders, so a user may see the same reminder on two devices.
- A denied permission disables the Settings toggle and explains how to change it.
- Month-end clamping continues from the clamped day: a Task on 31 January repeats on 28 February, then 28 March.
- Task Pilot's `complete` command advances a recurring Task each time it runs; agents should run it once per occurrence.

## Acceptance and verification

Automated evidence: [schedule tests](../../../test/tasks/schedule.test.ts) (validation, month-end and leap years, daylight-saving cases in `America/New_York`, recurring completion, Markdown round trip, time ordering), [reminder tests](../../../test/tasks/reminders.test.ts) (due, missed, single delivery, completed, edited, retention), [repository tests](../../../test/tasks/repository-conflicts.test.ts) (advance once), and [Task Pilot store tests](../../../skills/taskpilot/tests/test_todo_store.py) (round trip, clearing, validation, unreadable values, recurring completion).

Manual, pending: set, edit and clear each field with touch and keyboard on desktop and Android or iOS; permission granted, denied and unavailable; restart and suspend/resume with a reminder becoming due while inactive.

## Related specifications, ADRs, and RFCs

- [Task file format](../specifications/task-file-format.md) and [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md).
- [Navigation, filtering and sorting](filtering-and-sorting.md) and [Task editing](task-editing.md).
- [RFC: Add timed, recurring Task schedules and local reminders](../rfcs/add-timed-recurring-tasks-and-local-reminders.md) — background and design history.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

タスクに任意の時刻、繰り返し、通知を設定できます。編集画面では日付と締め切りの後に「時刻」「繰り返し」「通知」が並び、時刻と繰り返しは日付があるとき、通知は日付と時刻があるときだけ使えます。繰り返しは1〜99の間隔と日・週・月・年、通知は予定時刻、5・15・30分前、1時間前、1日前から選びます。一覧の行には時刻、繰り返し、通知ありの印を表示します。

繰り返しタスクにチェックを入れると、完了せず次の回へ進みます。日付は現在の日付から間隔分進め、月末は短い月の末日に丸め、締め切りも同じ日数だけ動かし、ステップは未完了に戻します。ID、手動順、プロジェクト、ラベル、優先度、メモ、元ノートは保ち、ファイルは作りません。プラグインは表示時と同じ日付のときだけ進めるため、二重の完了は一度だけ反映されます。

日付の並べ替えでは同じ日の時刻なしを先に、時刻ありを時刻順に並べ、手動順は書き換えません。

通知はObsidianを開いている間だけ判定し、閉じるまで残るNoticeで知らせます。設定の「システム通知」を有効にして許可されていれば、システム通知も表示します。動いていない間に過ぎた通知は、次に動いたときにまとめて表示します。同じ通知は端末ごとに一度だけ届け、記録は同期しない端末ごとの保存領域に置きます。バックグラウンドでの配信や音は保証しません。Obsidianモバイルではシステム通知を使えず、Obsidian内にだけ表示します。端末ごとに届けるため、複数の端末で同じ通知を見ることがあります。

時刻は端末の現在のタイムゾーンでの時刻として扱います。存在しない時刻は次の有効な時刻に、重複する時刻は最初の時刻に通知します。日付の計算は暦の日数だけで行い、夏時間の影響を受けません。

自動テストは上記のとおりです。デスクトップとモバイルでの実機確認は未実施です。
