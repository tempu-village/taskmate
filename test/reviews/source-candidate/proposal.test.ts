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
  parseSourceCandidateProposal,
  planFormalApply,
  recordApplication,
  verifyMergeEvidence
} from "../../../src/reviews/source-candidate/proposal";
import type { SourceCandidate, SourceCandidateProposal } from "../../../src/reviews/source-candidate/proposal";
import { sha256 } from "../../../src/shared/sha256";
import { NOW, exampleJson, exampleText } from "./fixture";

const CREATED_TASK = "55555555-5555-4555-8555-555555555555";
const MERGE_TARGET = "44444444-4444-4444-8444-444444444444";

function example(): SourceCandidateProposal {
  return parseSourceCandidateProposal(exampleText());
}

function candidate(proposal: SourceCandidateProposal, id: string): SourceCandidate {
  const found = proposal.candidates.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function mergeTarget(proposal: SourceCandidateProposal) {
  const merge = candidate(proposal, "SC-02");
  if (merge.operation !== "merge") throw new Error("SC-02 must merge");
  return merge.mergeTarget;
}

function parseMutated(mutate: (value: Record<string, any>) => void): () => SourceCandidateProposal {
  const value = exampleJson();
  mutate(value);
  return () => parseSourceCandidateProposal(JSON.stringify(value));
}

function applyAll(proposal: SourceCandidateProposal): SourceCandidateProposal {
  let next = recordApplication(proposal, "SC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);
  next = recordApplication(next, "SC-02", { kind: "applied", promotedTaskId: MERGE_TARGET }, NOW);
  return recordApplication(next, "SC-03", { kind: "applied", promotedTaskId: null }, NOW);
}

describe("Source candidate Proposal parsing", () => {
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
    ["a statement mapped twice", (value: Record<string, any>) => { value.candidates[2].sourceRefs = value.candidates[0].sourceRefs; }, "already mapped by SC-01"],
    ["an unknown Source reference", (value: Record<string, any>) => { value.candidates[0].sourceRefs[0].sourceId = "SRC-09"; }, "unknown Source SRC-09"],
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

describe("Source candidate transitions", () => {
  it("returns an edited candidate to pending at a new revision", () => {
    const before = example();
    const draft = { ...(candidate(before, "SC-01") as Extract<SourceCandidate, { operation: "create" }>).taskDraft, date: "2026-10-20" };

    const after = editCandidate(before, "SC-01", { operation: "create", taskDraft: draft }, NOW);

    const edited = candidate(after, "SC-01");
    expect([edited.revision, edited.decision, edited.decisionRevision, edited.decidedAt]).toEqual([2, "pending", null, null]);
    expect([after.revision, after.status, after.updatedAt]).toEqual([4, "pending", NOW]);
    expect(candidate(before, "SC-01").revision).toBe(1);
  });

  it("regenerates merge evidence when a merge is edited", async () => {
    const after = editCandidate(example(), "SC-02", { operation: "merge", values: { date: "2026-10-19" }, reason: "The demo moved." }, NOW);

    const target = mergeTarget(after);
    expect(target.changes.map((change) => [change.field, change.reason])).toEqual([
      ["date", "The demo moved."],
      ["steps", "会話で明示されたデモ準備の次の行動を同じ完了条件へ統合する"]
    ]);
    expect(target.afterMarkdown).toContain("date: \"2026-10-19\"");
    expect(target.beforeSha256).toBe(await sha256(target.beforeMarkdown));
    await expect(verifyMergeEvidence(target)).resolves.toBeUndefined();
    expect(candidate(after, "SC-02").diffViewedRevision).toBeNull();
  });

  it("rejects edits that would leave a merge without changes or without target evidence", () => {
    const proposal = example();
    const steps = (mergeTarget(proposal).changes[0].before) as never;

    expect(() => editCandidate(proposal, "SC-02", { operation: "merge", values: { steps }, reason: "Undo." }, NOW)).toThrow("at least one field");
    expect(() => editCandidate(proposal, "SC-01", { operation: "merge", values: { notes: "x" }, reason: "Merge." }, NOW)).toThrow("no merge target evidence");
  });

  it("keeps the original merge target when switching away and back", () => {
    const excluded = editCandidate(example(), "SC-02", { operation: "exclude", exclusionReason: "Already covered." }, NOW);
    const merged = editCandidate(excluded, "SC-02", { operation: "merge", values: {}, reason: "Back to merge." }, NOW);

    expect(candidate(excluded, "SC-02").operation).toBe("exclude");
    expect(candidate(merged, "SC-02").operation).toBe("merge");
    expect(candidate(merged, "SC-02").revision).toBe(4);
  });

  it("reads merge target fields before and after the merge in Task draft shape", () => {
    const proposal = example();
    const fields = mergeTargetFields(candidate(proposal, "SC-02"));

    expect(fields?.before).toEqual({ title: "明日のデモを準備する", date: "2026-10-18", priority: 2, labels: ["context/pc"], project: null, steps: [{ text: "デモデータを準備する", completed: false, date: null }], notes: "" });
    expect(fields?.after.steps.map((step) => step.text)).toEqual(["デモデータを準備する", "検索フィルターを確認する"]);
    expect(mergeTargetFields(candidate(proposal, "SC-01"))).toBeNull();
  });

  it("records decisions at the candidate revision", () => {
    const held = decideCandidate(example(), "SC-03", "hold", NOW);
    const approved = decideCandidate(held, "SC-03", "approved", NOW);
    const undecided = decideCandidate(approved, "SC-03", "pending", NOW);

    expect(held.status).toBe("pending");
    expect(approved.status).toBe("ready-to-apply");
    expect([candidate(undecided, "SC-03").decisionRevision, candidate(undecided, "SC-03").decidedAt]).toEqual([null, null]);
  });
});

describe("formal apply", () => {
  it("lists eligible candidates and unviewed merges that need acknowledgement", () => {
    const plan = planFormalApply(example());

    expect(plan.eligible.map((item) => item.id)).toEqual(["SC-01", "SC-02", "SC-03"]);
    expect(plan.counts).toEqual({ create: 1, merge: 1, exclude: 1 });
    expect(plan.unviewedMerges).toEqual([{ candidateId: "SC-02", targetTitle: "明日のデモを準備する" }]);
    expect(plan.requiresAcknowledgement).toBe(true);
    const viewed = planFormalApply(markDiffViewed(example(), "SC-02", NOW));
    expect([viewed.unviewedMerges, viewed.requiresAcknowledgement]).toEqual([[], false]);
  });

  it("blocks held, undecided, outdated and stale candidates", () => {
    let proposal = decideCandidate(example(), "SC-03", "hold", NOW);
    proposal = editCandidate(proposal, "SC-01", { operation: "exclude", exclusionReason: "Not an action." }, NOW);
    proposal = markSourceStale(proposal, "SRC-02", "The conversation snapshot changed.", NOW);

    expect(planFormalApply(proposal).blocked).toEqual([
      { candidateId: "SC-01", reason: "undecided" },
      { candidateId: "SC-02", reason: "stale" },
      { candidateId: "SC-03", reason: "held" }
    ]);
    expect(proposal.health).toBe("stale");
    const outdated = parseSourceCandidateProposal(exampleText().replace('"revision": 2,', '"revision": 3,').replace('"status": "ready-to-apply"', '"status": "pending"'));
    expect(planFormalApply(outdated).blocked).toEqual([{ candidateId: "SC-02", reason: "outdated-decision" }]);
  });

  it("keeps failed candidates eligible for retry and moves applied work forward", () => {
    const failed = recordApplication(example(), "SC-01", { kind: "failed", error: "Disk full" }, NOW);
    expect([failed.health, candidate(failed, "SC-01").application.status]).toEqual(["failed", "failed"]);
    expect(planFormalApply(failed).eligible.map((item) => item.id)).toContain("SC-01");

    const partial = recordApplication(failed, "SC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);
    expect([partial.status, partial.health]).toEqual(["partially-applied", "ok"]);
    expect(() => recordApplication(partial, "SC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW)).toThrow("already applied");
    expect(() => editCandidate(partial, "SC-01", { operation: "exclude", exclusionReason: "No." }, NOW)).toThrow("already applied");
  });

  it("validates the promoted Task for each operation", () => {
    const proposal = example();

    expect(() => recordApplication(proposal, "SC-01", { kind: "applied", promotedTaskId: null }, NOW)).toThrow("requires a promoted Task ID");
    expect(() => recordApplication(proposal, "SC-03", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW)).toThrow("requires no promoted Task ID");
    expect(() => recordApplication(proposal, "SC-02", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW)).toThrow("must promote its target");
  });

  it("archives only fully applied reviews", () => {
    expect(() => archiveReview(example(), NOW)).toThrow("unapplied candidates");
    const applied = applyAll(example());
    expect(applied.status).toBe("applied");

    const archived = archiveReview(applied, NOW);

    expect([archived.status, archived.archivedAt]).toEqual(["history", NOW]);
    expect(planFormalApply(archived).eligible).toEqual([]);
    expect(() => decideCandidate(archived, "SC-01", "hold", NOW)).toThrow("in History");
    expect(parseSourceCandidateProposal(JSON.stringify(archived)).status).toBe("history");
  });
});

describe("Source note completion", () => {
  it("completes a note only when all of its candidates are applied, without excluded Task IDs", () => {
    const proposal = example();
    const created = recordApplication(proposal, "SC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);
    const complete = recordApplication(created, "SC-03", { kind: "applied", promotedTaskId: null }, NOW);

    expect(noteSourceCompletion(proposal)).toEqual([{ sourceId: "SRC-01", path: "Notes/2026-10-17 顧客定例.md", sha256: "a".repeat(64), complete: false, taskIds: [] }]);
    expect(noteSourceCompletion(created)[0].complete).toBe(false);
    expect(noteSourceCompletion(complete)[0]).toMatchObject({ complete: true, taskIds: [CREATED_TASK] });
    expect(newlyCompletedNoteSources(created, complete).map((source) => source.sourceId)).toEqual(["SRC-01"]);
    expect(newlyCompletedNoteSources(complete, complete)).toEqual([]);
  });

  it("marks only unapplied candidates from a changed Source stale", () => {
    const applied = recordApplication(example(), "SC-01", { kind: "applied", promotedTaskId: CREATED_TASK }, NOW);

    const stale = markSourceStale(applied, "SRC-01", "The note changed.", NOW);

    expect(candidate(stale, "SC-01").health).toBe("ok");
    expect([candidate(stale, "SC-03").health, candidate(stale, "SC-03").decision]).toEqual(["stale", "pending"]);
    expect(candidate(stale, "SC-02").health).toBe("ok");
  });
});
