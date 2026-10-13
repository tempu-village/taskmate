import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
TODO_STORE = SCRIPTS / "todo_store.py"
PLANNING_STORE = SCRIPTS / "planning_store.py"


class PlanningStoreTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.vault = Path(self.temporary.name)
        settings = self.vault / ".obsidian" / "plugins" / "taskmate"
        settings.mkdir(parents=True)
        (settings / "data.json").write_text(json.dumps({
            "taskFolder": "TaskMate/Tasks",
            "projectFolder": "TaskMate/Projects",
            "proposalFolder": "TaskMate/Proposals",
            "sourceFolders": ["Notes"],
            "includeSourceSubfolders": True,
        }), encoding="utf-8")

    def tearDown(self):
        self.temporary.cleanup()

    def run_json(self, script, *arguments, check=True):
        result = subprocess.run(
            [sys.executable, str(script), "--vault", str(self.vault), *arguments],
            check=check,
            capture_output=True,
            text=True,
        )
        return result, json.loads(result.stdout) if result.stdout else None

    def create_task(self, title, *arguments):
        _, task = self.run_json(TODO_STORE, "create", "--title", title, *arguments)
        return task

    def write_json(self, name, value):
        path = self.vault / name
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def inspect(self, today="2026-10-11"):
        _, result = self.run_json(PLANNING_STORE, "inspect", "--today", today)
        return result

    def test_inspect_summarizes_only_canonical_incomplete_tasks(self):
        past = self.create_task("Past", "--date", "2026-10-10")
        self.create_task("Today", "--date", "2026-10-11")
        self.create_task("Future", "--date", "2026-10-12")
        unplanned = self.create_task("Unplanned")
        completed = self.create_task("Completed")
        self.run_json(TODO_STORE, "complete", "--id", completed["id"])

        result = self.inspect()

        self.assertEqual(result["summary"], {
            "incomplete": 4,
            "scheduled": 3,
            "pastScheduled": 1,
            "today": 1,
            "unplanned": 1,
        })
        self.assertEqual({task["title"] for task in result["tasks"]}, {"Past", "Today", "Future", "Unplanned"})
        self.assertTrue(all(len(task["snapshot"]) == 64 for task in result["tasks"]))

    def test_review_groups_only_identical_visible_changes(self):
        first = self.create_task("First", "--date", "2026-10-01")
        second = self.create_task("Second", "--date", "2026-10-02")
        inspected = {task["id"]: task for task in self.inspect()["tasks"]}
        plan = self.write_json("review.json", {
            "proposals": [
                {
                    "taskId": first["id"],
                    "snapshot": inspected[first["id"]]["snapshot"],
                    "changes": {"date": None},
                    "reason": "Remove unsupported past date",
                },
                {
                    "taskId": second["id"],
                    "snapshot": inspected[second["id"]]["snapshot"],
                    "changes": {"date": None},
                    "reason": "Remove unsupported past date",
                },
            ]
        })

        _, result = self.run_json(PLANNING_STORE, "review", "--plan", str(plan))

        self.assertEqual(len(result["groups"]), 1)
        self.assertEqual(result["groups"][0]["changes"], {"date": None})
        self.assertEqual(
            {member["taskId"] for member in result["groups"][0]["members"]},
            {first["id"], second["id"]},
        )
        self.assertTrue(all(member["title"] in {"First", "Second"} for member in result["groups"][0]["members"]))

    def test_propose_persists_complete_markdown_evidence_without_changing_the_task(self):
        task = self.create_task("Legacy break", "--date", "2026-10-01", "--label", "brk", "--label", "keep")
        inspected = {item["id"]: item for item in self.inspect()["tasks"]}
        plan = self.write_json("review.json", {
            "proposals": [{
                "taskId": task["id"],
                "snapshot": inspected[task["id"]]["snapshot"],
                "changes": {"date": "2026-10-18", "addLabels": ["context/break"], "removeLabels": ["brk"]},
                "dateAuthority": "The user selected 2026-10-18",
                "reason": "Reschedule and normalize the legacy Context label",
            }]
        })
        task_path = self.vault / task["path"]
        before = task_path.read_text(encoding="utf-8")

        _, result = self.run_json(PLANNING_STORE, "propose", "--plan", str(plan), "--proposal-id", "proposal-test")

        stored = self.vault / "TaskMate" / "Proposals" / "proposal-test.json"
        proposal = json.loads(stored.read_text(encoding="utf-8"))
        self.assertEqual(result["proposalId"], "proposal-test")
        self.assertEqual(proposal["tasks"][0]["beforeMarkdown"], before)
        self.assertIn('date: "2026-10-18"', proposal["tasks"][0]["afterMarkdown"])
        self.assertIn('labels: ["keep", "context/break"]', proposal["tasks"][0]["afterMarkdown"])
        self.assertEqual(task_path.read_text(encoding="utf-8"), before)
        self.assertEqual([change["id"] for change in proposal["tasks"][0]["changes"]], ["C-01", "C-02"])

    def test_apply_updates_approved_task_and_reports_stale_task(self):
        first = self.create_task("First", "--date", "2026-10-01", "--label", "keep")
        second = self.create_task("Second", "--date", "2026-10-02")
        inspected = {task["id"]: task for task in self.inspect()["tasks"]}
        plan_value = {
            "proposals": [
                {
                    "taskId": task["id"],
                    "snapshot": inspected[task["id"]]["snapshot"],
                    "changes": {"date": None},
                    "reason": "Remove unsupported past date",
                }
                for task in (first, second)
            ]
        }
        plan = self.write_json("review.json", plan_value)
        _, reviewed = self.run_json(PLANNING_STORE, "review", "--plan", str(plan))
        decisions = self.write_json("decisions.json", {
            "approvedProposalIds": [proposal["proposalId"] for proposal in reviewed["proposals"]]
        })
        self.run_json(TODO_STORE, "update", "--id", second["id"], "--priority", "2")

        process, result = self.run_json(
            PLANNING_STORE, "apply", "--plan", str(plan), "--decisions", str(decisions), check=False,
        )

        self.assertEqual(process.returncode, 1)
        self.assertEqual([item["taskId"] for item in result["succeeded"]], [first["id"]])
        self.assertEqual(result["failed"][0]["taskId"], second["id"])
        self.assertEqual(result["failed"][0]["error"], "Task changed after review")
        _, tasks = self.run_json(TODO_STORE, "list")
        by_id = {task["id"]: task for task in tasks}
        self.assertIsNone(by_id[first["id"]]["date"])
        self.assertEqual(by_id[first["id"]]["labels"], ["keep"])
        self.assertEqual(by_id[second["id"]]["date"], "2026-10-02")

    def test_plan_uses_buffer_upper_bounds_and_context_evidence(self):
        focus = self.create_task("Focus", "--label", "context/phone")
        phone = self.create_task("Phone", "--label", "context/phone")
        quick = self.create_task("Quick")
        request = self.write_json("plan.json", {
            "availableMinutes": 120,
            "requestedContexts": ["phone"],
            "candidates": [
                {
                    "taskId": focus["id"],
                    "stage": "must",
                    "estimate": {"minMinutes": 15, "maxMinutes": 30, "basis": "user"},
                    "reason": "The user selected this Task.",
                },
                {
                    "taskId": phone["id"],
                    "stage": "compare",
                    "comparisonRank": 1,
                    "estimate": {"minMinutes": 30, "maxMinutes": 60, "basis": "inference"},
                    "reason": "It is feasible by phone and fits after the focus Task.",
                },
                {
                    "taskId": quick["id"],
                    "stage": "compare",
                    "comparisonRank": 2,
                    "inferredContexts": ["phone"],
                    "estimate": {"minMinutes": 5, "maxMinutes": 15, "basis": "inference"},
                    "reason": "Its text suggests it can be done by phone.",
                },
            ],
        })
        before = {
            path: path.read_text(encoding="utf-8")
            for path in (self.vault / "TaskMate" / "Tasks").glob("*.md")
        }

        _, result = self.run_json(PLANNING_STORE, "plan", "--request", str(request))

        self.assertEqual(result["capacity"], {
            "availableMinutes": 120,
            "bufferPercent": 20,
            "bufferMinutes": 24,
            "planningMinutes": 96,
            "plannedUpperMinutes": 90,
        })
        self.assertEqual([item["taskId"] for item in result["planned"]], [focus["id"], phone["id"]])
        self.assertEqual(result["planned"][1]["contextEvidence"], "explicit")
        self.assertEqual(result["nearMatches"][0]["taskId"], quick["id"])
        self.assertEqual(result["nearMatches"][0]["contextEvidence"], "inferred")
        self.assertEqual(
            {path: path.read_text(encoding="utf-8") for path in before},
            before,
        )

    def test_review_keeps_clarification_separate_and_unmodified(self):
        task = self.create_task("Unclear", "--date", "2026-10-01")
        inspected = {item["id"]: item for item in self.inspect()["tasks"]}
        plan = self.write_json("review.json", {
            "proposals": [{
                "taskId": task["id"],
                "snapshot": inspected[task["id"]]["snapshot"],
                "disposition": "clarify",
                "reason": "The date may be a real commitment.",
            }]
        })

        _, result = self.run_json(PLANNING_STORE, "review", "--plan", str(plan))

        self.assertEqual(result["clarifications"][0]["taskId"], task["id"])
        self.assertEqual(result["groups"], [])

    def test_unestimable_candidate_remains_for_clarification(self):
        task = self.create_task("Plan the migration")
        request = self.write_json("plan.json", {
            "availableMinutes": 60,
            "candidates": [{
                "taskId": task["id"],
                "stage": "compare",
                "comparisonRank": 1,
                "needsBreakdown": True,
                "reason": "The Task boundary is too vague to estimate.",
            }],
        })

        _, result = self.run_json(PLANNING_STORE, "plan", "--request", str(request))

        self.assertEqual(result["planned"], [])
        self.assertEqual(result["needsClarification"][0]["taskId"], task["id"])
        self.assertEqual(result["needsClarification"][0]["estimate"], None)

    def test_review_rejects_invented_dates_and_priorities(self):
        task = self.create_task("Decide later")
        inspected = {item["id"]: item for item in self.inspect()["tasks"]}
        base = {
            "taskId": task["id"],
            "snapshot": inspected[task["id"]]["snapshot"],
            "reason": "Organize the backlog",
        }
        date_plan = self.write_json("date-review.json", {
            "proposals": [{**base, "changes": {"date": "2026-10-20"}}]
        })
        priority_plan = self.write_json("priority-review.json", {
            "proposals": [{**base, "changes": {"priority": 1}}]
        })

        date_result = subprocess.run(
            [sys.executable, str(PLANNING_STORE), "--vault", str(self.vault), "review", "--plan", str(date_plan)],
            capture_output=True, text=True,
        )
        priority_result = subprocess.run(
            [sys.executable, str(PLANNING_STORE), "--vault", str(self.vault), "review", "--plan", str(priority_plan)],
            capture_output=True, text=True,
        )

        self.assertNotEqual(date_result.returncode, 0)
        self.assertIn("dateAuthority", date_result.stderr)
        self.assertNotEqual(priority_result.returncode, 0)
        self.assertIn("accepted evidence", priority_result.stderr)

    def test_apply_context_label_change_preserves_manual_order_and_other_labels(self):
        task = self.create_task("Call supplier", "--label", "work")
        inspected = {item["id"]: item for item in self.inspect()["tasks"]}
        plan = self.write_json("review.json", {
            "proposals": [{
                "taskId": task["id"],
                "snapshot": inspected[task["id"]]["snapshot"],
                "changes": {"addLabels": ["context/phone"]},
                "reason": "The call is suitable by phone.",
            }]
        })
        _, reviewed = self.run_json(PLANNING_STORE, "review", "--plan", str(plan))
        decisions = self.write_json("decisions.json", {
            "approvedProposalIds": [reviewed["proposals"][0]["proposalId"]]
        })

        self.run_json(PLANNING_STORE, "apply", "--plan", str(plan), "--decisions", str(decisions))

        _, tasks = self.run_json(TODO_STORE, "list")
        updated = tasks[0]
        self.assertEqual(updated["labels"], ["work", "context/phone"])
        self.assertEqual(updated["rank"], task["rank"])

    def test_schedule_priority_conflict_requires_explanation_or_user_decision(self):
        task = self.create_task("Conflicting Task", "--date", "2026-10-01", "--priority", "3")
        request = self.write_json("plan.json", {
            "availableMinutes": 60,
            "candidates": [{
                "taskId": task["id"],
                "stage": "compare",
                "comparisonRank": 1,
                "schedulePriorityConflict": True,
                "estimate": {"minMinutes": 15, "maxMinutes": 30, "basis": "task-text"},
                "reason": "The old schedule conflicts with its low Priority.",
            }],
        })

        result = subprocess.run(
            [sys.executable, str(PLANNING_STORE), "--vault", str(self.vault), "plan", "--request", str(request)],
            capture_output=True, text=True,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("tradeoff or user decision", result.stderr)

    def test_normal_planning_does_not_import_eligible_source_notes(self):
        source = self.vault / "Notes" / "meeting.md"
        source.parent.mkdir(parents=True)
        source.write_text("# Meeting\n\nSend the estimate.\n", encoding="utf-8")
        before = source.read_text(encoding="utf-8")

        result = self.inspect()

        self.assertEqual(result["summary"]["incomplete"], 0)
        self.assertEqual(source.read_text(encoding="utf-8"), before)
        self.assertFalse((self.vault / "TaskMate" / "Tasks").exists())

    def test_fifty_task_review_exposes_every_member_in_one_homogeneous_group(self):
        created = [self.create_task(f"Old Task {number}", "--date", "2026-10-01") for number in range(1, 51)]
        inspected = {item["id"]: item for item in self.inspect()["tasks"]}
        plan = self.write_json("review.json", {
            "proposals": [
                {
                    "taskId": task["id"],
                    "snapshot": inspected[task["id"]]["snapshot"],
                    "changes": {"date": None},
                    "reason": "Remove unsupported past date",
                }
                for task in created
            ]
        })

        _, result = self.run_json(PLANNING_STORE, "review", "--plan", str(plan))

        self.assertEqual(len(result["groups"]), 1)
        self.assertEqual(len(result["groups"][0]["members"]), 50)
        self.assertEqual(
            {member["taskId"] for member in result["groups"][0]["members"]},
            {task["id"] for task in created},
        )

    def test_user_added_context_label_exact_matches_requested_context(self):
        task = self.create_task("Read on train", "--label", "context/train")
        request = self.write_json("plan.json", {
            "availableMinutes": 30,
            "requestedContexts": ["train"],
            "candidates": [{
                "taskId": task["id"],
                "stage": "compare",
                "comparisonRank": 1,
                "estimate": {"minMinutes": 10, "maxMinutes": 20, "basis": "user"},
                "reason": "The custom Context label exactly matches the request.",
            }],
        })

        _, result = self.run_json(PLANNING_STORE, "plan", "--request", str(request))

        self.assertEqual(result["planned"][0]["contextEvidence"], "explicit")


if __name__ == "__main__":
    unittest.main()
