# ADR 0029: Label the Scheduled and Deadline fields and collapse Deadline until added

Status: Accepted

## Context

Since #51 the Task editor has two date inputs: the scheduled date and the hard deadline. [ADR 0020](0020-use-icon-led-compact-task-editor-fields.md) relies on distinct leading icons instead of text labels, but two calendar icons are not distinguishable at a glance, and the scheduled field was named "Date" although a deadline is also a date. Only the scheduled date had one-tap suggestions, which made the two rows look inconsistent. Most Tasks have no deadline, and phone screens have little vertical space.

## Decision

- Both date inputs keep a small persistent in-field label, "Scheduled" and "Deadline", as ADR 0020 already does for Project and Priority whose values alone are ambiguous. The scheduled field is named "Scheduled" instead of "Date".
- The Deadline row shows only an "Add deadline" button while the Task has no deadline. Choosing it reveals the labeled date input and a "Remove deadline" button, which clears the value and collapses the row.
- Deadline has no one-tap suggestions; the scheduled-date suggestions of [ADR 0008](0008-suggest-common-task-inputs.md) are unchanged.

## Considered options

- Labels only, with Deadline always visible, was rejected because it keeps an empty row on every Task and the suggestion asymmetry remains visible.
- Adding the same suggestions to Deadline was rejected because it adds a row to every Task on phones, and Today or Tomorrow are rarely the right deadline.

## Consequences

- A Task without a deadline uses one short row instead of a full date input.
- A deadline needs one extra tap to start; editing an existing deadline does not.
- Bulk editing and the conflict dialog also show "Scheduled", because they share the label.

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

2つの日付欄に「予定日」「締め切り」の名札を欄内に常時表示し、予定日欄の名前を「日付」から「予定日」に変えます。締め切りがないタスクでは「締め切りを追加」ボタンだけを表示し、押すと名札付きの日付欄と「締め切りを外す」ボタンを出します。締め切りには日付候補ボタンを付けません。名札だけの案は空の行と非対称が残るため、締め切りにも候補を付ける案はスマホで全タスクの行が増え、今日や明日が締め切りとして適切な場面も少ないため採りませんでした。
