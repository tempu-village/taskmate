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

    def test_create_mark_and_detect_changed_source(self):
        self.write_note("Notes/source.md", "# Meeting\n\nSend the estimate.\n")
        created = self.run_store("create", "--title", "Send the estimate", "--date", "2026-09-10", "--source-note", "Notes/source.md")
        self.assertTrue(Path(created["path"]).name.startswith("Send the estimate--"))
        marked = self.run_store("mark-source", "--source", "Notes/source.md", "--task-id", created["id"])
        sources = self.run_store("sources")

        self.assertEqual(marked["status"], "processed")
        self.assertEqual(sources[0]["state"], "processed")
        self.assertEqual(sources[0]["taskIds"], [created["id"]])

        source = self.vault / "Notes" / "source.md"
        source.write_text(source.read_text(encoding="utf-8") + "Another action.\n", encoding="utf-8")
        self.assertEqual(self.run_store("sources")[0]["state"], "changed")
        self.assertTrue(self.run_store("validate")["valid"])


if __name__ == "__main__":
    unittest.main()
