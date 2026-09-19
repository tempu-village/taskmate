#!/usr/bin/env python3
"""Stage and promote reviewed TaskMate imports without mixing drafts into Tasks."""

from __future__ import annotations

import argparse
from collections import Counter
import json
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from todo_store import (
    all_tasks, atomic_write, available_task_path, create_task, fail, find_task,
    mark_source, normalized_labels, now_iso, parse_scalar, plugin_settings,
    quote, safe_path, source_hash, source_records, split_document,
    top_level_properties, update_task, validate_date, validate_priority,
)

PROPOSAL_KEYS = (
    "proposal-id", "proposal-session", "operation", "decision", "created-at",
    "decided-at", "promoted-task-id", "source-note", "source-hash",
    "target-task-id", "target-task-updated-at", "date", "priority", "labels",
    "project", "task-notes", "coverage", "reason",
)


def load_json(path: Path) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"cannot read JSON: {error}")
    if not isinstance(value, dict):
        fail("JSON root must be an object")
    return value


def proposal_root(vault: Path, override: Optional[str]) -> Path:
    return safe_path(vault, override or str(plugin_settings(vault)["proposalFolder"]))


def encode_frontmatter(kind: str, properties: Dict[str, Any]) -> str:
    raw_enums = {"type", "operation", "decision", "status", "language"}
    lines = ["---", f"type: {kind}"]
    for key, value in properties.items():
        rendered = str(value) if key in raw_enums and value is not None else quote(value)
        lines.append(f"{key}: {rendered}")
    return "\n".join(lines + ["---"])


def decision_label(decision: str, language: str) -> Tuple[str, str]:
    labels = {
        "ja": {
            "pending": ("warning", "未判断 — Codexとの会話で確認してください"),
            "approved": ("success", "判断済み — 正式タスク化"),
            "revised": ("info", "判断済み — 修正後に正式タスク化"),
            "excluded": ("failure", "判断済み — 除外"),
        },
        "en": {
            "pending": ("warning", "Pending — review in the Codex conversation"),
            "approved": ("success", "Decided — promoted to a task"),
            "revised": ("info", "Decided — revised and promoted"),
            "excluded": ("failure", "Decided — excluded"),
        },
    }
    return labels.get(language, labels["en"])[decision]


def encode_proposal(proposal: Dict[str, Any], language: str) -> str:
    properties = {key: proposal.get(key) for key in PROPOSAL_KEYS}
    callout, label = decision_label(str(proposal["decision"]), language)
    coverage = "\n".join(f"- {item}" for item in proposal.get("coverage", [])) or "- (none)"
    reason = f"\n\n## Reason\n\n{proposal['reason']}" if proposal.get("reason") else ""
    body = (
        f"\n\n# {proposal['title']}\n\n> [!{callout}] {label}\n\n"
        f"## Covered source statements\n\n{coverage}{reason}\n"
    )
    return encode_frontmatter("taskmate-proposal", properties) + body


def encode_review(session: Dict[str, Any], proposals: List[Dict[str, Any]]) -> str:
    counts = {name: sum(item["decision"] == name for item in proposals) for name in ("pending", "approved", "revised", "excluded")}
    properties = {
        "session-id": session["session-id"], "status": session["status"],
        "language": session["language"], "created-at": session["created-at"],
        "decided-at": session.get("decided-at"), "source-snapshots": session["source-snapshots"],
        "proposal-ids": [item["proposal-id"] for item in proposals], "counts": counts,
    }
    rows = "\n".join(f"- [[Tasks/{Path(item['path']).stem}|{item['title']}]] — {item['decision']}" for item in proposals)
    marker = "判断済み" if session["status"] == "archived" and session["language"] == "ja" else ("Decided" if session["status"] == "archived" else "Review required")
    return encode_frontmatter("taskmate-proposal-session", properties) + f"\n\n# TaskMate proposal review\n\n> [!info] {marker}\n\n{rows}\n"


def read_document(path: Path) -> Tuple[Dict[str, Any], str]:
    lines, body = split_document(path.read_text(encoding="utf-8"))
    return top_level_properties(lines), body


def parse_proposal(path: Path, vault: Path) -> Dict[str, Any]:
    props, body = read_document(path)
    title = next((line[2:].strip() for line in body.splitlines() if line.startswith("# ")), path.stem)
    result = {key: props.get(key) for key in PROPOSAL_KEYS}
    result.update({"title": title, "path": path.relative_to(vault).as_posix()})
    result["coverage"] = result["coverage"] if isinstance(result["coverage"], list) else []
    result["labels"] = result["labels"] if isinstance(result["labels"], list) else []
    return result


def find_session(vault: Path, override: Optional[str], identifier: str) -> Tuple[Path, Dict[str, Any], List[Dict[str, Any]]]:
    if not identifier or Path(identifier).name != identifier:
        fail("invalid session id")
    root = proposal_root(vault, override)
    matches = [root / state / identifier for state in ("Active", "Archive") if (root / state / identifier / "Review.md").exists()]
    if len(matches) != 1:
        fail(f"expected one proposal session {identifier}, found {len(matches)}")
    folder = matches[0]
    props, _ = read_document(folder / "Review.md")
    proposals = [parse_proposal(path, vault) for path in sorted((folder / "Tasks").glob("*.md"))]
    return folder, props, proposals


def normalize_proposal(raw: Dict[str, Any], sources: Dict[str, Dict[str, Any]], vault: Path, task_override: Optional[str]) -> Dict[str, Any]:
    operation = raw.get("operation")
    if operation not in ("create", "merge", "exclude"):
        fail("proposal operation must be create, merge, or exclude")
    source = raw.get("sourceNote")
    if not isinstance(source, str) or source not in sources:
        fail(f"proposal source is not in the eligible source set: {source}")
    coverage = raw.get("coverage")
    if not isinstance(coverage, list) or not coverage or any(not isinstance(item, str) or not item.strip() for item in coverage):
        fail("each proposal must cover at least one source statement")
    target = None
    if operation == "merge":
        target_id = raw.get("targetTaskId")
        if not isinstance(target_id, str):
            fail("merge proposals require targetTaskId")
        _, target = find_task(vault, task_override, target_id)
    title = str(raw.get("title") or (target or {}).get("title") or "").strip()
    if not title:
        fail("proposal title is required")
    date = raw["date"] if "date" in raw else (target or {}).get("date")
    priority = raw["priority"] if "priority" in raw else (target or {}).get("priority")
    labels = normalized_labels(raw.get("labels", (target or {}).get("labels", [])))
    validate_date(date)
    validate_priority(priority)
    if operation == "exclude" and not str(raw.get("reason") or "").strip():
        fail("exclude proposals require a reason")
    return {
        "proposal-id": str(uuid.uuid4()), "operation": operation, "decision": "pending",
        "created-at": now_iso(), "decided-at": None, "promoted-task-id": None,
        "source-note": source, "source-hash": sources[source]["hash"],
        "target-task-id": (target or {}).get("id"), "target-task-updated-at": (target or {}).get("updated-at"),
        "title": title, "date": date, "priority": priority, "labels": labels,
        "project": raw["project"] if "project" in raw else (target or {}).get("project"),
        "task-notes": raw["notes"] if "notes" in raw else (target or {}).get("notes", ""),
        "coverage": [item.strip() for item in coverage], "reason": raw.get("reason"),
    }


def candidate_manifest(plan: Dict[str, Any], sources: Dict[str, Dict[str, Any]], vault: Path) -> set[Tuple[str, str]]:
    raw_candidates = plan.get("candidates")
    if not isinstance(raw_candidates, list) or not raw_candidates:
        fail("plan.candidates must be a non-empty array")
    candidates: set[Tuple[str, str]] = set()
    source_statements: Dict[str, set[str]] = {}
    for raw in raw_candidates:
        if not isinstance(raw, dict):
            fail("every candidate must be an object")
        source = raw.get("sourceNote")
        statement = raw.get("statement")
        if not isinstance(source, str) or source not in sources:
            fail(f"candidate source is not in the plan source set: {source}")
        if not isinstance(statement, str) or not statement.strip():
            fail("candidate statement must be a non-empty string")
        key = (source, statement.strip())
        if key in candidates:
            fail(f"duplicate candidate: {source}: {statement.strip()}")
        if source not in source_statements:
            _, source_text = split_document(safe_path(vault, source).read_text(encoding="utf-8"))
            source_statements[source] = {
                line.strip() for line in source_text.splitlines() if line.strip()
            }
        if statement.strip() not in source_statements[source]:
            fail(f"candidate statement was not found in {source}: {statement.strip()}")
        candidates.add(key)
    return candidates


def validate_coverage(candidates: set[Tuple[str, str]], proposals: List[Dict[str, Any]]) -> None:
    counts: Counter[Tuple[str, str]] = Counter()
    for proposal in proposals:
        source = str(proposal["source-note"])
        for statement in proposal["coverage"]:
            key = (source, statement)
            if key not in candidates:
                fail(f"proposal coverage is not a declared candidate: {source}: {statement}")
            counts[key] += 1
    duplicated = next((key for key, count in counts.items() if count > 1), None)
    if duplicated:
        fail(f"candidate is covered more than once: {duplicated[0]}: {duplicated[1]}")
    missing = next((key for key in candidates if counts[key] == 0), None)
    if missing:
        fail(f"candidate is not covered by any proposal: {missing[0]}: {missing[1]}")


def command_stage(args: argparse.Namespace) -> None:
    plan = load_json(args.plan)
    language = plan.get("language", "en")
    if language not in ("ja", "en"):
        fail("language must be ja or en")
    eligible = {item["path"]: item for item in source_records(args.vault)}
    requested = plan.get("sources")
    if not isinstance(requested, list) or not requested:
        fail("plan.sources must be a non-empty array")
    if any(not isinstance(path, str) or path not in eligible for path in requested):
        fail("every source must be eligible under TaskMate source settings")
    sources = {path: eligible[path] for path in requested}
    candidates = candidate_manifest(plan, sources, args.vault)
    raw_proposals = plan.get("proposals")
    if not isinstance(raw_proposals, list) or not raw_proposals:
        fail("plan.proposals must be a non-empty array")
    proposals = [normalize_proposal(raw, sources, args.vault, args.task_folder) for raw in raw_proposals if isinstance(raw, dict)]
    if len(proposals) != len(raw_proposals):
        fail("every proposal must be an object")
    validate_coverage(candidates, proposals)
    session_id = now_iso().replace(":", "").replace("-", "")[:15] + "-" + uuid.uuid4().hex[:8]
    folder = proposal_root(args.vault, args.proposal_folder) / "Active" / session_id
    session = {
        "session-id": session_id, "status": "pending-review", "language": language,
        "created-at": now_iso(), "decided-at": None,
        "source-snapshots": [{"path": path, "hash": item["hash"], "taskIds": item["taskIds"]} for path, item in sources.items()],
    }
    for proposal in proposals:
        proposal["proposal-session"] = session_id
        path = available_task_path(folder / "Tasks", proposal["title"])
        proposal["path"] = path.relative_to(args.vault).as_posix()
        atomic_write(path, encode_proposal(proposal, language))
    atomic_write(folder / "Review.md", encode_review(session, proposals))
    print(json.dumps({"sessionId": session_id, "path": folder.relative_to(args.vault).as_posix(), "status": session["status"], "proposals": [{"proposalId": p["proposal-id"], "path": p["path"]} for p in proposals]}, ensure_ascii=False, indent=2))


def command_inspect(args: argparse.Namespace) -> None:
    _, session, proposals = find_session(args.vault, args.proposal_folder, args.session)
    print(json.dumps({"sessionId": session["session-id"], "status": session["status"], "proposals": [{"proposalId": p["proposal-id"], "decision": p["decision"], "promotedTaskId": p["promoted-task-id"], "path": p["path"]} for p in proposals]}, ensure_ascii=False, indent=2))


def set_needs_review(folder: Path, session: Dict[str, Any], proposals: List[Dict[str, Any]]) -> None:
    session["status"] = "needs-review"
    atomic_write(folder / "Review.md", encode_review(session, proposals))


def verify_snapshots(vault: Path, folder: Path, session: Dict[str, Any], proposals: List[Dict[str, Any]], task_override: Optional[str]) -> None:
    for snapshot in session.get("source-snapshots", []):
        path = safe_path(vault, snapshot["path"])
        if not path.exists() or source_hash(path.read_text(encoding="utf-8")) != snapshot["hash"]:
            set_needs_review(folder, session, proposals)
            fail(f"source changed since staging: {snapshot['path']}")
    for proposal in proposals:
        if proposal["operation"] == "merge" and proposal["decision"] == "pending":
            _, target = find_task(vault, task_override, proposal["target-task-id"])
            if target["updated-at"] != proposal["target-task-updated-at"]:
                set_needs_review(folder, session, proposals)
                fail(f"target task changed since staging: {proposal['target-task-id']}")


def revised_proposal(proposal: Dict[str, Any], revision: Dict[str, Any], vault: Path, task_override: Optional[str]) -> Dict[str, Any]:
    raw = {
        "operation": revision.get("operation", proposal["operation"]),
        "title": revision.get("title", proposal["title"]),
        "sourceNote": proposal["source-note"], "coverage": revision.get("coverage", proposal["coverage"]),
        "date": revision.get("date", proposal["date"]), "priority": revision.get("priority", proposal["priority"]),
        "labels": revision.get("labels", proposal["labels"]), "project": revision.get("project", proposal["project"]),
        "notes": revision.get("notes", proposal["task-notes"]), "reason": revision.get("reason", proposal["reason"]),
        "targetTaskId": revision.get("targetTaskId", proposal["target-task-id"]),
    }
    normalized = normalize_proposal(raw, {proposal["source-note"]: {"hash": proposal["source-hash"]}}, vault, task_override)
    for stable in ("proposal-id", "proposal-session", "created-at"):
        normalized[stable] = proposal[stable]
    return normalized


def promote_one(vault: Path, task_override: Optional[str], proposal: Dict[str, Any]) -> str:
    existing = proposal.get("promoted-task-id")
    if isinstance(existing, str):
        find_task(vault, task_override, existing)
        return existing
    patch = {"title": proposal["title"], "date": proposal["date"], "priority": proposal["priority"], "labels": proposal["labels"], "project": proposal["project"], "notes": proposal["task-notes"]}
    if proposal["operation"] == "merge":
        return update_task(vault, task_override, proposal["target-task-id"], patch)["id"]
    if proposal["operation"] != "create":
        fail("an exclude proposal cannot be promoted without revision")
    patch["source-note"] = proposal["source-note"]
    return create_task(vault, task_override, patch)["id"]


def command_promote(args: argparse.Namespace) -> None:
    decisions_doc = load_json(args.decisions)
    folder, session, proposals = find_session(args.vault, args.proposal_folder, args.session)
    if folder.parent.name == "Archive":
        print(json.dumps({"sessionId": args.session, "archived": True, "taskIds": [p["promoted-task-id"] for p in proposals if p["promoted-task-id"]]}, ensure_ascii=False, indent=2))
        return
    verify_snapshots(args.vault, folder, session, proposals, args.task_folder)
    by_id = {item["proposal-id"]: item for item in proposals}
    raw_decisions = decisions_doc.get("decisions")
    if not isinstance(raw_decisions, list):
        fail("decisions must be an array")
    for decision in raw_decisions:
        if not isinstance(decision, dict) or decision.get("proposalId") not in by_id:
            fail("decision references an unknown proposal")
        proposal = by_id[decision["proposalId"]]
        selected = decision.get("decision")
        if selected not in ("approved", "revised", "excluded"):
            fail("decision must be approved, revised, or excluded")
        if proposal["decision"] != "pending":
            if proposal["decision"] != selected:
                fail("a decided proposal cannot be changed")
            continue
        if selected == "revised":
            revision = decision.get("revision")
            if not isinstance(revision, dict) or not revision:
                fail("revised decisions require revision fields")
            replacement = revised_proposal(proposal, revision, args.vault, args.task_folder)
            proposal.clear(); proposal.update(replacement)
        if selected == "excluded":
            proposal["reason"] = decision.get("reason") or proposal.get("reason")
            if not proposal["reason"]:
                fail("excluded decisions require a reason")
        else:
            proposal["promoted-task-id"] = promote_one(args.vault, args.task_folder, proposal)
        proposal["decision"] = selected
        proposal["decided-at"] = now_iso()
        atomic_write(safe_path(args.vault, proposal["path"]), encode_proposal(proposal, session.get("language", "en")))
    archived = all(proposal["decision"] != "pending" for proposal in proposals)
    if archived:
        promoted_by_source: Dict[str, List[str]] = {}
        for proposal in proposals:
            if proposal.get("promoted-task-id"):
                promoted_by_source.setdefault(proposal["source-note"], []).append(proposal["promoted-task-id"])
        for snapshot in session.get("source-snapshots", []):
            identifiers = list(dict.fromkeys(list(snapshot.get("taskIds", [])) + promoted_by_source.get(snapshot["path"], [])))
            mark_source(args.vault, snapshot["path"], "processed", identifiers)
        session["status"] = "archived"; session["decided-at"] = now_iso()
        atomic_write(folder / "Review.md", encode_review(session, proposals))
        archive = proposal_root(args.vault, args.proposal_folder) / "Archive" / args.session
        archive.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(folder), str(archive))
    else:
        session["status"] = "pending-review"
        atomic_write(folder / "Review.md", encode_review(session, proposals))
    print(json.dumps({"sessionId": args.session, "archived": archived, "taskIds": [p["promoted-task-id"] for p in proposals if p["promoted-task-id"]]}, ensure_ascii=False, indent=2))


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--vault", required=True, type=lambda value: Path(value).resolve())
    result.add_argument("--task-folder")
    result.add_argument("--proposal-folder")
    commands = result.add_subparsers(dest="command", required=True)
    stage = commands.add_parser("stage"); stage.add_argument("--plan", required=True, type=Path); stage.set_defaults(run=command_stage)
    inspect = commands.add_parser("inspect"); inspect.add_argument("--session", required=True); inspect.set_defaults(run=command_inspect)
    promote = commands.add_parser("promote"); promote.add_argument("--session", required=True); promote.add_argument("--decisions", required=True, type=Path); promote.set_defaults(run=command_promote)
    return result


def main() -> None:
    args = parser().parse_args()
    if not args.vault.is_dir():
        fail(f"vault does not exist: {args.vault}")
    args.run(args)


if __name__ == "__main__":
    main()
