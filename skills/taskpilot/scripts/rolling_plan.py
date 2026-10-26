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


SCHEMA_VERSION = 2
PLAN_ID_RE = re.compile(r"plan-[A-Za-z0-9._-]+")
BASES = ("recommended", "evidence")
BASE_PREFIX = {"recommended": "R", "evidence": "E", "working": "PLAN"}
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
HORIZON_LIMIT_DAYS = 366
EVIDENCE_BASES = {"user", "task-text"}
MUTABLE_STATUSES = {"draft", "ready", "proposal-created"}
SUMMARY_LIMIT = 500
TASK_SUMMARY_LIMIT = 200
OMISSION_REASONS = ("no-change", "stale", "completed", "missing")
PLAN_COMMENT_RE = re.compile(r"^<!-- taskmate-plan (\{.*\}) -->$", re.MULTILINE)
ITEM_COMMENT_RE = re.compile(r"^\s*<!-- taskmate-plan-item (\{.*\}) -->$", re.MULTILINE)

# Every visible heading and fixed phrase of a plan, and of the reasons it writes into Task change Proposals, in each
# output language. IDs, Task titles, labels and machine-readable comments are never translated.
TEXT: Dict[str, Dict[str, str]] = {
    "en": {
        "title": "Plan from {date}",
        "today": "Today: {planning} of {available} min after a {buffer}% buffer.",
        "future-none": "Future capacity: not provided. No Task receives a future plan date.",
        "future-awaiting": "Future capacity ({mode}): awaiting confirmation. No Task receives a future plan date.",
        "future-confirmed": "Future capacity ({mode}, confirmed {confirmedAt}): {minutes} min on {days}, {buffer}% buffer.",
        "mode-explicit": "explicit",
        "mode-assumed": "assumed",
        "no-weekdays": "no weekdays",
        "weekday-joiner": ", ",
        "section-working": "Working plan",
        "section-recommended": "Recommended base",
        "section-evidence": "Evidence base",
        "section-gap": "Gaps",
        "section-conflict": "Conflicts",
        "no-tasks": "_No Tasks._",
        "no-base": "_No base selected. Choose the recommended base or the evidence base; they are never mixed._",
        "day": "{date} — {used} of {capacity} min",
        "estimate": "{min}–{max} min ({basis})",
        "no-estimate": "no estimate",
        "basis-user": "your estimate",
        "basis-task-text": "from the Task",
        "basis-inference": "inferred",
        "item": "- {id} {link} — {estimate}. {reason}",
        "summary-title": "What this plan changes",
        "counts": "Change: {changed} · No change: {unchanged} · Not scheduled: {unplaced}",
        "proposal": "- Task change review {id} ({scope}, plan revision {revision}): {count} included.",
        "scope-all": "all dates",
        "scope-today": "today",
        "change-prefix": "Change: ",
        "part-joiner": "; ",
        "list-joiner": ", ",
        "date-new": "add date {new}",
        "date-past": "move past date {old} → {new}",
        "date-earlier": "move date earlier {old} → {new}",
        "date-later": "move date later {old} → {new}",
        "cause-capacity": " (not enough time)",
        "cause-user": " (placed by you)",
        "labels": "add labels {labels}",
        "steps": "set Steps ({count})",
        "notes": "update Notes",
        "unchanged": "No change: stays on {date}",
        "not-scheduled": "No change: not scheduled in this plan",
        "in-review": "In Task change review {id}.",
        "revised-after": "Revised after Task change review {id}; a new review is needed to include the revision.",
        "omitted-no-change": "Not in Task change review {id}: nothing changes.",
        "omitted-stale": "Not in Task change review {id}: the Task changed after planning.",
        "omitted-completed": "Not in Task change review {id}: the Task is already completed.",
        "omitted-missing": "Not in Task change review {id}: the Task no longer exists.",
        "detail-future-capacity-unconfirmed": "Does not fit today, and future capacity is not confirmed.",
        "detail-oversized": "Larger than any confirmed day's capacity.",
        "detail-no-usable-capacity": "No confirmed capacity within {days} days.",
        "detail-missing-effort": "No credible effort range.",
        "detail-needs-breakdown": "Needs to be broken down before scheduling.",
        "detail-deadline-capacity": "Earliest capacity is {earliest}, after the deadline {deadline}.",
        "reason": "{reason} (rolling plan {plan} {item}{details})",
        "reason-joiner": "; ",
        "reason-capacity": "moved from {date} for capacity",
        "reason-overdue": "overdue from {date}",
        "reason-user": "placed by the user",
    },
    "ja": {
        "title": "{date}からの計画",
        "today": "今日の作業時間は{planning}分（{available}分から余白{buffer}%を引いた分）。",
        "future-none": "今後の作業時間：まだ決めていません。今日より先の日付にはTaskを入れません。",
        "future-awaiting": "今後の作業時間（{mode}）：確認待ちです。今日より先の日付にはTaskを入れません。",
        "future-confirmed": "今後の作業時間（{mode}、{confirmedAt}に確認）：{days}に{minutes}分、余白{buffer}%。",
        "mode-explicit": "指定",
        "mode-assumed": "仮の案",
        "no-weekdays": "曜日の指定なし",
        "weekday-joiner": "・",
        "section-working": "作業計画",
        "section-recommended": "推奨案",
        "section-evidence": "根拠案",
        "section-gap": "日付を決めていないもの",
        "section-conflict": "締め切りと合わないもの",
        "no-tasks": "_Taskはありません。_",
        "no-base": "_まだ案を選んでいません。推奨案か根拠案のどちらかを選んでください。2つの案を混ぜることはありません。_",
        "day": "{date} — {used} / {capacity}分",
        "estimate": "{min}〜{max}分（{basis}）",
        "no-estimate": "見積もりなし",
        "basis-user": "あなたの見積もり",
        "basis-task-text": "Taskの記載から",
        "basis-inference": "推定",
        "item": "- {id} {link} — {estimate}。{reason}",
        "summary-title": "この計画で変わること",
        "counts": "変わる：{changed}件・変わらない：{unchanged}件・日付を決めていない：{unplaced}件",
        "proposal": "- Task変更レビュー {id}（{scope}、計画の版 {revision}）：{count}件を含めました。",
        "scope-all": "全日程",
        "scope-today": "今日の分",
        "change-prefix": "変更：",
        "part-joiner": "、",
        "list-joiner": "・",
        "date-new": "日付を追加 {new}",
        "date-past": "過ぎた予定日を移動 {old} → {new}",
        "date-earlier": "日付を前倒し {old} → {new}",
        "date-later": "日付を後ろ倒し {old} → {new}",
        "cause-capacity": "（時間が足りないため）",
        "cause-user": "（あなたが配置）",
        "labels": "ラベルを追加 {labels}",
        "steps": "Stepsを設定（{count}件）",
        "notes": "Notesを更新",
        "unchanged": "変更なし：{date}のまま",
        "not-scheduled": "変更なし：この計画では日付を決めていません",
        "in-review": "Task変更レビュー {id} に含めています。",
        "revised-after": "Task変更レビュー {id} の後に修正しました。反映するには新しいレビューが必要です。",
        "omitted-no-change": "変わらないため、Task変更レビュー {id} に含めていません。",
        "omitted-stale": "計画の後でTaskが変更されたため、Task変更レビュー {id} に含めていません。",
        "omitted-completed": "Taskが完了しているため、Task変更レビュー {id} に含めていません。",
        "omitted-missing": "Taskが見つからないため、Task変更レビュー {id} に含めていません。",
        "detail-future-capacity-unconfirmed": "今日には入らず、今後の作業時間がまだ確認されていません。",
        "detail-oversized": "どの日の作業時間よりも大きい作業です。",
        "detail-no-usable-capacity": "{days}日以内に確認済みの作業時間がありません。",
        "detail-missing-effort": "所要時間の見当がつきません。",
        "detail-needs-breakdown": "日付を決める前に分ける必要があります。",
        "detail-deadline-capacity": "空いている最初の日は{earliest}で、締め切りの{deadline}より後です。",
        "reason": "{reason}（計画 {plan} の {item}{details}）",
        "reason-joiner": "、",
        "reason-capacity": "時間が足りないため{date}から移動",
        "reason-overdue": "予定日{date}を過ぎていた",
        "reason-user": "あなたが配置",
    },
}
WEEKDAY_NAMES = {"en": ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"), "ja": ("月", "火", "水", "木", "金", "土", "日")}


def say(language: str, key: str, **values: Any) -> str:
    return TEXT[language][key].format(**values)


# Set from --language, the language the agent resolved from the Sources or the user when TaskMate's setting does not
# decide it. A language TaskMate's setting decides always wins.
LANGUAGE_OVERRIDE: Optional[str] = None


def output_language(vault: Path) -> str:
    language = todo_store.output_language(vault)["language"]
    if language in TEXT:
        return language
    if LANGUAGE_OVERRIDE in TEXT:
        return LANGUAGE_OVERRIDE
    fail("the output language is unknown: TaskMate's setting does not decide it. Ask the user which language to use and pass --language ja or --language en")


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
    if plan.get("schemaVersion") != SCHEMA_VERSION:
        fail(f"plan {plan_id} uses schema version {plan.get('schemaVersion')} from an earlier Task Pilot; create a new plan from current Tasks without --supersedes")
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


def save_plan(vault: Path, path: Path, plan: Dict[str, Any]) -> None:
    # Each write follows the current language setting; the stored value lets a later load re-render the file exactly.
    plan["language"] = output_language(vault)
    todo_store.atomic_write(path, render_plan(plan))


def validated_text(value: Any, name: str, limit: int) -> str:
    text = str(value or "").strip()
    if not text:
        fail(f"{name} is required; write it in the output language reported by todo_store.py language")
    if "\n" in text or "\r" in text or "<!--" in text:
        fail(f"{name} must be one paragraph without line breaks or HTML comments")
    if len(text) > limit:
        fail(f"{name} must be at most {limit} characters")
    return text


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
            "currentLabels": list(task["labels"]), "currentSteps": task["steps"], "currentNotes": task["notes"],
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
        public = {key: entry[key] for key in (
            "taskId", "title", "path", "currentDate", "currentLabels", "currentSteps", "currentNotes",
            "snapshot", "order", "reason", "estimate", "proposedFields",
        )}
        return {**public, "kind": kind, "reasonCodes": list(entry["reasonCodes"]), **values}

    # Gaps and conflicts found here carry a detailKey rendered in the plan's language; ones the agent supplied carry
    # its own detail text.
    def found(entry: Dict[str, Any], kind: str, code: str, detail_key: str, **detail_values: Any) -> Dict[str, Any]:
        return record(entry, kind, code=code, detailKey=detail_key, detailValues=detail_values)

    def unplaced(entry: Dict[str, Any], minutes: int) -> Dict[str, Any]:
        if not future_confirmed(capacity):
            return found(entry, "gap", "future-capacity-unconfirmed", "future-capacity-unconfirmed")
        if minutes > largest_day:
            return found(entry, "gap", "needs-breakdown", "oversized")
        return found(entry, "gap", "no-usable-capacity", "no-usable-capacity", days=HORIZON_LIMIT_DAYS)

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
            results.append(found(entry, "gap", code, code))
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
            results.append(found(entry, "conflict", "deadline-capacity", "deadline-capacity", earliest=day.isoformat(), deadline=entry["deadline"]))
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


def long_date(language: str, value: str, target: dt.date) -> str:
    day = dt.date.fromisoformat(value)
    weekday = WEEKDAY_NAMES[language][day.weekday()]
    if language == "ja":
        prefix = f"{day.month}月{day.day}日" if day.year == target.year else f"{day.year}年{day.month}月{day.day}日"
        return f"{prefix}（{weekday}）"
    return f"{value} ({weekday})"


def short_date(language: str, value: str, target: dt.date) -> str:
    if language != "ja":
        return long_date(language, value, target)
    day = dt.date.fromisoformat(value)
    prefix = f"{day.month}/{day.day}" if day.year == target.year else f"{day.year}/{day.month}/{day.day}"
    return f"{prefix}（{WEEKDAY_NAMES[language][day.weekday()]}）"


def estimate_text(language: str, estimate: Optional[Dict[str, Any]]) -> str:
    if not estimate:
        return say(language, "no-estimate")
    basis = say(language, f"basis-{estimate['basis']}")
    return say(language, "estimate", min=estimate["minMinutes"], max=estimate["maxMinutes"], basis=basis)


def task_link(item: Dict[str, Any]) -> str:
    target = str(item["path"]).removesuffix(".md")
    title = str(item["title"]).replace("|", "/").replace("]", ")").replace("[", "(")
    return f"[[{target}|{title}]]"


def snapshot_changes(item: Dict[str, Any]) -> Dict[str, Any]:
    """The Task changes a planned item implies, judged against the Task as it was when the plan was made."""
    baseline = {"date": item["currentDate"], "labels": item["currentLabels"], "steps": item["currentSteps"], "notes": item["currentNotes"]}
    return proposed_changes(item, baseline)


def change_text(language: str, item: Dict[str, Any], target: dt.date) -> str:
    changes = snapshot_changes(item)
    if not changes:
        return say(language, "unchanged", date=short_date(language, item["plannedDate"], target))
    parts = []
    if "date" in changes:
        new = short_date(language, item["plannedDate"], target)
        old = item["currentDate"]
        if old is None:
            part = say(language, "date-new", new=new)
        else:
            kind = "date-past" if dt.date.fromisoformat(old) < target else "date-earlier" if item["plannedDate"] < old else "date-later"
            part = say(language, kind, old=short_date(language, old, target), new=new)
        codes = item.get("moveCodes", [])
        if "moved-capacity" in codes:
            part += say(language, "cause-capacity")
        elif "user-moved" in codes or "user-scheduled" in codes:
            part += say(language, "cause-user")
        parts.append(part)
    if "addLabels" in changes:
        parts.append(say(language, "labels", labels=say(language, "list-joiner").join(changes["addLabels"])))
    if "steps" in changes:
        parts.append(say(language, "steps", count=len(changes["steps"])))
    if "notes" in changes:
        parts.append(say(language, "notes"))
    return say(language, "change-prefix") + say(language, "part-joiner").join(parts)


def review_status(language: str, item: Dict[str, Any], plan: Dict[str, Any]) -> Optional[str]:
    proposal_id = item.get("proposalId")
    if proposal_id and item.get("proposedItemRevision") == item["revision"]:
        return say(language, "in-review", id=proposal_id)
    for proposal in reversed(plan.get("proposals") or []):
        # A Proposal no longer describes an item revised after it was created.
        if item["revision"] >= proposal["planRevision"]:
            continue
        reasons = {value["id"]: value["reason"] for value in proposal["omitted"]}
        if reasons.get(item["id"]) in OMISSION_REASONS:
            return say(language, f"omitted-{reasons[item['id']]}", id=proposal["proposalId"])
    if proposal_id:
        return say(language, "revised-after", id=proposal_id)
    return None


def unplaced_text(language: str, item: Dict[str, Any], target: dt.date) -> str:
    if not item.get("detailKey"):
        return item["detail"]
    values = dict(item.get("detailValues") or {})
    for key in ("earliest", "deadline"):
        if key in values:
            values[key] = short_date(language, values[key], target)
    return say(language, f"detail-{item['detailKey']}", **values)


def item_lines(language: str, item: Dict[str, Any], section: str, plan: Dict[str, Any], target: dt.date) -> List[str]:
    if item["kind"] == "planned":
        lines = [
            say(language, "item", id=item["id"], link=task_link(item), estimate=estimate_text(language, item["estimate"]), reason=item["reason"]),
            "  - " + change_text(language, item, target),
        ]
        status = review_status(language, item, plan)
        if status:
            lines.append("  - " + status)
    else:
        lines = [f"- {item['id']} {task_link(item)} — {unplaced_text(language, item, target)}", "  - " + say(language, "not-scheduled")]
    return [*lines, "  <!-- taskmate-plan-item " + comment_json({**item, "section": section}) + " -->"]


def section_lines(language: str, section: str, items: List[Dict[str, Any]], plan: Dict[str, Any], target: dt.date) -> List[str]:
    lines = [f"## {say(language, f'section-{section}')}", ""]
    planned = [item for item in items if item["kind"] == "planned"]
    for date in sorted({item["plannedDate"] for item in planned}):
        day = dt.date.fromisoformat(date)
        day_items = [item for item in planned if item["plannedDate"] == date]
        used = sum(item["estimate"]["maxMinutes"] for item in day_items)
        capacity = day_capacity(plan["capacity"], target, day)
        lines += [f"### {say(language, 'day', date=long_date(language, date, target), used=used, capacity=capacity)}", ""]
        for item in day_items:
            lines += item_lines(language, item, section, plan, target)
        lines.append("")
    for kind in ("gap", "conflict"):
        group = [item for item in items if item["kind"] == kind]
        if group:
            lines += [f"### {say(language, f'section-{kind}')}", ""]
            for item in group:
                lines += item_lines(language, item, section, plan, target)
            lines.append("")
    if not items:
        lines += [say(language, "no-tasks"), ""]
    return lines


def summary_lines(language: str, plan: Dict[str, Any]) -> List[str]:
    working = plan["working"]
    planned = [item for item in working if item["kind"] == "planned"]
    changed = sum(1 for item in planned if snapshot_changes(item))
    lines = [f"## {say(language, 'summary-title')}", ""]
    if plan.get("summary"):
        lines += [plan["summary"], ""]
    lines += [say(language, "counts", changed=changed, unchanged=len(planned) - changed, unplaced=len(working) - len(planned)), ""]
    proposals = plan.get("proposals") or []
    for proposal in proposals:
        scope = proposal["scope"]
        scope_text = ", ".join(scope["requested"]) if scope["kind"] == "items" else say(language, f"scope-{scope['kind']}")
        lines.append(say(language, "proposal", id=proposal["proposalId"], scope=scope_text, revision=proposal["planRevision"], count=len(proposal["itemIds"])))
    if proposals:
        lines.append("")
    return lines


def render_plan(plan: Dict[str, Any]) -> str:
    language = plan["language"]
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
    lines += [f"# {say(language, 'title', date=long_date(language, plan['targetDate'], target))}", "", "<!-- taskmate-plan " + comment_json(header) + " -->", ""]
    today = plan["capacity"]["today"]
    lines.append(say(language, "today", planning=planning_minutes(today["availableMinutes"], today["bufferPercent"]), available=today["availableMinutes"], buffer=today["bufferPercent"]))
    if future is None:
        lines.append(say(language, "future-none"))
    else:
        mode = say(language, f"mode-{future['mode']}")
        if future["confirmedAt"] is None:
            lines.append(say(language, "future-awaiting", mode=mode))
        else:
            names = [WEEKDAY_NAMES[language][WEEKDAYS.index(day)] for day in future["weekdays"]]
            days = say(language, "weekday-joiner").join(names) or say(language, "no-weekdays")
            lines.append(say(language, "future-confirmed", mode=mode, confirmedAt=future["confirmedAt"], minutes=future["dailyMinutes"], days=days, buffer=future["bufferPercent"]))
    lines.append("")
    if plan["working"] is None:
        lines += [f"## {say(language, 'section-working')}", "", say(language, "no-base"), ""]
    else:
        lines += summary_lines(language, plan)
        lines += section_lines(language, "working", plan["working"], plan, target)
    for base in BASES:
        lines += section_lines(language, base, plan["bases"][base], plan, target)
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
        "counters": {"gap": 0, "conflict": 0, "plan": 0}, "proposals": [], "summary": None, "bases": {}, "working": None,
    }
    bases = request.get("bases")
    if not isinstance(bases, dict) or set(bases) != set(BASES):
        fail("request.bases requires exactly recommended and evidence")
    for base in BASES:
        entries = validated_entries(args.vault, args.task_folder, base, bases[base])
        plan["bases"][base] = numbered(place_base(entries, capacity, target), BASE_PREFIX[base], plan, base)
    plan["endDate"] = end_date(plan)
    save_plan(args.vault, path, plan)
    if superseded:
        old_path, old = superseded
        old["status"], old["supersededBy"] = "superseded", args.plan_id
        bump(old)
        save_plan(args.vault, old_path, old)
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
    plan["summary"] = validated_text(args.summary, "--summary", SUMMARY_LIMIT)
    plan["endDate"] = end_date(plan)
    save_plan(args.vault, path, plan)
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
    if plan["status"] not in {"ready", "proposal-created"} or plan["working"] is None:
        fail("only a selected working plan can be revised")
    summary_text = validated_text(args.summary, "--summary", SUMMARY_LIMIT)
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
            for key in ("plannedDate", "moveCodes", "detailKey", "detailValues"):
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
            for key in ("code", "detail", "detailKey", "detailValues"):
                item.pop(key, None)
            items[item["id"]] = item
        elif operation == "set-fields":
            item["proposedFields"] = validated_proposed_fields(change.get("proposedFields"), item["taskId"])
        else:
            fail(f"unsupported revision operation: {operation}")
        item["reason"] = reason
        item["revision"] = plan["revision"]
    plan["working"] = sorted(items.values(), key=sort_key)
    plan["summary"] = summary_text
    plan["endDate"] = end_date(plan)
    save_plan(args.vault, path, plan)
    print_result(args.vault, path, plan)


def proposal_reason(language: str, plan: Dict[str, Any], item: Dict[str, Any]) -> str:
    codes = item.get("moveCodes", [])
    details = []
    if "moved-capacity" in codes:
        details.append(say(language, "reason-capacity", date=item["currentDate"]))
    if "overdue" in codes:
        details.append(say(language, "reason-overdue", date=item["currentDate"]))
    if "user-moved" in codes or "user-scheduled" in codes:
        details.append(say(language, "reason-user"))
    joiner = say(language, "reason-joiner")
    suffix = joiner + joiner.join(details) if details else ""
    return say(language, "reason", reason=item["reason"], plan=plan["planId"], item=item["id"], details=suffix)


def validated_task_summaries(plan: Dict[str, Any], path: Path) -> Dict[str, str]:
    raw = planning_store.read_json(path)
    known = {item["id"] for item in plan["working"]}
    summaries = {}
    for item_id, value in raw.items():
        if item_id not in known:
            fail(f"unknown working-plan item in --task-summaries: {item_id}")
        summaries[item_id] = validated_text(value, f"task summary for {item_id}", TASK_SUMMARY_LIMIT)
    return summaries


def selected_items(plan: Dict[str, Any], args: argparse.Namespace) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    planned = [item for item in plan["working"] if item["kind"] == "planned"]
    if args.items:
        by_id = {item["id"]: item for item in plan["working"]}
        requested = list(dict.fromkeys(value.strip() for value in args.items.split(",") if value.strip()))
        for item_id in requested:
            if item_id not in by_id:
                fail(f"unknown working-plan item: {item_id}")
            if by_id[item_id]["kind"] != "planned":
                fail(f"only planned PLAN items can be proposed: {item_id}")
        return [by_id[item_id] for item_id in requested], {"kind": "items", "requested": requested}
    if args.today_only:
        return [item for item in planned if item["plannedDate"] == plan["targetDate"]], {"kind": "today"}
    return planned, {"kind": "all"}


def proposed_changes(item: Dict[str, Any], task: Dict[str, Any]) -> Dict[str, Any]:
    changes: Dict[str, Any] = {}
    if item["plannedDate"] != task["date"]:
        changes["date"] = item["plannedDate"]
    fields = item["proposedFields"]
    labels = [label for label in fields.get("addLabels", []) if label not in task["labels"]]
    if labels:
        changes["addLabels"] = labels
    if "steps" in fields and fields["steps"] != task["steps"]:
        changes["steps"] = fields["steps"]
    if "notes" in fields and fields["notes"] != task["notes"]:
        changes["notes"] = fields["notes"]
    return changes


def command_proposal(args: argparse.Namespace) -> None:
    path, plan = load_plan(args.vault, args.plan_id)
    check_revision(plan, args.revision)
    if plan["status"] not in {"ready", "proposal-created"} or plan["working"] is None:
        fail("a Task change Proposal can be generated only from a selected working plan")
    planning_store.validated_proposal_id(args.proposal_id)
    language = output_language(args.vault)
    task_summaries = validated_task_summaries(plan, args.task_summaries)
    selected, scope = selected_items(plan, args)
    if not selected:
        fail("the requested scope contains no planned items")
    tasks = {task["id"]: task for task in todo_store.all_tasks(args.vault, args.task_folder)}
    review, included, omitted = [], [], []
    for item in sorted(selected, key=sort_key):
        task = tasks.get(item["taskId"])
        status = None
        if task is None:
            status = "missing"
        elif task["completed"]:
            status = "completed"
        elif planning_store.task_snapshot(args.vault, task) != item["snapshot"]:
            status = "stale"
        elif item.get("proposalId") and item.get("proposedItemRevision") == item["revision"]:
            status = "already-proposed"
        changes = {} if status else proposed_changes(item, task)
        if not status and not changes:
            status = "no-change"
        if status:
            omitted.append({"id": item["id"], "taskId": item["taskId"], "title": item["title"], "reason": status})
            continue
        review.append({
            "taskId": item["taskId"], "snapshot": item["snapshot"], "changes": changes,
            "reason": proposal_reason(language, plan, item), "dateAuthority": f"rolling plan {plan['planId']} {item['id']}",
        })
        included.append({"id": item["id"], "taskId": item["taskId"], "title": item["title"], "fields": sorted(changes)})
    if not review:
        fail("no Task changes to propose; omitted: " + ", ".join(f"{value['id']} ({value['reason']})" for value in omitted))
    missing_lines = [value["id"] for value in included if value["id"] not in task_summaries]
    if missing_lines:
        fail("--task-summaries needs a one-line summary for every included item; missing: " + ", ".join(missing_lines))
    result = planning_store.write_task_change_proposal(
        args.vault, args.task_folder, {"proposals": review}, args.proposal_id,
        summary=plan.get("summary"), task_summaries={value["taskId"]: task_summaries[value["id"]] for value in included},
    )
    bump(plan)
    included_ids = {value["id"] for value in included}
    for item in plan["working"]:
        if item["id"] in included_ids:
            item["proposalId"] = args.proposal_id
            item["proposedItemRevision"] = item["revision"]
    plan["status"] = "proposal-created"
    plan.setdefault("proposals", []).append({
        "proposalId": args.proposal_id, "createdAt": plan["updatedAt"], "planRevision": plan["revision"],
        "scope": scope, "itemIds": [value["id"] for value in included], "omitted": omitted,
    })
    save_plan(args.vault, path, plan)
    output = {
        **result, "opened": False, "planId": plan["planId"], "planRevision": plan["revision"], "status": plan["status"],
        "scope": scope, "included": included, "omitted": omitted,
    }
    if args.open_review:
        try:
            planning_store.open_review_uri(result["uri"])
            output["opened"] = True
        except SystemExit as error:
            output["openError"] = str(error)
    print(json.dumps(output, ensure_ascii=False, indent=2))


def command_close(args: argparse.Namespace) -> None:
    path, plan = load_plan(args.vault, args.plan_id)
    check_revision(plan, args.revision)
    if plan["status"] not in MUTABLE_STATUSES:
        fail(f"plan cannot be closed from status {plan['status']}")
    bump(plan)
    plan["status"] = "closed"
    save_plan(args.vault, path, plan)
    print_result(args.vault, path, plan)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--vault", required=True, type=lambda value: Path(value).resolve())
    result.add_argument("--task-folder")
    result.add_argument("--language", choices=sorted(TEXT), help="output language when TaskMate's setting does not decide it")
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
    select.add_argument("--summary", required=True, help="short report, in the output language, of what the working plan changes")
    select.set_defaults(run=command_select_base)

    revise = commands.add_parser("revise")
    revise.add_argument("--plan-id", required=True, type=validated_plan_id)
    revise.add_argument("--revision", required=True, type=int)
    revise.add_argument("--changes", required=True, type=Path)
    revise.add_argument("--summary", required=True, help="short report, in the output language, of what the revised plan changes")
    revise.set_defaults(run=command_revise)

    proposal = commands.add_parser("proposal")
    proposal.add_argument("--plan-id", required=True, type=validated_plan_id)
    proposal.add_argument("--revision", required=True, type=int)
    proposal.add_argument("--proposal-id", required=True)
    proposal.add_argument("--task-summaries", required=True, type=Path, help="JSON object mapping PLAN-xx IDs to one-line summaries")
    scope = proposal.add_mutually_exclusive_group()
    scope.add_argument("--today-only", action="store_true")
    scope.add_argument("--items")
    proposal.add_argument("--open-review", action="store_true")
    proposal.set_defaults(run=command_proposal)

    close = commands.add_parser("close")
    close.add_argument("--plan-id", required=True, type=validated_plan_id)
    close.add_argument("--revision", required=True, type=int)
    close.set_defaults(run=command_close)
    return result


def main() -> None:
    args = parser().parse_args()
    if not args.vault.is_dir():
        fail(f"vault does not exist: {args.vault}")
    global LANGUAGE_OVERRIDE
    LANGUAGE_OVERRIDE = args.language
    args.run(args)


if __name__ == "__main__":
    main()
