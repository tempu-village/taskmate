import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
TODO_STORE = SCRIPTS / "todo_store.py"
IMPORT_REVIEW = SCRIPTS / "import_review.py"
sys.path.insert(0, str(SCRIPTS))
import todo_store  # noqa: E402

NOTE_TEXT = """---
type: meeting-note
---

# Customer sync

- Send the revised contract to Sato today.
- Check the demo search filter tomorrow.
- The next meeting may be Friday afternoon.
"""
CONVERSATION = "Please also prepare the release checklist."


class ImportReviewTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.vault = Path(self.temporary.name)
        settings = self.vault / ".obsidian" / "plugins" / "taskmate" / "data.json"
        settings.parent.mkdir(parents=True)
        settings.write_text(json.dumps({
            "taskFolder": "TaskMate/Tasks", "projectFolder": "TaskMate/Projects", "proposalFolder": "TaskMate/Proposals",
            "sourceFolders": ["Notes"], "includeSourceSubfolders": True,
            "agentCompatibility": {"pluginVersion": "0.7.0", "importReviewSchemaVersions": [1, 2]},
        }), encoding="utf-8")
        self.install_taskmate("0.7.0")
        self.note = self.vault / "Notes" / "sync.md"
        self.note.parent.mkdir()
        self.note.write_text(NOTE_TEXT, encoding="utf-8")
        self.request_number = 0

    def install_taskmate(self, version):
        (self.vault / ".obsidian" / "plugins" / "taskmate" / "manifest.json").write_text(json.dumps({"id": "taskmate", "version": version}), encoding="utf-8")

    def set_compatibility(self, compatibility):
        settings = self.vault / ".obsidian" / "plugins" / "taskmate" / "data.json"
        data = json.loads(settings.read_text(encoding="utf-8"))
        if compatibility is None:
            data.pop("agentCompatibility", None)
        else:
            data["agentCompatibility"] = compatibility
        settings.write_text(json.dumps(data), encoding="utf-8")

    def tearDown(self):
        self.temporary.cleanup()

    def run_script(self, script, *arguments, check=True):
        result = subprocess.run([sys.executable, str(script), "--vault", str(self.vault), *arguments], check=False, capture_output=True, text=True)
        if check and result.returncode != 0:
            self.fail(f"{script.name} {' '.join(arguments)} failed: {result.stderr}")
        return result, json.loads(result.stdout) if result.returncode == 0 and result.stdout else None

    def create_task(self, title, *arguments):
        _, task = self.run_script(TODO_STORE, "create", "--title", title, *arguments)
        return task

    def snapshot(self, task_id):
        _, tasks = self.run_script(TODO_STORE, "list")
        path = next(task["path"] for task in tasks if task["id"] == task_id)
        return hashlib.sha256((self.vault / path).read_bytes()).hexdigest()

    def with_merge_changes(self, request, changes):
        request["candidates"][1]["mergeTarget"]["changes"] = changes
        return request

    def write_json(self, value):
        self.request_number += 1
        path = self.vault / f"request-{self.request_number}.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def stage(self, request, review_id="import-review-sync", check=True):
        return self.run_script(IMPORT_REVIEW, "stage", "--request", str(self.write_json(request)), "--review-id", review_id, check=check)

    def tree(self):
        return {path.relative_to(self.vault).as_posix(): path.read_bytes() for path in sorted(self.vault.rglob("*.md"))}

    def request(self, target):
        return {
            "contentLanguage": "en", "languageSource": "setting",
            "sources": [
                {"type": "note", "path": "Notes/sync.md", "statements": [
                    "Send the revised contract to Sato today.",
                    "Check the demo search filter tomorrow.",
                    "The next meeting may be Friday afternoon.",
                ]},
                {"type": "conversation", "localSourceId": "conversation-01", "snapshot": CONVERSATION,
                 "selectionInstruction": "Include this request in the review.", "threadId": None, "turnRefs": [],
                 "statements": [CONVERSATION]},
            ],
            "candidates": [
                {"operation": "create", "title": "Send the revised contract", "sourceRefs": [{"source": "Notes/sync.md", "statement": "Send the revised contract to Sato today."}],
                 "sourceSummaries": [{"source": "Notes/sync.md", "summary": "The revised contract must go to Sato today."}],
                 "taskDraft": {"title": "Send the revised contract", "date": "2026-10-18", "priority": 2, "labels": ["context/pc"], "project": None,
                               "steps": [{"text": "Check the PDF", "completed": False, "date": None}], "notes": "Agreed in the sync."}},
                {"operation": "merge", "title": "Add the filter check to the demo Task", "sourceRefs": [{"source": "Notes/sync.md", "statement": "Check the demo search filter tomorrow."}],
                 "sourceSummaries": [{"source": "Notes/sync.md", "summary": "The demo search filter needs a check tomorrow."}],
                 "mergeTarget": {"taskId": target["id"], "snapshot": self.snapshot(target["id"]), "changes": {"steps": [
                     {"text": "Prepare demo data", "completed": False, "date": None},
                     {"text": "Check the search filter", "completed": False, "date": None}]}, "reason": "Same demo outcome."}},
                {"operation": "exclude", "title": "Meeting time is not a Task", "sourceRefs": [{"source": "Notes/sync.md", "statement": "The next meeting may be Friday afternoon."}],
                 "sourceSummaries": [{"source": "Notes/sync.md", "summary": "Friday afternoon is only a possible meeting time."}],
                 "exclusionReason": "Only a proposed time."},
                {"operation": "create", "title": "Prepare the release checklist", "sourceRefs": [{"source": "conversation-01", "statement": CONVERSATION}],
                 "sourceSummaries": [{"source": "conversation-01", "summary": "The release checklist should be prepared."}],
                 "taskDraft": {"title": "Prepare the release checklist", "date": None, "priority": None, "labels": [], "project": None, "steps": [], "notes": ""}},
            ],
        }

    def demo_task(self):
        task = self.create_task("Prepare the demo", "--date", "2026-10-19")
        self.run_script(TODO_STORE, "update", "--id", task["id"], "--steps-json", json.dumps([{"text": "Prepare demo data", "completed": False, "date": None}]))
        return task

    def test_stage_writes_one_pending_json_without_changing_tasks_or_notes(self):
        target = self.demo_task()
        before = self.tree()

        _, result = self.stage(self.request(target))

        self.assertEqual(self.tree(), before)
        self.assertEqual(result["path"], "TaskMate/Proposals/import-review-sync.json")
        self.assertEqual(result["uri"], f"obsidian://taskmate-import-review?vault={self.vault.name}&review=import-review-sync")
        self.assertEqual((result["opened"], result["openError"]), (False, None))
        self.assertFalse((self.vault / "TaskMate" / "Proposals" / "Active").exists())
        review = json.loads((self.vault / result["path"]).read_text(encoding="utf-8"))
        self.assertEqual((review["schemaVersion"], review["reviewType"], review["status"], review["health"], review["revision"]), (2, "import", "pending", "ok", 1))
        self.assertEqual((review["contentLanguage"], review["languageSource"]), ("en", "setting"))
        self.assertEqual(review["candidates"][0]["sourceSummaries"], [{"sourceId": "SRC-01", "summary": "The revised contract must go to Sato today."}])
        self.assertEqual([source["id"] for source in review["sources"]], ["SRC-01", "SRC-02"])
        self.assertEqual(review["sources"][0]["sha256"], todo_store.source_hash(NOTE_TEXT))
        self.assertEqual(review["sources"][1]["sha256"], hashlib.sha256(CONVERSATION.encode("utf-8")).hexdigest())
        self.assertEqual([candidate["id"] for candidate in review["candidates"]], ["IC-01", "IC-02", "IC-03", "IC-04"])
        self.assertTrue(all(candidate["decision"] == "pending" and candidate["application"]["status"] == "not-applied" for candidate in review["candidates"]))
        merge = review["candidates"][1]["mergeTarget"]
        target_text = (self.vault / target["path"]).read_text(encoding="utf-8")
        self.assertEqual((merge["beforeMarkdown"], merge["beforeSha256"]), (target_text, hashlib.sha256(target_text.encode("utf-8")).hexdigest()))
        self.assertEqual([change["field"] for change in merge["changes"]], ["steps"])
        self.assertIn("- [ ] Check the search filter", merge["afterMarkdown"])

    def test_every_inventory_statement_must_be_mapped_exactly_once(self):
        target = self.demo_task()
        missing = self.request(target)
        missing["candidates"].pop(2)
        duplicate = self.request(target)
        duplicate["candidates"][2]["sourceRefs"] = duplicate["candidates"][0]["sourceRefs"]
        unknown = self.request(target)
        unknown["candidates"][2]["sourceRefs"][0]["statement"] = "Something else."
        invented = self.request(target)
        invented["sources"][0]["statements"].append("Call the lawyer.")

        results = [self.stage(request, check=False)[0].stderr for request in (missing, duplicate, unknown, invented)]

        self.assertIn("is not mapped by any candidate: The next meeting may be Friday afternoon.", results[0])
        self.assertIn("is mapped by both IC-01 and IC-03", results[1])
        self.assertIn("not in the Source inventory", results[2])
        self.assertIn("statement was not found in Source Notes/sync.md: Call the lawyer.", results[3])
        self.assertFalse((self.vault / "TaskMate" / "Proposals" / "import-review-sync.json").exists())

    def test_notes_must_be_eligible_unprocessed_and_not_already_in_review(self):
        target = self.demo_task()
        outside = self.vault / "Other" / "x.md"
        outside.parent.mkdir()
        outside.write_text("Call Alex.\n", encoding="utf-8")
        ineligible = self.request(target)
        ineligible["sources"][0]["path"] = "Other/x.md"

        self.assertIn("not eligible", self.stage(ineligible, check=False)[0].stderr)
        self.stage(self.request(target))
        self.assertIn("already in pending Import review import-review-sync", self.stage(self.request(target), "import-review-again", check=False)[0].stderr)
        self.assertIn("already exists", self.stage(self.request(target), check=False)[0].stderr)
        (self.vault / "TaskMate" / "Proposals" / "import-review-sync.json").unlink()
        self.run_script(TODO_STORE, "mark-source", "--source", "Notes/sync.md")
        self.assertIn("already imported", self.stage(self.request(target), "import-review-third", check=False)[0].stderr)

    def test_merge_targets_must_be_current_incomplete_and_actually_changed(self):
        target = self.demo_task()
        stale = self.request(target)
        self.run_script(TODO_STORE, "update", "--id", target["id"], "--title", "Prepare the demo carefully")

        self.assertIn("changed after inspection", self.stage(stale, check=False)[0].stderr)
        unchanged = self.with_merge_changes(self.request(target), {"steps": [{"text": "Prepare demo data", "completed": False, "date": None}]})
        self.assertIn("does not change", self.stage(unchanged, check=False)[0].stderr)
        unsupported = self.with_merge_changes(self.request(target), {"rank": 1})
        self.assertIn("merge cannot change: rank", self.stage(unsupported, check=False)[0].stderr)
        self.run_script(TODO_STORE, "complete", "--id", target["id"])
        self.assertIn("completed Task", self.stage(self.request(target), check=False)[0].stderr)

    def test_conversation_sources_require_local_provenance(self):
        target = self.demo_task()
        no_instruction = self.request(target)
        del no_instruction["sources"][1]["selectionInstruction"]
        invented = self.request(target)
        invented["sources"][1]["statements"] = ["Something that was never said."]
        invented["candidates"][3]["sourceRefs"][0]["statement"] = "Something that was never said."

        self.assertIn("selectionInstruction is required", self.stage(no_instruction, check=False)[0].stderr)
        self.assertIn("statement was not found in Source conversation-01", self.stage(invented, check=False)[0].stderr)

    def test_stage_refuses_before_writing_unless_the_installed_and_loaded_taskmate_read_schema_2(self):
        target = self.demo_task()
        cases = [
            ("old installed plugin", lambda: self.install_taskmate("0.6.2"), "installed TaskMate is 0.6.2"),
            ("not reloaded", lambda: self.set_compatibility({"pluginVersion": "0.6.2", "importReviewSchemaVersions": [1]}), "Obsidian has loaded 0.6.2"),
            ("never loaded", lambda: self.set_compatibility(None), "Obsidian has loaded an older version"),
            ("schema missing", lambda: self.set_compatibility({"pluginVersion": "0.7.0", "importReviewSchemaVersions": [1]}), "does not read Import review schema version 2"),
            ("no manifest", lambda: (self.vault / ".obsidian" / "plugins" / "taskmate" / "manifest.json").unlink(), "TaskMate is not installed"),
        ]
        for name, break_setup, message in cases:
            with self.subTest(name):
                self.install_taskmate("0.7.0")
                self.set_compatibility({"pluginVersion": "0.7.0", "importReviewSchemaVersions": [1, 2]})
                break_setup()
                result, _ = self.stage(self.request(target), check=False)
                self.assertIn(message, result.stderr)
                self.assertIn("needs TaskMate 0.7.0 or later", result.stderr)
                self.assertFalse((self.vault / "TaskMate" / "Proposals").exists())

    def test_newer_loaded_taskmate_is_accepted(self):
        self.install_taskmate("0.8.1")
        self.set_compatibility({"pluginVersion": "0.8.1", "importReviewSchemaVersions": [2, 3]})

        self.stage(self.request(self.demo_task()))

    def test_content_language_must_be_resolved_before_staging(self):
        target = self.demo_task()
        unknown = self.request(target)
        unknown["contentLanguage"] = "unknown"
        no_source = self.request(target)
        del no_source["languageSource"]

        self.assertIn("contentLanguage must be ja or en", self.stage(unknown, check=False)[0].stderr)
        self.assertIn("languageSource must be", self.stage(no_source, check=False)[0].stderr)

    def test_each_referenced_source_needs_exactly_one_summary_in_first_reference_order(self):
        target = self.demo_task()
        combined = self.request(target)
        combined["candidates"][3]["sourceRefs"].insert(0, {"source": "Notes/sync.md", "statement": "The next meeting may be Friday afternoon."})
        combined["candidates"].pop(2)
        combined["candidates"][2]["sourceSummaries"] = [
            {"source": "conversation-01", "summary": "The checklist was requested."},
            {"source": "Notes/sync.md", "summary": "A meeting may follow."},
        ]
        _, result = self.stage(combined)
        review = json.loads((self.vault / result["path"]).read_text(encoding="utf-8"))
        self.assertEqual([item["sourceId"] for item in review["candidates"][2]["sourceSummaries"]], ["SRC-01", "SRC-02"])
        (self.vault / result["path"]).unlink()

        missing = self.request(target)
        del missing["candidates"][0]["sourceSummaries"]
        extra = self.request(target)
        extra["candidates"][0]["sourceSummaries"].append({"source": "conversation-01", "summary": "Unrelated."})
        twice = self.request(target)
        twice["candidates"][0]["sourceSummaries"].append({"source": "Notes/sync.md", "summary": "Again."})
        long = self.request(target)
        long["candidates"][0]["sourceSummaries"][0]["summary"] = "x" * 1001
        messages = [self.stage(request, "import-review-bad", check=False)[0].stderr for request in (missing, extra, twice, long)]

        self.assertIn("IC-01 requires sourceSummaries", messages[0])
        self.assertIn("summarizes Source conversation-01, which it does not reference", messages[1])
        self.assertIn("summarizes Source Notes/sync.md twice", messages[2])
        self.assertIn("exceeds 1000 characters", messages[3])
        self.assertFalse((self.vault / "TaskMate" / "Proposals" / "import-review-bad.json").exists())

    def test_review_identifier_is_validated(self):
        result, _ = self.stage(self.request(self.demo_task()), "proposal-wrong", check=False)

        self.assertIn("review-id must start with import-review-", result.stderr)


if __name__ == "__main__":
    unittest.main()
