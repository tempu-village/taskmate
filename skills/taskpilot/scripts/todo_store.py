#!/usr/bin/env python3
"""Deterministic file operations for the TaskMate Markdown store."""

from __future__ import annotations

import argparse
import calendar
import datetime as dt
import hashlib
import json
import os
import re
import tempfile
import unicodedata
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union


FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", re.DOTALL)
IMPORT_KEYS = {"taskmate-import-status", "taskmate-imported-at", "taskmate-imported-hash", "taskmate-task-ids"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
STEP_LINE_RE = re.compile(r"^- \[([ xX])\](?: (.*))?$")
DUE_SUFFIX_RE = re.compile(r"^(.*?)(?:\s+<!-- due: (\d{4}-\d{2}-\d{2}) -->)\s*$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
REPEAT_RE = re.compile(r"^every ([1-9]\d?) (day|week|month|year)s?$")
REPEAT_ALIASES = {"daily": (1, "day"), "weekly": (1, "week"), "monthly": (1, "month"), "yearly": (1, "year")}
# A monthly rule may record the day it repeats on ("on day 30") or the month end ("on last day").
MONTH_DAY_RE = re.compile(r"^(.*) on (?:day ([1-9]|[12]\d|3[01])|(last) day)$")
# (interval, unit, month day): the month day is None, a day of month, or "last".
RepeatRule = Tuple[int, str, Union[int, str, None]]
# Optional schedule properties: omitted when unset, kept as written when unreadable.
SCHEDULE_KEYS = ("time", "repeat")


def parse_time(value: Any) -> Optional[str]:
    return value if isinstance(value, str) and TIME_RE.fullmatch(value) else None


def parse_repeat(value: Any) -> Optional[RepeatRule]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    month_day = MONTH_DAY_RE.fullmatch(normalized)
    if month_day:
        normalized = month_day.group(1)
    if normalized in REPEAT_ALIASES:
        interval, unit = REPEAT_ALIASES[normalized]
    else:
        match = REPEAT_RE.fullmatch(normalized)
        if not match:
            return None
        interval, unit = int(match.group(1)), match.group(2)
    if not month_day:
        return (interval, unit, None)
    if unit != "month":
        return None
    return (interval, unit, "last" if month_day.group(3) else int(month_day.group(2)))


def format_repeat(rule: Optional[RepeatRule]) -> Optional[str]:
    if rule is None:
        return None
    interval, unit, month_day = rule
    base = {"day": "daily", "week": "weekly", "month": "monthly", "year": "yearly"}[unit] if interval == 1 else f"every {interval} {unit}s"
    if unit != "month" or month_day is None:
        return base
    return f"{base} on {'last day' if month_day == 'last' else f'day {month_day}'}"


def anchor_repeat(rule: Optional[RepeatRule], date: Any) -> Optional[RepeatRule]:
    """Records the day a monthly rule repeats on, taken from the scheduled date when the rule has none."""
    if rule is None or rule[1] != "month" or rule[2] is not None or not isinstance(date, str) or not is_calendar_date(date):
        return rule
    return (rule[0], rule[1], int(date[8:10]))


SCHEDULE_PARSERS = {"time": parse_time, "repeat": parse_repeat}


def add_repeat(date: str, rule: RepeatRule) -> str:
    interval, unit, month_day = rule
    current = dt.date.fromisoformat(date)
    if unit in ("day", "week"):
        return (current + dt.timedelta(days=interval * (7 if unit == "week" else 1))).isoformat()
    months = interval * (12 if unit == "year" else 1)
    index = current.year * 12 + current.month - 1 + months
    year, month = divmod(index, 12)
    month += 1
    last_day = calendar.monthrange(year, month)[1]
    # The rule's day wins over the current date's, so a 30th clamped to 28 February returns to the 30th.
    day = last_day if month_day == "last" else min(month_day if isinstance(month_day, int) else current.day, last_day)
    return dt.date(year, month, day).isoformat()


def next_occurrence(task: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fields that replace a completed occurrence of a recurring task, or None when it does not recur."""
    rule = parse_repeat(task.get("repeat"))
    if rule is None or not isinstance(task.get("date"), str) or not is_calendar_date(task["date"]):
        return None
    date = add_repeat(task["date"], rule)
    deadline = task.get("deadline")
    if isinstance(deadline, str) and is_calendar_date(deadline):
        shift = dt.date.fromisoformat(date) - dt.date.fromisoformat(task["date"])
        deadline = (dt.date.fromisoformat(deadline) + shift).isoformat()
    steps = [{**step, "completed": False} for step in task.get("steps") or []]
    return {"date": date, "deadline": deadline, "steps": steps}


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
        "deadline": props.get("deadline") if isinstance(props.get("deadline"), str) else None,
        "time": parse_time(props.get("time")),
        "repeat": format_repeat(parse_repeat(props.get("repeat"))),
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


TASK_KEYS = ["id", "completed", "date", "deadline", "time", "repeat", "priority", "labels", "project", "rank", "created-at", "updated-at", "completed-at", "source-note"]


def validate_schedule(task: Dict[str, Any]) -> None:
    if task.get("time") is not None and parse_time(task["time"]) is None:
        fail("time must be HH:MM in 24-hour local time")
    if task.get("repeat") is not None:
        rule = parse_repeat(task["repeat"])
        if rule is None:
            fail("repeat must be daily, weekly, monthly, yearly, or 'every N days|weeks|months|years' with N from 1 to 99, "
                 "optionally followed by 'on day D' or 'on last day' for monthly rules")
        task["repeat"] = format_repeat(anchor_repeat(rule, task.get("date")))
    if (task.get("time") is not None or task.get("repeat") is not None) and task.get("date") is None:
        fail("time and repeat require a date")


def encode_task(task: Dict[str, Any]) -> str:
    frontmatter = ["---", "type: todo"] + [f"{key}: {quote(task.get(key))}" for key in TASK_KEYS if key not in SCHEDULE_KEYS or task.get(key) is not None] + ["---"]
    body = encode_task_body(task.get("steps") or [], str(task.get("notes") or ""), str(task.get("step-section-remainder") or ""))
    suffix = f"\n\n{body}" if body else ""
    return "\n".join(frontmatter) + f"\n\n# {str(task['title']).strip()}{suffix}\n"


def encode_task_preserving_properties(task: Dict[str, Any], current_text: str) -> str:
    lines, _ = split_document(current_text)
    keys = TASK_KEYS
    render = {"type": "type: todo", **{key: f"{key}: {quote(task.get(key))}" for key in keys if key not in SCHEDULE_KEYS or task.get(key) is not None}}
    emitted, output = set(), []
    for line in lines:
        match = re.match(r"^([^\s:#][^:]*):", line)
        if not match:
            output.append(line)
            continue
        key = match.group(1).strip()
        if key in SCHEDULE_KEYS and key not in render:
            raw = parse_scalar(line[line.index(":") + 1:])
            if key not in emitted and raw is not None and SCHEDULE_PARSERS[key](raw) is None:
                output.append(line)
            emitted.add(key)
            continue
        if key in render:
            if key not in emitted:
                output.append(render[key])
            emitted.add(key)
        elif key != "important":
            output.append(line)
    for key in ["type", *keys]:
        if key not in emitted and key in render:
            output.append(render[key])
    body = encode_task_body(task.get("steps") or [], str(task.get("notes") or ""), str(task.get("step-section-remainder") or ""))
    suffix = f"\n\n{body}" if body else ""
    return "---\n" + "\n".join(output) + f"\n---\n\n# {str(task['title']).strip()}{suffix}\n"


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
        return {"taskFolder": "TaskMate/Tasks", "projectFolder": "TaskMate/Projects", "proposalFolder": "TaskMate/Proposals", "planFolder": "TaskMate/Plans", "sourceFolders": [], "includeSourceSubfolders": True, "language": "auto", "desktopLanguage": None}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        fail(f"cannot read plugin settings: {error}")
    return {
        "taskFolder": loaded.get("taskFolder") or "TaskMate/Tasks",
        "projectFolder": loaded.get("projectFolder") or "TaskMate/Projects",
        "proposalFolder": loaded.get("proposalFolder") or "TaskMate/Proposals",
        "planFolder": loaded.get("planFolder") or "TaskMate/Plans",
        "sourceFolders": loaded.get("sourceFolders") or [],
        "includeSourceSubfolders": loaded.get("includeSourceSubfolders", True),
        "language": loaded.get("language") or "auto",
        "desktopLanguage": loaded.get("desktopLanguage"),
    }


def output_language(vault: Path) -> Dict[str, str]:
    """Language for text Task Pilot writes into the vault, following TaskMate's setting.

    An explicit English or Japanese setting wins. Under Auto, Task Pilot cannot ask Obsidian, so it uses the language the
    desktop Obsidian app recorded as desktopLanguage. Without either the language is unknown: Task Pilot then decides
    from clearly single-language Source notes or asks the user, and never falls back to English silently.
    """
    settings = plugin_settings(vault)
    if settings["language"] in ("en", "ja"):
        return {"language": settings["language"], "source": "setting"}
    if settings["desktopLanguage"] in ("en", "ja"):
        return {"language": settings["desktopLanguage"], "source": "desktop"}
    return {"language": "unknown", "source": "unknown"}


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


def validate_date(value: Optional[str], name: str = "date") -> None:
    if value is not None and not DATE_RE.fullmatch(value):
        fail(f"{name} must be YYYY-MM-DD")


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
    deadline = draft.get("deadline")
    priority = draft.get("priority")
    validate_date(date)
    validate_date(deadline, "deadline")
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
        "deadline": deadline,
        "time": draft.get("time"),
        "repeat": draft.get("repeat"),
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
    validate_schedule(task)
    path = available_task_path(folder, title)
    atomic_write(path, encode_task(task))
    result = dict(task)
    result["path"] = path.relative_to(vault).as_posix()
    return result


def command_create(args: argparse.Namespace) -> None:
    result = create_task(args.vault, args.task_folder, {
        "title": args.title, "date": args.date, "deadline": args.deadline, "priority": args.priority,
        "time": args.time, "repeat": args.repeat,
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
    for key in ("title", "date", "deadline", "time", "repeat", "priority", "project", "notes"):
        if key in patch:
            task[key] = patch[key]
    # A new date moves a monthly rule's recorded day with it, unless the patch sets the rule itself.
    rule = parse_repeat(task.get("repeat"))
    if "date" in patch and "repeat" not in patch and rule is not None and isinstance(rule[2], int):
        task["repeat"] = format_repeat((rule[0], rule[1], None))
    if "labels" in patch:
        task["labels"] = normalized_labels(patch["labels"] or [])
    if "steps" in patch: task["steps"] = normalized_steps(patch["steps"] or [])
    if not str(task["title"]).strip():
        fail("title is required")
    validate_date(task["date"])
    validate_date(task["deadline"], "deadline")
    validate_schedule(task)
    validate_priority(task["priority"])
    task["updated-at"] = now_iso()
    atomic_write(path, encode_task_preserving_properties(task, path.read_text(encoding="utf-8")))
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
    if args.deadline is not None:
        patch["deadline"] = None if args.deadline == "none" else args.deadline
    if args.time is not None:
        patch["time"] = None if args.time == "none" else args.time
    if args.repeat is not None:
        patch["repeat"] = None if args.repeat == "none" else args.repeat
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
    # Completing a recurring occurrence advances the same task to its next occurrence.
    following = next_occurrence(task) if completed and not task["completed"] else None
    if following:
        task.update(following)
    else:
        task["completed"] = completed
        task["completed-at"] = now_iso() if completed else None
    task["updated-at"] = now_iso()
    atomic_write(path, encode_task_preserving_properties(task, path.read_text(encoding="utf-8")))
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
        safe_path(vault, str(settings["planFolder"])),
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


def command_language(args: argparse.Namespace) -> None:
    print(json.dumps(output_language(args.vault), ensure_ascii=False, indent=2))


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
            validate_date(task["deadline"], "deadline")
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
    create.add_argument("--date", help="scheduled date YYYY-MM-DD")
    create.add_argument("--deadline", help="hard deadline YYYY-MM-DD")
    create.add_argument("--time", help="local time HH:MM; requires --date")
    create.add_argument("--repeat", help="daily, weekly, monthly, yearly, or 'every N days|weeks|months|years'; monthly rules may add 'on day D' or 'on last day'; requires --date")
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
    update.add_argument("--date", help="scheduled date YYYY-MM-DD or none")
    update.add_argument("--deadline", help="hard deadline YYYY-MM-DD or none")
    update.add_argument("--time", help="local time HH:MM or none")
    update.add_argument("--repeat", help="daily, weekly, monthly, yearly, 'every N days|weeks|months|years' (monthly rules may add 'on day D' or 'on last day'), or none")
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

    language = commands.add_parser("language")
    language.set_defaults(run=command_language)
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
