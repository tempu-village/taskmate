import { describe, expect, it } from "vitest";
import { parseTaskMarkdown } from "../../../src/tasks/markdown";
import { TaskRepository } from "../../../src/tasks/repository";
import { parseSourceCandidateProposal, promotedTaskId } from "../../../src/reviews/source-candidate/proposal";
import { SourceCandidateReviewRepository } from "../../../src/reviews/source-candidate/review-repository";
import { importedHash, sourceNoteHash } from "../../../src/reviews/source-candidate/source-note-provenance";
import { exampleJson } from "./fixture";
import { MemoryVault } from "./memory-vault";

const NOTE_PATH = "Notes/2026-10-17 顧客定例.md";
const NOTE = "---\ntype: meeting-note\ntaskmate-task-ids:\n  - \"existing-task\"\n---\n\n# 顧客定例\n\n- 佐藤さんへ契約書の修正版を今日中に送る。\n- 次回会議は金曜午後を候補にする。\n";
const PROPOSALS = "TaskMate/Proposals";
const REVIEW_PATH = `${PROPOSALS}/source-review-20261017T101500-demo.json`;
const HISTORY_PATH = `${PROPOSALS}/History/source-review-20261017T101500-demo.json`;
const REVIEW_ID = "source-review-20261017T101500-demo";
const MERGE_TARGET = "44444444-4444-4444-8444-444444444444";

let clock = 0;
const now = () => `2026-10-18T09:00:${String(clock++ % 60).padStart(2, "0")}.000Z`;

async function setup(note = NOTE) {
  const vault = new MemoryVault();
  for (const folder of ["Notes", "TaskMate", "TaskMate/Tasks", PROPOSALS]) vault.folders.add(folder);
  const review = exampleJson();
  vault.put(NOTE_PATH, note);
  review.sources[0].sha256 = await sourceNoteHash(note);
  vault.put(review.candidates[1].mergeTarget.path, review.candidates[1].mergeTarget.beforeMarkdown);
  vault.put(REVIEW_PATH, `${JSON.stringify(review, null, 2)}\n`);
  const app = vault.app();
  const tasks = new TaskRepository(app, () => "TaskMate/Tasks");
  const reviews = new SourceCandidateReviewRepository(app, () => PROPOSALS, tasks);
  return { vault, tasks, reviews, review };
}

function taskFiles(vault: MemoryVault): string[] {
  return [...vault.files.keys()].filter((path) => path.startsWith("TaskMate/Tasks/")).sort();
}

describe("Source candidate formal apply", () => {
  it("applies create, merge and exclude, writes provenance once and archives the review", async () => {
    const { vault, tasks, reviews } = await setup();
    const createdId = await promotedTaskId(REVIEW_ID, "SC-01", 1);

    const result = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });

    expect(result.applied).toEqual(["SC-01", "SC-02", "SC-03"]);
    expect([result.failed, result.stale, result.archived]).toEqual([[], [], true]);
    const created = (await tasks.list()).find((task) => task.id === createdId);
    expect(created).toMatchObject({ title: "顧客Aへ修正版の契約書を送る", date: "2026-10-17", priority: 2, sourceNote: NOTE_PATH });
    expect(created?.steps.map((step) => step.text)).toEqual(["修正版PDFを最終確認する", "佐藤さんへメールで送る"]);
    const merged = parseTaskMarkdown("x.md", vault.text("TaskMate/Tasks/明日のデモを準備する.md"));
    expect(merged?.steps.map((step) => step.text)).toEqual(["デモデータを準備する", "検索フィルターを確認する"]);
    expect(taskFiles(vault)).toHaveLength(2);
    const note = vault.text(NOTE_PATH);
    expect(importedHash(note)).toBe(await sourceNoteHash(NOTE));
    expect(note).toContain("taskmate-import-status: \"processed\"");
    expect(note).toContain(`taskmate-task-ids:\n  - "existing-task"\n  - "${createdId}"\n---`);
    expect(note).not.toContain(MERGE_TARGET);
    expect(vault.files.has(REVIEW_PATH)).toBe(false);
    const archived = parseSourceCandidateProposal(vault.text(HISTORY_PATH));
    expect([archived.status, archived.candidates.map((candidate) => candidate.application.promotedTaskId)]).toEqual(["history", [createdId, MERGE_TARGET, null]]);
    expect((await reviews.listHistory()).map((summary) => summary.reviewId)).toEqual([REVIEW_ID]);
    expect(await reviews.listPending()).toEqual([]);
  });

  it("refuses unviewed merges without acknowledgement and writes nothing", async () => {
    const { vault, reviews } = await setup();
    const before = new Map([...vault.files].map(([path, entry]) => [path, entry.content]));

    await expect(reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: false, now })).rejects.toThrow("acknowledge");

    expect(new Map([...vault.files].map(([path, entry]) => [path, entry.content]))).toEqual(before);
  });

  it("marks candidates from a changed note stale and still applies independent work", async () => {
    const { vault, reviews } = await setup();
    vault.put(NOTE_PATH, `${NOTE}- 追記された行\n`);

    const result = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });

    expect(result.applied).toEqual(["SC-02"]);
    expect(result.stale.map((item) => item.candidateId)).toEqual(["SC-01", "SC-03"]);
    expect(result.archived).toBe(false);
    expect(importedHash(vault.text(NOTE_PATH))).toBeNull();
    const review = parseSourceCandidateProposal(vault.text(REVIEW_PATH));
    expect([review.status, review.health]).toEqual(["partially-applied", "stale"]);
  });

  it("marks a merge stale when its target changed and continues", async () => {
    const { vault, reviews, review } = await setup();
    const path = review.candidates[1].mergeTarget.path;
    vault.put(path, vault.text(path).replace("priority: 2", "priority: 1"));

    const result = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });

    expect(result.applied).toEqual(["SC-01", "SC-03"]);
    expect(result.stale).toEqual([{ candidateId: "SC-02", reason: "Merge target 明日のデモを準備する changed after staging" }]);
    expect(vault.text(path)).toContain("priority: 1");
  });

  it("does not create a second Task or merge again when a crash left work done but unrecorded", async () => {
    const { vault, tasks, reviews, review } = await setup();
    const createdId = await promotedTaskId(REVIEW_ID, "SC-01", 1);
    const draft = review.candidates[0].taskDraft;
    await tasks.create({ ...draft, projectId: draft.project, sourceNote: NOTE_PATH }, createdId);
    vault.put(review.candidates[1].mergeTarget.path, review.candidates[1].mergeTarget.afterMarkdown);

    const result = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });

    expect(result.applied).toEqual(["SC-01", "SC-02", "SC-03"]);
    expect(taskFiles(vault)).toHaveLength(2);
    expect((await tasks.list()).filter((task) => task.id === createdId)).toHaveLength(1);
  });

  it("records a failed create, continues, and retries it later", async () => {
    const { vault, tasks, reviews } = await setup();
    vault.failCreate = (path) => path.startsWith("TaskMate/Tasks/");

    const first = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });

    expect(first.failed.map((item) => item.candidateId)).toEqual(["SC-01"]);
    expect(first.applied).toEqual(["SC-02", "SC-03"]);
    expect(importedHash(vault.text(NOTE_PATH))).toBeNull();
    vault.failCreate = null;
    const second = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });
    expect([second.applied, second.archived]).toEqual([["SC-01"], true]);
    expect((await tasks.list()).length).toBe(2);
  });

  it("stops at the first review save failure so unrecorded writes cannot continue", async () => {
    const { vault, reviews } = await setup();
    vault.failModify = (path) => path === REVIEW_PATH;

    await expect(reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now })).rejects.toThrow("modify failed");

    expect(taskFiles(vault)).toHaveLength(2);
    expect(vault.text("TaskMate/Tasks/明日のデモを準備する.md")).not.toContain("検索フィルターを確認する");
  });

  it("retries provenance on a later formal apply before archiving", async () => {
    const { vault, reviews } = await setup();
    vault.failProcess = (path) => path === NOTE_PATH;

    const first = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });

    expect(first.provenance.failed.map((item) => item.path)).toEqual([NOTE_PATH]);
    expect(first.archived).toBe(false);
    expect(parseSourceCandidateProposal(vault.text(REVIEW_PATH)).status).toBe("applied");
    vault.failProcess = null;
    const second = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });
    expect([second.applied, second.provenance.written, second.archived]).toEqual([[], [NOTE_PATH], true]);
  });

  it("reports a note changed after its candidates were applied instead of writing provenance", async () => {
    const { vault, reviews } = await setup();
    vault.failProcess = (path) => path === NOTE_PATH;
    await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });
    vault.failProcess = null;
    vault.put(NOTE_PATH, `${NOTE}- 後から追記\n`);

    const result = await reviews.formalApply(REVIEW_ID, { acknowledgeUnviewedMerges: true, now });

    expect([result.provenance.changed, result.provenance.written, result.archived]).toEqual([[NOTE_PATH], [], true]);
    expect(importedHash(vault.text(NOTE_PATH))).toBeNull();
  });
});
