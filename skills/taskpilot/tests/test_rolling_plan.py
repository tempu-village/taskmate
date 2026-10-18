import datetime
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
TODO_STORE = SCRIPTS / "todo_store.py"
PLANNING_STORE = SCRIPTS / "planning_store.py"
ROLLING_PLAN = SCRIPTS / "rolling_plan.py"
TARGET = "2026-10-19"  # Monday
INFERRED_MINIMUM = {15: 5, 30: 15, 60: 30, 120: 60}

CONFIRMED_WEEKDAYS = {
    "mode": "explicit",
    "confirmedAt": "2026-10-19T08:00:00Z",
    "dailyMinutes": 60,
    "bufferPercent": 0,
    "weekdays": ["mon", "tue", "wed", "thu", "fri"],
}


class RollingPlanTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.vault = Path(self.temporary.name)
        self.settings = self.vault / ".obsidian" / "plugins" / "taskmate" / "data.json"
        self.settings.parent.mkdir(parents=True)
        self.write_settings({})
        self.request_number = 0

    def tearDown(self):
        self.temporary.cleanup()

    def write_settings(self, extra):
        self.settings.write_text(json.dumps({
            "taskFolder": "TaskMate/Tasks",
            "projectFolder": "TaskMate/Projects",
            "proposalFolder": "TaskMate/Proposals",
            "sourceFolders": ["Notes"],
            "includeSourceSubfolders": True,
            **extra,
        }), encoding="utf-8")

    def run_script(self, script, *arguments, check=True):
        result = subprocess.run(
            [sys.executable, str(script), "--vault", str(self.vault), *arguments],
            check=False, capture_output=True, text=True,
        )
        if check and result.returncode != 0:
            self.fail(f"{script.name} {' '.join(arguments)} failed: {result.stderr}")
        return result, json.loads(result.stdout) if result.returncode == 0 and result.stdout else None

    def create_task(self, title, *arguments):
        _, task = self.run_script(TODO_STORE, "create", "--title", title, *arguments)
        return task

    def snapshots(self):
        _, result = self.run_script(PLANNING_STORE, "inspect", "--today", TARGET)
        return {task["id"]: task["snapshot"] for task in result["tasks"]}

    def task_bytes(self):
        folder = self.vault / "TaskMate" / "Tasks"
        return {path.name: path.read_bytes() for path in sorted(folder.glob("*.md"))}

    def write_json(self, value):
        self.request_number += 1
        path = self.vault / f"request-{self.request_number}.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def entry(self, task, snapshots, order, minutes=60, basis="user", **extra):
        value = {
            "taskId": task["id"], "snapshot": snapshots[task["id"]], "order": order,
            "reason": f"Reason for {task['title']}", "reasonCodes": ["fits-capacity"],
            "estimate": None if minutes is None else {"minMinutes": INFERRED_MINIMUM[minutes] if basis == "inference" else minutes, "maxMinutes": minutes, "basis": basis},
        }
        value.update(extra)
        return value

    def request(self, recommended, evidence, today=60, future=None):
        return {
            "targetDate": TARGET,
            "capacity": {"today": {"availableMinutes": today, "bufferPercent": 0}, "future": future},
            "bases": {"recommended": recommended, "evidence": evidence},
        }

    def create_plan(self, request, plan_id="plan-week", *extra, check=True):
        return self.run_script(ROLLING_PLAN, "create", "--request", str(self.write_json(request)), "--plan-id", plan_id, *extra, check=check)

    def show(self, plan_id="plan-week"):
        _, result = self.run_script(ROLLING_PLAN, "show", "--plan-id", plan_id)
        return result["plan"]

    def by_task(self, items):
        return {item["taskId"]: item for item in items}

    def simple_plan(self, count=2, future=None):
        tasks = [self.create_task(f"Task {number}") for number in range(1, count + 1)]
        snapshots = self.snapshots()
        entries = [self.entry(task, snapshots, number) for number, task in enumerate(tasks, 1)]
        self.create_plan(self.request(entries, entries, future=future))
        return tasks

    def test_create_writes_both_bases_without_changing_tasks(self):
        first = self.create_task("Write report")
        second = self.create_task("Call bank")
        snapshots = self.snapshots()
        before = self.task_bytes()

        _, result = self.create_plan(self.request(
            [self.entry(first, snapshots, 1), self.entry(second, snapshots, 2, minutes=30, basis="inference", proposedFields={"addLabels": ["context/phone"]})],
            [self.entry(first, snapshots, 1), self.entry(second, snapshots, 2, minutes=None)],
            today=90,
        ))

        self.assertEqual(self.task_bytes(), before)
        self.assertEqual(result["path"], "TaskMate/Plans/plan-week.md")
        self.assertTrue(result["uri"].startswith("obsidian://open?"))
        self.assertEqual(result["status"], "draft")
        self.assertEqual(result["counts"], {
            "recommended": {"planned": 2, "gap": 0, "conflict": 0},
            "evidence": {"planned": 1, "gap": 1, "conflict": 0},
            "working": None,
        })
        text = (self.vault / result["path"]).read_text(encoding="utf-8")
        self.assertIn("type: \"taskmate-today-plan\"", text)
        self.assertIn("status: \"draft\"", text)
        self.assertIn("base-mode: null", text)
        self.assertIn("revision: 1", text)
        self.assertIn("No base selected", text)
        plan = self.show()
        self.assertEqual([item["id"] for item in plan["bases"]["recommended"]], ["R-01", "R-02"])
        evidence = self.by_task(plan["bases"]["evidence"])
        self.assertEqual(evidence[first["id"]]["id"], "E-01")
        self.assertEqual(evidence[second["id"]]["code"], "missing-effort")

    def test_every_incomplete_task_must_appear_exactly_once_in_each_base(self):
        first = self.create_task("First")
        second = self.create_task("Second")
        completed = self.create_task("Done")
        self.run_script(TODO_STORE, "complete", "--id", completed["id"])
        snapshots = self.snapshots()
        complete = [self.entry(first, snapshots, 1), self.entry(second, snapshots, 2)]

        missing, _ = self.create_plan(self.request([self.entry(first, snapshots, 1)], complete), check=False)
        duplicated, _ = self.create_plan(self.request([*complete, self.entry(first, snapshots, 3)], complete), check=False)
        completed_entry = {**self.entry(first, snapshots, 3), "taskId": completed["id"]}
        with_completed, _ = self.create_plan(self.request([*complete, completed_entry], complete), check=False)

        self.assertIn("missing:", missing.stderr)
        self.assertIn("more than once", duplicated.stderr)
        self.assertIn("not an incomplete canonical Task", with_completed.stderr)
        self.assertFalse((self.vault / "TaskMate" / "Plans" / "plan-week.md").exists())

    def test_stale_snapshot_blocks_plan_creation(self):
        task = self.create_task("Changing")
        snapshots = self.snapshots()
        self.run_script(TODO_STORE, "update", "--id", task["id"], "--title", "Changed")

        result, _ = self.create_plan(self.request([self.entry(task, snapshots, 1)], [self.entry(task, snapshots, 1)]), check=False)

        self.assertIn("changed after inspection", result.stderr)

    def test_unconfirmed_future_capacity_assigns_no_future_dates(self):
        assumed = {**CONFIRMED_WEEKDAYS, "mode": "assumed", "confirmedAt": None}
        self.simple_plan(count=3, future=assumed)

        plan = self.show()
        recommended = plan["bases"]["recommended"]
        self.assertEqual([item.get("plannedDate") for item in recommended if item["kind"] == "planned"], [TARGET])
        self.assertEqual([item["code"] for item in recommended if item["kind"] == "gap"], ["future-capacity-unconfirmed"] * 2)
        self.assertIn("awaiting confirmation", (self.vault / "TaskMate" / "Plans" / "plan-week.md").read_text(encoding="utf-8"))

    def test_confirmed_capacity_extends_the_horizon_until_every_task_is_placed(self):
        self.simple_plan(count=20, future=CONFIRMED_WEEKDAYS)

        plan = self.show()
        dates = [item["plannedDate"] for item in plan["bases"]["recommended"]]
        self.assertEqual(len(dates), 20)
        self.assertEqual(len(set(dates)), 20)
        self.assertEqual(dates[0], TARGET)
        self.assertEqual(dates[-1], "2026-11-13")
        self.assertTrue(all(datetime.date.fromisoformat(date).weekday() < 5 for date in dates))
        self.assertEqual(plan["endDate"], "2026-11-13")

    def test_existing_dates_are_kept_and_capacity_moves_are_explained(self):
        dated = self.create_task("Dated", "--date", "2026-10-20")
        competing = self.create_task("Competing", "--date", "2026-10-20")
        overdue = self.create_task("Overdue", "--date", "2026-10-01")
        snapshots = self.snapshots()
        entries = [self.entry(overdue, snapshots, 1), self.entry(dated, snapshots, 2), self.entry(competing, snapshots, 3)]

        self.create_plan(self.request(entries, entries, future=CONFIRMED_WEEKDAYS))

        items = self.by_task(self.show()["bases"]["recommended"])
        self.assertEqual((items[dated["id"]]["plannedDate"], items[dated["id"]]["moveCodes"]), ("2026-10-20", []))
        self.assertEqual((items[competing["id"]]["plannedDate"], items[competing["id"]]["moveCodes"]), ("2026-10-21", ["moved-capacity"]))
        self.assertEqual((items[overdue["id"]]["plannedDate"], items[overdue["id"]]["moveCodes"]), (TARGET, ["overdue"]))
        text = (self.vault / "TaskMate" / "Plans" / "plan-week.md").read_text(encoding="utf-8")
        self.assertIn("moved from 2026-10-20 for capacity", text)
        self.assertIn("overdue from 2026-10-01", text)

    def test_dated_tasks_keep_their_date_before_undated_work_fills_it(self):
        first = self.create_task("First undated")
        second = self.create_task("Second undated")
        dated = self.create_task("Dated", "--date", "2026-10-20")
        snapshots = self.snapshots()
        entries = [self.entry(first, snapshots, 1), self.entry(second, snapshots, 2), self.entry(dated, snapshots, 3)]

        self.create_plan(self.request(entries, entries, future=CONFIRMED_WEEKDAYS))

        items = self.by_task(self.show()["bases"]["recommended"])
        self.assertEqual(items[dated["id"]]["plannedDate"], "2026-10-20")
        self.assertEqual(items[dated["id"]]["moveCodes"], [])
        self.assertEqual(items[second["id"]]["plannedDate"], "2026-10-21")

    def test_deadline_beyond_capacity_becomes_a_conflict(self):
        first = self.create_task("First")
        late = self.create_task("Late")
        snapshots = self.snapshots()
        entries = [self.entry(first, snapshots, 1), self.entry(late, snapshots, 2, deadline=TARGET)]

        self.create_plan(self.request(entries, entries, future=CONFIRMED_WEEKDAYS))

        late_item = self.by_task(self.show()["bases"]["recommended"])[late["id"]]
        self.assertEqual((late_item["kind"], late_item["code"]), ("conflict", "deadline-capacity"))
        self.assertNotIn("plannedDate", late_item)
        invalid = [self.entry(first, snapshots, 1), self.entry(late, snapshots, 2, deadline="2026-13-01")]
        result, _ = self.create_plan(self.request(invalid, entries), "plan-invalid", check=False)
        self.assertIn("deadline must be YYYY-MM-DD", result.stderr)

    def test_oversized_and_flagged_tasks_become_gaps(self):
        big = self.create_task("Big")
        unclear = self.create_task("Unclear")
        snapshots = self.snapshots()
        entries = [
            self.entry(big, snapshots, 1, minutes=180, largeAccepted=True),
            self.entry(unclear, snapshots, 2, gap={"code": "missing-context", "reason": "Where this can be done is unknown."}),
        ]

        self.create_plan(self.request(entries, entries, future=CONFIRMED_WEEKDAYS))

        items = self.by_task(self.show()["bases"]["recommended"])
        self.assertEqual(items[big["id"]]["code"], "needs-breakdown")
        self.assertEqual(items[unclear["id"]]["code"], "missing-context")

    def test_evidence_base_accepts_only_explicit_task_data(self):
        task = self.create_task("Task")
        snapshots = self.snapshots()
        recommended = [self.entry(task, snapshots, 1)]

        inferred, _ = self.create_plan(self.request(recommended, [self.entry(task, snapshots, 1, minutes=30, basis="inference")]), check=False)
        fields, _ = self.create_plan(self.request(recommended, [self.entry(task, snapshots, 1, proposedFields={"notes": "x"})]), check=False)

        self.assertIn("only user or task-text", inferred.stderr)
        self.assertIn("cannot propose Task fields", fields.stderr)

    def test_plan_fields_are_limited_to_date_context_steps_and_notes(self):
        task = self.create_task("Task")
        snapshots = self.snapshots()
        evidence = [self.entry(task, snapshots, 1)]

        priority, _ = self.create_plan(self.request([self.entry(task, snapshots, 1, proposedFields={"priority": 1})], evidence), check=False)
        label, _ = self.create_plan(self.request([self.entry(task, snapshots, 1, proposedFields={"addLabels": ["work"]})], evidence), check=False)

        self.assertIn("limited to date, context/* labels, Steps, and Notes", priority.stderr)
        self.assertIn("only context/* labels", label.stderr)

    def test_selecting_a_base_creates_the_working_plan_without_mixing_bases(self):
        self.simple_plan(count=2)
        before = self.task_bytes()

        _, result = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "evidence", "--revision", "1")

        self.assertEqual(self.task_bytes(), before)
        self.assertEqual((result["status"], result["revision"], result["baseMode"]), ("ready", 2, "evidence"))
        plan = self.show()
        planned = [item for item in plan["working"] if item["kind"] == "planned"]
        self.assertEqual([item["id"] for item in planned], ["PLAN-01"])
        self.assertEqual(planned[0]["basedOn"], "E-01")
        self.assertEqual([item["basedOn"] for item in plan["working"] if item["kind"] == "gap"], ["GAP-02"])
        again, _ = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "2", check=False)
        self.assertIn("--replace-working-plan", again.stderr)

    def test_revisions_change_only_the_working_plan_and_require_the_current_revision(self):
        tasks = self.simple_plan(count=3, future=CONFIRMED_WEEKDAYS)
        self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1")
        before = self.task_bytes()
        changes = self.write_json({"changes": [
            {"id": "PLAN-02", "operation": "move", "date": "2026-10-23", "reason": "Busy on Tuesday."},
            {"id": "PLAN-03", "operation": "unschedule", "reason": "Waiting for a reply."},
            {"id": "PLAN-01", "operation": "set-fields", "proposedFields": {"addLabels": ["context/pc"]}, "reason": "Needs the computer."},
        ]})

        stale, _ = self.run_script(ROLLING_PLAN, "revise", "--plan-id", "plan-week", "--revision", "1", "--changes", str(changes), check=False)
        _, result = self.run_script(ROLLING_PLAN, "revise", "--plan-id", "plan-week", "--revision", "2", "--changes", str(changes))

        self.assertIn("re-read the plan", stale.stderr)
        self.assertEqual(self.task_bytes(), before)
        self.assertEqual(result["revision"], 3)
        working = self.by_task(self.show()["working"])
        self.assertEqual((working[tasks[1]["id"]]["plannedDate"], working[tasks[1]["id"]]["moveCodes"]), ("2026-10-23", ["user-moved"]))
        self.assertEqual((working[tasks[2]["id"]]["kind"], working[tasks[2]["id"]]["code"]), ("gap", "user-unscheduled"))
        self.assertEqual(working[tasks[0]["id"]]["proposedFields"], {"addLabels": ["context/pc"]})
        recommended = self.by_task(self.show()["bases"]["recommended"])
        self.assertEqual(recommended[tasks[2]["id"]]["kind"], "planned")
        schedule = self.write_json({"changes": [{"id": working[tasks[2]["id"]]["id"], "operation": "schedule", "date": "2026-10-26", "reason": "Reply expected by then."}]})
        self.run_script(ROLLING_PLAN, "revise", "--plan-id", "plan-week", "--revision", "3", "--changes", str(schedule))
        scheduled = self.by_task(self.show()["working"])[tasks[2]["id"]]
        self.assertEqual((scheduled["id"], scheduled["plannedDate"]), ("PLAN-04", "2026-10-26"))

    def test_revision_rejects_future_dates_without_confirmed_capacity(self):
        self.simple_plan(count=1)
        self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1")
        changes = self.write_json({"changes": [{"id": "PLAN-01", "operation": "move", "date": "2026-10-20", "reason": "Later."}]})

        result, _ = self.run_script(ROLLING_PLAN, "revise", "--plan-id", "plan-week", "--revision", "2", "--changes", str(changes), check=False)

        self.assertIn("confirmed future capacity", result.stderr)

    def test_manual_edits_block_writes(self):
        self.simple_plan(count=1)
        path = self.vault / "TaskMate" / "Plans" / "plan-week.md"
        path.write_text(path.read_text(encoding="utf-8") + "\nMy note\n", encoding="utf-8")

        result, _ = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1", check=False)

        self.assertIn("edited outside Task Pilot", result.stderr)

    def test_replanning_supersedes_the_previous_plan_and_close_is_final(self):
        tasks = self.simple_plan(count=1)
        snapshots = self.snapshots()
        entries = [self.entry(tasks[0], snapshots, 1)]

        _, result = self.create_plan(self.request(entries, entries), "plan-next", "--supersedes", "plan-week")

        old = self.show("plan-week")
        self.assertEqual((old["status"], old["supersededBy"], old["revision"]), ("superseded", "plan-next", 2))
        self.assertEqual(self.show("plan-next")["supersedes"], "plan-week")
        self.run_script(ROLLING_PLAN, "close", "--plan-id", "plan-next", "--revision", str(result["revision"]))
        closed, _ = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-next", "--base", "recommended", "--revision", "2", check=False)
        self.assertIn("cannot be selected from status closed", closed.stderr)

    def test_plan_metadata_contract(self):
        task = self.create_task("Task", "--date", "2026-10-20")
        snapshots = self.snapshots()
        entries = [self.entry(task, snapshots, 1, reasonCodes=["kept-date"], proposedFields={"notes": "Bring --> the form"})]
        evidence = [self.entry(task, snapshots, 1)]
        self.create_plan(self.request(entries, evidence, future=CONFIRMED_WEEKDAYS))
        text = (self.vault / "TaskMate" / "Plans" / "plan-week.md").read_text(encoding="utf-8")

        frontmatter = text.split("---\n")[1]
        self.assertEqual([line.split(":")[0] for line in frontmatter.strip().splitlines()], [
            "type", "schema-version", "plan-id", "target-date", "planning-scope", "end-date", "status",
            "base-mode", "future-capacity-mode", "future-capacity-confirmed-at", "revision", "created-at", "updated-at",
        ])
        comments = re.findall(r"<!-- taskmate-plan-item (\{.*\}) -->", text)
        self.assertEqual(len(comments), 2)
        item = json.loads(comments[0])
        self.assertEqual(item["section"], "recommended")
        self.assertEqual(item["taskId"], task["id"])
        self.assertEqual(item["snapshot"], snapshots[task["id"]])
        self.assertEqual((item["revision"], item["plannedDate"], item["reasonCodes"]), (1, "2026-10-20", ["kept-date"]))
        self.assertEqual(item["proposedFields"], {"notes": "Bring --> the form"})
        self.assertNotIn("Bring --> the form", text)

    def test_plan_folder_setting_and_source_exclusion(self):
        self.write_settings({"planFolder": "Planning", "sourceFolders": ["Planning", "Notes"], "includeSourceSubfolders": True})
        self.simple_plan(count=1)
        (self.vault / "Notes").mkdir()
        (self.vault / "Notes" / "meeting.md").write_text("Call Alex\n", encoding="utf-8")

        _, sources = self.run_script(TODO_STORE, "sources")

        self.assertTrue((self.vault / "Planning" / "plan-week.md").exists())
        self.assertEqual([source["path"] for source in sources], ["Notes/meeting.md"])

    def test_invalid_plan_identifier_is_rejected(self):
        result, _ = self.run_script(ROLLING_PLAN, "show", "--plan-id", "../escape", check=False)
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
