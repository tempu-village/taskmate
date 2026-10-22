# Source candidate review in TaskMate

This workflow is the TaskMate-native alternative to the staged `Active/<session>/Review.md` import described in [import-workflow.md](import-workflow.md) and [proposal-workflow.md](proposal-workflow.md), and will replace it ([#62](https://github.com/tempu-village/taskmate/issues/62)). Use it when the user asks to review the candidates in TaskMate; otherwise keep using the staged import workflow. In TaskMate the user can edit each candidate's fields or operation, decide, and formally apply; TaskMate then writes Source-note provenance itself.

## Stage a review

Discover eligible notes and select Sources exactly as in [import-workflow.md](import-workflow.md). A bounded conversation excerpt may also be a Source when the user explicitly selects it; never collect conversations automatically.

For every Source, list its complete statement inventory: every statement that could be an action, copied exactly from the note body or the selected conversation snapshot. Then map every statement to exactly one candidate:

- `create` with a complete `taskDraft` (`title`, `date`, `priority`, `labels`, `project`, `steps`, `notes`);
- `merge` with `mergeTarget.taskId`, the Task `snapshot` from `planning_store.py inspect`, the changed fields under `changes`, and a `reason` (optionally per-field `reasons`);
- `exclude` with an `exclusionReason`.

```json
{
  "sources": [
    {"type": "note", "path": "Notes/sync.md", "statements": ["Send the revised contract to Sato today.", "The next meeting may be Friday afternoon."]},
    {"type": "conversation", "localSourceId": "conversation-20261018-01", "snapshot": "Please also prepare the release checklist.", "selectionInstruction": "Include this request in the review.", "threadId": null, "turnRefs": [], "statements": ["Please also prepare the release checklist."]}
  ],
  "candidates": [
    {"operation": "create", "title": "Send the revised contract", "sourceRefs": [{"source": "Notes/sync.md", "statement": "Send the revised contract to Sato today."}],
     "taskDraft": {"title": "Send the revised contract", "date": "2026-10-18", "priority": 2, "labels": ["context/pc"], "project": null, "steps": [], "notes": ""}},
    {"operation": "exclude", "title": "Meeting time is not a Task", "sourceRefs": [{"source": "Notes/sync.md", "statement": "The next meeting may be Friday afternoon."}], "exclusionReason": "Only a proposed time."},
    {"operation": "create", "title": "Prepare the release checklist", "sourceRefs": [{"source": "conversation-20261018-01", "statement": "Please also prepare the release checklist."}],
     "taskDraft": {"title": "Prepare the release checklist", "date": null, "priority": null, "labels": [], "project": null, "steps": [], "notes": ""}}
  ]
}
```

```bash
python3 scripts/source_review.py --vault <vault> stage --request <request.json> --review-id source-review-<id> --open-review
```

The helper writes `<proposalFolder>/<review-id>.json` and nothing else. It refuses to stage when:

- a note is ineligible, already imported and unchanged, or already in another pending Source candidate review;
- an inventory statement is not found verbatim in its note body or conversation snapshot;
- a statement is unmapped, mapped twice, or not in its Source inventory;
- a merge target is completed, changed since `inspect`, or would not actually change, or a merge names a field other than title, date, priority, labels, project, Steps, or Notes.

It records the note hash used for provenance, the conversation snapshot hash, complete before/after Markdown for merges, and every candidate as pending. Report the review ID, Sources, and candidates. Decisions and formal apply happen only in TaskMate.

The output includes `uri`, the TaskMate-owned `obsidian://taskmate-source-review` link for the review. On macOS, Windows, and Linux, `--open-review` invokes it directly through the operating system, as `propose --open-review` does. The review is already saved before opening, so a launch failure does not fail the command: it sets `opened` to false and reports `openError`. Then give the user the review ID; the review is listed under TaskMate's Open Source candidate reviews command.
