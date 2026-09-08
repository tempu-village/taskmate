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
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)
IMPORT_KEYS = {"taskmate-import-status", "taskmate-imported-at", "taskmate-imported-hash", "taskmate-task-ids"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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
    if value.startswith(('"', '[')):
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


def parse_task(path: Path, vault: Path) -> Optional[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    lines, body = split_document(text)
    props = top_level_properties(lines)
    if props.get("type") != "todo" or not isinstance(props.get("id"), str):
        return None
    heading = next((line[2:].strip() for line in body.splitlines() if line.startswith("# ")), "Untitled task")
    body_lines = body.strip().splitlines()
    notes = "\n".join(line for line in body_lines if not line.startswith("# ")).strip()
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
        "notes": notes,
    }


def quote(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    return json.dumps(str(value), ensure_ascii=False)


def encode_task(task: Dict[str, Any]) -> str:
    keys = ["id", "completed", "date", "priority", "labels", "project", "rank", "created-at", "updated-at", "completed-at", "source-note"]
    frontmatter = ["---", "type: todo"] + [f"{key}: {quote(task.get(key))}" for key in keys] + ["---"]
    notes = str(task.get("notes") or "").strip()
    suffix = f"\n\n{notes}" if notes else ""
    return "\n".join(frontmatter) + f"\n\n# {str(task['title']).strip()}{suffix}\n"


def task_file_name(title: str, identifier: str) -> str:
    readable = re.sub(r"[\\/:*?\"<>|#^\[\]]", "-", title)
    readable = re.sub(r"\s+", " ", readable)
    readable = re.sub(r"-+", "-", readable).strip(". -")[:80].strip() or "task"
    return f"{readable}--{identifier[:8]}.md"


def plugin_settings(vault: Path) -> Dict[str, Any]:
    path = vault / ".obsidian" / "plugins" / "taskmate" / "data.json"
    if not path.exists():
        return {"taskFolder": "TaskMate/Tasks", "projectFolder": "TaskMate/Projects", "sourceFolders": [], "includeSourceSubfolders": True}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        fail(f"cannot read plugin settings: {error}")
    return {
        "taskFolder": loaded.get("taskFolder") or "TaskMate/Tasks",
        "projectFolder": loaded.get("projectFolder") or "TaskMate/Projects",
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


def command_create(args: argparse.Namespace) -> None:
    validate_date(args.date)
    validate_priority(args.priority)
    folder = task_folder(args.vault, args.task_folder)
    tasks = all_tasks(args.vault, args.task_folder)
    identifier = str(uuid.uuid4())
    timestamp = now_iso()
    task = {
        "id": identifier,
        "title": args.title,
        "completed": False,
        "date": args.date,
        "priority": args.priority,
        "labels": normalized_labels(args.label),
        "project": args.project,
        "rank": max((float(task["rank"]) for task in tasks), default=0) + 1024,
        "created-at": timestamp,
        "updated-at": timestamp,
        "completed-at": None,
        "source-note": args.source_note,
        "notes": args.notes or "",
    }
    path = folder / task_file_name(args.title, identifier)
    if path.exists():
        fail(f"task already exists: {identifier}")
    atomic_write(path, encode_task(task))
    result = dict(task)
    result["path"] = path.relative_to(args.vault).as_posix()
    print(json.dumps(result, ensure_ascii=False, indent=2))


def find_task(vault: Path, override: Optional[str], identifier: str) -> Tuple[Path, Dict[str, Any]]:
    matches = [(safe_path(vault, task["path"]), task) for task in all_tasks(vault, override) if task["id"] == identifier]
    if len(matches) != 1:
        fail(f"expected one task with id {identifier}, found {len(matches)}")
    return matches[0]


def command_update(args: argparse.Namespace) -> None:
    path, task = find_task(args.vault, args.task_folder, args.id)
    if args.title is not None:
        task["title"] = args.title
    if args.date is not None:
        task["date"] = None if args.date == "none" else args.date
        validate_date(task["date"])
    if args.priority is not None:
        task["priority"] = None if args.priority == "none" else int(args.priority)
        validate_priority(task["priority"])
    if args.label is not None:
        task["labels"] = normalized_labels(args.label)
    if args.project is not None:
        task["project"] = None if args.project == "none" else args.project
    if args.notes is not None:
        task["notes"] = args.notes
    task["updated-at"] = now_iso()
    atomic_write(path, encode_task(task))
    desired = path.with_name(task_file_name(str(task["title"]), str(task["id"])))
    if desired != path:
        if desired.exists():
            fail(f"task file already exists: {desired.name}")
        path.replace(desired)
        task["path"] = desired.relative_to(args.vault).as_posix()
    print(json.dumps(task, ensure_ascii=False, indent=2))


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


def command_sources(args: argparse.Namespace) -> None:
    settings = plugin_settings(args.vault)
    managed_roots = [
        safe_path(args.vault, str(settings["taskFolder"])),
        safe_path(args.vault, str(settings["projectFolder"])),
    ]
    results: List[Dict[str, Any]] = []
    for path in sorted(args.vault.rglob("*.md")):
        if ".obsidian" in path.parts:
            continue
        if any(path == root or root in path.parents for root in managed_roots):
            continue
        relative = path.relative_to(args.vault)
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
    print(json.dumps(results, ensure_ascii=False, indent=2))


def command_mark_source(args: argparse.Namespace) -> None:
    path = safe_path(args.vault, args.source)
    text = path.read_text(encoding="utf-8")
    digest = source_hash(text)
    lines, body = split_document(text)
    lines = strip_yaml_keys(lines, IMPORT_KEYS)
    lines.extend([
        f"taskmate-import-status: {quote(args.status)}",
        f"taskmate-imported-at: {quote(now_iso())}",
        f"taskmate-imported-hash: {quote(digest)}",
        "taskmate-task-ids:",
        *[f"  - {quote(identifier)}" for identifier in args.task_id],
    ])
    updated = "---\n" + "\n".join(lines) + "\n---\n" + body
    atomic_write(path, updated)
    print(json.dumps({"path": args.source, "status": args.status, "hash": digest, "taskIds": args.task_id}, ensure_ascii=False, indent=2))


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
    create.set_defaults(run=command_create)

    update = commands.add_parser("update")
    update.add_argument("--id", required=True)
    update.add_argument("--title")
    update.add_argument("--date", help="YYYY-MM-DD or none")
    update.add_argument("--priority", choices=("1", "2", "3", "none"))
    update.add_argument("--label", action="append", default=None, help="replace labels; repeat for multiple labels")
    update.add_argument("--project", help="project ID or none")
    update.add_argument("--notes")
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
