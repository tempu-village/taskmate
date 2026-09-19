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
            "candidates": [
                {"sourceNote": "Notes/source.md", "statement": "Send the estimate."},
                {"sourceNote": "Notes/source.md", "statement": "Ignore the small talk."},
            ],
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

    def test_stage_rejects_a_candidate_silently_omitted_from_proposals(self):
        plan = self.plan()
        plan["proposals"] = plan["proposals"][:1]
        result = self.run_store("stage", "--plan", str(self.write_json("omitted.json", plan)), check=False)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("candidate is not covered", result.stderr)
        self.assertFalse((self.vault / "TaskMate/Proposals").exists())
        self.assertFalse((self.vault / "TaskMate/Tasks").exists())

    def test_stage_rejects_invalid_candidate_manifests_before_writing_files(self):
        cases = {}

        missing_manifest = self.plan()
        del missing_manifest["candidates"]
        cases["plan.candidates must be a non-empty array"] = missing_manifest

        invalid_source = self.plan()
        invalid_source["candidates"][0]["sourceNote"] = "Notes/other.md"
        cases["candidate source is not in the plan source set"] = invalid_source

        empty_statement = self.plan()
        empty_statement["candidates"][0]["statement"] = "  "
        cases["candidate statement must be a non-empty string"] = empty_statement

        duplicate = self.plan()
        duplicate["candidates"].append(dict(duplicate["candidates"][0]))
        cases["duplicate candidate"] = duplicate

        missing_from_source = self.plan()
        missing_from_source["candidates"][0]["statement"] = "This sentence is not in the note."
        missing_from_source["proposals"][0]["coverage"] = ["This sentence is not in the note."]
        cases["candidate statement was not found"] = missing_from_source

        partial_statement = self.plan()
        partial_statement["candidates"][0]["statement"] = "estimate"
        partial_statement["proposals"][0]["coverage"] = ["estimate"]
        cases["candidate statement was not found"] = partial_statement

        undeclared = self.plan()
        undeclared["proposals"][0]["coverage"] = ["Meeting"]
        cases["proposal coverage is not a declared candidate"] = undeclared

        covered_twice = self.plan()
        covered_twice["proposals"][1]["coverage"] = ["Send the estimate."]
        cases["candidate is covered more than once"] = covered_twice

        for expected, plan in cases.items():
            with self.subTest(expected=expected):
                result = self.run_store("stage", "--plan", str(self.write_json("invalid.json", plan)), check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(expected, result.stderr)
                self.assertFalse((self.vault / "TaskMate/Proposals").exists())
                self.assertFalse((self.vault / "TaskMate/Tasks").exists())


if __name__ == "__main__":
    unittest.main()
