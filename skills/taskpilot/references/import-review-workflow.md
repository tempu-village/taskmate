# Import review

Stage the coverage review from [import-workflow.md](import-workflow.md) as one Import review. In TaskMate the user can edit each candidate's fields or operation, decide, and formally apply; TaskMate then writes Source-note provenance itself.

## Before generating

1. Resolve the content language with `python3 scripts/todo_store.py --vault <vault> language`. Use `setting` or `desktop` results as reported. When it reports `unknown`, use the language of the selected Sources only when they are clearly all in the same language (`languageSource: "source"`); otherwise ask the user which language to use (`languageSource: "user"`). Never fall back to English silently.
2. Write every generated text in that language: candidate titles, Task titles, Notes, Steps, Source summaries, merge reasons and exclusion reasons. Keep statements, file names, code and proper nouns exactly as they appear in the Source.

The helper refuses to stage, and writes nothing, unless the vault's installed TaskMate (`.obsidian/plugins/taskmate/manifest.json`) is at least the version it requires and the plugin Obsidian has loaded recorded the same version and support for the current review format in its settings. When it refuses, tell the user the message as is: update TaskMate, reload it in Obsidian, and run the import again. Do not edit the review JSON by hand to work around it.

## Stage a review

Discover eligible notes and select Sources exactly as in [import-workflow.md](import-workflow.md). A bounded conversation excerpt may also be a Source when the user explicitly selects it; never collect conversations automatically.

For every Source, list its complete statement inventory: every statement that could be an action, copied exactly from the note body or the selected conversation snapshot. Then map every statement to exactly one candidate:

- `create` with a complete `taskDraft` (`title`, `date`, `priority`, `labels`, `project`, `steps`, `notes`);
- `merge` with `mergeTarget.taskId`, the Task `snapshot` from `planning_store.py inspect`, the changed fields under `changes`, and a `reason` (optionally per-field `reasons`);
- `exclude` with an `exclusionReason`.

Every candidate also needs `sourceSummaries`: exactly one entry per Source it references, each a one-to-three-sentence `summary` (at most 1000 characters) of only the statements that candidate maps from that Source. Do not summarize the whole note or add facts the statements do not contain; the review shows the summary first and the exact statements on request.

```json
{
  "contentLanguage": "en",
  "languageSource": "setting",
  "sources": [
    {"type": "note", "path": "Notes/sync.md", "statements": ["Send the revised contract to Sato today.", "The next meeting may be Friday afternoon."]},
    {"type": "conversation", "localSourceId": "conversation-20261018-01", "snapshot": "Please also prepare the release checklist.", "selectionInstruction": "Include this request in the review.", "threadId": null, "turnRefs": [], "statements": ["Please also prepare the release checklist."]}
  ],
  "candidates": [
    {"operation": "create", "title": "Send the revised contract", "sourceRefs": [{"source": "Notes/sync.md", "statement": "Send the revised contract to Sato today."}],
     "sourceSummaries": [{"source": "Notes/sync.md", "summary": "The revised contract must go to Sato today."}],
     "taskDraft": {"title": "Send the revised contract", "date": "2026-10-18", "priority": 2, "labels": ["context/pc"], "project": null, "steps": [], "notes": ""}},
    {"operation": "exclude", "title": "Meeting time is not a Task", "sourceRefs": [{"source": "Notes/sync.md", "statement": "The next meeting may be Friday afternoon."}],
     "sourceSummaries": [{"source": "Notes/sync.md", "summary": "Friday afternoon is only a possible meeting time."}], "exclusionReason": "Only a proposed time."},
    {"operation": "create", "title": "Prepare the release checklist", "sourceRefs": [{"source": "conversation-20261018-01", "statement": "Please also prepare the release checklist."}],
     "sourceSummaries": [{"source": "conversation-20261018-01", "summary": "The release checklist should be prepared."}],
     "taskDraft": {"title": "Prepare the release checklist", "date": null, "priority": null, "labels": [], "project": null, "steps": [], "notes": ""}}
  ]
}
```

```bash
python3 scripts/import_review.py --vault <vault> stage --request <request.json> --review-id import-review-<id> --open-review
```

The helper writes `<proposalFolder>/<review-id>.json` and nothing else. It refuses to stage when:

- the installed or loaded TaskMate cannot read the review format, as described above;
- `contentLanguage` is not `ja` or `en`, or `languageSource` is not `setting`, `desktop`, `source` or `user`;
- a candidate lacks a summary for a Source it references, summarizes a Source it does not reference or summarizes one twice, or a summary is empty or longer than 1000 characters;

- a note is ineligible, already imported and unchanged, or already in another pending Import review;
- an inventory statement is not found verbatim in its note body or conversation snapshot;
- a statement is unmapped, mapped twice, or not in its Source inventory;
- a merge target is completed, changed since `inspect`, or would not actually change, or a merge names a field other than title, date, priority, labels, project, Steps, or Notes.

It records the note hash used for provenance, the conversation snapshot hash, complete before/after Markdown for merges, and every candidate as pending. Report the review ID, Sources, and candidates. Decisions and formal apply happen only in TaskMate.

The output includes `uri`, the TaskMate-owned `obsidian://taskmate-import-review` link for the review. On macOS, Windows, and Linux, `--open-review` invokes it directly through the operating system, as `propose --open-review` does. The review is already saved before opening, so a launch failure does not fail the command: it sets `opened` to false and reports `openError`. Then give the user the review ID; the review is listed under TaskMate's Open reviews command.
