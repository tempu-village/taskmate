#!/usr/bin/env python3
"""Deterministic rolling-plan artifacts for Task Pilot.

A rolling plan accounts for every canonical incomplete Task across today and
user-confirmed future capacity. Creating, selecting, revising, closing, and
superseding a plan never writes Task Markdown.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import planning_store
import todo_store
from planning_store import fail


SCHEMA_VERSION = 1
PLAN_ID_RE = re.compile(r"plan-[A-Za-z0-9._-]+")
BASES = ("recommended", "evidence")
BASE_PREFIX = {"recommended": "R", "evidence": "E", "working": "PLAN"}
SECTION_TITLES = {"working": "Working plan", "recommended": "Recommended base", "evidence": "Evidence base"}
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
HORIZON_LIMIT_DAYS = 366
EVIDENCE_BASES = {"user", "task-text"}
MUTABLE_STATUSES = {"draft", "ready", "proposal-created"}
PLAN_COMMENT_RE = re.compile(r"^<!-- taskmate-plan (\{.*\}) -->$", re.MULTILINE)
ITEM_COMMENT_RE = re.compile(r"^\s*<!-- taskmate-plan-item (\{.*\}) -->$", re.MULTILINE)


# Paths and persistence

def plan_folder(vault: Path) -> Path:
    return todo_store.safe_path(vault, str(todo_store.plugin_settings(vault)["planFolder"]))


def validated_plan_id(value: str) -> str:
    if not PLAN_ID_RE.fullmatch(value):
        fail("plan-id must start with plan- and contain only safe identifier characters")
    return value


def plan_path(vault: Path, plan_id: str) -> Path:
    return plan_folder(vault) / f"{validated_plan_id(plan_id)}.md"


def comment_json(value: Dict[str, Any]) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return text.replace("-->", "--\\u003e")


def load_plan(vault: Path, plan_id: str) -> Tuple[Path, Dict[str, Any]]:
    path = plan_path(vault, plan_id)
    if not path.exists():
        fail(f"plan does not exist: {plan_id}")
    text = path.read_text(encoding="utf-8")
    header = PLAN_COMMENT_RE.search(text)
    if header is None:
        fail(f"plan metadata is missing: {plan_id}")
    plan = json.loads(header.group(1))
    sections: Dict[str, List[Dict[str, Any]]] = {"recommended": [], "evidence": [], "working": []}
    for match in ITEM_COMMENT_RE.finditer(text):
        item = json.loads(match.group(1))
        section = item.pop("section")
        if section not in sections:
            fail(f"plan item has an unknown section: {section}")
        sections[section].append(item)
    plan["bases"] = {base: sections[base] for base in BASES}
    plan["working"] = sections["working"] if plan.get("baseMode") else None
    if render_plan(plan) != text:
        fail(f"plan was edited outside Task Pilot; ask the user how to proceed before writing: {plan_id}")
    return path, plan


def save_plan(path: Path, plan: Dict[str, Any]) -> None:
    todo_store.atomic_write(path, render_plan(plan))


def check_revision(plan: Dict[str, Any], expected: int) -> None:
    if plan["revision"] != expected:
        fail(f"plan revision is {plan['revision']}, not {expected}; re-read the plan before changing it")


def bump(plan: Dict[str, Any]) -> None:
    plan["revision"] += 1
    plan["updatedAt"] = todo_store.now_iso()


# Capacity

def nonnegative_integer(value: Any, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        fail(f"{name} must be a non-negative integer")
    return value


def buffer_percent(value: Any, name: str) -> int:
    value = 20 if value is None else value
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value < 100:
        fail(f"{name} must be an integer from 0 through 99")
    return value


def planning_minutes(available: int, percent: int) -> int:
    return available - math.floor(available * percent / 100)


def validated_capacity(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        fail("request requires a capacity object")
    today = raw.get("today")
    if not isinstance(today, dict):
        fail("capacity requires today")
    result: Dict[str, Any] = {"today": {
        "availableMinutes": nonnegative_integer(today.get("availableMinutes"), "today.availableMinutes"),
        "bufferPercent": buffer_percent(today.get("bufferPercent"), "today.bufferPercent"),
    }, "future": None}
    future = raw.get("future")
    if future is None:
        return result
    if not isinstance(future, dict):
        fail("capacity.future must be an object or null")
    mode = future.get("mode")
    if mode not in {"explicit", "assumed"}:
        fail("capacity.future.mode must be explicit or assumed")
    confirmed_at = future.get("confirmedAt")
    if confirmed_at is not None:
        try:
            dt.datetime.fromisoformat(str(confirmed_at).replace("Z", "+00:00"))
        except ValueError:
            fail("capacity.future.confirmedAt must be an ISO date-time or null")
    weekdays = future.get("weekdays") or []
    if not isinstance(weekdays, list) or any(day not in WEEKDAYS for day in weekdays):
        fail("capacity.future.weekdays must contain only mon through sun")
    exceptions = future.get("exceptions") or {}
    if not isinstance(exceptions, dict):
        fail("capacity.future.exceptions must map dates to available minutes")
    for date, minutes in exceptions.items():
        if not todo_store.is_calendar_date(date):
            fail(f"capacity exception has an invalid date: {date}")
        nonnegative_integer(minutes, f"capacity exception {date}")
    commitments = future.get("commitments") or []
    if not isinstance(commitments, list):
        fail("capacity.future.commitments must be an array")
    normalized_commitments = []
    for commitment in commitments:
        if not isinstance(commitment, dict) or not todo_store.is_calendar_date(str(commitment.get("date"))):
            fail("each fixed commitment requires a date")
        label = str(commitment.get("label") or "").strip()
        if not label:
            fail("each fixed commitment requires a label")
        normalized_commitments.append({
            "date": commitment["date"],
            "minutes": nonnegative_integer(commitment.get("minutes"), f"commitment {label}"),
            "label": label,
        })
    result["future"] = {
        "mode": mode,
        "confirmedAt": confirmed_at,
        "dailyMinutes": nonnegative_integer(future.get("dailyMinutes"), "capacity.future.dailyMinutes"),
        "bufferPercent": buffer_percent(future.get("bufferPercent"), "capacity.future.bufferPercent"),
        "weekdays": [day for day in WEEKDAYS if day in weekdays],
        "exceptions": dict(sorted(exceptions.items())),
        "commitments": sorted(normalized_commitments, key=lambda value: (value["date"], value["label"])),
    }
    return result


def day_capacity(capacity: Dict[str, Any], target: dt.date, day: dt.date) -> int:
    if day == target:
        today = capacity["today"]
        return planning_minutes(today["availableMinutes"], today["bufferPercent"])
    future = capacity["future"]
    if future is None or future["confirmedAt"] is None or day < target:
        return 0
    key = day.isoformat()
    if key in future["exceptions"]:
        available = future["exceptions"][key]
    else:
        available = future["dailyMinutes"] if WEEKDAYS[day.weekday()] in future["weekdays"] else 0
    available -= sum(item["minutes"] for item in future["commitments"] if item["date"] == key)
    return planning_minutes(max(0, available), future["bufferPercent"])


def future_confirmed(capacity: Dict[str, Any]) -> bool:
    return capacity["future"] is not None and capacity["future"]["confirmedAt"] is not None


# Base entries and placement

def validated_proposed_fields(raw: Any, task_id: str) -> Dict[str, Any]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        fail(f"proposedFields must be an object for Task: {task_id}")
    unexpected = set(raw) - {"addLabels", "steps", "notes"}
    if unexpected:
        fail(f"plan-derived fields are limited to date, context/* labels, Steps, and Notes for Task {task_id}: {', '.join(sorted(unexpected))}")
    fields: Dict[str, Any] = {}
    if "addLabels" in raw:
        labels = raw["addLabels"]
        if not isinstance(labels, list) or any(not isinstance(label, str) or not label.startswith("context/") for label in labels):
            fail(f"addLabels must contain only context/* labels for Task: {task_id}")
        fields["addLabels"] = labels
    if "steps" in raw:
        fields["steps"] = todo_store.normalized_steps(raw["steps"] or [])
    if "notes" in raw:
        if not isinstance(raw["notes"], str):
            fail(f"notes must be a string for Task: {task_id}")
        fields["notes"] = raw["notes"]
    return fields


def validated_flag(raw: Any, name: str, task_id: str) -> Optional[Dict[str, str]]:
    if raw is None:
        return None
    if not isinstance(raw, dict) or not str(raw.get("code") or "").strip() or not str(raw.get("reason") or "").strip():
        fail(f"{name} requires a code and reason for Task: {task_id}")
    return {"code": str(raw["code"]).strip(), "reason": str(raw["reason"]).strip()}


def validated_entries(vault: Path, override: Optional[str], base: str, raw_entries: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_entries, list):
        fail(f"{base} base must be an array")
    tasks = {task["id"]: task for task in planning_store.incomplete_tasks(vault, override)}
    entries, seen, orders = [], set(), set()
    for raw in raw_entries:
        if not isinstance(raw, dict):
            fail(f"each {base} entry must be an object")
        task_id = raw.get("taskId")
        task = tasks.get(task_id)
        if task is None:
            fail(f"{base} entry is not an incomplete canonical Task: {task_id}")
        if task_id in seen:
            fail(f"{base} base lists Task more than once: {task_id}")
        seen.add(task_id)
        snapshot = raw.get("snapshot")
        if snapshot != planning_store.task_snapshot(vault, task):
            fail(f"Task changed after inspection: {task_id}")
        order = raw.get("order")
        if not isinstance(order, int) or isinstance(order, bool) or order in orders:
            fail(f"{base} entry requires a unique integer order for Task: {task_id}")
        orders.add(order)
        reason = str(raw.get("reason") or "").strip()
        if not reason:
            fail(f"{base} entry requires a reason for Task: {task_id}")
        reason_codes = raw.get("reasonCodes") or []
        if not isinstance(reason_codes, list) or any(not isinstance(code, str) or not code.strip() for code in reason_codes):
            fail(f"reasonCodes must be a string array for Task: {task_id}")
        estimate = None
        if raw.get("estimate") is not None:
            estimate = planning_store.validated_estimate(raw["estimate"], task_id, raw.get("largeAccepted") is True)
            if base == "evidence" and estimate["basis"] not in EVIDENCE_BASES:
                fail(f"the evidence base accepts only user or task-text estimates for Task: {task_id}")
        proposed = validated_proposed_fields(raw.get("proposedFields"), task_id)
        if base == "evidence" and proposed:
            fail(f"the evidence base cannot propose Task fields for Task: {task_id}")
        deadline = raw.get("deadline")
        if deadline is not None and not todo_store.is_calendar_date(str(deadline)):
            fail(f"deadline must be YYYY-MM-DD for Task: {task_id}")
        entries.append({
            "taskId": task_id, "title": task["title"], "path": task["path"], "currentDate": task["date"],
            "snapshot": snapshot, "order": order, "reason": reason, "reasonCodes": list(reason_codes),
            "estimate": estimate, "needsBreakdown": raw.get("needsBreakdown") is True, "proposedFields": proposed,
            "deadline": deadline, "gap": validated_flag(raw.get("gap"), "gap", task_id),
            "conflict": validated_flag(raw.get("conflict"), "conflict", task_id),
        })
    missing = sorted(set(tasks) - seen)
    if missing:
        fail(f"{base} base must account for every incomplete canonical Task; missing: {', '.join(missing)}")
    return entries


def place_base(entries: List[Dict[str, Any]], capacity: Dict[str, Any], target: dt.date) -> List[Dict[str, Any]]:
    remaining: Dict[dt.date, int] = {}
    horizon_end = target + dt.timedelta(days=HORIZON_LIMIT_DAYS)
    largest_day = max(day_capacity(capacity, target, target + dt.timedelta(days=offset)) for offset in range(HORIZON_LIMIT_DAYS + 1))

    def free(day: dt.date) -> int:
        if day not in remaining:
            remaining[day] = day_capacity(capacity, target, day)
        return remaining[day]

    def first_fit(earliest: dt.date, minutes: int) -> Optional[dt.date]:
        day = earliest
        while day <= horizon_end:
            if free(day) >= minutes:
                return day
            day += dt.timedelta(days=1)
        return None

    def record(entry: Dict[str, Any], kind: str, **values: Any) -> Dict[str, Any]:
        public = {key: entry[key] for key in ("taskId", "title", "path", "currentDate", "snapshot", "order", "reason", "estimate", "proposedFields")}
        return {**public, "kind": kind, "reasonCodes": list(entry["reasonCodes"]), **values}

    def unplaced(entry: Dict[str, Any], minutes: int) -> Dict[str, Any]:
        if not future_confirmed(capacity):
            return record(entry, "gap", code="future-capacity-unconfirmed", detail="Does not fit today, and future capacity is not confirmed.")
        if minutes > largest_day:
            return record(entry, "gap", code="needs-breakdown", detail="Larger than any confirmed day's capacity.")
        return record(entry, "gap", code="no-usable-capacity", detail=f"No confirmed capacity within {HORIZON_LIMIT_DAYS} days.")

    results = []
    ordered = sorted(entries, key=lambda entry: entry["order"])
    pending = []
    for entry in ordered:
        if entry["gap"]:
            results.append(record(entry, "gap", code=entry["gap"]["code"], detail=entry["gap"]["reason"]))
        elif entry["conflict"]:
            results.append(record(entry, "conflict", code=entry["conflict"]["code"], detail=entry["conflict"]["reason"]))
        elif entry["estimate"] is None:
            code = "needs-breakdown" if entry["needsBreakdown"] else "missing-effort"
            results.append(record(entry, "gap", code=code, detail="No credible effort range." if code == "missing-effort" else "Needs to be broken down before scheduling."))
        else:
            pending.append(entry)
    dated = [entry for entry in pending if entry["currentDate"] and dt.date.fromisoformat(entry["currentDate"]) >= target]
    others = [entry for entry in pending if entry not in dated]
    for entry in [*dated, *others]:
        minutes = entry["estimate"]["maxMinutes"]
        current = dt.date.fromisoformat(entry["currentDate"]) if entry["currentDate"] else None
        earliest = current if current and current >= target else target
        day = first_fit(earliest, minutes)
        if day is None:
            results.append(unplaced(entry, minutes))
            continue
        if entry["deadline"] and day > dt.date.fromisoformat(entry["deadline"]):
            results.append(record(entry, "conflict", code="deadline-capacity", detail=f"Earliest capacity is {day.isoformat()}, after the deadline {entry['deadline']}."))
            continue
        remaining[day] = free(day) - minutes
        codes = []
        if current and current < target:
            codes.append("overdue")
        elif current and day != current:
            codes.append("moved-capacity")
        results.append(record(entry, "planned", plannedDate=day.isoformat(), moveCodes=codes))
    return results


def numbered(items: List[Dict[str, Any]], prefix: str, plan: Dict[str, Any], section: str) -> List[Dict[str, Any]]:
    planned = sorted((item for item in items if item["kind"] == "planned"), key=lambda item: (item["plannedDate"], item["order"]))
    for number, item in enumerate(planned, 1):
        item["id"] = f"{prefix}-{number:02d}"
    for item in sorted((item for item in items if item["kind"] != "planned"), key=lambda item: item["order"]):
        counter = "gap" if item["kind"] == "gap" else "conflict"
        plan["counters"][counter] += 1
        item["id"] = f"{counter.upper()}-{plan['counters'][counter]:02d}"
    for item in items:
        item["revision"] = plan["revision"]
    return sorted(items, key=sort_key)


def sort_key(item: Dict[str, Any]) -> Tuple[int, str, int, str]:
    kind_rank = {"planned": 0, "gap": 1, "conflict": 2}[item["kind"]]
    return (kind_rank, item.get("plannedDate") or "", item["order"], item["id"])


def end_date(plan: Dict[str, Any]) -> Optional[str]:
    dates = [item["plannedDate"] for base in BASES for item in plan["bases"][base] if item["kind"] == "planned"]
    if plan["working"]:
        dates += [item["plannedDate"] for item in plan["working"] if item["kind"] == "planned"]
    return max(dates) if dates else None


# Rendering

def yaml_scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    return json.dumps(value, ensure_ascii=False)


def estimate_text(estimate: Optional[Dict[str, Any]]) -> str:
    if not estimate:
        return "no estimate"
    return f"{estimate['minMinutes']}–{estimate['maxMinutes']} min ({estimate['basis']})"


def task_link(item: Dict[str, Any]) -> str:
    target = str(item["path"]).removesuffix(".md")
    title = str(item["title"]).replace("|", "/").replace("]", ")").replace("[", "(")
    return f"[[{target}|{title}]]"


def item_lines(item: Dict[str, Any], section: str) -> List[str]:
    if item["kind"] == "planned":
        notes = [estimate_text(item["estimate"])]
        if "overdue" in item["moveCodes"]:
            notes.append(f"overdue from {item['currentDate']}")
        if "moved-capacity" in item["moveCodes"]:
            notes.append(f"moved from {item['currentDate']} for capacity")
        if "user-moved" in item["moveCodes"] or "user-scheduled" in item["moveCodes"]:
            notes.append("placed by the user")
        if item["currentDate"] is None:
            notes.append("newly dated")
        if item["proposedFields"]:
            notes.append("proposes " + ", ".join(sorted(item["proposedFields"])))
        line = f"- {item['id']} {task_link(item)} — " + "; ".join(notes) + f". {item['reason']}"
    else:
        line = f"- {item['id']} {task_link(item)} — {item['code']}: {item['detail']}"
    return [line, "  <!-- taskmate-plan-item " + comment_json({**item, "section": section}) + " -->"]


def section_lines(section: str, items: List[Dict[str, Any]], capacity: Dict[str, Any], target: dt.date) -> List[str]:
    lines = [f"## {SECTION_TITLES[section]}", ""]
    planned = [item for item in items if item["kind"] == "planned"]
    for date in sorted({item["plannedDate"] for item in planned}):
        day = dt.date.fromisoformat(date)
        day_items = [item for item in planned if item["plannedDate"] == date]
        used = sum(item["estimate"]["maxMinutes"] for item in day_items)
        lines += [f"### {date} ({WEEKDAYS[day.weekday()].capitalize()}) — {used} of {day_capacity(capacity, target, day)} min", ""]
        for item in day_items:
            lines += item_lines(item, section)
        lines.append("")
    for kind, title in (("gap", "Gaps"), ("conflict", "Conflicts")):
        group = [item for item in items if item["kind"] == kind]
        if group:
            lines += [f"### {title}", ""]
            for item in group:
                lines += item_lines(item, section)
            lines.append("")
    if not items:
        lines += ["_No Tasks._", ""]
    return lines


def render_plan(plan: Dict[str, Any]) -> str:
    target = dt.date.fromisoformat(plan["targetDate"])
    future = plan["capacity"]["future"]
    frontmatter = {
        "type": "taskmate-today-plan",
        "schema-version": SCHEMA_VERSION,
        "plan-id": plan["planId"],
        "target-date": plan["targetDate"],
        "planning-scope": "all-open-tasks",
        "end-date": plan["endDate"],
        "status": plan["status"],
        "base-mode": plan["baseMode"],
        "future-capacity-mode": future["mode"] if future else None,
        "future-capacity-confirmed-at": future["confirmedAt"] if future else None,
        "revision": plan["revision"],
        "created-at": plan["createdAt"],
        "updated-at": plan["updatedAt"],
    }
    header = {key: value for key, value in plan.items() if key not in {"bases", "working"}}
    lines = ["---", *[f"{key}: {yaml_scalar(value)}" for key, value in frontmatter.items()], "---", ""]
    lines += [f"# Plan for {plan['targetDate']}", "", "<!-- taskmate-plan " + comment_json(header) + " -->", ""]
    today = plan["capacity"]["today"]
    lines.append(f"Today: {planning_minutes(today['availableMinutes'], today['bufferPercent'])} of {today['availableMinutes']} min after a {today['bufferPercent']}% buffer.")
    if future is None:
        lines.append("Future capacity: not provided. No Task receives a future plan date.")
    elif future["confirmedAt"] is None:
        lines.append(f"Future capacity ({future['mode']}): awaiting confirmation. No Task receives a future plan date.")
    else:
        days = ", ".join(day.capitalize() for day in future["weekdays"]) or "no weekdays"
        lines.append(f"Future capacity ({future['mode']}, confirmed {future['confirmedAt']}): {future['dailyMinutes']} min on {days}, {future['bufferPercent']}% buffer.")
    lines.append("")
    if plan["working"] is None:
        lines += [f"## {SECTION_TITLES['working']}", "", "_No base selected. Choose the recommended base or the evidence base; they are never mixed._", ""]
    else:
        lines += section_lines("working", plan["working"], plan["capacity"], target)
    for base in BASES:
        lines += section_lines(base, plan["bases"][base], plan["capacity"], target)
    return "\n".join(lines).rstrip("\n") + "\n"


# Commands

def summary(vault: Path, path: Path, plan: Dict[str, Any]) -> Dict[str, Any]:
    def counts(items: Optional[List[Dict[str, Any]]]) -> Optional[Dict[str, int]]:
        if items is None:
            return None
        return {kind: sum(item["kind"] == kind for item in items) for kind in ("planned", "gap", "conflict")}
    relative = path.relative_to(vault).as_posix()
    uri = "obsidian://open?" + urllib.parse.urlencode({"vault": vault.name, "file": relative})
    return {
        "planId": plan["planId"], "path": relative, "uri": uri, "status": plan["status"], "revision": plan["revision"],
        "baseMode": plan["baseMode"], "endDate": plan["endDate"],
        "counts": {"recommended": counts(plan["bases"]["recommended"]), "evidence": counts(plan["bases"]["evidence"]), "working": counts(plan["working"])},
    }


def print_result(vault: Path, path: Path, plan: Dict[str, Any], open_file: bool = False) -> None:
    result = summary(vault, path, plan)
    result["opened"] = False
    if open_file:
        try:
            planning_store.open_review_uri(result["uri"])
            result["opened"] = True
        except SystemExit as error:
            result["openError"] = str(error)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def command_create(args: argparse.Namespace) -> None:
    request = planning_store.read_json(args.request)
    target_text = request.get("targetDate")
    if not todo_store.is_calendar_date(str(target_text)):
        fail("request requires targetDate as YYYY-MM-DD")
    target = dt.date.fromisoformat(target_text)
    path = plan_path(args.vault, args.plan_id)
    if path.exists():
        fail(f"plan already exists: {args.plan_id}")
    superseded: Optional[Tuple[Path, Dict[str, Any]]] = None
    if args.supersedes:
        superseded = load_plan(args.vault, args.supersedes)
        if superseded[1]["status"] not in MUTABLE_STATUSES:
            fail(f"plan cannot be superseded from status {superseded[1]['status']}: {args.supersedes}")
    capacity = validated_capacity(request.get("capacity"))
    timestamp = todo_store.now_iso()
    plan: Dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION, "planId": args.plan_id, "targetDate": target_text, "status": "draft",
        "baseMode": None, "revision": 1, "createdAt": timestamp, "updatedAt": timestamp, "endDate": None,
        "supersedes": args.supersedes, "supersededBy": None, "capacity": capacity,
        "counters": {"gap": 0, "conflict": 0, "plan": 0}, "bases": {}, "working": None,
    }
    bases = request.get("bases")
    if not isinstance(bases, dict) or set(bases) != set(BASES):
        fail("request.bases requires exactly recommended and evidence")
    for base in BASES:
        entries = validated_entries(args.vault, args.task_folder, base, bases[base])
        plan["bases"][base] = numbered(place_base(entries, capacity, target), BASE_PREFIX[base], plan, base)
    plan["endDate"] = end_date(plan)
    save_plan(path, plan)
    if superseded:
        old_path, old = superseded
        old["status"], old["supersededBy"] = "superseded", args.plan_id
        bump(old)
        save_plan(old_path, old)
    print_result(args.vault, path, plan, args.open)


def command_show(args: argparse.Namespace) -> None:
    path, plan = load_plan(args.vault, args.plan_id)
    print(json.dumps({**summary(args.vault, path, plan), "plan": plan}, ensure_ascii=False, indent=2))


def command_select_base(args: argparse.Namespace) -> None:
    path, plan = load_plan(args.vault, args.plan_id)
    check_revision(plan, args.revision)
    if plan["status"] not in {"draft", "ready"}:
        fail(f"a base cannot be selected from status {plan['status']}")
    if plan["working"] is not None and not args.replace_working_plan:
        fail("a working plan already exists; pass --replace-working-plan to discard its revisions")
    bump(plan)
    working = []
    plan["counters"]["plan"] = 0
    for item in plan["bases"][args.base]:
        copied = json.loads(json.dumps(item, ensure_ascii=False))
        copied["basedOn"] = item["id"]
        copied["revision"] = plan["revision"]
        if copied["kind"] == "planned":
            plan["counters"]["plan"] += 1
            copied["id"] = f"PLAN-{plan['counters']['plan']:02d}"
        working.append(copied)
    plan["working"] = sorted(working, key=sort_key)
    plan["baseMode"], plan["status"] = args.base, "ready"
    plan["endDate"] = end_date(plan)
    save_plan(path, plan)
    print_result(args.vault, path, plan)


def allowed_plan_date(plan: Dict[str, Any], value: Any) -> str:
    if not todo_store.is_calendar_date(str(value)):
        fail("date must be YYYY-MM-DD")
    target = dt.date.fromisoformat(plan["targetDate"])
    day = dt.date.fromisoformat(value)
    if day < target:
        fail(f"a plan date cannot precede the target date: {value}")
    if day > target and not future_confirmed(plan["capacity"]):
        fail("future plan dates require confirmed future capacity")
    if day_capacity(plan["capacity"], target, day) == 0:
        fail(f"no confirmed capacity on {value}")
    return value


def command_revise(args: argparse.Namespace) -> None:
    path, plan = load_plan(args.vault, args.plan_id)
    check_revision(plan, args.revision)
    if plan["status"] != "ready" or plan["working"] is None:
        fail("only a ready working plan can be revised")
    raw_changes = planning_store.read_json(args.changes).get("changes")
    if not isinstance(raw_changes, list) or not raw_changes:
        fail("revision requires a non-empty changes array")
    bump(plan)
    items = {item["id"]: item for item in plan["working"]}
    for change in raw_changes:
        if not isinstance(change, dict):
            fail("each change must be an object")
        item = items.get(change.get("id"))
        if item is None:
            fail(f"unknown working-plan item: {change.get('id')}")
        reason = str(change.get("reason") or "").strip()
        if not reason:
            fail(f"change requires a reason: {item['id']}")
        operation = change.get("operation")
        if operation == "move":
            if item["kind"] != "planned":
                fail(f"only planned items can move: {item['id']}")
            item["plannedDate"] = allowed_plan_date(plan, change.get("date"))
            item["moveCodes"] = ["user-moved"]
        elif operation == "unschedule":
            if item["kind"] != "planned":
                fail(f"only planned items can be unscheduled: {item['id']}")
            plan["counters"]["gap"] += 1
            items.pop(item["id"])
            item.update({"id": f"GAP-{plan['counters']['gap']:02d}", "kind": "gap", "code": "user-unscheduled", "detail": reason})
            for key in ("plannedDate", "moveCodes"):
                item.pop(key, None)
            items[item["id"]] = item
        elif operation == "schedule":
            if item["kind"] == "planned":
                fail(f"item is already planned: {item['id']}")
            if change.get("estimate") is not None:
                item["estimate"] = planning_store.validated_estimate(change["estimate"], item["taskId"], change.get("largeAccepted") is True)
            if item["estimate"] is None:
                fail(f"scheduling requires an estimate: {item['id']}")
            plan["counters"]["plan"] += 1
            items.pop(item["id"])
            item.update({"id": f"PLAN-{plan['counters']['plan']:02d}", "kind": "planned", "plannedDate": allowed_plan_date(plan, change.get("date")), "moveCodes": ["user-scheduled"]})
            for key in ("code", "detail"):
                item.pop(key, None)
            items[item["id"]] = item
        elif operation == "set-fields":
            item["proposedFields"] = validated_proposed_fields(change.get("proposedFields"), item["taskId"])
        else:
            fail(f"unsupported revision operation: {operation}")
        item["reason"] = reason
        item["revision"] = plan["revision"]
    plan["working"] = sorted(items.values(), key=sort_key)
    plan["endDate"] = end_date(plan)
    save_plan(path, plan)
    print_result(args.vault, path, plan)


def command_close(args: argparse.Namespace) -> None:
    path, plan = load_plan(args.vault, args.plan_id)
    check_revision(plan, args.revision)
    if plan["status"] not in MUTABLE_STATUSES:
        fail(f"plan cannot be closed from status {plan['status']}")
    bump(plan)
    plan["status"] = "closed"
    save_plan(path, plan)
    print_result(args.vault, path, plan)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--vault", required=True, type=lambda value: Path(value).resolve())
    result.add_argument("--task-folder")
    commands = result.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create")
    create.add_argument("--request", required=True, type=Path)
    create.add_argument("--plan-id", required=True, type=validated_plan_id)
    create.add_argument("--supersedes", type=validated_plan_id)
    create.add_argument("--open", action="store_true")
    create.set_defaults(run=command_create)

    show = commands.add_parser("show")
    show.add_argument("--plan-id", required=True, type=validated_plan_id)
    show.set_defaults(run=command_show)

    select = commands.add_parser("select-base")
    select.add_argument("--plan-id", required=True, type=validated_plan_id)
    select.add_argument("--base", required=True, choices=BASES)
    select.add_argument("--revision", required=True, type=int)
    select.add_argument("--replace-working-plan", action="store_true")
    select.set_defaults(run=command_select_base)

    revise = commands.add_parser("revise")
    revise.add_argument("--plan-id", required=True, type=validated_plan_id)
    revise.add_argument("--revision", required=True, type=int)
    revise.add_argument("--changes", required=True, type=Path)
    revise.set_defaults(run=command_revise)

    close = commands.add_parser("close")
    close.add_argument("--plan-id", required=True, type=validated_plan_id)
    close.add_argument("--revision", required=True, type=int)
    close.set_defaults(run=command_close)
    return result


def main() -> None:
    args = parser().parse_args()
    if not args.vault.is_dir():
        fail(f"vault does not exist: {args.vault}")
    args.run(args)


if __name__ == "__main__":
    main()
