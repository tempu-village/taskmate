import { describe, expect, it } from "vitest";
import {
  archiveReview,
  decideCandidate,
  editCandidate,
  markDiffViewed,
  markSourceStale,
  mergeTargetFields,
  newlyCompletedNoteSources,
  noteSourceCompletion,
  candidateEvidence,
  importReviewFormat,
  parseImportReview,
  planFormalApply,
  recordApplication,
  verifyMergeEvidence
} from "../../../src/reviews/import/proposal";
import type { ImportCandidate, ImportReview } from "../../../src/reviews/import/proposal";
import { sha256 } from "../../../src/shared/sha256";
import { NOW, earlierFormatJson, exampleJson, exampleText } from "./fixture";

const CREATED_TASK = "55555555-5555-4555-8555-555555555555";
const MERGE_TARGET = "44444444-4444-4444-8444-444444444444";

function example(): ImportReview {
  return parseImportReview(exampleText());
}

function candidate(proposal: ImportReview, id: string): ImportCandidate {
  const found = proposal.candidates.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function mergeTarget(proposal: ImportReview) {
  const merge = candidate(proposal, "IC-02");
  if (merge.operation !== "merge") throw new Error("IC-02 must merge");
  return merge.mergeTarget;
}

function parseMutated(mutate: (value: Record<string, any>) => void): () => ImportReview {
  const value = exampleJson();
  mutate(value);
  return () => parseImportReview(JSON.stringify(value));
}

function applyAll(proposal: ImportReview): ImportReview {
  let next = recordApplication(proposal, "IC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);
  next = recordApplication(next, "IC-02", { kind: "applied", promotedTaskId: MERGE_TARGET }, NOW);
  return recordApplication(next, "IC-03", { kind: "applied", promotedTaskId: null }, NOW);
}

describe("Earlier Import review formats", () => {
  it.each([["v1", "IC-01"], ["legacy", "SC-01"]] as const)("reads a %s review and keeps its own shape through edits, decisions and History", (format, first) => {
    const value = earlierFormatJson(format);
    let review = parseImportReview(JSON.stringify(value));
    expect(importReviewFormat(review)).toBe(format);
    expect(candidateEvidence(review.candidates[0])).toEqual([{ sourceId: "SRC-01", summary: null, statements: ["佐藤さんへ契約書の修正版を今日中に送る。"] }]);

    review = editCandidate(review, first, { operation: "exclude", exclusionReason: "Not needed." }, NOW);
    review = decideCandidate(review, first, "approved", NOW);
    const [, second, third] = review.candidates.map((item) => item.id);
    review = recordApplication(review, first, { kind: "applied", promotedTaskId: null }, NOW);
    review = recordApplication(review, second, { kind: "applied", promotedTaskId: MERGE_TARGET }, NOW);
    review = archiveReview(recordApplication(review, third, { kind: "applied", promotedTaskId: null }, NOW), NOW);

    const saved = JSON.parse(JSON.stringify(review));
    expect([saved.reviewId, saved.reviewType, saved.schemaVersion, saved.candidates[0].id]).toEqual([value.reviewId, value.reviewType, 1, first]);
    expect("contentLanguage" in saved || saved.candidates.some((item: Record<string, unknown>) => "sourceSummaries" in item)).toBe(false);
    expect(() => parseImportReview(JSON.stringify(saved))).not.toThrow();
  });

  it.each([
    ["Source summaries in v1", (value: Record<string, any>) => { value.candidates[0].sourceSummaries = [{ sourceId: "SRC-01", summary: "x" }]; }, "unsupported properties: sourceSummaries"],
    ["a content language in v1", (value: Record<string, any>) => { value.contentLanguage = "ja"; }, "unsupported properties: contentLanguage"],
    ["IC- candidate IDs in a legacy review", (value: Record<string, any>) => { value.reviewType = "source-candidate"; value.reviewId = "source-review-x"; }, "must match ^SC-"],
    ["a legacy review with schema version 2", (value: Record<string, any>) => { value.reviewType = "source-candidate"; value.schemaVersion = 2; }, "must be 1 for a Source candidate review"]
  ])("rejects %s", (_name, mutate, message) => {
    const value = earlierFormatJson("v1");
    mutate(value);
    expect(() => parseImportReview(JSON.stringify(value))).toThrow(message);
  });
});

describe("Import review parsing", () => {
  it("accepts the RFC example and verifies its merge evidence", async () => {
    const proposal = example();

    expect([proposal.status, proposal.health]).toEqual(["ready-to-apply", "ok"]);
    expect(proposal.candidates.map((item) => item.operation)).toEqual(["create", "merge", "exclude"]);
    await expect(verifyMergeEvidence(mergeTarget(proposal))).resolves.toBeUndefined();
  });

  it.each([
    ["the review type", (value: Record<string, any>) => { value.reviewType = "task-change"; }, "reviewType"],
    ["the review ID prefix", (value: Record<string, any>) => { value.reviewId = "proposal-1"; }, "reviewId"],
    ["unknown properties", (value: Record<string, any>) => { value.extra = true; }, "unsupported properties"],
    ["a statement mapped twice", (value: Record<string, any>) => { value.candidates[2].sourceRefs = value.candidates[0].sourceRefs; }, "already mapped by IC-01"],
    ["an unknown Source reference", (value: Record<string, any>) => { value.candidates[0].sourceRefs[0].sourceId = "SRC-09"; value.candidates[0].sourceSummaries[0].sourceId = "SRC-09"; }, "unknown Source SRC-09"],
    ["a missing Source summary", (value: Record<string, any>) => { value.candidates[0].sourceSummaries = []; }, "requires a summary of SRC-01"],
    ["a summary of an unreferenced Source", (value: Record<string, any>) => { value.candidates[0].sourceSummaries.push({ sourceId: "SRC-02", summary: "x" }); }, "SRC-02 is not referenced by the candidate"],
    ["a Source summarized twice", (value: Record<string, any>) => { value.candidates[0].sourceSummaries.push({ sourceId: "SRC-01", summary: "x" }); }, "duplicates SRC-01"],
    ["a blank summary", (value: Record<string, any>) => { value.candidates[0].sourceSummaries[0].summary = "  "; }, "summary must be a non-empty string"],
    ["a summary over 1000 characters", (value: Record<string, any>) => { value.candidates[0].sourceSummaries[0].summary = "x".repeat(1001); }, "must not exceed 1000 characters"],
    ["a candidate without summaries", (value: Record<string, any>) => { delete value.candidates[0].sourceSummaries; }, "sourceSummaries must be an array"],
    ["an unresolved content language", (value: Record<string, any>) => { value.contentLanguage = "unknown"; }, "contentLanguage"],
    ["a missing language source", (value: Record<string, any>) => { delete value.languageSource; }, "languageSource"],
    ["an unknown schema version", (value: Record<string, any>) => { value.schemaVersion = 3; }, "must be one of 1, 2"],
    ["an unmapped Source", (value: Record<string, any>) => { value.sources.push({ ...value.sources[0], id: "SRC-03" }); }, "SRC-03 is not mapped"],
    ["a create without a Task draft", (value: Record<string, any>) => { delete value.candidates[0].taskDraft; }, "create requires taskDraft"],
    ["an applied create without a Task ID", (value: Record<string, any>) => { value.candidates[0].application = { status: "applied", appliedAt: NOW, promotedTaskId: null, error: null }; }, "promotedTaskId"],
    ["a decision newer than its candidate", (value: Record<string, any>) => { value.candidates[0].decisionRevision = 5; }, "newer than the candidate"],
    ["a pending decision with a revision", (value: Record<string, any>) => { value.candidates[0].decision = "pending"; }, "decisionRevision and decidedAt"],
    ["a status that disagrees with candidates", (value: Record<string, any>) => { value.status = "pending"; }, "does not match candidate state"],
    ["a conversation without its selection instruction", (value: Record<string, any>) => { delete value.sources[1].selectionInstruction; }, "selectionInstruction"],
    ["a merge path outside the Vault", (value: Record<string, any>) => { value.candidates[1].mergeTarget.path = "../escape.md"; }, "inside the Vault"]
  ])("rejects %s", (_name, mutate, message) => {
    expect(parseMutated(mutate)).toThrow(message);
  });

  it("detects merge evidence that does not match its Markdown", async () => {
    const target = mergeTarget(example());

    await expect(verifyMergeEvidence({ ...target, beforeSha256: "0".repeat(64) })).rejects.toThrow("beforeSha256");
    await expect(verifyMergeEvidence({ ...target, changes: [{ ...target.changes[0], after: [] }] })).rejects.toThrow("does not match the Markdown evidence");
    await expect(verifyMergeEvidence({ ...target, afterMarkdown: target.afterMarkdown.replace("priority: 2", "priority: 1") })).rejects.toThrow("unrepresented priority");
    await expect(verifyMergeEvidence({ ...target, afterMarkdown: target.afterMarkdown.replace("rank: 1024", "rank: 2048") })).rejects.toThrow("unsupported Task field rank");
  });
});

describe("Import candidate transitions", () => {
  it("returns an edited candidate to pending at a new revision", () => {
    const before = example();
    const draft = { ...(candidate(before, "IC-01") as Extract<ImportCandidate, { operation: "create" }>).taskDraft, date: "2026-10-20" };

    const after = editCandidate(before, "IC-01", { operation: "create", taskDraft: draft }, NOW);

    const edited = candidate(after, "IC-01");
    expect([edited.revision, edited.decision, edited.decisionRevision, edited.decidedAt]).toEqual([2, "pending", null, null]);
    expect([after.revision, after.status, after.updatedAt]).toEqual([4, "pending", NOW]);
    expect(candidate(before, "IC-01").revision).toBe(1);
  });

  it("regenerates merge evidence when a merge is edited", async () => {
    const after = editCandidate(example(), "IC-02", { operation: "merge", values: { date: "2026-10-19" }, reason: "The demo moved." }, NOW);

    const target = mergeTarget(after);
    expect(target.changes.map((change) => [change.field, change.reason])).toEqual([
      ["date", "The demo moved."],
      ["steps", "会話で明示されたデモ準備の次の行動を同じ完了条件へ統合する"]
    ]);
    expect(target.afterMarkdown).toContain("date: \"2026-10-19\"");
    expect(target.beforeSha256).toBe(await sha256(target.beforeMarkdown));
    await expect(verifyMergeEvidence(target)).resolves.toBeUndefined();
    expect(candidate(after, "IC-02").diffViewedRevision).toBeNull();
  });

  it("rejects edits that would leave a merge without changes or without target evidence", () => {
    const proposal = example();
    const steps = (mergeTarget(proposal).changes[0].before) as never;

    expect(() => editCandidate(proposal, "IC-02", { operation: "merge", values: { steps }, reason: "Undo." }, NOW)).toThrow("at least one field");
    expect(() => editCandidate(proposal, "IC-01", { operation: "merge", values: { notes: "x" }, reason: "Merge." }, NOW)).toThrow("no merge target evidence");
  });

  it("keeps the original merge target when switching away and back", () => {
    const excluded = editCandidate(example(), "IC-02", { operation: "exclude", exclusionReason: "Already covered." }, NOW);
    const merged = editCandidate(excluded, "IC-02", { operation: "merge", values: {}, reason: "Back to merge." }, NOW);

    expect(candidate(excluded, "IC-02").operation).toBe("exclude");
    expect(candidate(merged, "IC-02").operation).toBe("merge");
    expect(candidate(merged, "IC-02").revision).toBe(4);
  });

  it("reads merge target fields before and after the merge in Task draft shape", () => {
    const proposal = example();
    const fields = mergeTargetFields(candidate(proposal, "IC-02"));

    expect(fields?.before).toEqual({ title: "明日のデモを準備する", date: "2026-10-18", priority: 2, labels: ["context/pc"], project: null, steps: [{ text: "デモデータを準備する", completed: false, date: null }], notes: "" });
    expect(fields?.after.steps.map((step) => step.text)).toEqual(["デモデータを準備する", "検索フィルターを確認する"]);
    expect(mergeTargetFields(candidate(proposal, "IC-01"))).toBeNull();
  });

  it("records decisions at the candidate revision", () => {
    const held = decideCandidate(example(), "IC-03", "hold", NOW);
    const approved = decideCandidate(held, "IC-03", "approved", NOW);
    const undecided = decideCandidate(approved, "IC-03", "pending", NOW);

    expect(held.status).toBe("pending");
    expect(approved.status).toBe("ready-to-apply");
    expect([candidate(undecided, "IC-03").decisionRevision, candidate(undecided, "IC-03").decidedAt]).toEqual([null, null]);
  });
});

describe("formal apply", () => {
  it("lists eligible candidates and unviewed merges that need acknowledgement", () => {
    const plan = planFormalApply(example());

    expect(plan.eligible.map((item) => item.id)).toEqual(["IC-01", "IC-02", "IC-03"]);
    expect(plan.counts).toEqual({ create: 1, merge: 1, exclude: 1 });
    expect(plan.unviewedMerges).toEqual([{ candidateId: "IC-02", targetTitle: "明日のデモを準備する" }]);
    expect(plan.requiresAcknowledgement).toBe(true);
    const viewed = planFormalApply(markDiffViewed(example(), "IC-02", NOW));
    expect([viewed.unviewedMerges, viewed.requiresAcknowledgement]).toEqual([[], false]);
  });

  it("blocks held, undecided, outdated and stale candidates", () => {
    let proposal = decideCandidate(example(), "IC-03", "hold", NOW);
    proposal = editCandidate(proposal, "IC-01", { operation: "exclude", exclusionReason: "Not an action." }, NOW);
    proposal = markSourceStale(proposal, "SRC-02", "The conversation snapshot changed.", NOW);

    expect(planFormalApply(proposal).blocked).toEqual([
      { candidateId: "IC-01", reason: "undecided" },
      { candidateId: "IC-02", reason: "stale" },
      { candidateId: "IC-03", reason: "held" }
    ]);
    expect(proposal.health).toBe("stale");
    const outdated = parseImportReview(exampleText().replace('"revision": 2,', '"revision": 3,').replace('"status": "ready-to-apply"', '"status": "pending"'));
    expect(planFormalApply(outdated).blocked).toEqual([{ candidateId: "IC-02", reason: "outdated-decision" }]);
  });

  it("keeps failed candidates eligible for retry and moves applied work forward", () => {
    const failed = recordApplication(example(), "IC-01", { kind: "failed", error: "Disk full" }, NOW);
    expect([failed.health, candidate(failed, "IC-01").application.status]).toEqual(["failed", "failed"]);
    expect(planFormalApply(failed).eligible.map((item) => item.id)).toContain("IC-01");

    const partial = recordApplication(failed, "IC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);
    expect([partial.status, partial.health]).toEqual(["partially-applied", "ok"]);
    expect(() => recordApplication(partial, "IC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW)).toThrow("already applied");
    expect(() => editCandidate(partial, "IC-01", { operation: "exclude", exclusionReason: "No." }, NOW)).toThrow("already applied");
  });

  it("validates the promoted Task for each operation", () => {
    const proposal = example();

    expect(() => recordApplication(proposal, "IC-01", { kind: "applied", promotedTaskId: null }, NOW)).toThrow("requires a promoted Task ID");
    expect(() => recordApplication(proposal, "IC-03", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW)).toThrow("requires no promoted Task ID");
    expect(() => recordApplication(proposal, "IC-02", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW)).toThrow("must promote its target");
  });

  it("archives only fully applied reviews", () => {
    expect(() => archiveReview(example(), NOW)).toThrow("unapplied candidates");
    const applied = applyAll(example());
    expect(applied.status).toBe("applied");

    const archived = archiveReview(applied, NOW);

    expect([archived.status, archived.archivedAt]).toEqual(["history", NOW]);
    expect(planFormalApply(archived).eligible).toEqual([]);
    expect(() => decideCandidate(archived, "IC-01", "hold", NOW)).toThrow("in History");
    expect(parseImportReview(JSON.stringify(archived)).status).toBe("history");
  });
});

describe("Source note completion", () => {
  it("completes a note only when all of its candidates are applied, without excluded Task IDs", () => {
    const proposal = example();
    const created = recordApplication(proposal, "IC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);
    const complete = recordApplication(created, "IC-03", { kind: "applied", promotedTaskId: null }, NOW);

    expect(noteSourceCompletion(proposal)).toEqual([{ sourceId: "SRC-01", path: "Notes/2026-10-17 顧客定例.md", sha256: "a".repeat(64), complete: false, taskIds: [] }]);
    expect(noteSourceCompletion(created)[0].complete).toBe(false);
    expect(noteSourceCompletion(complete)[0]).toMatchObject({ complete: true, taskIds: [CREATED_TASK] });
    expect(newlyCompletedNoteSources(created, complete).map((source) => source.sourceId)).toEqual(["SRC-01"]);
    expect(newlyCompletedNoteSources(complete, complete)).toEqual([]);
  });

  it("marks only unapplied candidates from a changed Source stale", () => {
    const applied = recordApplication(example(), "IC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);

    const stale = markSourceStale(applied, "SRC-01", "The note changed.", NOW);

    expect(candidate(stale, "IC-01").health).toBe("ok");
    expect([candidate(stale, "IC-03").health, candidate(stale, "IC-03").decision]).toEqual(["stale", "pending"]);
    expect(candidate(stale, "IC-02").health).toBe("ok");
  });
});
