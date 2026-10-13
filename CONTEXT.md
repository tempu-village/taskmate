# TaskMate

TaskMate is a local-first task system in which Markdown remains inspectable and portable while Obsidian and agents provide complementary interfaces.

## Language

**Task Pilot**:
The optional portable agent skill that helps turn explicitly selected Source notes into reviewable Task proposals and manages TaskMate task Markdown. Its installable identifier and directory name are `taskpilot`.
_Avoid_: Agent Skill, TaskMate Skill

**Task**:
A single independently completable action stored as one Markdown file.
_Avoid_: Item, card, task note

**Step**:
A lightweight, optionally dated checklist entry inside one Task. It supports the parent outcome but has no independent identity or lifecycle.
_Avoid_: Subtask, child Task, checklist Task

**Smart view**:
A built-in projection of tasks selected by a fixed date or completion rule.
_Avoid_: Filter, saved search

**Scheduled**:
An incomplete task with a date. The Scheduled smart view groups these tasks into Overdue, Today, and Later.
_Avoid_: Upcoming, future tasks

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

**ChangeSet**:
An ordered set of typed instructions for changing fields of existing canonical Tasks. It expresses intended mutations but contains neither approval nor authoritative diff hunks.
_Avoid_: Diff, approval record, Proposal

**Task change Proposal**:
A persisted, non-canonical review envelope containing a ChangeSet, complete before/after Markdown evidence, review decisions, and apply results. It never replaces canonical Task Markdown. This is distinct from a Source-note Proposal session.
_Avoid_: ChangeSet, Task database, draft Task

**Manual order**:
One global user-defined task sequence preserved across every smart view.
_Avoid_: View order, local order

**Project**:
A named collection referenced by task ID. It groups tasks but does not own their lifecycle.
_Avoid_: Folder, task container

**Label**:
A user-defined cross-project classification attached directly to a task.
_Avoid_: Tag, category

**Context label**:
A user-editable Label under the `context/` prefix that describes circumstances in which a Task is practical to perform. It is not a Task status or required metadata.
_Avoid_: Context status, system label

**Capacity plan**:
A Task Pilot suggestion sized to the user's stated available time and circumstances. It does not define a fixed Task count or rewrite Manual order.
_Avoid_: Top three, daily status

**Effort estimate**:
A session-only range of active work time used to build a Capacity plan. It excludes elapsed waiting time and is neither a deadline nor a persisted actual duration.
_Avoid_: Time record, due time

**Priority**:
An optional urgency rank from 1 through 3, where 1 is highest.
_Avoid_: Important flag, severity
