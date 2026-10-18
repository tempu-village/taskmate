import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import {
  archiveReview,
  decideCandidate,
  editCandidate,
  markDiffViewed,
  markSourceStale,
  parseSourceCandidateProposal,
  recordApplication
} from "../../../src/reviews/source-candidate/proposal";
import type { SourceCandidateProposal } from "../../../src/reviews/source-candidate/proposal";
import { NOW, exampleJson, exampleText, schemaJson } from "./fixture";

const ajv = new Ajv2020({ allErrors: true });
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
const validate = ajv.compile(schemaJson());

function errors(value: unknown): string {
  return validate(value) ? "" : ajv.errorsText(validate.errors);
}

describe("Source candidate JSON Schema (Draft 2020-12)", () => {
  it("accepts the RFC example", () => {
    expect(errors(exampleJson())).toBe("");
  });

  it("accepts every state the Domain transitions can write", () => {
    const states: SourceCandidateProposal[] = [];
    let proposal = parseSourceCandidateProposal(exampleText());
    const record = (next: SourceCandidateProposal) => {
      states.push(next);
      proposal = next;
    };
    record(editCandidate(proposal, "SC-02", { operation: "merge", values: { date: "2026-10-19" }, reason: "The demo moved." }, NOW));
    record(markDiffViewed(proposal, "SC-02", NOW));
    record(decideCandidate(proposal, "SC-02", "approved", NOW));
    record(editCandidate(proposal, "SC-03", { operation: "exclude", exclusionReason: "Only a proposed meeting time." }, NOW));
    record(decideCandidate(proposal, "SC-03", "hold", NOW));
    record(decideCandidate(proposal, "SC-03", "approved", NOW));
    record(recordApplication(proposal, "SC-01", { kind: "failed", error: "Disk full" }, NOW));
    record(recordApplication(proposal, "SC-01", { kind: "applied", promotedTaskId: "55555555-5555-4555-8555-555555555555" }, NOW));
    record(markSourceStale(proposal, "SRC-02", "The snapshot changed.", NOW));
    record(editCandidate(proposal, "SC-02", { operation: "merge", values: {}, reason: "Renewed after review." }, NOW));
    record(decideCandidate(proposal, "SC-02", "approved", NOW));
    record(recordApplication(proposal, "SC-02", { kind: "applied", promotedTaskId: "44444444-4444-4444-8444-444444444444" }, NOW));
    record(recordApplication(proposal, "SC-03", { kind: "applied", promotedTaskId: null }, NOW));
    record(archiveReview(proposal, NOW));

    for (const state of states) {
      const json = JSON.parse(JSON.stringify(state));
      expect(errors(json), `${state.status} revision ${state.revision}`).toBe("");
      expect(() => parseSourceCandidateProposal(JSON.stringify(json))).not.toThrow();
    }
    expect(states.at(-1)?.status).toBe("history");
  });

  it.each([
    ["a wrong review type", (value: Record<string, any>) => { value.reviewType = "task-change"; }],
    ["an unknown property", (value: Record<string, any>) => { value.candidates[0].extra = true; }],
    ["a create without a Task draft", (value: Record<string, any>) => { delete value.candidates[0].taskDraft; }],
    ["a malformed SHA-256", (value: Record<string, any>) => { value.sources[0].sha256 = "abc"; }],
    ["a malformed date-time", (value: Record<string, any>) => { value.updatedAt = "yesterday"; }],
    ["an unknown decision", (value: Record<string, any>) => { value.candidates[0].decision = "rejected"; }]
  ])("rejects %s in both the Schema and the TaskMate validator", (_name, mutate) => {
    const value = exampleJson();
    mutate(value);

    expect(errors(value)).not.toBe("");
    expect(() => parseSourceCandidateProposal(JSON.stringify(value))).toThrow();
  });
});
