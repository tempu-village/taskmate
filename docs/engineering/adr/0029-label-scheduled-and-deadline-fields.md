# ADR 0029: Label the Scheduled and Deadline fields and keep Deadline without suggestions

Status: Accepted

## Context

Since #51 the Task editor has two date inputs: the scheduled date and the hard deadline. [ADR 0020](0020-use-icon-led-compact-task-editor-fields.md) relies on distinct leading icons instead of text labels, but two calendar icons were not distinguishable at a glance, and the scheduled field was named "Date" although a deadline is also a date. Only the scheduled date has one-tap suggestions, which makes the two rows look inconsistent.

## Decision

- Both date inputs are full-width bordered fields with a small persistent label, "Scheduled" or "Deadline", and a calendar marker centered under it; the date value sits to the right. This follows ADR 0020, which already keeps in-field labels for Project and Priority whose values alone are ambiguous. The scheduled field is named "Scheduled" instead of "Date".
- The native picker indicator is hidden; tapping or clicking anywhere in the field opens the date picker.
- The Deadline row uses its own leading icon, a calendar with a target, instead of a second calendar variant.
- The Deadline field is always shown. Collapsing it behind an "Add deadline" button saved only one row while adding a step and a hidden state.
- Deadline has no one-tap suggestions. A deadline is almost always a specific date fixed from outside, such as a submission or payment date. Today or Tomorrow are rarely chosen, so the user ends up choosing from the calendar anyway. The scheduled-date suggestions of [ADR 0008](0008-suggest-common-task-inputs.md) are unchanged.
- A clear button appears inside the Deadline field only while it has a value.

## Considered options

- Labels above the leading icons were rejected because the icon column is too narrow for the labels and would differ from every other row.
- Adding the scheduled-date suggestions to Deadline was rejected for the reason above and because it adds a row to every Task on phones.
- Collapsing Deadline until added was tried during review and rejected as described above.

## Consequences

- The scheduled date and the deadline are distinguishable by label and by leading icon.
- Bulk editing and the conflict dialog also show "Scheduled", because they share the label.
- Desktop users open the picker by clicking the field rather than a separate indicator.

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

予定日と締め切りの日付欄は、全幅の枠の中に「予定日」「締め切り」の名札と、その真下中央のカレンダーの目印を置き、日付はその右に表示します。予定日欄の名前を「日付」から「予定日」に変えます。ブラウザ標準のカレンダーボタンは隠し、欄のどこを押しても日付の選択画面を開きます。締め切りの行の先頭には、カレンダーに的を組み合わせた独自のアイコンを使います。締め切り欄は常に表示し、値があるときだけ欄の中に×を出します。

締め切りには日付候補ボタンを付けません。締め切りは提出日や支払日のように外から決まった特定の日を入れることがほとんどで、「今日」「明日」を選ぶ場面はあまりなく、結局カレンダーで選ぶことになるためです。締め切りをたたむ案は、縮むのが1行だけで手間と隠れた状態が増えるため採りませんでした。
