#!/usr/bin/env python3
"""Deterministic review and capacity-planning operations for Task Pilot."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

import todo_store


def fail(message: str) -> None:
    raise SystemExit(message)


def task_snapshot(vault: Path, task: Dict[str, Any]) -> str:
    path = todo_store.safe_path(vault, str(task["path"]))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def incomplete_tasks(vault: Path, override: Optional[str]) -> List[Dict[str, Any]]:
    return [task for task in todo_store.all_tasks(vault, override) if not task["completed"]]


def read_json(path: Path) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"cannot read JSON: {error}")
    if not isinstance(value, dict):
        fail("JSON root must be an object")
    return value


def proposal_identifier(proposal: Dict[str, Any]) -> str:
    stable = json.dumps({
        "taskId": proposal["taskId"],
        "snapshot": proposal["snapshot"],
        "changes": proposal.get("changes") or {},
        "disposition": proposal.get("disposition", "change"),
        "reason": proposal["reason"],
    }, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "review-" + hashlib.sha256(stable.encode("utf-8")).hexdigest()[:16]


def validated_review(vault: Path, override: Optional[str], plan: Dict[str, Any], require_current: bool = True) -> Dict[str, Any]:
    raw_proposals = plan.get("proposals")
    if not isinstance(raw_proposals, list):
        fail("review plan requires a proposals array")
    tasks = {task["id"]: task for task in incomplete_tasks(vault, override)}
    proposals, seen = [], set()
    for raw in raw_proposals:
        if not isinstance(raw, dict):
            fail("each review proposal must be an object")
        task_id = raw.get("taskId")
        task = tasks.get(task_id)
        if task is None:
            fail(f"review proposal task is not an incomplete canonical Task: {task_id}")
        if task_id in seen:
            fail(f"duplicate review proposal for Task: {task_id}")
        seen.add(task_id)
        snapshot = raw.get("snapshot")
        if not isinstance(snapshot, str) or len(snapshot) != 64:
            fail(f"review proposal requires a snapshot for Task: {task_id}")
        current_snapshot = task_snapshot(vault, task)
        if require_current and snapshot != current_snapshot:
            fail(f"Task changed after inspection: {task_id}")
        reason = str(raw.get("reason") or "").strip()
        if not reason:
            fail(f"review proposal requires a reason for Task: {task_id}")
        disposition = raw.get("disposition", "change")
        if disposition not in {"change", "clarify", "no-change"}:
            fail(f"unsupported review disposition for Task: {task_id}")
        changes = raw.get("changes") or {}
        if not isinstance(changes, dict):
            fail(f"review proposal changes must be an object for Task: {task_id}")
        if disposition == "change" and not changes:
            fail(f"change proposal requires visible changes for Task: {task_id}")
        if disposition != "change" and changes:
            fail(f"{disposition} proposal cannot change Task: {task_id}")
        unexpected = set(changes) - {"date", "priority", "addLabels", "removeLabels"}
        if unexpected:
            fail(f"unsupported review changes for Task {task_id}: {', '.join(sorted(unexpected))}")
        if "date" in changes:
            todo_store.validate_date(changes["date"])
            if changes["date"] is not None and changes["date"] != task["date"] and not str(raw.get("dateAuthority") or "").strip():
                fail(f"date change requires dateAuthority for Task: {task_id}")
        if "priority" in changes:
            todo_store.validate_priority(changes["priority"])
            if changes["priority"] != task["priority"] and raw.get("priorityEvidence") not in {
                "user-focus", "hard-deadline", "commitment", "dependency", "blocker",
            }:
                fail(f"priority change requires accepted evidence for Task: {task_id}")
        for key in ("addLabels", "removeLabels"):
            if key not in changes:
                continue
            labels = changes[key]
            if not isinstance(labels, list) or any(not isinstance(label, str) or not label.startswith("context/") for label in labels):
                fail(f"{key} must contain only context/* labels for Task: {task_id}")
        proposal = {
            "proposalId": proposal_identifier(raw),
            "taskId": task_id,
            "title": task["title"],
            "snapshot": snapshot,
            "currentSnapshot": current_snapshot,
            "changes": changes,
            "reason": reason,
            "disposition": disposition,
        }
        proposals.append(proposal)

    grouped: Dict[str, Dict[str, Any]] = {}
    for proposal in (proposal for proposal in proposals if proposal["disposition"] == "change"):
        key = json.dumps({"changes": proposal["changes"], "reason": proposal["reason"]}, ensure_ascii=False, sort_keys=True)
        if key not in grouped:
            grouped[key] = {
                "groupId": "group-" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:12],
                "changes": proposal["changes"],
                "reason": proposal["reason"],
                "members": [],
            }
        grouped[key]["members"].append({
            "proposalId": proposal["proposalId"],
            "taskId": proposal["taskId"],
            "title": proposal["title"],
        })
    return {
        "proposals": proposals,
        "groups": list(grouped.values()),
        "clarifications": [proposal for proposal in proposals if proposal["disposition"] == "clarify"],
        "noChange": [proposal for proposal in proposals if proposal["disposition"] == "no-change"],
    }


def command_inspect(args: argparse.Namespace) -> None:
    tasks = incomplete_tasks(args.vault, args.task_folder)
    today = dt.date.fromisoformat(args.today)
    result_tasks = []
    for task in tasks:
        item = dict(task)
        item["snapshot"] = task_snapshot(args.vault, task)
        result_tasks.append(item)
    scheduled = [task for task in tasks if task["date"]]
    print(json.dumps({
        "summary": {
            "incomplete": len(tasks),
            "scheduled": len(scheduled),
            "pastScheduled": sum(dt.date.fromisoformat(task["date"]) < today for task in scheduled),
            "today": sum(dt.date.fromisoformat(task["date"]) == today for task in scheduled),
            "unplanned": sum(task["date"] is None for task in tasks),
        },
        "tasks": result_tasks,
    }, ensure_ascii=False, indent=2))


def command_review(args: argparse.Namespace) -> None:
    print(json.dumps(validated_review(args.vault, args.task_folder, read_json(args.plan)), ensure_ascii=False, indent=2))


def command_apply(args: argparse.Namespace) -> None:
    review = validated_review(args.vault, args.task_folder, read_json(args.plan), require_current=False)
    decisions = read_json(args.decisions).get("approvedProposalIds")
    if not isinstance(decisions, list) or any(not isinstance(value, str) for value in decisions):
        fail("decisions require an approvedProposalIds string array")
    proposals = {proposal["proposalId"]: proposal for proposal in review["proposals"]}
    unknown = set(decisions) - set(proposals)
    if unknown:
        fail(f"unknown approved proposal: {sorted(unknown)[0]}")
    succeeded, failed = [], []
    for proposal_id in decisions:
        proposal = proposals[proposal_id]
        task_id = proposal["taskId"]
        if proposal["disposition"] != "change":
            fail(f"only change proposals can be approved for writing: {proposal_id}")
        try:
            _, task = todo_store.find_task(args.vault, args.task_folder, task_id)
            if task["completed"]:
                raise ValueError("Task is no longer incomplete")
            if task_snapshot(args.vault, task) != proposal["snapshot"]:
                raise ValueError("Task changed after review")
            changes = proposal["changes"]
            patch: Dict[str, Any] = {}
            for key in ("date", "priority"):
                if key in changes:
                    patch[key] = changes[key]
            if "addLabels" in changes or "removeLabels" in changes:
                removals = set(changes.get("removeLabels") or [])
                labels = [label for label in task["labels"] if label not in removals]
                for label in changes.get("addLabels") or []:
                    if label not in labels:
                        labels.append(label)
                patch["labels"] = labels
            updated = todo_store.update_task(args.vault, args.task_folder, task_id, patch)
            _, stored = todo_store.find_task(args.vault, args.task_folder, task_id)
            for key, expected in patch.items():
                if stored[key] != expected:
                    raise ValueError(f"saved Task failed validation for {key}")
            succeeded.append({"proposalId": proposal_id, "taskId": task_id, "path": updated["path"]})
        except (OSError, SystemExit, ValueError) as error:
            failed.append({"proposalId": proposal_id, "taskId": task_id, "error": str(error)})
    result = {
        "succeeded": succeeded,
        "failed": failed,
        "skippedProposalIds": [proposal_id for proposal_id in proposals if proposal_id not in decisions],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if failed:
        raise SystemExit(1)


INFERRED_RANGES = {(5, 15), (15, 30), (30, 60), (60, 120)}


def positive_integer(value: Any, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        fail(f"{name} must be a positive integer")
    return value


def validated_estimate(raw: Any, task_id: str, large_accepted: bool) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        fail(f"candidate requires an estimate for Task: {task_id}")
    minimum = positive_integer(raw.get("minMinutes"), "minMinutes")
    maximum = positive_integer(raw.get("maxMinutes"), "maxMinutes")
    if maximum < minimum:
        fail(f"estimate maximum is below minimum for Task: {task_id}")
    basis = raw.get("basis")
    if basis not in {"user", "task-text", "inference"}:
        fail(f"estimate basis must be user, task-text, or inference for Task: {task_id}")
    if basis == "inference" and (minimum, maximum) not in INFERRED_RANGES:
        fail(f"inferred estimate must use a coarse accepted range for Task: {task_id}")
    if maximum > 120 and not large_accepted:
        fail(f"estimate over 120 minutes requires largeAccepted for Task: {task_id}")
    return {"minMinutes": minimum, "maxMinutes": maximum, "basis": basis}


def command_plan(args: argparse.Namespace) -> None:
    request = read_json(args.request)
    available = positive_integer(request.get("availableMinutes"), "availableMinutes")
    buffer_percent = request.get("bufferPercent", 20)
    if not isinstance(buffer_percent, int) or isinstance(buffer_percent, bool) or not 0 <= buffer_percent < 100:
        fail("bufferPercent must be an integer from 0 through 99")
    buffer_minutes = math.floor(available * buffer_percent / 100)
    planning_minutes = available - buffer_minutes
    requested_contexts = request.get("requestedContexts") or []
    if not isinstance(requested_contexts, list) or any(not isinstance(value, str) or not value.strip() for value in requested_contexts):
        fail("requestedContexts must be a string array")
    requested_contexts = [value.removeprefix("context/").strip() for value in requested_contexts]
    raw_candidates = request.get("candidates")
    if not isinstance(raw_candidates, list):
        fail("planning request requires a candidates array")
    tasks = {task["id"]: task for task in incomplete_tasks(args.vault, args.task_folder)}
    candidates, seen = [], set()
    for position, raw in enumerate(raw_candidates):
        if not isinstance(raw, dict):
            fail("each planning candidate must be an object")
        task_id = raw.get("taskId")
        task = tasks.get(task_id)
        if task is None:
            fail(f"planning candidate is not an incomplete canonical Task: {task_id}")
        if task_id in seen:
            fail(f"duplicate planning candidate for Task: {task_id}")
        seen.add(task_id)
        stage = raw.get("stage")
        if stage not in {"must", "compare"}:
            fail(f"candidate stage must be must or compare for Task: {task_id}")
        reason = str(raw.get("reason") or "").strip()
        if not reason:
            fail(f"planning candidate requires a reason for Task: {task_id}")
        needs_breakdown = raw.get("needsBreakdown") is True
        estimate = None if needs_breakdown else validated_estimate(raw.get("estimate"), task_id, raw.get("largeAccepted") is True)
        inferred_contexts = raw.get("inferredContexts") or []
        if not isinstance(inferred_contexts, list) or any(not isinstance(value, str) for value in inferred_contexts):
            fail(f"inferredContexts must be a string array for Task: {task_id}")
        inferred_contexts = [value.removeprefix("context/") for value in inferred_contexts]
        explicit_contexts = {label.removeprefix("context/") for label in task["labels"] if label.startswith("context/")}
        if any(context in explicit_contexts for context in requested_contexts):
            context_evidence = "explicit"
        elif any(context in inferred_contexts for context in requested_contexts):
            context_evidence = "inferred"
        else:
            context_evidence = "none"
        conflict = raw.get("constraintConflict")
        if conflict is not None and not str(conflict).strip():
            fail(f"constraintConflict must explain the contradiction for Task: {task_id}")
        schedule_priority_conflict = raw.get("schedulePriorityConflict") is True
        tradeoff = str(raw.get("tradeoff") or "").strip()
        needs_user_decision = raw.get("needsUserDecision") is True or needs_breakdown
        if schedule_priority_conflict and not tradeoff and not needs_user_decision:
            fail(f"schedule/Priority conflict requires a tradeoff or user decision for Task: {task_id}")
        comparison_rank = raw.get("comparisonRank", 0)
        if stage == "compare" and (not isinstance(comparison_rank, (int, float)) or isinstance(comparison_rank, bool)):
            fail(f"comparisonRank must be numeric for Task: {task_id}")
        candidates.append({
            "taskId": task_id,
            "title": task["title"],
            "stage": stage,
            "estimate": estimate,
            "reason": reason,
            "contextEvidence": context_evidence,
            "constraintConflict": str(conflict).strip() if conflict is not None else None,
            "tradeoff": tradeoff or None,
            "needsUserDecision": needs_user_decision,
            "comparisonRank": comparison_rank,
            "manualRank": task["rank"],
            "position": position,
        })

    must = [candidate for candidate in candidates if candidate["stage"] == "must"]
    compare = sorted(
        (candidate for candidate in candidates if candidate["stage"] == "compare"),
        key=lambda candidate: (candidate["comparisonRank"], candidate["manualRank"], candidate["position"]),
    )
    planned, near_matches, omitted, clarification = [], [], [], []
    planned_upper = 0
    for candidate in [*must, *compare]:
        public = {key: value for key, value in candidate.items() if key not in {"comparisonRank", "manualRank", "position", "constraintConflict", "needsUserDecision"}}
        if candidate["constraintConflict"]:
            omitted.append({**public, "reasonExcluded": candidate["constraintConflict"]})
            continue
        if candidate["needsUserDecision"]:
            clarification.append(public)
            continue
        remaining = planning_minutes - planned_upper
        if candidate["estimate"]["maxMinutes"] <= remaining:
            planned.append(public)
            planned_upper += candidate["estimate"]["maxMinutes"]
        elif candidate["estimate"]["minMinutes"] <= remaining:
            near_matches.append(public)
        else:
            omitted.append({**public, "reasonExcluded": "Does not fit remaining planning capacity"})
    print(json.dumps({
        "capacity": {
            "availableMinutes": available,
            "bufferPercent": buffer_percent,
            "bufferMinutes": buffer_minutes,
            "planningMinutes": planning_minutes,
            "plannedUpperMinutes": planned_upper,
        },
        "planned": planned,
        "nearMatches": near_matches,
        "needsClarification": clarification,
        "omitted": omitted,
    }, ensure_ascii=False, indent=2))


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--vault", required=True, type=lambda value: Path(value).resolve())
    result.add_argument("--task-folder")
    commands = result.add_subparsers(dest="command", required=True)

    inspect = commands.add_parser("inspect")
    inspect.add_argument("--today", required=True)
    inspect.set_defaults(run=command_inspect)

    review = commands.add_parser("review")
    review.add_argument("--plan", required=True, type=Path)
    review.set_defaults(run=command_review)

    apply = commands.add_parser("apply")
    apply.add_argument("--plan", required=True, type=Path)
    apply.add_argument("--decisions", required=True, type=Path)
    apply.set_defaults(run=command_apply)

    plan = commands.add_parser("plan")
    plan.add_argument("--request", required=True, type=Path)
    plan.set_defaults(run=command_plan)
    return result


def main() -> None:
    args = parser().parse_args()
    if not args.vault.is_dir():
        fail(f"vault does not exist: {args.vault}")
    args.run(args)


if __name__ == "__main__":
    main()
