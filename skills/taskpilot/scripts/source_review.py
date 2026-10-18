#!/usr/bin/env python3
"""Stage Source candidate Proposal JSON for TaskMate's Source candidate review.

Staging writes one versioned JSON review and never creates, changes, or
deletes canonical Tasks, Source notes, candidate Markdown, or Review.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import planning_store
import todo_store
from planning_store import fail


SCHEMA_VERSION = 1
REVIEW_ID_RE = re.compile(r"source-review-[A-Za-z0-9._-]+")
MERGE_FIELDS = ("title", "date", "priority", "labels", "project", "steps", "notes")


def validated_review_id(value: str) -> str:
    if not REVIEW_ID_RE.fullmatch(value):
        fail("review-id must start with source-review- and contain only safe identifier characters")
    return value


def text_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def required_text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"{name} is required")
    return value.strip()


def statements_of(raw: Dict[str, Any], name: str) -> List[str]:
    statements = raw.get("statements")
    if not isinstance(statements, list) or not statements:
        fail(f"{name} requires a non-empty statements inventory")
    result: List[str] = []
    for statement in statements:
        text = required_text(statement, f"{name} statement")
        if text in result:
            fail(f"{name} lists a statement twice: {text}")
        result.append(text)
    return result


def pending_review_paths(vault: Path) -> Dict[str, str]:
    folder = todo_store.safe_path(vault, str(todo_store.plugin_settings(vault)["proposalFolder"]))
    claimed: Dict[str, str] = {}
    for path in sorted(folder.glob("source-review-*.json")) if folder.exists() else []:
        try:
            review = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if review.get("reviewType") != "source-candidate" or review.get("status") == "history":
            continue
        for source in review.get("sources") or []:
            if isinstance(source, dict) and source.get("type") == "note":
                claimed[str(source.get("path"))] = str(review.get("reviewId"))
    return claimed


def validated_sources(vault: Path, raw_sources: Any, captured_at: str) -> Tuple[List[Dict[str, Any]], Dict[str, str], Dict[str, List[str]], Dict[str, str]]:
    if not isinstance(raw_sources, list) or not raw_sources:
        fail("request.sources must be a non-empty array")
    eligible = {record["path"]: record for record in todo_store.source_records(vault)}
    claimed = pending_review_paths(vault)
    sources, keys, inventories, texts = [], {}, {}, {}
    for index, raw in enumerate(raw_sources, 1):
        if not isinstance(raw, dict):
            fail("each Source must be an object")
        source_id = f"SRC-{index:02d}"
        if raw.get("type") == "note":
            path = required_text(raw.get("path"), "note Source path")
            record = eligible.get(path)
            if record is None:
                fail(f"note is not eligible under TaskMate Source settings: {path}")
            if record["state"] == "processed":
                fail(f"note was already imported and has not changed: {path}")
            if path in claimed:
                fail(f"note is already in pending Source candidate review {claimed[path]}: {path}")
            text = todo_store.safe_path(vault, path).read_text(encoding="utf-8")
            _, body = todo_store.split_document(text)
            key, searchable = path, body
            sources.append({"id": source_id, "type": "note", "path": path, "sha256": todo_store.source_hash(text), "capturedAt": captured_at})
        elif raw.get("type") == "conversation":
            key = required_text(raw.get("localSourceId"), "conversation localSourceId")
            snapshot = raw.get("snapshot")
            if not isinstance(snapshot, str) or not snapshot.strip():
                fail(f"conversation Source {key} requires the exact selected snapshot")
            turn_refs = raw.get("turnRefs") or []
            if not isinstance(turn_refs, list) or any(not isinstance(ref, str) or not ref for ref in turn_refs) or len(set(turn_refs)) != len(turn_refs):
                fail(f"conversation Source {key} turnRefs must be unique non-empty strings")
            thread_id = raw.get("threadId")
            if thread_id is not None and not isinstance(thread_id, str):
                fail(f"conversation Source {key} threadId must be a string or null")
            searchable = snapshot
            sources.append({
                "id": source_id, "type": "conversation", "localSourceId": key, "threadId": thread_id, "turnRefs": turn_refs,
                "snapshot": snapshot, "sha256": text_sha256(snapshot), "capturedAt": captured_at,
                "selectionInstruction": required_text(raw.get("selectionInstruction"), f"conversation Source {key} selectionInstruction"),
            })
        else:
            fail("Source type must be note or conversation")
        if key in keys:
            fail(f"Source is listed twice: {key}")
        statements = statements_of(raw, f"Source {key}")
        missing = next((statement for statement in statements if statement not in searchable), None)
        if missing is not None:
            fail(f"statement was not found in Source {key}: {missing}")
        keys[key] = source_id
        inventories[source_id] = statements
        texts[source_id] = key
    return sources, keys, inventories, texts


def validated_refs(raw: Dict[str, Any], keys: Dict[str, str], inventories: Dict[str, List[str]]) -> List[Dict[str, str]]:
    refs = raw.get("sourceRefs")
    if not isinstance(refs, list) or not refs:
        fail("each candidate requires sourceRefs")
    result = []
    for ref in refs:
        if not isinstance(ref, dict):
            fail("each sourceRef must be an object")
        key = ref.get("source")
        if key not in keys:
            fail(f"sourceRef names an unknown Source: {key}")
        statement = required_text(ref.get("statement"), "sourceRef statement")
        if statement not in inventories[keys[key]]:
            fail(f"sourceRef statement is not in the Source inventory of {key}: {statement}")
        result.append({"sourceId": keys[key], "statement": statement})
    return result


def validated_task_draft(raw: Any, name: str) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        fail(f"{name} requires a taskDraft object")
    unexpected = set(raw) - set(MERGE_FIELDS)
    if unexpected:
        fail(f"{name} taskDraft has unsupported fields: {', '.join(sorted(unexpected))}")
    date, priority = raw.get("date"), raw.get("priority")
    todo_store.validate_date(date)
    todo_store.validate_priority(priority)
    labels = raw.get("labels") or []
    if not isinstance(labels, list) or any(not isinstance(label, str) for label in labels):
        fail(f"{name} labels must be strings")
    project = raw.get("project")
    if project is not None and not isinstance(project, str):
        fail(f"{name} project must be a string or null")
    notes = raw.get("notes", "")
    if not isinstance(notes, str):
        fail(f"{name} notes must be a string")
    return {
        "title": required_text(raw.get("title"), f"{name} title"), "date": date, "priority": priority,
        "labels": todo_store.normalized_labels(labels), "project": project,
        "steps": todo_store.normalized_steps(raw.get("steps") or []), "notes": notes,
    }


def merge_target(vault: Path, override: Optional[str], raw: Any, name: str, now: str) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        fail(f"{name} requires a mergeTarget object")
    task_id = required_text(raw.get("taskId"), f"{name} mergeTarget.taskId")
    path, task = todo_store.find_task(vault, override, task_id)
    if task["completed"]:
        fail(f"{name} cannot merge into a completed Task: {task_id}")
    if raw.get("snapshot") != planning_store.task_snapshot(vault, task):
        fail(f"Task changed after inspection: {task_id}")
    values = raw.get("changes")
    if not isinstance(values, dict) or not values:
        fail(f"{name} mergeTarget.changes must name the changed fields")
    unexpected = set(values) - set(MERGE_FIELDS)
    if unexpected:
        fail(f"{name} merge cannot change: {', '.join(sorted(unexpected))}")
    reason = required_text(raw.get("reason"), f"{name} mergeTarget.reason")
    reasons = raw.get("reasons") or {}
    if not isinstance(reasons, dict):
        fail(f"{name} mergeTarget.reasons must map fields to reasons")
    draft = validated_task_draft({**{field: task[field] for field in MERGE_FIELDS}, **values}, name)
    before_markdown = path.read_text(encoding="utf-8")
    after_task = json.loads(json.dumps(task, ensure_ascii=False))
    changes = []
    for field in MERGE_FIELDS:
        if field in values and draft[field] != task[field]:
            changes.append({"field": field, "before": task[field], "after": draft[field], "reason": str(reasons.get(field) or reason)})
            after_task[field] = draft[field]
    if not changes:
        fail(f"{name} merge does not change Task {task_id}")
    after_task["updated-at"] = now
    return {
        "taskId": task_id, "path": task["path"], "title": task["title"],
        "beforeMarkdown": before_markdown,
        "afterMarkdown": todo_store.encode_task_preserving_properties(after_task, before_markdown),
        "beforeSha256": text_sha256(before_markdown), "changes": changes,
    }


def staged_candidates(args: argparse.Namespace, raw_candidates: Any, keys: Dict[str, str], inventories: Dict[str, List[str]], now: str) -> List[Dict[str, Any]]:
    if not isinstance(raw_candidates, list) or not raw_candidates:
        fail("request.candidates must be a non-empty array")
    candidates = []
    for index, raw in enumerate(raw_candidates, 1):
        if not isinstance(raw, dict):
            fail("each candidate must be an object")
        candidate_id = f"SC-{index:02d}"
        operation = raw.get("operation")
        if operation not in ("create", "merge", "exclude"):
            fail(f"{candidate_id} operation must be create, merge, or exclude")
        candidate: Dict[str, Any] = {
            "id": candidate_id, "revision": 1, "originalOperation": operation, "operation": operation,
            "title": required_text(raw.get("title"), f"{candidate_id} title"),
            "sourceRefs": validated_refs(raw, keys, inventories),
        }
        if operation == "create":
            candidate["taskDraft"] = validated_task_draft(raw.get("taskDraft"), candidate_id)
        elif operation == "merge":
            candidate["mergeTarget"] = merge_target(args.vault, args.task_folder, raw.get("mergeTarget"), candidate_id, now)
        else:
            candidate["exclusionReason"] = required_text(raw.get("exclusionReason"), f"{candidate_id} exclusionReason")
        candidate.update({
            "decision": "pending", "decisionRevision": None, "decidedAt": None, "diffViewedRevision": None,
            "health": "ok", "healthReason": None,
            "application": {"status": "not-applied", "appliedAt": None, "promotedTaskId": None, "error": None},
        })
        candidates.append(candidate)
    return candidates


def check_coverage(candidates: List[Dict[str, Any]], inventories: Dict[str, List[str]], names: Dict[str, str]) -> None:
    owners: Dict[Tuple[str, str], str] = {}
    for candidate in candidates:
        for ref in candidate["sourceRefs"]:
            key = (ref["sourceId"], ref["statement"])
            if key in owners:
                fail(f"statement is mapped by both {owners[key]} and {candidate['id']}: {ref['statement']}")
            owners[key] = candidate["id"]
    for source_id, statements in inventories.items():
        missing = next((statement for statement in statements if (source_id, statement) not in owners), None)
        if missing is not None:
            fail(f"statement from Source {names[source_id]} is not mapped by any candidate: {missing}")


def command_stage(args: argparse.Namespace) -> None:
    request = planning_store.read_json(args.request)
    folder = todo_store.safe_path(args.vault, str(todo_store.plugin_settings(args.vault)["proposalFolder"]))
    destination = folder / f"{args.review_id}.json"
    if destination.exists() or (folder / "History" / f"{args.review_id}.json").exists():
        fail(f"Source candidate review already exists: {args.review_id}")
    now = todo_store.now_iso()
    sources, keys, inventories, names = validated_sources(args.vault, request.get("sources"), now)
    candidates = staged_candidates(args, request.get("candidates"), keys, inventories, now)
    check_coverage(candidates, inventories, names)
    review = {
        "schemaVersion": SCHEMA_VERSION, "reviewId": args.review_id, "reviewType": "source-candidate",
        "status": "pending", "health": "ok", "revision": 1, "createdAt": now, "updatedAt": now, "archivedAt": None,
        "sources": sources, "candidates": candidates,
    }
    todo_store.atomic_write(destination, json.dumps(review, ensure_ascii=False, indent=2) + "\n")
    uri = "obsidian://taskmate-source-review?" + urllib.parse.urlencode({"vault": args.vault.name, "review": args.review_id})
    opened, open_error = False, None
    if args.open_review:
        try:
            planning_store.open_review_uri(uri)
            opened = True
        except SystemExit as error:
            open_error = str(error)
    print(json.dumps({
        "reviewId": args.review_id, "path": destination.relative_to(args.vault).as_posix(), "status": "pending",
        "uri": uri, "opened": opened, "openError": open_error,
        "sources": [{"id": source["id"], "type": source["type"], "name": names[source["id"]]} for source in sources],
        "candidates": [{"id": candidate["id"], "operation": candidate["operation"], "title": candidate["title"]} for candidate in candidates],
    }, ensure_ascii=False, indent=2))


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--vault", required=True, type=lambda value: Path(value).resolve())
    result.add_argument("--task-folder")
    commands = result.add_subparsers(dest="command", required=True)
    stage = commands.add_parser("stage")
    stage.add_argument("--request", required=True, type=Path)
    stage.add_argument("--review-id", required=True, type=validated_review_id)
    stage.add_argument("--open-review", action="store_true")
    stage.set_defaults(run=command_stage)
    return result


def main() -> None:
    args = parser().parse_args()
    if not args.vault.is_dir():
        fail(f"vault does not exist: {args.vault}")
    args.run(args)


if __name__ == "__main__":
    main()
