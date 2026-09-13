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
        self.write_note("TaskMate/Proposals/Active/session/Tasks/proposal.md", "---\ntype: taskmate-proposal\nproposal-id: \"proposal-1\"\n---\n")
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


if __name__ == "__main__":
    unittest.main()
