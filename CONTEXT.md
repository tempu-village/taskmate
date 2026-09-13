# TaskMate

TaskMate is a local-first task system in which Markdown remains inspectable and portable while Obsidian and agents provide complementary interfaces.

## Language

**Task**:
A single independently completable action stored as one Markdown file.
_Avoid_: Item, card, task note

**Smart view**:
A built-in projection of tasks selected by a fixed date or completion rule.
_Avoid_: Filter, saved search

**Unplanned**:
An incomplete task without a date.
_Avoid_: Inbox, unscheduled bucket

**Source note**:
An ordinary Obsidian note explicitly placed in scope for task extraction by a folder rule or note property.
_Avoid_: AI note, import file

**Coverage review**:
The user confirmation in which every candidate from a source note is accounted for as a new task, a merge, or an explicit exclusion.
_Avoid_: Import preview, AI summary

**Proposal session**:
A staged group of task proposals and possible exclusions derived from one review operation, kept separate from canonical Tasks until the user decides.
_Avoid_: Sandbox, draft import

**Task proposal**:
A non-canonical candidate that may become a new Task or a change to an existing Task after explicit review.
_Avoid_: Draft task, temporary task

**Review decision**:
The user's explicit approval, revision, or exclusion of a task proposal, retained with the proposal after review.
_Avoid_: AI decision, implicit approval

**Manual order**:
One global user-defined task sequence preserved across every smart view.
_Avoid_: View order, local order

**Project**:
A named collection referenced by task ID. It groups tasks but does not own their lifecycle.
_Avoid_: Folder, task container

**Label**:
A user-defined cross-project classification attached directly to a task.
_Avoid_: Tag, category

**Priority**:
An optional urgency rank from 1 through 3, where 1 is highest.
_Avoid_: Important flag, severity
