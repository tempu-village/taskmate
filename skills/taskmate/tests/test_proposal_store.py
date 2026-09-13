import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "proposal_store.py"


class ProposalStoreTest(unittest.TestCase):
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
        self.write_note("Notes/source.md", "# Meeting\n\nSend the estimate.\nIgnore the small talk.\n")

    def tearDown(self):
        self.temporary.cleanup()

    def write_note(self, relative, text):
        path = self.vault / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def write_json(self, name, value):
        path = self.vault / name
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        return path

    def run_store(self, *arguments, check=True):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--vault", str(self.vault), *arguments],
            check=check,
            capture_output=True,
            text=True,
        )
        if check:
            return json.loads(result.stdout)
        return result

    def plan(self):
        return {
            "language": "ja",
            "sources": ["Notes/source.md"],
            "proposals": [
                {
                    "operation": "create",
                    "title": "見積書を送る",
                    "sourceNote": "Notes/source.md",
                    "coverage": ["Send the estimate."],
                    "date": None,
                    "priority": 1,
                    "labels": ["仕事"],
                    "project": None,
                    "notes": "送付前に金額を確認する。",
                },
                {
                    "operation": "exclude",
                    "title": "雑談をタスクにしない",
                    "sourceNote": "Notes/source.md",
                    "coverage": ["Ignore the small talk."],
                    "reason": "行動を必要としないため。",
                },
            ],
        }

    def stage(self):
        plan = self.write_json("plan.json", self.plan())
        return self.run_store("stage", "--plan", str(plan))

    def test_stage_keeps_proposals_out_of_the_canonical_task_folder(self):
        staged = self.stage()
        inspected = self.run_store("inspect", "--session", staged["sessionId"])

        self.assertEqual(inspected["status"], "pending-review")
        self.assertEqual(len(inspected["proposals"]), 2)
        self.assertFalse((self.vault / "TaskMate" / "Tasks").exists())
        proposal_path = self.vault / inspected["proposals"][0]["path"]
        proposal_text = proposal_path.read_text(encoding="utf-8")
        self.assertIn("type: taskmate-proposal", proposal_text)
        self.assertIn("decision: pending", proposal_text)
        self.assertIn("未判断", proposal_text)
        self.assertNotIn("taskmate-import-status", (self.vault / "Notes/source.md").read_text(encoding="utf-8"))

    def test_promote_creates_only_approved_tasks_and_marks_every_decision(self):
        staged = self.stage()
        decisions = self.write_json("decisions.json", {"decisions": [
            {"proposalId": staged["proposals"][0]["proposalId"], "decision": "approved"},
            {"proposalId": staged["proposals"][1]["proposalId"], "decision": "excluded", "reason": "行動不要"},
        ]})

        promoted = self.run_store("promote", "--session", staged["sessionId"], "--decisions", str(decisions))
        inspected = self.run_store("inspect", "--session", staged["sessionId"])

        self.assertTrue(promoted["archived"])
        self.assertEqual(inspected["status"], "archived")
        self.assertEqual([item["decision"] for item in inspected["proposals"]], ["approved", "excluded"])
        self.assertEqual(len(list((self.vault / "TaskMate/Tasks").glob("*.md"))), 1)
        approved_text = (self.vault / inspected["proposals"][0]["path"]).read_text(encoding="utf-8")
        excluded_text = (self.vault / inspected["proposals"][1]["path"]).read_text(encoding="utf-8")
        self.assertIn("判断済み — 正式タスク化", approved_text)
        self.assertIn("判断済み — 除外", excluded_text)
        source_text = (self.vault / "Notes/source.md").read_text(encoding="utf-8")
        self.assertIn("taskmate-import-status: \"processed\"", source_text)
        self.assertIn(promoted["taskIds"][0], source_text)

    def test_partial_promotion_is_idempotent_and_stays_active(self):
        staged = self.stage()
        first_decision = {"decisions": [
            {"proposalId": staged["proposals"][0]["proposalId"], "decision": "approved"},
        ]}
        decisions = self.write_json("partial.json", first_decision)

        first = self.run_store("promote", "--session", staged["sessionId"], "--decisions", str(decisions))
        second = self.run_store("promote", "--session", staged["sessionId"], "--decisions", str(decisions))

        self.assertFalse(first["archived"])
        self.assertFalse(second["archived"])
        self.assertEqual(first["taskIds"], second["taskIds"])
        self.assertEqual(len(list((self.vault / "TaskMate/Tasks").glob("*.md"))), 1)

    def test_changed_source_blocks_promotion_before_writing_tasks(self):
        staged = self.stage()
        source = self.vault / "Notes/source.md"
        source.write_text(source.read_text(encoding="utf-8") + "New action.\n", encoding="utf-8")
        decisions = self.write_json("decisions.json", {"decisions": [
            {"proposalId": staged["proposals"][0]["proposalId"], "decision": "approved"},
        ]})

        result = self.run_store(
            "promote", "--session", staged["sessionId"], "--decisions", str(decisions), check=False
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("source changed", result.stderr)
        self.assertFalse((self.vault / "TaskMate/Tasks").exists())
        inspected = self.run_store("inspect", "--session", staged["sessionId"])
        self.assertEqual(inspected["status"], "needs-review")


if __name__ == "__main__":
    unittest.main()
