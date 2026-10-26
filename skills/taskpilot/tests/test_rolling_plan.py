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
            "language": "en",
            **extra,
        }), encoding="utf-8")

    def run_script(self, script, *arguments, check=True):
        # Plan writes that create or revise a working plan need a summary; tests that check it pass their own.
        if script == ROLLING_PLAN and arguments[0] in {"select-base", "revise"} and "--summary" not in arguments:
            arguments = (*arguments, "--summary", "Plan summary.")
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
        self.assertIn("move date later 2026-10-20 (Tue) → 2026-10-21 (Wed) (not enough time)", text)
        self.assertIn("move past date 2026-10-01 (Thu) → 2026-10-19 (Mon)", text)

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

    def ready_plan(self):
        today = self.create_task("Today work")
        moved = self.create_task("Moved work", "--date", "2026-10-26")
        unchanged = self.create_task("Already dated", "--date", "2026-10-20", "--label", "context/pc")
        snapshots = self.snapshots()
        recommended = [
            self.entry(today, snapshots, 1, proposedFields={"addLabels": ["context/pc"], "notes": "Use the template."}),
            self.entry(unchanged, snapshots, 2, proposedFields={"addLabels": ["context/pc"]}),
            self.entry(moved, snapshots, 3),
        ]
        evidence = [self.entry(today, snapshots, 1), self.entry(unchanged, snapshots, 2), self.entry(moved, snapshots, 3)]
        future = {**CONFIRMED_WEEKDAYS, "exceptions": {"2026-10-26": 0}}
        self.create_plan(self.request(recommended, evidence, future=future))
        self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1")
        return today, moved, unchanged

    def propose(self, proposal_id, revision, *scope, check=True, summaries=None):
        if summaries is None:
            summaries = {item["id"]: f"Line for {item['title']}" for item in self.show()["working"] or [] if item["kind"] == "planned"}
        path = self.write_json(summaries)
        return self.run_script(ROLLING_PLAN, "proposal", "--plan-id", "plan-week", "--revision", str(revision), "--proposal-id", proposal_id, *scope, "--task-summaries", str(path), check=check)

    def proposal_json(self, proposal_id):
        return json.loads((self.vault / "TaskMate" / "Proposals" / f"{proposal_id}.json").read_text(encoding="utf-8"))

    def test_unqualified_proposal_covers_every_date_without_changing_tasks(self):
        today, moved, unchanged = self.ready_plan()
        before = self.task_bytes()

        _, result = self.propose("proposal-all", 2)

        self.assertEqual(self.task_bytes(), before)
        self.assertEqual((result["status"], result["planRevision"], result["scope"]), ("proposal-created", 3, {"kind": "all"}))
        self.assertTrue(result["uri"].startswith("obsidian://taskmate-review?"))
        self.assertEqual([value["taskId"] for value in result["included"]], [today["id"], moved["id"]])
        self.assertEqual(result["omitted"], [{"id": "PLAN-02", "taskId": unchanged["id"], "title": "Already dated", "reason": "no-change"}])
        proposal = self.proposal_json("proposal-all")
        self.assertEqual((proposal["schemaVersion"], proposal["status"]), (1, "pending"))
        by_task = {task["taskId"]: task for task in proposal["tasks"]}
        today_changes = {change["field"]: change for change in by_task[today["id"]]["changes"]}
        self.assertEqual(sorted(today_changes), ["date", "labels", "notes"])
        self.assertEqual((today_changes["date"]["before"], today_changes["date"]["after"]), (None, TARGET))
        self.assertEqual(today_changes["labels"]["after"], ["context/pc"])
        moved_change = by_task[moved["id"]]["changes"][0]
        self.assertEqual((moved_change["field"], moved_change["before"], moved_change["after"]), ("date", "2026-10-26", "2026-10-27"))
        self.assertIn("moved from 2026-10-26 for capacity", moved_change["reason"])
        self.assertTrue(all(change["field"] != "priority" for task in proposal["tasks"] for change in task["changes"]))
        plan = self.show()
        self.assertEqual(plan["proposals"][0]["itemIds"], ["PLAN-01", "PLAN-03"])
        text = (self.vault / "TaskMate" / "Plans" / "plan-week.md").read_text(encoding="utf-8")
        self.assertIn("In Task change review proposal-all.", text)
        self.assertIn("Not in Task change review proposal-all: nothing changes.", text)
        self.assertEqual(proposal["summary"], "Plan summary.")
        self.assertEqual(by_task[today["id"]]["summary"], "Line for Today work")

    def test_today_only_and_explicit_items_narrow_the_scope(self):
        today, moved, _ = self.ready_plan()

        _, today_result = self.propose("proposal-today", 2, "--today-only")
        _, item_result = self.propose("proposal-items", 3, "--items", "PLAN-03")

        self.assertEqual([value["taskId"] for value in today_result["included"]], [today["id"]])
        self.assertEqual([value["taskId"] for value in item_result["included"]], [moved["id"]])
        self.assertEqual(item_result["scope"], {"kind": "items", "requested": ["PLAN-03"]})
        self.assertEqual([task["taskId"] for task in self.proposal_json("proposal-today")["tasks"]], [today["id"]])

    def test_already_proposed_items_are_skipped_until_revised(self):
        today, _, _ = self.ready_plan()
        self.propose("proposal-first", 2, "--today-only")

        _, second = self.propose("proposal-second", 3)
        changes = self.write_json({"changes": [{"id": "PLAN-01", "operation": "set-fields", "proposedFields": {"notes": "New plan."}, "reason": "Changed after review."}]})
        self.run_script(ROLLING_PLAN, "revise", "--plan-id", "plan-week", "--revision", "4", "--changes", str(changes))
        _, third = self.propose("proposal-third", 5, "--items", "PLAN-01")

        self.assertIn({"id": "PLAN-01", "taskId": today["id"], "title": "Today work", "reason": "already-proposed"}, second["omitted"])
        self.assertEqual([value["taskId"] for value in third["included"]], [today["id"]])

    def test_stale_completed_and_missing_tasks_are_omitted_while_others_continue(self):
        today, moved, unchanged = self.ready_plan()
        self.run_script(TODO_STORE, "update", "--id", today["id"], "--title", "Edited elsewhere")
        self.run_script(TODO_STORE, "complete", "--id", unchanged["id"])

        _, result = self.propose("proposal-partial", 2)

        reasons = {value["id"]: value["reason"] for value in result["omitted"]}
        self.assertEqual(reasons, {"PLAN-01": "stale", "PLAN-02": "completed"})
        self.assertEqual([value["taskId"] for value in result["included"]], [moved["id"]])
        (self.vault / moved["path"]).unlink()
        missing, _ = self.propose("proposal-none", 3, "--items", "PLAN-03", check=False)
        self.assertIn("PLAN-03 (missing)", missing.stderr)
        self.assertFalse((self.vault / "TaskMate" / "Proposals" / "proposal-none.json").exists())

    def test_proposal_requires_a_selected_working_plan_and_valid_scope(self):
        self.simple_plan(count=1)

        draft, _ = self.propose("proposal-draft", 1, check=False)
        self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1")
        stale, _ = self.propose("proposal-stale", 1, check=False)
        gap, _ = self.propose("proposal-gap", 2, "--items", "GAP-01", check=False)
        unknown, _ = self.propose("proposal-unknown", 2, "--items", "PLAN-09", check=False)
        bad_id, _ = self.propose("not-a-proposal", 2, check=False)

        self.assertIn("selected working plan", draft.stderr)
        self.assertIn("re-read the plan", stale.stderr)
        self.assertIn("unknown working-plan item: GAP-01", gap.stderr)
        self.assertIn("unknown working-plan item: PLAN-09", unknown.stderr)
        self.assertIn("proposal-id must start with proposal-", bad_id.stderr)

    def test_revision_remains_possible_after_a_proposal(self):
        self.ready_plan()
        self.propose("proposal-today", 2, "--today-only")
        changes = self.write_json({"changes": [{"id": "PLAN-03", "operation": "move", "date": "2026-10-28", "reason": "Later is fine."}]})

        _, result = self.run_script(ROLLING_PLAN, "revise", "--plan-id", "plan-week", "--revision", "3", "--changes", str(changes))

        self.assertEqual((result["status"], result["revision"]), ("proposal-created", 4))

    def plan_text(self):
        return (self.vault / "TaskMate" / "Plans" / "plan-week.md").read_text(encoding="utf-8")

    def visible_text(self):
        body = self.plan_text().split("---\n", 2)[2]
        return "\n".join(line for line in body.splitlines() if "<!-- taskmate-plan" not in line)

    def mixed_plan(self):
        overdue = self.create_task("請求書を確認する", "--date", "2026-10-01")
        kept = self.create_task("週次レポート", "--date", "2026-10-20")
        undated = self.create_task("発表資料を作る")
        snapshots = self.snapshots()
        steps = [{"text": "構成を決める", "completed": False, "date": None}, {"text": "スライドを作る", "completed": False, "date": None}]
        recommended = [
            self.entry(overdue, snapshots, 1, reason="期限を過ぎているので最初に片付ける。"),
            self.entry(kept, snapshots, 2, reason="今の日付のまま。"),
            self.entry(undated, snapshots, 3, reason="構成とスライドで1時間。", proposedFields={"addLabels": ["context/pc"], "steps": steps}),
        ]
        evidence = [self.entry(task, snapshots, number) for number, task in enumerate((overdue, kept, undated), 1)]
        self.create_plan(self.request(recommended, evidence, future=CONFIRMED_WEEKDAYS))
        self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1",
                        "--summary", "期限を過ぎた請求書を今日に入れ、資料は水曜に2段階で進めます。")
        return overdue, kept, undated

    def test_japanese_plan_has_no_english_interface_text(self):
        sys.path.insert(0, str(SCRIPTS))
        import rolling_plan
        self.write_settings({"language": "auto", "desktopLanguage": "ja"})
        self.mixed_plan()

        visible = self.visible_text()

        self.assertIn("# 10月19日（月）からの計画", visible)
        self.assertIn("## この計画で変わること", visible)
        self.assertIn("期限を過ぎた請求書を今日に入れ、資料は水曜に2段階で進めます。", visible)
        self.assertIn("変わる：2件・変わらない：1件・日付を決めていない：0件", visible)
        self.assertIn("### 10月19日（月） — 60 / 60分", visible)
        self.assertIn("変更：過ぎた予定日を移動 10/1（木） → 10/19（月）", visible)
        self.assertIn("変更なし：10/20（火）のまま", visible)
        self.assertIn("変更：日付を追加 10/21（水）、ラベルを追加 context/pc、Stepsを設定（2件）", visible)
        self.assertIn("60〜60分（あなたの見積もり）", visible)
        self.assertIn("今後の作業時間（指定、2026-10-19T08:00:00Zに確認）：月・火・水・木・金に60分、余白0%。", visible)
        for value in rolling_plan.TEXT["en"].values():
            for fragment in re.split(r"\{[^}]+\}", value):
                if sum(character.isalpha() for character in fragment) >= 3:
                    self.assertNotIn(fragment, visible)
        for name in rolling_plan.WEEKDAY_NAMES["en"]:
            self.assertNotIn(f"({name})", visible)

    def test_unknown_language_stops_before_writing_until_the_agent_names_one(self):
        self.write_settings({"language": "auto"})
        task = self.create_task("Task 1")
        entries = [self.entry(task, self.snapshots(), 1)]
        request = str(self.write_json(self.request(entries, entries)))

        result, _ = self.run_script(ROLLING_PLAN, "create", "--request", request, "--plan-id", "plan-week", check=False)
        self.assertIn("output language is unknown", result.stderr)
        self.assertFalse((self.vault / "TaskMate" / "Plans" / "plan-week.md").exists())

        self.run_script(ROLLING_PLAN, "--language", "ja", "create", "--request", request, "--plan-id", "plan-week")
        self.assertIn("## 作業計画", self.visible_text())

    def test_taskmate_language_setting_wins_over_the_language_option(self):
        self.write_settings({"language": "auto", "desktopLanguage": "en"})
        task = self.create_task("Task 1")
        entries = [self.entry(task, self.snapshots(), 1)]

        self.run_script(ROLLING_PLAN, "--language", "ja", "create", "--request", str(self.write_json(self.request(entries, entries))), "--plan-id", "plan-week")
        self.assertIn("## Working plan", self.visible_text())

    def test_japanese_proposal_reasons_and_review_notes(self):
        self.write_settings({"language": "ja"})
        overdue, _, undated = self.mixed_plan()

        _, result = self.propose("proposal-ja", 2)

        proposal = self.proposal_json("proposal-ja")
        reasons = {task["taskId"]: task["changes"][0]["reason"] for task in proposal["tasks"]}
        self.assertEqual(reasons[overdue["id"]], "期限を過ぎているので最初に片付ける。（計画 plan-week の PLAN-01、予定日2026-10-01を過ぎていた）")
        self.assertEqual(reasons[undated["id"]], "構成とスライドで1時間。（計画 plan-week の PLAN-03）")
        self.assertEqual(proposal["summary"], "期限を過ぎた請求書を今日に入れ、資料は水曜に2段階で進めます。")
        visible = self.visible_text()
        self.assertIn("Task変更レビュー proposal-ja に含めています。", visible)
        self.assertIn("変わらないため、Task変更レビュー proposal-ja に含めていません。", visible)
        self.assertIn("- Task変更レビュー proposal-ja（全日程、計画の版 3）：2件を含めました。", visible)
        self.assertEqual(len(result["included"]), 2)
        self.assertEqual([value["reason"] for value in result["omitted"]], ["no-change"])

    def test_change_counts_match_the_items_an_all_dates_proposal_includes_and_omits(self):
        self.ready_plan()

        self.assertIn("Change: 2 · No change: 1 · Not scheduled: 0", self.visible_text())
        _, result = self.propose("proposal-all", 2)

        self.assertEqual((len(result["included"]), len(result["omitted"])), (2, 1))

    def test_revised_and_stale_items_explain_their_review_status(self):
        today, _, _ = self.ready_plan()
        self.run_script(TODO_STORE, "update", "--id", today["id"], "--title", "Edited elsewhere")
        self.propose("proposal-first", 2)
        move = self.write_json({"changes": [{"id": "PLAN-03", "operation": "move", "date": "2026-10-28", "reason": "Later is fine."}]})
        self.run_script(ROLLING_PLAN, "revise", "--plan-id", "plan-week", "--revision", "3", "--changes", str(move))

        visible = self.visible_text()

        self.assertIn("Not in Task change review proposal-first: the Task changed after planning.", visible)
        self.assertIn("Revised after Task change review proposal-first; a new review is needed to include the revision.", visible)

    def test_working_plan_summary_is_required_and_single_paragraph(self):
        self.simple_plan(count=1)

        empty, _ = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1", "--summary", " ", check=False)
        multiline, _ = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1", "--summary", "One.\nTwo.", check=False)
        comment, _ = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1", "--summary", "<!-- taskmate-plan {} -->", check=False)
        too_long, _ = self.run_script(ROLLING_PLAN, "select-base", "--plan-id", "plan-week", "--base", "recommended", "--revision", "1", "--summary", "x" * 501, check=False)

        self.assertIn("--summary is required", empty.stderr)
        self.assertIn("one paragraph", multiline.stderr)
        self.assertIn("one paragraph", comment.stderr)
        self.assertIn("at most 500 characters", too_long.stderr)
        self.assertIsNone(self.show()["working"])

    def test_task_summaries_are_required_for_every_included_item(self):
        self.ready_plan()

        missing, _ = self.propose("proposal-missing", 2, summaries={"PLAN-01": "Today first."}, check=False)
        unknown, _ = self.propose("proposal-unknown", 2, summaries={"PLAN-09": "Nothing."}, check=False)

        self.assertIn("missing: PLAN-03", missing.stderr)
        self.assertIn("unknown working-plan item in --task-summaries: PLAN-09", unknown.stderr)
        self.assertFalse((self.vault / "TaskMate" / "Proposals" / "proposal-missing.json").exists())
        self.assertEqual(self.show()["status"], "ready")

    def test_plans_from_an_earlier_schema_are_refused(self):
        self.simple_plan(count=1)
        path = self.vault / "TaskMate" / "Plans" / "plan-week.md"
        path.write_text(path.read_text(encoding="utf-8").replace('"schemaVersion":2', '"schemaVersion":1'), encoding="utf-8")

        result, _ = self.run_script(ROLLING_PLAN, "show", "--plan-id", "plan-week", check=False)

        self.assertIn("schema version 1 from an earlier Task Pilot", result.stderr)

    def test_invalid_plan_identifier_is_rejected(self):
        result, _ = self.run_script(ROLLING_PLAN, "show", "--plan-id", "../escape", check=False)
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
