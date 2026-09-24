#!/usr/bin/env python3
"""Deterministic file operations for the TaskMate Markdown store."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import tempfile
import unicodedata
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)
IMPORT_KEYS = {"taskmate-import-status", "taskmate-imported-at", "taskmate-imported-hash", "taskmate-task-ids"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
STEP_LINE_RE = re.compile(r"^- \[([ xX])\](?: (.*))?$")
DUE_SUFFIX_RE = re.compile(r"^(.*?)(?:\s+<!-- due: (\d{4}-\d{2}-\d{2}) -->)\s*$")


def fail(message: str) -> None:
    raise SystemExit(message)


def safe_path(vault: Path, relative: str) -> Path:
    root = vault.resolve()
    target = (root / relative).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        fail(f"path escapes vault: {relative}")
    return target


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent), text=True)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def parse_scalar(raw: str) -> Any:
    value = raw.strip()
    if not value or value == "null":
        return None
    if value in ("true", "false"):
        return value == "true"
    if re.fullmatch(r"-?\d+(?:\.\d+)?", value):
        return float(value) if "." in value else int(value)
    if value.startswith(('"', '[', '{')):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass
    return value


def split_document(text: str) -> Tuple[List[str], str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return [], text
    return match.group(1).splitlines(), text[match.end():]


def top_level_properties(lines: Iterable[str]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for line in lines:
        if line.startswith((" ", "\t", "-")) or ":" not in line:
            continue
        key, raw = line.split(":", 1)
        result[key.strip()] = parse_scalar(raw)
    return result


def yaml_list(lines: List[str], key: str) -> List[str]:
    result: List[str] = []
    collecting = False
    for line in lines:
        if line and not line.startswith((" ", "\t", "-")) and ":" in line:
            collecting = line.split(":", 1)[0].strip() == key
            continue
        if collecting and line.lstrip().startswith("-"):
            value = parse_scalar(line.lstrip()[1:])
            if isinstance(value, str):
                result.append(value)
        elif collecting and line.strip():
            break
    return result


def is_calendar_date(value: str) -> bool:
    if not DATE_RE.fullmatch(value): return False
    try: dt.date.fromisoformat(value)
    except ValueError: return False
    return True


def split_step_deadline(raw_text: str) -> Tuple[str, Optional[str]]:
    text, date = raw_text, None
    while True:
        due = DUE_SUFFIX_RE.fullmatch(text)
        if not due or not is_calendar_date(due.group(2)) or not due.group(1).strip(): break
        if date is None: date = due.group(2)
        text = due.group(1).rstrip()
    return text, date


def normalized_steps(values: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    steps = []
    for raw in values:
        if not isinstance(raw, dict): fail("each step must be an object")
        text, text_date = split_step_deadline(re.sub(r"\r?\n", " ", str(raw.get("text") or "")).strip())
        if not text: continue
        date = raw.get("date") if raw.get("date") is not None else text_date
        if date is not None and (not isinstance(date, str) or not is_calendar_date(date)): fail("step date must be a calendar-valid YYYY-MM-DD or null")
        completed = raw.get("completed", False)
        if not isinstance(completed, bool): fail("step completed must be true or false")
        steps.append({"text": text, "completed": completed, "date": date})
    return steps


def parse_steps_json(raw: str) -> List[Dict[str, Any]]:
    try: value = json.loads(raw)
    except json.JSONDecodeError as error: raise argparse.ArgumentTypeError(f"invalid Steps JSON: {error}") from error
    if not isinstance(value, list): raise argparse.ArgumentTypeError("Steps JSON must be an array")
    return normalized_steps(value)


def parse_task_body(body: str) -> Tuple[List[Dict[str, Any]], str, str]:
    lines = body.strip().splitlines()
    steps_heading = next((i for i, line in enumerate(lines) if line.strip() == "## Steps"), -1)
    if steps_heading < 0: return [], body.strip(), ""
    notes_heading = next((i for i, line in enumerate(lines) if i > steps_heading and line.strip() == "## Notes"), -1)
    section_end = notes_heading if notes_heading >= 0 else next((i for i, line in enumerate(lines) if i > steps_heading and line.startswith("## ")), len(lines))
    steps, remainder = [], []
    for line in lines[steps_heading + 1:section_end]:
        checkbox = STEP_LINE_RE.fullmatch(line)
        raw_text = (checkbox.group(2) or "").strip() if checkbox else ""
        if not checkbox or not raw_text: remainder.append(line); continue
        text, date = split_step_deadline(raw_text)
        steps.append({"text": text, "completed": checkbox.group(1).lower() == "x", "date": date})
    before = "\n".join(lines[:steps_heading]).strip()
    after = "\n".join(lines[notes_heading + 1:]).strip() if notes_heading >= 0 else ""
    return steps, "\n\n".join(v for v in (before, after) if v), "\n".join(remainder).strip()


def encode_task_body(steps: Iterable[Dict[str, Any]], notes: str, remainder: str = "") -> str:
    normalized, extra, clean_notes = normalized_steps(steps), remainder.strip(), notes.strip()
    if not normalized and not extra: return clean_notes
    lines = [f"- [{'x' if step['completed'] else ' '}] {step['text']}" + (f" <!-- due: {step['date']} -->" if step["date"] else "") for step in normalized]
    section = "\n".join(["## Steps", "", *lines, *(["", extra] if extra else [])]).rstrip()
    return f"{section}\n\n## Notes\n\n{clean_notes}" if clean_notes else section


def parse_task(path: Path, vault: Path) -> Optional[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    lines, body = split_document(text)
    props = top_level_properties(lines)
    if props.get("type") != "todo" or not isinstance(props.get("id"), str):
        return None
    heading = next((line[2:].strip() for line in body.splitlines() if line.startswith("# ")), "Untitled task")
    body_lines = body.strip().splitlines()
    body_without_title = "\n".join(line for line in body_lines if not line.startswith("# ")).strip()
    steps, notes, step_remainder = parse_task_body(body_without_title)
    raw_priority = props.get("priority")
    priority = raw_priority if raw_priority in (1, 2, 3) else (1 if props.get("important") is True else None)
    labels = props.get("labels")
    return {
        "path": path.relative_to(vault).as_posix(),
        "id": props["id"],
        "title": heading,
        "completed": props.get("completed") is True,
        "date": props.get("date") if isinstance(props.get("date"), str) else None,
        "priority": priority,
        "labels": [label for label in labels if isinstance(label, str)] if isinstance(labels, list) else [],
        "project": props.get("project") if isinstance(props.get("project"), str) else None,
        "rank": props.get("rank") if isinstance(props.get("rank"), (int, float)) else 0,
        "created-at": props.get("created-at") or "",
        "updated-at": props.get("updated-at") or "",
        "completed-at": props.get("completed-at"),
        "source-note": props.get("source-note"),
        "steps": steps,
        "step-section-remainder": step_remainder,
        "notes": notes,
    }


def quote(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return json.dumps(str(value), ensure_ascii=False)


def encode_task(task: Dict[str, Any]) -> str:
    keys = ["id", "completed", "date", "priority", "labels", "project", "rank", "created-at", "updated-at", "completed-at", "source-note"]
    frontmatter = ["---", "type: todo"] + [f"{key}: {quote(task.get(key))}" for key in keys] + ["---"]
    body = encode_task_body(task.get("steps") or [], str(task.get("notes") or ""), str(task.get("step-section-remainder") or ""))
    suffix = f"\n\n{body}" if body else ""
    return "\n".join(frontmatter) + f"\n\n# {str(task['title']).strip()}{suffix}\n"


def readable_task_file_stem(title: str) -> str:
    readable = re.sub(r"[\\/:*?\"<>|#^\[\]]", "-", unicodedata.normalize("NFKC", title))
    readable = re.sub(r"\s+", " ", readable)
    readable = re.sub(r"-+", "-", readable).strip(". -")[:80].strip() or "task"
    return readable


def task_file_name(title: str, duplicate_number: int = 1) -> str:
    suffix = f" ({duplicate_number})" if duplicate_number > 1 else ""
    return f"{readable_task_file_stem(title)}{suffix}.md"


def available_task_path(folder: Path, title: str, current: Optional[Path] = None) -> Path:
    occupied = {
        path.name.casefold()
        for path in folder.glob("*.md")
        if current is None or path != current
    }
    duplicate_number = 1
    while True:
        candidate = folder / task_file_name(title, duplicate_number)
        if candidate.name.casefold() not in occupied:
            return candidate
        duplicate_number += 1


def plugin_settings(vault: Path) -> Dict[str, Any]:
    path = vault / ".obsidian" / "plugins" / "taskmate" / "data.json"
    if not path.exists():
        return {"taskFolder": "TaskMate/Tasks", "projectFolder": "TaskMate/Projects", "proposalFolder": "TaskMate/Proposals", "sourceFolders": [], "includeSourceSubfolders": True}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        fail(f"cannot read plugin settings: {error}")
    return {
        "taskFolder": loaded.get("taskFolder") or "TaskMate/Tasks",
        "projectFolder": loaded.get("projectFolder") or "TaskMate/Projects",
        "proposalFolder": loaded.get("proposalFolder") or "TaskMate/Proposals",
        "sourceFolders": loaded.get("sourceFolders") or [],
        "includeSourceSubfolders": loaded.get("includeSourceSubfolders", True),
    }


def task_folder(vault: Path, override: Optional[str]) -> Path:
    relative = override or str(plugin_settings(vault)["taskFolder"])
    return safe_path(vault, relative)


def all_tasks(vault: Path, override: Optional[str]) -> List[Dict[str, Any]]:
    folder = task_folder(vault, override)
    if not folder.exists():
        return []
    tasks = [task for path in sorted(folder.glob("*.md")) if (task := parse_task(path, vault)) is not None]
    return tasks


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def validate_date(value: Optional[str]) -> None:
    if value is not None and not DATE_RE.fullmatch(value):
        fail("date must be YYYY-MM-DD")


def validate_priority(value: Optional[int]) -> None:
    if value is not None and value not in (1, 2, 3):
        fail("priority must be 1, 2, 3, or none")


def normalized_labels(values: Iterable[str]) -> List[str]:
    labels: List[str] = []
    for raw in values:
        label = raw.strip()
        if label and label not in labels:
            labels.append(label)
    if len(labels) > 500:
        fail("a task cannot contain more than 500 labels")
    return labels


def command_list(args: argparse.Namespace) -> None:
    print(json.dumps(all_tasks(args.vault, args.task_folder), ensure_ascii=False, indent=2))


def create_task(vault: Path, override: Optional[str], draft: Dict[str, Any]) -> Dict[str, Any]:
    title = str(draft.get("title") or "").strip()
    if not title:
        fail("title is required")
    date = draft.get("date")
    priority = draft.get("priority")
    validate_date(date)
    validate_priority(priority)
    folder = task_folder(vault, override)
    tasks = all_tasks(vault, override)
    identifier = str(uuid.uuid4())
    timestamp = now_iso()
    task = {
        "id": identifier,
        "title": title,
        "completed": False,
        "date": date,
        "priority": priority,
        "labels": normalized_labels(draft.get("labels") or []),
        "project": draft.get("project"),
        "rank": max((float(task["rank"]) for task in tasks), default=0) + 1024,
        "created-at": timestamp,
        "updated-at": timestamp,
        "completed-at": None,
        "source-note": draft.get("source-note"),
        "steps": normalized_steps(draft.get("steps") or []),
        "step-section-remainder": "",
        "notes": draft.get("notes") or "",
    }
    path = available_task_path(folder, title)
    atomic_write(path, encode_task(task))
    result = dict(task)
    result["path"] = path.relative_to(vault).as_posix()
    return result


def command_create(args: argparse.Namespace) -> None:
    result = create_task(args.vault, args.task_folder, {
        "title": args.title, "date": args.date, "priority": args.priority,
        "labels": args.label, "project": args.project,
        "source-note": args.source_note, "steps": args.steps_json or [], "notes": args.notes,
    })
    print(json.dumps(result, ensure_ascii=False, indent=2))


def find_task(vault: Path, override: Optional[str], identifier: str) -> Tuple[Path, Dict[str, Any]]:
    matches = [(safe_path(vault, task["path"]), task) for task in all_tasks(vault, override) if task["id"] == identifier]
    if len(matches) != 1:
        fail(f"expected one task with id {identifier}, found {len(matches)}")
    return matches[0]


def update_task(vault: Path, override: Optional[str], identifier: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    path, task = find_task(vault, override, identifier)
    for key in ("title", "date", "priority", "project", "notes"):
        if key in patch:
            task[key] = patch[key]
    if "labels" in patch:
        task["labels"] = normalized_labels(patch["labels"] or [])
    if "steps" in patch: task["steps"] = normalized_steps(patch["steps"] or [])
    if not str(task["title"]).strip():
        fail("title is required")
    validate_date(task["date"])
    validate_priority(task["priority"])
    task["updated-at"] = now_iso()
    atomic_write(path, encode_task(task))
    desired = available_task_path(path.parent, str(task["title"]), path)
    if desired != path:
        path.replace(desired)
        task["path"] = desired.relative_to(vault).as_posix()
    return task


def command_update(args: argparse.Namespace) -> None:
    patch: Dict[str, Any] = {}
    if args.title is not None:
        patch["title"] = args.title
    if args.date is not None:
        patch["date"] = None if args.date == "none" else args.date
    if args.priority is not None:
        patch["priority"] = None if args.priority == "none" else int(args.priority)
    if args.label is not None:
        patch["labels"] = args.label
    if args.project is not None:
        patch["project"] = None if args.project == "none" else args.project
    if args.notes is not None:
        patch["notes"] = args.notes
    if args.steps_json is not None: patch["steps"] = args.steps_json
    print(json.dumps(update_task(args.vault, args.task_folder, args.id, patch), ensure_ascii=False, indent=2))


def command_complete(args: argparse.Namespace) -> None:
    path, task = find_task(args.vault, args.task_folder, args.id)
    completed = not args.reopen
    task["completed"] = completed
    task["completed-at"] = now_iso() if completed else None
    task["updated-at"] = now_iso()
    atomic_write(path, encode_task(task))
    print(json.dumps(task, ensure_ascii=False, indent=2))


def strip_yaml_keys(lines: List[str], keys: set) -> List[str]:
    output: List[str] = []
    skipping = False
    for line in lines:
        if line and not line.startswith((" ", "\t", "-")) and ":" in line:
            key = line.split(":", 1)[0].strip()
            skipping = key in keys
            if skipping:
                continue
        if skipping and line.startswith((" ", "\t", "-")):
            continue
        skipping = False
        output.append(line)
    return output


def source_hash(text: str) -> str:
    lines, body = split_document(text)
    stable_lines = strip_yaml_keys(lines, IMPORT_KEYS)
    stable = ("---\n" + "\n".join(stable_lines) + "\n---\n" + body) if stable_lines else body
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()


def frontmatter_boolean(text: str, key: str) -> Optional[bool]:
    lines, _ = split_document(text)
    value = top_level_properties(lines).get(key)
    return value if isinstance(value, bool) else None


def included_by_folder(relative: Path, folders: List[str], include_subfolders: bool) -> bool:
    parent = relative.parent.as_posix()
    for raw in folders:
        folder = raw.strip().strip("/")
        if parent == folder or (include_subfolders and parent.startswith(f"{folder}/")):
            return True
    return False


def source_records(vault: Path) -> List[Dict[str, Any]]:
    settings = plugin_settings(vault)
    managed_roots = [
        safe_path(vault, str(settings["taskFolder"])),
        safe_path(vault, str(settings["projectFolder"])),
        safe_path(vault, str(settings["proposalFolder"])),
    ]
    results: List[Dict[str, Any]] = []
    for path in sorted(vault.rglob("*.md")):
        if ".obsidian" in path.parts:
            continue
        if any(path == root or root in path.parents for root in managed_roots):
            continue
        relative = path.relative_to(vault)
        text = path.read_text(encoding="utf-8")
        explicit = frontmatter_boolean(text, "taskmate-source")
        inherited = included_by_folder(relative, list(settings["sourceFolders"]), bool(settings["includeSourceSubfolders"]))
        eligible = explicit is True or (explicit is not False and inherited)
        if not eligible:
            continue
        lines, _ = split_document(text)
        props = top_level_properties(lines)
        current_hash = source_hash(text)
        imported_hash = props.get("taskmate-imported-hash")
        state = "processed" if imported_hash == current_hash else ("changed" if imported_hash else "pending")
        results.append({"path": relative.as_posix(), "state": state, "hash": current_hash, "taskIds": yaml_list(lines, "taskmate-task-ids")})
    return results


def command_sources(args: argparse.Namespace) -> None:
    print(json.dumps(source_records(args.vault), ensure_ascii=False, indent=2))


def mark_source(vault: Path, source: str, status: str, task_ids: List[str]) -> Dict[str, Any]:
    path = safe_path(vault, source)
    text = path.read_text(encoding="utf-8")
    digest = source_hash(text)
    lines, body = split_document(text)
    lines = strip_yaml_keys(lines, IMPORT_KEYS)
    lines.extend([
        f"taskmate-import-status: {quote(status)}",
        f"taskmate-imported-at: {quote(now_iso())}",
        f"taskmate-imported-hash: {quote(digest)}",
        "taskmate-task-ids:",
        *[f"  - {quote(identifier)}" for identifier in task_ids],
    ])
    updated = "---\n" + "\n".join(lines) + "\n---\n" + body
    atomic_write(path, updated)
    return {"path": source, "status": status, "hash": digest, "taskIds": task_ids}


def command_mark_source(args: argparse.Namespace) -> None:
    print(json.dumps(mark_source(args.vault, args.source, args.status, args.task_id), ensure_ascii=False, indent=2))


def command_validate(args: argparse.Namespace) -> None:
    folder = task_folder(args.vault, args.task_folder)
    errors: List[str] = []
    seen: Dict[str, str] = {}
    if folder.exists():
        for path in sorted(folder.glob("*.md")):
            task = parse_task(path, args.vault)
            if task is None:
                errors.append(f"{path.name}: not a canonical task")
                continue
            identifier = str(task["id"])
            if identifier in seen:
                errors.append(f"duplicate id {identifier}: {seen[identifier]} and {path.name}")
            seen[identifier] = path.name
            if not str(task["title"]).strip():
                errors.append(f"{path.name}: empty title")
            validate_date(task["date"])
            validate_priority(task["priority"])
            if not isinstance(task["labels"], list) or any(not isinstance(label, str) for label in task["labels"]):
                errors.append(f"{path.name}: labels must be a string array")
    result = {"valid": not errors, "tasks": len(seen), "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--vault", required=True, type=lambda value: Path(value).resolve())
    result.add_argument("--task-folder")
    commands = result.add_subparsers(dest="command", required=True)

    list_command = commands.add_parser("list")
    list_command.set_defaults(run=command_list)

    create = commands.add_parser("create")
    create.add_argument("--title", required=True)
    create.add_argument("--date")
    create.add_argument("--priority", type=int, choices=(1, 2, 3))
    create.add_argument("--label", action="append", default=[])
    create.add_argument("--project")
    create.add_argument("--notes")
    create.add_argument("--source-note")
    create.add_argument("--steps-json", type=parse_steps_json)
    create.set_defaults(run=command_create)

    update = commands.add_parser("update")
    update.add_argument("--id", required=True)
    update.add_argument("--title")
    update.add_argument("--date", help="YYYY-MM-DD or none")
    update.add_argument("--priority", choices=("1", "2", "3", "none"))
    update.add_argument("--label", action="append", default=None, help="replace labels; repeat for multiple labels")
    update.add_argument("--project", help="project ID or none")
    update.add_argument("--notes")
    update.add_argument("--steps-json", type=parse_steps_json)
    update.set_defaults(run=command_update)

    complete = commands.add_parser("complete")
    complete.add_argument("--id", required=True)
    complete.add_argument("--reopen", action="store_true")
    complete.set_defaults(run=command_complete)

    sources = commands.add_parser("sources")
    sources.set_defaults(run=command_sources)

    mark_source = commands.add_parser("mark-source")
    mark_source.add_argument("--source", required=True)
    mark_source.add_argument("--status", default="processed", choices=("processed", "needs-review"))
    mark_source.add_argument("--task-id", action="append", default=[])
    mark_source.set_defaults(run=command_mark_source)

    validate = commands.add_parser("validate")
    validate.set_defaults(run=command_validate)
    return result


def main() -> None:
    args = parser().parse_args()
    if not args.vault.is_dir():
        fail(f"vault does not exist: {args.vault}")
    args.run(args)


if __name__ == "__main__":
    main()
