# Timed and recurring Tasks

## Status

Approval: Accepted — [#34](https://github.com/tempu-village/taskmate/issues/34). Reminders were deferred to [#123](https://github.com/tempu-village/taskmate/issues/123).

Implementation: Implemented. Desktop and mobile device verification is pending.

## Purpose and scope

A Task can have an optional local time and repeat rule, so planned and repeating work keeps its schedule without a hosted service. The time is an approximate guide for the day's work, not an alarm. Reminders, remote push, calendar synchronization and Step schedules are out of scope.

## User-visible behavior

The Task editor shows Time and Repeat after Date and Deadline. Both are disabled until the Task has a Date, and a hint explains why. Repeat combines an interval from 1 to 99 with Does not repeat, day, week, month or year. Saving drops a Time or Repeat without a Date.

Task rows show the time after the date and the repeat rule.

Checking a recurring Task does not complete it. It moves to its next occurrence and stays open.

## Requirements and guarantees

- SCHED-01: A Task without time or repeat is written exactly as before.
- SCHED-02: Time and repeat round-trip through the plugin, direct Markdown editing and Task Pilot. Unreadable values are ignored and preserved as written.
- SCHED-03: Completing a recurring occurrence advances `date` by the interval from the current `date`, clamps month ends, shifts `deadline` by the same number of days, reopens Steps, and keeps every other field, including ID, rank, Project, Labels, Priority, notes and source note. It creates no file.
- SCHED-04: In the plugin, a completion advances the Task only if its stored `date` still equals the date shown, so a repeated request is a no-op.
- SCHED-05: Date sorting puts untimed Tasks before timed Tasks on the same date and orders timed Tasks by time. Manual rank is never rewritten.

## Processing flow

1. Markdown parsing reads `time` and `repeat` through validators; writing omits unset values and keeps unreadable lines.
2. Completion runs inside the repository's atomic file update. If the Task recurs and its date is unchanged since it was read, the next occurrence replaces the schedule fields.

## Internal design

- [schedule.ts](../../../src/tasks/schedule.ts) owns parsing, the repeat grammar, calendar arithmetic and the next occurrence.
- [repository.ts](../../../src/tasks/repository.ts) advances recurring Tasks; [task-modal.ts](../../../src/task-editor/task-modal.ts) edits the fields.
- Task Pilot's [todo_store.py](../../../skills/taskpilot/scripts/todo_store.py) mirrors parsing, validation and the next occurrence.
- Storage format: [Task file format](../specifications/task-file-format.md).

`time` is floating local time in the device's current time zone, with no stored time zone. Date arithmetic is calendar-only and unaffected by daylight saving.

## Failure handling and limitations

- Month-end clamping continues from the clamped day: a Task on 31 January repeats on 28 February, then 28 March.
- Weekday sets such as "every Monday and Wednesday" are not supported.
- Task Pilot's `complete` command advances a recurring Task each time it runs; agents should run it once per occurrence.
- A `reminder` property written by an earlier build is kept as an unknown property and has no effect.

## Acceptance and verification

Automated evidence: [schedule tests](../../../test/tasks/schedule.test.ts) (validation, month-end and leap years, daylight-saving dates in `America/New_York`, recurring completion, Markdown round trip, time ordering), [repository tests](../../../test/tasks/repository-conflicts.test.ts) (advance once), and [Task Pilot store tests](../../../skills/taskpilot/tests/test_todo_store.py) (round trip, clearing, validation, unreadable values, recurring completion).

Manual, pending: set, edit and clear each field with touch and keyboard on desktop and Android or iOS, and complete a recurring Task.

## Related specifications, ADRs, and RFCs

- [Task file format](../specifications/task-file-format.md) and [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md).
- [Navigation, filtering and sorting](filtering-and-sorting.md) and [Task editing](task-editing.md).
- [RFC: Add timed, recurring Tasks](../rfcs/add-timed-recurring-tasks.md) — background and design history.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

タスクに任意の時刻と繰り返しを設定できます。時刻はその日の作業のおおよその目安で、通知ではありません。編集画面では日付と締め切りの後に「時刻」「繰り返し」が並び、日付があるときだけ使えます。繰り返しは1〜99の間隔と日・週・月・年から選びます。一覧の行には時刻と繰り返しを表示します。通知は[#123](https://github.com/tempu-village/taskmate/issues/123)に分けて見送りました。

繰り返しタスクにチェックを入れると、完了せず次の回へ進みます。日付は現在の日付から間隔分進め、月末は短い月の末日に丸め、締め切りも同じ日数だけ動かし、ステップは未完了に戻します。ID、手動順、プロジェクト、ラベル、優先度、メモ、元ノートは保ち、ファイルは作りません。プラグインは表示時と同じ日付のときだけ進めるため、二重の完了は一度だけ反映されます。

日付の並べ替えでは同じ日の時刻なしを先に、時刻ありを時刻順に並べ、手動順は書き換えません。

時刻は端末の現在のタイムゾーンでの時刻として扱います。日付の計算は暦の日数だけで行い、夏時間の影響を受けません。以前のビルドが書いた`reminder`は不明なプロパティとして残し、効果はありません。

自動テストは上記のとおりです。デスクトップとモバイルでの実機確認は未実施です。
