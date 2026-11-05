import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "todo_store.py"


class TodoStoreTest(unittest.TestCase):
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

    def run_store(self, *arguments):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--vault", str(self.vault), *arguments],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(result.stdout)

    def write_note(self, relative, text):
        path = self.vault / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def test_source_folder_inheritance_and_note_overrides(self):
        self.write_note("Notes/inherited.md", "# Included\n")
        self.write_note("Notes/excluded.md", "---\ntaskmate-source: false\n---\n# Excluded\n")
        self.write_note("Elsewhere/explicit.md", "---\ntaskmate-source: true\n---\n# Explicit\n")

        sources = self.run_store("sources")

        self.assertEqual([item["path"] for item in sources], ["Elsewhere/explicit.md", "Notes/inherited.md"])
        self.assertTrue(all(item["state"] == "pending" for item in sources))

    def test_source_discovery_excludes_taskmate_managed_folders(self):
        settings = self.vault / ".obsidian" / "plugins" / "taskmate" / "data.json"
        values = json.loads(settings.read_text(encoding="utf-8"))
        values["sourceFolders"] = ["TaskMate"]
        settings.write_text(json.dumps(values), encoding="utf-8")
        self.write_note("TaskMate/Tasks/task.md", "---\ntype: todo\nid: \"task-1\"\n---\n# Task\n")
        self.write_note("TaskMate/Projects/project.md", "---\ntype: taskmate-project\nid: \"project-1\"\n---\n")
        self.write_note("TaskMate/Proposals/notes.md", "# Proposal folder note\n")
        self.write_note("TaskMate/Notes/source.md", "# Included source\n")

        self.assertEqual([item["path"] for item in self.run_store("sources")], ["TaskMate/Notes/source.md"])

    def test_create_mark_and_detect_changed_source(self):
        self.write_note("Notes/source.md", "# Meeting\n\nSend the estimate.\n")
        created = self.run_store(
            "create", "--title", "Send the estimate", "--date", "2026-09-10",
            "--priority", "1", "--label", "work", "--label", "client",
            "--project", "launch-project", "--source-note", "Notes/source.md",
        )
        self.assertEqual(Path(created["path"]).name, "Send the estimate.md")
        self.assertEqual(created["priority"], 1)
        self.assertEqual(created["labels"], ["work", "client"])
        self.assertEqual(created["project"], "launch-project")
        marked = self.run_store("mark-source", "--source", "Notes/source.md", "--task-id", created["id"])
        sources = self.run_store("sources")

        self.assertEqual(marked["status"], "processed")
        self.assertEqual(sources[0]["state"], "processed")
        self.assertEqual(sources[0]["taskIds"], [created["id"]])

        source = self.vault / "Notes" / "source.md"
        source.write_text(source.read_text(encoding="utf-8") + "Another action.\n", encoding="utf-8")
        self.assertEqual(self.run_store("sources")[0]["state"], "changed")
        self.assertTrue(self.run_store("validate")["valid"])

    def test_duplicate_titles_get_a_readable_numbered_filename(self):
        first = self.run_store("create", "--title", "Buy milk")
        second = self.run_store("create", "--title", "Buy milk")

        self.assertEqual(Path(first["path"]).name, "Buy milk.md")
        self.assertEqual(Path(second["path"]).name, "Buy milk (2).md")
        self.assertNotEqual(first["id"], second["id"])

    def test_output_language_follows_the_taskmate_setting_then_the_desktop_language(self):
        settings = self.vault / ".obsidian" / "plugins" / "taskmate" / "data.json"

        def language(**values):
            settings.write_text(json.dumps({"taskFolder": "TaskMate/Tasks", **values}), encoding="utf-8")
            return self.run_store("language")

        self.assertEqual(language(language="ja", desktopLanguage="en"), {"language": "ja", "source": "setting"})
        self.assertEqual(language(language="en", desktopLanguage="ja"), {"language": "en", "source": "setting"})
        self.assertEqual(language(language="auto", desktopLanguage="ja"), {"language": "ja", "source": "desktop"})
        self.assertEqual(language(desktopLanguage="ja"), {"language": "ja", "source": "desktop"})
        self.assertEqual(language(language="auto"), {"language": "unknown", "source": "unknown"})
        self.assertEqual(language(language="auto", desktopLanguage="fr"), {"language": "unknown", "source": "unknown"})
        settings.unlink()
        self.assertEqual(self.run_store("language"), {"language": "unknown", "source": "unknown"})

    def test_update_can_clear_priority_labels_and_project(self):
        created = self.run_store(
            "create", "--title", "Prepare launch", "--priority", "2",
            "--label", "launch", "--project", "project-1",
        )

        updated = self.run_store(
            "update", "--id", created["id"], "--priority", "none",
            "--project", "none",
        )
        self.assertIsNone(updated["priority"])
        self.assertEqual(updated["labels"], ["launch"])
        self.assertIsNone(updated["project"])

        cleared = self.run_store("update", "--id", created["id"], "--label", "")
        self.assertEqual(cleared["labels"], [])

    def test_scheduled_date_and_deadline_round_trip_independently(self):
        combinations = [(None, None), ("2026-10-15", None), (None, "2026-10-12"), ("2026-10-15", "2026-10-12")]
        for index, (date, deadline) in enumerate(combinations):
            arguments = ["create", "--title", f"Combination {index}"]
            if date: arguments += ["--date", date]
            if deadline: arguments += ["--deadline", deadline]
            created = self.run_store(*arguments)
            listed = next(task for task in self.run_store("list") if task["id"] == created["id"])
            self.assertEqual((listed["date"], listed["deadline"]), (date, deadline))

        both = next(task for task in self.run_store("list") if task["title"] == "Combination 3")
        rescheduled = self.run_store("update", "--id", both["id"], "--date", "2026-10-16")
        self.assertEqual((rescheduled["date"], rescheduled["deadline"]), ("2026-10-16", "2026-10-12"))
        unscheduled = self.run_store("update", "--id", both["id"], "--date", "none")
        self.assertEqual((unscheduled["date"], unscheduled["deadline"]), (None, "2026-10-12"))
        moved_deadline = self.run_store("update", "--id", both["id"], "--deadline", "none")
        self.assertEqual((moved_deadline["date"], moved_deadline["deadline"]), (None, None))

    def test_legacy_task_with_only_date_gets_no_invented_deadline(self):
        self.write_note("TaskMate/Tasks/Legacy.md", "---\ntype: todo\nid: legacy\ncompleted: false\ndate: \"2026-10-15\"\ncustom: keep\n---\n\n# Legacy\n")
        listed = next(task for task in self.run_store("list") if task["id"] == "legacy")
        self.assertEqual((listed["date"], listed["deadline"]), ("2026-10-15", None))
        self.run_store("update", "--id", "legacy", "--title", "Legacy task")
        text = next((self.vault / "TaskMate/Tasks").glob("Legacy*.md")).read_text(encoding="utf-8")
        self.assertIn("deadline: null", text)
        self.assertIn('date: "2026-10-15"', text)
        self.assertIn("custom: keep", text)
        self.assertTrue(self.run_store("validate")["valid"])

    def test_time_and_repeat_round_trip_and_clear(self):
        created = self.run_store(
            "create", "--title", "Water plants", "--date", "2026-10-14", "--time", "07:30",
            "--repeat", "Every 2 Weeks",
        )
        self.assertEqual((created["time"], created["repeat"]), ("07:30", "every 2 weeks"))
        text = (self.vault / created["path"]).read_text(encoding="utf-8")
        self.assertIn('time: "07:30"\nrepeat: "every 2 weeks"', text)
        listed = next(task for task in self.run_store("list") if task["id"] == created["id"])
        self.assertEqual((listed["time"], listed["repeat"]), ("07:30", "every 2 weeks"))

        cleared = self.run_store("update", "--id", created["id"], "--time", "none", "--repeat", "none")
        self.assertEqual((cleared["time"], cleared["repeat"]), (None, None))
        text = (self.vault / cleared["path"]).read_text(encoding="utf-8")
        self.assertNotRegex(text, r"(?m)^(time|repeat):")

    def test_date_only_task_writes_no_schedule_lines(self):
        created = self.run_store("create", "--title", "Plain", "--date", "2026-10-14")
        text = (self.vault / created["path"]).read_text(encoding="utf-8")
        self.assertNotRegex(text, r"(?m)^(time|repeat):")

    def test_schedule_values_are_validated(self):
        for arguments, message in [
            (["--time", "07:30"], "time and repeat require a date"),
            (["--date", "2026-10-14", "--time", "7:30"], "time must be HH:MM"),
            (["--date", "2026-10-14", "--repeat", "every weekday"], "repeat must be"),
        ]:
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--vault", str(self.vault), "create", "--title", "Invalid", *arguments],
                capture_output=True, text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(message, result.stderr)

    def test_unreadable_schedule_values_are_kept_as_written(self):
        self.write_note(
            "TaskMate/Tasks/Odd.md",
            "---\ntype: todo\nid: odd\ncompleted: false\ndate: \"2026-10-14\"\nrepeat: \"every weekday\"\n---\n\n# Odd\n",
        )
        listed = next(task for task in self.run_store("list") if task["id"] == "odd")
        self.assertIsNone(listed["repeat"])
        self.run_store("update", "--id", "odd", "--notes", "Edited")
        text = (self.vault / "TaskMate/Tasks/Odd.md").read_text(encoding="utf-8")
        self.assertIn('repeat: "every weekday"', text)

    def test_completing_a_recurring_task_advances_it(self):
        created = self.run_store(
            "create", "--title", "Pay rent", "--date", "2026-01-31", "--deadline", "2026-02-02",
            "--repeat", "monthly", "--steps-json", json.dumps([{"text": "Transfer", "completed": True, "date": None}]),
        )
        self.write_note(created["path"], (self.vault / created["path"]).read_text(encoding="utf-8").replace("type: todo", "type: todo\ncustom: keep"))
        advanced = self.run_store("complete", "--id", created["id"])
        self.assertFalse(advanced["completed"])
        self.assertIsNone(advanced["completed-at"])
        self.assertEqual((advanced["date"], advanced["deadline"]), ("2026-02-28", "2026-03-02"))
        self.assertEqual(advanced["steps"], [{"text": "Transfer", "completed": False, "date": None}])
        text = (self.vault / created["path"]).read_text(encoding="utf-8")
        self.assertIn("custom: keep", text)
        self.assertEqual(self.run_store("complete", "--id", created["id"])["date"], "2026-03-31")
        self.assertEqual(len(list((self.vault / "TaskMate/Tasks").glob("*.md"))), 1)

    def test_monthly_rules_keep_their_day_or_the_month_end(self):
        thirtieth = self.run_store("create", "--title", "Invoice", "--date", "2026-01-30", "--repeat", "monthly")
        self.assertEqual(thirtieth["repeat"], "monthly on day 30")
        self.assertEqual(self.run_store("complete", "--id", thirtieth["id"])["date"], "2026-02-28")
        self.assertEqual(self.run_store("complete", "--id", thirtieth["id"])["date"], "2026-03-30")
        moved = self.run_store("update", "--id", thirtieth["id"], "--date", "2026-03-15")
        self.assertEqual(moved["repeat"], "monthly on day 15")

        month_end = self.run_store("create", "--title", "Close books", "--date", "2026-01-31", "--repeat", "Monthly on Last Day")
        self.assertEqual(month_end["repeat"], "monthly on last day")
        self.assertEqual(self.run_store("complete", "--id", month_end["id"])["date"], "2026-02-28")
        self.assertEqual(self.run_store("complete", "--id", month_end["id"])["date"], "2026-03-31")

        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--vault", str(self.vault), "create", "--title", "Bad", "--date", "2026-01-01", "--repeat", "weekly on day 3"],
            capture_output=True, text=True,
        )
        self.assertNotEqual(result.returncode, 0)

    def test_steps_round_trip_and_reorder(self):
        steps = [
            {"text": "Reserve hotel", "completed": False, "date": "2026-10-01"},
            {"text": "Check train", "completed": True, "date": None},
        ]
        created = self.run_store("create", "--title", "Plan trip", "--notes", "Passport", "--steps-json", json.dumps(steps))
        reordered = [steps[1], steps[0]]
        updated = self.run_store("update", "--id", created["id"], "--steps-json", json.dumps(reordered))
        self.assertEqual(updated["steps"], reordered)
        markdown = (self.vault / created["path"]).read_text(encoding="utf-8")
        self.assertLess(markdown.index("Check train"), markdown.index("Reserve hotel"))
        self.assertIn("<!-- due: 2026-10-01 -->", markdown)


if __name__ == "__main__":
    unittest.main()
